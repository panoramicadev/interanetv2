import { Router } from 'express';
import { storage } from './storage';
import { validateApiKey, requireApiRole, type ApiAuthRequest } from './middleware/api-auth';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './db';
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
  security: [{ ApiKeyAuth: [] }],
  paths: {
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
        summary: 'Stock de productos por bodega',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'bodega', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: '{ total, items }' } },
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
        summary: 'Lista tareas',
        parameters: [
          { name: 'assignedTo', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Crear tarea',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: {
          title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' },
          dueDate: { type: 'string', format: 'date' }, createdBy: { type: 'string' }, assignments: { type: 'array' },
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
          { name: 'vendedor', in: 'query', schema: { type: 'string' }, description: 'Filtra por vendedorId (salespeople_users.id)' },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['nuevo', 'contactado', 'cotizacion', 'venta', 'despacho', 'completado', 'perdido'] } },
          { name: 'prioridad', in: 'query', schema: { type: 'string', enum: ['baja', 'media', 'alta'] } },
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
            estado: { type: 'string', enum: ['nuevo', 'contactado', 'cotizacion', 'venta', 'despacho', 'completado', 'perdido'], default: 'cotizacion' },
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
          tipo: { type: 'string', enum: ['contacto', 'llamada', 'cotizacion', 'visita', 'venta', 'despacho', 'nota', 'sistema'] },
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
      'GET /ventas': { filters: ['startDate', 'endDate', 'salesperson', 'segment', 'client', 'product', 'client_rut', 'limit', 'offset'] },
      'GET /clientes': { filters: ['search', 'segment', 'salesperson', 'creditStatus', 'businessType', 'debtStatus', 'entityType', 'salesPeriod', 'limit', 'offset'] },
      'GET /usuarios': { filters: ['role', 'source (users|salespeople|all)', 'limit'], note: 'returns { users, salespeople, counts }' },
      'GET /notificaciones': { filters: ['type', 'priority', 'departamento', 'archived', 'targetType', 'userId', 'limit', 'offset'] },
      'POST /notificaciones': { body: ['title*', 'message*', 'type', 'priority', 'departamento', 'actionUrl'] },
      'GET /reclamos': { filters: ['estado', 'areaResponsable', 'gravedad', 'vendedorId', 'tecnicoId', 'responsableAreaId', 'limit', 'offset'] },
      'POST /reclamos': { body: ['clienteNombre*', 'motivo*', 'clienteRut', 'clienteEmail', 'clienteTelefono', 'descripcion', 'severidad'] },
      'GET /mantencion': { filters: ['estado', 'tipoMantencion', 'gravedad', 'area', 'solicitanteId', 'tecnicoAsignadoId', 'limit', 'offset'] },
      'POST /mantencion': { body: ['equipoNombre*', 'descripcionProblema*', 'equipoCodigo', 'equipoArea', 'tipoMantencion', 'severidad', 'solicitadoPor'] },
      'GET /tareas': { filters: ['assignedTo', 'status', 'priority', 'creatorId', 'limit', 'offset'] },
      'POST /tareas': { body: ['title*', 'description', 'priority', 'dueDate', 'createdBy', 'assignments[]'] },
      'PATCH /tareas/:id': { body: ['status', 'notes', '...'] },
      'DELETE /tareas/:id': {},
      'GET /inventario': { filters: ['search', 'bodega', 'limit', 'offset'], note: 'returns { total, offset, limit, items }' },
      'GET /ecommerce/orders': { filters: ['status', 'clientId', 'salespersonId', 'limit', 'offset'] },
      'PATCH /ecommerce/orders/:id': { body: ['status*'] },
      'GET /crm/leads': { filters: ['stage', 'salespersonId', 'supervisorId', 'segment', 'limit', 'offset'] },
      'POST /crm/leads': { body: ['clientName*', 'salespersonId*', 'clientPhone', 'clientEmail', 'clientType', 'estimatedValue', 'notes', 'stage', 'segment'] },
      'PATCH /crm/leads/:id': { body: ['stage', 'notes', '...'] },
      'DELETE /crm/leads/:id': {},
      // Pipeline panel "Seguimiento de Clientes" (control total)
      'GET /crm/seguimiento': { filters: ['vendedor (vendedorId)', 'estado (nuevo|contactado|cotizacion|venta|despacho|completado|perdido)', 'prioridad (baja|media|alta)', 'busqueda (nombre|empresa|rut|email)', 'limit', 'offset'] },
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
      'GET /crm/seguimiento/stats': { filters: ['vendedor'], note: '{ total, porEstado, porPrioridad, sinContacto7Dias }' },
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

