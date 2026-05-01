#!/usr/bin/env node
// MCP server for Panorámica external API.
// Wraps the /api/external endpoints as MCP tools so Claude Desktop / Claude Code / Cursor
// can operate the intranet conversationally with full tool-use semantics.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API_BASE = process.env.PANORAMICA_API_BASE ?? 'https://intranet.pinturaspanoramica.cl/api/external';
const API_KEY = process.env.PANORAMICA_API_KEY;

if (!API_KEY) {
  console.error('Falta PANORAMICA_API_KEY en el environment');
  process.exit(1);
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'X-API-Key': API_KEY!,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

// Fetch raw text (no JSON parse) — for HTML responses like the PDF.
async function apiRaw(method: string, path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'X-API-Key': API_KEY! },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${text.slice(0, 200)}`);
  return text;
}

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ---- Tool definitions ----

const TOOLS = [
  // Discovery
  {
    name: 'search_products',
    description: 'Busca productos en la lista de precios por nombre, código, unidad o color. Devuelve cada producto con todos los tiers de precio (lista, descuentos escalonados, mínimo, oferta), costo de producción, porcentaje de utilidad y precio efectivo según la lista pedida. Usar antes de cotizar para obtener el código y precio correctos.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Texto a buscar en código/producto/unidad' },
        unidad: { type: 'string', description: 'Filtrar por unidad exacta (ej: "1 Galon", "Balde 4 Galones")' },
        tipoProducto: { type: 'string' },
        color: { type: 'string' },
        priceList: { type: 'string', description: 'Lista de precios: LP01 (base, default) o custom (LP02 Mix, LP03, etc.). Ver list_price_lists primero.' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'list_price_lists',
    description: 'Lista todas las listas de precios disponibles (LP01 base + listas custom como Mix, MCT, VIP). Devuelve cada lista con su código, nombre y cantidad de items que sobrescribe.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_price_list_products',
    description: 'Devuelve los productos con precios de una lista específica. Para listas custom (LP02+) muestra solo los items que tienen override de precio + diferencia vs LP01.',
    inputSchema: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', description: 'Código de la lista (LP01, LP02, etc.)' },
        search: { type: 'string' },
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'get_products_grouped',
    description: 'Lista productos agrupados como en la tienda: producto padre (ej: "Esmalte al agua opaco galón") con sus variantes (colores, formatos), cada una con código y precio. Usar cuando el usuario pregunte por familias de productos o quiera ver opciones de color/formato.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Busca en nombre del grupo, descripción y dentro de las variantes (color, código, producto)' },
        categoria: { type: 'string' },
        limit: { type: 'number', default: 30 },
      },
    },
  },
  {
    name: 'get_product_detail',
    description: 'Devuelve el detalle de un producto por código exacto: todos los precios (lista, desc10, desc10_5, desc10_5_3, mínimo, canalDigital, oferta) y stock disponible por bodega. Usar para verificar disponibilidad antes de prometer entregas.',
    inputSchema: {
      type: 'object',
      required: ['codigo'],
      properties: {
        codigo: { type: 'string', description: 'Código del producto (ej: PCA925COBLA06)' },
      },
    },
  },

  // Clients & people
  {
    name: 'search_clients',
    description: 'Busca clientes por nombre, RUT o código. Devuelve cada cliente con sus métricas: total de transacciones, ventas históricas, última compra, vendedor asignado.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        segment: { type: 'string', description: 'Segmento (ej: MCT, FERRETERIAS, CONSTRUCCION)' },
        salesperson: { type: 'string' },
        creditStatus: { type: 'string', enum: ['con_credito', 'contado'] },
        debtStatus: { type: 'string', enum: ['con_deuda', 'sin_deuda'] },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'list_salespeople',
    description: 'Lista los vendedores y supervisores activos. Usar para validar el "salespersonName" antes de crear una cotización.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['salesperson', 'supervisor', 'admin'] },
      },
    },
  },

  // Quotes (the main flow)
  {
    name: 'list_quotes',
    description: 'Lista cotizaciones / presupuestos creados.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'converted'] },
        salespersonName: { type: 'string' },
        clientName: { type: 'string' },
        dateFrom: { type: 'string', format: 'date' },
        dateTo: { type: 'string', format: 'date' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'get_quote',
    description: 'Devuelve la cotización con todos sus items.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'create_quote',
    description: 'Crea una cotización (presupuesto) — la misma que se vería en el tomador de pedidos. Acepta items[] inline para crear todo en una sola llamada. salespersonName es obligatorio: la API lo resuelve a un usuario interno.',
    inputSchema: {
      type: 'object',
      required: ['clientName', 'salespersonName'],
      properties: {
        clientName: { type: 'string' },
        salespersonName: { type: 'string', description: 'Nombre del vendedor (validar primero con list_salespeople)' },
        clientRut: { type: 'string' },
        clientEmail: { type: 'string' },
        clientPhone: { type: 'string' },
        clientAddress: { type: 'string' },
        paymentCondition: { type: 'string', description: 'transferencia | boton_pago | credito_30 | credito_45 | credito_60' },
        segment: { type: 'string' },
        validUntil: { type: 'string', format: 'date' },
        subtotal: { type: 'number' },
        discount: { type: 'number' },
        taxRate: { type: 'number', default: 19 },
        taxAmount: { type: 'number' },
        total: { type: 'number' },
        notes: { type: 'string' },
        items: {
          type: 'array',
          description: 'Items a incluir (opcional, también se pueden agregar después con add_quote_item)',
          items: {
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
        },
      },
    },
  },
  {
    name: 'add_quote_item',
    description: 'Agrega un item a una cotización existente. Los totales se recalculan automáticamente.',
    inputSchema: {
      type: 'object',
      required: ['quoteId', 'productName', 'quantity', 'unitPrice'],
      properties: {
        quoteId: { type: 'string' },
        type: { type: 'string', enum: ['standard', 'custom'], default: 'standard' },
        productCode: { type: 'string' },
        productName: { type: 'string' },
        productUnit: { type: 'string' },
        customSku: { type: 'string' },
        quantity: { type: 'number' },
        unitPrice: { type: 'number' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'update_quote',
    description: 'Actualiza campos de una cotización (cliente, condición de pago, notas, etc.).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        clientName: { type: 'string' },
        salespersonName: { type: 'string' },
        paymentCondition: { type: 'string' },
        validUntil: { type: 'string', format: 'date' },
        notes: { type: 'string' },
        scope: { type: 'string' },
      },
    },
  },
  {
    name: 'change_quote_status',
    description: 'Cambia el estado de una cotización: draft → sent → accepted/rejected/converted.',
    inputSchema: {
      type: 'object',
      required: ['id', 'status'],
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'converted'] },
      },
    },
  },
  {
    name: 'delete_quote',
    description: 'Elimina una cotización.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'get_quote_pdf',
    description: 'Genera el PDF imprimible de una cotización y lo guarda como archivo HTML local. Devuelve la ruta absoluta al archivo (file://...) que el usuario abre en su navegador y guarda como PDF con un click. Usar inmediatamente después de create_quote para entregar el archivo al usuario.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID de la cotización' },
      },
    },
  },

  // Sales & inventory
  {
    name: 'list_sales',
    description: 'Consulta transacciones de venta facturadas. Útil para reportes y seguimiento histórico.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        salesperson: { type: 'string' },
        segment: { type: 'string' },
        client: { type: 'string' },
        product: { type: 'string' },
        client_rut: { type: 'string' },
        limit: { type: 'number', default: 200 },
      },
    },
  },
  {
    name: 'get_sales_dashboard',
    description: 'Métricas agregadas de ventas para un período: total, unidades, transacciones, clientes activos, ticket promedio, NVV/GDV pendientes, ventas por segmento, tendencia.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'YYYY (año), YYYY-MM (mes) o YYYY-MM-DD (día)' },
        segment: { type: 'string' },
        salesperson: { type: 'string' },
        client: { type: 'string' },
      },
    },
  },
  {
    name: 'list_inventory',
    description: 'Lista stock de productos por bodega.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'SKU o nombre' },
        bodega: { type: 'string', description: 'Código de bodega' },
        limit: { type: 'number', default: 100 },
      },
    },
  },

  // Operations
  {
    name: 'list_complaints',
    description: 'Lista reclamos generales abiertos o cerrados.',
    inputSchema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['registrado', 'en_revision_tecnica', 'en_area_responsable', 'resuelto', 'cerrado'] },
        gravedad: { type: 'string' },
        areaResponsable: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'list_maintenance',
    description: 'Lista solicitudes de mantención.',
    inputSchema: {
      type: 'object',
      properties: {
        estado: { type: 'string' },
        tipoMantencion: { type: 'string', enum: ['correctivo', 'preventivo', 'predictivo'] },
        gravedad: { type: 'string' },
        area: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'list_tasks',
    description: 'Lista tareas asignadas en el sistema.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
        priority: { type: 'string' },
        assignedTo: { type: 'string', description: 'User ID' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'list_crm_leads',
    description: 'Lista leads del CRM por etapa del pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: ['lead', 'contacto', 'visita', 'lista_precio', 'campana', 'primera_venta', 'promesa', 'venta'] },
        salespersonId: { type: 'string' },
        segment: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'list_ecommerce_orders',
    description: 'Lista pedidos de eCommerce.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'modified', 'rejected', 'sent'] },
        clientId: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
];

// ---- Tool dispatcher ----

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_products':
      return api('GET', `/productos${qs(args)}`);
    case 'get_products_grouped':
      return api('GET', `/productos/grupos${qs(args)}`);
    case 'get_product_detail':
      return api('GET', `/productos/${encodeURIComponent(String(args.codigo))}`);
    case 'search_clients':
      return api('GET', `/clientes${qs(args)}`);
    case 'list_salespeople':
      return api('GET', `/usuarios${qs({ source: 'salespeople', role: args.role })}`);
    case 'list_quotes':
      return api('GET', `/cotizaciones${qs(args)}`);
    case 'get_quote':
      return api('GET', `/cotizaciones/${encodeURIComponent(String(args.id))}`);
    case 'create_quote':
      return api('POST', '/cotizaciones', args);
    case 'add_quote_item': {
      const { quoteId, ...item } = args;
      return api('POST', `/cotizaciones/${encodeURIComponent(String(quoteId))}/items`, item);
    }
    case 'update_quote': {
      const { id, ...patch } = args;
      return api('PATCH', `/cotizaciones/${encodeURIComponent(String(id))}`, patch);
    }
    case 'change_quote_status': {
      const { id, status } = args;
      return api('PATCH', `/cotizaciones/${encodeURIComponent(String(id))}/status`, { status });
    }
    case 'delete_quote':
      return api('DELETE', `/cotizaciones/${encodeURIComponent(String(args.id))}`);
    case 'list_price_lists':
      return api('GET', '/listas-precio');
    case 'get_price_list_products': {
      const { code, ...rest } = args;
      return api('GET', `/listas-precio/${encodeURIComponent(String(code))}/productos${qs(rest)}`);
    }
    case 'get_quote_pdf': {
      const id = String(args.id);
      const html = await apiRaw('GET', `/cotizaciones/${encodeURIComponent(id)}/pdf`);
      // Detectar quoteNumber para nombrar el archivo
      const m = html.match(/Cotización N°:<\/strong>\s*([^<]+)/);
      const quoteNumber = m?.[1]?.trim() || id;
      const dir = mkdtempSync(join(tmpdir(), 'panoramica-'));
      const filePath = join(dir, `Cotizacion_${quoteNumber}.html`);
      writeFileSync(filePath, html, 'utf8');
      return {
        filePath,
        fileUrl: `file://${filePath}`,
        quoteNumber,
        instructions: 'Abrí el archivo HTML en el navegador y usá el botón "Imprimir / Descargar PDF" o Cmd+P → Guardar como PDF.',
      };
    }
    case 'list_sales':
      return api('GET', `/ventas${qs(args)}`);
    case 'get_sales_dashboard':
      return api('GET', `/dashboard${qs(args)}`);
    case 'list_inventory':
      return api('GET', `/inventario${qs(args)}`);
    case 'list_complaints':
      return api('GET', `/reclamos${qs(args)}`);
    case 'list_maintenance':
      return api('GET', `/mantencion${qs(args)}`);
    case 'list_tasks':
      return api('GET', `/tareas${qs(args)}`);
    case 'list_crm_leads':
      return api('GET', `/crm/leads${qs(args)}`);
    case 'list_ecommerce_orders':
      return api('GET', `/ecommerce/orders${qs(args)}`);
    default:
      throw new Error(`Tool desconocido: ${name}`);
  }
}

// ---- MCP server wiring ----

const server = new Server(
  { name: 'panoramica', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, (args ?? {}) as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('mcp-panoramica running on stdio');
