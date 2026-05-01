# mcp-panoramica

Servidor [Model Context Protocol](https://modelcontextprotocol.io/) que expone la API externa de Panorámica como herramientas (`tools`) consumibles por **Claude Desktop**, **Claude Code**, **Cursor**, **Continue** y otros clientes MCP.

Permite que el asistente:

- Busque productos en la lista de precios (con todos los tiers)
- Liste productos agrupados como en la tienda (variantes color/formato)
- Verifique stock por bodega
- Cree, lea, edite y borre **cotizaciones** (mismas que el tomador de pedidos)
- Consulte clientes, vendedores, ventas, dashboard
- Administre reclamos, mantenciones, tareas, leads, pedidos eCommerce

## Instalación

```bash
cd mcp
npm install
npm run build
```

Esto produce `dist/index.js`.

## Configuración

Necesitás dos variables de entorno:

| Variable | Default | Descripción |
|---|---|---|
| `PANORAMICA_API_KEY` | *(requerido)* | API key generada desde el panel **API Keys** (rol `read_write` recomendado) |
| `PANORAMICA_API_BASE` | `https://intranet.pinturaspanoramica.cl/api/external` | Base de la API externa |

## Uso con Claude Desktop

Editá `~/Library/Application Support/Claude/claude_desktop_config.json` (en Mac):

```json
{
  "mcpServers": {
    "panoramica": {
      "command": "node",
      "args": ["/ruta/absoluta/a/mcp/dist/index.js"],
      "env": {
        "PANORAMICA_API_KEY": "mk_read_write_xxxx",
        "PANORAMICA_API_BASE": "https://intranet.pinturaspanoramica.cl/api/external"
      }
    }
  }
}
```

Reiniciá Claude Desktop. Las herramientas aparecen disponibles automáticamente — no hace falta pegarles el `API.md`.

## Uso con Claude Code

```bash
claude mcp add panoramica \
  -e PANORAMICA_API_KEY=mk_read_write_xxxx \
  -- node /ruta/absoluta/a/mcp/dist/index.js
```

## Tools disponibles

### Productos & precios
- `search_products` — búsqueda flat con todos los tiers de precio
- `get_products_grouped` — vista tienda (padre + variantes con color y precio)
- `get_product_detail` — detalle por código + stock por bodega

### Clientes & vendedores
- `search_clients` — clientes con métricas
- `list_salespeople` — vendedores activos (para validar `salespersonName`)

### Cotizaciones (CRUD completo)
- `list_quotes` — listar
- `get_quote` — detalle + items
- `create_quote` — crear (acepta `items[]` inline)
- `add_quote_item` — agregar item
- `update_quote` — editar campos
- `change_quote_status` — `draft → sent → accepted/rejected/converted`
- `delete_quote` — borrar

### Operaciones
- `list_sales` — transacciones facturadas
- `get_sales_dashboard` — métricas agregadas
- `list_inventory` — stock por bodega
- `list_complaints` — reclamos
- `list_maintenance` — solicitudes de mantención
- `list_tasks` — tareas
- `list_crm_leads` — leads del pipeline
- `list_ecommerce_orders` — pedidos eCommerce

## Ejemplo de conversación

> **Usuario**: cotizá 5 baldes de esmalte al agua blanco para Constructora ABC, vendedor Jesús García, precio lista

El asistente:
1. Llama `get_products_grouped({ search: "esmalte agua" })` → encuentra el grupo "ESMALTE AL AGUA OPACO BALDE", variante BLANCO, código `PCA925COBLA06`, precio `40560`
2. Llama `search_clients({ search: "Constructora ABC" })` → confirma RUT
3. Llama `list_salespeople({ role: "salesperson" })` → confirma "Jesus Garcia"
4. Llama `create_quote({ clientName: "Constructora ABC", clientRut: "...", salespersonName: "Jesus Garcia", subtotal: 202800, taxAmount: 38532, total: 241332, items: [{ type: "standard", productCode: "PCA925COBLA06", productName: "...", quantity: 5, unitPrice: 40560 }] })`
5. Confirma al usuario el `quoteNumber` generado

## Desarrollo

```bash
npm run dev   # ejecuta con tsx (no requiere build)
npm run build # compila a dist/
```

## Licencia

Interno — uso exclusivo de Panorámica.
