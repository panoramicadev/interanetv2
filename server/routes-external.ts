import { Router } from 'express';
import { storage } from './storage';
import { validateApiKey, requireApiRole, type ApiAuthRequest } from './middleware/api-auth';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './db';
import { resolvePriceListForClient } from './price-list-resolver';
import { resolverLineaCredito } from '@shared/credito';
import { ubicacionCanonicaDe } from '@shared/chile-geo';
import {
  users,
  notifications,
  ecommerceOrders,
  salespeopleUsers,
  customPriceLists,
  customPriceListItems,
  priceList as priceListTable,
  crmSeguimientoClientes,
  crmSeguimientoHitos,
  clients,
  salesTransactions,
  pedidoBitacora,
  retailLocations,
} from '@shared/schema';
import { desc, eq, and, or, sql, ilike, inArray, getTableColumns } from 'drizzle-orm';
import { renderQuoteHtml } from '@shared/quote-pdf-template';
import { renderQuotePdf } from './utils/quote-pdf-renderer';
import { signPdfToken } from './utils/pdf-signed-url';
import { accentInsensitiveContains } from './utils/sql-search';
// ─── CRUD extendido: imports adicionales (8 módulos) ───
import {
  priceListOffers, priceListOfferClients, insertPriceListOffersSchema, insertCustomPriceListItemSchema, colorPalette,
  insertClientSchema, insertRutaComercialSchema, insertRutaClienteSchema, rutaVisitas,
  taskGroups, taskAssignments,
  gastosMarketing,
  commissionSettings, commissionOverrides, presupuestoVentas,
  insertGastoEmpresarialSchema, insertFundAllocationSchema, insertGoalSchema,
  insertProyeccionVentaSchema, insertPresupuestoVentasSchema, bulkPresupuestoVentasSchema,
  storeConfig,
  type QuoteRequestItem,
} from '@shared/schema';
import { executeCostosETL } from './etl-costos';
import { getETLStatus } from './etl-incremental';
import { matchEcommerceOrdersToErp } from './utils/erp-match';
import { fetchTmsShipping, fetchTmsOrders, fetchTmsOrderDetail, fetchTmsEstadoCounts, fetchTmsRutas, fetchTmsRutaDetail, isTmsConfigured, TMS_ETAPAS, TMS_ESTADOS_ALL, TMS_RUTA_ESTADOS } from './utils/tms-logistica';
import { getQuoteRequests, getQuoteRequestById, updateQuoteRequestStatus } from './services/quote-request.service';
import { renderQuoteRequestPdfHtml } from './services/quote-request-pdf';
import { isValidRut, formatRut } from '@shared/rut';
import { getCommissionSummary, getSalespersonDetail } from './commissions';

const router = Router();

// All external API routes require API key authentication
router.use(validateApiKey);

// Parse `limit` from query string with sensible defaults for AI/chat clients.
// Default 500 rows, hard cap 5000 to protect the DB.
function parseLimit(raw: unknown, def = 500, max = 5000): number {
  const n = parseInt((raw as string) ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

function parseOffset(raw: unknown): number {
  const n = parseInt((raw as string) ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// ─── Pipeline CRM: vocabulario canónico ───
// Espeja client/src/lib/crm-seguimiento.ts, que es la fuente única del pipeline.
// El esquema viejo (nuevo/contactado/…) sigue vivo en filas antiguas, así que un
// filtro por estado se traduce antes de consultar: pedir "contactado" tiene que
// devolver lo mismo que muestra el panel bajo "Seguimiento".
const ESTADOS_CRM = ['prospecto', 'seguimiento', 'cotizacion', 'venta', 'perdido'] as const;

const ESTADOS_CRM_LEGACY: Record<string, (typeof ESTADOS_CRM)[number]> = {
  nuevo: 'prospecto',
  contactado: 'seguimiento',
  completado: 'venta',
  despacho: 'venta',
};

function normalizeEstadoCrm(estado: string): string {
  const v = estado.trim().toLowerCase();
  return ESTADOS_CRM_LEGACY[v] ?? v;
}

// El segmento es texto libre y cada origen lo escribe distinto ("Ferretería" en
// el CRM, "FERRETERIAS" en el catálogo del ERP), así que se compara por raíz.
const SEGMENTO_RAICES = ['ferreter', 'construc', 'industria', 'digital', 'retail', 'mercado publico', 'mct'];

function segmentoRaiz(valor: string): string {
  const limpio = valor.trim().toLowerCase()
    .replace(/[áàäâã]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
  return SEGMENTO_RAICES.find((raiz) => limpio.startsWith(raiz) || raiz.startsWith(limpio)) ?? limpio;
}

// ============================================
// OpenAPI 3.0 spec (for Claude / ChatGPT / Postman / MCP)
// AI clients can fetch this and convert paths into tools[] automatically.
// ============================================

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'API Externa Panorámica',
    version: '2.0.0',
    description: 'API REST de la intranet Panorámica. Pensada para integraciones y asistentes IA (Claude, ChatGPT). Todas las rutas requieren header X-API-Key.',
  },
  servers: [{ url: '/api/external', description: 'API externa' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey' as const, in: 'header' as const, name: 'X-API-Key' },
      // Token de usuario emitido por el Authorization Server de la intranet
      // (ver server/routes-oauth.ts). Es lo que usa el MCP.
      OAuthUser: { type: 'http' as const, scheme: 'bearer' as const, bearerFormat: 'opaque' },
    },
    parameters: {
      limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, maximum: 5000 } },
      offset: { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' }, message: { type: 'string' } } },
      QuoteItem: {
        type: 'object',
        required: ['type', 'productName', 'quantity', 'unitPrice'],
        properties: {
          type: { type: 'string', enum: ['standard', 'custom'] },
          productCode: { type: 'string', description: 'Código de price_list (para type=standard)' },
          productName: { type: 'string' },
          productUnit: { type: 'string' },
          customSku: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          notes: { type: 'string' },
        },
      },
      Quote: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          quoteNumber: { type: 'string' },
          clientName: { type: 'string' },
          clientRut: { type: 'string' },
          clientEmail: { type: 'string' },
          clientPhone: { type: 'string' },
          clientAddress: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'converted'] },
          createdBy: { type: 'string' },
          creatorName: { type: 'string' },
          paymentCondition: { type: 'string' },
          segment: { type: 'string' },
          subtotal: { type: 'number' },
          discount: { type: 'number' },
          taxRate: { type: 'number' },
          taxAmount: { type: 'number' },
          total: { type: 'number' },
          notes: { type: 'string' },
          validUntil: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      QuoteCreate: {
        type: 'object',
        required: ['clientName', 'salespersonName'],
        properties: {
          clientName: { type: 'string' },
          salespersonName: { type: 'string', description: 'Nombre del vendedor (resolver primero con GET /usuarios?source=salespeople)' },
          clientRut: { type: 'string' },
          clientEmail: { type: 'string' },
          clientPhone: { type: 'string' },
          clientAddress: { type: 'string' },
          paymentCondition: { type: 'string' },
          segment: { type: 'string' },
          subtotal: { type: 'number' },
          discount: { type: 'number' },
          taxRate: { type: 'number', default: 19 },
          taxAmount: { type: 'number' },
          total: { type: 'number' },
          notes: { type: 'string' },
          validUntil: { type: 'string', format: 'date' },
          items: { type: 'array', items: { $ref: '#/components/schemas/QuoteItem' } },
        },
      },
      ProductGroup: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nombre: { type: 'string' },
          categoria: { type: 'string' },
          descripcion: { type: 'string' },
          variationCount: { type: 'integer' },
          variations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'string' },
                producto: { type: 'string' },
                color: { type: 'string' },
                unidad: { type: 'string' },
                precio: { type: 'number' },
                isMainVariant: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }, { OAuthUser: [] }],
  paths: {
    // ═══ CRUD extendido (8 módulos) ═══
'/productos/{codigo}/precio': {
      patch: {
        summary: 'Editar precio de lista de un producto por SKU',
        parameters: [{ name: 'codigo', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['price'], properties: {
          price: { type: 'number' }, reason: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'Producto actualizado' }, '400': { description: 'Precio inválido' } },
      },
    },
    '/productos/{codigo}/toggle-activo': {
      patch: {
        summary: 'Activar/desactivar el producto en la tienda ecommerce',
        parameters: [{ name: 'codigo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Producto con activo invertido' }, '404': { description: 'No encontrado' } },
      },
    },
    '/listas-precio/{code}/items': {
      get: {
        summary: 'Items (SKU + precio) de una lista custom con datos del producto',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: '{ items }' } },
      },
      post: {
        summary: 'Agregar un item (override de precio) a una lista custom',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['codigo'], properties: {
          codigo: { type: 'string', description: 'SKU (price_list.codigo)' }, precio: { type: 'number' },
        } } } } },
        responses: { '201': { description: 'Created' }, '409': { description: 'SKU ya existe en la lista' } },
      },
    },
    '/listas-precio/{code}/items/{id}': {
      patch: {
        summary: 'Editar el precio de un item de lista custom',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { precio: { type: 'number' } } } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      delete: {
        summary: 'Eliminar un item de una lista custom',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/listas-precio/{code}/items/bulk-adjust': {
      post: {
        summary: 'Ajuste masivo de precios de una lista custom (± porcentaje, opcional redondeo a decena)',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['percentage'], properties: {
          percentage: { type: 'number', description: '-100 a 100' }, roundToDecena: { type: 'boolean' },
        } } } } },
        responses: { '200': { description: 'OK' }, '400': { description: 'Porcentaje inválido' } },
      },
    },
    '/ofertas-precio': {
      get: {
        summary: 'Lista ofertas de precio por cliente (regular o pallet) con clientes objetivo',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: '{ items } con targetClients[] y clientCount' } },
      },
      post: {
        summary: 'Crear oferta de precio',
        description: 'offerType=regular requiere precio. offerType=pallet requiere unitsPerPallet + (discountPct XOR palletPrice). allClients=false requiere clientIds[].',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['codigo'], properties: {
          codigo: { type: 'string' },
          offerType: { type: 'string', enum: ['regular', 'pallet'], default: 'regular' },
          precio: { type: 'number' },
          unitsPerPallet: { type: 'integer' }, discountPct: { type: 'number' }, palletPrice: { type: 'number' },
          paused: { type: 'boolean' }, allClients: { type: 'boolean', default: true },
          clientIds: { type: 'array', items: { type: 'string' }, description: 'clients.id (requerido si allClients=false)' },
        } } } } },
        responses: { '201': { description: 'Created' }, '400': { description: 'Validación' } },
      },
    },
    '/ofertas-precio/{id}': {
      patch: {
        summary: 'Editar oferta (precio, pausa, audiencia, campos pallet). offerType es inmutable.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          precio: { type: 'number' }, paused: { type: 'boolean' }, allClients: { type: 'boolean' },
          unitsPerPallet: { type: 'integer' }, discountPct: { type: 'number' }, palletPrice: { type: 'number' },
          clientIds: { type: 'array', items: { type: 'string' } },
        } } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      delete: {
        summary: 'Eliminar oferta',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ofertas-precio/bulk-adjust': {
      post: {
        summary: 'Ajuste masivo de precios de todas las ofertas',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          percentage: { type: 'number' }, roundToDecena: { type: 'boolean' },
        } } } } },
        responses: { '200': { description: '{ adjustedCount }' } },
      },
    },
    '/tintometria/calculate': {
      post: {
        summary: 'Calcular costo/mezcla de un color en un envase',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['colorId', 'envaseId'], properties: {
          colorId: { type: 'string' }, envaseId: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'Cálculo de mezcla y costo' }, '404': { description: 'Color o envase no encontrado' } },
      },
    },
    '/tintometria/{entity}': {
      get: {
        summary: 'Listar registros de tintometría de una entidad',
        parameters: [
          { name: 'entity', in: 'path', required: true, schema: { type: 'string', enum: ['bases', 'colores', 'envases', 'parametros', 'pigments', 'recetas'] } },
          { name: 'colorId', in: 'query', schema: { type: 'string' }, description: 'Solo para entity=recetas: filtra recetas por color' },
        ],
        responses: { '200': { description: 'Array de registros' }, '404': { description: 'Entidad desconocida' } },
      },
      post: {
        summary: 'Crear registro de tintometría',
        parameters: [{ name: 'entity', in: 'path', required: true, schema: { type: 'string', enum: ['bases', 'colores', 'envases', 'parametros', 'pigments', 'recetas'] } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/tintometria/{entity}/{id}': {
      get: {
        summary: 'Detalle de un registro de tintometría',
        parameters: [
          { name: 'entity', in: 'path', required: true, schema: { type: 'string', enum: ['bases', 'colores', 'envases', 'parametros', 'pigments', 'recetas'] } },
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      patch: {
        summary: 'Actualizar registro de tintometría (parcial)',
        parameters: [
          { name: 'entity', in: 'path', required: true, schema: { type: 'string', enum: ['bases', 'colores', 'envases', 'parametros', 'pigments', 'recetas'] } },
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Eliminar registro de tintometría',
        parameters: [
          { name: 'entity', in: 'path', required: true, schema: { type: 'string', enum: ['bases', 'colores', 'envases', 'parametros', 'pigments', 'recetas'] } },
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/colores-paleta': {
      get: {
        summary: 'Paleta de colores (colores de la tienda + hex asignado)',
        responses: { '200': { description: '{ palette: [{ nombreColor, hex }] }' } },
      },
      post: {
        summary: 'Upsert de uno o varios colores de la paleta',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['colors'], properties: {
          colors: { type: 'array', items: { type: 'object', required: ['nombreColor', 'hex'], properties: {
            nombreColor: { type: 'string' }, hex: { type: 'string', description: 'Hex #rgb o #rrggbb' },
          } } },
        } } } } },
        responses: { '200': { description: '{ ok, saved }' } },
      },
    },
    '/colores-paleta/{nombreColor}': {
      delete: {
        summary: 'Eliminar un color de la paleta por nombre',
        parameters: [{ name: 'nombreColor', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
// ── Clientes: maestro, ficha 360, catálogos, estado de cuenta / cartera / morosos ──
    '/clientes/tipos-negocio': {
      get: { summary: 'Catálogo de giros/tipos de negocio para filtrar clientes', responses: { '200': { description: 'Array de strings' } } },
    },
    '/clientes/tipos-entidad': {
      get: { summary: 'Catálogo de tipos de entidad para filtrar clientes', responses: { '200': { description: 'Array de strings' } } },
    },
    '/clientes/estado-cuenta': {
      get: {
        summary: 'Estado de cuenta consolidado del cliente (ficha SAP + cuenta eCommerce + solicitud pendiente + cartera)',
        parameters: [
          { name: 'name', in: 'query', schema: { type: 'string' }, description: 'Nombre exacto del cliente (name o rut es obligatorio)' },
          { name: 'rut', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ hasFicha, ficha, inEcommerce, linked, ecommerceUserId, clientId, pendingRequest }' }, '400': { description: 'name o rut requerido' } },
      },
    },
    '/clientes/cartera': {
      get: {
        summary: 'Cuentas por cobrar del cliente (documentos pendientes con vencimiento y saldo)',
        parameters: [
          { name: 'name', in: 'query', schema: { type: 'string' } },
          { name: 'rut', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ docs: [{ nudo, tido, vencimiento, saldo, vencida }] }' }, '400': { description: 'name o rut requerido' } },
      },
    },
    '/clientes/morosos': {
      get: {
        summary: 'Clientes con crédito vencido (cartera morosa)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'Array de clientes con crédito vencido' } },
      },
    },
    '/clientes/{id}/ficha': {
      get: {
        summary: 'Ficha 360 del cliente (maestro + cartera resumida + documentos abiertos)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'clients.id (uuid) o koen' }],
        responses: { '200': { description: 'Ficha con datos de contacto, crédito y cartera' }, '404': { description: 'No encontrado' } },
      },
    },
    '/clientes': {
      // (mantener el get existente y AGREGAR el post)
      post: {
        summary: 'Crear cliente (maestro). Valida RUT y evita duplicados por RUT',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nokoen', 'rten', 'email', 'foen'], properties: {
          nokoen: { type: 'string', description: 'Nombre del cliente' },
          rten: { type: 'string', description: 'RUT (se normaliza a 12.345.678-9)' },
          email: { type: 'string' }, foen: { type: 'string', description: 'Teléfono' },
          koen: { type: 'string', description: 'Código ERP (opcional; normalmente lo asigna el ERP)' },
          dien: { type: 'string', description: 'Dirección' }, cmen: { type: 'string', description: 'Comuna' },
          gien: { type: 'string', description: 'Giro / tipo de negocio' },
        } } } } },
        responses: { '201': { description: 'Created' }, '400': { description: 'Datos inválidos' }, '409': { description: 'RUT ya existe' } },
      },
    },
    '/clientes/{id}': {
      patch: {
        summary: 'Editar contacto del cliente (overrides que prevalecen sobre el ERP). Campo vacío quita el override',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'clients.id (uuid)' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          clientName: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' },
          address: { type: 'string' }, commune: { type: 'string' }, priceList: { type: 'string' },
        } } } } },
        responses: { '200': { description: '{ success, fichaOverrides }' }, '404': { description: 'No encontrado' } },
      },
    },
    // ── Rutas comerciales de visita ──
    '/rutas-comerciales': {
      get: { summary: 'Lista todas las rutas comerciales con sus vendedores', responses: { '200': { description: 'OK' } } },
      post: {
        summary: 'Crear ruta comercial',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nombre'], properties: {
          nombre: { type: 'string' },
          vendedorId: { type: 'string', description: 'salespeople_users.id (o usar vendedorIds[])' },
          vendedorIds: { type: 'array', items: { type: 'string' }, description: 'Multi-asignación de vendedores' },
          supervisorId: { type: 'string', description: 'Dueño/asignador (default: primer vendedor)' },
          segmento: { type: 'string', enum: ['ferreterias', 'construccion', 'digital', 'marketing'] },
          estado: { type: 'string', enum: ['activa', 'pausada', 'completada'], default: 'activa' },
          fecha: { type: 'string', format: 'date-time' }, observaciones: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' }, '400': { description: 'Datos inválidos' } },
      },
    },
    '/rutas-comerciales/vendedores': {
      get: { summary: 'Vendedores activos disponibles para asignar a rutas', responses: { '200': { description: 'OK' } } },
    },
    '/rutas-comerciales/{id}': {
      patch: {
        summary: 'Actualizar ruta (nombre, estado, segmento, fecha, vendedores)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true, properties: { vendedorIds: { type: 'array', items: { type: 'string' } } } } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Eliminar ruta (incluye clientes e histórico de visitas)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } },
      },
    },
    '/rutas-comerciales/{id}/clientes': {
      get: {
        summary: 'Clientes asignados a la ruta',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Asignar cliente a la ruta',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clienteId', 'clienteNombre'], properties: {
          clienteId: { type: 'string', description: 'koen del cliente' }, clienteNombre: { type: 'string' },
          orden: { type: 'integer' }, notas: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/rutas-comerciales/{id}/clientes/{koen}': {
      delete: {
        summary: 'Quitar cliente de la ruta',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'koen', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'Ruta no encontrada' } },
      },
    },
    '/rutas-comerciales/{id}/clientes/{koen}/visitado': {
      post: {
        summary: 'Marcar la visita al cliente como realizada/pendiente (con evidencia opcional)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'koen', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['visitado'], properties: {
          visitado: { type: 'boolean' }, nota: { type: 'string' }, imagenUrl: { type: 'string' },
          lat: { type: 'number' }, lng: { type: 'number' }, clienteNombre: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'Ruta no encontrada' } },
      },
    },
    '/rutas-comerciales/{id}/visitas': {
      get: {
        summary: 'Histórico de visitas de la ruta',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
'/ordenes': {
      get: {
        summary: 'Lista pedidos internos',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'confirmed', 'processing', 'completed', 'cancelled'] } },
          { name: 'clientName', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear pedido interno (con items[] inline opcional)',
        description: 'salespersonName es obligatorio (se resuelve a createdBy). Para nombres válidos: GET /usuarios?source=salespeople',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientName', 'salespersonName'], properties: {
          clientName: { type: 'string' }, salespersonName: { type: 'string' },
          clientId: { type: 'string' }, clientRut: { type: 'string' }, clientEmail: { type: 'string' }, clientPhone: { type: 'string' }, clientAddress: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'confirmed', 'processing', 'completed', 'cancelled'], default: 'draft' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          notes: { type: 'string' }, estimatedDeliveryDate: { type: 'string', format: 'date-time' },
          subtotal: { type: 'number' }, discount: { type: 'number' }, taxRate: { type: 'number', default: 19 }, taxAmount: { type: 'number' }, total: { type: 'number' },
          items: { type: 'array', items: { $ref: '#/components/schemas/QuoteItem' } },
        } } } } },
        responses: { '201': { description: 'Created' }, '404': { description: 'Vendedor no encontrado' } },
      },
    },
    '/ordenes/{id}': {
      get: {
        summary: 'Detalle de pedido + items',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      patch: {
        summary: 'Actualizar cabecera del pedido',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
    },
    '/ordenes/{id}/items': {
      get: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Agregar item a pedido (recalcula totales)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuoteItem' } } } },
        responses: { '201': { description: 'Created' }, '404': { description: 'No encontrado' } },
      },
    },
    '/cotizaciones/{id}/convertir-orden': {
      post: {
        summary: 'Convertir cotización en pedido (marca la cotización como converted)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Pedido creado' }, '404': { description: 'Cotización no encontrada' } },
      },
    },
    '/solicitudes-b2c': {
      get: {
        summary: 'Lista solicitudes del cotizador público B2C',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'contacted', 'quoted', 'sale', 'closed'] } },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: { '200': { description: '{ requests, count }' } },
      },
    },
    '/solicitudes-b2c/{id}': {
      get: {
        summary: 'Detalle de una solicitud B2C',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } },
      },
    },
    '/solicitudes-b2c/{id}/estado': {
      patch: {
        summary: 'Actualizar estado y/o notas internas de una solicitud B2C',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          status: { type: 'string', enum: ['pending', 'contacted', 'quoted', 'sale', 'closed'] },
          internalNotes: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } },
      },
    },
    '/solicitudes-b2c/{id}/pdf': {
      get: {
        summary: 'HTML imprimible de la solicitud B2C (requiere precios asignados)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'text/html' }, '400': { description: 'Sin precios asignados' }, '404': { description: 'No encontrada' } },
      },
    },
    '/ecommerce/erp-orders': {
      get: {
        summary: 'Pedidos del ERP (cruce FCV/NVV/GDV, últimos 90 días, agrupados)',
        parameters: [{ name: 'salesperson', in: 'query', schema: { type: 'string' }, description: 'Filtro por vendedor (ILIKE). Sin filtro devuelve todos.' }],
        responses: { '200': { description: '{ orders, count, nvvCount, gdvCount, fcvCount }' } },
      },
    },
    '/nvv': {
      get: {
        summary: 'Notas de venta pendientes de un vendedor',
        parameters: [
          { name: 'salesperson', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'salesperson requerido' } },
      },
    },
    '/gdv': {
      get: {
        summary: 'Guías de despacho de un vendedor',
        parameters: [{ name: 'salesperson', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '400': { description: 'salesperson requerido' } },
      },
    },
    '/gdv-pending': {
      get: {
        summary: 'Métricas globales de GDV pendiente',
        parameters: [
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ gdvSales, gdvCount }' } },
      },
    },
'/tareas/grupos': {
      get: {
        summary: 'Lista grupos/columnas del kanban del Panel de Trabajo',
        parameters: [{ name: 'segmento', in: 'query', schema: { type: 'string' }, description: 'ferreterias | construccion | digital | marketing' }],
        responses: { '200': { description: 'Array de grupos ordenados por sortOrder' } },
      },
      post: {
        summary: 'Crear grupo/columna del kanban',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'segmento'], properties: {
          name: { type: 'string' },
          segmento: { type: 'string', description: 'ferreterias | construccion | digital | marketing' },
          color: { type: 'string', default: 'blue' },
          userId: { type: 'string', description: 'Dueño del grupo (default: "api")' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/tareas/grupos/{id}': {
      patch: {
        summary: 'Actualizar grupo/columna (nombre, color, orden)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          name: { type: 'string' }, color: { type: 'string' }, sortOrder: { type: 'integer' },
        } } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      delete: {
        summary: 'Eliminar grupo/columna (desagrupa sus tareas)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/tareas/{id}/comentarios': {
      get: {
        summary: 'Hilo único de comentarios de la tarea (orden cronológico)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Agregar comentario al hilo de la tarea',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: {
          content: { type: 'string' }, autor: { type: 'string', description: 'Nombre del autor (default: nombre de la API key)' },
        } } } } },
        responses: { '201': { description: 'Created' }, '404': { description: 'Tarea no encontrada' }, '400': { description: 'La tarea no tiene asignaciones' } },
      },
    },
    '/tareas/{id}/comentarios/{commentId}': {
      delete: {
        summary: 'Eliminar un comentario de la tarea',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'commentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/tareas/{id}/actividades': {
      get: {
        summary: 'Lista actividades de la tarea (llamada, visita, cotización, cobranza, etc.)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Agregar actividad a la tarea',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tipo'], properties: {
          tipo: { type: 'string', description: 'llamada | visita | cotizacion | cobranza | correo | revision | otro' },
          descripcion: { type: 'string' },
          fecha: { type: 'string', format: 'date-time' },
          estado: { type: 'string', enum: ['pendiente', 'completada'], default: 'pendiente' },
          responsableId: { type: 'string' }, responsableNombre: { type: 'string' },
          rutaId: { type: 'string' }, rutaNombre: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/tareas/actividades/{actId}': {
      patch: {
        summary: 'Actualizar una actividad (estado, fecha, tipo, responsable)',
        parameters: [{ name: 'actId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          tipo: { type: 'string' }, descripcion: { type: 'string' }, fecha: { type: 'string', format: 'date-time' },
          estado: { type: 'string', enum: ['pendiente', 'completada'] },
          responsableId: { type: 'string' }, responsableNombre: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } },
      },
      delete: {
        summary: 'Eliminar una actividad',
        parameters: [{ name: 'actId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/tareas/{id}/asignaciones': {
      get: {
        summary: 'Lista asignaciones de la tarea',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Tarea no encontrada' } },
      },
      post: {
        summary: 'Agregar asignación a la tarea',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['assigneeType', 'assigneeId'], properties: {
          assigneeType: { type: 'string', description: 'supervisor | salesperson | user | segment' },
          assigneeId: { type: 'string', description: 'User ID o segmento (validar con GET /usuarios)' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'declined'], default: 'pending' },
          notes: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' }, '404': { description: 'Tarea no encontrada' } },
      },
    },
    '/tareas/{id}/asignaciones/{assignmentId}': {
      patch: {
        summary: 'Actualizar estado/notas/evidencia de una asignación',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'assignmentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'declined'] },
          notes: { type: 'string' },
          evidenceImages: { type: 'array', items: { type: 'string' }, description: 'URLs de imágenes de evidencia' },
        } } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } },
      },
    },
    '/tareas/{id}/asignaciones/{assignmentId}/leida': {
      post: {
        summary: 'Marcar una asignación como leída (readAt)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'assignmentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } },
      },
    },
    '/tareas/{id}/asignaciones/{assignmentId}/comentarios': {
      get: {
        summary: 'Comentarios de una asignación específica',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'assignmentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Agregar comentario a una asignación',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'assignmentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: {
          content: { type: 'string' }, autor: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/tareas/{id}/asignaciones/{assignmentId}/comentarios/{commentId}': {
      delete: {
        summary: 'Eliminar un comentario de asignación',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'assignmentId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'commentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
'/margenes/productos': {
      get: {
        summary: 'Tabla de márgenes: producto + costo de producción + agrupación comercial (familia/color/formato)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Busca en código/producto' },
          { name: 'family', in: 'query', schema: { type: 'string' }, description: 'Familia comercial (ecommerce_products.product_family)' },
          { name: 'color', in: 'query', schema: { type: 'string' } },
          { name: 'formato', in: 'query', schema: { type: 'string' }, description: 'Formato/unidad comercial (format_unit)' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: '{ items, totalCount, hasMore }' } },
      },
    },
    '/margenes/agrupaciones': {
      get: {
        summary: 'Opciones de filtro de márgenes (familias/colores/formatos), encadenables',
        parameters: [
          { name: 'family', in: 'query', schema: { type: 'string' } },
          { name: 'color', in: 'query', schema: { type: 'string' } },
          { name: 'formato', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ families[], colors[], formatos[] }' } },
      },
    },
    '/margenes/precios-gri': {
      get: {
        summary: 'Costos GRI de referencia por SKU (snapshot gri_prices_cache)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filtra por SKU (LIKE, case-insensitive)' },
        ],
        responses: { '200': { description: 'Mapa { "SKU": { price, date } }' } },
      },
    },
    '/margenes/top-productos': {
      get: {
        summary: 'Ranking de productos por ventas facturadas (excluye GDV)',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' }, description: 'YYYY | YYYY-MM | YYYY-MM-DD | current-month | last-month | last-30-days | last-90-days | YYYY-MM-DD_YYYY-MM-DD (con filterType=range)' },
          { name: 'filterType', in: 'query', schema: { type: 'string', enum: ['year', 'month', 'day', 'range'] } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: { '200': { description: '{ items[], periodTotalSales, totalCount }' } },
      },
    },
    '/margenes/ventas': {
      get: {
        summary: 'Margen real sobre ventas facturadas del período (revenue, costo, margen $, margen % ponderado y simple, producto de mayor y menor margen)',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' }, description: 'YYYY | YYYY-MM | YYYY-MM-DD | current-month | last-month | last-30-days | last-90-days. Default: mes en curso' },
          { name: 'filterType', in: 'query', schema: { type: 'string', enum: ['year', 'month', 'day', 'range'] }, description: 'Se deduce del formato de period si se omite' },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Rango explícito; junto con endDate tiene prioridad sobre period' },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ period, dateRange, totalRevenue, totalCost, totalMarginAmount, averageMarginPct, highestMargin, lowestMargin, ... }' } },
      },
    },
    '/margenes/ventas/por-producto': {
      get: {
        summary: 'Ranking de productos por margen del período (no por venta): revenue, costo, margen $ y % por producto',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'filterType', in: 'query', schema: { type: 'string', enum: ['year', 'month', 'day', 'range'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['highest', 'lowest', 'revenue'] }, description: 'Default highest (mayor margen %)' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: { '200': { description: '{ period, dateRange, sortBy, items[] }' } },
      },
    },
    '/margenes/ventas/por-vendedor': {
      get: {
        summary: 'Margen del período agrupado por vendedor',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'filterType', in: 'query', schema: { type: 'string', enum: ['year', 'month', 'day', 'range'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ period, dateRange, items[] }' } },
      },
    },
    '/margenes/ventas/por-segmento': {
      get: {
        summary: 'Margen del período agrupado por segmento',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'filterType', in: 'query', schema: { type: 'string', enum: ['year', 'month', 'day', 'range'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ period, dateRange, items[] }' } },
      },
    },
    '/ventas/comparar': {
      get: {
        summary: 'Compara dos períodos lado a lado: ventas, unidades, transacciones, clientes activos, ticket promedio y margen, con delta absoluto y porcentual',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' }, description: 'Período actual. Default: mes en curso' },
          { name: 'filterType', in: 'query', schema: { type: 'string', enum: ['year', 'month', 'day', 'range'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'comparePeriod', in: 'query', schema: { type: 'string' }, description: 'Período contra el cual comparar. Si se omite, el anterior equivalente (mes anterior, mismo mes del año pasado, etc.)' },
          { name: 'compareStartDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'compareEndDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'includeBreakdown', in: 'query', schema: { type: 'boolean', default: true }, description: 'Incluir apertura comparada por segmento y por vendedor' },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ current, previous, delta, bySegment[], bySalesperson[] }' } },
      },
    },
    '/margenes/etl-costos': {
      post: {
        summary: 'Dispara el ETL de costos (recalcula costos GRI desde SQL Server) — admin. Corre en segundo plano',
        responses: { '200': { description: '{ success, message, isRunning }' }, '403': { description: 'Requiere rol admin' } },
      },
    },
    '/margenes/etl-costos/estado': {
      get: {
        summary: 'Estado / última ejecución del ETL de costos',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'Estado del ETL costos' } },
      },
    },
'/logistica/envios': {
      get: {
        summary: 'Tablero de despacho: envíos del Market ingresados al ERP, enriquecidos con el TMS',
        description: 'Agrupa por estado (ingresado | preparacion | curso | entregado). Enriquece con el estado real de entrega del TMS. Sincroniza el puente ecommerce↔ERP (erpIdmaeedo) como efecto colateral.',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 90 }, description: 'Ventana en días. 0 = sin límite' },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['ingresado', 'preparacion', 'curso', 'entregado'] }, description: 'Filtra los envíos del resultado (el resumen se calcula sobre el total)' },
        ],
        responses: { '200': { description: '{ tmsEnabled, days, resumen, envios[] }' } },
      },
    },
    '/logistica/sync-erp': {
      post: {
        summary: 'Sincronizar con ERP: vincular pedidos ingresados sin erpIdmaeedo con su NVV',
        description: 'Empareja por RUT + fecha + monto y persiste el puente. Devuelve cuántos quedaron vinculados.',
        responses: { '200': { description: '{ evaluados, vinculados, tmsEnabled }' } },
      },
    },
    '/logistica/tms': {
      get: {
        summary: 'Espejo del TMS: KPIs por estado + página de órdenes (global o por RUT)',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Ventana en días. 0 = sin límite' },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['Pendiente', 'En Preparación', 'Preparada', 'Listo para Despacho', 'Despachado', 'Entregado', 'No Entregado'] } },
          { name: 'clienteIdErp', in: 'query', schema: { type: 'string' }, description: 'RUT del cliente (acota las órdenes a ese cliente)' },
          { name: 'fresh', in: 'query', schema: { type: 'boolean' }, description: 'Saltea el cache del TMS' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: '{ tmsEnabled, days, clienteIdErp, estados, kpis, page: { orders[], total, limit, offset } }' } },
      },
    },
    '/logistica/tms/{idErp}': {
      get: {
        summary: 'Detalle de una orden del TMS (etapas + entregas[])',
        parameters: [{ name: 'idErp', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Orden con items[] y entregas[]' }, '404': { description: 'Orden no encontrada' }, '503': { description: 'TMS no conectado' } },
      },
    },
    '/logistica/rutas': {
      get: {
        summary: 'Gestión de Rutas del TMS (solo lectura): listado con filtro por estado',
        parameters: [
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['Pendiente', 'Cargando', 'En Ruta', 'Completada'] } },
          { name: 'fresh', in: 'query', schema: { type: 'boolean' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: '{ tmsEnabled, estados, data[], total, limit, offset }' } },
      },
    },
    '/logistica/rutas/{id}': {
      get: {
        summary: 'Detalle de una ruta del TMS (con entregas[])',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Ruta con entregas[]' }, '404': { description: 'Ruta no encontrada' }, '503': { description: 'TMS no conectado' } },
      },
    },
'/marketing/inventario': {
      get: {
        summary: 'Inventario POP / merchandising (con último movimiento por item)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'nombre/descripcion/ubicacion (ILIKE)' },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['disponible', 'agotado', 'por_llegar'] } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear item de inventario POP',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nombre'], properties: {
          nombre: { type: 'string' }, descripcion: { type: 'string' },
          cantidad: { type: 'integer', default: 0 },
          unidad: { type: 'string', default: 'unidades' },
          ubicacion: { type: 'string' },
          costoUnitario: { type: 'string', description: 'numeric' },
          proveedor: { type: 'string' },
          estado: { type: 'string', enum: ['disponible', 'agotado', 'por_llegar'], default: 'disponible' },
          stockMinimo: { type: 'integer', default: 0 },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/marketing/inventario/summary': {
      get: { summary: 'Resumen de inventario ({ totalItems, stockBajo, valorTotal })', responses: { '200': { description: 'OK' } } },
    },
    '/marketing/inventario/{id}': {
      get: {
        summary: 'Detalle de item de inventario',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      patch: {
        summary: 'Actualizar item de inventario',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      delete: {
        summary: 'Eliminar item de inventario (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/inventario/{id}/movimientos': {
      get: {
        summary: 'Movimientos (kardex) del item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Registrar movimiento y ajustar stock',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tipo', 'cantidad'], properties: {
          tipo: { type: 'string', enum: ['entrada', 'salida', 'devolucion'] },
          cantidad: { type: 'integer', minimum: 1 },
          clienteNombre: { type: 'string', description: 'destinatario (salida) o quien devuelve (devolucion)' },
          nota: { type: 'string' }, usuarioNombre: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' }, '404': { description: 'Item no encontrado' } },
      },
    },
    '/marketing/gastos': {
      get: {
        summary: 'Gastos de marketing (financiero). ?mes=&anio= o solo ?anio=',
        parameters: [
          { name: 'anio', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'mes', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'anio requerido' } },
      },
      post: {
        summary: 'Crear gasto de marketing (admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['concepto', 'mes', 'anio', 'creadoPorId'], properties: {
          concepto: { type: 'string' }, descripcion: { type: 'string' },
          monto: { type: 'string', description: 'numeric', default: '0' },
          categoria: { type: 'string' }, proveedor: { type: 'string' },
          fecha: { type: 'string', format: 'date' },
          mes: { type: 'integer' }, anio: { type: 'integer' },
          estado: { type: 'string', enum: ['pendiente', 'con_oc', 'facturado'], default: 'pendiente' },
          presupuestoItemId: { type: 'string' },
          urlCotizacion: { type: 'string' }, urlOrdenCompra: { type: 'string' }, urlFactura: { type: 'string' },
          numeroFactura: { type: 'string' }, fechaFactura: { type: 'string', format: 'date' },
          creadoPorId: { type: 'string', description: 'users.id — resolver con GET /usuarios?source=users' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/marketing/gastos/{id}': {
      patch: {
        summary: 'Actualizar gasto (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Eliminar gasto (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/gastos/{id}/comentarios': {
      post: {
        summary: 'Agregar comentario al gasto (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['contenido'], properties: {
          contenido: { type: 'string' }, autor: { type: 'string', default: 'API' },
        } } } } },
        responses: { '201': { description: 'Created' }, '404': { description: 'Gasto no encontrado' } },
      },
    },
    '/marketing/presupuesto': {
      get: {
        summary: 'Total mensual presupuestado (financiero)',
        parameters: [
          { name: 'mes', in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'anio', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
      post: {
        summary: 'Upsert del total mensual (admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mes', 'anio', 'presupuestoTotal'], properties: {
          mes: { type: 'integer' }, anio: { type: 'integer' }, presupuestoTotal: { type: 'string', description: 'numeric' },
        } } } } },
        responses: { '200': { description: 'Actualizado' }, '201': { description: 'Creado' } },
      },
    },
    '/marketing/presupuesto/items': {
      get: {
        summary: 'Items del presupuesto anual (vista Excel, montos por mes)',
        parameters: [{ name: 'anio', in: 'query', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear item de presupuesto (admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['anio', 'concepto'], properties: {
          anio: { type: 'integer' }, concepto: { type: 'string' }, categoria: { type: 'string' },
          enero: { type: 'string' }, febrero: { type: 'string' }, marzo: { type: 'string' }, abril: { type: 'string' },
          mayo: { type: 'string' }, junio: { type: 'string' }, julio: { type: 'string' }, agosto: { type: 'string' },
          septiembre: { type: 'string' }, octubre: { type: 'string' }, noviembre: { type: 'string' }, diciembre: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/marketing/presupuesto/items/{id}': {
      patch: {
        summary: 'Actualizar item de presupuesto (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Eliminar item de presupuesto (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/proveedores': {
      get: { summary: 'Lista de proveedores de marketing', responses: { '200': { description: 'OK' } } },
      post: {
        summary: 'Crear proveedor',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nombre'], properties: {
          nombre: { type: 'string' }, contacto: { type: 'string' }, email: { type: 'string' },
          telefono: { type: 'string' }, rut: { type: 'string' }, rubro: { type: 'string' }, notas: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/marketing/proveedores/{id}': {
      patch: {
        summary: 'Actualizar proveedor',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Eliminar proveedor (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/creatividades': {
      get: {
        summary: 'Creatividades del mes (default: mes/año actuales)',
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'anio', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear creatividad',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['titulo', 'mes', 'anio', 'creadoPorId'], properties: {
          titulo: { type: 'string' }, descripcion: { type: 'string' },
          tipo: { type: 'string', enum: ['reel', 'video', 'post', 'historia'], default: 'reel' },
          estado: { type: 'string', enum: ['planificacion', 'grabacion', 'edicion', 'completado', 'publicado'], default: 'planificacion' },
          plataforma: { type: 'string', enum: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'], default: 'instagram' },
          urlReferencia: { type: 'string' }, urlPublicacion: { type: 'string' },
          fechaPublicacion: { type: 'string', format: 'date' },
          asignadoAId: { type: 'string', description: 'users.id' },
          mes: { type: 'integer' }, anio: { type: 'integer' },
          creadoPorId: { type: 'string', description: 'users.id — resolver con GET /usuarios?source=users' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/marketing/creatividades/{id}': {
      patch: {
        summary: 'Actualizar creatividad',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Eliminar creatividad (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/creatividades/{id}/aprobar': {
      patch: {
        summary: 'Aprobar creatividad',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { aprobadoPorId: { type: 'string', description: 'users.id' } } } } } },
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/creatividades/{id}/rechazar': {
      patch: {
        summary: 'Rechazar creatividad',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: {
          motivoRechazo: { type: 'string' }, aprobadoPorId: { type: 'string', description: 'users.id' },
        } } } } },
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/guiones/{creatividadId}': {
      get: {
        summary: 'Guión de una creatividad (o null)',
        parameters: [{ name: 'creatividadId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/marketing/guiones': {
      post: {
        summary: 'Crear guión para una creatividad',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['creatividadId'], properties: {
          creatividadId: { type: 'string' }, actor: { type: 'string' }, locacion: { type: 'string' },
          insumos: { type: 'string' }, vestuario: { type: 'string' }, guion: { type: 'string' }, notas: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/marketing/guiones/id/{id}': {
      patch: {
        summary: 'Actualizar guión por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
    },
// ── FINANZAS ──
    '/finanzas/gastos': {
      get: {
        summary: 'Lista gastos empresariales (lectura financiera — read_write/admin)',
        parameters: [
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['pendiente', 'aprobado', 'rechazado'] } },
          { name: 'estadoAprobacion', in: 'query', schema: { type: 'string' } },
          { name: 'fechaDesde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'fechaHasta', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'categoria', in: 'query', schema: { type: 'string' } },
          { name: 'segmentCode', in: 'query', schema: { type: 'string' } },
          { name: 'centroCostos', in: 'query', schema: { type: 'string' } },
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear gasto empresarial (ADMIN)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'monto', 'descripcion', 'categoria'], properties: {
          userId: { type: 'string', description: 'Usuario dueño del gasto' },
          monto: { type: 'number' }, descripcion: { type: 'string' }, categoria: { type: 'string' },
          fundingMode: { type: 'string', enum: ['reembolso', 'con_fondo'], default: 'reembolso' },
          fundAllocationId: { type: 'string' }, tipoDocumento: { type: 'string' }, proveedor: { type: 'string' },
          rutProveedor: { type: 'string' }, numeroDocumento: { type: 'string' }, fechaEmision: { type: 'string', format: 'date' },
          centroCostos: { type: 'string' }, segmentCode: { type: 'string' }, ruta: { type: 'string' }, clientes: { type: 'string' }, ciudad: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/finanzas/gastos/{id}': {
      get: { summary: 'Detalle de gasto (read_write/admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } } },
      patch: { summary: 'Editar gasto (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: { '200': { description: 'OK' } } },
      delete: { summary: 'Eliminar gasto (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
    },
    '/finanzas/gastos/{id}/aprobar': { post: { summary: 'Aprobar gasto (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/gastos/{id}/rechazar': { post: { summary: 'Rechazar gasto (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['comentario'], properties: { comentario: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/gastos/{id}/rrhh-approve': { post: { summary: 'Aprobación final RRHH de reembolso (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { comentario: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/gastos/{id}/rrhh-reject': { post: { summary: 'Rechazo RRHH de reembolso (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['motivoRechazo'], properties: { motivoRechazo: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/gastos/analytics/summary': { get: { summary: 'Resumen de gastos (read_write/admin)', parameters: [{ name: 'mes', in: 'query', schema: { type: 'integer' } }, { name: 'anio', in: 'query', schema: { type: 'integer' } }, { name: 'userId', in: 'query', schema: { type: 'string' } }, { name: 'categoria', in: 'query', schema: { type: 'string' } }, { name: 'estado', in: 'query', schema: { type: 'string' } }, { name: 'segmentCode', in: 'query', schema: { type: 'string' } }, { name: 'centroCostos', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/gastos/analytics/por-categoria': { get: { summary: 'Gastos agrupados por categoría (read_write/admin)', parameters: [{ name: 'mes', in: 'query', schema: { type: 'integer' } }, { name: 'anio', in: 'query', schema: { type: 'integer' } }, { name: 'userId', in: 'query', schema: { type: 'string' } }, { name: 'estado', in: 'query', schema: { type: 'string' } }, { name: 'segmentCode', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/gastos/pendientes-rrhh': { get: { summary: 'Reembolsos pendientes de RRHH (read_write/admin)', responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos': {
      get: { summary: 'Lista fondos asignados con saldo (read_write/admin)', parameters: [{ name: 'estado', in: 'query', schema: { type: 'string', enum: ['solicitud', 'pendiente_aprobacion', 'activo', 'cerrado', 'rechazado'] } }, { name: 'assignedToId', in: 'query', schema: { type: 'string' } }, { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/offset' }], responses: { '200': { description: 'OK' } } },
      post: { summary: 'Crear/asignar fondo (ADMIN)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['assignedToId', 'nombre', 'montoInicial'], properties: { assignedToId: { type: 'string' }, nombre: { type: 'string' }, montoInicial: { type: 'number' }, motivo: { type: 'string' }, centroCostos: { type: 'string' }, segmentCode: { type: 'string' }, fechaInicio: { type: 'string', format: 'date' }, fechaTermino: { type: 'string', format: 'date' }, estado: { type: 'string', enum: ['solicitud', 'pendiente_aprobacion', 'activo'] } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/finanzas/fondos/{id}': { get: { summary: 'Detalle de fondo + saldo + movimientos (read_write/admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } } }, delete: { summary: 'Eliminar fondo (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/movements': { get: { summary: 'Movimientos del fondo (read_write/admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/approve': { post: { summary: 'Aprobar fondo con comprobante (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['comprobanteUrl'], properties: { comprobanteUrl: { type: 'string' }, comprobantePreviewUrl: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/reject': { post: { summary: 'Rechazar fondo (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['motivoRechazo'], properties: { motivoRechazo: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/supervisor-approve': { post: { summary: 'Aprobación de supervisor (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { comentario: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/supervisor-reject': { post: { summary: 'Rechazo de supervisor (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['comentario'], properties: { comentario: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/rrhh-approve': { post: { summary: 'Aprobación RRHH con comprobante (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['comprobanteUrl'], properties: { comprobanteUrl: { type: 'string' }, comentario: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/rrhh-reject': { post: { summary: 'Rechazo RRHH (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['comentario'], properties: { comentario: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/{id}/recharge': { patch: { summary: 'Recargar fondo aprobado (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['comentario'], properties: { rechargeMode: { type: 'string', enum: ['gastado', 'total'], default: 'gastado' }, rechargeAmount: { type: 'number' }, newFechaInicio: { type: 'string', format: 'date' }, newFechaTermino: { type: 'string', format: 'date' }, comentario: { type: 'string' } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/pending/rrhh': { get: { summary: 'Fondos pendientes de RRHH (read_write/admin)', responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/pending/supervisor': { get: { summary: 'Fondos pendientes de supervisor (read_write/admin)', parameters: [{ name: 'supervisorId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/summary/global': { get: { summary: 'Resumen global de fondos (read_write/admin)', parameters: [{ name: 'userId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/fondos/user/{userId}': { get: { summary: 'Fondos de un usuario (read_write/admin)', parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'all', in: 'query', schema: { type: 'boolean' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/comisiones/summary': { get: { summary: 'Resumen de comisiones por vendedor (read_write/admin)', parameters: [{ name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': { description: 'Default: mes en curso' } } } },
    '/finanzas/comisiones/salesperson/{name}': { get: { summary: 'Detalle de comisión de un vendedor (read_write/admin)', parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }, { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/comisiones/settings': {
      get: { summary: 'Lista % de comisión por vendedor (read_write/admin)', parameters: [{ name: 'salespersonName', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
      put: { summary: 'Fijar % de comisión de un vendedor (ADMIN)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['salespersonName', 'commissionPct'], properties: { salespersonName: { type: 'string' }, commissionPct: { type: 'number', minimum: 0, maximum: 100 } } } } } }, responses: { '200': { description: 'OK' } } },
    },
    '/finanzas/comisiones/overrides': {
      get: { summary: 'Lista overrides de % por cliente/documento (read_write/admin)', parameters: [{ name: 'salespersonName', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
      put: { summary: 'Fijar/quitar override de % (ADMIN). commissionPct=null quita el override', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['salespersonName', 'overrideType', 'value', 'commissionPct'], properties: { salespersonName: { type: 'string' }, overrideType: { type: 'string', enum: ['client', 'document'] }, value: { type: 'string' }, commissionPct: { type: 'number', nullable: true, minimum: 0, maximum: 100 } } } } } }, responses: { '200': { description: 'OK' } } },
    },
    '/finanzas/metas': {
      get: { summary: 'Lista metas/goals (read_write/admin)', parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['global', 'segment', 'salesperson'] } }], responses: { '200': { description: 'OK' } } },
      post: { summary: 'Crear meta (ADMIN)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['type', 'amount', 'period'], properties: { type: { type: 'string', enum: ['global', 'segment', 'salesperson'] }, target: { type: 'string' }, amount: { type: 'number' }, period: { type: 'string', description: 'YYYY-MM' }, description: { type: 'string' } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/finanzas/metas/{id}': {
      get: { summary: 'Detalle de meta (read_write/admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } } },
      patch: { summary: 'Actualizar meta (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: { '200': { description: 'OK' } } },
      delete: { summary: 'Eliminar meta (ADMIN)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
    },
    '/finanzas/presupuesto-ventas': {
      get: { summary: 'Presupuesto de ventas por año (read_write/admin)', parameters: [{ name: 'anio', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } },
      post: { summary: 'Upsert de un registro de presupuesto (ADMIN)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['anio', 'mes', 'categoria', 'entidad', 'monto'], properties: { anio: { type: 'integer' }, mes: { type: 'integer' }, categoria: { type: 'string' }, entidad: { type: 'string' }, monto: { type: 'number' } } } } } }, responses: { '201': { description: 'Created' } } },
      delete: { summary: 'Eliminar todo el presupuesto de un año (ADMIN)', parameters: [{ name: 'anio', in: 'query', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } },
    },
    '/finanzas/presupuesto-ventas/years': { get: { summary: 'Años con presupuesto cargado (read_write/admin)', responses: { '200': { description: 'OK' } } } },
    '/finanzas/presupuesto-ventas/bulk': { post: { summary: 'Upsert masivo de presupuesto (ADMIN)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['records'], properties: { records: { type: 'array', items: { type: 'object', required: ['anio', 'mes', 'categoria', 'entidad', 'monto'], properties: { anio: { type: 'integer' }, mes: { type: 'integer' }, categoria: { type: 'string' }, entidad: { type: 'string' }, monto: { type: 'number' } } } } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/finanzas/proyecciones/manual': {
      get: { summary: 'Proyecciones manuales (read_write/admin)', parameters: [{ name: 'years', in: 'query', schema: { type: 'string' }, description: 'CSV de años' }, { name: 'months', in: 'query', schema: { type: 'string' }, description: 'CSV de meses' }, { name: 'salespersonCode', in: 'query', schema: { type: 'string' } }, { name: 'segment', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
      post: { summary: 'Upsert de proyección manual (ADMIN)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['year', 'salespersonCode', 'clientCode'], properties: { year: { type: 'integer' }, month: { type: 'integer', nullable: true }, salespersonCode: { type: 'string' }, salespersonName: { type: 'string' }, clientCode: { type: 'string' }, clientName: { type: 'string' }, projectedAmount: { type: 'number' }, segment: { type: 'string' } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/finanzas/proyecciones/historico': { get: { summary: 'Histórico de ventas por año (read_write/admin)', parameters: [{ name: 'years', in: 'query', schema: { type: 'string' } }, { name: 'months', in: 'query', schema: { type: 'string' } }, { name: 'salespersonCode', in: 'query', schema: { type: 'string' } }, { name: 'segment', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'onlyWithAllPeriods', in: 'query', schema: { type: 'boolean' } }, { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['desc', 'asc', 'az', 'za'] } }, { $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/offset' }], responses: { '200': { description: 'OK' } } } },
    '/finanzas/proyecciones/charts': { get: { summary: 'Agregado de proyecciones para gráficos (read_write/admin)', parameters: [{ name: 'years', in: 'query', schema: { type: 'string' } }, { name: 'months', in: 'query', schema: { type: 'string' } }, { name: 'salespersonCode', in: 'query', schema: { type: 'string' } }, { name: 'segment', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: '{ byClient, bySegment, bySalesperson }' } } } },
    '/help': {
      get: { summary: 'Catálogo auto-descriptivo de la API', responses: { '200': { description: 'OK' } } },
    },
    '/ventas': {
      get: {
        summary: 'Lista transacciones de venta facturadas (excluye GDV)',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
          { name: 'product', in: 'query', schema: { type: 'string' } },
          { name: 'client_rut', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/clientes': {
      get: {
        summary: 'Lista clientes con métricas de ventas',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'creditStatus', in: 'query', schema: { type: 'string', enum: ['con_credito', 'contado'] } },
          { name: 'businessType', in: 'query', schema: { type: 'string' } },
          { name: 'debtStatus', in: 'query', schema: { type: 'string', enum: ['con_deuda', 'sin_deuda'] } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/puntos-de-venta': {
      get: {
        summary: 'Lista puntos de venta activos (sucursales, distribuidores, ferreterías) para integrar el mapa "Dónde Comprar" en sitios externos',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['sucursal_propia', 'distribuidor', 'ferreteria'] } },
          { name: 'region', in: 'query', schema: { type: 'string' }, description: 'Case-insensitive (ILIKE)' },
          { name: 'comuna', in: 'query', schema: { type: 'string' }, description: 'Case-insensitive (ILIKE)' },
        ],
        responses: { '200': { description: 'Array de puntos de venta con id, name, type, address, comuna, region, latitude, longitude, phone, email, website, schedule, logoUrl, active' } },
      },
    },
    '/usuarios': {
      get: {
        summary: 'Lista usuarios y vendedores (salespeople_users)',
        description: 'Para descubrir nombres válidos de salespersonName usar source=salespeople',
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'supervisor', 'encargado_area', 'salesperson', 'client', 'tecnico_obra', 'reception', 'jefe_planta', 'mantencion'] } },
          { name: 'source', in: 'query', schema: { type: 'string', enum: ['users', 'salespeople', 'all'], default: 'all' } },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: { '200': { description: '{ users, salespeople, counts }' } },
      },
    },
    '/productos': {
      get: {
        summary: 'Búsqueda flat de productos en lista de precios',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'unidad', in: 'query', schema: { type: 'string' } },
          { name: 'tipoProducto', in: 'query', schema: { type: 'string' } },
          { name: 'color', in: 'query', schema: { type: 'string' } },
          { name: 'priceList', in: 'query', schema: { type: 'string' }, description: 'LP01 (base) o código de lista custom (LP02, LP03, ...)' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'Productos con todos los tiers de precio + costo + precio efectivo según lista' } },
      },
    },
    '/listas-precio': {
      get: {
        summary: 'Lista de listas de precio disponibles (LP01 base + custom)',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/listas-precio/{code}/productos': {
      get: {
        summary: 'Productos con precios de una lista específica',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'Lista no encontrada' } },
      },
    },
    '/cotizaciones/{id}/pdf': {
      get: {
        summary: 'PDF binario de la cotización (mismo render que el tomador). ?format=html para HTML',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['pdf', 'html'], default: 'pdf' } },
        ],
        responses: { '200': { description: 'application/pdf o text/html' }, '404': { description: 'Cotización no encontrada' } },
      },
    },
    '/cotizaciones/{id}/pdf-url': {
      get: {
        summary: 'URL pública firmada para descargar el PDF (no requiere API key, expira en 1h por default)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'ttlMinutes', in: 'query', schema: { type: 'integer', default: 60, minimum: 5, maximum: 1440 } },
        ],
        responses: { '200': { description: '{ url, quoteNumber, filename, expiresAt }' } },
      },
    },
    '/productos/grupos': {
      get: {
        summary: 'Productos agrupados como en la tienda (padre + variantes color/formato)',
        description: 'Devuelve cada grupo con sus variaciones. Útil para "qué colores hay de X y a qué precio".',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'categoria', in: 'query', schema: { type: 'string' } },
          { name: 'soloActivos', in: 'query', schema: { type: 'boolean', default: true } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: { total: { type: 'integer' }, groups: { type: 'array', items: { $ref: '#/components/schemas/ProductGroup' } } } } } },
          },
        },
      },
    },
    '/productos/{codigo}': {
      get: {
        summary: 'Detalle de producto + stock por bodega',
        parameters: [{ name: 'codigo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Producto con precios y stock' }, '404': { description: 'No encontrado' } },
      },
    },
    '/inventario': {
      get: {
        summary: 'Stock de productos por bodega (misma fuente que el módulo de Inventario)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'SKU o nombre' },
          { name: 'bodega', in: 'query', schema: { type: 'string' } },
          { name: 'sucursal', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: '{ total, offset, limit, items }. Cada item trae stock1/stock2, unidades y bodega; averagePrice y totalValue solo para roles con acceso a valorización.' } },
      },
    },
    '/notificaciones': {
      get: {
        summary: 'Lista notificaciones',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] } },
          { name: 'departamento', in: 'query', schema: { type: 'string' } },
          { name: 'targetType', in: 'query', schema: { type: 'string', enum: ['personal', 'general', 'departamento'] } },
          { name: 'archived', in: 'query', schema: { type: 'boolean' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear notificación',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['title', 'message'], properties: {
            title: { type: 'string' }, message: { type: 'string' },
            type: { type: 'string', default: 'manual' },
            priority: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'], default: 'media' },
            departamento: { type: 'string' }, actionUrl: { type: 'string' },
          } } } },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/reclamos': {
      get: {
        summary: 'Lista reclamos generales',
        parameters: [
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['registrado', 'en_revision_tecnica', 'en_area_responsable', 'resuelto', 'cerrado'] } },
          { name: 'areaResponsable', in: 'query', schema: { type: 'string' } },
          { name: 'gravedad', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear reclamo',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clienteNombre', 'motivo'], properties: {
          clienteNombre: { type: 'string' }, clienteRut: { type: 'string' }, clienteEmail: { type: 'string' }, clienteTelefono: { type: 'string' },
          motivo: { type: 'string' }, descripcion: { type: 'string' }, severidad: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/mantencion': {
      get: {
        summary: 'Lista solicitudes de mantención',
        parameters: [
          { name: 'estado', in: 'query', schema: { type: 'string' } },
          { name: 'tipoMantencion', in: 'query', schema: { type: 'string', enum: ['correctivo', 'preventivo', 'predictivo'] } },
          { name: 'gravedad', in: 'query', schema: { type: 'string' } },
          { name: 'area', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear solicitud de mantención',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['equipoNombre', 'descripcionProblema'], properties: {
          equipoNombre: { type: 'string' }, equipoCodigo: { type: 'string' }, equipoArea: { type: 'string' }, equipoUbicacion: { type: 'string' },
          descripcionProblema: { type: 'string' }, tipoMantencion: { type: 'string', enum: ['correctivo', 'preventivo', 'predictivo'] },
          severidad: { type: 'string' }, solicitadoPor: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/tareas': {
      get: {
        summary: 'Lista tareas del Panel de Trabajo',
        parameters: [
          { name: 'assignedTo', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high'] } },
          { name: 'creatorId', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear tarea en el Panel de Trabajo',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'type', 'createdByUserId'], properties: {
          title: { type: 'string' },
          type: { type: 'string', enum: ['texto', 'formulario', 'visita'] },
          createdByUserId: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'], default: 'pendiente' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
          progress: { type: 'number' },
          dueDate: { type: 'string', format: 'date-time' },
          assignedToUserId: { type: 'string' }, clienteId: { type: 'string' }, clienteNombre: { type: 'string' },
          segmento: { type: 'string' }, groupId: { type: 'string' }, payload: { type: 'object' },
          assignments: { type: 'array' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/tareas/{id}': {
      patch: {
        summary: 'Actualizar tarea',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrada' } },
      },
      delete: {
        summary: 'Eliminar tarea',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/crm/leads': {
      get: {
        summary: 'Lista leads del CRM',
        parameters: [
          { name: 'stage', in: 'query', schema: { type: 'string', enum: ['lead', 'contacto', 'visita', 'lista_precio', 'campana', 'primera_venta', 'promesa', 'venta'] } },
          { name: 'salespersonId', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear lead',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientName', 'salespersonId'], properties: {
          clientName: { type: 'string' }, salespersonId: { type: 'string' }, clientPhone: { type: 'string' }, clientEmail: { type: 'string' },
          clientType: { type: 'string', enum: ['nuevo', 'recurrente'] }, estimatedValue: { type: 'number' }, stage: { type: 'string' },
          segment: { type: 'string' }, notes: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/crm/leads/{id}': {
      patch: {
        summary: 'Actualizar lead',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    // Pipeline CRM — Seguimiento de Clientes (panel "/seguimiento-clientes")
    // Estos endpoints dan control completo del panel: listar, crear, editar,
    // borrar (soft), agregar hitos/notas, vincular RUT, detectar compras y
    // consultar NVV/GDV pendientes.
    '/crm/seguimiento': {
      get: {
        operationId: 'listSeguimientoClientes',
        summary: 'Lista clientes en seguimiento del Pipeline CRM',
        parameters: [
          { name: 'vendedor', in: 'query', schema: { type: 'string' }, description: 'Filtra por vendedorId (salespeople_users.id). Ojo: el vendedor de un lead puede tener rol supervisor o encargado_area, así que resolvelo con GET /usuarios?source=salespeople SIN filtrar por role.' },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['prospecto', 'seguimiento', 'cotizacion', 'venta', 'perdido'] }, description: 'Etapas canónicas del pipeline. Los valores viejos (nuevo, contactado, completado, despacho) se aceptan y se traducen.' },
          { name: 'prioridad', in: 'query', schema: { type: 'string', enum: ['baja', 'media', 'alta'] } },
          { name: 'segmento', in: 'query', schema: { type: 'string' }, description: 'Construcción | Ferretería | Digital | Industrial. Compara por raíz, sin tildes ni mayúsculas, y cae al segmento del cliente del ERP si el CRM no lo tiene.' },
          { name: 'busqueda', in: 'query', schema: { type: 'string' }, description: 'Búsqueda por nombre/empresa/rut/email (ILIKE)' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'Array de clientes en seguimiento, enriquecido con datos del ERP (comuna, región, segmento, condición de pago, etc.)' } },
      },
      post: {
        operationId: 'createSeguimientoCliente',
        summary: 'Crear cliente en el pipeline de seguimiento',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['nombre', 'vendedorId'], properties: {
            nombre: { type: 'string' },
            vendedorId: { type: 'string', description: 'salespeople_users.id (resolver con GET /usuarios?source=salespeople)' },
            telefono: { type: 'string' }, email: { type: 'string' }, empresa: { type: 'string' }, rut: { type: 'string' },
            estado: { type: 'string', enum: ['prospecto', 'seguimiento', 'cotizacion', 'venta', 'perdido'], default: 'prospecto' },
            prioridad: { type: 'string', enum: ['baja', 'media', 'alta'], default: 'media' },
            origen: { type: 'string', enum: ['manual', 'digital_organico', 'digital_pagado', 'referido', 'web', 'llamada'], default: 'manual' },
            notas: { type: 'string' }, montoEstimado: { type: 'number' },
            proximoContacto: { type: 'string', format: 'date-time' },
            region: { type: 'string' }, comuna: { type: 'string' },
            contactoEncargado: { type: 'string' }, segmento: { type: 'string' }, condicionPago: { type: 'string' },
            destacado: { type: 'boolean' },
          } } } },
        },
        responses: { '201': { description: 'Created — Si se entrega RUT, intenta vincular automáticamente al cliente del ERP' } },
      },
    },
    '/crm/seguimiento/stats': {
      get: {
        operationId: 'getSeguimientoStats',
        summary: 'Estadísticas del pipeline (total, por estado, por prioridad, sin contacto >7 días)',
        parameters: [{ name: 'vendedor', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: '{ total, porEstado, porPrioridad, sinContacto7Dias }' } },
      },
    },
    '/crm/seguimiento/segmentos': {
      get: {
        operationId: 'listSeguimientoSegmentos',
        summary: 'Catálogo de segmentos disponibles (ventas.stg_tabru)',
        responses: { '200': { description: 'Array de { code, name }' } },
      },
    },
    '/crm/seguimiento/{id}': {
      get: {
        operationId: 'getSeguimientoCliente',
        summary: 'Detalle del cliente + hitos (timeline)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cliente con campos enriquecidos del ERP y array hitos[]' }, '404': { description: 'No encontrado' } },
      },
      patch: {
        operationId: 'updateSeguimientoCliente',
        summary: 'Actualizar cliente (estado, prioridad, vendedor, destacado, notas, próximo contacto, etc.)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          nombre: { type: 'string' }, telefono: { type: 'string' }, email: { type: 'string' }, empresa: { type: 'string' },
          estado: { type: 'string', enum: ['nuevo', 'contactado', 'cotizacion', 'venta', 'despacho', 'completado', 'perdido'] },
          prioridad: { type: 'string', enum: ['baja', 'media', 'alta'] },
          notas: { type: 'string' }, montoEstimado: { type: 'number' },
          origen: { type: 'string' }, proximoContacto: { type: 'string', format: 'date-time' },
          region: { type: 'string' }, comuna: { type: 'string' }, contactoEncargado: { type: 'string' },
          segmento: { type: 'string' }, condicionPago: { type: 'string' }, destacado: { type: 'boolean' },
          vendedorId: { type: 'string', description: 'salespeople_users.id — reasignar vendedor' },
        } } } } },
        responses: { '200': { description: 'OK — Genera hito automático "sistema" si cambia estado o vendedor' }, '404': { description: 'No encontrado' } },
      },
      delete: {
        operationId: 'deleteSeguimientoCliente',
        summary: 'Eliminar cliente del pipeline (soft delete: active=false)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
    },
    '/crm/seguimiento/{id}/hito': {
      post: {
        operationId: 'addSeguimientoHito',
        summary: 'Agregar hito al timeline (nota, llamada, visita, cotización, venta, etc.)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tipo', 'descripcion'], properties: {
          tipo: { type: 'string', enum: ['contacto', 'llamada', 'whatsapp', 'cotizacion', 'visita', 'venta', 'despacho', 'nota', 'sistema'] },
          descripcion: { type: 'string' },
          documentoTipo: { type: 'string', enum: ['nvv', 'gdv', 'factura', 'cotizacion'] },
          documentoNumero: { type: 'string' },
          autor: { type: 'string', description: 'Nombre del autor del hito (default: "API")' },
        } } } } },
        responses: { '201': { description: 'Created — Tipos contacto/llamada/cotizacion/visita/venta actualizan ultimoContacto' } },
      },
    },
    '/crm/seguimiento/{id}/vincular-rut': {
      post: {
        operationId: 'linkSeguimientoRut',
        summary: 'Vincular un RUT al cliente del pipeline (auto-busca el cliente del ERP)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['rut'], properties: { rut: { type: 'string' } } } } } },
        responses: { '200': { description: 'Cliente actualizado + clienteVinculado (datos del ERP) si se encontró' } },
      },
    },
    '/crm/seguimiento/{id}/detectar-compras': {
      get: {
        operationId: 'detectSeguimientoCompras',
        summary: 'Buscar últimas 20 ventas del cliente vinculado y crear hitos automáticos por documento nuevo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: '{ compras[], nuevosHitosCreados, clienteVinculado }' } },
      },
    },
    '/crm/seguimiento/{id}/nvv': {
      get: {
        operationId: 'getSeguimientoNvv',
        summary: 'Notas de venta y guías de despacho del cliente vinculado (últimos 6 meses)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: '{ nvvs[], clienteVinculado }' } },
      },
    },
    '/crm/seguimiento/{id}/bitacora': {
      get: {
        operationId: 'listClienteBitacora',
        summary: 'Lista entradas de la bitácora del cliente (panel derecho del seguimiento)',
        description: 'Distinta del timeline de hitos. La bitácora es un cuaderno de notas internas (nota, llamada, visita, seguimiento, problema) sobre el cliente.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del cliente en seguimiento (CRM)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        ],
        responses: { '200': { description: 'Array de entradas ordenadas por createdAt desc' } },
      },
      post: {
        operationId: 'addClienteBitacora',
        summary: 'Agregar entrada a la bitácora del cliente (panel derecho del seguimiento)',
        description: 'Inserta una nota en la bitácora del cliente CRM. Si el tipo es de contacto/seguimiento (cualquiera distinto de "problema"), también refresca ultimoContacto del registro CRM.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del cliente en seguimiento (CRM)' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nota'], properties: {
          nota: { type: 'string', description: 'Texto de la entrada' },
          tipo: { type: 'string', enum: ['nota', 'llamada', 'visita', 'seguimiento', 'problema'], default: 'nota' },
          autor: { type: 'string', description: 'Nombre del autor (default: nombre asociado a la API key, sino "API")' },
        } } } } },
        responses: { '201': { description: 'Created' }, '404': { description: 'Cliente CRM no encontrado' } },
      },
    },
    '/crm/seguimiento/{id}/bitacora/{entryId}': {
      delete: {
        operationId: 'deleteClienteBitacora',
        summary: 'Eliminar una entrada de la bitácora del cliente',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del cliente en seguimiento (CRM)' },
          { name: 'entryId', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de la entrada de bitácora' },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } },
      },
    },
    '/ecommerce/orders': {
      get: {
        summary: 'Lista pedidos eCommerce',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'modified', 'rejected', 'sent'] } },
          { name: 'clientId', in: 'query', schema: { type: 'string' } },
          { name: 'salespersonId', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ecommerce/orders/{id}': {
      patch: {
        summary: 'Cambiar estado de pedido',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['pending', 'approved', 'modified', 'rejected', 'sent'] } } } } } },
        responses: { '200': { description: 'OK' } },
      },
    },
    '/cotizaciones': {
      get: {
        summary: 'Lista cotizaciones / presupuestos',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'converted'] } },
          { name: 'salespersonName', in: 'query', schema: { type: 'string' } },
          { name: 'clientName', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Quote' } } } } } },
      },
      post: {
        summary: 'Crear cotización (con items[] inline opcional)',
        description: 'salespersonName es obligatorio. Para descubrir nombres válidos: GET /usuarios?source=salespeople',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuoteCreate' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Quote' } } } }, '404': { description: 'Vendedor no encontrado' } },
      },
    },
    '/cotizaciones/{id}': {
      get: {
        summary: 'Detalle de cotización + items',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      patch: {
        summary: 'Actualizar cotización',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/cotizaciones/{id}/status': {
      patch: {
        summary: 'Cambiar estado de cotización',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'converted'] } } } } } },
        responses: { '200': { description: 'OK' } },
      },
    },
    '/cotizaciones/{id}/items': {
      get: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Agregar item a cotización',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuoteItem' } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/cotizaciones/items/{itemId}': {
      patch: {
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/dashboard': {
      get: {
        summary: 'Métricas agregadas de ventas',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' }, description: 'YYYY | YYYY-MM | YYYY-MM-DD' },
          { name: 'filterType', in: 'query', schema: { type: 'string', enum: ['year', 'month', 'day'] } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    // Estadísticas de ventas. `period` acepta YYYY | YYYY-MM | YYYY-MM-DD |
    // current-month | last-month | last-30-days | last-90-days; startDate+endDate
    // gana sobre period.
    '/ventas/top-clientes': {
      get: {
        summary: 'Ranking de clientes por venta facturada del período',
        description: 'Ordenado de mayor a menor, con percentage sobre el total del período y percentageAcumulado (Pareto). El monto es el del período, no el histórico del cliente.',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'filterType', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'product', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 500 } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ventas/top-vendedores': {
      get: {
        summary: 'Ranking de vendedores por venta facturada (volumen, no margen)',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
          { name: 'product', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ventas/top-productos': {
      get: {
        summary: 'Ranking de productos por venta facturada',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ventas/por-segmento': {
      get: {
        summary: 'Participación de cada segmento comercial en la venta del período',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ventas/tendencia': {
      get: {
        summary: 'Serie temporal de la venta del período',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'granularidad', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
          { name: 'salesperson', in: 'query', schema: { type: 'string' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'client', in: 'query', schema: { type: 'string' } },
          { name: 'product', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ventas/ficha-cliente': {
      get: {
        summary: 'Qué compró un cliente en el período (productos y vendedores)',
        description: 'El nombre puede ser parcial: se resuelve al del ERP y las otras candidatas vuelven en coincidencias[].',
        parameters: [
          { name: 'nombre', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'limitProductos', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'Sin ventas de un cliente que coincida' } },
      },
    },
    '/ventas/ficha-vendedor': {
      get: {
        summary: 'Desempeño de un vendedor: cartera top, productos y apertura por segmento',
        parameters: [
          { name: 'nombre', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'limitClientes', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'limitProductos', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'Sin ventas de un vendedor que coincida' } },
      },
    },
    '/ventas/ficha-producto': {
      get: {
        summary: 'Quién compra y quién vende un producto',
        parameters: [
          { name: 'nombre', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'segment', in: 'query', schema: { type: 'string' } },
          { name: 'limitClientes', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'Sin ventas de un producto que coincida' } },
      },
    },
    '/crm/seguimiento/por-vendedor': {
      get: {
        summary: 'KPIs del pipeline CRM abiertos por vendedor',
        parameters: [
          { name: 'segmento', in: 'query', schema: { type: 'string' }, description: 'Construcción | Ferretería | Digital | Industrial' },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
};

router.get('/openapi.json', (_req: ApiAuthRequest, res) => {
  res.json(OPENAPI_SPEC);
});

// ============================================
// Self-describing help endpoint (for AI/chat clients)
// ============================================

router.get('/help', async (_req: ApiAuthRequest, res) => {
  res.json({
    description: 'External API for Panorámica intranet — read & write access for integrations and AI assistants.',
    openapi: '/api/external/openapi.json',
    auth: { header: 'X-API-Key', roles: ['readonly', 'read_write', 'admin'] },
    pagination: { default_limit: 500, max_limit: 5000, params: ['limit', 'offset'] },
    endpoints: {
      // ═══ CRUD extendido (8 módulos) ═══
'PATCH /productos/:codigo/precio': { body: ['price*', 'reason'], note: 'edita precio de lista por SKU' },
      'PATCH /productos/:codigo/toggle-activo': { note: 'invierte el estado activo del producto en ecommerce' },
      'GET /listas-precio/:code/items': { filters: ['search', 'limit', 'offset'], note: 'items (SKU+precio) de la lista custom con producto/unidad/costo' },
      'POST /listas-precio/:code/items': { body: ['codigo*', 'precio'], note: '409 si el SKU ya existe en la lista' },
      'PATCH /listas-precio/:code/items/:id': { body: ['precio'] },
      'DELETE /listas-precio/:code/items/:id': {},
      'POST /listas-precio/:code/items/bulk-adjust': { body: ['percentage* (-100..100)', 'roundToDecena'] },
      'GET /ofertas-precio': { filters: ['search', 'limit', 'offset'], note: 'ofertas por cliente con targetClients[] y clientCount' },
      'POST /ofertas-precio': { body: ['codigo*', 'offerType (regular|pallet)', 'precio', 'unitsPerPallet', 'discountPct', 'palletPrice', 'paused', 'allClients', 'clientIds[]'], note: 'pallet: unitsPerPallet + (discountPct XOR palletPrice); allClients=false requiere clientIds[]' },
      'PATCH /ofertas-precio/:id': { body: ['precio', 'paused', 'allClients', 'unitsPerPallet', 'discountPct', 'palletPrice', 'clientIds[]'], note: 'offerType inmutable' },
      'DELETE /ofertas-precio/:id': {},
      'POST /ofertas-precio/bulk-adjust': { body: ['percentage', 'roundToDecena'] },
      'GET /tintometria/:entity': { filters: ['colorId (solo recetas)'], note: 'entity: bases|colores|envases|parametros|pigments|recetas' },
      'GET /tintometria/:entity/:id': {},
      'POST /tintometria/:entity': { body: ['(campos según entidad)'] },
      'PATCH /tintometria/:entity/:id': { body: ['(campos parciales según entidad)'] },
      'DELETE /tintometria/:entity/:id': {},
      'POST /tintometria/calculate': { body: ['colorId*', 'envaseId*'], note: 'cálculo de mezcla/costo, no persiste' },
      'GET /colores-paleta': { note: '{ palette: [{ nombreColor, hex }] }' },
      'POST /colores-paleta': { body: ['colors[]* ({ nombreColor, hex })'], note: 'upsert por nombre' },
      'DELETE /colores-paleta/:nombreColor': {},
// Clientes — maestro, ficha 360, catálogos, cuenta/cartera/morosos
      'POST /clientes': { body: ['nokoen*', 'rten*', 'email*', 'foen*', 'koen', 'dien', 'cmen', 'gien'], note: 'Alta de cliente. Valida RUT y evita duplicados por RUT' },
      'PATCH /clientes/:id': { body: ['clientName', 'email', 'phone', 'address', 'commune', 'priceList'], note: 'Overrides de contacto (prevalecen sobre el ERP). Vacío quita el override' },
      'GET /clientes/:id/ficha': { note: 'Ficha 360: maestro + cartera resumida + documentos abiertos. :id acepta uuid o koen' },
      'GET /clientes/tipos-negocio': { note: 'Catálogo de giros para el filtro businessType' },
      'GET /clientes/tipos-entidad': { note: 'Catálogo de tipos de entidad para el filtro entityType' },
      'GET /clientes/estado-cuenta': { filters: ['name', 'rut'], note: 'name o rut obligatorio. Ficha SAP + cuenta eCommerce + solicitud pendiente + cartera' },
      'GET /clientes/cartera': { filters: ['name', 'rut'], note: 'name o rut obligatorio. Documentos pendientes con vencimiento y saldo' },
      'GET /clientes/morosos': { filters: ['search', 'segment', 'salesperson', 'limit', 'offset'], note: 'Clientes con crédito vencido' },
      // Rutas comerciales de visita
      'GET /rutas-comerciales': { note: 'Lista todas las rutas con sus vendedores' },
      'POST /rutas-comerciales': { body: ['nombre*', 'vendedorId | vendedorIds[]', 'supervisorId', 'segmento', 'estado', 'fecha', 'observaciones'], note: 'supervisorId default: primer vendedor' },
      'PATCH /rutas-comerciales/:id': { body: ['nombre', 'estado', 'segmento', 'fecha', 'observaciones', 'vendedorIds[]'] },
      'DELETE /rutas-comerciales/:id': { note: 'Admin. Elimina ruta + clientes + histórico de visitas' },
      'GET /rutas-comerciales/vendedores': { note: 'Vendedores activos para asignar a rutas' },
      'GET /rutas-comerciales/:id/clientes': {},
      'POST /rutas-comerciales/:id/clientes': { body: ['clienteId* (koen)', 'clienteNombre*', 'orden', 'notas'] },
      'DELETE /rutas-comerciales/:id/clientes/:koen': { note: 'Admin. Quita cliente de la ruta' },
      'POST /rutas-comerciales/:id/clientes/:koen/visitado': { body: ['visitado*', 'nota', 'imagenUrl', 'lat', 'lng', 'clienteNombre'], note: 'Marca visita; adjunta evidencia opcional al histórico' },
      'GET /rutas-comerciales/:id/visitas': { note: 'Histórico de visitas de la ruta' },
'GET /ordenes': { filters: ['status (draft|confirmed|processing|completed|cancelled)', 'clientName', 'limit', 'offset'] },
      'GET /ordenes/:id': { note: 'pedido + items[]' },
      'POST /ordenes': { body: ['clientName*', 'salespersonName*', 'clientId', 'clientRut', 'clientEmail', 'clientPhone', 'clientAddress', 'status', 'priority', 'notes', 'estimatedDeliveryDate', 'subtotal', 'discount', 'taxRate', 'taxAmount', 'total', 'items[]'] },
      'PATCH /ordenes/:id': { body: ['status', 'priority', 'notes', 'estimatedDeliveryDate', '...'] },
      'GET /ordenes/:id/items': {},
      'POST /ordenes/:id/items': { body: ['productName*', 'quantity*', 'unitPrice*', 'type', 'productCode', 'customSku', 'notes'], note: 'recalcula totales' },
      'POST /cotizaciones/:id/convertir-orden': { note: 'Crea un pedido desde la cotización y la marca como converted' },
      'GET /solicitudes-b2c': { filters: ['status (pending|contacted|quoted|sale|closed)', 'limit'], note: 'solicitudes del cotizador público; returns { requests, count }' },
      'GET /solicitudes-b2c/:id': {},
      'PATCH /solicitudes-b2c/:id/estado': { body: ['status (pending|contacted|quoted|sale|closed)', 'internalNotes'] },
      'GET /solicitudes-b2c/:id/pdf': { note: 'HTML imprimible; requiere precios asignados' },
      'GET /ecommerce/erp-orders': { filters: ['salesperson (ILIKE, opcional)'], note: 'cruce FCV/NVV/GDV últimos 90 días, agrupados; returns { orders, count, nvvCount, gdvCount, fcvCount }' },
      'GET /nvv': { filters: ['salesperson*', 'dateFrom', 'dateTo'], note: 'notas de venta pendientes del vendedor' },
      'GET /gdv': { filters: ['salesperson*'], note: 'guías de despacho del vendedor' },
      'GET /gdv-pending': { filters: ['salesperson', 'segment', 'client'], note: '{ gdvSales, gdvCount }' },
// Panel de Trabajo — kanban
      'GET /tareas/grupos': { filters: ['segmento'], note: 'grupos/columnas del kanban' },
      'POST /tareas/grupos': { body: ['name*', 'segmento*', 'color', 'userId'] },
      'PATCH /tareas/grupos/:id': { body: ['name', 'color', 'sortOrder'] },
      'DELETE /tareas/grupos/:id': { note: 'desagrupa las tareas del grupo (groupId=null)' },
      'GET /tareas/:id/comentarios': { note: 'hilo único de la tarea (cronológico)' },
      'POST /tareas/:id/comentarios': { body: ['content*', 'autor'], note: 'se ancla a la 1ra asignación; requiere que la tarea tenga asignaciones' },
      'DELETE /tareas/:id/comentarios/:commentId': {},
      'GET /tareas/:id/actividades': { note: 'llamada | visita | cotizacion | cobranza | correo | revision | otro' },
      'POST /tareas/:id/actividades': { body: ['tipo*', 'descripcion', 'fecha', 'estado', 'responsableId', 'responsableNombre', 'rutaId', 'rutaNombre'] },
      'PATCH /tareas/actividades/:actId': { body: ['tipo', 'descripcion', 'fecha', 'estado (pendiente|completada)', 'responsableId', 'responsableNombre'] },
      'DELETE /tareas/actividades/:actId': {},
      'GET /tareas/:id/asignaciones': {},
      'POST /tareas/:id/asignaciones': { body: ['assigneeType*', 'assigneeId*', 'status', 'notes'] },
      'PATCH /tareas/:id/asignaciones/:assignmentId': { body: ['status (pending|in_progress|completed|declined)', 'notes', 'evidenceImages[]'] },
      'POST /tareas/:id/asignaciones/:assignmentId/leida': { note: 'marca readAt' },
      'GET /tareas/:id/asignaciones/:assignmentId/comentarios': {},
      'POST /tareas/:id/asignaciones/:assignmentId/comentarios': { body: ['content*', 'autor'] },
      'DELETE /tareas/:id/asignaciones/:assignmentId/comentarios/:commentId': {},
'GET /margenes/productos': { filters: ['search', 'family', 'color', 'formato', 'limit', 'offset'], note: 'tabla producto + costo de producción + agrupación comercial; returns { items, totalCount, hasMore }' },
      'GET /margenes/agrupaciones': { filters: ['family', 'color', 'formato'], note: 'opciones de filtro encadenables { families, colors, formatos }' },
      'GET /margenes/precios-gri': { filters: ['search'], note: 'costos GRI de referencia por SKU (snapshot). Mapa { SKU: { price, date } }' },
      'GET /margenes/top-productos': { filters: ['period (YYYY | YYYY-MM | YYYY-MM-DD | current-month | last-month | last-30-days | last-90-days)', 'filterType (year|month|day|range)', 'segment', 'salesperson', 'client', 'limit'], note: 'ranking por ventas facturadas (excluye GDV)' },
      'POST /margenes/etl-costos': { note: 'admin — dispara ETL de costos (recarga costos GRI desde SQL Server) en segundo plano' },
      'GET /margenes/etl-costos/estado': { filters: ['startDate', 'endDate'], note: 'estado/última ejecución del ETL costos' },
      'GET /margenes/ventas': { filters: ['period', 'filterType', 'startDate', 'endDate', 'salesperson', 'segment', 'client'], note: 'MARGEN REAL sobre lo facturado (no el catálogo): revenue, costo, margen $, margen % ponderado, producto de mayor y menor margen' },
      'GET /margenes/ventas/por-producto': { filters: ['period', 'filterType', 'startDate', 'endDate', 'salesperson', 'segment', 'sortBy (highest|lowest|revenue)', 'limit (max 100)'], note: 'ranking de productos por margen del período' },
      'GET /margenes/ventas/por-vendedor': { filters: ['period', 'filterType', 'startDate', 'endDate', 'segment'], note: 'margen del período agrupado por vendedor' },
      'GET /margenes/ventas/por-segmento': { filters: ['period', 'filterType', 'startDate', 'endDate', 'salesperson'], note: 'margen del período agrupado por segmento' },
      'GET /ventas/comparar': { filters: ['period', 'filterType', 'startDate', 'endDate', 'comparePeriod', 'compareStartDate', 'compareEndDate', 'includeBreakdown', 'salesperson', 'segment', 'client'], note: 'COMPARATIVA de dos períodos: ventas, unidades, transacciones, clientes activos, ticket y margen, con delta abs y %. Sin comparePeriod usa el período anterior equivalente' },
// Logística — despacho / TMS / rutas de despacho (mirror del TMS)
      'GET /logistica/envios': { filters: ['days (default 90, 0=sin límite)', 'estado (ingresado|preparacion|curso|entregado)'], note: 'Tablero de despacho: { tmsEnabled, days, resumen, envios[] } enriquecido con el TMS; sincroniza erpIdmaeedo' },
      'POST /logistica/sync-erp': { note: 'Vincula pedidos ingresados sin erpIdmaeedo con su NVV del ERP; devuelve { evaluados, vinculados, tmsEnabled }' },
      'GET /logistica/tms': { filters: ['days', 'estado (Pendiente|En Preparación|Preparada|Listo para Despacho|Despachado|Entregado|No Entregado)', 'clienteIdErp (RUT)', 'fresh', 'limit (max 200)', 'offset'], note: 'Espejo del TMS: KPIs por estado + página de órdenes' },
      'GET /logistica/tms/:idErp': { note: 'Detalle de una orden del TMS (etapas + entregas[])' },
      'GET /logistica/rutas': { filters: ['estado (Pendiente|Cargando|En Ruta|Completada)', 'fresh', 'limit (max 100)', 'offset'], note: 'Gestión de Rutas del TMS (rutas de DESPACHO), solo lectura' },
      'GET /logistica/rutas/:id': { note: 'Detalle de una ruta de despacho del TMS (con entregas[])' },
// ── Marketing: Inventario POP / merchandising ──
      'GET /marketing/inventario': { filters: ['search', 'estado (disponible|agotado|por_llegar)', 'limit', 'offset'], note: 'cada item trae ultimoMovimiento' },
      'GET /marketing/inventario/summary': { note: '{ totalItems, stockBajo, valorTotal }' },
      'GET /marketing/inventario/:id': {},
      'GET /marketing/inventario/:id/movimientos': { note: 'kardex del item' },
      'POST /marketing/inventario': { role: 'read_write', body: ['nombre*', 'descripcion', 'cantidad', 'unidad', 'ubicacion', 'costoUnitario', 'proveedor', 'estado', 'stockMinimo'] },
      'PATCH /marketing/inventario/:id': { role: 'read_write', body: ['nombre', 'cantidad', 'estado', '...'] },
      'DELETE /marketing/inventario/:id': { role: 'admin' },
      'POST /marketing/inventario/:id/movimientos': { role: 'read_write', body: ['tipo* (entrada|salida|devolucion)', 'cantidad*', 'clienteNombre', 'nota', 'usuarioNombre'], note: 'ajusta el stock del item automáticamente' },
      // ── Marketing: Gastos (financiero) ──
      'GET /marketing/gastos': { filters: ['anio*', 'mes'], note: 'con mes devuelve el mes; sin mes devuelve todo el año' },
      'POST /marketing/gastos': { role: 'admin', body: ['concepto*', 'mes*', 'anio*', 'creadoPorId* (users.id)', 'monto', 'categoria', 'proveedor', 'fecha', 'estado', 'presupuestoItemId', 'urlCotizacion', 'urlOrdenCompra', 'urlFactura', 'numeroFactura', 'fechaFactura', 'descripcion'] },
      'PATCH /marketing/gastos/:id': { role: 'admin', body: ['monto', 'estado', '...'] },
      'DELETE /marketing/gastos/:id': { role: 'admin' },
      'POST /marketing/gastos/:id/comentarios': { role: 'admin', body: ['contenido*', 'autor'] },
      // ── Marketing: Presupuesto (financiero) ──
      'GET /marketing/presupuesto': { filters: ['mes*', 'anio*'], note: 'total mensual presupuestado' },
      'POST /marketing/presupuesto': { role: 'admin', body: ['mes*', 'anio*', 'presupuestoTotal*'], note: 'upsert por mes/anio' },
      'GET /marketing/presupuesto/items': { filters: ['anio*'], note: 'items vista Excel con montos por mes' },
      'POST /marketing/presupuesto/items': { role: 'admin', body: ['anio*', 'concepto*', 'categoria', 'enero..diciembre'] },
      'PATCH /marketing/presupuesto/items/:id': { role: 'admin', body: ['concepto', 'enero..diciembre', '...'] },
      'DELETE /marketing/presupuesto/items/:id': { role: 'admin' },
      // ── Marketing: Proveedores ──
      'GET /marketing/proveedores': {},
      'POST /marketing/proveedores': { role: 'read_write', body: ['nombre*', 'contacto', 'email', 'telefono', 'rut', 'rubro', 'notas'] },
      'PATCH /marketing/proveedores/:id': { role: 'read_write' },
      'DELETE /marketing/proveedores/:id': { role: 'admin' },
      // ── Marketing: Creatividades ──
      'GET /marketing/creatividades': { filters: ['mes', 'anio'], note: 'default: mes/año actuales' },
      'POST /marketing/creatividades': { role: 'read_write', body: ['titulo*', 'mes*', 'anio*', 'creadoPorId* (users.id)', 'descripcion', 'tipo (reel|video|post|historia)', 'estado', 'plataforma', 'urlReferencia', 'urlPublicacion', 'fechaPublicacion', 'asignadoAId'] },
      'PATCH /marketing/creatividades/:id': { role: 'read_write' },
      'DELETE /marketing/creatividades/:id': { role: 'admin' },
      'PATCH /marketing/creatividades/:id/aprobar': { role: 'read_write', body: ['aprobadoPorId'] },
      'PATCH /marketing/creatividades/:id/rechazar': { role: 'read_write', body: ['motivoRechazo', 'aprobadoPorId'] },
      // ── Marketing: Guiones ──
      'GET /marketing/guiones/:creatividadId': { note: 'guión de la creatividad (o null)' },
      'POST /marketing/guiones': { role: 'read_write', body: ['creatividadId*', 'actor', 'locacion', 'insumos', 'vestuario', 'guion', 'notas'] },
      'PATCH /marketing/guiones/:id': { role: 'read_write' },
// ── FINANZAS (financiero: GET = read_write/admin; escrituras/DELETE = admin) ──
      'GET /finanzas/gastos': { filters: ['estado', 'fechaDesde', 'fechaHasta', 'categoria', 'segmentCode', 'centroCostos', 'userId', 'limit', 'offset'], role: 'read_write' },
      'GET /finanzas/gastos/:id': { role: 'read_write' },
      'GET /finanzas/gastos/analytics/summary': { filters: ['mes', 'anio', 'userId', 'categoria', 'estado', 'segmentCode', 'centroCostos'], role: 'read_write' },
      'GET /finanzas/gastos/analytics/por-categoria': { filters: ['mes', 'anio', 'userId', 'categoria', 'estado', 'segmentCode'], role: 'read_write' },
      'GET /finanzas/gastos/pendientes-rrhh': { role: 'read_write' },
      'POST /finanzas/gastos': { body: ['userId*', 'monto*', 'descripcion*', 'categoria*', 'fundingMode', 'fundAllocationId', 'tipoDocumento', 'proveedor', 'rutProveedor', 'numeroDocumento', 'fechaEmision', 'centroCostos', 'segmentCode', 'ruta', 'clientes', 'ciudad'], role: 'ADMIN' },
      'PATCH /finanzas/gastos/:id': { body: ['monto', 'descripcion', 'categoria', 'tipoDocumento', 'proveedor', 'rutProveedor', 'numeroDocumento', 'fechaEmision', 'ruta', 'clientes', 'ciudad', 'fundingMode', 'fundAllocationId'], role: 'ADMIN' },
      'POST /finanzas/gastos/:id/aprobar': { role: 'ADMIN' },
      'POST /finanzas/gastos/:id/rechazar': { body: ['comentario*'], role: 'ADMIN' },
      'POST /finanzas/gastos/:id/rrhh-approve': { body: ['comentario'], role: 'ADMIN' },
      'POST /finanzas/gastos/:id/rrhh-reject': { body: ['motivoRechazo*'], role: 'ADMIN' },
      'DELETE /finanzas/gastos/:id': { role: 'ADMIN' },
      'GET /finanzas/fondos': { filters: ['estado', 'assignedToId', 'limit', 'offset'], note: 'incluye saldoDisponible', role: 'read_write' },
      'GET /finanzas/fondos/:id': { note: 'fondo + saldo + movements', role: 'read_write' },
      'GET /finanzas/fondos/:id/movements': { role: 'read_write' },
      'GET /finanzas/fondos/pending/rrhh': { role: 'read_write' },
      'GET /finanzas/fondos/pending/supervisor': { filters: ['supervisorId'], role: 'read_write' },
      'GET /finanzas/fondos/summary/global': { filters: ['userId'], role: 'read_write' },
      'GET /finanzas/fondos/user/:userId': { filters: ['all'], role: 'read_write' },
      'POST /finanzas/fondos': { body: ['assignedToId*', 'nombre*', 'montoInicial*', 'motivo', 'centroCostos', 'segmentCode', 'fechaInicio', 'fechaTermino', 'estado'], role: 'ADMIN' },
      'POST /finanzas/fondos/:id/approve': { body: ['comprobanteUrl*', 'comprobantePreviewUrl'], role: 'ADMIN' },
      'POST /finanzas/fondos/:id/reject': { body: ['motivoRechazo*'], role: 'ADMIN' },
      'POST /finanzas/fondos/:id/supervisor-approve': { body: ['comentario'], role: 'ADMIN' },
      'POST /finanzas/fondos/:id/supervisor-reject': { body: ['comentario*'], role: 'ADMIN' },
      'POST /finanzas/fondos/:id/rrhh-approve': { body: ['comprobanteUrl*', 'comentario'], role: 'ADMIN' },
      'POST /finanzas/fondos/:id/rrhh-reject': { body: ['comentario*'], role: 'ADMIN' },
      'PATCH /finanzas/fondos/:id/recharge': { body: ['comentario*', 'rechargeMode', 'rechargeAmount', 'newFechaInicio', 'newFechaTermino'], role: 'ADMIN' },
      'DELETE /finanzas/fondos/:id': { role: 'ADMIN' },
      'GET /finanzas/comisiones/summary': { filters: ['startDate', 'endDate'], note: 'default: mes en curso', role: 'read_write' },
      'GET /finanzas/comisiones/salesperson/:name': { filters: ['startDate', 'endDate'], role: 'read_write' },
      'GET /finanzas/comisiones/settings': { filters: ['salespersonName'], role: 'read_write' },
      'GET /finanzas/comisiones/overrides': { filters: ['salespersonName'], role: 'read_write' },
      'PUT /finanzas/comisiones/settings': { body: ['salespersonName*', 'commissionPct* (0-100)'], role: 'ADMIN' },
      'PUT /finanzas/comisiones/overrides': { body: ['salespersonName*', 'overrideType* (client|document)', 'value*', 'commissionPct* (number|null → null quita el override)'], role: 'ADMIN' },
      'GET /finanzas/metas': { filters: ['type (global|segment|salesperson)'], role: 'read_write' },
      'GET /finanzas/metas/:id': { role: 'read_write' },
      'POST /finanzas/metas': { body: ['type*', 'amount*', 'period* (YYYY-MM)', 'target', 'description'], role: 'ADMIN' },
      'PATCH /finanzas/metas/:id': { body: ['type', 'amount', 'period', 'target', 'description'], role: 'ADMIN' },
      'DELETE /finanzas/metas/:id': { role: 'ADMIN' },
      'GET /finanzas/presupuesto-ventas': { filters: ['anio'], role: 'read_write' },
      'GET /finanzas/presupuesto-ventas/years': { role: 'read_write' },
      'POST /finanzas/presupuesto-ventas': { body: ['anio*', 'mes*', 'categoria*', 'entidad*', 'monto*'], role: 'ADMIN' },
      'POST /finanzas/presupuesto-ventas/bulk': { body: ['records[]* {anio,mes,categoria,entidad,monto}'], role: 'ADMIN' },
      'DELETE /finanzas/presupuesto-ventas': { filters: ['anio*'], role: 'ADMIN' },
      'GET /finanzas/proyecciones/manual': { filters: ['years (CSV)', 'months (CSV)', 'salespersonCode', 'segment'], role: 'read_write' },
      'GET /finanzas/proyecciones/historico': { filters: ['years', 'months', 'salespersonCode', 'segment', 'search', 'onlyWithAllPeriods', 'sortOrder', 'limit', 'offset'], role: 'read_write' },
      'GET /finanzas/proyecciones/charts': { filters: ['years', 'months', 'salespersonCode', 'segment'], role: 'read_write' },
      'POST /finanzas/proyecciones/manual': { body: ['year*', 'salespersonCode*', 'clientCode*', 'month', 'salespersonName', 'clientName', 'projectedAmount', 'segment'], role: 'ADMIN' },
      'GET /ventas': { filters: ['startDate', 'endDate', 'salesperson', 'segment', 'client', 'product', 'client_rut', 'limit', 'offset'] },
      'GET /clientes': { filters: ['search', 'segment', 'salesperson', 'creditStatus', 'businessType', 'debtStatus', 'entityType', 'salesPeriod', 'compact (true = solo los campos usables)', 'limit', 'offset'], note: 'Maestro del ERP. totalSales es el HISTÓRICO del cliente, no el del período: para rankings por período usar /ventas/top-clientes.' },
      'GET /puntos-de-venta': { filters: ['type (sucursal_propia|distribuidor|ferreteria)', 'region', 'comuna'], note: 'puntos de venta activos con lat/long para el mapa "Dónde Comprar" — CORS abierto' },
      'GET /usuarios': { filters: ['role', 'source (users|salespeople|all)', 'limit'], note: 'returns { users, salespeople, counts }' },
      'GET /notificaciones': { filters: ['type', 'priority', 'departamento', 'archived', 'targetType', 'userId', 'limit', 'offset'] },
      'POST /notificaciones': { body: ['title*', 'message*', 'type', 'priority', 'departamento', 'actionUrl'] },
      'GET /reclamos': { filters: ['estado', 'areaResponsable', 'gravedad', 'vendedorId', 'tecnicoId', 'responsableAreaId', 'limit', 'offset'] },
      'POST /reclamos': { body: ['clienteNombre*', 'motivo*', 'clienteRut', 'clienteEmail', 'clienteTelefono', 'descripcion', 'severidad'] },
      'GET /mantencion': { filters: ['estado', 'tipoMantencion', 'gravedad', 'area', 'solicitanteId', 'tecnicoAsignadoId', 'limit', 'offset'] },
      'POST /mantencion': { body: ['equipoNombre*', 'descripcionProblema*', 'equipoCodigo', 'equipoArea', 'tipoMantencion', 'severidad', 'solicitadoPor'] },
      'GET /tareas': { filters: ['assignedTo', 'status (pendiente|en_progreso|completada)', 'priority (low|medium|high)', 'creatorId', 'limit', 'offset'] },
      'POST /tareas': { body: ['title*', 'type* (texto|formulario|visita)', 'createdByUserId*', 'description', 'status', 'priority', 'progress', 'dueDate', 'assignedToUserId', 'clienteId', 'clienteNombre', 'segmento', 'groupId', 'payload', 'assignments[]'] },
      'PATCH /tareas/:id': { body: ['status', 'notes', '...'] },
      'DELETE /tareas/:id': {},
      'GET /inventario': { filters: ['search', 'bodega', 'sucursal', 'limit', 'offset'], note: 'returns { total, offset, limit, items }. Misma fuente que el módulo de Inventario (inventory_products, que llena el ETL).' },
      'GET /ecommerce/orders': { filters: ['status', 'clientId', 'salespersonId', 'limit', 'offset'] },
      'PATCH /ecommerce/orders/:id': { body: ['status*'] },
      'GET /crm/leads': { filters: ['stage', 'salespersonId', 'supervisorId', 'segment', 'limit', 'offset'], note: 'LEGACY: tabla crm_leads, sin pantalla en la intranet y sin datos nuevos. El CRM que usa la gente es /crm/seguimiento.' },
      'POST /crm/leads': { body: ['clientName*', 'salespersonId*', 'clientPhone', 'clientEmail', 'clientType', 'estimatedValue', 'notes', 'stage', 'segment'] },
      'PATCH /crm/leads/:id': { body: ['stage', 'notes', '...'] },
      'DELETE /crm/leads/:id': {},
      // Pipeline panel "Seguimiento de Clientes" (control total)
      'GET /crm/seguimiento': { filters: ['vendedor (vendedorId)', 'estado (prospecto|seguimiento|cotizacion|venta|perdido)', 'prioridad (baja|media|alta)', 'segmento (Construcción|Ferretería|Digital|Industrial)', 'busqueda (nombre|empresa|rut|email)', 'limit', 'offset'], note: 'Estados viejos (nuevo/contactado/completado/despacho) se aceptan y se traducen. El segmento compara por raíz sin tildes y cae al del cliente del ERP.' },
      'POST /crm/seguimiento': { body: ['nombre*', 'vendedorId*', 'telefono', 'email', 'empresa', 'rut', 'estado', 'prioridad', 'origen', 'notas', 'montoEstimado', 'proximoContacto', 'region', 'comuna', 'contactoEncargado', 'segmento', 'condicionPago', 'destacado'], note: 'Si se entrega rut, vincula automáticamente al cliente del ERP' },
      'GET /crm/seguimiento/:id': { note: 'Detalle + hitos[] (timeline)' },
      'PATCH /crm/seguimiento/:id': { body: ['nombre', 'telefono', 'email', 'empresa', 'estado', 'prioridad', 'notas', 'montoEstimado', 'proximoContacto', 'region', 'comuna', 'contactoEncargado', 'segmento', 'condicionPago', 'destacado', 'vendedorId'], note: 'Cambios de estado/vendedor generan hitos automáticos' },
      'DELETE /crm/seguimiento/:id': { note: 'Soft delete (active=false)' },
      'POST /crm/seguimiento/:id/hito': { body: ['tipo* (contacto|llamada|cotizacion|visita|venta|despacho|nota|sistema)', 'descripcion*', 'documentoTipo', 'documentoNumero', 'autor'] },
      'POST /crm/seguimiento/:id/vincular-rut': { body: ['rut*'], note: 'Auto-busca y enlaza al cliente del ERP' },
      'GET /crm/seguimiento/:id/detectar-compras': { note: 'Devuelve últimas 20 ventas y crea hitos automáticos por documento nuevo' },
      'GET /crm/seguimiento/:id/nvv': { note: 'NVV y GDV del cliente vinculado (últimos 6 meses)' },
      'GET /crm/seguimiento/:id/bitacora': { filters: ['limit'], note: 'Lista entradas de la BITÁCORA (panel derecho), distinta del timeline /hito' },
      'POST /crm/seguimiento/:id/bitacora': { body: ['nota*', 'tipo (nota|llamada|visita|seguimiento|problema)', 'autor'], note: 'Refresca ultimoContacto del CRM' },
      'DELETE /crm/seguimiento/:id/bitacora/:entryId': { note: 'Eliminar entrada' },
      'GET /crm/seguimiento/stats': { filters: ['vendedor (vendedorId)', 'segmento'], note: 'KPIs del panel: { total (ACTIVOS, excluye perdido), totalIncluyendoPerdidos, porEstado, porPrioridad, sinContacto7Dias, prospectosEnSeguimiento, montoEstimadoActivo, montoEstimadoPorEstado, tasaConversion, tiempoCierrePromedioDias }' },
      'GET /crm/seguimiento/por-vendedor': { filters: ['segmento'], note: 'El mismo resumen abierto por vendedor (items[]) + el consolidado. Evita llamar /stats una vez por vendedor.' },
      'GET /crm/seguimiento/segmentos': { note: 'Catálogo de segmentos del ERP' },
      'GET /productos': { filters: ['search', 'unidad', 'tipoProducto', 'color', 'priceList (LP01|LP02|...)', 'limit', 'offset'], note: 'flat list with all price tiers + cost + custom-list price' },
      'GET /listas-precio': { note: 'lists LP01 (base) + custom price lists (LP02 Mix, LP03 etc)' },
      'GET /listas-precio/:code/productos': { filters: ['search', 'limit', 'offset'], note: 'products with prices for that specific list' },
      'GET /cotizaciones/:id/pdf': { note: 'PDF binario por defecto (?format=html para HTML)' },
      'GET /cotizaciones/:id/pdf-url': { filters: ['ttlMinutes (default 60, max 1440)'], note: 'URL pública firmada para abrir el PDF directo en el navegador sin API key' },
      'GET /productos/grupos': { filters: ['search', 'categoria', 'soloActivos', 'limit', 'offset'], note: 'grouped like the store: parent product + color/format variations with prices' },
      'GET /productos/:codigo': { note: 'product detail + stock per warehouse' },
      'GET /cotizaciones': { filters: ['status', 'createdBy', 'salespersonName', 'clientName', 'dateFrom', 'dateTo', 'limit', 'offset'], note: 'returns quote + creatorName' },
      'GET /cotizaciones/:id': { note: 'returns quote + items[]' },
      'POST /cotizaciones': { body: ['clientName*', 'salespersonName*', 'clientRut', 'clientEmail', 'clientPhone', 'clientAddress', 'validUntil', 'paymentCondition', 'segment', 'subtotal', 'discount', 'taxRate', 'taxAmount', 'total', 'notes', 'items[]'] },
      'PATCH /cotizaciones/:id': { body: ['salespersonName', 'status', 'notes', 'validUntil', '...'] },
      'PATCH /cotizaciones/:id/status': { body: ['status* (draft|sent|accepted|rejected|converted)'] },
      'DELETE /cotizaciones/:id': {},
      'GET /cotizaciones/:id/items': {},
      'POST /cotizaciones/:id/items': { body: ['productName*', 'quantity*', 'unitPrice*', 'type (standard|custom)', 'productCode', 'productUnit', 'notes'] },
      'PATCH /cotizaciones/items/:itemId': { body: ['quantity', 'unitPrice', 'productName', '...'] },
      'DELETE /cotizaciones/items/:itemId': {},
      'GET /dashboard': { filters: ['period (YYYY | YYYY-MM | YYYY-MM-DD)', 'filterType', 'segment', 'salesperson', 'client'] },
      // ═══ Estadísticas de ventas (rankings y fichas) ═══
      // period acepta YYYY | YYYY-MM | YYYY-MM-DD | current-month | last-month |
      // last-30-days | last-90-days, o startDate + endDate para un rango libre.
      'GET /ventas/top-clientes': { filters: ['period | startDate+endDate', 'salesperson', 'segment', 'product', 'limit (default 20, max 500)'], note: 'Ranking de clientes por venta FACTURADA del período, con percentage y percentageAcumulado (Pareto). Para "los N que más compraron" usar esto, NO /clientes (ahí totalSales es el histórico).' },
      'GET /ventas/top-vendedores': { filters: ['period | startDate+endDate', 'segment', 'client', 'product', 'limit'], note: 'Ranking por VOLUMEN. Para margen: /margenes/ventas/por-vendedor.' },
      'GET /ventas/top-productos': { filters: ['period | startDate+endDate', 'salesperson', 'segment', 'client', 'limit'], note: 'Ranking de productos por venta. Mismos datos que /margenes/top-productos con más formatos de period.' },
      'GET /ventas/por-segmento': { filters: ['period | startDate+endDate', 'salesperson', 'segment'], note: 'Participación de cada segmento comercial en la venta del período.' },
      'GET /ventas/tendencia': { filters: ['period | startDate+endDate', 'granularidad (daily|weekly|monthly)', 'salesperson', 'segment', 'client', 'product'], note: 'Serie temporal de la venta del período.' },
      'GET /ventas/ficha-cliente': { filters: ['nombre* (parcial, se resuelve al del ERP)', 'period | startDate+endDate', 'limitProductos'], note: 'Métricas del cliente en el período + qué le vendimos + quién se lo vendió.' },
      'GET /ventas/ficha-vendedor': { filters: ['nombre*', 'period | startDate+endDate', 'limitClientes', 'limitProductos'], note: 'Métricas del vendedor + su cartera top + productos + apertura por segmento.' },
      'GET /ventas/ficha-producto': { filters: ['nombre*', 'period | startDate+endDate', 'segment'], note: 'Quién compra el producto y quién lo vende.' },
    },
  });
});

// ============================================
// API Keys Management (admin only)
// ============================================

router.get('/api-keys', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const keys = await storage.getApiKeys();
    
    // Don't return the actual key hash
    const sanitizedKeys = keys.map(key => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      name: key.name,
      description: key.description,
      role: key.role,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      createdBy: key.createdBy,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
    }));

    res.json(sanitizedKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api-keys', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { name, description, role, expiresAt } = req.body;

    if (!name || !req.apiKey) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Generate a random API key
    const apiKey = `mk_${role}_${nanoid(32)}`;
    const keyHash = await bcrypt.hash(apiKey, 10);
    const keyPrefix = apiKey.substring(0, 16) + '...';

    const newKey = await storage.createApiKey({
      name,
      description,
      role: role || 'readonly',
      createdBy: req.apiKey.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      keyHash,
      keyPrefix,
    });

    // Return the full API key ONLY on creation (it won't be accessible again)
    res.json({
      ...newKey,
      apiKey, // Only shown once
      keyHash: undefined, // Don't expose hash
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/api-keys/:id/toggle', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updated = await storage.toggleApiKeyStatus(id, isActive);
    
    if (!updated) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ ...updated, keyHash: undefined });
  } catch (error) {
    console.error('Error toggling API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api-keys/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteApiKey(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Sales Transactions (Read)
// ============================================

router.get('/ventas', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, salesperson, segment, client, product, client_rut } = req.query;

    const result = await storage.getSalesTransactions({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      salesperson: salesperson as string | undefined,
      segment: segment as string | undefined,
      client: client as string | undefined,
      product: product as string | undefined,
      client_rut: client_rut as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Clients (Read)
// ============================================

// Campos que se devuelven con ?compact=true. El maestro del ERP trae 100+ columnas
// (direcciones, condiciones de crédito SAP, flags internos) casi todas vacías, y con
// eso una respuesta de 50 clientes se pasa de largo y el cliente MCP la corta. Este
// subconjunto es lo que se usa al hablar de un cliente.
const CLIENTE_CAMPOS_COMPACTOS = [
  'id', 'koen', 'nokoen', 'rten', 'cmen', 'gien', 'email', 'foen', 'cpen', 'crsd',
  'totalTransactions', 'totalSales', 'lastTransactionDate', 'lastTransactionAmount',
  'salespersonName', 'salesSegment', 'marketAccess',
] as const;

function clienteCompacto(cliente: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const campo of CLIENTE_CAMPOS_COMPACTOS) {
    const valor = cliente[campo];
    if (valor !== null && valor !== undefined && valor !== '') out[campo] = valor;
  }
  return out;
}

router.get('/clientes', async (req: ApiAuthRequest, res) => {
  try {
    const { search, segment, salesperson, creditStatus, businessType, debtStatus, entityType, salesPeriod } = req.query;
    const compact = String(req.query.compact ?? '') === 'true' || String(req.query.compact ?? '') === '1';

    const clients = await storage.getClients({
      search: search as string | undefined,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      creditStatus: creditStatus as string | undefined,
      businessType: businessType as string | undefined,
      debtStatus: debtStatus as string | undefined,
      entityType: entityType as string | undefined,
      salesPeriod: salesPeriod as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    res.json(compact ? clients.map((c) => clienteCompacto(c as unknown as Record<string, unknown>)) : clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Puntos de Venta (Read) — sucursales, distribuidores, ferreterías
// ============================================
// Para integrar el mapa "Dónde Comprar" en el sitio web público en PHP u otros sistemas
// usando la misma key de API. Devuelve solo ubicaciones activas. CORS abierto por si el
// consumidor lo pide desde JavaScript.
router.get('/puntos-de-venta', async (req: ApiAuthRequest, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');

    const { type, region, comuna } = req.query as { type?: string; region?: string; comuna?: string };
    const filters = [eq(retailLocations.active, true)];
    if (type && ['ferreteria', 'distribuidor', 'sucursal_propia'].includes(type)) {
      filters.push(eq(retailLocations.type, type));
    }
    if (region && region.trim()) filters.push(ilike(retailLocations.region, region.trim()));
    if (comuna && comuna.trim()) filters.push(ilike(retailLocations.comuna, comuna.trim()));

    const rows = await db
      .select({
        id: retailLocations.id,
        name: retailLocations.name,
        type: retailLocations.type,
        address: retailLocations.address,
        comuna: retailLocations.comuna,
        region: retailLocations.region,
        latitude: retailLocations.latitude,
        longitude: retailLocations.longitude,
        phone: retailLocations.phone,
        email: retailLocations.email,
        website: retailLocations.website,
        schedule: retailLocations.schedule,
        logoUrl: retailLocations.logoUrl,
        active: retailLocations.active,
      })
      .from(retailLocations)
      .where(and(...filters))
      .orderBy(retailLocations.name);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching puntos de venta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Users (Read)
// ============================================

router.get('/usuarios', async (req: ApiAuthRequest, res) => {
  try {
    const { role, source = 'all' } = req.query;
    const lim = parseLimit(req.query.limit);

    const usersList = source !== 'salespeople'
      ? await (async () => {
          const conditions = [];
          if (role) conditions.push(eq(users.role, role as string));
          let q = db
            .select({
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              role: users.role,
              createdAt: users.createdAt,
            })
            .from(users);
          if (conditions.length > 0) q = q.where(and(...conditions)) as typeof q;
          return await q.orderBy(desc(users.createdAt)).limit(lim);
        })()
      : [];

    const salespeopleList = source !== 'users'
      ? await (async () => {
          const conditions = [eq(salespeopleUsers.isActive, true)];
          if (role) conditions.push(eq(salespeopleUsers.role, role as string));
          return await db
            .select({
              id: salespeopleUsers.id,
              salespersonName: salespeopleUsers.salespersonName,
              username: salespeopleUsers.username,
              email: salespeopleUsers.email,
              role: salespeopleUsers.role,
              supervisorId: salespeopleUsers.supervisorId,
              assignedSegment: salespeopleUsers.assignedSegment,
              isActive: salespeopleUsers.isActive,
              createdAt: salespeopleUsers.createdAt,
            })
            .from(salespeopleUsers)
            .where(and(...conditions))
            .orderBy(desc(salespeopleUsers.createdAt))
            .limit(lim);
        })()
      : [];

    res.json({
      users: usersList,
      salespeople: salespeopleList,
      counts: { users: usersList.length, salespeople: salespeopleList.length },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Notifications (Read & Create)
// ============================================

router.get('/notificaciones', async (req: ApiAuthRequest, res) => {
  try {
    const { type, priority, departamento, archived, targetType, userId } = req.query;

    const conditions = [];
    if (type) conditions.push(eq(notifications.type, type as string));
    if (priority) conditions.push(eq(notifications.priority, priority as string));
    if (departamento) conditions.push(eq(notifications.department, departamento as string));
    if (targetType) conditions.push(eq(notifications.targetType, targetType as string));
    if (userId) conditions.push(eq(notifications.userId, userId as string));
    if (archived !== undefined) conditions.push(eq(notifications.isArchived, archived === 'true'));

    let query = db.select().from(notifications);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query
      .orderBy(desc(notifications.createdAt))
      .limit(parseLimit(req.query.limit))
      .offset(parseOffset(req.query.offset));

    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notificaciones', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { title, message, type, priority, departamento, actionUrl } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const notification = await storage.createNotification({
      title,
      message,
      type: type || 'manual',
      priority: priority || 'media',
      targetType: departamento ? 'departamento' : 'general',
      department: departamento || null,
      actionUrl: actionUrl || null,
      createdBy: 'api', // Mark as created by API
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Reclamos Generales (ciclo completo)
//
// A diferencia del resto de esta API (que refleja sesiones humanas dentro de
// esta misma app), estos endpoints son consumidos por orchestrator-panoramica
// como servicio-a-servicio: no hay usuario de interanetv2-main autenticado en
// la request, así que quién realiza la acción (actorId/actorName/actorRole)
// viene explícito en el body en vez de salir de req.user. El llamador es
// responsable de mapear su propio usuario a un usuario real de interanetv2-main
// antes de llamar (ver orchestrator-panoramica: shared/schemas/users.ts,
// campo interanetUserId).
// ============================================

router.get('/reclamos', async (req: ApiAuthRequest, res) => {
  try {
    const { estado, areaResponsable, gravedad, vendedorId, tecnicoId, responsableAreaId } = req.query;

    const reclamos = await storage.getReclamosGenerales({
      estado: estado as string | undefined,
      areaResponsable: areaResponsable as string | undefined,
      gravedad: gravedad as string | undefined,
      vendedorId: vendedorId as string | undefined,
      tecnicoId: tecnicoId as string | undefined,
      responsableAreaId: responsableAreaId as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    res.json(reclamos);
  } catch (error) {
    console.error('Error fetching reclamos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reclamos/:id', async (req: ApiAuthRequest, res) => {
  try {
    const reclamo = await storage.getReclamoGeneralById(req.params.id);
    if (!reclamo) {
      return res.status(404).json({ error: 'Reclamo no encontrado' });
    }
    res.json(reclamo);
  } catch (error) {
    console.error('Error fetching reclamo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reclamos/:id/details', async (req: ApiAuthRequest, res) => {
  try {
    const reclamo = await storage.getReclamoGeneralWithDetails(req.params.id);
    if (!reclamo) {
      return res.status(404).json({ error: 'Reclamo no encontrado' });
    }
    res.json(reclamo);
  } catch (error) {
    console.error('Error fetching reclamo details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const reclamoData = req.body;

    if (!reclamoData.clienteNombre || !reclamoData.motivo) {
      return res.status(400).json({ error: 'Client name and motivo are required' });
    }

    const newReclamo = await storage.createReclamoGeneral(reclamoData);
    res.status(201).json(newReclamo);
  } catch (error) {
    console.error('Error creating reclamo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/reclamos/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const reclamo = await storage.updateReclamoGeneral(req.params.id, req.body);
    res.json(reclamo);
  } catch (error) {
    console.error('Error updating reclamo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// El rol que decide si SE PUEDE borrar es el actorRole (rol real de quien
// hace la acción en interanetv2-main), no el rol de la API key — la key solo
// certifica que la app llamante está autorizada a hacer llamadas de
// escritura. Mismas reglas que la ruta interna (routes.ts DELETE
// /api/reclamos-generales/:id): admin/tecnico_obra siempre pueden; el
// creador puede borrar su propio reclamo solo dentro de los primeros 5 min.
router.delete('/reclamos/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { actorId, actorRole } = req.body;
    if (!actorId || !actorRole) {
      return res.status(400).json({ error: 'actorId y actorRole son requeridos' });
    }

    if (actorRole === 'admin' || actorRole === 'tecnico_obra') {
      await storage.deleteReclamoGeneral(req.params.id);
      return res.status(204).send();
    }

    const reclamo = await storage.getReclamoGeneralById(req.params.id);
    if (!reclamo) {
      return res.status(404).json({ error: 'Reclamo no encontrado' });
    }
    if (reclamo.vendedorId !== actorId) {
      return res.status(403).json({ error: 'No tiene permiso para eliminar este reclamo' });
    }

    const createdAt = new Date(reclamo.fechaRegistro || '');
    const minutosTranscurridos = (Date.now() - createdAt.getTime()) / (1000 * 60);
    if (minutosTranscurridos > 5) {
      return res.status(403).json({ error: 'Solo puede eliminar reclamos recientes (< 5 minutos)' });
    }

    await storage.deleteReclamoGeneral(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reclamo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/assign-tecnico', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { tecnicoId, tecnicoName, actorId, actorName } = req.body;
    if (!tecnicoId || !tecnicoName || !actorId || !actorName) {
      return res.status(400).json({ error: 'tecnicoId, tecnicoName, actorId y actorName son requeridos' });
    }

    const reclamo = await storage.assignTecnicoToReclamo(req.params.id, tecnicoId, tecnicoName, actorId, actorName);
    res.json(reclamo);
  } catch (error) {
    console.error('Error assigning tecnico:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/update-estado', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { nuevoEstado, notas, actorId, actorName } = req.body;
    if (!nuevoEstado || !actorId || !actorName) {
      return res.status(400).json({ error: 'nuevoEstado, actorId y actorName son requeridos' });
    }

    const reclamo = await storage.updateReclamoGeneralEstado(req.params.id, nuevoEstado, actorId, actorName, notas);
    res.json(reclamo);
  } catch (error) {
    console.error('Error updating estado:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/derivar-laboratorio', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { actorId, actorName } = req.body;
    if (!actorId || !actorName) {
      return res.status(400).json({ error: 'actorId y actorName son requeridos' });
    }

    const reclamo = await storage.derivarReclamoGeneralLaboratorio(req.params.id, actorId, actorName);
    res.json(reclamo);
  } catch (error) {
    console.error('Error derivando a laboratorio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/derivar-produccion', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { actorId, actorName } = req.body;
    if (!actorId || !actorName) {
      return res.status(400).json({ error: 'actorId y actorName son requeridos' });
    }

    const reclamo = await storage.derivarReclamoGeneralProduccion(req.params.id, actorId, actorName);
    res.json(reclamo);
  } catch (error) {
    console.error('Error derivando a producción:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/validacion-tecnica', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { procede, areaResponsable, notas, actorId, actorName } = req.body;

    if (typeof procede !== 'boolean') {
      return res.status(400).json({ error: 'El campo procede es requerido y debe ser booleano' });
    }
    if (procede && !areaResponsable) {
      return res.status(400).json({ error: 'El área responsable es requerida cuando el reclamo procede' });
    }
    if (!actorId || !actorName) {
      return res.status(400).json({ error: 'actorId y actorName son requeridos' });
    }

    const reclamo = await storage.validarReclamoTecnico(req.params.id, procede, areaResponsable, notas, actorId, actorName);
    res.json(reclamo);
  } catch (error) {
    console.error('Error validando reclamo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/informe-laboratorio', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { informe, actorId, actorName } = req.body;
    if (!informe || !actorId || !actorName) {
      return res.status(400).json({ error: 'informe, actorId y actorName son requeridos' });
    }

    const reclamo = await storage.updateInformeLaboratorio(req.params.id, informe, actorId, actorName);
    res.json(reclamo);
  } catch (error) {
    console.error('Error updating informe laboratorio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/informe-produccion', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { informe, actorId, actorName } = req.body;
    if (!informe || !actorId || !actorName) {
      return res.status(400).json({ error: 'informe, actorId y actorName son requeridos' });
    }

    const reclamo = await storage.updateInformeProduccion(req.params.id, informe, actorId, actorName);
    res.json(reclamo);
  } catch (error) {
    console.error('Error updating informe producción:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/informe-tecnico', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { informe, actorId, actorName } = req.body;
    if (!informe || !actorId || !actorName) {
      return res.status(400).json({ error: 'informe, actorId y actorName son requeridos' });
    }

    const reclamo = await storage.updateInformeTecnico(req.params.id, informe, actorId, actorName);
    res.json(reclamo);
  } catch (error) {
    console.error('Error updating informe técnico:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/resolucion-laboratorio', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { informe, categoriaResponsable, photos, documents, actorId, actorName, actorRole } = req.body;

    if (actorRole !== 'laboratorio') {
      return res.status(403).json({ error: 'Solo usuarios con rol laboratorio pueden subir resoluciones' });
    }
    if (!informe) {
      return res.status(400).json({ error: 'El informe es requerido' });
    }
    if (!categoriaResponsable) {
      return res.status(400).json({ error: 'La categoría responsable es requerida' });
    }
    if (!actorId || !actorName) {
      return res.status(400).json({ error: 'actorId y actorName son requeridos' });
    }

    const photoArray = Array.isArray(photos) ? photos : [];
    const documentArray = Array.isArray(documents) ? documents : [];

    const existingReclamo = await storage.getReclamoGeneralById(req.params.id);
    if (!existingReclamo) {
      return res.status(404).json({ error: 'Reclamo no encontrado' });
    }
    if (existingReclamo.estado !== 'en_laboratorio') {
      return res.status(400).json({ error: 'El reclamo no está en estado "En Laboratorio"' });
    }
    if (existingReclamo.informeLaboratorio) {
      return res.status(400).json({ error: 'Este reclamo ya tiene una resolución del laboratorio' });
    }

    const reclamo = await storage.updateResolucionLaboratorio(req.params.id, informe, categoriaResponsable, photoArray, actorId, actorName, documentArray);
    if (!reclamo) {
      return res.status(409).json({ error: 'El reclamo ya tiene una resolución o fue modificado por otro usuario' });
    }

    res.json(reclamo);
  } catch (error) {
    console.error('Error al subir resolución de laboratorio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/resolucion-area', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { resolucionDescripcion, photos, documents, actorId, actorName, actorRole } = req.body;

    const organizationalRoles = ['produccion', 'logistica_bodega', 'planificacion', 'bodega_materias_primas', 'prevencion_riesgos'];
    const isAreaRole = actorRole && (
      actorRole.startsWith('area_') ||
      actorRole === 'laboratorio' ||
      actorRole === 'jefe_planta' ||
      organizationalRoles.includes(actorRole)
    );
    if (!isAreaRole) {
      return res.status(403).json({ error: 'No tiene permisos para subir resoluciones' });
    }
    if (!resolucionDescripcion) {
      return res.status(400).json({ error: 'La descripción de la resolución es requerida' });
    }
    if (!actorId || !actorName) {
      return res.status(400).json({ error: 'actorId y actorName son requeridos' });
    }

    const photoArray = Array.isArray(photos) ? photos : [];
    const documentArray = Array.isArray(documents) ? documents : [];

    try {
      const reclamo = await storage.updateResolucionArea(req.params.id, resolucionDescripcion, photoArray, actorId, actorName, actorRole, documentArray);
      if (!reclamo) {
        return res.status(409).json({ error: 'El reclamo ya tiene una resolución o fue modificado por otro usuario' });
      }
      res.json(reclamo);
    } catch (error: any) {
      if (error.message?.includes('no está en estado') || error.message?.includes('No tiene permisos')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error al subir resolución de área:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/cerrar', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { notas, photos, actorId, actorName } = req.body;
    if (!actorId || !actorName) {
      return res.status(400).json({ error: 'actorId y actorName son requeridos' });
    }

    const reclamo = await storage.cerrarReclamoGeneral(req.params.id, actorId, actorName, notas, photos);
    res.json(reclamo);
  } catch (error) {
    console.error('Error cerrando reclamo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reclamos/:id/photos', async (req: ApiAuthRequest, res) => {
  try {
    const photos = await storage.getReclamoGeneralPhotos(req.params.id);
    res.json(photos);
  } catch (error) {
    console.error('Error fetching reclamo photos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos/:id/photos', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const photo = await storage.createReclamoGeneralPhoto({ reclamoId: req.params.id, ...req.body });
    res.status(201).json(photo);
  } catch (error) {
    console.error('Error creating reclamo photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/reclamos/photos/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteReclamoGeneralPhoto(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reclamo photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reclamos/:id/resolucion-photos', async (req: ApiAuthRequest, res) => {
  try {
    const photos = await storage.getReclamoGeneralResolucionPhotos(req.params.id);
    res.json(photos);
  } catch (error) {
    console.error('Error fetching resolución photos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reclamos/:id/historial', async (req: ApiAuthRequest, res) => {
  try {
    const historial = await storage.getReclamoGeneralHistorial(req.params.id);
    res.json(historial);
  } catch (error) {
    console.error('Error fetching reclamo historial:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Maintenance Requests (Read & Create)
// ============================================

router.get('/mantencion', async (req: ApiAuthRequest, res) => {
  try {
    const { estado, tipoMantencion, gravedad, area, solicitanteId, tecnicoAsignadoId } = req.query;

    const solicitudes = await storage.getSolicitudesMantencion({
      estado: estado as string | undefined,
      gravedad: gravedad as string | undefined,
      area: area as string | undefined,
      solicitanteId: solicitanteId as string | undefined,
      tecnicoAsignadoId: tecnicoAsignadoId as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    const filtered = tipoMantencion
      ? solicitudes.filter((s: any) => s.tipoMantencion === tipoMantencion)
      : solicitudes;

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mantencion', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const mantencionData = req.body;
    
    if (!mantencionData.equipoNombre || !mantencionData.descripcionProblema) {
      return res.status(400).json({ error: 'Equipment name and problem description are required' });
    }

    const newSolicitud = await storage.createSolicitudMantencion(mantencionData);
    res.status(201).json(newSolicitud);
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Tasks (Read & Write)
// ============================================

router.get('/tareas', async (req: ApiAuthRequest, res) => {
  try {
    const { assignedTo, status, priority, creatorId } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const tasks = await storage.getTasks({
      status: status as string | undefined,
      priority: priority as string | undefined,
      creatorId: creatorId as string | undefined,
      assigneeUserId: assignedTo as string | undefined,
      userRole: 'admin',
      userId: 'api',
    });

    res.json(tasks.slice(off, off + lim));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const taskData = req.body;
    
    if (!taskData.title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const { assignments = [], ...taskFields } = taskData;
    const newTask = await storage.createTask(taskFields, assignments);
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tareas/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = await storage.updateTask(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tareas/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.deleteTask(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Inventory (Read only)
// ============================================

// El stock real lo llena el ETL en `inventory_products` (misma fuente que el
// módulo de Inventario de la intranet). La tabla `product_stock` que se usaba
// acá antes quedó huérfana —ningún ETL la escribe— y devolvía siempre 0 items.
router.get('/inventario', async (req: ApiAuthRequest, res) => {
  try {
    const { bodega, sucursal, search } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const all = await storage.getInventoryWithPrices({
      search: search as string | undefined,
      warehouse: bodega as string | undefined,
      branch: sucursal as string | undefined,
    });

    // El costo (precio medio y valorización) se acota igual que en la UI: los
    // vendedores ven stock, no valorización.
    const rol = req.oauthUser?.rolIntranet ?? req.apiKey?.role ?? '';
    const verValorizacion = !['salesperson', 'client'].includes(rol);

    const items = all.slice(off, off + lim).map((item) => {
      const { averagePrice, totalValue, ...stock } = item;
      return verValorizacion ? { ...stock, averagePrice, totalValue } : stock;
    });

    res.json({ total: all.length, offset: off, limit: lim, items });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// E-commerce Orders (Read)
// ============================================

router.get('/ecommerce/orders', async (req: ApiAuthRequest, res) => {
  try {
    const { status, clientId, salespersonId } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const orders = await storage.getEcommerceOrders({
      status: status as string | undefined,
      clientId: clientId as string | undefined,
      salespersonId: salespersonId as string | undefined,
    });

    res.json(orders.slice(off, off + lim));
  } catch (error) {
    console.error('Error fetching e-commerce orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/ecommerce/orders/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const [updated] = await db
      .update(ecommerceOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(ecommerceOrders.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating e-commerce order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CRM Leads (Read & Write)
// ============================================

router.get('/crm/leads', async (req: ApiAuthRequest, res) => {
  try {
    const { stage, salespersonId, supervisorId, segment } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const leads = await storage.getAllLeads({
      stage: stage as string | undefined,
      salespersonId: salespersonId as string | undefined,
      supervisorId: supervisorId as string | undefined,
      segment: segment as string | undefined,
    });

    res.json(leads.slice(off, off + lim));
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/crm/leads', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const leadData = req.body;

    if (!leadData.clientName || !leadData.salespersonId) {
      return res.status(400).json({ error: 'clientName and salespersonId are required' });
    }

    const newLead = await storage.createLead(leadData);
    res.status(201).json(newLead);
  } catch (error) {
    console.error('Error creating CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/crm/leads/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const updated = await storage.updateLead(id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/crm/leads/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.deleteLead(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CRM Seguimiento de Clientes (Pipeline) — Read & Write
// Mirrors the internal /api/crm/seguimiento/* endpoints used by the
// "Seguimiento de Clientes" panel. Authentication uses X-API-Key (no
// per-user role filtering — every API key with the right permission can
// see/edit all active rows).
// ============================================

const SEGUIMIENTO_ALLOWED_FIELDS = [
  'nombre', 'telefono', 'email', 'empresa', 'estado', 'prioridad', 'notas',
  'montoEstimado', 'origen', 'proximoContacto', 'region', 'comuna',
  'contactoEncargado', 'segmento', 'condicionPago', 'destacado',
] as const;

// Author identity to stamp on system-generated milestones from API calls.
// We use the API key name so the audit trail shows which integration acted.
const apiAuthorFromKey = (req: ApiAuthRequest, fallback?: string) =>
  fallback || (req.apiKey?.name ? `API: ${req.apiKey.name}` : 'API');

// GET /crm/seguimiento/segmentos — Catálogo de segmentos del ERP
router.get('/crm/seguimiento/segmentos', async (_req: ApiAuthRequest, res) => {
  try {
    const result = await db.execute(sql`SELECT koru, nokoru FROM ventas.stg_tabru ORDER BY nokoru`);
    const segmentos = (result.rows || []).map((r: any) => ({ code: r.koru, name: r.nokoru }));
    res.json(segmentos);
  } catch (error) {
    console.error('Error fetching seguimiento segmentos:', error);
    res.json([]);
  }
});

// Lee el pipeline (con el segmento derivado del cliente del ERP cuando el lead no
// lo tiene propio) y lo resume igual que las tarjetas KPI del panel. Se comparte
// entre /crm/seguimiento/stats y /crm/seguimiento/por-vendedor para que los dos
// cuenten lo mismo.
type SeguimientoLead = typeof crmSeguimientoClientes.$inferSelect & { linkedSegmento?: string | null };

async function leerPipelineSeguimiento(opts: {
  vendedorId?: string;
  segmento?: string;
}): Promise<SeguimientoLead[]> {
  const conditions: any[] = [eq(crmSeguimientoClientes.active, true)];
  if (opts.vendedorId) conditions.push(eq(crmSeguimientoClientes.vendedorId, opts.vendedorId));

  const rows = await db.select({
      ...getTableColumns(crmSeguimientoClientes),
      linkedSegmento: sql<string>`(SELECT nokoru FROM ventas.stg_tabru WHERE koru = ${clients.ruen} LIMIT 1)`.as('linked_segmento'),
    })
    .from(crmSeguimientoClientes)
    .leftJoin(clients, eq(crmSeguimientoClientes.clienteId, clients.id))
    .where(and(...conditions));

  // El segmento del lead es texto libre y conviven variantes ("Ferretería" del CRM
  // vs "FERRETERIAS" del ERP): se compara por raíz sin tildes, igual que el listado.
  if (!opts.segmento || opts.segmento === 'todos') return rows as SeguimientoLead[];
  const raiz = segmentoRaiz(opts.segmento);
  return (rows as SeguimientoLead[]).filter((c) => {
    const propio = String(c.segmento || c.linkedSegmento || '').trim();
    return propio !== '' && segmentoRaiz(propio) === raiz;
  });
}

// Tiempo promedio (días) entre el alta del lead y el primer hito de sistema que lo
// movió a "venta". No hay columna de cierre, así que el hito es la única marca.
async function tiempoPromedioCierre(leads: SeguimientoLead[]): Promise<number | null> {
  const ids = leads.map((c) => c.id);
  if (ids.length === 0) return null;

  const cierres = await db.select({
      seguimientoId: crmSeguimientoHitos.seguimientoId,
      createdAt: crmSeguimientoHitos.createdAt,
    })
    .from(crmSeguimientoHitos)
    .where(and(
      eq(crmSeguimientoHitos.tipo, 'sistema'),
      ilike(crmSeguimientoHitos.descripcion, '%a "venta"%'),
      inArray(crmSeguimientoHitos.seguimientoId, ids),
    ));

  const primerCierre = new Map<string, Date>();
  for (const h of cierres) {
    const prev = primerCierre.get(h.seguimientoId);
    if (!prev || h.createdAt < prev) primerCierre.set(h.seguimientoId, h.createdAt);
  }

  const porId = new Map(leads.map((c) => [c.id, c]));
  const dias: number[] = [];
  for (const [id, cierreAt] of Array.from(primerCierre.entries())) {
    const lead = porId.get(id);
    if (!lead) continue;
    const diff = (cierreAt.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diff >= 0) dias.push(diff);
  }
  if (dias.length === 0) return null;
  return Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
}

// Resume un conjunto de leads con los mismos criterios de las tarjetas KPI del panel.
function resumirPipeline(leads: SeguimientoLead[]) {
  const porEstado: Record<string, number> = {};
  const porPrioridad: Record<string, number> = {};
  const montoEstimadoPorEstado: Record<string, number> = {};
  let sinContacto7Dias = 0;
  let activos = 0;
  let montoEstimadoActivo = 0;
  const ahora = Date.now();

  for (const c of leads) {
    const monto = Number(c.montoEstimado ?? 0) || 0;
    // porEstado conserva TODOS los estados (incluido "perdido") porque es la foto
    // del embudo; "perdido" no cuenta como lead activo ni entra en el alerta de
    // 7 días, igual que en el panel.
    porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
    porPrioridad[c.prioridad] = (porPrioridad[c.prioridad] || 0) + 1;
    montoEstimadoPorEstado[c.estado] = (montoEstimadoPorEstado[c.estado] || 0) + monto;
    if (c.estado === 'perdido') continue;
    activos++;
    montoEstimadoActivo += monto;
    if (c.ultimoContacto) {
      const diffDays = (ahora - new Date(c.ultimoContacto).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) sinContacto7Dias++;
    } else {
      sinContacto7Dias++;
    }
  }

  // "seguimiento" absorbe el legacy "contactado" (ver client/src/lib/crm-seguimiento.ts).
  const prospectosEnSeguimiento = (porEstado['seguimiento'] || 0) + (porEstado['contactado'] || 0);
  const ganados = porEstado['venta'] || 0;
  const cerrados = ganados + (porEstado['perdido'] || 0);

  return {
    total: activos,
    totalIncluyendoPerdidos: leads.length,
    porEstado,
    porPrioridad,
    sinContacto7Dias,
    prospectosEnSeguimiento,
    montoEstimadoActivo,
    montoEstimadoPorEstado,
    // Cerrados ganados sobre cerrados totales. Sin cierres todavía es null, no 0%.
    tasaConversion: cerrados > 0 ? Math.round((ganados / cerrados) * 10000) / 100 : null,
  };
}

// GET /crm/seguimiento/stats — KPIs del pipeline, con los mismos criterios que las
// tarjetas del panel "Seguimiento de Clientes": `total` son los leads ACTIVOS
// (excluye "perdido"), y se agrega el valor estimado del embudo y la conversión.
router.get('/crm/seguimiento/stats', async (req: ApiAuthRequest, res) => {
  try {
    const vendedorId = (req.query.vendedor as string | undefined) || undefined;
    const segmento = (req.query.segmento as string | undefined) || undefined;

    const leads = await leerPipelineSeguimiento({ vendedorId, segmento });
    const resumen = resumirPipeline(leads);
    const tiempoCierrePromedioDias = await tiempoPromedioCierre(leads);

    res.json({
      filtros: { vendedor: vendedorId ?? null, segmento: segmento ?? null },
      ...resumen,
      tiempoCierrePromedioDias,
    });
  } catch (error) {
    console.error('Error fetching seguimiento stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /crm/seguimiento/por-vendedor — el mismo resumen del pipeline abierto por
// vendedor. Es la vista que pide un supervisor ("cómo viene el CRM de cada uno")
// y evita tener que llamar a /stats una vez por vendedor.
router.get('/crm/seguimiento/por-vendedor', async (req: ApiAuthRequest, res) => {
  try {
    const segmento = (req.query.segmento as string | undefined) || undefined;
    const leads = await leerPipelineSeguimiento({ segmento });

    const porVendedor = new Map<string, SeguimientoLead[]>();
    for (const lead of leads) {
      const key = lead.vendedorId || 'sin_vendedor';
      const acc = porVendedor.get(key);
      if (acc) acc.push(lead);
      else porVendedor.set(key, [lead]);
    }

    // El nombre del vendedor está denormalizado en el lead; si falta, se resuelve
    // contra salespeople_users.
    const ids = Array.from(porVendedor.keys()).filter((k) => k !== 'sin_vendedor');
    const nombres = new Map<string, string>();
    if (ids.length > 0) {
      const filas = await db.select({ id: salespeopleUsers.id, nombre: salespeopleUsers.salespersonName })
        .from(salespeopleUsers)
        .where(inArray(salespeopleUsers.id, ids));
      for (const f of filas) nombres.set(f.id, f.nombre || '');
    }

    const items = Array.from(porVendedor.entries())
      .map(([vendedorId, propios]) => ({
        vendedorId: vendedorId === 'sin_vendedor' ? null : vendedorId,
        vendedorNombre: propios[0]?.vendedorNombre || nombres.get(vendedorId) || null,
        ...resumirPipeline(propios),
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      filtros: { segmento: segmento ?? null },
      vendedores: items.length,
      ...resumirPipeline(leads),
      items,
    });
  } catch (error) {
    console.error('Error fetching seguimiento por vendedor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /crm/seguimiento — List tracked clients (enriched with ERP data)
router.get('/crm/seguimiento', async (req: ApiAuthRequest, res) => {
  try {
    const { vendedor, estado, prioridad, busqueda, segmento } = req.query;
    const lim = parseLimit(req.query.limit, 100);
    const off = parseOffset(req.query.offset);

    const conditions: any[] = [eq(crmSeguimientoClientes.active, true)];
    if (vendedor) conditions.push(eq(crmSeguimientoClientes.vendedorId, vendedor as string));
    if (estado) conditions.push(eq(crmSeguimientoClientes.estado, normalizeEstadoCrm(estado as string)));
    if (prioridad) conditions.push(eq(crmSeguimientoClientes.prioridad, prioridad as string));
    // El segmento es texto libre y conviven variantes ("Ferretería" del CRM vs
    // "FERRETERIAS" del ERP), así que se compara sin acentos ni mayúsculas y
    // cayendo al segmento del cliente vinculado cuando el CRM no lo tiene.
    if (segmento) {
      const seg = segmentoRaiz(segmento as string);
      conditions.push(or(
        accentInsensitiveContains(crmSeguimientoClientes.segmento, seg),
        accentInsensitiveContains(
          sql`(SELECT nokoru FROM ventas.stg_tabru WHERE koru = ${clients.ruen} LIMIT 1)`,
          seg,
        ),
      )!);
    }
    if (busqueda) {
      const search = `%${busqueda}%`;
      conditions.push(or(
        ilike(crmSeguimientoClientes.nombre, search),
        ilike(crmSeguimientoClientes.empresa, search),
        ilike(crmSeguimientoClientes.rut, search),
        ilike(crmSeguimientoClientes.email, search),
      )!);
    }

    const results = await db.select({
        ...getTableColumns(crmSeguimientoClientes),
        ciudad: clients.cmen,
        ultimaCompraDate: clients.feultr,
        linkedComuna: clients.comuna,
        linkedProvincia: clients.provincia,
        linkedCpen: clients.cpen,
        linkedFoen: clients.foen,
        linkedRuen: clients.ruen,
        linkedSegmento: sql<string>`(SELECT nokoru FROM ventas.stg_tabru WHERE koru = ${clients.ruen} LIMIT 1)`.as('linked_segmento'),
      })
      .from(crmSeguimientoClientes)
      .leftJoin(clients, eq(crmSeguimientoClientes.clienteId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(crmSeguimientoClientes.updatedAt))
      .limit(lim)
      .offset(off);

    res.json(results.map((r) => ({ ...r, ...ubicacionCanonicaDe(r) })));
  } catch (error) {
    console.error('Error listing seguimiento:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /crm/seguimiento/:id — Detail with milestones
router.get('/crm/seguimiento/:id', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const [cliente] = await db.select({
        ...getTableColumns(crmSeguimientoClientes),
        ciudad: clients.cmen,
        linkedComuna: clients.comuna,
        linkedProvincia: clients.provincia,
        linkedCpen: clients.cpen,
        linkedFoen: clients.foen,
        linkedRuen: clients.ruen,
        linkedNokoen: clients.nokoen,
      })
      .from(crmSeguimientoClientes)
      .leftJoin(clients, eq(crmSeguimientoClientes.clienteId, clients.id))
      .where(eq(crmSeguimientoClientes.id, id))
      .limit(1);

    if (!cliente) return res.status(404).json({ error: 'Not found' });

    const hitos = await db.select()
      .from(crmSeguimientoHitos)
      .where(eq(crmSeguimientoHitos.seguimientoId, id))
      .orderBy(desc(crmSeguimientoHitos.createdAt));

    res.json({ ...cliente, ...ubicacionCanonicaDe(cliente), hitos });
  } catch (error) {
    console.error('Error fetching seguimiento detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /crm/seguimiento — Create tracked client
router.post('/crm/seguimiento', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const body = req.body || {};

    if (!body.nombre) return res.status(400).json({ error: 'nombre is required' });
    if (!body.vendedorId) return res.status(400).json({ error: 'vendedorId is required' });

    // Resolve vendedor to denormalize the name (matches internal POST behavior)
    const [vendedor] = await db.select().from(salespeopleUsers)
      .where(eq(salespeopleUsers.id, body.vendedorId)).limit(1);
    if (!vendedor) return res.status(400).json({ error: 'vendedorId not found in salespeople_users' });

    // If RUT provided, try to link to ERP client
    let clienteId: string | null = null;
    if (body.rut) {
      const [existingClient] = await db.select().from(clients)
        .where(eq(clients.rten, body.rut)).limit(1);
      if (existingClient) clienteId = existingClient.id;
    }

    const [created] = await db.insert(crmSeguimientoClientes).values({
      nombre: body.nombre,
      telefono: body.telefono || null,
      email: body.email || null,
      empresa: body.empresa || null,
      rut: body.rut || null,
      vendedorId: vendedor.id,
      vendedorNombre: vendedor.salespersonName,
      estado: body.estado ? normalizeEstadoCrm(body.estado) : 'prospecto',
      prioridad: body.prioridad || 'media',
      notas: body.notas || null,
      proximoContacto: body.proximoContacto ? new Date(body.proximoContacto) : null,
      montoEstimado: body.montoEstimado != null ? String(body.montoEstimado) : null,
      origen: body.origen || 'manual',
      region: body.region || null,
      comuna: body.comuna || null,
      contactoEncargado: body.contactoEncargado || null,
      segmento: body.segmento || null,
      condicionPago: body.condicionPago || null,
      destacado: body.destacado === true,
      clienteId,
      ultimoContacto: new Date(),
    }).returning();

    // Initial milestone — same convention as the internal endpoint
    const autorNombre = apiAuthorFromKey(req, body.autor);
    await db.insert(crmSeguimientoHitos).values({
      seguimientoId: created.id,
      tipo: 'nota',
      descripcion: `Cliente creado vía API. ${body.notas ? 'Nota: ' + body.notas : ''}`.trim(),
      autorId: 'api',
      autorNombre,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating seguimiento:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /crm/seguimiento/:id — Update tracked client
router.patch('/crm/seguimiento/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const updateData: any = { updatedAt: new Date() };
    for (const field of SEGUIMIENTO_ALLOWED_FIELDS) {
      if (req.body?.[field] !== undefined) {
        if (field === 'proximoContacto' && req.body[field]) {
          updateData[field] = new Date(req.body[field]);
        } else if (field === 'montoEstimado' && req.body[field] != null) {
          updateData[field] = String(req.body[field]);
        } else if (field === 'estado' && req.body[field]) {
          updateData[field] = normalizeEstadoCrm(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    // Vendedor reassignment — resolve and denormalize the name + log a milestone
    if (req.body?.vendedorId && req.body.vendedorId !== existing.vendedorId) {
      const [newVendedor] = await db.select().from(salespeopleUsers)
        .where(eq(salespeopleUsers.id, req.body.vendedorId)).limit(1);
      if (!newVendedor) return res.status(400).json({ error: 'vendedorId not found in salespeople_users' });

      updateData.vendedorId = newVendedor.id;
      updateData.vendedorNombre = newVendedor.salespersonName;

      await db.insert(crmSeguimientoHitos).values({
        seguimientoId: id,
        tipo: 'sistema',
        descripcion: `Vendedor reasignado de "${existing.vendedorNombre}" a "${newVendedor.salespersonName}"`,
        autorId: 'api',
        autorNombre: apiAuthorFromKey(req),
      });
    }

    // Log estado change as a system milestone
    if (req.body?.estado && req.body.estado !== existing.estado) {
      await db.insert(crmSeguimientoHitos).values({
        seguimientoId: id,
        tipo: 'sistema',
        descripcion: `Estado cambiado de "${existing.estado}" a "${req.body.estado}"`,
        autorId: 'api',
        autorNombre: apiAuthorFromKey(req),
      });
    }

    const [updated] = await db.update(crmSeguimientoClientes)
      .set(updateData)
      .where(eq(crmSeguimientoClientes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating seguimiento:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /crm/seguimiento/:id — Soft delete (active=false)
router.delete('/crm/seguimiento/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await db.update(crmSeguimientoClientes)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(crmSeguimientoClientes.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting seguimiento:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /crm/seguimiento/:id/hito — Add timeline milestone
router.post('/crm/seguimiento/:id/hito', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { tipo, descripcion, documentoTipo, documentoNumero, autor } = req.body || {};
    if (!tipo || !descripcion) {
      return res.status(400).json({ error: 'tipo and descripcion are required' });
    }

    const [hito] = await db.insert(crmSeguimientoHitos).values({
      seguimientoId: id,
      tipo,
      descripcion,
      autorId: 'api',
      autorNombre: apiAuthorFromKey(req, autor),
      documentoTipo: documentoTipo || null,
      documentoNumero: documentoNumero || null,
      autoDetectado: false,
    }).returning();

    // Match internal logic: refresh ultimoContacto for outbound interaction types
    const contactTypes = ['contacto', 'llamada', 'whatsapp', 'cotizacion', 'visita', 'venta'];
    if (contactTypes.includes(tipo)) {
      await db.update(crmSeguimientoClientes)
        .set({ ultimoContacto: new Date(), updatedAt: new Date() })
        .where(eq(crmSeguimientoClientes.id, id));
    }

    res.status(201).json(hito);
  } catch (error) {
    console.error('Error adding seguimiento hito:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /crm/seguimiento/:id/bitacora — List bitácora entries for a CRM client
router.get('/crm/seguimiento/:id/bitacora', requireApiRole(['readonly', 'read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const limit = parseLimit(req.query.limit, 100, 500);

    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const entries = await db.select().from(pedidoBitacora)
      .where(and(
        eq(pedidoBitacora.documentoTipo, 'cliente'),
        or(
          eq(pedidoBitacora.documentoId, id),
          existing.clienteId ? eq(pedidoBitacora.documentoId, existing.clienteId) : sql`false`,
        )!,
      ))
      .orderBy(desc(pedidoBitacora.createdAt))
      .limit(limit);

    res.json(entries);
  } catch (error) {
    console.error('Error listing cliente bitacora:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /crm/seguimiento/:id/bitacora — Add bitácora entry to a CRM client
router.post('/crm/seguimiento/:id/bitacora', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nota, tipo, autor } = req.body || {};
    if (!nota) return res.status(400).json({ error: 'nota is required' });

    const validTipos = ['nota', 'llamada', 'visita', 'seguimiento', 'problema'];
    const tipoFinal = tipo && validTipos.includes(tipo) ? tipo : 'nota';

    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const [entry] = await db.insert(pedidoBitacora).values({
      documentoTipo: 'cliente',
      documentoId: existing.clienteId || id,
      documentoNumero: existing.rut || null,
      clienteNombre: existing.nombre || null,
      clienteRut: existing.rut || null,
      nota,
      tipo: tipoFinal,
      autorId: 'api',
      autorNombre: apiAuthorFromKey(req, autor),
    }).returning();

    // Refresh ultimoContacto except for "problema" entries (informational only)
    if (tipoFinal !== 'problema') {
      await db.update(crmSeguimientoClientes)
        .set({ ultimoContacto: new Date(), updatedAt: new Date() })
        .where(eq(crmSeguimientoClientes.id, id));
    }

    res.status(201).json(entry);
  } catch (error) {
    console.error('Error adding cliente bitacora:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /crm/seguimiento/:id/bitacora/:entryId — Delete a bitácora entry
router.delete('/crm/seguimiento/:id/bitacora/:entryId', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id, entryId } = req.params;
    const [entry] = await db.select().from(pedidoBitacora)
      .where(eq(pedidoBitacora.id, entryId)).limit(1);
    if (!entry || entry.documentoTipo !== 'cliente' || entry.documentoId !== id) {
      return res.status(404).json({ error: 'Not found' });
    }
    await db.delete(pedidoBitacora).where(eq(pedidoBitacora.id, entryId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting cliente bitacora:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /crm/seguimiento/:id/vincular-rut — Link RUT to ERP client
router.post('/crm/seguimiento/:id/vincular-rut', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { rut } = req.body || {};
    if (!rut) return res.status(400).json({ error: 'rut is required' });

    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const [linkedClient] = await db.select().from(clients)
      .where(eq(clients.rten, rut)).limit(1);

    const updateData: any = { rut, updatedAt: new Date() };
    if (linkedClient) updateData.clienteId = linkedClient.id;

    const [updated] = await db.update(crmSeguimientoClientes)
      .set(updateData)
      .where(eq(crmSeguimientoClientes.id, id))
      .returning();

    await db.insert(crmSeguimientoHitos).values({
      seguimientoId: id,
      tipo: 'sistema',
      descripcion: linkedClient
        ? `RUT ${rut} vinculado. Cliente encontrado: ${linkedClient.nokoen || 'Sin nombre'}`
        : `RUT ${rut} asociado. No se encontró cliente en la base de datos de ventas.`,
      autorId: 'api',
      autorNombre: apiAuthorFromKey(req),
      autoDetectado: false,
    });

    res.json({ ...updated, clienteVinculado: linkedClient || null });
  } catch (error) {
    console.error('Error linking RUT:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /crm/seguimiento/:id/detectar-compras — Discover recent purchases for the linked RUT
router.get('/crm/seguimiento/:id/detectar-compras', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);

    if (!existing || !existing.rut) return res.json({ compras: [], message: 'Sin RUT asociado' });

    const [linkedClient] = await db.select().from(clients)
      .where(eq(clients.rten, existing.rut)).limit(1);
    if (!linkedClient) return res.json({ compras: [], message: 'Cliente no encontrado en base de datos de ventas' });

    const recentSales = await db.select({
      id: salesTransactions.id,
      nudo: salesTransactions.nudo,
      feemdo: salesTransactions.feemdo,
      tido: salesTransactions.tido,
      nokoprct: salesTransactions.nokoprct,
      nokoen: salesTransactions.nokoen,
      vanedo: salesTransactions.vanedo,
      eslido: salesTransactions.eslido,
    })
      .from(salesTransactions)
      .where(eq(salesTransactions.nokoen, linkedClient.nokoen!))
      .orderBy(desc(salesTransactions.feemdo))
      .limit(20);

    // Auto-create one milestone per new document (mirrors the internal endpoint)
    const existingAutoHitos = await db.select().from(crmSeguimientoHitos)
      .where(and(
        eq(crmSeguimientoHitos.seguimientoId, id),
        eq(crmSeguimientoHitos.autoDetectado, true),
      ));
    const existingDocNumbers = new Set(existingAutoHitos.map(h => h.documentoNumero).filter(Boolean));

    let newHitosCreated = 0;
    for (const sale of recentSales) {
      if (sale.nudo && !existingDocNumbers.has(sale.nudo)) {
        const docTipo = sale.tido || 'factura';
        await db.insert(crmSeguimientoHitos).values({
          seguimientoId: id,
          tipo: 'sistema',
          descripcion: `Documento detectado: ${docTipo} #${sale.nudo} — ${sale.nokoprct || 'Sin producto'} — $${sale.vanedo || '0'}`,
          autorId: 'sistema',
          autorNombre: 'Sistema Automático',
          documentoTipo: docTipo,
          documentoNumero: sale.nudo,
          autoDetectado: true,
        });
        newHitosCreated++;
        existingDocNumbers.add(sale.nudo);
      }
    }

    if (newHitosCreated > 0 && existing.estado === 'nuevo') {
      await db.update(crmSeguimientoClientes)
        .set({ estado: 'contactado', updatedAt: new Date() })
        .where(eq(crmSeguimientoClientes.id, id));
    }

    res.json({ compras: recentSales, nuevosHitosCreados: newHitosCreated, clienteVinculado: linkedClient });
  } catch (error) {
    console.error('Error detecting compras:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /crm/seguimiento/:id/nvv — NVV/GDV pendientes del cliente vinculado
router.get('/crm/seguimiento/:id/nvv', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(crmSeguimientoClientes)
      .where(eq(crmSeguimientoClientes.id, id)).limit(1);
    if (!existing || !existing.rut) return res.json({ nvvs: [], message: 'Sin RUT asociado' });

    const [linkedClient] = await db.select().from(clients)
      .where(eq(clients.rten, existing.rut)).limit(1);
    if (!linkedClient) return res.json({ nvvs: [], message: 'Cliente no encontrado en base de datos de ventas' });

    const nvvSales = await db.select({
      id: salesTransactions.id,
      nudo: salesTransactions.nudo,
      feemdo: salesTransactions.feemdo,
      tido: salesTransactions.tido,
      nokoprct: salesTransactions.nokoprct,
      nokoen: salesTransactions.nokoen,
      vanedo: salesTransactions.vanedo,
      eslido: salesTransactions.eslido,
      nokofu: salesTransactions.nokofu,
    })
      .from(salesTransactions)
      .where(and(
        eq(salesTransactions.nokoen, linkedClient.nokoen!),
        inArray(salesTransactions.tido, ['NVV', 'GDV']),
        sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '6 months'`,
      ))
      .orderBy(desc(salesTransactions.feemdo))
      .limit(100);

    res.json({ nvvs: nvvSales, clienteVinculado: linkedClient });
  } catch (error) {
    console.error('Error fetching seguimiento NVV:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Productos & Lista de precios (Read)
// Para que un asistente IA pueda buscar productos antes de cotizar.
// ============================================

// GET /productos — búsqueda flat sobre price_list
// Devuelve cada producto con TODOS sus precios (lista, descuentos, mínimo, canal digital, oferta).
router.get('/productos', async (req: ApiAuthRequest, res) => {
  try {
    const { search, unidad, tipoProducto, color, priceList: priceListCode } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const result = await storage.getPriceList({
      search: search as string | undefined,
      unidad: unidad as string | undefined,
      tipoProducto: tipoProducto as string | undefined,
      color: color as string | undefined,
      limit: lim,
      offset: off,
    });

    // Si se pidió una lista custom (LP02+), traer los overrides
    const customList = priceListCode && priceListCode !== 'LP01' ? String(priceListCode).toUpperCase() : null;
    const overrideMap = new Map<string, number>();
    if (customList) {
      const codes = (result.items || []).map((p: any) => p.codigo).filter(Boolean);
      if (codes.length > 0) {
        const overrides = await db
          .select({ codigo: customPriceListItems.codigo, precio: customPriceListItems.precio })
          .from(customPriceListItems)
          .where(and(
            eq(customPriceListItems.listCode, customList),
            sql`UPPER(${customPriceListItems.codigo}) = ANY(ARRAY[${sql.raw(codes.map(c => `'${String(c).toUpperCase().replace(/'/g, "''")}'`).join(','))}])`
          ));
        for (const o of overrides) {
          overrideMap.set(String(o.codigo).toUpperCase(), Number(o.precio));
        }
      }
    }

    const items = (result.items || []).map((p: any) => {
      const override = customList ? overrideMap.get(String(p.codigo).toUpperCase()) : undefined;
      return {
        codigo: p.codigo,
        producto: p.producto,
        unidad: p.unidad,
        // Precios estándar (lista LP01)
        precioLista: Number(p.lista) || 0,
        precioDesc10: Number(p.desc10) || 0,
        precioDesc10_5: Number(p.desc10_5) || 0,
        precioDesc10_5_3: Number(p.desc10_5_3) || 0,
        precioMinimo: Number(p.minimo) || 0,
        precioCanalDigital: Number(p.canalDigital) || 0,
        precioOferta: p.offerPrice ? Number(p.offerPrice) : null,
        // Precio efectivo según la lista pedida (override o lista base)
        listaPrecio: customList ?? 'LP01',
        precioListaCustom: override ?? null,
        precioEfectivo: override ?? Number(p.lista) ?? 0,
        // Costos y utilidad
        costoProduccion: p.costoProduccion ? Number(p.costoProduccion) : null,
        porcentajeUtilidad: p.porcentajeUtilidad ? Number(p.porcentajeUtilidad) : null,
        margenLista: p.costoProduccion && p.lista ? Number(((Number(p.lista) - Number(p.costoProduccion)) / Number(p.lista) * 100).toFixed(2)) : null,
        // Otros
        esPersonalizado: p.esPersonalizado === 'Si',
        modoPrecio: p.modoPrecio,
        cantidadProducto: p.cantidadProducto ? Number(p.cantidadProducto) : null,
        unidadMedida: p.unidadMedida,
        rendimiento: p.rendimiento ? Number(p.rendimiento) : null,
      };
    });

    res.json({
      total: result.totalCount ?? items.length,
      offset: off,
      limit: lim,
      priceList: customList ?? 'LP01',
      items,
    });
  } catch (error) {
    console.error('Error fetching productos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /productos/grupos — productos agrupados como en la tienda
// Cada grupo (ej: "Esmalte al agua") tiene N variaciones (colores/formatos), cada una con su código y precio.
// Permite que Claude responda "qué colores hay de Esmalte al agua y cuánto cuestan".
router.get('/productos/grupos', async (req: ApiAuthRequest, res) => {
  try {
    const { search, categoria, soloActivos } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const allGroups = await storage.getProductGroupsWithVariations();

    let filtered = allGroups;
    if (categoria) {
      const cat = (categoria as string).toLowerCase();
      filtered = filtered.filter(g => (g.categoria || '').toLowerCase().includes(cat));
    }
    if (search) {
      const s = (search as string).toLowerCase();
      filtered = filtered.filter(g =>
        g.nombre.toLowerCase().includes(s) ||
        (g.descripcion || '').toLowerCase().includes(s) ||
        g.variations.some(v =>
          v.codigo.toLowerCase().includes(s) ||
          v.producto.toLowerCase().includes(s) ||
          (v.color || '').toLowerCase().includes(s)
        )
      );
    }
    if (soloActivos !== 'false') {
      filtered = filtered
        .filter(g => g.activo)
        .map(g => ({ ...g, variations: g.variations.filter(v => v.activo) }))
        .filter(g => g.variations.length > 0);
    }

    res.json({
      total: filtered.length,
      offset: off,
      limit: lim,
      groups: filtered.slice(off, off + lim),
    });
  } catch (error) {
    console.error('Error fetching grupos de productos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /productos/:codigo — detalle por código exacto + stock por bodega
router.get('/productos/:codigo', async (req: ApiAuthRequest, res) => {
  try {
    const { codigo } = req.params;

    // 1) Buscar en price_list por código
    const priceListResult = await storage.getPriceList({ search: codigo, limit: 5 });
    const product = (priceListResult.items || []).find((p: any) => p.codigo === codigo);

    if (!product) {
      return res.status(404).json({ error: `Producto '${codigo}' no encontrado` });
    }

    // 2) Stock por bodega
    let stock: any[] = [];
    try {
      const stockRows = await storage.getProductStock(codigo);
      stock = stockRows.map((s: any) => ({
        warehouseCode: s.warehouseCode,
        branchCode: s.branchCode,
        warehouseLocation: s.warehouseLocation,
        physicalStock: Number(s.physicalStock1) || 0,
        availableStock: Number(s.availableStock1) || 0,
        committedStock: Number(s.committedStock1) || 0,
        lastUpdated: s.lastUpdated,
      }));
    } catch (e) {
      console.error('Error fetching stock for product:', e);
    }

    const totalAvailable = stock.reduce((sum, s) => sum + s.availableStock, 0);

    // Buscar precios en TODAS las listas custom (LP02, LP03, ...)
    const customPrices = await db
      .select({ listCode: customPriceListItems.listCode, precio: customPriceListItems.precio })
      .from(customPriceListItems)
      .where(sql`UPPER(${customPriceListItems.codigo}) = UPPER(${codigo})`);

    res.json({
      codigo: product.codigo,
      producto: product.producto,
      unidad: product.unidad,
      precios: {
        lista: Number(product.lista) || 0,
        desc10: Number(product.desc10) || 0,
        desc10_5: Number(product.desc10_5) || 0,
        desc10_5_3: Number(product.desc10_5_3) || 0,
        minimo: Number(product.minimo) || 0,
        canalDigital: Number(product.canalDigital) || 0,
        oferta: product.offerPrice ? Number(product.offerPrice) : null,
      },
      preciosPorLista: {
        LP01: Number(product.lista) || 0,
        ...Object.fromEntries(customPrices.map(p => [p.listCode, Number(p.precio)])),
      },
      costos: {
        costoProduccion: product.costoProduccion ? Number(product.costoProduccion) : null,
        porcentajeUtilidad: product.porcentajeUtilidad ? Number(product.porcentajeUtilidad) : null,
        margenLista: product.costoProduccion && product.lista
          ? Number(((Number(product.lista) - Number(product.costoProduccion)) / Number(product.lista) * 100).toFixed(2))
          : null,
        margenMinimo: product.costoProduccion && product.minimo
          ? Number(((Number(product.minimo) - Number(product.costoProduccion)) / Number(product.minimo) * 100).toFixed(2))
          : null,
      },
      esPersonalizado: product.esPersonalizado === 'Si',
      modoPrecio: product.modoPrecio,
      cantidadProducto: product.cantidadProducto ? Number(product.cantidadProducto) : null,
      unidadMedida: product.unidadMedida,
      rendimiento: product.rendimiento ? Number(product.rendimiento) : null,
      stockTotal: totalAvailable,
      stockPorBodega: stock,
    });
  } catch (error) {
    console.error('Error fetching producto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Listas de precios (Read)
// LP01 es la lista base (tabla price_list). LP02+ son listas custom
// que sobrescriben precios por SKU (ej: "Lista Mix", "Lista MCT").
// ============================================

router.get('/listas-precio', async (_req: ApiAuthRequest, res) => {
  try {
    const customLists = await db
      .select()
      .from(customPriceLists)
      .orderBy(customPriceLists.code);

    // Contar items por cada lista custom
    const itemCounts = await db
      .select({
        listCode: customPriceListItems.listCode,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(customPriceListItems)
      .groupBy(customPriceListItems.listCode);

    const countMap = new Map(itemCounts.map(c => [c.listCode, Number(c.count)]));

    res.json({
      lists: [
        {
          code: 'LP01',
          name: 'Lista Base',
          description: 'Lista de precios estándar (tabla price_list con todos los tiers de descuento)',
          active: true,
          isBase: true,
          itemCount: null,
        },
        ...customLists.map(l => ({
          code: l.code,
          name: l.name,
          description: `Lista custom — overrides de precio sobre LP01`,
          active: l.active ?? true,
          isBase: false,
          itemCount: countMap.get(l.code) ?? 0,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        })),
      ],
    });
  } catch (error) {
    console.error('Error fetching listas-precio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /listas-precio/:code/productos — productos con precios de una lista específica
router.get('/listas-precio/:code/productos', async (req: ApiAuthRequest, res) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const { search } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    if (code === 'LP01') {
      // Para LP01 simplemente devolvemos los items de price_list normalmente
      const result = await storage.getPriceList({
        search: search as string | undefined,
        limit: lim, offset: off,
      });
      return res.json({
        listCode: code,
        total: result.totalCount ?? result.items?.length ?? 0,
        items: (result.items || []).map((p: any) => ({
          codigo: p.codigo,
          producto: p.producto,
          unidad: p.unidad,
          precio: Number(p.lista) || 0,
          costoProduccion: p.costoProduccion ? Number(p.costoProduccion) : null,
        })),
      });
    }

    // Verificar que la lista exista
    const [list] = await db.select().from(customPriceLists).where(eq(customPriceLists.code, code)).limit(1);
    if (!list) return res.status(404).json({ error: `Lista '${code}' no encontrada` });

    // Items de la lista custom (precios sobrescritos)
    const conditions = [eq(customPriceListItems.listCode, code)];
    if (search) {
      const s = `%${String(search).toUpperCase()}%`;
      conditions.push(sql`(UPPER(${customPriceListItems.codigo}) LIKE ${s} OR UPPER(${priceListTable.producto}) LIKE ${s})`);
    }

    const rows = await db
      .select({
        codigo: customPriceListItems.codigo,
        precio: customPriceListItems.precio,
        producto: priceListTable.producto,
        unidad: priceListTable.unidad,
        precioBase: priceListTable.lista,
        costoProduccion: priceListTable.costoProduccion,
      })
      .from(customPriceListItems)
      .leftJoin(priceListTable, sql`UPPER(${customPriceListItems.codigo}) = UPPER(${priceListTable.codigo})`)
      .where(and(...conditions))
      .orderBy(customPriceListItems.codigo)
      .limit(lim)
      .offset(off);

    res.json({
      listCode: code,
      listName: list.name,
      total: rows.length,
      items: rows.map(r => ({
        codigo: r.codigo,
        producto: r.producto,
        unidad: r.unidad,
        precio: Number(r.precio),
        precioBase: r.precioBase ? Number(r.precioBase) : null,
        diferenciaVsBase: r.precioBase ? Number((Number(r.precio) - Number(r.precioBase)).toFixed(2)) : null,
        costoProduccion: r.costoProduccion ? Number(r.costoProduccion) : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching productos por lista:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Cotizaciones / Presupuestos (Read & Write)
// Same data the "tomador de pedidos" uses (quotes + quote_items).
// ============================================

// Resolve a salesperson name to a users.id (FK quotes.createdBy expects).
// Tries salespeople_users.salespersonName, then full name in users (firstName + lastName),
// then exact email match. Returns { id, displayName } or null.
async function resolveSalesperson(name: string): Promise<{ id: string; displayName: string } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // 1) salespeople_users by salespersonName (case-insensitive)
  const [sp] = await db
    .select({ id: salespeopleUsers.id, name: salespeopleUsers.salespersonName, email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(sql`LOWER(${salespeopleUsers.salespersonName}) = LOWER(${trimmed})`)
    .limit(1);
  if (sp) {
    // Prefer the matching users row (so quotes.createdBy → users.id) when available
    if (sp.email) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, sp.email)).limit(1);
      if (u) return { id: u.id, displayName: sp.name };
    }
    return { id: sp.id, displayName: sp.name };
  }

  // 2) users by full name "First Last"
  const [u2] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(sql`LOWER(TRIM(COALESCE(${users.firstName},'') || ' ' || COALESCE(${users.lastName},''))) = LOWER(${trimmed})`)
    .limit(1);
  if (u2) {
    const display = [u2.firstName, u2.lastName].filter(Boolean).join(' ') || u2.email || trimmed;
    return { id: u2.id, displayName: display };
  }

  // 3) users by exact email
  const [u3] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, trimmed)).limit(1);
  if (u3) return { id: u3.id, displayName: u3.email || trimmed };

  return null;
}

// GET /cotizaciones — list with rich filters and resolved creator name
router.get('/cotizaciones', async (req: ApiAuthRequest, res) => {
  try {
    const { status, createdBy, salespersonName, clientName, dateFrom, dateTo } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    let createdById = createdBy as string | undefined;
    if (!createdById && salespersonName) {
      const resolved = await resolveSalesperson(salespersonName as string);
      if (!resolved) return res.status(404).json({ error: `Vendedor '${salespersonName}' no encontrado` });
      createdById = resolved.id;
    }

    const result = await storage.getQuotes({
      status: status as string | undefined,
      createdBy: createdById,
      clientName: clientName as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      limit: lim,
      offset: off,
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching cotizaciones:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cotizaciones/:id — full quote with items
router.get('/cotizaciones/:id', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const quote = await storage.getQuoteById(id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    const items = await storage.getQuoteItems(id);
    res.json({ ...quote, items });
  } catch (error) {
    console.error('Error fetching cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cotizaciones — create quote header (items added separately)
router.post('/cotizaciones', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { salespersonName, items, ...body } = req.body ?? {};

    if (!body.clientName) {
      return res.status(400).json({ error: 'clientName es requerido' });
    }
    if (!salespersonName) {
      return res.status(400).json({ error: 'salespersonName es requerido' });
    }

    const resolved = await resolveSalesperson(salespersonName);
    if (!resolved) {
      return res.status(404).json({ error: `Vendedor '${salespersonName}' no encontrado` });
    }

    const quote = await storage.createQuote({
      ...body,
      createdBy: resolved.id,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    } as any);

    // Optional: create items in the same call
    const createdItems = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const newItem = await storage.addQuoteItem(quote.id, item);
        createdItems.push(newItem);
      }
    }

    res.status(201).json({
      ...quote,
      salespersonName: resolved.displayName,
      items: createdItems,
    });
  } catch (error) {
    console.error('Error creating cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cotizaciones/:id — update header fields
router.patch('/cotizaciones/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { salespersonName, ...updates } = req.body ?? {};

    const patch: any = { ...updates };
    if (updates.validUntil) patch.validUntil = new Date(updates.validUntil);

    if (salespersonName) {
      const resolved = await resolveSalesperson(salespersonName);
      if (!resolved) return res.status(404).json({ error: `Vendedor '${salespersonName}' no encontrado` });
      patch.createdBy = resolved.id;
    }

    const updated = await storage.updateQuote(id, patch);
    if (!updated) return res.status(404).json({ error: 'Cotización no encontrada' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cotizaciones/:id/status — change status only
router.patch('/cotizaciones/:id/status', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};
    const allowed = ['draft', 'sent', 'accepted', 'rejected', 'converted'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status inválido (válidos: ${allowed.join(', ')})` });
    }

    const updated = await storage.updateQuote(id, { status });
    if (!updated) return res.status(404).json({ error: 'Cotización no encontrada' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating cotización status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /cotizaciones/:id
router.delete('/cotizaciones/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteQuote(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cotizaciones/:id/pdf — devuelve PDF binario por defecto (?format=html para HTML).
// El render usa el template compartido en shared/quote-pdf-template.ts → 1:1 con el tomador.
router.get('/cotizaciones/:id/pdf', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as string) || 'pdf';

    const quote: any = await storage.getQuoteById(id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    const items = await storage.getQuoteItems(id);

    const proto = (req.headers['x-forwarded-proto'] as string) || (req.protocol || 'https');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'ai.pinturaspanoramica.cl';
    const logoUrl = `${proto}://${host}/panoramica-logo.png`;

    if (format === 'html') {
      const html = renderQuoteHtml(quote, items, { logoUrl, autoPrint: false });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const pdfBuffer = await renderQuotePdf(quote, items, logoUrl);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Cotizacion_${quote.quoteNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating quote PDF:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to generate quote PDF', detail: msg });
  }
});

// GET /cotizaciones/:id/pdf-url — devuelve una URL pública firmada (1h)
// que abre el PDF directamente en el navegador, sin necesitar API key.
router.get('/cotizaciones/:id/pdf-url', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;

    const quote: any = await storage.getQuoteById(id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    const ttlMinutes = Math.min(Math.max(parseInt(String(req.query.ttlMinutes ?? '60'), 10) || 60, 5), 24 * 60);
    const token = signPdfToken(id, ttlMinutes * 60 * 1000);

    const proto = (req.headers['x-forwarded-proto'] as string) || (req.protocol || 'https');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'ai.pinturaspanoramica.cl';
    const url = `${proto}://${host}/api/public/quote-pdf?token=${encodeURIComponent(token)}`;

    res.json({
      url,
      quoteId: id,
      quoteNumber: quote.quoteNumber,
      filename: `Cotizacion_${quote.quoteNumber}.pdf`,
      expiresInMinutes: ttlMinutes,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error signing PDF URL:', error);
    res.status(500).json({ error: 'Failed to sign PDF URL' });
  }
});

// GET /cotizaciones/:id/items
router.get('/cotizaciones/:id/items', async (req: ApiAuthRequest, res) => {
  try {
    const items = await storage.getQuoteItems(req.params.id);
    res.json(items);
  } catch (error) {
    console.error('Error fetching quote items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cotizaciones/:id/items — add a single item
router.post('/cotizaciones/:id/items', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const item = req.body ?? {};

    if (!item.productName || item.quantity === undefined || item.unitPrice === undefined) {
      return res.status(400).json({ error: 'productName, quantity y unitPrice son requeridos' });
    }
    if (!item.type) item.type = item.productCode ? 'standard' : 'custom';

    const newItem = await storage.addQuoteItem(id, item);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding quote item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cotizaciones/items/:itemId — update item
router.patch('/cotizaciones/items/:itemId', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const updated = await storage.updateQuoteItem(req.params.itemId, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating quote item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /cotizaciones/items/:itemId
router.delete('/cotizaciones/items/:itemId', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteQuoteItem(req.params.itemId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Dashboard de Ventas (Read) - Datos Agregados
// ============================================

router.get('/dashboard', async (req: ApiAuthRequest, res) => {
  try {
    const { 
      period, 
      filterType = 'month',
      segment,
      salesperson,
      client
    } = req.query;

    // Support formats: YYYY (year), YYYY-MM (month), YYYY-MM-DD (day)
    const periodStr = period as string || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    
    // Auto-detect filterType based on period format if not explicitly set
    let filterTypeStr = filterType as 'month' | 'year' | 'day';
    if (!req.query.filterType) {
      if (/^\d{4}$/.test(periodStr)) {
        filterTypeStr = 'year';
      } else if (/^\d{4}-\d{2}$/.test(periodStr)) {
        filterTypeStr = 'month';
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(periodStr)) {
        filterTypeStr = 'day';
      }
    }

    // Calculate date range based on period and filterType
    let startDate: string;
    let endDate: string;
    let targetYear: string;

    if (filterTypeStr === 'year') {
      // Accept both "2025" and "2025-01" formats for year
      targetYear = periodStr.split('-')[0];
      startDate = `${targetYear}-01-01`;
      endDate = `${targetYear}-12-31`;
    } else if (filterTypeStr === 'month') {
      const [year, month] = periodStr.split('-');
      targetYear = year;
      startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // day
      targetYear = periodStr.split('-')[0];
      startDate = periodStr;
      endDate = periodStr;
    }

    // 1. Ventas Totales del período (usando startDate y endDate calculados)
    const salesMetrics = await storage.getSalesMetrics({
      startDate,
      endDate,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      client: client as string | undefined,
    });

    // 2. Total Acumulado del Año (full year for target year)
    const yearStartDate = `${targetYear}-01-01`;
    const yearEndDate = `${targetYear}-12-31`;
    const yearMetrics = await storage.getSalesMetrics({
      startDate: yearStartDate,
      endDate: yearEndDate,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      client: client as string | undefined,
    });

    // 3. Meta Global del período (si es mes)
    let globalGoal = null;
    if (filterTypeStr === 'month') {
      try {
        const goals = await storage.getGoalsProgress(periodStr);
        const globalGoalData = goals.find(g => g.type === 'global');
        if (globalGoalData) {
          globalGoal = {
            targetAmount: Number(globalGoalData.targetAmount),
            currentSales: Number(globalGoalData.currentSales),
            percentage: globalGoalData.percentage,
            period: globalGoalData.period,
          };
        }
      } catch (e) {
        console.error('Error fetching goals:', e);
      }
    }

    // 4. Ventas por Segmento (with filters applied)
    const segmentsData = await storage.getSegmentAnalysis(
      startDate,
      endDate,
      salesperson as string | undefined,
      segment as string | undefined
    );

    // 5. Tendencia de Ventas (con filtros aplicados)
    let salesTrend: Array<{ date: string; month?: string; sales: number }> = [];
    try {
      if (filterTypeStr === 'year') {
        // Tendencia mensual para el año - garantiza 12 meses
        const trendData = await storage.getSalesChartData(
          'monthly',
          startDate,
          endDate,
          salesperson as string | undefined,
          segment as string | undefined,
          client as string | undefined
        );
        
        // Create a map of existing data
        const dataMap = new Map(trendData.map(t => [t.period, t.sales]));
        
        // Generate all 12 months for the year
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        salesTrend = monthNames.map((monthName, index) => {
          const monthNum = String(index + 1).padStart(2, '0');
          const periodKey = `${targetYear}-${monthNum}`;
          return {
            date: periodKey,
            month: monthName,
            sales: dataMap.get(periodKey) || 0,
          };
        });
      } else {
        // Tendencia diaria para el mes
        const trendData = await storage.getSalesChartData(
          'daily',
          startDate,
          endDate,
          salesperson as string | undefined,
          segment as string | undefined,
          client as string | undefined
        );
        salesTrend = trendData.map(t => ({
          date: t.period,
          sales: t.sales,
        }));
      }
    } catch (e) {
      console.error('Error fetching sales trend:', e);
    }

    // 6. NVV y GDV pendientes (siempre disponible - son datos en vivo del mes actual)
    let nvvPending = { totalAmount: 0, pendingCount: 0, totalQuantity: 0, confirmedCount: 0 };
    let gdvPending = { gdvSales: 0, gdvCount: 0 };
    
    try {
      nvvPending = await storage.getNvvSummaryMetrics({
        segment: segment as string | undefined,
        salesperson: salesperson as string | undefined,
        client: client as string | undefined,
      });
    } catch (e) {
      console.error('Error fetching NVV metrics:', e);
    }

    try {
      gdvPending = await storage.getGdvPendingGlobal({
        segment: segment as string | undefined,
        salesperson: salesperson as string | undefined,
        client: client as string | undefined,
      });
    } catch (e) {
      console.error('Error fetching GDV metrics:', e);
    }

    // Respuesta consolidada
    res.json({
      period: periodStr,
      year: parseInt(targetYear),
      filterType: filterTypeStr,
      dateRange: {
        startDate,
        endDate,
      },
      filters: {
        segment: segment || null,
        salesperson: salesperson || null,
        client: client || null,
      },
      // Métricas del período solicitado (ej: solo diciembre si period=2025-12)
      salesTotal: salesMetrics.totalSales,
      unitsSold: salesMetrics.totalUnits,
      // transactionCount: solo ventas facturadas (excluye GDV), alineado con salesTotal
      transactionCount: salesMetrics.salesTransactionCount,
      // transactionCountAll: todas las transacciones incluyendo GDV
      transactionCountAll: salesMetrics.totalTransactions,
      activeCustomers: salesMetrics.activeCustomers,
      // averageTicket: calculado solo sobre ventas facturadas
      averageTicket: salesMetrics.salesTransactionCount > 0 
        ? Math.round(salesMetrics.totalSales / salesMetrics.salesTransactionCount) 
        : 0,
      // Métricas anuales (contexto del año completo)
      yearStats: {
        yearTotal: yearMetrics.totalSales,
        yearUnitsSold: yearMetrics.totalUnits,
        // yearTransactions: solo ventas facturadas del año
        yearTransactions: yearMetrics.salesTransactionCount,
        // yearTransactionsAll: todas las transacciones del año incluyendo GDV
        yearTransactionsAll: yearMetrics.totalTransactions,
        yearActiveCustomers: yearMetrics.activeCustomers,
        note: `Totales acumulados del año ${targetYear} completo (transactionCount excluye GDV, transactionCountAll incluye GDV)`
      },
      globalGoal,
      // Pendientes (datos en vivo, sin filtro de fecha)
      nvvPending: {
        totalAmount: nvvPending.totalAmount,
        count: nvvPending.pendingCount,
        note: 'NVV son Notas de Venta Vigentes pendientes de facturar (datos en vivo)'
      },
      gdvPending: {
        totalAmount: gdvPending.gdvSales,
        count: gdvPending.gdvCount,
        note: 'GDV son Guías de Despacho Vigentes pendientes de facturar (datos en vivo)'
      },
      // Combined = salesTotal (ventas facturadas del período) + NVV pendientes + GDV pendientes
      combinedTotal: salesMetrics.totalSales + nvvPending.totalAmount + gdvPending.gdvSales,
      combinedTotalNote: 'salesTotal (solo ventas facturadas) + nvvPending.totalAmount + gdvPending.totalAmount',
      salesBySegment: segmentsData.map(s => ({
        segment: s.segment,
        totalSales: s.totalSales,
        percentage: s.percentage,
      })),
      salesTrend,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ╔══════════ MÓDULO: PRODUCTOS ══════════╗
// ============================================
// PRODUCTOS — Escrituras (precio, toggle activo)
// ============================================

// Editar precio de lista por SKU  (interna PUT /api/products/:sku/price)
router.patch('/productos/:codigo/precio', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { codigo } = req.params;
    const { price, reason } = req.body;
    const parsed = parseFloat(price);
    if (price === undefined || price === null || Number.isNaN(parsed)) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    const product = await storage.updateProductPrice(codigo, parsed, req.apiKey?.id ?? 'api', reason);
    res.json(product);
  } catch (error) {
    console.error('Error updating product price:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle activo del producto en ecommerce  (interna PATCH /api/ecommerce/products/:kopr/toggle-active)
router.patch('/productos/:codigo/toggle-activo', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const product = await storage.toggleEcommerceActive(req.params.codigo);
    res.json(product);
  } catch (error: any) {
    if (error?.message?.includes('not found')) {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.error('Error toggling ecommerce product active:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// LISTAS DE PRECIO CUSTOM — Items (mix)
// ============================================

// Listar items de una lista custom  (interna GET /api/custom-price-lists/:code/items)
router.get('/listas-precio/:code/items', async (req: ApiAuthRequest, res) => {
  try {
    const { code } = req.params;
    const search = (req.query.search as string | undefined)?.trim();
    const limit = parseLimit(req.query.limit, 500, 10000);
    const offset = parseOffset(req.query.offset);
    const like = search ? `%${search}%` : null;

    const result = await db.execute(sql`
      SELECT cpli.id, cpli.list_code AS "listCode", cpli.codigo, cpli.precio,
             cpli.created_at AS "createdAt", cpli.updated_at AS "updatedAt",
             pl.producto, pl.unidad, pl.costo_produccion AS "costoProduccion"
      FROM custom_price_list_items cpli
      LEFT JOIN price_list pl ON UPPER(cpli.codigo) = UPPER(pl.codigo)
      WHERE cpli.list_code = ${code}
      ${like ? sql`AND (cpli.codigo ILIKE ${like} OR pl.producto ILIKE ${like})` : sql``}
      ORDER BY pl.producto NULLS LAST, cpli.codigo
      LIMIT ${limit} OFFSET ${offset}
    `);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching custom price list items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agregar item a una lista custom  (interna POST /api/custom-price-lists/:code/items)
router.post('/listas-precio/:code/items', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { code } = req.params;
    const parsed = insertCustomPriceListItemSchema.safeParse({ ...req.body, listCode: code });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
    }
    const [item] = await db.insert(customPriceListItems).values(parsed.data).returning();
    res.status(201).json(item);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Este SKU ya existe en esta lista' });
    }
    console.error('Error creating custom price list item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Editar item de una lista custom  (interna PATCH /api/custom-price-lists/:code/items/:id)
router.patch('/listas-precio/:code/items/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { precio } = req.body;
    const [item] = await db.update(customPriceListItems)
      .set({ ...(precio !== undefined ? { precio: String(precio) } : {}), updatedAt: new Date() })
      .where(eq(customPriceListItems.id, req.params.id))
      .returning();
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    console.error('Error updating custom price list item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Eliminar item de una lista custom  (interna DELETE /api/custom-price-lists/:code/items/:id)
router.delete('/listas-precio/:code/items/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await db.delete(customPriceListItems).where(eq(customPriceListItems.id, req.params.id));
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom price list item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ajuste masivo de precios de una lista custom  (interna POST /api/custom-price-lists/:code/items/bulk-adjust)
router.post('/listas-precio/:code/items/bulk-adjust', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { code } = req.params;
    const { percentage, roundToDecena } = req.body;
    if (typeof percentage !== 'number' || (percentage === 0 && !roundToDecena)) {
      return res.status(400).json({ error: 'Porcentaje de ajuste inválido' });
    }
    if (Math.abs(percentage) > 100) {
      return res.status(400).json({ error: 'El porcentaje no puede exceder ±100%' });
    }
    const multiplier = 1 + percentage / 100;
    if (roundToDecena) {
      await db.execute(sql`
        UPDATE custom_price_list_items SET precio = ROUND(precio * ${multiplier}, -1)
        WHERE list_code = ${code} AND precio IS NOT NULL AND precio > 0`);
    } else {
      await db.execute(sql`
        UPDATE custom_price_list_items SET precio = ROUND(precio * ${multiplier}, 0)
        WHERE list_code = ${code} AND precio IS NOT NULL AND precio > 0`);
    }
    res.json({ success: true, message: 'Ajuste masivo aplicado exitosamente' });
  } catch (error) {
    console.error('Error en ajuste masivo de lista custom:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// OFERTAS DE PRECIO POR CLIENTE
// ============================================

// Listar ofertas  (interna GET /api/price-list-offers)
router.get('/ofertas-precio', async (req: ApiAuthRequest, res) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const limit = parseLimit(req.query.limit, 500, 10000);
    const offset = parseOffset(req.query.offset);
    const like = search ? `%${search}%` : null;

    const items = await db.execute(sql`
      SELECT o.id, o.codigo, o.precio, o.paused, o.all_clients AS "allClients",
             o.offer_type AS "offerType", o.units_per_pallet AS "unitsPerPallet",
             o.discount_pct AS "discountPct", o.pallet_price AS "palletPrice",
             o.created_at AS "createdAt", o.updated_at AS "updatedAt",
             pl.producto, pl.unidad, pl.costo_produccion AS "costoProduccion"
      FROM price_list_offers o
      LEFT JOIN price_list pl ON UPPER(o.codigo) = UPPER(pl.codigo)
      ${like ? sql`WHERE (o.codigo ILIKE ${like} OR pl.producto ILIKE ${like})` : sql``}
      ORDER BY pl.producto NULLS LAST, o.codigo
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows = items.rows as any[];
    const offerIds = rows.map((r) => r.id).filter(Boolean);
    const targetsByOffer: Record<string, Array<{ id: string; name: string | null; rut: string | null }>> = {};
    if (offerIds.length > 0) {
      const idList = sql.join(offerIds.map((id) => sql`${id}`), sql`, `);
      const targets = await db.execute(sql`
        SELECT oc.offer_id AS "offerId", c.id AS "clientId", c.nokoen AS "name", c.rten AS "rut"
        FROM price_list_offer_clients oc
        JOIN clients c ON c.id = oc.client_id
        WHERE oc.offer_id IN (${idList})
        ORDER BY c.nokoen`);
      for (const t of targets.rows as any[]) {
        (targetsByOffer[t.offerId] ||= []).push({ id: t.clientId, name: t.name, rut: t.rut });
      }
    }
    res.json({
      items: rows.map((r) => ({
        ...r,
        targetClients: targetsByOffer[r.id] || [],
        clientCount: (targetsByOffer[r.id] || []).length,
      })),
    });
  } catch (error) {
    console.error('Error fetching price list offers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Crear oferta  (interna POST /api/price-list-offers)
router.post('/ofertas-precio', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const parsed = insertPriceListOffersSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
    }
    const validatedData = parsed.data;
    const allClients = validatedData.allClients !== false;
    const clientIds: string[] = Array.isArray(req.body.clientIds)
      ? req.body.clientIds.filter((c: any) => typeof c === 'string' && c.trim())
      : [];
    if (!allClients && clientIds.length === 0) {
      return res.status(400).json({ error: "Selecciona al menos un cliente o marca 'Todos los clientes'" });
    }
    const offerType = validatedData.offerType || 'regular';
    if (offerType === 'pallet') {
      if (!validatedData.unitsPerPallet || validatedData.unitsPerPallet < 1) {
        return res.status(400).json({ error: 'Unidades por pallet es requerido y debe ser >= 1' });
      }
      const hasDiscount = validatedData.discountPct != null;
      const hasPalletPrice = validatedData.palletPrice != null;
      if (!hasDiscount && !hasPalletPrice) return res.status(400).json({ error: 'Debe especificar descuento % o precio fijo del pallet' });
      if (hasDiscount && hasPalletPrice) return res.status(400).json({ error: 'Usa descuento % o precio fijo, no ambos' });
    } else if (offerType === 'regular') {
      if (validatedData.precio == null) return res.status(400).json({ error: 'Precio es requerido para ofertas regulares' });
    }
    const valuesToInsert: any = { ...validatedData, allClients };
    if (validatedData.discountPct != null) valuesToInsert.discountPct = String(validatedData.discountPct);
    if (validatedData.palletPrice != null) valuesToInsert.palletPrice = String(validatedData.palletPrice);
    const [item] = await db.insert(priceListOffers).values(valuesToInsert).returning();
    if (!allClients && clientIds.length > 0) {
      await db.insert(priceListOfferClients).values(clientIds.map((cid) => ({ offerId: item.id, clientId: cid })));
    }
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating price list offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Editar oferta  (interna PATCH /api/price-list-offers/:id)
router.patch('/ofertas-precio/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const updateData: any = { updatedAt: new Date() };
    if (req.body.precio !== undefined) updateData.precio = req.body.precio;
    if (req.body.paused !== undefined) updateData.paused = req.body.paused;
    if (req.body.allClients !== undefined) updateData.allClients = req.body.allClients === true;
    if (req.body.unitsPerPallet !== undefined) {
      const n = Number(req.body.unitsPerPallet);
      if (req.body.unitsPerPallet !== null && (!Number.isInteger(n) || n < 1)) {
        return res.status(400).json({ error: 'unitsPerPallet debe ser entero >= 1' });
      }
      updateData.unitsPerPallet = req.body.unitsPerPallet === null ? null : n;
    }
    if (req.body.discountPct !== undefined) {
      if (req.body.discountPct !== null) {
        const pct = Number(req.body.discountPct);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'discountPct debe estar entre 0 y 100' });
        updateData.discountPct = String(pct);
      } else updateData.discountPct = null;
    }
    if (req.body.palletPrice !== undefined) {
      if (req.body.palletPrice !== null) {
        const pp = Number(req.body.palletPrice);
        if (!Number.isFinite(pp) || pp <= 0) return res.status(400).json({ error: 'palletPrice debe ser > 0' });
        updateData.palletPrice = String(pp);
      } else updateData.palletPrice = null;
    }
    if (req.body.discountPct !== undefined && req.body.palletPrice !== undefined &&
        updateData.discountPct != null && updateData.palletPrice != null) {
      return res.status(400).json({ error: 'Usa descuento % o precio fijo del pallet, no ambos' });
    }
    const clientIdsProvided = Array.isArray(req.body.clientIds);
    const clientIds: string[] = clientIdsProvided ? req.body.clientIds.filter((c: any) => typeof c === 'string' && c.trim()) : [];
    const touchingAudience = req.body.allClients !== undefined || clientIdsProvided;
    if (touchingAudience && updateData.allClients === false && clientIds.length === 0) {
      return res.status(400).json({ error: "Selecciona al menos un cliente o marca 'Todos los clientes'" });
    }
    const [item] = await db.update(priceListOffers).set(updateData).where(eq(priceListOffers.id, req.params.id)).returning();
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (touchingAudience) {
      await db.delete(priceListOfferClients).where(eq(priceListOfferClients.offerId, item.id));
      if (item.allClients === false && clientIds.length > 0) {
        await db.insert(priceListOfferClients).values(clientIds.map((cid) => ({ offerId: item.id, clientId: cid })));
      }
    }
    res.json(item);
  } catch (error) {
    console.error('Error updating price list offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Eliminar oferta  (interna DELETE /api/price-list-offers/:id)
router.delete('/ofertas-precio/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await db.delete(priceListOffers).where(eq(priceListOffers.id, req.params.id));
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting price list offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ajuste masivo de precios de ofertas  (interna POST /api/price-list-offers/bulk-adjust)
router.post('/ofertas-precio/bulk-adjust', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { percentage, roundToDecena } = req.body;
    const allItems = await db.select().from(priceListOffers);
    if (allItems.length === 0) return res.status(400).json({ error: 'No items to adjust' });
    let adjusted = 0;
    for (const item of allItems) {
      let currentPrice = parseFloat(item.precio?.toString() || '0');
      if (currentPrice <= 0) continue;
      if (percentage !== undefined && percentage !== 0) currentPrice = currentPrice * (1 + percentage / 100);
      if (roundToDecena) currentPrice = Math.round(currentPrice / 10) * 10;
      await db.update(priceListOffers).set({ precio: currentPrice.toFixed(2), updatedAt: new Date() }).where(eq(priceListOffers.id, item.id));
      adjusted++;
    }
    res.json({ message: 'Prices adjusted successfully', adjustedCount: adjusted });
  } catch (error) {
    console.error('Error adjusting offers prices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// TINTOMETRÍA — CRUD genérico por entidad + cálculo
// entities: bases | colores | envases | parametros | pigments | recetas
// ============================================

const TINTO_MAP: Record<string, { all: string; one: string; create: string; update: string; del: string }> = {
  pigments:   { all: 'getAllPigments',   one: 'getPigmentById',   create: 'createPigment',   update: 'updatePigment',   del: 'deletePigment' },
  bases:      { all: 'getAllBases',      one: 'getBaseById',      create: 'createBase',      update: 'updateBase',      del: 'deleteBase' },
  envases:    { all: 'getAllEnvases',    one: 'getEnvaseById',    create: 'createEnvase',    update: 'updateEnvase',    del: 'deleteEnvase' },
  colores:    { all: 'getAllColores',    one: 'getColorById',     create: 'createColor',     update: 'updateColor',     del: 'deleteColor' },
  recetas:    { all: 'getAllRecetas',    one: 'getRecetaById',    create: 'createReceta',    update: 'updateReceta',    del: 'deleteReceta' },
  parametros: { all: 'getAllParametros', one: 'getParametroById', create: 'createParametro', update: 'updateParametro', del: 'deleteParametro' },
};

// IMPORTANTE: /tintometria/calculate debe registrarse ANTES de /tintometria/:entity
// para que "calculate" no sea interpretado como una entidad.
router.post('/tintometria/calculate', async (req: ApiAuthRequest, res) => {
  try {
    const { colorId, envaseId } = req.body;
    if (!colorId || !envaseId) return res.status(400).json({ error: 'colorId y envaseId son requeridos' });
    const calculation = await storage.calculateColorCost(colorId, envaseId);
    if (!calculation) return res.status(404).json({ error: 'Color o envase no encontrado' });
    res.json(calculation);
  } catch (error) {
    console.error('Error calculando costo de tintometría:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tintometria/:entity', async (req: ApiAuthRequest, res) => {
  try {
    const map = TINTO_MAP[req.params.entity];
    if (!map) return res.status(404).json({ error: 'Entidad de tintometría desconocida' });
    if (req.params.entity === 'recetas' && req.query.colorId) {
      return res.json(await storage.getRecetasByColorId(String(req.query.colorId)));
    }
    res.json(await (storage as any)[map.all]());
  } catch (error) {
    console.error('Error fetching tintometría:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tintometria/:entity/:id', async (req: ApiAuthRequest, res) => {
  try {
    const map = TINTO_MAP[req.params.entity];
    if (!map) return res.status(404).json({ error: 'Entidad de tintometría desconocida' });
    const row = await (storage as any)[map.one](parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(row);
  } catch (error) {
    console.error('Error fetching tintometría item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tintometria/:entity', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const map = TINTO_MAP[req.params.entity];
    if (!map) return res.status(404).json({ error: 'Entidad de tintometría desconocida' });
    const row = await (storage as any)[map.create](req.body);
    res.status(201).json(row);
  } catch (error: any) {
    console.error('Error creating tintometría item:', error);
    res.status(500).json({ error: 'Internal server error', message: error?.message });
  }
});

router.patch('/tintometria/:entity/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const map = TINTO_MAP[req.params.entity];
    if (!map) return res.status(404).json({ error: 'Entidad de tintometría desconocida' });
    const row = await (storage as any)[map.update](parseInt(req.params.id, 10), req.body);
    res.json(row);
  } catch (error: any) {
    console.error('Error updating tintometría item:', error);
    res.status(500).json({ error: 'Internal server error', message: error?.message });
  }
});

router.delete('/tintometria/:entity/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const map = TINTO_MAP[req.params.entity];
    if (!map) return res.status(404).json({ error: 'Entidad de tintometría desconocida' });
    await (storage as any)[map.del](parseInt(req.params.id, 10));
    res.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting tintometría item:', error);
    res.status(500).json({ error: 'Internal server error', message: error?.message });
  }
});

// ============================================
// PALETA DE COLORES
// ============================================

// Listar paleta  (interna GET /api/color-palette)
router.get('/colores-paleta', async (_req: ApiAuthRequest, res) => {
  try {
    const result = await db.execute(sql`
      SELECT TRIM(c.color) AS "nombreColor", cp.hex
      FROM (SELECT DISTINCT TRIM(color) AS color FROM ecommerce_products
            WHERE color IS NOT NULL AND TRIM(color) <> '') c
      LEFT JOIN color_palette cp ON UPPER(TRIM(cp.nombre_color)) = UPPER(c.color)
      ORDER BY c.color`);
    res.json({ palette: (result.rows as any[]).map((r) => ({ nombreColor: r.nombreColor, hex: r.hex || null })) });
  } catch (error) {
    console.error('Error fetching color palette:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upsert de colores  (interna PUT /api/color-palette). Body: { colors: [{ nombreColor, hex }] }
router.post('/colores-paleta', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const colors = Array.isArray(req.body?.colors) ? req.body.colors : [];
    const hexRe = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    let saved = 0;
    for (const c of colors) {
      const nombre = String(c?.nombreColor || '').trim();
      const hex = String(c?.hex || '').trim();
      if (!nombre || !hexRe.test(hex)) continue;
      await db.execute(sql`
        INSERT INTO color_palette (nombre_color, hex, updated_by, updated_at)
        VALUES (${nombre}, ${hex}, ${req.apiKey?.id ?? null}, NOW())
        ON CONFLICT (UPPER(TRIM(nombre_color)))
        DO UPDATE SET hex = EXCLUDED.hex, updated_by = EXCLUDED.updated_by, updated_at = NOW()`);
      saved++;
    }
    res.json({ ok: true, saved });
  } catch (error) {
    console.error('Error upserting color palette:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Eliminar un color de la paleta por nombre (sin equivalente interno directo — CRUD de conveniencia)
router.delete('/colores-paleta/:nombreColor', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await db.delete(colorPalette).where(sql`UPPER(TRIM(${colorPalette.nombreColor})) = UPPER(TRIM(${req.params.nombreColor}))`);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting color palette entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ╔══════════ MÓDULO: CLIENTES ══════════╗
// ============================================
// Clientes — Maestro (alta/edición), Ficha 360, Catálogos, Estado de cuenta / Cartera / Morosos
// ============================================
// Espeja routes.ts: POST /api/clients, PATCH /api/clients/:id/ficha (edición vía ficha_overrides),
// GET /api/clients/account-status, /cartera, /business-types, /entity-types, y el filtro creditOverdue.

const normalizeRutExt = (v?: string | null) =>
  (v || '').replace(/[.\-\s]/g, '').trim().toUpperCase();

// Catálogos de filtro (GET, sin guard)
router.get('/clientes/tipos-negocio', async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getUniqueBusinessTypes());
  } catch (error) {
    console.error('Error fetching business types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/clientes/tipos-entidad', async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getUniqueEntityTypes());
  } catch (error) {
    console.error('Error fetching entity types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Estado de cuenta consolidado (ficha SAP + cuenta eCommerce + solicitud pendiente + cartera).
// Espejo de GET /api/clients/account-status. Requiere name o rut.
router.get('/clientes/estado-cuenta', async (req: ApiAuthRequest, res) => {
  try {
    const name = ((req.query.name as string) || '').trim();
    const rut = ((req.query.rut as string) || '').trim();
    if (!name && !rut) return res.status(400).json({ error: 'name o rut es requerido' });

    const upperName = name.toUpperCase();
    const cleanRut = normalizeRutExt(rut);

    // 1. Ficha(s) SAP (clients) por nombre o RUT normalizado.
    let fichaRows: any[] = [];
    try {
      const fichaResult = await db.execute(sql`
        SELECT id, koen, nokoen, rten, foen, dien, cmen, comuna, email,
               cpen, kofuen, lcen, crto, ficha_overrides
        FROM clients
        WHERE (${upperName} <> '' AND UPPER(TRIM(nokoen)) = ${upperName})
           OR (${cleanRut} <> '' AND REPLACE(REPLACE(REPLACE(UPPER(rten), '.', ''), '-', ''), ' ', '') = ${cleanRut})
        ORDER BY parent_client_id NULLS FIRST
      `);
      fichaRows = Array.isArray(fichaResult) ? fichaResult : (fichaResult as any).rows || [];
    } catch (e) {
      console.error('[estado-cuenta] ficha lookup failed:', e);
    }

    const ficha: any = fichaRows[0] || null;
    const fichaOv: any = (() => {
      const raw = ficha?.ficha_overrides;
      if (!raw) return {};
      if (typeof raw === 'string') { try { return JSON.parse(raw) || {}; } catch { return {}; } }
      return raw;
    })();
    const fichaRut = normalizeRutExt(ficha?.rten) || cleanRut;
    const fichaId = ficha?.id || null;
    const effPriceList = (fichaOv.priceList && String(fichaOv.priceList).trim())
      ? String(fichaOv.priceList).trim() : (ficha?.lcen ?? 'LP01');
    // Lista que realmente se cobra: misma resolución que el catálogo y el checkout.
    const fichaPriceList = await resolvePriceListForClient(ficha);

    const companyIds = Array.from(new Set(fichaRows.map((f: any) => f.id).filter(Boolean)));
    const companyRuts = Array.from(new Set(
      [...fichaRows.map((f: any) => normalizeRutExt(f.rten)), cleanRut].filter(Boolean)
    ));
    const companyKoens = Array.from(new Set(fichaRows.map((f: any) => f.koen).filter(Boolean)));

    // Cartera real desde ventas.fact_ventas (dedup por idmaeedo; pendientes espgdo='P').
    let carteraUsado: number | null = null, carteraVencido: number | null = null;
    let carteraPorVencer: number | null = null;
    let carteraProximoVenc: string | null = null, carteraVencidoDesde: string | null = null;
    if (companyKoens.length > 0) {
      try {
        const carteraResult = await db.execute(sql`
          WITH docs AS (
            SELECT idmaeedo,
                   MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0)) AS saldo,
                   MAX(fe01vedo) AS venc
            FROM ventas.fact_ventas
            WHERE endo IN (${sql.join(companyKoens.map((k: string) => sql`${k}`), sql`, `)})
              AND tido IN ('FCV', 'FDV') AND espgdo = 'P'
            GROUP BY idmaeedo
          )
          SELECT
            COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0) AS usado,
            COALESCE(SUM(saldo) FILTER (WHERE saldo > 0 AND venc < CURRENT_DATE), 0) AS vencido,
            COALESCE(SUM(saldo) FILTER (WHERE saldo > 0 AND (venc >= CURRENT_DATE OR venc IS NULL)), 0) AS por_vencer,
            MIN(venc) FILTER (WHERE saldo > 0 AND venc >= CURRENT_DATE) AS proximo_venc,
            MIN(venc) FILTER (WHERE saldo > 0 AND venc < CURRENT_DATE) AS vencido_desde
          FROM docs
        `);
        const crow = (Array.isArray(carteraResult) ? carteraResult : (carteraResult as any).rows || [])[0];
        if (crow) {
          const fmt = (v: any) => v == null ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
          carteraUsado = Number(crow.usado) || 0;
          carteraVencido = Number(crow.vencido) || 0;
          carteraPorVencer = Number(crow.por_vencer) || 0;
          carteraProximoVenc = fmt(crow.proximo_venc);
          carteraVencidoDesde = fmt(crow.vencido_desde);
        }
      } catch (e) { console.error('[estado-cuenta] cartera lookup failed:', e); }
    }

    // 2. Cuenta eCommerce (salespeople_users role=client).
    let ecommerceAccount: any = null;
    try {
      const acctResult = await db.execute(sql`
        SELECT id, email, salesperson_name, client_rut, client_id
        FROM salespeople_users
        WHERE role = 'client'
          AND (
            ${companyIds.length > 0 ? sql`client_id IN (${sql.join(companyIds.map((i: string) => sql`${i}`), sql`, `)})` : sql`FALSE`}
            OR (${upperName} <> '' AND UPPER(salesperson_name) = ${upperName})
            ${companyRuts.length > 0 ? sql`OR REPLACE(REPLACE(REPLACE(UPPER(client_rut), '.', ''), '-', ''), ' ', '') IN (${sql.join(companyRuts.map((r: string) => sql`${r}`), sql`, `)})` : sql``}
          )
        ORDER BY (client_id IS NOT NULL) DESC, created_at DESC
        LIMIT 1
      `);
      const rows = Array.isArray(acctResult) ? acctResult : (acctResult as any).rows || [];
      ecommerceAccount = rows[0] || null;
    } catch (e) { console.error('[estado-cuenta] ecommerce account lookup failed:', e); }

    // 3. Solicitud de alta eCommerce pendiente (app_config JSON).
    let pendingRequest: any = null;
    try {
      const reqResult = await db.execute(sql`SELECT value FROM app_config WHERE key = 'ecommerce_account_requests'`);
      const reqRows = Array.isArray(reqResult) ? reqResult : (reqResult as any).rows || [];
      if (reqRows.length > 0) {
        const raw = reqRows[0].value;
        let requests: any[] = [];
        try { requests = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch {}
        pendingRequest = requests.find((r: any) => {
          if ((r.status || '').toLowerCase() !== 'pendiente') return false;
          const reqRut = normalizeRutExt(r.rut);
          const reqEmpresa = (r.empresa || '').toUpperCase();
          return (fichaRut && reqRut && reqRut === fichaRut) || (upperName && reqEmpresa === upperName);
        }) || null;
      }
    } catch (e) { console.error('[estado-cuenta] pending request lookup failed:', e); }

    const linked = !!(ecommerceAccount && ecommerceAccount.client_id);
    // Línea de crédito: override manual > CRTO del ERP (ver shared/credito.ts).
    const lineaCredito = resolverLineaCredito(ficha);

    res.json({
      hasFicha: !!ficha,
      ficha: ficha ? {
        id: ficha.id,
        clientCode: ficha.koen,
        clientName: fichaOv.clientName ?? ficha.nokoen,
        rut: ficha.rten,
        phone: fichaOv.phone ?? ficha.foen,
        address: fichaOv.address ?? ficha.dien,
        commune: fichaOv.commune ?? (ficha.cmen || ficha.comuna || null),
        email: fichaOv.email ?? ficha.email,
        paymentCondition: ficha.cpen,
        salesRepCode: ficha.kofuen,
        priceList: effPriceList,
        priceListErp: ficha.lcen ?? null,
        // Lista con la que se le cotiza de verdad (ver price-list-resolver):
        // si difiere de priceList, esa lista no tiene precios en la intranet.
        priceListCharged: fichaPriceList.code,
        priceListUsable: fichaPriceList.usable,
        creditLimit: lineaCredito.limit,
        creditLimitSource: lineaCredito.origen,
        creditLimitErp: lineaCredito.erp,
        creditUsed: carteraUsado,
        creditOverdue: carteraVencido,
        overdueSince: carteraVencidoDesde,
        creditUpcoming: carteraPorVencer,
        nextDueDate: carteraProximoVenc,
        creditAvailable: lineaCredito.limit != null ? lineaCredito.limit - (carteraUsado ?? 0) : null,
      } : null,
      inEcommerce: !!ecommerceAccount,
      linked,
      ecommerceUserId: ecommerceAccount?.id || null,
      clientId: linked ? ecommerceAccount.client_id : fichaId,
      pendingRequest: pendingRequest ? {
        id: pendingRequest.id, empresa: pendingRequest.empresa, rut: pendingRequest.rut,
        contacto: pendingRequest.contacto, email: pendingRequest.email,
        telefono: pendingRequest.telefono, ciudad: pendingRequest.ciudad, createdAt: pendingRequest.createdAt,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching client account status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cartera (cuentas por cobrar): documentos pendientes con vencimiento y saldo.
// Espejo de GET /api/clients/cartera. Requiere name o rut.
router.get('/clientes/cartera', async (req: ApiAuthRequest, res) => {
  try {
    const name = ((req.query.name as string) || '').trim();
    const rut = ((req.query.rut as string) || '').trim();
    if (!name && !rut) return res.status(400).json({ error: 'name o rut es requerido' });
    const upperName = name.toUpperCase();
    const cleanRut = normalizeRutExt(rut);

    const fichaResult = await db.execute(sql`
      SELECT koen FROM clients
      WHERE (${upperName} <> '' AND UPPER(TRIM(nokoen)) = ${upperName})
         OR (${cleanRut} <> '' AND REPLACE(REPLACE(REPLACE(UPPER(rten), '.', ''), '-', ''), ' ', '') = ${cleanRut})
    `);
    const fichaRows = Array.isArray(fichaResult) ? fichaResult : (fichaResult as any).rows || [];
    const koens = Array.from(new Set(fichaRows.map((f: any) => f.koen).filter(Boolean)));
    if (koens.length === 0) return res.json({ docs: [] });

    const result = await db.execute(sql`
      SELECT idmaeedo,
             MAX(nudo) AS nudo, MAX(tido) AS tido, MAX(fe01vedo) AS vencimiento,
             MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0)) AS saldo,
             (MAX(fe01vedo) < CURRENT_DATE) AS vencida
      FROM ventas.fact_ventas
      WHERE endo IN (${sql.join(koens.map((k: string) => sql`${k}`), sql`, `)})
        AND tido IN ('FCV', 'FDV') AND espgdo = 'P'
      GROUP BY idmaeedo
      HAVING (MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0))) > 0
      ORDER BY MAX(fe01vedo) ASC NULLS LAST
    `);
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    const fmtDate = (v: any) => v == null ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
    res.json({
      docs: rows.map((d: any) => ({
        nudo: d.nudo != null ? String(d.nudo) : null,
        tido: d.tido ? String(d.tido).trim() : null,
        vencimiento: fmtDate(d.vencimiento),
        saldo: Number(d.saldo) || 0,
        vencida: d.vencida === true || d.vencida === 't',
      })),
    });
  } catch (error) {
    console.error('[cartera] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Morosos: clientes con crédito vencido. Usa el mismo cálculo validado de cartera
// (storage.getClientIdsByCreditOverdue) y devuelve la lista de clientes filtrada.
router.get('/clientes/morosos', async (req: ApiAuthRequest, res) => {
  try {
    const { search, segment, salesperson } = req.query;
    const restriction = await storage.getClientIdsByCreditOverdue('overdue');
    const clientsList = await storage.getClients({
      search: search as string | undefined,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      clientIdRestrictions: [restriction],
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });
    res.json(clientsList);
  } catch (error) {
    console.error('Error fetching overdue clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alta de cliente (maestro). Espejo de POST /api/clients.
router.post('/clientes', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const nokoen = typeof body.nokoen === 'string' ? body.nokoen.trim() : '';
    const rtenRaw = typeof body.rten === 'string' ? body.rten.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const foen = typeof body.foen === 'string' ? body.foen.trim() : '';

    const fields: Record<string, string> = {};
    if (!nokoen) fields.nokoen = 'El nombre es obligatorio';
    if (!rtenRaw) fields.rten = 'El RUT es obligatorio';
    else if (!isValidRut(rtenRaw)) fields.rten = 'El RUT no es válido';
    if (!email) fields.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'El email no tiene un formato válido';
    if (!foen) fields.foen = 'El teléfono es obligatorio';
    if (Object.keys(fields).length > 0) return res.status(400).json({ error: 'Datos inválidos', fields });

    const rten = formatRut(rtenRaw);
    const existing = await storage.getClientByRut(rten);
    if (existing) return res.status(409).json({ error: `Ya existe un cliente con este RUT: ${existing.nokoen}` });

    const koen = typeof body.koen === 'string' && body.koen.trim() ? body.koen.trim() : undefined;
    const validatedData = insertClientSchema.parse({ ...body, nokoen, rten, email, foen, koen });
    const newClient = await storage.insertClient(validatedData);
    res.status(201).json(newClient);
  } catch (error: any) {
    console.error('Error creating client:', error);
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    if (error?.code === '23505') return res.status(409).json({ error: 'El código de cliente ya existe' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ficha 360 por id (o koen): maestro del cliente + cartera resumida + documentos abiertos.
router.get('/clientes/:id/ficha', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    let rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (rows.length === 0) {
      rows = await db.select().from(clients).where(eq(clients.koen, id)).limit(1);
    }
    const ficha: any = rows[0];
    if (!ficha) return res.status(404).json({ error: 'Cliente no encontrado' });

    const fichaOv: any = (() => {
      const raw = ficha.fichaOverrides ?? (ficha as any).ficha_overrides;
      if (!raw) return {};
      if (typeof raw === 'string') { try { return JSON.parse(raw) || {}; } catch { return {}; } }
      return raw;
    })();

    // Koens de la misma empresa (casa matriz + sucursales por nombre/RUT).
    const upperName = String(ficha.nokoen || '').toUpperCase();
    const cleanRut = normalizeRutExt(ficha.rten);
    let companyKoens: string[] = [ficha.koen].filter(Boolean);
    try {
      const sib = await db.execute(sql`
        SELECT DISTINCT koen FROM clients
        WHERE koen IS NOT NULL AND (
          (${upperName} <> '' AND UPPER(TRIM(nokoen)) = ${upperName})
          OR (${cleanRut} <> '' AND REPLACE(REPLACE(REPLACE(UPPER(rten), '.', ''), '-', ''), ' ', '') = ${cleanRut})
        )
      `);
      const sibRows = Array.isArray(sib) ? sib : (sib as any).rows || [];
      companyKoens = Array.from(new Set([...companyKoens, ...sibRows.map((r: any) => r.koen)].filter(Boolean)));
    } catch (e) { console.error('[ficha] siblings lookup failed:', e); }

    let cartera: any = { usado: 0, vencido: 0, porVencer: 0, proximoVenc: null, vencidoDesde: null, docs: [] };
    if (companyKoens.length > 0) {
      try {
        const fmt = (v: any) => v == null ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
        const sumRes = await db.execute(sql`
          WITH docs AS (
            SELECT idmaeedo,
                   MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0)) AS saldo,
                   MAX(fe01vedo) AS venc
            FROM ventas.fact_ventas
            WHERE endo IN (${sql.join(companyKoens.map((k) => sql`${k}`), sql`, `)})
              AND tido IN ('FCV', 'FDV') AND espgdo = 'P'
            GROUP BY idmaeedo
          )
          SELECT
            COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0) AS usado,
            COALESCE(SUM(saldo) FILTER (WHERE saldo > 0 AND venc < CURRENT_DATE), 0) AS vencido,
            COALESCE(SUM(saldo) FILTER (WHERE saldo > 0 AND (venc >= CURRENT_DATE OR venc IS NULL)), 0) AS por_vencer,
            MIN(venc) FILTER (WHERE saldo > 0 AND venc >= CURRENT_DATE) AS proximo_venc,
            MIN(venc) FILTER (WHERE saldo > 0 AND venc < CURRENT_DATE) AS vencido_desde
          FROM docs
        `);
        const s = (Array.isArray(sumRes) ? sumRes : (sumRes as any).rows || [])[0] || {};
        const docsRes = await db.execute(sql`
          SELECT idmaeedo, MAX(nudo) AS nudo, MAX(tido) AS tido, MAX(fe01vedo) AS vencimiento,
                 MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0)) AS saldo,
                 (MAX(fe01vedo) < CURRENT_DATE) AS vencida
          FROM ventas.fact_ventas
          WHERE endo IN (${sql.join(companyKoens.map((k) => sql`${k}`), sql`, `)})
            AND tido IN ('FCV', 'FDV') AND espgdo = 'P'
          GROUP BY idmaeedo
          HAVING (MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0))) > 0
          ORDER BY MAX(fe01vedo) ASC NULLS LAST
        `);
        const dRows = Array.isArray(docsRes) ? docsRes : (docsRes as any).rows || [];
        cartera = {
          usado: Number(s.usado) || 0,
          vencido: Number(s.vencido) || 0,
          porVencer: Number(s.por_vencer) || 0,
          proximoVenc: fmt(s.proximo_venc),
          vencidoDesde: fmt(s.vencido_desde),
          docs: dRows.map((d: any) => ({
            nudo: d.nudo != null ? String(d.nudo) : null,
            tido: d.tido ? String(d.tido).trim() : null,
            vencimiento: fmt(d.vencimiento),
            saldo: Number(d.saldo) || 0,
            vencida: d.vencida === true || d.vencida === 't',
          })),
        };
      } catch (e) { console.error('[ficha] cartera lookup failed:', e); }
    }

    const creditLimit = resolverLineaCredito(ficha).limit;
    // Lista que realmente se cobra: misma resolución que el catálogo y el checkout.
    const fichaPriceList = await resolvePriceListForClient(ficha);
    res.json({
      id: ficha.id,
      clientCode: ficha.koen,
      clientName: fichaOv.clientName ?? ficha.nokoen,
      rut: ficha.rten,
      phone: fichaOv.phone ?? ficha.foen,
      address: fichaOv.address ?? ficha.dien,
      commune: fichaOv.commune ?? (ficha.cmen || ficha.comuna || null),
      email: fichaOv.email ?? ficha.email,
      paymentCondition: ficha.cpen,
      salesRepCode: ficha.kofuen,
      priceList: (fichaOv.priceList && String(fichaOv.priceList).trim()) ? String(fichaOv.priceList).trim() : (ficha.lcen ?? 'LP01'),
      priceListErp: ficha.lcen ?? null,
      priceListCharged: fichaPriceList.code,
      priceListUsable: fichaPriceList.usable,
      businessType: ficha.gien ?? null,
      creditLimit,
      creditUsed: cartera.usado,
      creditOverdue: cartera.vencido,
      creditUpcoming: cartera.porVencer,
      overdueSince: cartera.vencidoDesde,
      nextDueDate: cartera.proximoVenc,
      creditAvailable: creditLimit != null ? creditLimit - cartera.usado : null,
      cartera,
    });
  } catch (error) {
    console.error('Error fetching client ficha:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edición del cliente. Espejo de PATCH /api/clients/:id/ficha: guarda overrides de contacto
// (clientName, email, phone, address, commune, priceList) en clients.ficha_overrides (JSONB).
// Campo vacío => quita el override (vuelve al valor del ERP).
router.patch('/clientes/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id de cliente requerido' });

    const body = req.body ?? {};
    const cur = await db.execute(sql`SELECT ficha_overrides FROM clients WHERE id = ${id} LIMIT 1`);
    const curRows = Array.isArray(cur) ? cur : (cur as any).rows || [];
    if (curRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    let overrides: Record<string, any> = {};
    const raw = curRows[0].ficha_overrides;
    if (raw) {
      if (typeof raw === 'string') { try { overrides = JSON.parse(raw) || {}; } catch { overrides = {}; } }
      else overrides = raw;
    }

    const fieldNames = ['clientName', 'email', 'phone', 'address', 'commune', 'priceList'];
    for (const f of fieldNames) {
      if (!(f in body)) continue;
      const v = (body[f] ?? '').toString().trim();
      if (v) overrides[f] = v; else delete overrides[f];
    }

    const hasAny = Object.keys(overrides).length > 0;
    await db.execute(sql`
      UPDATE clients
      SET ficha_overrides = ${hasAny ? JSON.stringify(overrides) : null}::jsonb, updated_at = now()
      WHERE id = ${id}
    `);
    res.json({ success: true, fichaOverrides: hasAny ? overrides : null });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Rutas Comerciales de Visita (CRUD completo)
// ============================================
// Espeja routes.ts: GET/POST /api/rutas, PATCH/DELETE /api/rutas/:id, /vendedores,
// /:id/clientes (GET/POST/DELETE), /:id/clientes/:koen/visitado, /:id/visitas.

router.get('/rutas-comerciales/vendedores', async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getAllActiveSalespeopleBasic());
  } catch (error) {
    console.error('Error fetching ruta vendedores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/rutas-comerciales', async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getAllRutas());
  } catch (error) {
    console.error('Error fetching rutas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/rutas-comerciales', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const vendedorIds: string[] = Array.isArray(req.body?.vendedorIds)
      ? req.body.vendedorIds.filter((v: any) => typeof v === 'string' && v.trim())
      : (req.body?.vendedorId ? [String(req.body.vendedorId)] : []);
    if (vendedorIds.length === 0) return res.status(400).json({ error: 'Debe asignar al menos un vendedor (vendedorId o vendedorIds[])' });

    const parsed = insertRutaComercialSchema.safeParse({ ...req.body, vendedorId: vendedorIds[0] });
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

    // Sin sesión: el supervisor de la ruta se toma de body.supervisorId, o el 1er vendedor.
    const supervisorId = (typeof req.body?.supervisorId === 'string' && req.body.supervisorId.trim())
      ? req.body.supervisorId.trim() : vendedorIds[0];

    const ruta = await storage.createRuta({ ...parsed.data, supervisorId });
    const catalogo = await storage.getAllActiveSalespeopleBasic();
    const nombreDe = (vid: string) => catalogo.find((v: any) => v.id === vid)?.salespersonName ?? null;
    await storage.setRutaVendedores(ruta.id, vendedorIds.map((vid) => ({ id: vid, nombre: nombreDe(vid) })));
    res.status(201).json(ruta);
  } catch (error) {
    console.error('Error creating ruta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/rutas-comerciales/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { vendedorIds, ...rest } = req.body || {};
    if (Array.isArray(vendedorIds)) {
      const ids: string[] = vendedorIds.filter((v: any) => typeof v === 'string' && v.trim());
      if (ids.length === 0) return res.status(400).json({ error: 'Debe asignar al menos un vendedor' });
      const catalogo = await storage.getAllActiveSalespeopleBasic();
      const nombreDe = (vid: string) => catalogo.find((v: any) => v.id === vid)?.salespersonName ?? null;
      await storage.setRutaVendedores(req.params.id, ids.map((vid) => ({ id: vid, nombre: nombreDe(vid) })));
      rest.vendedorId = ids[0];
    }
    if (rest.fecha !== undefined && rest.fecha) rest.fecha = new Date(rest.fecha);
    const rutaActualizada = await storage.updateRuta(req.params.id, rest);
    res.json(rutaActualizada);
  } catch (error) {
    console.error('Error updating ruta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/rutas-comerciales/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const ruta = await storage.getRutaById(req.params.id);
    if (!ruta) return res.status(404).json({ error: 'Ruta no encontrada' });
    await storage.deleteRuta(req.params.id);
    res.json({ message: 'Ruta eliminada' });
  } catch (error) {
    console.error('Error deleting ruta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/rutas-comerciales/:id/clientes', async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getRutaClientes(req.params.id));
  } catch (error) {
    console.error('Error fetching ruta clientes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/rutas-comerciales/:id/clientes', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const parsed = insertRutaClienteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const rutaCliente = await storage.addClienteToRuta(req.params.id, parsed.data);
    res.status(201).json(rutaCliente);
  } catch (error) {
    console.error('Error adding cliente to ruta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/rutas-comerciales/:id/clientes/:koen', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const ruta = await storage.getRutaById(req.params.id);
    if (!ruta) return res.status(404).json({ error: 'Ruta no encontrada' });
    await storage.removeClienteFromRuta(req.params.id, req.params.koen);
    res.json({ message: 'Cliente removido de la ruta' });
  } catch (error) {
    console.error('Error removing cliente from ruta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Marca la visita como realizada/pendiente para el cliente en la ruta. Al marcar realizada
// se puede adjuntar evidencia (foto + geolocalización + nota) al histórico de visitas.
router.post('/rutas-comerciales/:id/clientes/:koen/visitado', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const ruta = await storage.getRutaById(req.params.id);
    if (!ruta) return res.status(404).json({ error: 'Ruta no encontrada' });
    const visitado = req.body?.visitado === true || req.body?.visitado === 'true';

    let rc: any = null;
    try {
      rc = await storage.setRutaClienteVisitado(req.params.id, req.params.koen, visitado);
    } catch (err) {
      console.warn('Cliente no asignado a la ruta al marcar visitado, se continúa para registrar evidencia:', (err as any)?.message);
    }

    if (visitado) {
      const { imagenUrl, lat, lng, nota, clienteNombre } = req.body || {};
      if (imagenUrl || lat != null || lng != null || (nota && String(nota).trim())) {
        try {
          await storage.addRutaVisita({
            rutaId: req.params.id,
            clienteId: req.params.koen,
            clienteNombre: clienteNombre || rc?.clienteNombre || null,
            fecha: new Date(),
            nota: nota ? String(nota).trim() : null,
            imagenUrl: imagenUrl || null,
            lat: lat != null && lat !== '' ? String(lat) : null,
            lng: lng != null && lng !== '' ? String(lng) : null,
            registradoPor: null,
            registradoPorNombre: 'API',
          });
        } catch (err) { console.error('Error registrando evidencia de visita:', err); }
      }
    }
    res.json(rc ?? { rutaId: req.params.id, clienteId: req.params.koen, visitado });
  } catch (error) {
    console.error('Error marcando visita de ruta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Histórico de visitas de una ruta. No hay método de storage por rutaId -> db directo.
router.get('/rutas-comerciales/:id/visitas', async (req: ApiAuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(rutaVisitas)
      .where(eq(rutaVisitas.rutaId, req.params.id))
      .orderBy(desc(rutaVisitas.fecha));
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ruta visitas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ╔══════════ MÓDULO: PEDIDOS ══════════╗
// ============================================
// Órdenes / Pedidos internos (Read & Write)
// Espejo de /api/orders. GET sin guard; POST/PATCH read_write.
// createdBy se resuelve desde salespersonName (igual que cotizaciones).
// ============================================

// GET /ordenes — lista de pedidos internos
router.get('/ordenes', async (req: ApiAuthRequest, res) => {
  try {
    const { status, clientName } = req.query;
    // Sin userRole/userId → storage no aplica scoping por rol (la API key ya es de confianza)
    const orders = await storage.getOrders({
      status: status as string | undefined,
      clientName: clientName as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching ordenes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ordenes/:id — pedido + items
router.get('/ordenes/:id', async (req: ApiAuthRequest, res) => {
  try {
    const order = await storage.getOrderWithItems(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (error) {
    console.error('Error fetching orden:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /ordenes — crear pedido (con items[] inline opcional)
router.post('/ordenes', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { salespersonName, items, estimatedDeliveryDate, ...body } = req.body ?? {};

    if (!body.clientName) {
      return res.status(400).json({ error: 'clientName es requerido' });
    }
    if (!salespersonName) {
      return res.status(400).json({ error: 'salespersonName es requerido' });
    }
    const resolved = await resolveSalesperson(salespersonName);
    if (!resolved) {
      return res.status(404).json({ error: `Vendedor '${salespersonName}' no encontrado` });
    }

    const order = await storage.createOrder({
      ...body,
      createdBy: resolved.id,
      estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
    } as any);

    const createdItems = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const newItem = await storage.addOrderItem(order.id, item);
        createdItems.push(newItem);
      }
    }

    res.status(201).json({
      ...order,
      salespersonName: resolved.displayName,
      items: createdItems,
    });
  } catch (error) {
    console.error('Error creating orden:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /ordenes/:id — actualizar cabecera del pedido
router.patch('/ordenes/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { estimatedDeliveryDate, ...updates } = req.body ?? {};

    const existing = await storage.getOrderById(id);
    if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });

    const patch: any = { ...updates };
    if (estimatedDeliveryDate !== undefined) {
      patch.estimatedDeliveryDate = estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null;
    }

    const updated = await storage.updateOrder(id, patch);
    res.json(updated);
  } catch (error) {
    console.error('Error updating orden:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ordenes/:id/items
router.get('/ordenes/:id/items', async (req: ApiAuthRequest, res) => {
  try {
    const items = await storage.getOrderItems(req.params.id);
    res.json(items);
  } catch (error) {
    console.error('Error fetching orden items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /ordenes/:id/items — agregar item (recalcula totales)
router.post('/ordenes/:id/items', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const item = req.body ?? {};
    if (!item.productName || item.quantity === undefined || item.unitPrice === undefined) {
      return res.status(400).json({ error: 'productName, quantity y unitPrice son requeridos' });
    }
    const order = await storage.getOrderById(id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    const newItem = await storage.addOrderItem(id, item);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding orden item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cotizaciones/:id/convertir-orden — convierte una cotización en pedido
router.post('/cotizaciones/:id/convertir-orden', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const quote = await storage.getQuoteById(id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    // convertQuoteToOrder marca la cotización como 'converted' y crea el pedido con sus items.
    // createdBy = quote.createdBy (conserva el vendedor original de la cotización).
    const order = await storage.convertQuoteToOrder(id, (quote as any).createdBy);
    res.status(201).json(order);
  } catch (error) {
    console.error('Error converting cotización to orden:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Solicitudes B2C (cotizador público)
// Espejo de /api/b2c/quote-requests. GET sin guard; PATCH estado read_write.
// ============================================

// GET /solicitudes-b2c — lista de solicitudes del cotizador público
router.get('/solicitudes-b2c', async (req: ApiAuthRequest, res) => {
  try {
    const { status } = req.query;
    const requests = await getQuoteRequests({
      status: status as string | undefined,
      limit: parseLimit(req.query.limit),
    });
    res.json({ requests, count: requests.length });
  } catch (error) {
    console.error('Error fetching solicitudes B2C:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /solicitudes-b2c/:id — detalle de una solicitud
router.get('/solicitudes-b2c/:id', async (req: ApiAuthRequest, res) => {
  try {
    const request = await getQuoteRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json(request);
  } catch (error) {
    console.error('Error fetching solicitud B2C:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /solicitudes-b2c/:id/estado — cambiar estado y/o notas internas
router.patch('/solicitudes-b2c/:id/estado', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, internalNotes } = req.body ?? {};
    const allowed = ['pending', 'contacted', 'quoted', 'sale', 'closed'];
    if (status !== undefined && !allowed.includes(status)) {
      return res.status(400).json({ error: `status inválido (válidos: ${allowed.join(', ')})` });
    }
    if (status === undefined && internalNotes === undefined) {
      return res.status(400).json({ error: 'Nada que actualizar (envía status y/o internalNotes)' });
    }
    const updated = await updateQuoteRequestStatus(id, status, internalNotes);
    if (!updated) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating solicitud B2C:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /solicitudes-b2c/:id/pdf — HTML imprimible (browser → PDF). Requiere precios asignados.
router.get('/solicitudes-b2c/:id/pdf', async (req: ApiAuthRequest, res) => {
  try {
    const request = await getQuoteRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const items = ((request.items as QuoteRequestItem[]) || []);
    const hasPricing = items.some((i) => typeof i.unitPrice === 'number' && i.unitPrice > 0);
    if (!hasPricing) {
      return res.status(400).json({ error: 'La solicitud aún no tiene precios asignados' });
    }

    const [config] = await db.select().from(storeConfig).limit(1);
    const html = renderQuoteRequestPdfHtml(request, { logoUrl: config?.logoUrl || '/panoramica-logo.png' });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error rendering solicitud B2C PDF:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to render PDF', detail: msg });
  }
});

// ============================================
// eCommerce ERP orders (lectura del cruce con ERP) — espejo de /api/ecommerce/erp-orders
// Sin scoping por usuario: la API key ve todo. Filtro opcional por vendedor.
// ============================================

router.get('/ecommerce/erp-orders', async (req: ApiAuthRequest, res) => {
  try {
    const ITEM_CAP = 30; // el ERP splitea un documento en otro al superar 30 líneas

    const salesFilter = ((req.query.salesperson as string) || '').trim();
    const fcvVendorCond = salesFilter ? sql`AND nokofu ILIKE ${salesFilter}` : sql``;
    const nvvVendorCond = salesFilter ? sql`AND nombre_vendedor ILIKE ${salesFilter}` : sql``;
    const gdvVendorCond = salesFilter ? sql`AND nokofu ILIKE ${salesFilter}` : sql``;

    // FCV (facturas)
    let fcvDocs: any[] = [];
    try {
      const r = await db.execute(sql`
        SELECT idmaeedo::text AS doc_id, MAX(nudo)::text AS nudo, MAX(feemdo)::text AS fecha,
               MAX(nokoen) AS cliente, MAX(endo) AS cliente_codigo,
               COALESCE(SUM(monto), 0)::numeric AS total, COUNT(*)::int AS items, MAX(nokofu) AS vendedor
        FROM ventas.fact_ventas
        WHERE tido = 'FCV' AND feemdo >= (CURRENT_DATE - INTERVAL '90 days') ${fcvVendorCond}
        GROUP BY idmaeedo ORDER BY MAX(feemdo) DESC LIMIT 4000
      `);
      const rows = Array.isArray(r) ? r : (r as any).rows || [];
      fcvDocs = rows.map((x: any) => ({
        docType: 'FCV', docId: x.doc_id, orderNumber: x.nudo, date: x.fecha, deliveryDate: null,
        clientName: (x.cliente || 'Sin nombre').trim(), clientCode: x.cliente_codigo ? String(x.cliente_codigo).trim() : '',
        total: Number(x.total) || 0, totalPending: 0, items: Number(x.items) || 0, salesperson: x.vendedor || null,
      }));
    } catch (e) { console.warn('[external erp-orders] FCV query failed:', e); }

    // NVV (notas de venta pendientes de facturación)
    let nvvDocs: any[] = [];
    try {
      const r = await db.execute(sql`
        SELECT idmaeedo::text AS doc_id, MAX(nudo)::text AS nudo, MAX(feemdo)::text AS fecha,
               MAX(feer)::text AS fecha_entrega, MAX(nokoen) AS cliente, MAX(endo) AS cliente_codigo,
               COALESCE(SUM(monto), 0)::numeric AS total, COALESCE(SUM(monto_pendiente), 0)::numeric AS total_pendiente,
               COUNT(*)::int AS items, MAX(nombre_vendedor) AS vendedor
        FROM nvv.fact_nvv
        WHERE (eslido IS NULL OR TRIM(eslido) = '') AND COALESCE(cantidad_pendiente_ud2, 0) > 0
          AND feemdo >= (CURRENT_DATE - INTERVAL '90 days') ${nvvVendorCond}
        GROUP BY idmaeedo ORDER BY MAX(feemdo) DESC LIMIT 4000
      `);
      const rows = Array.isArray(r) ? r : (r as any).rows || [];
      nvvDocs = rows.map((x: any) => ({
        docType: 'NVV', docId: x.doc_id, orderNumber: x.nudo, date: x.fecha, deliveryDate: x.fecha_entrega || null,
        clientName: (x.cliente || 'Sin nombre').trim(), clientCode: x.cliente_codigo ? String(x.cliente_codigo).trim() : '',
        total: Number(x.total) || 0, totalPending: Number(x.total_pendiente) || 0, items: Number(x.items) || 0, salesperson: x.vendedor || null,
      }));
    } catch (e) { console.warn('[external erp-orders] NVV query failed:', e); }

    // GDV (guías de despacho abiertas)
    let gdvDocs: any[] = [];
    try {
      const r = await db.execute(sql`
        SELECT idmaeedo::text AS doc_id, MAX(nudo)::text AS nudo, MAX(feemdo)::text AS fecha,
               MAX(nokoen) AS cliente, MAX(endo) AS cliente_codigo,
               COALESCE(SUM(monto), 0)::numeric AS total, COUNT(*)::int AS items, MAX(nokofu) AS vendedor
        FROM gdv.fact_gdv
        WHERE (esdo IS NULL OR TRIM(esdo) = '') AND feemdo >= (CURRENT_DATE - INTERVAL '90 days') ${gdvVendorCond}
        GROUP BY idmaeedo ORDER BY MAX(feemdo) DESC LIMIT 4000
      `);
      const rows = Array.isArray(r) ? r : (r as any).rows || [];
      gdvDocs = rows.map((x: any) => ({
        docType: 'GDV', docId: x.doc_id, orderNumber: x.nudo, date: x.fecha, deliveryDate: null,
        clientName: (x.cliente || 'Sin nombre').trim(), clientCode: x.cliente_codigo ? String(x.cliente_codigo).trim() : '',
        total: Number(x.total) || 0, totalPending: 0, items: Number(x.items) || 0, salesperson: x.vendedor || null,
      }));
    } catch (e) { console.warn('[external erp-orders] GDV query failed:', e); }

    // Pedidos originados en el Market
    let marketIds = new Set<string>();
    try {
      const r = await db.execute(sql`SELECT DISTINCT erp_idmaeedo::text AS idmaeedo FROM ecommerce_orders WHERE erp_idmaeedo IS NOT NULL`);
      const rows = Array.isArray(r) ? r : (r as any).rows || [];
      marketIds = new Set(rows.map((x: any) => String(x.idmaeedo)).filter(Boolean));
    } catch (e) { console.warn('[external erp-orders] Market link query failed:', e); }

    const tagMarket = (d: any) => { d.fromMarket = marketIds.has(String(d.docId)); return d; };
    for (const d of nvvDocs) tagMarket(d);
    for (const d of gdvDocs) tagMarket(d);
    for (const d of fcvDocs) tagMarket(d);

    const norm = (s: string | null | undefined) => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const dayOf = (d: string | null) => (d || '').slice(0, 10);
    const buckets = new Map<string, any[]>();
    for (const d of [...nvvDocs, ...gdvDocs, ...fcvDocs]) {
      const key = `${d.docType}|${norm(d.clientCode) || norm(d.clientName)}|${dayOf(d.date)}|${norm(d.salesperson)}`;
      const arr = buckets.get(key);
      if (arr) arr.push(d); else buckets.set(key, [d]);
    }

    const makeOrder = (docs: any[]) => {
      const head = docs[0];
      return {
        id: `erp-${head.docType.toLowerCase()}-${docs.map((x) => x.docId).join('-')}`,
        source: 'sap', docType: head.docType,
        status: head.docType === 'FCV' ? 'facturado' : head.docType === 'GDV' ? 'despachada' : 'pendiente_facturacion',
        clientName: head.clientName, clientCode: head.clientCode, salesperson: head.salesperson,
        date: head.date, deliveryDate: head.deliveryDate || null,
        total: docs.reduce((s, x) => s + (x.total || 0), 0),
        totalPending: docs.reduce((s, x) => s + (x.totalPending || 0), 0),
        items: docs.reduce((s, x) => s + (x.items || 0), 0),
        isGrouped: docs.length > 1, fromMarket: docs.some((x) => x.fromMarket),
        orderNumbers: docs.map((x) => x.orderNumber).filter(Boolean),
        documents: docs.map((x) => ({ docId: x.docId, orderNumber: x.orderNumber, items: x.items, total: x.total, totalPending: x.totalPending || 0, date: x.date, deliveryDate: x.deliveryDate || null })),
      };
    };

    const orders: any[] = [];
    for (const docs of Array.from(buckets.values())) {
      if (docs.length === 1) orders.push(makeOrder(docs));
      else if (docs.some((d: any) => (d.items || 0) >= ITEM_CAP)) {
        docs.sort((a: any, b: any) => (Number(a.orderNumber) || 0) - (Number(b.orderNumber) || 0));
        orders.push(makeOrder(docs));
      } else { for (const d of docs) orders.push(makeOrder([d])); }
    }
    orders.sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)));

    res.json({
      orders, count: orders.length,
      nvvCount: orders.filter((o) => o.docType === 'NVV').length,
      gdvCount: orders.filter((o) => o.docType === 'GDV').length,
      fcvCount: orders.filter((o) => o.docType === 'FCV').length,
    });
  } catch (error: any) {
    console.error('Error fetching external ERP orders:', error);
    res.status(500).json({ error: 'Error al consultar pedidos ERP', detail: error?.message || 'Unknown error' });
  }
});

// ============================================
// NVV / GDV por vendedor (lectura) — espejo de /api/nvv|gdv/by-salesperson y /api/sales/gdv-pending
// ============================================

// GET /nvv — notas de venta pendientes de un vendedor
router.get('/nvv', async (req: ApiAuthRequest, res) => {
  try {
    const salesperson = (req.query.salesperson as string) || '';
    if (!salesperson.trim()) return res.status(400).json({ error: 'salesperson es requerido' });

    const { dateFrom, dateTo } = req.query;
    const nvv = await storage.getNvvBySalesperson({
      salesperson,
      startDate: dateFrom ? new Date(dateFrom as string) : undefined,
      endDate: dateTo ? new Date(dateTo as string) : undefined,
      clientScope: [], // [] => sin restricción de sucursal
    });
    res.json(nvv);
  } catch (error) {
    console.error('Error fetching NVV:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /gdv — guías de despacho de un vendedor
router.get('/gdv', async (req: ApiAuthRequest, res) => {
  try {
    const salesperson = (req.query.salesperson as string) || '';
    if (!salesperson.trim()) return res.status(400).json({ error: 'salesperson es requerido' });

    const gdv = await storage.getGdvBySalesperson({ salesperson, clientScope: [] });
    res.json(gdv);
  } catch (error) {
    console.error('Error fetching GDV:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /gdv-pending — métricas globales de GDV pendiente (gdvSales, gdvCount)
router.get('/gdv-pending', async (req: ApiAuthRequest, res) => {
  try {
    const { salesperson, segment, client } = req.query;
    const metrics = await storage.getGdvPendingGlobal({
      salesperson: salesperson as string | undefined,
      segment: segment as string | undefined,
      client: client as string | undefined,
      clientScope: [],
    });
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching GDV pending:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ╔══════════ MÓDULO: PANEL ══════════╗
// ============================================
// Panel de Trabajo — Kanban (grupos, comentarios, actividades, asignaciones)
// ============================================

// ── Grupos / columnas del kanban ──
// GET sin guard: lista todos los grupos (opcional filtro por segmento).
router.get('/tareas/grupos', async (req: ApiAuthRequest, res) => {
  try {
    const { segmento } = req.query;
    let query = db.select().from(taskGroups);
    if (segmento) query = query.where(eq(taskGroups.segmento, segmento as string)) as typeof query;
    const groups = await query.orderBy(taskGroups.sortOrder, taskGroups.createdAt);
    res.json(groups);
  } catch (error) {
    console.error('Error fetching task groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas/grupos', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { name, segmento, color, userId } = req.body;
    if (!name || !segmento) {
      return res.status(400).json({ error: 'name and segmento are required' });
    }
    const group = await storage.createTaskGroup({
      name,
      segmento,
      userId: userId || 'api',
      color,
    });
    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating task group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tareas/grupos/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, color, sortOrder } = req.body;
    // isAdmin=true: la API puede editar cualquier grupo sin importar el dueño.
    const group = await storage.updateTaskGroup(id, 'api', { name, color, sortOrder }, true);
    res.json(group);
  } catch (error: any) {
    if (error?.message?.includes('not found')) {
      return res.status(404).json({ error: 'Task group not found' });
    }
    console.error('Error updating task group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tareas/grupos/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    // isAdmin=true: borra cualquier grupo y desagrupa sus tareas (groupId=null).
    await storage.deleteTaskGroup(req.params.id, 'api', true);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Comentarios de tarea (hilo único estilo chat) ──
router.get('/tareas/:id/comentarios', async (req: ApiAuthRequest, res) => {
  try {
    const comments = await storage.getTaskCommentsByTask(req.params.id);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas/:id/comentarios', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content, autor } = req.body;
    if (!content || String(content).trim() === '') {
      return res.status(400).json({ error: 'content is required' });
    }
    const task = await storage.getTask(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.assignments || task.assignments.length === 0) {
      return res.status(400).json({ error: 'La tarea no tiene asignaciones (el comentario se ancla a una asignación)' });
    }
    // El hilo es único por tarea; anclamos a la primera asignación (FK requerido).
    const comment = await storage.addTaskComment({
      assignmentId: task.assignments[0].id,
      authorId: 'api',
      authorName: apiAuthorFromKey(req, autor),
      content: String(content).trim(),
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding task comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tareas/:id/comentarios/:commentId', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteTaskCommentById(req.params.commentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Actividades de tarea (seguimiento del cliente / kanban) ──
router.get('/tareas/:id/actividades', async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getActividadesByTask(req.params.id));
  } catch (error) {
    console.error('Error fetching actividades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas/:id/actividades', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { tipo, descripcion, fecha, estado, responsableId, responsableNombre, rutaId, rutaNombre } = req.body;
    if (!tipo) return res.status(400).json({ error: 'tipo is required' });
    const act = await storage.createActividad({
      taskId: req.params.id,
      tipo,
      descripcion: descripcion || null,
      fecha: fecha ? new Date(fecha) : null,
      estado: estado || 'pendiente',
      responsableId: responsableId || null,
      responsableNombre: responsableNombre || null,
      rutaId: rutaId || null,
      rutaNombre: rutaNombre || null,
      createdBy: 'api',
    });
    res.status(201).json(act);
  } catch (error) {
    console.error('Error creating actividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH espeja la ruta interna (actividad por id global, no anidada bajo la tarea).
router.patch('/tareas/actividades/:actId', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { tipo, descripcion, fecha, estado, responsableId, responsableNombre } = req.body || {};
    const updates: any = {};
    if (tipo !== undefined) updates.tipo = tipo;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (fecha !== undefined) updates.fecha = fecha ? new Date(fecha) : null;
    if (estado !== undefined) updates.estado = estado;
    if (responsableId !== undefined) updates.responsableId = responsableId;
    if (responsableNombre !== undefined) updates.responsableNombre = responsableNombre;
    const act = await storage.updateActividad(req.params.actId, updates);
    res.json(act);
  } catch (error: any) {
    if (error?.message?.includes('not found')) {
      return res.status(404).json({ error: 'Actividad not found' });
    }
    console.error('Error updating actividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tareas/actividades/:actId', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteActividad(req.params.actId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting actividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Asignaciones de tarea ──
router.get('/tareas/:id/asignaciones', async (req: ApiAuthRequest, res) => {
  try {
    const task = await storage.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task.assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas/:id/asignaciones', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { assigneeType, assigneeId, status, notes } = req.body;
    if (!assigneeType || !assigneeId) {
      return res.status(400).json({ error: 'assigneeType and assigneeId are required' });
    }
    const task = await storage.getTask(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const [assignment] = await db
      .insert(taskAssignments)
      .values({
        taskId: id,
        assigneeType,
        assigneeId,
        status: status || 'pending',
        notes: notes || null,
      })
      .returning();
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tareas/:id/asignaciones/:assignmentId', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { assignmentId } = req.params;
    const { status, notes, evidenceImages } = req.body;
    const updated = await storage.updateAssignmentStatus(
      assignmentId,
      status || '',
      notes !== undefined ? notes : undefined,
      evidenceImages !== undefined ? evidenceImages : undefined
    );
    if (!updated) return res.status(404).json({ error: 'Assignment not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas/:id/asignaciones/:assignmentId/leida', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const updated = await storage.markAssignmentRead(req.params.assignmentId);
    if (!updated) return res.status(404).json({ error: 'Assignment not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error marking assignment as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Comentarios de una asignación específica (hilo por miembro).
router.get('/tareas/:id/asignaciones/:assignmentId/comentarios', async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getTaskComments(req.params.assignmentId));
  } catch (error) {
    console.error('Error fetching assignment comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas/:id/asignaciones/:assignmentId/comentarios', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { assignmentId } = req.params;
    const { content, autor } = req.body;
    if (!content || String(content).trim() === '') {
      return res.status(400).json({ error: 'content is required' });
    }
    const comment = await storage.addTaskComment({
      assignmentId,
      authorId: 'api',
      authorName: apiAuthorFromKey(req, autor),
      content: String(content).trim(),
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding assignment comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tareas/:id/asignaciones/:assignmentId/comentarios/:commentId', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteTaskCommentById(req.params.commentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ╔══════════ MÓDULO: MARGENES ══════════╗
// ============================================
// Márgenes — vista analítica (Read + ETL costos)
// ============================================
// Espeja el módulo interno de márgenes: tabla producto vs costo (agrupación
// comercial), opciones de filtro, precios GRI de referencia, ranking top-products
// y disparo/consulta del ETL de costos (recarga de costos GRI desde SQL Server).

// Convierte period + filterType en { startDate, endDate } (YYYY-MM-DD local).
// Portado de getDateRange() de routes.ts para no depender de import interno.
function marginFmtDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function marginDateRange(period?: string, filterType?: string): { startDate?: string; endDate?: string } {
  if (!period || !filterType) return {};
  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  switch (filterType) {
    case 'day':
      startDate = new Date(period);
      endDate = new Date(period);
      break;
    case 'month':
      if (period === 'current-month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'last-month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (period.includes('-')) {
        const [year, month] = period.split('-');
        const py = parseInt(year);
        const pm = parseInt(month) - 1;
        startDate = new Date(py, pm, 1);
        if (py === now.getFullYear() && pm === now.getMonth()) {
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else {
          endDate = new Date(py, pm + 1, 0);
        }
      }
      break;
    case 'year': {
      const year = parseInt(period);
      if (!isNaN(year)) {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
      }
      break;
    }
    case 'range':
      if (period.includes('_')) {
        const [start, end] = period.split('_');
        startDate = new Date(start);
        endDate = new Date(end);
      } else {
        switch (period) {
          case 'last-7-days':
            endDate = new Date(now); startDate = new Date(now); startDate.setDate(startDate.getDate() - 7); break;
          case 'last-30-days':
            endDate = new Date(now); startDate = new Date(now); startDate.setDate(startDate.getDate() - 30); break;
          case 'last-90-days':
            endDate = new Date(now); startDate = new Date(now); startDate.setDate(startDate.getDate() - 90); break;
        }
      }
      break;
  }

  return {
    startDate: startDate && !isNaN(startDate.getTime()) ? marginFmtDateLocal(startDate) : undefined,
    endDate: endDate && !isNaN(endDate.getTime()) ? marginFmtDateLocal(endDate) : undefined,
  };
}

// GET /margenes/productos — tabla de márgenes: producto (price_list) + costo de
// producción + agrupación comercial (familia/color/formato desde ecommerce_products).
router.get('/margenes/productos', async (req: ApiAuthRequest, res) => {
  try {
    const { search, family, color, formato } = req.query;
    const result = await storage.getMargenProductList({
      search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
      family: typeof family === 'string' && family.trim() ? family.trim() : undefined,
      color: typeof color === 'string' && color.trim() ? color.trim() : undefined,
      formato: typeof formato === 'string' && formato.trim() ? formato.trim() : undefined,
      limit: parseLimit(req.query.limit, 50),
      offset: parseOffset(req.query.offset),
    });
    res.json({ items: result.items, totalCount: result.totalCount, hasMore: result.hasMore });
  } catch (error) {
    console.error('Error fetching margen products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /margenes/agrupaciones — opciones de filtro (familias/colores/formatos),
// encadenables: family limita colores y formatos visibles, etc.
router.get('/margenes/agrupaciones', async (req: ApiAuthRequest, res) => {
  try {
    const { family, color, formato } = req.query;
    const options = await storage.getMargenAgrupacionOptions({
      family: typeof family === 'string' && family.trim() ? family.trim() : undefined,
      color: typeof color === 'string' && color.trim() ? color.trim() : undefined,
      formato: typeof formato === 'string' && formato.trim() ? formato.trim() : undefined,
    });
    res.json(options);
  } catch (error) {
    console.error('Error fetching margen agrupación options:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /margenes/precios-gri — costos GRI de referencia por SKU.
// Lee el snapshot persistido en gri_prices_cache (poblado por el ETL de costos y
// por el endpoint interno). Devuelve { SKU: { price, date } } igual que la interna.
router.get('/margenes/precios-gri', async (req: ApiAuthRequest, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const whereClause = search
      ? sql`WHERE UPPER(TRIM(sku)) LIKE ${'%' + search.toUpperCase() + '%'}`
      : sql``;
    const result = await db.execute(sql`
      SELECT UPPER(TRIM(sku)) AS sku, price::float8 AS price, fecha::text AS fecha
      FROM gri_prices_cache
      ${whereClause}
    `);
    const priceMap: Record<string, { price: number; date: string | null }> = {};
    for (const row of ((result as any).rows ?? [])) {
      if (row.sku != null && row.price != null) {
        priceMap[row.sku] = { price: Number(row.price), date: row.fecha ?? null };
      }
    }
    res.json(priceMap);
  } catch (error) {
    console.error('Error fetching GRI prices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /margenes/top-productos — ranking de productos por ventas facturadas (excluye GDV).
router.get('/margenes/top-productos', async (req: ApiAuthRequest, res) => {
  try {
    const { period, filterType, salesperson, segment, client } = req.query;
    const { startDate, endDate } = marginDateRange(period as string | undefined, filterType as string | undefined);
    const limit = req.query.limit ? parseLimit(req.query.limit, 10) : undefined;

    const result = await storage.getTopProducts(
      limit,
      startDate,
      endDate,
      salesperson as string | undefined,
      segment as string | undefined,
      client as string | undefined,
      [], // sin restricción de scope (API externa)
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /margenes/etl-costos — dispara el ETL de costos (recalcula costos GRI desde
// SQL Server). Sensible: recalcula costos → solo admin. Corre en segundo plano.
router.post('/margenes/etl-costos', requireApiRole(['admin']), async (_req: ApiAuthRequest, res) => {
  try {
    executeCostosETL()
      .then((result) => {
        console.log(`✅ [API externa] ETL costos completado: ${result.recordsProcessed} SKUs, ${result.newSnapshots} nuevos snapshots`);
      })
      .catch((error) => {
        console.error('❌ [API externa] ETL costos error:', error);
      });
    res.json({ success: true, message: 'ETL de costos iniciado en segundo plano', isRunning: true });
  } catch (error: any) {
    console.error('Error triggering ETL costos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /margenes/etl-costos/estado — estado / última ejecución del ETL de costos.
router.get('/margenes/etl-costos/estado', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    const status = await getETLStatus('costos', startDate as string | undefined, endDate as string | undefined);
    res.json(status);
  } catch (error: any) {
    console.error('Error fetching ETL costos status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Márgenes sobre ventas facturadas
// ============================================
// Espejo de las rutas internas /api/sales/margins* (server/routes.ts): margen real
// calculado sobre fact_ventas (excluye GDV), con revenue = monto y costo unitario =
// COALESCE(costo GRI, ppprpm, listacost, price_list.costo_produccion).
//
// OJO — no confundir con /margenes/productos: esa es la tabla de catálogo (precio de
// lista vs costo) y no sabe nada de lo efectivamente vendido. Estas rutas responden
// "cuánto margen dejó lo que se vendió", que es lo que se pregunta comercialmente.

// Resuelve la ventana de fechas de un endpoint de margen/comparativa.
// Prioridad: startDate/endDate explícitos > period (+filterType) > mes en curso.
// Si no se pasa filterType se deduce del formato de period, igual que /dashboard.
function ventasFilterType(period: string, explicit?: string): string {
  if (explicit) return explicit;
  if (/^\d{4}$/.test(period)) return 'year';
  if (/^\d{4}-\d{2}$/.test(period)) return 'month';
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return 'day';
  if (period === 'current-month' || period === 'last-month') return 'month';
  return 'range';
}

function ventasWindow(query: Record<string, unknown>): {
  startDate: string;
  endDate: string;
  period: string;
  filterType: string;
} {
  const rawStart = typeof query.startDate === 'string' ? query.startDate.trim() : '';
  const rawEnd = typeof query.endDate === 'string' ? query.endDate.trim() : '';
  const rawPeriod = typeof query.period === 'string' && query.period.trim() ? query.period.trim() : '';
  const rawFilterType = typeof query.filterType === 'string' && query.filterType.trim() ? query.filterType.trim() : undefined;

  // Rango explícito: gana sobre todo lo demás.
  if (rawStart && rawEnd) {
    return { startDate: rawStart, endDate: rawEnd, period: `${rawStart}_${rawEnd}`, filterType: 'range' };
  }

  const now = new Date();
  const period = rawPeriod || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filterType = ventasFilterType(period, rawFilterType);
  const range = marginDateRange(period, filterType);

  // marginDateRange devuelve {} ante un period que no sabe interpretar; caemos al mes en curso.
  if (!range.startDate || !range.endDate) {
    const fallback = marginDateRange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, 'month');
    return {
      startDate: fallback.startDate!,
      endDate: fallback.endDate!,
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      filterType: 'month',
    };
  }

  return { startDate: range.startDate, endDate: range.endDate, period, filterType };
}

// GET /margenes/ventas — métricas de margen del período: revenue, costo, margen $,
// margen % ponderado y simple, y los productos de mayor y menor margen.
router.get('/margenes/ventas', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { salesperson, segment, client } = req.query;

    const metrics = await storage.getMarginMetrics({
      startDate,
      endDate,
      salesperson: salesperson as string | undefined,
      segment: segment as string | undefined,
      client: client as string | undefined,
    });

    res.json({ period, filterType, dateRange: { startDate, endDate }, ...metrics });
  } catch (error) {
    console.error('Error fetching margen de ventas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /margenes/ventas/por-producto — ranking de productos por margen del período.
router.get('/margenes/ventas/por-producto', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { salesperson, segment, sortBy } = req.query;
    const sortByValid = ['highest', 'lowest', 'revenue'].includes(sortBy as string)
      ? (sortBy as 'highest' | 'lowest' | 'revenue')
      : 'highest';

    const items = await storage.getMarginByProduct({
      startDate,
      endDate,
      salesperson: salesperson as string | undefined,
      segment: segment as string | undefined,
      sortBy: sortByValid,
      limit: parseLimit(req.query.limit, 20, 100),
    });

    res.json({ period, filterType, dateRange: { startDate, endDate }, sortBy: sortByValid, items });
  } catch (error) {
    console.error('Error fetching margen por producto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /margenes/ventas/por-vendedor — margen del período agrupado por vendedor.
router.get('/margenes/ventas/por-vendedor', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { segment } = req.query;

    const items = await storage.getMarginBySalesperson({
      startDate,
      endDate,
      segment: segment as string | undefined,
    });

    res.json({ period, filterType, dateRange: { startDate, endDate }, items });
  } catch (error) {
    console.error('Error fetching margen por vendedor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /margenes/ventas/por-segmento — margen del período agrupado por segmento.
router.get('/margenes/ventas/por-segmento', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { salesperson } = req.query;

    const items = await storage.getMarginBySegment({
      startDate,
      endDate,
      salesperson: salesperson as string | undefined,
    });

    res.json({ period, filterType, dateRange: { startDate, endDate }, items });
  } catch (error) {
    console.error('Error fetching margen por segmento:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Comparativa de períodos
// ============================================
// No existe equivalente interno: la intranet muestra un período a la vez. Este
// endpoint resuelve en una sola llamada la pregunta comercial más frecuente
// ("¿cómo venimos contra el mes pasado / el año pasado?") devolviendo ambos
// períodos ya calculados más el delta, en vez de obligar a dos consultas y la
// aritmética a mano.

// Parseo/formateo de YYYY-MM-DD en hora local. `new Date('2026-07-01')` se
// interpreta como UTC y en Chile (UTC-4/-3) retrocede un día; construir con
// componentes evita ese corrimiento.
function ventasParseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Ventana anterior equivalente. Para año/mes/día se desplaza por calendario
// (julio 1-26 contra junio 1-26, no contra "los 26 días previos"), que es la
// comparación que espera un vendedor. Para rangos libres se usa la ventana
// contigua de la misma cantidad de días.
function ventasPreviousWindow(
  startDate: string,
  endDate: string,
  filterType: string,
): { startDate: string; endDate: string } {
  const start = ventasParseLocal(startDate);
  const end = ventasParseLocal(endDate);

  if (filterType === 'year') {
    return {
      startDate: marginFmtDateLocal(new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())),
      endDate: marginFmtDateLocal(new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())),
    };
  }

  if (filterType === 'month') {
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    // Último día del mes anterior: día 0 del mes siguiente.
    const prevMonthLastDay = new Date(prevStart.getFullYear(), prevStart.getMonth() + 1, 0).getDate();
    const prevEnd = new Date(
      prevStart.getFullYear(),
      prevStart.getMonth(),
      Math.min(end.getDate(), prevMonthLastDay),
    );
    return { startDate: marginFmtDateLocal(prevStart), endDate: marginFmtDateLocal(prevEnd) };
  }

  if (filterType === 'day') {
    const prev = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
    return { startDate: marginFmtDateLocal(prev), endDate: marginFmtDateLocal(prev) };
  }

  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - days);
  return { startDate: marginFmtDateLocal(prevStart), endDate: marginFmtDateLocal(prevEnd) };
}

function ventasDelta(current: number, previous: number): { abs: number; pct: number | null } {
  const abs = Math.round((current - previous) * 100) / 100;
  // Sin base previa el porcentaje no significa nada: null en vez de un 100% falso.
  const pct = previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
  return { abs, pct };
}

// GET /ventas/comparar — dos períodos lado a lado con delta absoluto y porcentual.
// Por defecto compara contra el período anterior equivalente; se puede fijar otro
// con comparePeriod (o compareStartDate/compareEndDate).
router.get('/ventas/comparar', async (req: ApiAuthRequest, res) => {
  try {
    const query = req.query as Record<string, unknown>;
    const current = ventasWindow(query);
    const { salesperson, segment, client } = req.query;

    // Período de comparación: explícito o el anterior equivalente.
    const hasExplicitCompare =
      (typeof query.comparePeriod === 'string' && query.comparePeriod.trim()) ||
      (typeof query.compareStartDate === 'string' && typeof query.compareEndDate === 'string');

    const previous = hasExplicitCompare
      ? ventasWindow({
          period: query.comparePeriod,
          filterType: query.compareFilterType ?? current.filterType,
          startDate: query.compareStartDate,
          endDate: query.compareEndDate,
        })
      : { ...ventasPreviousWindow(current.startDate, current.endDate, current.filterType), period: '', filterType: current.filterType };

    const includeBreakdown = String(query.includeBreakdown ?? 'true') !== 'false';
    const salesFilters = {
      salesperson: salesperson as string | undefined,
      segment: segment as string | undefined,
      client: client as string | undefined,
    };

    const [curSales, prevSales, curMargin, prevMargin] = await Promise.all([
      storage.getSalesMetrics({ startDate: current.startDate, endDate: current.endDate, ...salesFilters }),
      storage.getSalesMetrics({ startDate: previous.startDate, endDate: previous.endDate, ...salesFilters }),
      storage.getMarginMetrics({ startDate: current.startDate, endDate: current.endDate, ...salesFilters }),
      storage.getMarginMetrics({ startDate: previous.startDate, endDate: previous.endDate, ...salesFilters }),
    ]);

    const shape = (
      window: { startDate: string; endDate: string },
      sales: Awaited<ReturnType<typeof storage.getSalesMetrics>>,
      margin: Awaited<ReturnType<typeof storage.getMarginMetrics>>,
    ) => ({
      dateRange: { startDate: window.startDate, endDate: window.endDate },
      sales: sales.totalSales,
      units: sales.totalUnits,
      transactions: sales.salesTransactionCount,
      activeCustomers: sales.activeCustomers,
      averageTicket:
        sales.salesTransactionCount > 0 ? Math.round(sales.totalSales / sales.salesTransactionCount) : 0,
      marginAmount: margin.totalMarginAmount,
      marginPct: margin.averageMarginPct,
    });

    const cur = shape(current, curSales, curMargin);
    const prev = shape(previous, prevSales, prevMargin);

    const response: Record<string, unknown> = {
      filterType: current.filterType,
      current: { period: current.period, ...cur },
      previous: { period: previous.period || null, ...prev },
      delta: {
        sales: ventasDelta(cur.sales, prev.sales),
        units: ventasDelta(cur.units, prev.units),
        transactions: ventasDelta(cur.transactions, prev.transactions),
        activeCustomers: ventasDelta(cur.activeCustomers, prev.activeCustomers),
        averageTicket: ventasDelta(cur.averageTicket, prev.averageTicket),
        marginAmount: ventasDelta(cur.marginAmount, prev.marginAmount),
        // El margen % es una tasa: la variación se informa en puntos porcentuales.
        marginPct: { abs: Math.round((cur.marginPct - prev.marginPct) * 100) / 100, unit: 'puntos porcentuales' },
      },
      filters: {
        salesperson: (salesperson as string) || null,
        segment: (segment as string) || null,
        client: (client as string) || null,
      },
    };

    // Apertura por segmento y por vendedor, con las mismas dos ventanas.
    if (includeBreakdown) {
      const [curSeg, prevSeg, curVend, prevVend] = await Promise.all([
        storage.getMarginBySegment({ startDate: current.startDate, endDate: current.endDate, salesperson: salesperson as string | undefined }),
        storage.getMarginBySegment({ startDate: previous.startDate, endDate: previous.endDate, salesperson: salesperson as string | undefined }),
        storage.getMarginBySalesperson({ startDate: current.startDate, endDate: current.endDate, segment: segment as string | undefined }),
        storage.getMarginBySalesperson({ startDate: previous.startDate, endDate: previous.endDate, segment: segment as string | undefined }),
      ]);

      const merge = <T extends { revenue: number; marginAmount: number; marginPct: number }>(
        key: string,
        currentRows: T[],
        previousRows: T[],
      ) => {
        const prevByKey = new Map(previousRows.map((r) => [String((r as any)[key]), r]));
        const keys = new Set([
          ...currentRows.map((r) => String((r as any)[key])),
          ...previousRows.map((r) => String((r as any)[key])),
        ]);
        return Array.from(keys)
          .map((k) => {
            const c = currentRows.find((r) => String((r as any)[key]) === k);
            const p = prevByKey.get(k);
            return {
              [key]: k,
              current: { revenue: c?.revenue ?? 0, marginAmount: c?.marginAmount ?? 0, marginPct: c?.marginPct ?? 0 },
              previous: { revenue: p?.revenue ?? 0, marginAmount: p?.marginAmount ?? 0, marginPct: p?.marginPct ?? 0 },
              delta: {
                revenue: ventasDelta(c?.revenue ?? 0, p?.revenue ?? 0),
                marginAmount: ventasDelta(c?.marginAmount ?? 0, p?.marginAmount ?? 0),
              },
            };
          })
          .sort((a, b) => b.current.revenue - a.current.revenue);
      };

      response.bySegment = merge('segment', curSeg, prevSeg);
      response.bySalesperson = merge('salesperson', curVend, prevVend);
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching comparativa de ventas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Estadísticas de ventas — rankings y fichas
// ============================================
// La API tenía agregados (dashboard, márgenes, comparativa) pero ningún ranking, y
// eso dejaba sin respuesta la familia de preguntas más común del negocio: "los 50
// clientes que más compraron el 2025", "qué vendedor vendió más este mes", "los 20
// productos top de Ferreterías". La única salida era paginar /clientes, que
// devuelve la ficha completa del ERP (100+ columnas, la mayoría vacías) y cuyo
// totalSales es el histórico del cliente y no lo del período: la respuesta se
// cortaba por tamaño y encima el número no era el pedido.
//
// Estas rutas agregan en SQL sobre ventas.fact_ventas (excluye GDV, igual que el
// dashboard) y devuelven el ranking ya ordenado, con porcentaje del período y
// porcentaje acumulado — con eso el "20% de clientes que hace el 80% de la venta"
// se lee directo de la respuesta, sin sumar a mano.
//
// La ventana temporal es la misma de márgenes y comparativa (ventasWindow):
// period = YYYY | YYYY-MM | YYYY-MM-DD | current-month | last-month |
// last-30-days | last-90-days, o startDate + endDate para un rango libre.

function ventasPct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
}

// Agrega `rank`, `percentage` (sobre el total del período) y `percentageAcumulado`
// (Pareto) a un ranking ya ordenado de mayor a menor.
function ventasRankear<T extends { totalSales: number }>(
  items: T[],
  periodTotalSales: number,
): Array<T & { rank: number; percentage: number; percentageAcumulado: number }> {
  let acumulado = 0;
  return items.map((item, i) => {
    acumulado += item.totalSales;
    return {
      ...item,
      rank: i + 1,
      percentage: ventasPct(item.totalSales, periodTotalSales),
      percentageAcumulado: ventasPct(acumulado, periodTotalSales),
    };
  });
}

// Resuelve un nombre parcial ("el martillo", "jesus") al valor exacto que usa el
// ERP, porque los filtros de las estadísticas comparan por igualdad. Prioriza la
// coincidencia exacta (sin distinguir mayúsculas) y si no hay, la de mayor venta
// en la ventana. Devuelve también las otras candidatas para que el asistente pueda
// avisar cuando el nombre era ambiguo en vez de responder por el cliente equivocado.
async function resolverNombreVentas(
  campo: 'nokoen' | 'nokofu' | 'nokoprct',
  valor: string,
  startDate: string,
  endDate: string,
): Promise<{ exact: string | null; matches: Array<{ name: string; totalSales: number }> }> {
  const buscado = valor.trim();
  if (!buscado) return { exact: null, matches: [] };

  const col = sql.raw(campo);
  const result = await db.execute(sql`
    SELECT ${col} AS name, COALESCE(SUM(monto), 0)::float8 AS total_sales
    FROM ventas.fact_ventas
    WHERE tido <> 'GDV'
      AND feemdo >= ${startDate}::date
      AND feemdo <= ${endDate}::date
      AND ${col} ILIKE ${`%${buscado}%`}
    GROUP BY ${col}
    ORDER BY 2 DESC
    LIMIT 8
  `);

  const matches = (((result as any).rows ?? []) as any[])
    .map((r) => ({ name: String(r.name ?? '').trim(), totalSales: Number(r.total_sales) }))
    .filter((r) => r.name !== '');

  if (matches.length === 0) return { exact: null, matches: [] };
  const exacto = matches.find((m) => m.name.toLowerCase() === buscado.toLowerCase());
  return { exact: (exacto ?? matches[0]).name, matches };
}

// Primera y última compra + segmentos en los que aparece. Complementa a
// getSalesMetrics, que no las trae, para las fichas.
async function ventasBordesPeriodo(
  campo: 'nokoen' | 'nokofu' | 'nokoprct',
  valorExacto: string,
  startDate: string,
  endDate: string,
): Promise<{ primeraVenta: string | null; ultimaVenta: string | null; segmentos: string[] }> {
  const col = sql.raw(campo);
  const result = await db.execute(sql`
    SELECT MIN(feemdo)::text AS primera, MAX(feemdo)::text AS ultima,
           ARRAY_AGG(DISTINCT noruen) FILTER (WHERE noruen IS NOT NULL AND noruen <> '') AS segmentos
    FROM ventas.fact_ventas
    WHERE tido <> 'GDV'
      AND feemdo >= ${startDate}::date
      AND feemdo <= ${endDate}::date
      AND ${col} = ${valorExacto}
  `);
  const row = (((result as any).rows ?? [])[0] ?? {}) as any;
  return {
    primeraVenta: row.primera ?? null,
    ultimaVenta: row.ultima ?? null,
    segmentos: Array.isArray(row.segmentos) ? row.segmentos.map((s: string) => String(s).trim()) : [],
  };
}

// GET /ventas/top-clientes — ranking de clientes por venta facturada del período.
// Esta es la que faltaba: responde "los 50 clientes con más venta el 2025" en una
// sola llamada, con el monto del período (no el histórico) y el acumulado Pareto.
router.get('/ventas/top-clientes', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { salesperson, segment, product } = req.query;
    const limit = parseLimit(req.query.limit, 20, 500);

    const result = await storage.getTopClients(
      limit,
      startDate,
      endDate,
      salesperson as string | undefined,
      segment as string | undefined,
      product as string | undefined,
      [], // sin restricción de scope (API externa)
    );

    res.json({
      period,
      filterType,
      dateRange: { startDate, endDate },
      filters: {
        salesperson: (salesperson as string) || null,
        segment: (segment as string) || null,
        product: (product as string) || null,
      },
      periodTotalSales: result.periodTotalSales,
      clientesConVenta: result.totalCount,
      limit,
      items: ventasRankear(result.items, result.periodTotalSales),
    });
  } catch (error) {
    console.error('Error fetching top clientes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ventas/top-vendedores — ranking de vendedores por venta facturada.
// Es el volumen, no el margen: para "quién dejó más plata" va /margenes/ventas/por-vendedor.
router.get('/ventas/top-vendedores', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { segment, client, product } = req.query;
    const limit = parseLimit(req.query.limit, 20, 200);

    const result = await storage.getTopSalespeople(
      limit,
      startDate,
      endDate,
      segment as string | undefined,
      client as string | undefined,
      product as string | undefined,
      [],
    );

    res.json({
      period,
      filterType,
      dateRange: { startDate, endDate },
      filters: {
        segment: (segment as string) || null,
        client: (client as string) || null,
        product: (product as string) || null,
      },
      periodTotalSales: result.periodTotalSales,
      vendedoresConVenta: result.totalCount,
      limit,
      items: ventasRankear(result.items, result.periodTotalSales),
    });
  } catch (error) {
    console.error('Error fetching top vendedores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ventas/top-productos — ranking de productos por venta facturada.
// Mismos datos que /margenes/top-productos (que quedó colgando del módulo de
// márgenes por historia), pero acepta el vocabulario completo de period.
router.get('/ventas/top-productos', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { salesperson, segment, client } = req.query;
    const limit = parseLimit(req.query.limit, 20, 500);

    const result = await storage.getTopProducts(
      limit,
      startDate,
      endDate,
      salesperson as string | undefined,
      segment as string | undefined,
      client as string | undefined,
      [],
    );

    res.json({
      period,
      filterType,
      dateRange: { startDate, endDate },
      filters: {
        salesperson: (salesperson as string) || null,
        segment: (segment as string) || null,
        client: (client as string) || null,
      },
      periodTotalSales: result.periodTotalSales,
      productosConVenta: result.totalCount,
      limit,
      items: ventasRankear(result.items, result.periodTotalSales),
    });
  } catch (error) {
    console.error('Error fetching top productos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ventas/por-segmento — participación de cada segmento comercial en la venta
// del período. Es el mismo corte que muestra el dashboard, pero como recurso propio.
router.get('/ventas/por-segmento', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { salesperson, segment } = req.query;

    const items = await storage.getSegmentAnalysis(
      startDate,
      endDate,
      salesperson as string | undefined,
      segment as string | undefined,
      [],
    );

    res.json({
      period,
      filterType,
      dateRange: { startDate, endDate },
      filters: { salesperson: (salesperson as string) || null, segment: (segment as string) || null },
      totalSales: items.reduce((acc, s) => acc + s.totalSales, 0),
      items,
    });
  } catch (error) {
    console.error('Error fetching ventas por segmento:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ventas/tendencia — serie temporal de la venta del período.
// granularidad: daily | weekly | monthly. Por defecto, mensual para un período
// anual y diaria para el resto, que es como la dibuja la intranet.
router.get('/ventas/tendencia', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { salesperson, segment, client, product } = req.query;

    const pedida = String(req.query.granularidad ?? '').trim();
    const granularidad: 'daily' | 'weekly' | 'monthly' =
      pedida === 'daily' || pedida === 'weekly' || pedida === 'monthly'
        ? pedida
        : filterType === 'year' ? 'monthly' : 'daily';

    const items = await storage.getSalesChartData(
      granularidad,
      startDate,
      endDate,
      salesperson as string | undefined,
      segment as string | undefined,
      client as string | undefined,
      product as string | undefined,
      undefined,
      [],
    );

    res.json({
      period,
      filterType,
      granularidad,
      dateRange: { startDate, endDate },
      filters: {
        salesperson: (salesperson as string) || null,
        segment: (segment as string) || null,
        client: (client as string) || null,
        product: (product as string) || null,
      },
      totalSales: items.reduce((acc, p) => acc + p.sales, 0),
      items,
    });
  } catch (error) {
    console.error('Error fetching tendencia de ventas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ventas/ficha-cliente?nombre= — todo lo que compró un cliente en el período:
// métricas, qué le vendimos y quién se lo vendió. El nombre puede ser parcial: se
// resuelve al del ERP (por eso va como query param y no en el path — los nombres
// del ERP traen puntos, comas y barras).
router.get('/ventas/ficha-cliente', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const nombre = String(req.query.nombre ?? req.query.cliente ?? '').trim();
    if (!nombre) return res.status(400).json({ error: 'nombre is required' });

    const { exact, matches } = await resolverNombreVentas('nokoen', nombre, startDate, endDate);
    if (!exact) {
      return res.status(404).json({ error: `Sin ventas de un cliente que coincida con "${nombre}" en el período`, period, dateRange: { startDate, endDate } });
    }

    const [metrics, bordes, topProductos, vendedores] = await Promise.all([
      storage.getSalesMetrics({ startDate, endDate, client: exact }),
      ventasBordesPeriodo('nokoen', exact, startDate, endDate),
      storage.getTopProducts(parseLimit(req.query.limitProductos, 10, 100), startDate, endDate, undefined, undefined, exact, []),
      storage.getTopSalespeople(5, startDate, endDate, undefined, exact, undefined, []),
    ]);

    res.json({
      cliente: exact,
      coincidencias: matches.filter((m) => m.name !== exact),
      period,
      filterType,
      dateRange: { startDate, endDate },
      metricas: {
        totalSales: metrics.totalSales,
        unidades: metrics.totalUnits,
        transacciones: metrics.salesTransactionCount,
        documentos: metrics.totalOrders,
        ticketPromedio: metrics.salesTransactionCount > 0
          ? Math.round(metrics.totalSales / metrics.salesTransactionCount)
          : 0,
        primeraVenta: bordes.primeraVenta,
        ultimaVenta: bordes.ultimaVenta,
        segmentos: bordes.segmentos,
      },
      topProductos: ventasRankear(topProductos.items, metrics.totalSales),
      vendedores: ventasRankear(vendedores.items, metrics.totalSales),
    });
  } catch (error) {
    console.error('Error fetching ficha de ventas del cliente:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ventas/ficha-vendedor?nombre= — desempeño de un vendedor en el período:
// métricas, su cartera top y qué productos mueve.
router.get('/ventas/ficha-vendedor', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const nombre = String(req.query.nombre ?? req.query.vendedor ?? '').trim();
    if (!nombre) return res.status(400).json({ error: 'nombre is required' });

    const { exact, matches } = await resolverNombreVentas('nokofu', nombre, startDate, endDate);
    if (!exact) {
      return res.status(404).json({ error: `Sin ventas de un vendedor que coincida con "${nombre}" en el período`, period, dateRange: { startDate, endDate } });
    }

    const [metrics, bordes, topClientes, topProductos, porSegmento] = await Promise.all([
      storage.getSalesMetrics({ startDate, endDate, salesperson: exact }),
      ventasBordesPeriodo('nokofu', exact, startDate, endDate),
      storage.getTopClients(parseLimit(req.query.limitClientes, 10, 200), startDate, endDate, exact, undefined, undefined, []),
      storage.getTopProducts(parseLimit(req.query.limitProductos, 10, 100), startDate, endDate, exact, undefined, undefined, []),
      storage.getSegmentAnalysis(startDate, endDate, exact, undefined, []),
    ]);

    res.json({
      vendedor: exact,
      coincidencias: matches.filter((m) => m.name !== exact),
      period,
      filterType,
      dateRange: { startDate, endDate },
      metricas: {
        totalSales: metrics.totalSales,
        unidades: metrics.totalUnits,
        transacciones: metrics.salesTransactionCount,
        documentos: metrics.totalOrders,
        clientesAtendidos: metrics.activeCustomers,
        ticketPromedio: metrics.salesTransactionCount > 0
          ? Math.round(metrics.totalSales / metrics.salesTransactionCount)
          : 0,
        primeraVenta: bordes.primeraVenta,
        ultimaVenta: bordes.ultimaVenta,
      },
      topClientes: ventasRankear(topClientes.items, metrics.totalSales),
      topProductos: ventasRankear(topProductos.items, metrics.totalSales),
      porSegmento,
    });
  } catch (error) {
    console.error('Error fetching ficha de ventas del vendedor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ventas/ficha-producto?nombre= — quién compra un producto y quién lo vende.
router.get('/ventas/ficha-producto', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, period, filterType } = ventasWindow(req.query as Record<string, unknown>);
    const { segment } = req.query;
    const nombre = String(req.query.nombre ?? req.query.producto ?? '').trim();
    if (!nombre) return res.status(400).json({ error: 'nombre is required' });

    const { exact, matches } = await resolverNombreVentas('nokoprct', nombre, startDate, endDate);
    if (!exact) {
      return res.status(404).json({ error: `Sin ventas de un producto que coincida con "${nombre}" en el período`, period, dateRange: { startDate, endDate } });
    }

    // Se compone con getSalesMetrics + los rankings en vez de storage.getProductDetails:
    // esa función está declarada dos veces en storage y la que gana en runtime tiene
    // otra firma y otra forma de respuesta.
    const [metrics, bordes, topClientes, vendedores] = await Promise.all([
      storage.getSalesMetrics({ startDate, endDate, product: exact, segment: segment as string | undefined }),
      ventasBordesPeriodo('nokoprct', exact, startDate, endDate),
      storage.getTopClients(parseLimit(req.query.limitClientes, 10, 200), startDate, endDate, undefined, segment as string | undefined, exact, []),
      storage.getTopSalespeople(10, startDate, endDate, segment as string | undefined, undefined, exact, []),
    ]);

    if (metrics.salesTransactionCount === 0) {
      return res.status(404).json({ error: `El producto "${exact}" no registra ventas en el período`, period, dateRange: { startDate, endDate } });
    }

    res.json({
      producto: exact,
      coincidencias: matches.filter((m) => m.name !== exact),
      period,
      filterType,
      dateRange: { startDate, endDate },
      filters: { segment: (segment as string) || null },
      metricas: {
        totalSales: metrics.totalSales,
        unidades: metrics.totalUnits,
        transacciones: metrics.salesTransactionCount,
        clientesCompradores: metrics.activeCustomers,
        ticketPromedio: metrics.salesTransactionCount > 0
          ? Math.round(metrics.totalSales / metrics.salesTransactionCount)
          : 0,
        primeraVenta: bordes.primeraVenta,
        ultimaVenta: bordes.ultimaVenta,
        segmentos: bordes.segmentos,
      },
      topClientes: ventasRankear(topClientes.items, metrics.totalSales),
      vendedores: ventasRankear(vendedores.items, metrics.totalSales),
    });
  } catch (error) {
    console.error('Error fetching ficha de ventas del producto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ╔══════════ MÓDULO: LOGISTICA ══════════╗
// ============================================
// Logística — Envíos / TMS / Rutas de despacho (Read + sync ERP)
// ============================================
// Espeja el módulo interno de Logística (server/routes.ts):
//   - Tablero de despacho (envíos del Market enriquecidos con el TMS)
//   - Sincronización del puente ecommerce↔ERP (erpIdmaeedo)
//   - Espejo del TMS (órdenes + KPIs, detalle por idErp)
//   - Gestión de Rutas del TMS (listado + detalle) — SOLO LECTURA (mirror del TMS)
// A diferencia de la intranet, la API externa NO tiene identidad de vendedor:
// opera con alcance completo (como admin), sin candado por salesperson.

// Índice de etapa dentro del pipeline del TMS (Pendiente → ... → Entregado).
function tmsEtapaIndex(estado: string | null | undefined): number {
  return (TMS_ETAPAS as readonly string[]).indexOf(String(estado ?? ''));
}

// Ventana temporal en días → { fechaDesde, fechaHasta } (YYYY-MM-DD). 0/none = sin límite.
function ventanaFechas(daysRaw: unknown): { fechaDesde?: string; fechaHasta?: string; days: number } {
  const d = Number.parseInt(String(daysRaw ?? '0'), 10);
  if (!Number.isFinite(d) || d <= 0) return { days: 0 };
  const fechaHasta = new Date().toISOString().slice(0, 10);
  const fechaDesde = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { fechaDesde, fechaHasta, days: d };
}

// GET /logistica/envios → tablero de despacho. Pedidos del Market ya ingresados al
// ERP, agrupados por estado (ingresado | preparacion | curso | entregado) y
// enriquecidos con el estado real de entrega del TMS cuando está configurado.
// ?days= acota la ventana (default 90, 0 = sin límite). ?estado= filtra el resultado.
router.get('/logistica/envios', async (req: ApiAuthRequest, res) => {
  try {
    const days = Number.parseInt(String(req.query.days ?? '90'), 10);
    const since = Number.isFinite(days) && days > 0
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      : null;
    const estadoFiltro = typeof req.query.estado === 'string' && req.query.estado
      ? String(req.query.estado).toLowerCase()
      : undefined;

    const allOrders = await storage.getEcommerceOrders({});

    // Solo entran a Logística los pedidos ya ingresados al ERP.
    const logisticStatuses = new Set(['ingresado', 'preparacion', 'sent', 'transito', 'entregado']);
    const relevant = allOrders.filter((o: any) => {
      const st = String(o.status || '').toLowerCase();
      if (st === 'rejected' || st === 'archived') return false;
      if (!o.ingresadoAt && !logisticStatuses.has(st)) return false;
      if (since && o.createdAt && new Date(o.createdAt) < since) return false;
      return true;
    });

    // Puente ecommerce↔ERP: completamos erpIdmaeedo faltante y lo persistimos.
    const sinIdmaeedo = relevant.filter((o: any) => o.erpIdmaeedo == null);
    if (sinIdmaeedo.length > 0) {
      try {
        const matches = await matchEcommerceOrdersToErp(
          sinIdmaeedo.map((o: any) => ({
            id: o.id, clientId: o.clientId, subtotal: o.subtotal,
            total: o.total, createdAt: o.createdAt, ingresadoAt: o.ingresadoAt,
          })),
        );
        if (matches.size > 0) {
          await Promise.all(
            Array.from(matches.entries()).map(async ([orderId, idmaeedo]) => {
              try {
                await db.update(ecommerceOrders).set({ erpIdmaeedo: idmaeedo }).where(eq(ecommerceOrders.id, orderId));
              } catch (e) {
                console.error('[logistica] no se pudo persistir idmaeedo de', orderId, e);
              }
            }),
          );
          for (const o of relevant) {
            const idmaeedo = matches.get(o.id);
            if (idmaeedo) o.erpIdmaeedo = idmaeedo;
          }
        }
      } catch (err) {
        console.error('[logistica] sync ERP (erpIdmaeedo) falló:', err);
      }
    }

    const tmsEnabled = isTmsConfigured();

    const enrichTargets = tmsEnabled
      ? relevant.filter((o: any) =>
          ['sent', 'transito', 'entregado'].includes(String(o.status || '').toLowerCase()) &&
          o.erpIdmaeedo != null)
      : [];

    const tmsById = new Map<string, any>();
    const CONCURRENCY = 6;
    for (let i = 0; i < enrichTargets.length; i += CONCURRENCY) {
      const slice = enrichTargets.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (o: any) => [String(o.id), await fetchTmsShipping(o.erpIdmaeedo as any)] as const),
      );
      for (const [id, estado] of results) tmsById.set(id, estado);
    }

    const internalLabels: Record<string, string> = {
      ingresado: 'Ingresado al ERP', preparacion: 'En preparación',
      sent: 'En curso', transito: 'En curso', entregado: 'Entregado',
    };

    let envios = relevant.map((o: any) => {
      const st = String(o.status || '').toLowerCase();
      const tms = tmsById.get(String(o.id)) || null;
      const envio = tms?.envio || null;

      const internal: 'ingresado' | 'preparacion' | 'curso' | 'entregado' =
        st === 'entregado' ? 'entregado'
        : (st === 'sent' || st === 'transito') ? 'curso'
        : st === 'preparacion' ? 'preparacion'
        : 'ingresado';

      let estado: 'ingresado' | 'preparacion' | 'curso' | 'entregado' = internal;
      let estadoLabel = internalLabels[st]
        || (internal === 'entregado' ? 'Entregado'
          : internal === 'curso' ? 'En curso'
          : internal === 'preparacion' ? 'En preparación'
          : 'Ingresado al ERP');
      let subEstado: string | null = null;

      if (tms) {
        const entrega = envio?.estadoEntrega || null;
        if (entrega === 'Entregado') {
          estado = 'entregado'; estadoLabel = 'Entregado';
        } else if (entrega === 'No Entregado') {
          estado = 'curso'; estadoLabel = 'Entrega fallida'; subEstado = 'fallido';
        } else if (tms.retiroEnBodega) {
          estado = 'curso'; estadoLabel = 'Listo para retiro en bodega'; subEstado = 'retiro';
        } else if (internal === 'curso') {
          estadoLabel = envio?.rutaEstado || entrega || estadoLabel;
        }
      }

      const items = Array.isArray(o.items) ? o.items : [];
      return {
        id: o.id,
        trackingCode: o.trackingCode || null,
        clientName: o.clientName || null,
        clientEmail: o.clientEmail || null,
        clientPhone: o.clientPhone || null,
        salespersonName: o.assignedSalespersonName || null,
        status: o.status,
        estado, estadoLabel, subEstado,
        fecha: o.createdAt,
        ingresadoAt: o.ingresadoAt || null,
        total: o.total,
        itemsCount: items.length,
        erpIdmaeedo: o.erpIdmaeedo != null ? String(o.erpIdmaeedo) : null,
        envio: envio ? {
          estadoEntrega: envio.estadoEntrega ?? null,
          horaEntrega: envio.horaEntrega ?? null,
          operario: envio.operario ?? null,
          patente: envio.patente ?? null,
          rutaEstado: envio.rutaEstado ?? null,
          motivoRechazo: envio.motivoRechazo ?? null,
        } : null,
      };
    });

    // Resumen sobre el set completo (antes de filtrar por estado).
    const resumen = {
      ingresados: envios.filter((e) => e.estado === 'ingresado').length,
      preparacion: envios.filter((e) => e.estado === 'preparacion').length,
      curso: envios.filter((e) => e.estado === 'curso').length,
      entregados: envios.filter((e) => e.estado === 'entregado').length,
      total: envios.length,
    };

    if (estadoFiltro && ['ingresado', 'preparacion', 'curso', 'entregado'].includes(estadoFiltro)) {
      envios = envios.filter((e) => e.estado === estadoFiltro);
    }

    res.json({ tmsEnabled, days: since ? days : 0, resumen, envios });
  } catch (error) {
    console.error('Error fetching logistica envios:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /logistica/sync-erp → empareja pedidos ingresados sin erpIdmaeedo con su NVV
// del ERP (RUT + fecha + monto) y persiste el puente. Devuelve cuántos se vincularon.
router.post('/logistica/sync-erp', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const allOrders = await storage.getEcommerceOrders({});
    const logisticStatuses = new Set(['ingresado', 'preparacion', 'sent', 'transito', 'entregado']);
    const candidatos = allOrders.filter((o: any) => {
      if (o.erpIdmaeedo != null) return false;
      const st = String(o.status || '').toLowerCase();
      if (st === 'rejected' || st === 'archived') return false;
      return !!o.ingresadoAt || logisticStatuses.has(st);
    });

    let vinculados = 0;
    if (candidatos.length > 0) {
      const matches = await matchEcommerceOrdersToErp(
        candidatos.map((o: any) => ({
          id: o.id, clientId: o.clientId, subtotal: o.subtotal,
          total: o.total, createdAt: o.createdAt, ingresadoAt: o.ingresadoAt,
        })),
      );
      if (matches.size > 0) {
        await Promise.all(
          Array.from(matches.entries()).map(async ([orderId, idmaeedo]) => {
            try {
              await db.update(ecommerceOrders).set({ erpIdmaeedo: idmaeedo }).where(eq(ecommerceOrders.id, orderId));
              vinculados++;
            } catch (e) {
              console.error('[logistica/sync-erp] no se pudo persistir idmaeedo de', orderId, e);
            }
          }),
        );
      }
    }

    res.json({ evaluados: candidatos.length, vinculados, tmsEnabled: isTmsConfigured() });
  } catch (error) {
    console.error('Error en logistica sync-erp:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /logistica/tms → espejo del TMS: KPIs por estado + página de órdenes.
// Global o acotado a un cliente por RUT (clienteIdErp). ?days=, ?estado=, ?limit=,
// ?offset=, ?clienteIdErp=, ?fresh=.
router.get('/logistica/tms', async (req: ApiAuthRequest, res) => {
  try {
    const tmsEnabled = isTmsConfigured();
    const { fechaDesde, fechaHasta, days } = ventanaFechas(req.query.days);
    const estado = typeof req.query.estado === 'string' && req.query.estado ? String(req.query.estado) : undefined;
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
    const clienteIdErp = typeof req.query.clienteIdErp === 'string' && req.query.clienteIdErp.trim()
      ? req.query.clienteIdErp.trim() : undefined;
    const fresh = req.query.fresh != null && String(req.query.fresh) !== '' && String(req.query.fresh) !== '0';

    const baseEmpty = {
      tmsEnabled, days,
      clienteIdErp: clienteIdErp || null,
      estados: TMS_ESTADOS_ALL,
      kpis: { total: 0, completadas: 0, fallidas: 0, pendientes: 0, porEstado: {} as Record<string, number> },
      page: { orders: [] as any[], total: 0, limit, offset },
    };
    if (!tmsEnabled) return res.json(baseEmpty);

    const base = { clienteIdErp, fechaDesde, fechaHasta };
    const [counts, page] = await Promise.all([
      fetchTmsEstadoCounts(base, fresh),
      fetchTmsOrders({ ...base, estado, limit, offset }, fresh),
    ]);

    const completadas = counts.porEstado['Entregado'] || 0;
    const fallidas = counts.porEstado['No Entregado'] || 0;
    const pendientes = Math.max(counts.total - completadas - fallidas, 0);

    const orders = page.data.map((o: any) => ({
      idErp: o.idErp,
      numeroDocumento: o.numeroDocumento,
      tipoDocumento: o.tipoDocumento,
      estado: o.estado,
      etapaIndex: tmsEtapaIndex(o.estado),
      esNoEntregado: o.estado === 'No Entregado',
      esRetiroCliente: !!o.esRetiroCliente,
      esDespachoParcial: !!o.esDespachoParcial,
      esBackorder: !!o.esBackorder,
      clienteIdErp: o.clienteIdErp,
      clienteNombre: o.clienteNombre,
      clienteComuna: o.clienteComuna,
      fechaEmision: o.fechaEmision,
      fechaCompromiso: o.fechaCompromiso,
      fechaConfirmacionDespacho: o.fechaConfirmacionDespacho,
      fechaActualizacion: o.fechaActualizacion,
    }));

    res.json({
      tmsEnabled: true, days,
      clienteIdErp: clienteIdErp || null,
      estados: TMS_ESTADOS_ALL,
      kpis: { total: counts.total, completadas, fallidas, pendientes, porEstado: counts.porEstado },
      page: { orders, total: page.total, limit, offset },
    });
  } catch (error) {
    console.error('Error en logistica/tms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /logistica/tms/:idErp → detalle de una orden del TMS (con entregas[]).
router.get('/logistica/tms/:idErp', async (req: ApiAuthRequest, res) => {
  try {
    if (!isTmsConfigured()) {
      return res.status(503).json({ error: 'El TMS no está conectado en este entorno.' });
    }
    const orden = await fetchTmsOrderDetail(String(req.params.idErp || '').trim());
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    const entregas = Array.isArray(orden.entregas) ? orden.entregas : [];
    res.json({
      idErp: orden.idErp,
      numeroDocumento: orden.numeroDocumento,
      tipoDocumento: orden.tipoDocumento,
      estado: orden.estado,
      etapas: TMS_ETAPAS,
      etapaIndex: tmsEtapaIndex(orden.estado),
      esNoEntregado: orden.estado === 'No Entregado',
      esRetiroCliente: !!orden.esRetiroCliente,
      esDespachoParcial: !!orden.esDespachoParcial,
      esBackorder: !!orden.esBackorder,
      clienteIdErp: orden.clienteIdErp,
      clienteNombre: orden.clienteNombre,
      clienteComuna: orden.clienteComuna,
      fechaEmision: orden.fechaEmision,
      fechaCompromiso: orden.fechaCompromiso,
      fechaConfirmacionDespacho: orden.fechaConfirmacionDespacho,
      fechaActualizacion: orden.fechaActualizacion,
      resumen: orden.resumen ?? null,
      items: Array.isArray(orden.items) ? orden.items : [],
      entregas: entregas.map((e: any) => ({
        estadoEntrega: e.estadoEntrega ?? null,
        horaEntrega: e.horaEntrega ?? null,
        operarioNombre: e.operarioNombre ?? null,
        rutaPatente: e.rutaPatente ?? null,
        rutaEstado: e.rutaEstado ?? null,
        direccionEntrega: e.direccionEntrega ?? null,
        motivoRechazo: e.motivoRechazo ?? null,
        fotoEvidenciaUrl: e.fotoEvidenciaUrl ?? null,
        fotoFirmaUrl: e.fotoFirmaUrl ?? null,
        creadoEn: e.creadoEn ?? null,
      })),
    });
  } catch (error) {
    console.error('Error en logistica/tms/:idErp:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /logistica/rutas → espejo de "Gestión de Rutas" del TMS (SOLO LECTURA).
// Filtro por estado (Pendiente | Cargando | En Ruta | Completada) + paginación.
// NOTA: las rutas de DESPACHO viven en el TMS; no hay create/update/delete que espejar.
router.get('/logistica/rutas', async (req: ApiAuthRequest, res) => {
  try {
    const tmsEnabled = isTmsConfigured();
    const estado = typeof req.query.estado === 'string' && req.query.estado ? String(req.query.estado) : undefined;
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '10'), 10) || 10, 1), 100);
    const offset = Math.max(Number.parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
    const fresh = req.query.fresh != null && String(req.query.fresh) !== '' && String(req.query.fresh) !== '0';

    if (!tmsEnabled) {
      return res.json({ tmsEnabled: false, estados: TMS_RUTA_ESTADOS, data: [], total: 0, limit, offset });
    }
    const result = await fetchTmsRutas({ estado, limit, offset }, fresh);
    res.json({ tmsEnabled: true, estados: TMS_RUTA_ESTADOS, ...result });
  } catch (error) {
    console.error('Error en logistica/rutas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /logistica/rutas/:id → detalle de una ruta del TMS (con entregas[]).
router.get('/logistica/rutas/:id', async (req: ApiAuthRequest, res) => {
  try {
    if (!isTmsConfigured()) {
      return res.status(503).json({ error: 'El TMS no está conectado en este entorno.' });
    }
    const fresh = req.query.fresh != null && String(req.query.fresh) !== '' && String(req.query.fresh) !== '0';
    const ruta = await fetchTmsRutaDetail(String(req.params.id || '').trim(), fresh);
    if (!ruta) return res.status(404).json({ error: 'Ruta no encontrada' });
    res.json(ruta);
  } catch (error) {
    console.error('Error en logistica/rutas/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ╔══════════ MÓDULO: MARKETING ══════════╗
// ============================================
// MARKETING MODULE (external mirror of /api/marketing)
// Política de roles:
//   GET            → sin guard
//   Inventario / Proveedores / Creatividades / Guiones (no financieros):
//                    POST/PATCH → requireApiRole(['read_write','admin'])
//   Gastos / Presupuesto (financieros):
//                    POST/PATCH → requireApiRole(['admin'])
//   TODO DELETE    → requireApiRole(['admin'])
// No se exponen: uploads de archivos, Meta Ads, WhatsApp ni Solicitudes/Hitos/Competencia.
// ============================================

// ---- Inventario POP / merchandising (no financiero) ----

router.get('/marketing/inventario', async (req: ApiAuthRequest, res) => {
  try {
    const { search, estado } = req.query as { search?: string; estado?: string };
    const items = await storage.getInventarioMarketing({
      search: search || undefined,
      estado: estado || undefined,
      limit: parseLimit(req.query.limit, 500, 5000),
      offset: parseOffset(req.query.offset),
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching marketing inventario:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/marketing/inventario/summary', async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getInventarioMarketingSummary());
  } catch (error) {
    console.error('Error fetching inventario summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/marketing/inventario/:id', async (req: ApiAuthRequest, res) => {
  try {
    const item = await storage.getInventarioMarketingById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(item);
  } catch (error) {
    console.error('Error fetching inventario item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/marketing/inventario/:id/movimientos', async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getInventarioMarketingMovimientosByItemId(req.params.id));
  } catch (error) {
    console.error('Error fetching inventario movimientos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/marketing/inventario', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    if (!req.body?.nombre) return res.status(400).json({ error: 'nombre is required' });
    const item = await storage.createInventarioMarketing(req.body);
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating inventario item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/inventario/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const existing = await storage.getInventarioMarketingById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(await storage.updateInventarioMarketing(req.params.id, req.body));
  } catch (error) {
    console.error('Error updating inventario item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/marketing/inventario/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteInventarioMarketing(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting inventario item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Registra un movimiento (entrada/salida/devolucion) y ajusta el stock del item.
router.post('/marketing/inventario/:id/movimientos', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { tipo, cantidad, clienteNombre, nota, usuarioNombre } = req.body || {};
    if (!tipo || !['entrada', 'salida', 'devolucion'].includes(tipo)) {
      return res.status(400).json({ error: "tipo must be one of entrada|salida|devolucion" });
    }
    if (typeof cantidad !== 'number' || cantidad <= 0) {
      return res.status(400).json({ error: 'cantidad must be a positive number' });
    }
    const item = await storage.getInventarioMarketingById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    const movimiento = await storage.createInventarioMarketingMovimiento({
      itemId: req.params.id,
      tipo,
      cantidad,
      clienteNombre: clienteNombre || null,
      nota: nota || null,
      usuarioId: 'api',
      usuarioNombre: usuarioNombre || 'API',
    });
    res.status(201).json(movimiento);
  } catch (error) {
    console.error('Error creating inventario movimiento:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Gastos de marketing (FINANCIERO → escrituras admin) ----

// GET ?mes=&anio=  (ambos) o ?anio= solo (todo el año)
router.get('/marketing/gastos', async (req: ApiAuthRequest, res) => {
  try {
    const { mes, anio } = req.query as { mes?: string; anio?: string };
    if (!anio) return res.status(400).json({ error: 'anio is required (mes optional)' });
    const gastos = mes
      ? await storage.getGastosMarketing(parseInt(mes, 10), parseInt(anio, 10))
      : await storage.getGastosMarketingByAnio(parseInt(anio, 10));
    res.json(gastos);
  } catch (error) {
    console.error('Error fetching gastos marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/marketing/gastos', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { concepto, mes, anio, creadoPorId } = req.body || {};
    if (!concepto || mes == null || anio == null) {
      return res.status(400).json({ error: 'concepto, mes and anio are required' });
    }
    if (!creadoPorId) {
      return res.status(400).json({ error: 'creadoPorId (users.id) is required — resolve with GET /usuarios?source=users' });
    }
    const gasto = await storage.createGastoMarketing(req.body);
    res.status(201).json(gasto);
  } catch (error) {
    console.error('Error creating gasto marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/gastos/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.updateGastoMarketing(req.params.id, req.body));
  } catch (error) {
    console.error('Error updating gasto marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/marketing/gastos/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteGastoMarketing(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting gasto marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agrega un comentario al hilo del gasto (jsonb comentarios[]).
router.post('/marketing/gastos/:id/comentarios', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { contenido, autor } = req.body || {};
    if (!contenido || !String(contenido).trim()) {
      return res.status(400).json({ error: 'contenido is required' });
    }
    const [currentGasto] = await db
      .select()
      .from(gastosMarketing)
      .where(eq(gastosMarketing.id, req.params.id));
    if (!currentGasto) return res.status(404).json({ error: 'Gasto no encontrado' });

    const existingComments = (currentGasto.comentarios as any[]) || [];
    const newComment = {
      autor: autor || 'API',
      autorId: 'api',
      contenido: String(contenido).trim(),
      fecha: new Date().toISOString(),
    };
    const updated = await storage.updateGastoMarketing(req.params.id, {
      comentarios: [...existingComments, newComment],
    } as any);
    res.status(201).json(updated);
  } catch (error) {
    console.error('Error adding gasto comentario:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Presupuesto de marketing (FINANCIERO → escrituras admin) ----

// Total mensual: GET ?mes=&anio=
router.get('/marketing/presupuesto', async (req: ApiAuthRequest, res) => {
  try {
    const { mes, anio } = req.query as { mes?: string; anio?: string };
    if (!mes || !anio) return res.status(400).json({ error: 'mes and anio are required' });
    const presupuesto = await storage.getPresupuestoMarketing(parseInt(mes, 10), parseInt(anio, 10));
    if (!presupuesto) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    res.json(presupuesto);
  } catch (error) {
    console.error('Error fetching presupuesto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upsert del total mensual (crea o actualiza por mes/anio)
router.post('/marketing/presupuesto', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { mes, anio, presupuestoTotal } = req.body || {};
    if (mes == null || anio == null || presupuestoTotal == null) {
      return res.status(400).json({ error: 'mes, anio and presupuestoTotal are required' });
    }
    const existing = await storage.getPresupuestoMarketing(mes, anio);
    if (existing) {
      return res.json(await storage.updatePresupuestoMarketing(existing.id, { presupuestoTotal }));
    }
    const created = await storage.createPresupuestoMarketing({ mes, anio, presupuestoTotal });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error saving presupuesto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Items del presupuesto (vista tipo Excel, montos por mes)
router.get('/marketing/presupuesto/items', async (req: ApiAuthRequest, res) => {
  try {
    const { anio } = req.query as { anio?: string };
    if (!anio) return res.status(400).json({ error: 'anio is required' });
    res.json(await storage.getPresupuestoMarketingItems(parseInt(anio, 10)));
  } catch (error) {
    console.error('Error fetching presupuesto items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/marketing/presupuesto/items', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { anio, concepto } = req.body || {};
    if (anio == null || !concepto) return res.status(400).json({ error: 'anio and concepto are required' });
    res.status(201).json(await storage.createPresupuestoMarketingItem(req.body));
  } catch (error) {
    console.error('Error creating presupuesto item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/presupuesto/items/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.updatePresupuestoMarketingItem(req.params.id, req.body));
  } catch (error) {
    console.error('Error updating presupuesto item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/marketing/presupuesto/items/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deletePresupuestoMarketingItem(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting presupuesto item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Proveedores de marketing (no financiero) ----

router.get('/marketing/proveedores', async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getProveedoresMarketing());
  } catch (error) {
    console.error('Error fetching proveedores marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/marketing/proveedores', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    if (!req.body?.nombre) return res.status(400).json({ error: 'nombre is required' });
    res.status(201).json(await storage.createProveedorMarketing(req.body));
  } catch (error) {
    console.error('Error creating proveedor marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/proveedores/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.updateProveedorMarketing(req.params.id, req.body));
  } catch (error) {
    console.error('Error updating proveedor marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/marketing/proveedores/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteProveedorMarketing(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting proveedor marketing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Creatividades (no financiero) ----

// GET ?mes=&anio= (default: mes/anio actuales)
router.get('/marketing/creatividades', async (req: ApiAuthRequest, res) => {
  try {
    const mes = parseInt(req.query.mes as string, 10) || (new Date().getMonth() + 1);
    const anio = parseInt(req.query.anio as string, 10) || new Date().getFullYear();
    res.json(await storage.getCreatividadesMarketing(mes, anio));
  } catch (error) {
    console.error('Error fetching creatividades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/marketing/creatividades', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { titulo, mes, anio, creadoPorId } = req.body || {};
    if (!titulo || mes == null || anio == null) {
      return res.status(400).json({ error: 'titulo, mes and anio are required' });
    }
    if (!creadoPorId) {
      return res.status(400).json({ error: 'creadoPorId (users.id) is required — resolve with GET /usuarios?source=users' });
    }
    res.status(201).json(await storage.createCreatividadMarketing(req.body));
  } catch (error) {
    console.error('Error creating creatividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/creatividades/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.updateCreatividadMarketing(req.params.id, req.body));
  } catch (error) {
    console.error('Error updating creatividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/marketing/creatividades/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteCreatividadMarketing(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting creatividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/creatividades/:id/aprobar', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.updateCreatividadMarketing(req.params.id, {
      estadoAprobacion: 'aprobada',
      aprobadoPorId: req.body?.aprobadoPorId || null,
      motivoRechazo: null,
    }));
  } catch (error) {
    console.error('Error approving creatividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/creatividades/:id/rechazar', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.updateCreatividadMarketing(req.params.id, {
      estadoAprobacion: 'rechazada',
      aprobadoPorId: req.body?.aprobadoPorId || null,
      motivoRechazo: req.body?.motivoRechazo || 'Sin motivo especificado',
    }));
  } catch (error) {
    console.error('Error rejecting creatividad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Guiones (no financiero; sin DELETE en la intranet) ----

router.get('/marketing/guiones/:creatividadId', async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getGuionByCreatividadId(req.params.creatividadId));
  } catch (error) {
    console.error('Error fetching guion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/marketing/guiones', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    if (!req.body?.creatividadId) return res.status(400).json({ error: 'creatividadId is required' });
    res.status(201).json(await storage.createGuionMarketing(req.body));
  } catch (error) {
    console.error('Error creating guion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/marketing/guiones/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.updateGuionMarketing(req.params.id, req.body));
  } catch (error) {
    console.error('Error updating guion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ╔══════════ MÓDULO: FINANZAS ══════════╗
// ============================================================================
// FINANZAS (módulo financiero — TODO sensible)
// GET (lectura financiera): requireApiRole(['read_write','admin'])
// Escrituras / aprobaciones / DELETE: requireApiRole(['admin'])
// ============================================================================

const FIN_READ = requireApiRole(['read_write', 'admin']);
const FIN_ADMIN = requireApiRole(['admin']);
// Identificador del actor cuando una operación necesita un "userId" (aprobador, creador).
function apiActorId(req: ApiAuthRequest): string {
  return (req.apiKey?.id as string | undefined) ?? 'api';
}
// Rango de fechas por defecto (mes en curso) para comisiones.
function finDateRange(query: any): { startDate: string; endDate: string } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  let { startDate, endDate } = query || {};
  if (!iso.test(startDate) || !iso.test(endDate)) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    startDate = `${y}-${m}-01`;
    endDate = `${y}-${m}-${String(last).padStart(2, '0')}`;
  }
  return { startDate, endDate };
}

// ─────────────────────────────────────────────
// 1) GASTOS EMPRESARIALES  (/finanzas/gastos)
// ─────────────────────────────────────────────

// Rutas específicas ANTES de /:id para que Express no las capture como id.
router.get('/finanzas/gastos/analytics/summary', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { mes, anio, userId, categoria, estado, segmentCode, centroCostos } = req.query as any;
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (mes) filters.mes = parseInt(mes);
    if (anio) filters.anio = parseInt(anio);
    if (categoria) filters.categoria = categoria;
    if (estado) filters.estado = estado;
    if (segmentCode) filters.segmentCode = segmentCode;
    if (centroCostos) filters.centroCostos = centroCostos;
    res.json(await storage.getGastosEmpresarialesSummary(filters));
  } catch (error: any) {
    console.error('Error gastos summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/gastos/analytics/por-categoria', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { mes, anio, userId, categoria, estado, segmentCode, centroCostos } = req.query as any;
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (mes) filters.mes = parseInt(mes);
    if (anio) filters.anio = parseInt(anio);
    if (categoria) filters.categoria = categoria;
    if (estado) filters.estado = estado;
    if (segmentCode) filters.segmentCode = segmentCode;
    if (centroCostos) filters.centroCostos = centroCostos;
    res.json(await storage.getGastosEmpresarialesByCategoria(filters));
  } catch (error: any) {
    console.error('Error gastos por-categoria:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/gastos/pendientes-rrhh', FIN_READ, async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getReembolsosPendientesRrhh());
  } catch (error: any) {
    console.error('Error gastos pendientes-rrhh:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/gastos', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { estado, fechaDesde, fechaHasta, categoria, segmentCode, centroCostos, userId } = req.query as any;
    const filters: any = { limit: parseLimit(req.query.limit), offset: parseOffset(req.query.offset) };
    if (estado) filters.estado = estado;
    if (fechaDesde) filters.fechaDesde = fechaDesde;
    if (fechaHasta) filters.fechaHasta = fechaHasta;
    if (categoria) filters.categoria = categoria;
    if (segmentCode) filters.segmentCode = segmentCode;
    if (centroCostos) filters.centroCostos = centroCostos;
    if (userId) filters.userId = userId;
    res.json(await storage.getGastosEmpresariales(filters));
  } catch (error: any) {
    console.error('Error fetching gastos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/gastos/:id', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const gasto = await storage.getGastoEmpresarialById(req.params.id);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(gasto);
  } catch (error: any) {
    console.error('Error fetching gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/gastos', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    if (!req.body.userId) {
      return res.status(400).json({ error: 'userId es requerido (usuario dueño del gasto)' });
    }
    const validated = insertGastoEmpresarialSchema.parse(req.body);
    const isConFondo = validated.fundingMode === 'con_fondo' && validated.fundAllocationId;
    validated.tipoGasto = isConFondo ? 'Con Fondos Asignados' : 'Reembolso';
    validated.estado = 'pendiente';
    validated.estadoAprobacion = 'pendiente_rrhh';

    const gasto = await storage.createGastoEmpresarial(validated);

    if (isConFondo && validated.fundAllocationId) {
      await storage.createFundMovement({
        allocationId: validated.fundAllocationId,
        tipoMovimiento: 'gasto_pendiente',
        gastoId: gasto.id,
        monto: `-${validated.monto}`,
        descripcion: `Gasto pendiente: ${validated.descripcion || validated.categoria}`,
        creadoPorId: validated.userId,
      });
    }
    res.status(201).json(gasto);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos', errors: error.errors });
    console.error('Error creating gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Editar campos de un gasto (equivalente a PATCH /:id/editar interno)
router.patch('/finanzas/gastos/:id', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const existing = await storage.getGastoEmpresarialById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

    const allowed = ['monto', 'descripcion', 'categoria', 'tipoDocumento', 'proveedor', 'rutProveedor',
      'numeroDocumento', 'fechaEmision', 'ruta', 'clientes', 'ciudad', 'fundingMode', 'fundAllocationId'];
    const updates: any = {};
    for (const f of allowed) {
      if (req.body[f] !== undefined && req.body[f] !== '') updates[f] = req.body[f];
      else if (req.body[f] === '' && !['monto', 'descripcion', 'categoria'].includes(f)) updates[f] = null;
    }
    if (updates.fundingMode === 'reembolso') updates.fundAllocationId = null;
    if (updates.fechaEmision && !/^\d{4}-\d{2}-\d{2}$/.test(updates.fechaEmision)) {
      return res.status(400).json({ error: 'Fecha de emisión inválida. Formato: YYYY-MM-DD' });
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No se proporcionaron campos para editar' });
    res.json(await storage.updateGastoEmpresarial(req.params.id, updates));
  } catch (error: any) {
    console.error('Error editing gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/gastos/:id/aprobar', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.aprobarGastoEmpresarial(req.params.id, apiActorId(req)));
  } catch (error: any) {
    console.error('Error aprobar gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/gastos/:id/rechazar', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { comentario } = req.body;
    if (!comentario) return res.status(400).json({ error: 'El comentario es requerido para rechazar' });
    res.json(await storage.rechazarGastoEmpresarial(req.params.id, apiActorId(req), comentario));
  } catch (error: any) {
    console.error('Error rechazar gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/gastos/:id/rrhh-approve', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const gasto = await storage.getGastoEmpresarialById(req.params.id);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
    if (!['pendiente_rrhh', 'pendiente_supervisor'].includes(gasto.estadoAprobacion || '')) {
      return res.status(400).json({ error: 'Este gasto no está pendiente de aprobación de RRHH' });
    }
    const { comentario } = req.body;
    res.json(await storage.aprobarReembolsoRrhh(req.params.id, apiActorId(req), gasto.archivoUrl || null, comentario));
  } catch (error: any) {
    console.error('Error rrhh-approve gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/gastos/:id/rrhh-reject', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const gasto = await storage.getGastoEmpresarialById(req.params.id);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
    const { motivoRechazo } = req.body;
    if (!motivoRechazo) return res.status(400).json({ error: 'El motivo del rechazo es requerido' });
    res.json(await storage.rechazarReembolsoRrhh(req.params.id, apiActorId(req), motivoRechazo));
  } catch (error: any) {
    console.error('Error rrhh-reject gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/finanzas/gastos/:id', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const gasto = await storage.getGastoEmpresarialById(req.params.id);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
    await storage.deleteGastoEmpresarial(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting gasto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// 2) FONDOS (fund allocations)  (/finanzas/fondos)
// ─────────────────────────────────────────────

router.get('/finanzas/fondos/pending/rrhh', FIN_READ, async (_req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getFundAllocationsPendingRRHH());
  } catch (error: any) {
    console.error('Error fondos pending rrhh:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/fondos/pending/supervisor', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    // supervisorId opcional (filtra por segmento del supervisor); sin él trae todos los pendientes.
    const supervisorId = (req.query.supervisorId as string) || apiActorId(req);
    res.json(await storage.getFundAllocationsPendingSupervisor(supervisorId));
  } catch (error: any) {
    console.error('Error fondos pending supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/fondos/summary/global', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { userId } = req.query as any;
    res.json(await storage.getFundAllocationSummary(userId || undefined));
  } catch (error: any) {
    console.error('Error fondos summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/fondos/user/:userId', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const all = req.query.all === 'true'
      ? await storage.getUserAllFundAllocations(req.params.userId)
      : await storage.getUserActiveFundAllocations(req.params.userId);
    res.json(all);
  } catch (error: any) {
    console.error('Error fondos user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/fondos/:id/movements', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.getFundMovements(req.params.id));
  } catch (error: any) {
    console.error('Error fondos movements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/fondos/:id', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const allocation = await storage.getFundAllocationById(req.params.id);
    if (!allocation) return res.status(404).json({ error: 'Asignación no encontrada' });
    const balance = await storage.getFundAllocationBalance(allocation.id);
    const movements = await storage.getFundMovements(allocation.id);
    res.json({ ...allocation, ...balance, movements });
  } catch (error: any) {
    console.error('Error fetching fondo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/fondos', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { estado, assignedToId } = req.query as any;
    const filters: any = { limit: parseLimit(req.query.limit), offset: parseOffset(req.query.offset) };
    if (estado) filters.estado = estado;
    if (assignedToId) filters.assignedToId = assignedToId;
    const allocations = await storage.getFundAllocations(filters);
    const enriched = await Promise.all(allocations.map(async (a) => ({
      ...a, ...(await storage.getFundAllocationBalance(a.id)),
    })));
    res.json(enriched);
  } catch (error: any) {
    console.error('Error fetching fondos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/fondos', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    if (!req.body.assignedToId) return res.status(400).json({ error: 'assignedToId (beneficiario) es requerido' });
    const validated = insertFundAllocationSchema.parse({ ...req.body, assignedById: apiActorId(req) });
    res.status(201).json(await storage.createFundAllocation(validated));
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos', errors: error.errors });
    console.error('Error creating fondo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/fondos/:id/approve', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { comprobanteUrl, comprobantePreviewUrl } = req.body;
    if (!comprobanteUrl) return res.status(400).json({ error: 'El comprobante de transferencia (comprobanteUrl) es requerido' });
    res.json(await storage.approveFundAllocation(req.params.id, comprobanteUrl, apiActorId(req), comprobantePreviewUrl));
  } catch (error: any) {
    console.error('Error approve fondo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/fondos/:id/reject', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { motivoRechazo } = req.body;
    if (!motivoRechazo) return res.status(400).json({ error: 'El motivo del rechazo es requerido' });
    res.json(await storage.rejectFundAllocation(req.params.id, motivoRechazo, apiActorId(req)));
  } catch (error: any) {
    console.error('Error reject fondo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/fondos/:id/supervisor-approve', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    res.json(await storage.supervisorApproveFund(req.params.id, apiActorId(req), req.body.comentario));
  } catch (error: any) {
    console.error('Error supervisor-approve fondo:', error);
    res.status(500).json({ error: error.message || 'Error al aprobar solicitud' });
  }
});

router.post('/finanzas/fondos/:id/supervisor-reject', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { comentario } = req.body;
    if (!comentario) return res.status(400).json({ error: 'Se requiere un comentario para rechazar' });
    res.json(await storage.supervisorRejectFund(req.params.id, apiActorId(req), comentario));
  } catch (error: any) {
    console.error('Error supervisor-reject fondo:', error);
    res.status(500).json({ error: error.message || 'Error al rechazar solicitud' });
  }
});

router.post('/finanzas/fondos/:id/rrhh-approve', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { comprobanteUrl, comentario } = req.body;
    if (!comprobanteUrl) return res.status(400).json({ error: 'Se requiere el comprobante de transferencia (comprobanteUrl)' });
    res.json(await storage.rrhhApproveFund(req.params.id, apiActorId(req), comprobanteUrl, comentario));
  } catch (error: any) {
    console.error('Error rrhh-approve fondo:', error);
    res.status(500).json({ error: error.message || 'Error al aprobar solicitud' });
  }
});

router.post('/finanzas/fondos/:id/rrhh-reject', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { comentario } = req.body;
    if (!comentario) return res.status(400).json({ error: 'Se requiere un comentario para rechazar' });
    res.json(await storage.rrhhRejectFund(req.params.id, apiActorId(req), comentario));
  } catch (error: any) {
    console.error('Error rrhh-reject fondo:', error);
    res.status(500).json({ error: error.message || 'Error al rechazar solicitud' });
  }
});

router.patch('/finanzas/fondos/:id/recharge', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { rechargeMode, rechargeAmount, newFechaInicio, newFechaTermino, comentario } = req.body;
    if (!comentario) return res.status(400).json({ error: 'El comentario es requerido' });
    res.json(await storage.rechargeFundAllocation({
      allocationId: req.params.id,
      performedById: apiActorId(req),
      performedByName: 'api',
      rechargeMode: rechargeMode || 'gastado',
      rechargeAmount: rechargeAmount ? parseFloat(rechargeAmount) : undefined,
      newFechaInicio,
      newFechaTermino,
      comentario,
    }));
  } catch (error: any) {
    console.error('Error recharge fondo:', error);
    res.status(500).json({ error: error.message || 'Error al recargar fondo' });
  }
});

router.delete('/finanzas/fondos/:id', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const allocation = await storage.getFundAllocationById(req.params.id);
    if (!allocation) return res.status(404).json({ error: 'Fondo no encontrado' });
    await storage.deleteFundAllocation(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting fondo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// 3) COMISIONES  (/finanzas/comisiones)
// ─────────────────────────────────────────────

router.get('/finanzas/comisiones/summary', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate } = finDateRange(req.query);
    res.json(await getCommissionSummary(startDate, endDate));
  } catch (error: any) {
    console.error('Error comisiones summary:', error);
    res.status(500).json({ error: 'Error calculando comisiones: ' + (error?.message || 'desconocido') });
  }
});

router.get('/finanzas/comisiones/salesperson/:name', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name || '');
    if (!name) return res.status(400).json({ error: 'Vendedor requerido' });
    const { startDate, endDate } = finDateRange(req.query);
    res.json(await getSalespersonDetail(name, startDate, endDate));
  } catch (error: any) {
    console.error('Error comisiones salesperson:', error);
    res.status(500).json({ error: 'Error obteniendo el detalle: ' + (error?.message || 'desconocido') });
  }
});

router.get('/finanzas/comisiones/settings', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { salespersonName } = req.query as any;
    const rows = salespersonName
      ? await db.select().from(commissionSettings).where(eq(commissionSettings.salespersonName, salespersonName))
      : await db.select().from(commissionSettings).orderBy(commissionSettings.salespersonName);
    res.json(rows);
  } catch (error: any) {
    console.error('Error comisiones settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/comisiones/overrides', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { salespersonName } = req.query as any;
    const rows = salespersonName
      ? await db.select().from(commissionOverrides).where(eq(commissionOverrides.salespersonName, salespersonName))
      : await db.select().from(commissionOverrides).orderBy(commissionOverrides.salespersonName);
    res.json(rows);
  } catch (error: any) {
    console.error('Error comisiones overrides:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fijar el % de comisión de un vendedor (admin)
router.put('/finanzas/comisiones/settings', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { salespersonName, commissionPct } = req.body;
    if (!salespersonName || typeof commissionPct !== 'number' || commissionPct < 0 || commissionPct > 100) {
      return res.status(400).json({ error: 'salespersonName y commissionPct (0-100) son requeridos' });
    }
    await db.insert(commissionSettings)
      .values({ salespersonName, commissionPct: String(commissionPct), updatedBy: apiActorId(req), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: commissionSettings.salespersonName,
        set: { commissionPct: String(commissionPct), updatedBy: apiActorId(req), updatedAt: new Date() },
      });
    res.json({ salespersonName, commissionPct });
  } catch (error: any) {
    console.error('Error set comision setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fijar/quitar override de % por cliente o documento (admin). commissionPct=null quita el override.
router.put('/finanzas/comisiones/overrides', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const { salespersonName, overrideType, value, commissionPct } = req.body;
    if (!salespersonName || !['client', 'document'].includes(overrideType) || !value) {
      return res.status(400).json({ error: "salespersonName, overrideType ('client'|'document') y value son requeridos" });
    }
    if (commissionPct !== null && (typeof commissionPct !== 'number' || commissionPct < 0 || commissionPct > 100)) {
      return res.status(400).json({ error: 'commissionPct debe ser número 0-100 o null' });
    }
    if (commissionPct === null) {
      await db.delete(commissionOverrides).where(and(
        eq(commissionOverrides.salespersonName, salespersonName),
        eq(commissionOverrides.overrideType, overrideType),
        eq(commissionOverrides.value, value),
      ));
    } else {
      await db.insert(commissionOverrides)
        .values({ salespersonName, overrideType, value, commissionPct: String(commissionPct), updatedBy: apiActorId(req), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [commissionOverrides.salespersonName, commissionOverrides.overrideType, commissionOverrides.value],
          set: { commissionPct: String(commissionPct), updatedBy: apiActorId(req), updatedAt: new Date() },
        });
    }
    res.json({ salespersonName, overrideType, value, commissionPct });
  } catch (error: any) {
    console.error('Error set comision override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// 4) METAS / GOALS  (/finanzas/metas)
// ─────────────────────────────────────────────

router.get('/finanzas/metas', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { type } = req.query as any;
    res.json(type ? await storage.getGoalsByType(type) : await storage.getGoals());
  } catch (error: any) {
    console.error('Error fetching metas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/metas/:id', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const goal = (await storage.getGoals()).find((g) => g.id === req.params.id);
    if (!goal) return res.status(404).json({ error: 'Meta no encontrada' });
    res.json(goal);
  } catch (error: any) {
    console.error('Error fetching meta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/metas', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const validated = insertGoalSchema.parse(req.body);
    if (validated.type === 'global') validated.target = null;
    res.status(201).json(await storage.createGoal(validated));
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos', errors: error.issues });
    console.error('Error creating meta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/finanzas/metas/:id', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const validated = insertGoalSchema.partial().parse(req.body);
    if (validated.type === 'global') validated.target = null;
    res.json(await storage.updateGoal(req.params.id, validated));
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos', errors: error.issues });
    console.error('Error updating meta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/finanzas/metas/:id', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteGoal(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting meta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// 5) PRESUPUESTO DE VENTAS  (/finanzas/presupuesto-ventas)
// ─────────────────────────────────────────────

router.get('/finanzas/presupuesto-ventas/years', FIN_READ, async (_req: ApiAuthRequest, res) => {
  try {
    const years = await db.selectDistinct({ anio: presupuestoVentas.anio })
      .from(presupuestoVentas).orderBy(desc(presupuestoVentas.anio));
    res.json(years.map((y) => y.anio));
  } catch (error: any) {
    console.error('Error presupuesto years:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/presupuesto-ventas', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
    const records = await db.select().from(presupuestoVentas)
      .where(eq(presupuestoVentas.anio, anio))
      .orderBy(presupuestoVentas.categoria, presupuestoVentas.entidad, presupuestoVentas.mes);
    res.json(records);
  } catch (error: any) {
    console.error('Error presupuesto list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upsert de un solo registro (admin)
router.post('/finanzas/presupuesto-ventas', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const parsed = insertPresupuestoVentasSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.errors });
    const r = parsed.data;
    await db.insert(presupuestoVentas)
      .values({ anio: r.anio, mes: r.mes, categoria: r.categoria, entidad: r.entidad, monto: r.monto })
      .onConflictDoUpdate({
        target: [presupuestoVentas.anio, presupuestoVentas.mes, presupuestoVentas.categoria, presupuestoVentas.entidad],
        set: { monto: sql`EXCLUDED.monto`, updatedAt: sql`NOW()` },
      });
    res.status(201).json({ success: true, record: r });
  } catch (error: any) {
    console.error('Error presupuesto upsert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upsert masivo (admin)
router.post('/finanzas/presupuesto-ventas/bulk', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const parsed = bulkPresupuestoVentasSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.errors });
    const { records } = parsed.data;
    let upserted = 0;
    for (const record of records) {
      await db.insert(presupuestoVentas)
        .values({ anio: record.anio, mes: record.mes, categoria: record.categoria, entidad: record.entidad, monto: record.monto })
        .onConflictDoUpdate({
          target: [presupuestoVentas.anio, presupuestoVentas.mes, presupuestoVentas.categoria, presupuestoVentas.entidad],
          set: { monto: sql`EXCLUDED.monto`, updatedAt: sql`NOW()` },
        });
      upserted++;
    }
    res.json({ success: true, count: upserted, message: `${upserted} registros importados` });
  } catch (error: any) {
    console.error('Error presupuesto bulk:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/finanzas/presupuesto-ventas', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const anio = parseInt(req.query.anio as string);
    if (!anio) return res.status(400).json({ error: 'Parámetro anio es requerido' });
    const deleted = await db.delete(presupuestoVentas).where(eq(presupuestoVentas.anio, anio)).returning();
    res.json({ success: true, count: deleted.length, message: `${deleted.length} registros eliminados del año ${anio}` });
  } catch (error: any) {
    console.error('Error presupuesto delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// 6) PROYECCIONES  (/finanzas/proyecciones)
// ─────────────────────────────────────────────

router.get('/finanzas/proyecciones/historico', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { years, months, salespersonCode, segment, search, onlyWithAllPeriods, sortOrder } = req.query as any;
    const filters: any = { limit: parseLimit(req.query.limit), offset: parseOffset(req.query.offset) };
    if (years) filters.years = String(years).split(',').map((y: string) => parseInt(y));
    if (months) filters.months = String(months).split(',').map((m: string) => parseInt(m));
    if (search) filters.search = search;
    if (salespersonCode) filters.salespersonCode = salespersonCode;
    if (segment && segment !== 'all') filters.segment = segment;
    if (onlyWithAllPeriods === 'true') filters.onlyWithAllPeriods = true;
    if (sortOrder) filters.sortOrder = sortOrder;
    res.json(await storage.getHistoricoVentasPorAnio(filters));
  } catch (error: any) {
    console.error('Error proyecciones historico:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/proyecciones/manual', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { years, months, salespersonCode, segment } = req.query as any;
    const filters: any = {};
    if (years) filters.years = String(years).split(',').map((y: string) => parseInt(y));
    if (months) filters.months = String(months).split(',').map((m: string) => parseInt(m));
    if (salespersonCode) filters.salespersonCode = salespersonCode;
    if (segment) filters.segment = segment;
    res.json(await storage.getProyeccionesVentas(filters));
  } catch (error: any) {
    console.error('Error proyecciones manual:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/finanzas/proyecciones/charts', FIN_READ, async (req: ApiAuthRequest, res) => {
  try {
    const { years, months, salespersonCode, segment } = req.query as any;
    const q: any = {};
    if (years) q.years = String(years).split(',').map((y: string) => parseInt(y));
    if (months) q.months = String(months).split(',').map((m: string) => parseInt(m));

    const projections = await storage.getProyeccionesVentas({ years: q.years, months: q.months });
    let future = projections.filter((p) => p.month !== null);
    if (salespersonCode) {
      future = future.filter((p) => p.salespersonCode && (
        p.salespersonCode === salespersonCode ||
        salespersonCode.includes(p.salespersonCode) ||
        p.salespersonCode.includes(salespersonCode)
      ));
    }
    if (segment) future = future.filter((p) => p.segment === segment);

    const clientData: Record<string, { clientName: string; segment: string; total: number; byMonth: Record<string, number> }> = {};
    const segmentData: Record<string, { total: number; byMonth: Record<string, number> }> = {};
    const salespersonData: Record<string, { total: number; byMonth: Record<string, number> }> = {};

    future.forEach((proj) => {
      const amount = Number(proj.projectedAmount);
      const monthKey = `${proj.year}-${proj.month}`;
      if (!clientData[proj.clientCode]) {
        clientData[proj.clientCode] = { clientName: proj.clientName || proj.clientCode, segment: proj.segment || 'Sin Segmento', total: 0, byMonth: {} };
      }
      clientData[proj.clientCode].total += amount;
      clientData[proj.clientCode].byMonth[monthKey] = (clientData[proj.clientCode].byMonth[monthKey] || 0) + amount;
      const segKey = proj.segment || 'Sin Segmento';
      if (!segmentData[segKey]) segmentData[segKey] = { total: 0, byMonth: {} };
      segmentData[segKey].total += amount;
      segmentData[segKey].byMonth[monthKey] = (segmentData[segKey].byMonth[monthKey] || 0) + amount;
      if (!salespersonData[proj.salespersonCode]) salespersonData[proj.salespersonCode] = { total: 0, byMonth: {} };
      salespersonData[proj.salespersonCode].total += amount;
      salespersonData[proj.salespersonCode].byMonth[monthKey] = (salespersonData[proj.salespersonCode].byMonth[monthKey] || 0) + amount;
    });

    res.json({
      byClient: Object.entries(clientData).map(([code, d]) => ({ clientCode: code, clientName: d.clientName, segment: d.segment, total: d.total, byMonth: d.byMonth })).sort((a, b) => b.total - a.total),
      bySegment: Object.entries(segmentData).map(([segment, d]) => ({ segment, total: d.total, byMonth: d.byMonth })).sort((a, b) => b.total - a.total),
      bySalesperson: Object.entries(salespersonData).map(([code, d]) => ({ salespersonCode: code, total: d.total, byMonth: d.byMonth })).sort((a, b) => b.total - a.total),
    });
  } catch (error: any) {
    console.error('Error proyecciones charts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/finanzas/proyecciones/manual', FIN_ADMIN, async (req: ApiAuthRequest, res) => {
  try {
    const validated = insertProyeccionVentaSchema.parse({ ...req.body, createdBy: apiActorId(req), createdByName: 'api' });
    res.status(201).json(await storage.upsertProyeccionVenta(validated));
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
    console.error('Error proyecciones upsert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;