router.get('/clientes', async (req: ApiAuthRequest, res) => {
  try {
    const { search, segment, salesperson, creditStatus, businessType, debtStatus, entityType, salesPeriod } = req.query;

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

    res.json(clients);
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
// Reclamos Generales (Read & Create)
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

router.get('/inventario', async (req: ApiAuthRequest, res) => {
  try {
    const { bodega, search } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const all = await storage.getInventory({
      search: search as string | undefined,
      warehouse: bodega as string | undefined,
    });

    res.json({
      total: all.length,
      offset: off,
      limit: lim,
      items: all.slice(off, off + lim),
    });
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

// GET /crm/seguimiento/stats — Pipeline statistics
router.get('/crm/seguimiento/stats', async (req: ApiAuthRequest, res) => {
  try {
    const vendedorFilter = req.query.vendedor as string | undefined;
    const conditions: any[] = [eq(crmSeguimientoClientes.active, true)];
    if (vendedorFilter) {
      conditions.push(eq(crmSeguimientoClientes.vendedorId, vendedorFilter));
    }

    const allClients = await db.select().from(crmSeguimientoClientes).where(and(...conditions));

    const porEstado: Record<string, number> = {};
    const porPrioridad: Record<string, number> = {};
    let sinContacto7Dias = 0;
    const ahora = Date.now();

    for (const c of allClients) {
      porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
      porPrioridad[c.prioridad] = (porPrioridad[c.prioridad] || 0) + 1;
      if (c.ultimoContacto) {
        const diffDays = (ahora - new Date(c.ultimoContacto).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) sinContacto7Dias++;
      } else {
        sinContacto7Dias++;
      }
    }

    res.json({ total: allClients.length, porEstado, porPrioridad, sinContacto7Dias });
  } catch (error) {
    console.error('Error fetching seguimiento stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /crm/seguimiento — List tracked clients (enriched with ERP data)
router.get('/crm/seguimiento', async (req: ApiAuthRequest, res) => {
  try {
    const { vendedor, estado, prioridad, busqueda } = req.query;
    const lim = parseLimit(req.query.limit, 100);
    const off = parseOffset(req.query.offset);

    const conditions: any[] = [eq(crmSeguimientoClientes.active, true)];
    if (vendedor) conditions.push(eq(crmSeguimientoClientes.vendedorId, vendedor as string));
    if (estado) conditions.push(eq(crmSeguimientoClientes.estado, estado as string));
    if (prioridad) conditions.push(eq(crmSeguimientoClientes.prioridad, prioridad as string));
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
        linkedRegion: sql<string>`(SELECT region FROM comuna_region_mapping WHERE UPPER(TRIM(comuna_normalized)) = UPPER(TRIM(${clients.comuna})) AND is_active = true LIMIT 1)`.as('linked_region'),
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

    res.json(results);
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

    res.json({ ...cliente, hitos });
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
      estado: body.estado || 'cotizacion',
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
    const contactTypes = ['contacto', 'llamada', 'cotizacion', 'visita', 'venta'];
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
router.get('/crm/seguimiento/:id/bitacora', requireApiRole(['read_only', 'read_write', 'admin']), async (req: ApiAuthRequest, res) => {
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

export default router;