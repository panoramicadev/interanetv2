# API Externa Panorámica

API REST de la intranet Panorámica. Pensada para integraciones externas y para que un asistente Claude (u otra IA) pueda leer y operar el sistema con el mismo control que un usuario en la UI.

---

## Autenticación

Todas las peticiones requieren un header con un API Key válido:

```
X-API-Key: mk_<role>_<token>
Content-Type: application/json
```

### Generar un API Key

1. Login como **admin**
2. Ir a **API Keys** en el menú lateral
3. Click en **Nueva API Key**
4. Completar:
   - **Nombre**: descripción del uso (ej: "Claude chat")
   - **Permisos**:
     - `readonly` — solo lectura
     - `read_write` — lectura y escritura *(recomendado para asistentes)*
     - `admin` — todo, incluida gestión de keys
   - **Expiración**: opcional
5. **Guardar la clave** — solo se muestra una vez

---

## Endpoint base

```
https://tu-dominio.replit.app/api/external
```

---

## Descubrimiento — `/help` y `/openapi.json`

Endpoints auto-descriptivos. Útiles para que un asistente IA descubra la API sin doc estática:

```http
GET /api/external/help          → catálogo JSON con endpoints, filtros y body shapes
GET /api/external/openapi.json  → spec OpenAPI 3.0 (Claude / ChatGPT / Postman)
```

> **MCP:** existe un servidor MCP oficial (`mcp-panoramica`) que expone esta API como 51 tools para Claude Desktop / Claude Code / Cursor, en stdio o HTTP (Railway). Ver el repo `mcp-panoramica-v2` (README + TOOLS.md).

---

## Paginación y límites

Todos los endpoints de listado aceptan:

| Param | Default | Máximo |
|---|---|---|
| `limit` | **500** | **5000** (cap automático) |
| `offset` | 0 | — |

Pedir `limit` mayor a 5000 retorna 5000 (no falla).

---

## Endpoints

### 1. Ventas (read)

```http
GET /ventas
```

**Filtros:**
- `startDate`, `endDate` (`YYYY-MM-DD`)
- `salesperson` — nombre del vendedor (`nokofu`)
- `segment` — segmento del cliente (`noruen`)
- `client` — nombre del cliente
- `client_rut` — RUT exacto del cliente
- `product` — nombre/código del producto
- `limit`, `offset`

**Ejemplo:**
```
GET /ventas?startDate=2026-01-01&endDate=2026-04-30&segment=MCT&limit=1000
```

---

### 2. Clientes (read)

```http
GET /clientes
```

**Filtros:**
- `search` — busca en nombre, RUT, código
- `segment` — segmento (`ruen`)
- `salesperson`
- `creditStatus` — `con_credito` | `contado`
- `businessType` — busca por giro
- `debtStatus` — `con_deuda` | `sin_deuda`
- `entityType`
- `salesPeriod`
- `limit`, `offset`

Devuelve cada cliente enriquecido con: `totalTransactions`, `totalSales`, `lastTransactionDate`, `salespersonName`, `lastTransactionAmount`.

---

### 3. Puntos de venta (read)

```http
GET /puntos-de-venta
```

Sucursales propias, distribuidores y ferreterías **activas** — la misma data del mapa "Dónde Comprar". Pensado para integrarse en el sitio público (CORS abierto, cache 5 min).

**Filtros:**
- `type` — `sucursal_propia` | `distribuidor` | `ferreteria`
- `region` — case-insensitive
- `comuna` — case-insensitive

**Respuesta:** array con `id`, `name`, `type`, `address`, `comuna`, `region`, `latitude`, `longitude`, `phone`, `email`, `website`, `schedule`, `logoUrl`, `active`.

---

### 4. Usuarios y vendedores (read)

```http
GET /usuarios
```

**Filtros:**
- `role` — `admin` | `supervisor` | `salesperson` | `client` | `tecnico_obra` | `reception` | `jefe_planta` | `mantencion`
- `source` — `users` | `salespeople` | `all` *(default)*
- `limit`

**Respuesta:**
```json
{
  "users": [{ "id": "...", "email": "...", "firstName": "...", "lastName": "...", "role": "admin", "createdAt": "..." }],
  "salespeople": [{ "id": "...", "salespersonName": "Jesus Garcia", "username": "...", "email": "...", "role": "salesperson", "supervisorId": "...", "assignedSegment": "...", "isActive": true }],
  "counts": { "users": 1, "salespeople": 24 }
}
```

> Para resolver el `salespersonName` que se usa al crear cotizaciones, consultar `?source=salespeople`.

---

### 5. CRM Leads (read & write)

```http
GET    /crm/leads
POST   /crm/leads
PATCH  /crm/leads/:id
DELETE /crm/leads/:id
```

**Filtros GET:** `stage`, `salespersonId`, `supervisorId`, `segment`, `limit`, `offset`

**Body POST:**
```json
{
  "clientName": "Constructora Nueva",
  "salespersonId": "<id de salespeople_users>",
  "clientPhone": "+56912345678",
  "clientEmail": "contacto@empresa.com",
  "clientType": "nuevo",
  "estimatedValue": "5000000",
  "stage": "lead",
  "segment": "MCT",
  "notes": "..."
}
```

Stages: `lead`, `contacto`, `visita`, `lista_precio`, `campana`, `primera_venta`, `promesa`, `venta`.

---

### 6. CRM Seguimiento de Clientes — Pipeline (read & write) ⭐

Control total del panel **Seguimiento de Clientes** (`/seguimiento-clientes` en la intranet). Los registros pueden vincularse por RUT a clientes del ERP, lo que habilita detección automática de compras y consulta de NVV/GDV.

```http
GET    /crm/seguimiento                      → listar (enriquecido con datos ERP)
GET    /crm/seguimiento/:id                  → detalle + hitos[] (timeline)
POST   /crm/seguimiento                      → crear (rut opcional autovincula al ERP)
PATCH  /crm/seguimiento/:id                  → editar / reasignar vendedor
DELETE /crm/seguimiento/:id                  → soft delete (active=false)

POST   /crm/seguimiento/:id/hito             → agregar hito al timeline
GET    /crm/seguimiento/:id/bitacora         → listar bitácora (panel derecho)
POST   /crm/seguimiento/:id/bitacora         → agregar entrada de bitácora
DELETE /crm/seguimiento/:id/bitacora/:entryId → borrar entrada

POST   /crm/seguimiento/:id/vincular-rut     → vincular RUT → cliente ERP
GET    /crm/seguimiento/:id/detectar-compras → últimas 20 ventas + hitos automáticos
GET    /crm/seguimiento/:id/nvv              → NVV/GDV del vinculado (últimos 6 meses)

GET    /crm/seguimiento/stats                → totales por estado/prioridad + sin contacto >7d
GET    /crm/seguimiento/segmentos            → catálogo de segmentos del ERP
```

**Filtros GET `/crm/seguimiento`:** `vendedor` (salespeople_users.id), `estado`, `prioridad`, `busqueda` (ILIKE nombre/empresa/rut/email), `limit` (default 100), `offset`.

Estados del pipeline: `nuevo` → `contactado` → `cotizacion` → `venta` → `despacho` → `completado` | `perdido`. Prioridades: `baja` | `media` | `alta`.

**Body POST `/crm/seguimiento`:**
```json
{
  "nombre": "Juan Pérez",
  "vendedorId": "<salespeople_users.id>",
  "telefono": "+56912345678",
  "email": "juan@empresa.cl",
  "empresa": "Constructora XYZ",
  "rut": "76.123.456-7",
  "estado": "cotizacion",
  "prioridad": "media",
  "origen": "manual",
  "notas": "...",
  "montoEstimado": 2500000,
  "proximoContacto": "2026-08-01T10:00:00Z",
  "region": "RM", "comuna": "Maipú",
  "contactoEncargado": "...", "segmento": "MCT",
  "condicionPago": "credito_30", "destacado": false
}
```

Orígenes válidos: `manual`, `digital_organico`, `digital_pagado`, `referido`, `web`, `llamada`.

**Hitos (`POST .../hito`):** `tipo`* (`contacto` | `llamada` | `whatsapp` | `cotizacion` | `visita` | `venta` | `despacho` | `nota` | `sistema`), `descripcion`*, `documentoTipo` (`nvv`|`gdv`|`factura`|`cotizacion`), `documentoNumero`, `autor` (default: nombre de la API key). Los tipos de contacto refrescan `ultimoContacto`.

**Bitácora (`POST .../bitacora`):** `nota`*, `tipo` (`nota` | `llamada` | `visita` | `seguimiento` | `problema`), `autor`. Distinta del timeline de hitos: es el cuaderno de notas internas del panel derecho. Refresca `ultimoContacto` salvo tipo `problema`.

Cambios de `estado` o de `vendedorId` vía PATCH generan hitos automáticos tipo `sistema` para el audit trail.

---

### 7. Reclamos (read & write)

```http
GET  /reclamos
POST /reclamos
```

**Filtros GET:** `estado`, `areaResponsable`, `gravedad`, `vendedorId`, `tecnicoId`, `responsableAreaId`, `limit`, `offset`

Estados: `registrado`, `en_revision_tecnica`, `en_area_responsable`, `resuelto`, `cerrado`.

**Body POST:**
```json
{
  "clienteNombre": "Cliente ABC",
  "clienteRut": "12345678-9",
  "clienteEmail": "...",
  "clienteTelefono": "+56912345678",
  "motivo": "Calidad de producto",
  "descripcion": "...",
  "severidad": "media"
}
```

---

### 8. Mantención (read & write)

```http
GET  /mantencion
POST /mantencion
```

**Filtros GET:** `estado`, `tipoMantencion`, `gravedad`, `area`, `solicitanteId`, `tecnicoAsignadoId`, `limit`, `offset`

Tipos: `correctivo`, `preventivo`, `predictivo`.

**Body POST:**
```json
{
  "equipoNombre": "Mezcladora Industrial 3",
  "equipoCodigo": "MIX-003",
  "equipoArea": "Producción",
  "equipoUbicacion": "Planta - Sector B",
  "descripcionProblema": "...",
  "tipoMantencion": "correctivo",
  "severidad": "alta",
  "solicitadoPor": "<userId>"
}
```

---

### 9. Tareas (read & write)

```http
GET    /tareas
POST   /tareas
PATCH  /tareas/:id
DELETE /tareas/:id
```

**Filtros GET:** `assignedTo`, `status`, `priority`, `creatorId`, `limit`, `offset`

Estados: `pending`, `in_progress`, `completed`, `cancelled`.

**Body POST:**
```json
{
  "title": "Revisar inventario de pinturas",
  "description": "...",
  "priority": "high",
  "dueDate": "2026-05-01",
  "createdBy": "<userId>",
  "assignments": []
}
```

---

### 10. Notificaciones (read & write)

```http
GET  /notificaciones
POST /notificaciones
```

**Filtros GET:** `type`, `priority`, `departamento`, `archived`, `targetType`, `userId`, `limit`, `offset`

**Body POST:**
```json
{
  "title": "...",
  "message": "...",
  "type": "manual",
  "priority": "media",
  "departamento": "Logística",
  "actionUrl": "/path"
}
```

> Si se omite `departamento`, la notificación se crea como `targetType=general` (visible para todos).

---

### 11. Inventario (read)

```http
GET /inventario
```

**Filtros:** `search` (SKU o nombre), `bodega` (código de bodega `kobo`), `limit`, `offset`

**Respuesta:**
```json
{
  "total": 1234,
  "offset": 0,
  "limit": 500,
  "items": [
    {
      "id": "...", "productSku": "PROD-001", "productName": "Pintura Látex Blanco 1GL",
      "warehouseCode": "B01", "warehouseName": "Bodega Central",
      "quantity": 250, "reservedQuantity": 30, "availableQuantity": 220,
      "lastUpdated": "..."
    }
  ]
}
```

---

### 12. Pedidos eCommerce (read & write)

```http
GET   /ecommerce/orders
PATCH /ecommerce/orders/:id
```

**Filtros GET:** `status`, `clientId`, `salespersonId`, `limit`, `offset`

Estados válidos (schema real): `pending`, `approved`, `modified`, `rejected`, `sent`.

**Body PATCH:**
```json
{ "status": "approved" }
```

---

### 13. Productos y listas de precios (read) ⭐

Necesario para que un asistente IA pueda buscar productos antes de armar una cotización.

```http
GET /productos                        → lista flat sobre price_list (todos los precios)
GET /productos/grupos                 → productos agrupados como en la tienda (padre + variantes)
GET /productos/:codigo                → detalle por código exacto + stock por bodega
GET /listas-precio                    → listas disponibles (LP01 base + custom)
GET /listas-precio/:code/productos    → productos con precios de una lista específica
```

#### `GET /productos`

**Filtros:** `search` (busca en código, producto, unidad), `unidad`, `tipoProducto`, `color`, `priceList` (`LP01` default | `LP02` | `LP03` | …), `limit`, `offset`.

**Respuesta:**
```json
{
  "total": 4,
  "priceList": "LP01",
  "items": [
    {
      "codigo": "PCA960ECOPAC2",
      "producto": "ESMALTE AL AGUA COPPER AZUL COLONIAL",
      "unidad": "1/4 Galon",
      "precioLista": 5150,
      "precioDesc10": 4640,
      "precioDesc10_5": 4400,
      "precioDesc10_5_3": 4270,
      "precioMinimo": 4220,
      "precioCanalDigital": 0,
      "precioOferta": null,
      "listaPrecio": "LP01",
      "precioListaCustom": null,
      "precioEfectivo": 5150,
      "costoProduccion": 2100,
      "porcentajeUtilidad": 59.2,
      "margenLista": 59.22,
      "esPersonalizado": false,
      "modoPrecio": null,
      "cantidadProducto": null,
      "unidadMedida": null,
      "rendimiento": null
    }
  ]
}
```

> Con `?priceList=LP02` el campo `precioEfectivo` refleja el override de esa lista (si el SKU lo tiene) y `precioListaCustom` trae ese valor.

#### `GET /listas-precio`

Devuelve `LP01` (Lista Base, tabla `price_list` completa) + las listas custom (`LP02` Mix, `LP03` MCT, `LP04` Panoramica Store, …) con `code`, `name`, `active`, `isBase` e `itemCount` (cantidad de SKUs con override).

#### `GET /listas-precio/:code/productos`

**Filtros:** `search`, `limit`, `offset`.

- `LP01` → todos los items de `price_list` (`codigo`, `producto`, `unidad`, `precio`, `costoProduccion`).
- `LP02+` → solo los SKUs con override: `precio`, `precioBase` (LP01) y `diferenciaVsBase`.

#### `GET /productos/grupos` — vista de tienda

Devuelve los productos como están organizados en la tienda eCommerce: cada **grupo** (ej: "Esmalte al agua opaco galón") agrupa todas las variaciones (colores, formatos), cada una con su `codigo` y `precio`.

Pensado para que cuando el usuario pregunte *"qué colores hay de esmalte al agua"*, el asistente pueda responder con la lista completa y los precios sin tener que hacer múltiples llamadas.

**Filtros:** `search`, `categoria`, `soloActivos` (default `true`), `limit`, `offset`.

**Respuesta:**
```json
{
  "total": 67,
  "groups": [
    {
      "id": "uuid",
      "nombre": "ESMALTE AL AGUA OPACO GALON",
      "categoria": "Pinturas",
      "descripcion": "...",
      "imagenPrincipal": "...",
      "variationCount": 8,
      "variations": [
        {
          "id": "uuid",
          "priceListId": "uuid",
          "codigo": "PCA925COBLA04",
          "producto": "ESMALTE AL AGUA OPACO BLANCO",
          "color": "BLANCO",
          "unidad": "1 Galon",
          "precio": 18540,
          "imagenUrl": "...",
          "isMainVariant": true
        }
      ]
    }
  ]
}
```

> **Búsqueda inteligente:** `?search=esmalte agua` matchea por nombre del grupo, descripción **o** dentro de las variaciones (código, producto, color). Si Claude busca "rojo bermellón" y solo es un color, igual encuentra el grupo padre.

#### `GET /productos/:codigo` — detalle + stock

Devuelve el producto único con **todos los tiers de precio** y **stock por bodega**:

```json
{
  "codigo": "PCA106BLANC02",
  "producto": "ANTICORROSIVO ESTRUCTURAL BLANCO",
  "unidad": "1/4 Galon",
  "precios": {
    "lista": 5530,
    "desc10": 4980,
    "desc10_5": 4740,
    "desc10_5_3": 4590,
    "minimo": 4590,
    "canalDigital": 0,
    "oferta": null
  },
  "preciosPorLista": { "LP01": 5530, "LP02": 5200, "LP04": 5990 },
  "costos": {
    "costoProduccion": 2100,
    "porcentajeUtilidad": 62,
    "margenLista": 62.03,
    "margenMinimo": 54.25
  },
  "esPersonalizado": false,
  "modoPrecio": null,
  "cantidadProducto": null,
  "unidadMedida": null,
  "rendimiento": null,
  "stockTotal": 120,
  "stockPorBodega": [
    { "warehouseCode": "B01", "branchCode": "S01", "warehouseLocation": "Galpón A",
      "physicalStock": 130, "availableStock": 120, "committedStock": 10, "lastUpdated": "..." }
  ]
}
```

> Útil para que el asistente verifique stock antes de cotizar.

#### Tiers de precio (cómo elegir el correcto al cotizar)

| Campo | Cuándo usarlo |
|---|---|
| `precioLista` | precio normal (sin descuento) |
| `precioDesc10` | con 10% de descuento |
| `precioDesc10_5` | con 10% + 5% |
| `precioDesc10_5_3` | con 10% + 5% + 3% (clientes top) |
| `precioMinimo` | piso autorizado (no bajar de aquí) |
| `precioCanalDigital` | precio para eCommerce |
| `precioOferta` | promo vigente (si no hay, es `null`) |

Para una cotización estándar usar `precioLista`. Si el cliente tiene descuentos pactados, usar el tier correspondiente. **Nunca bajar de `precioMinimo`.**

---

### 14. Cotizaciones / Presupuestos (read & write) ⭐

Mismos datos que el **tomador de pedidos**. Las cotizaciones creadas vía API aparecen en la UI con los presupuestos normales.

```http
GET    /cotizaciones                  → listar
GET    /cotizaciones/:id              → detalle + items[]
POST   /cotizaciones                  → crear (acepta items[] inline)
PATCH  /cotizaciones/:id              → editar campos
PATCH  /cotizaciones/:id/status       → cambiar estado
DELETE /cotizaciones/:id              → borrar

GET    /cotizaciones/:id/items        → listar items
POST   /cotizaciones/:id/items        → agregar item
PATCH  /cotizaciones/items/:itemId    → editar item
DELETE /cotizaciones/items/:itemId    → borrar item

GET    /cotizaciones/:id/pdf          → PDF binario (?format=html para HTML)
GET    /cotizaciones/:id/pdf-url      → URL pública firmada del PDF
```

#### PDF de la cotización

- `GET /cotizaciones/:id/pdf` — devuelve el PDF renderizado con la misma plantilla del tomador de pedidos (`application/pdf`). Con `?format=html` devuelve el HTML.
- `GET /cotizaciones/:id/pdf-url?ttlMinutes=60` — devuelve `{ url, quoteNumber, filename, expiresAt }`. La URL es pública y firmada (default 60 min, máx 1440): se puede abrir en el navegador o compartir con el cliente **sin API key**. Recomendado para asistentes de chat.

**Filtros GET `/cotizaciones`:** `status`, `salespersonName`, `clientName`, `dateFrom`, `dateTo`, `createdBy`, `limit`, `offset`.

#### Crear cotización con items en una llamada

```json
POST /cotizaciones
{
  "clientName": "Constructora ABC",
  "clientRut": "76.123.456-7",
  "clientEmail": "contacto@abc.cl",
  "clientPhone": "+56912345678",
  "clientAddress": "Av. Principal 123, Santiago",
  "salespersonName": "Jesus Garcia",
  "validUntil": "2026-05-30",
  "paymentCondition": "credito_30",
  "segment": "MCT",
  "subtotal": 1500000,
  "discount": 0,
  "taxRate": 19,
  "taxAmount": 285000,
  "total": 1785000,
  "notes": "Incluye despacho",
  "items": [
    {
      "type": "standard",
      "productCode": "PROD-001",
      "productName": "Pintura Látex Blanco 1GL",
      "productUnit": "GL",
      "quantity": 10,
      "unitPrice": 15000
    },
    {
      "type": "custom",
      "customSku": "ESP-01",
      "productName": "Servicio especial",
      "quantity": 1,
      "unitPrice": 350000
    }
  ]
}
```

**Respuesta (201):**
```json
{
  "id": "uuid",
  "quoteNumber": "Q-1777583270311",
  "clientName": "Constructora ABC",
  "createdBy": "<users.id resuelto>",
  "salespersonName": "Jesus Garcia",
  "status": "draft",
  "total": "1785000.00",
  "items": [...]
}
```

#### Resolución del vendedor (`salespersonName`)

El campo es **obligatorio** y se resuelve a `users.id` con esta cascada:

1. `salespeople_users.salespersonName` (case-insensitive)
2. Si lo encuentra y tiene `email`, busca `users.id` por ese email (para que `createdBy` apunte a `users` como hace el tomador)
3. Fallback: `users.firstName + ' ' + users.lastName`
4. Fallback final: `users.email` exacto

Si no se resuelve → **404** `{"error":"Vendedor 'X' no encontrado"}`.

> Para descubrir nombres válidos: `GET /usuarios?source=salespeople` y leer `salespersonName`.

#### Estados de cotización

`draft` → `sent` → `accepted` | `rejected` | `converted`

```json
PATCH /cotizaciones/:id/status
{ "status": "sent" }
```

#### Tipos de item

- `standard`: usa `productCode` (de `price_list.codigo`) + `productName` + `productUnit`
- `custom`: usa `customSku` + `productName`, opcionalmente `costOfProduction` + `profitMargin` + `pricingMode` (`calculated` | `direct`)

Al agregar/editar/borrar items, los totales del quote se recalculan automáticamente.

---

### 15. Dashboard de ventas (read)

```http
GET /dashboard
```

**Filtros:** `period` (`YYYY` | `YYYY-MM` | `YYYY-MM-DD`), `filterType` (`year`|`month`|`day`, se auto-detecta del formato de `period`), `segment`, `salesperson`, `client`.

Devuelve métricas agregadas: ventas totales, unidades, transacciones, clientes activos, ticket promedio, totales anuales, meta global (si `period` es mes), ventas por segmento, tendencia (mensual para año, diaria para mes), NVV/GDV pendientes y total combinado.

---

### 16. API Keys (admin only)

```http
GET    /api-keys              → listar keys (sin hash)
POST   /api-keys              → crear key — body: name*, description, role, expiresAt
PATCH  /api-keys/:id/toggle   → activar/desactivar — body: { "isActive": true|false }
DELETE /api-keys/:id          → eliminar
```

Requiere una key con rol `admin`. El valor completo de la key (`mk_<role>_...`) **solo se devuelve al crearla** — después solo se ve el prefijo.

---

## Manejo de errores

| Código | Significado |
|---|---|
| 200 | OK |
| 201 | Recurso creado |
| 400 | Body inválido / faltan campos |
| 401 | API key faltante o inválida |
| 403 | Permiso insuficiente para el rol del key |
| 404 | Recurso no encontrado |
| 500 | Error del servidor |

**Formato de error:**
```json
{ "error": "Vendedor 'NoExiste' no encontrado" }
```

---

## Ejemplos curl

```bash
KEY="mk_read_write_..."
BASE="https://tu-dominio.replit.app/api/external"

# Listado
curl -H "X-API-Key: $KEY" "$BASE/ventas?startDate=2026-04-01&limit=2000"
curl -H "X-API-Key: $KEY" "$BASE/clientes?segment=MCT&debtStatus=con_deuda"
curl -H "X-API-Key: $KEY" "$BASE/inventario?search=pintura&bodega=B01"

# Crear cotización
curl -X POST "$BASE/cotizaciones" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{
    "clientName": "Cliente Test",
    "salespersonName": "Jesus Garcia",
    "subtotal": 100000, "taxAmount": 19000, "total": 119000,
    "items": [
      { "type": "standard", "productCode": "PROD-001", "productName": "X", "quantity": 2, "unitPrice": 50000 }
    ]
  }'

# Cambiar estado
curl -X PATCH "$BASE/cotizaciones/<id>/status" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"status":"sent"}'
```

---

## Para integraciones con Claude (chat)

1. **Crear una API key** con rol `read_write`.
2. **Configurar el endpoint base** y darle al asistente la URL de `/help` para que descubra la superficie de la API.
3. Estrategia recomendada para el asistente:
   - Resolver nombres de vendedores → `GET /usuarios?source=salespeople`
   - Buscar productos por nombre/familia → `GET /productos/grupos?search=...` (devuelve variaciones con precio)
   - Buscar producto por código exacto → `GET /productos/:codigo` (precios + stock)
   - Crear cotizaciones desde texto del usuario → mapear a body de `POST /cotizaciones` con `salespersonName`
   - Reportes (qué reclamos abiertos, qué leads en pipeline, etc.) → usar los filtros de cada endpoint en lugar de traer todo y filtrar después

### Flujo completo de cotización (ejemplo)

Usuario: *"Cotizá 5 baldes de esmalte al agua blanco para Constructora ABC, vendedor Jesús García, precio lista"*

```
1. GET /productos/grupos?search=esmalte%20al%20agua
   → encuentra grupo "ESMALTE AL AGUA OPACO BALDE", variante color=BLANCO
   → toma codigo=PCA925COBLA06, unidad="Balde 4 Galones", precio=40560

2. GET /clientes?search=Constructora%20ABC
   → confirma clientName + clientRut

3. GET /usuarios?source=salespeople
   → confirma "Jesus Garcia" existe

4. POST /cotizaciones
   {
     "clientName": "Constructora ABC",
     "clientRut": "76.123.456-7",
     "salespersonName": "Jesus Garcia",
     "subtotal": 202800,
     "taxRate": 19,
     "taxAmount": 38532,
     "total": 241332,
     "items": [
       {
         "type": "standard",
         "productCode": "PCA925COBLA06",
         "productName": "ESMALTE AL AGUA OPACO BLANCO",
         "productUnit": "Balde 4 Galones",
         "quantity": 5,
         "unitPrice": 40560
       }
     ]
   }
```

---

## Buenas prácticas

- Nunca expongas la API key en frontend o repos públicos.
- Usá `read_write` (no `admin`) para integraciones que no gestionan keys.
- Rotá las keys periódicamente.
- Para datasets grandes, paginá con `offset` antes que pedir `limit=5000`.
- Filtrá del lado del servidor — evitá traer todo y filtrar en el cliente.
- Fechas: ISO 8601 (`YYYY-MM-DD`). Considerá zona horaria Chile (UTC-3 / UTC-4).

---

**Versión:** 2.1
**Última actualización:** 2026-07-21
**Mantenido por:** Equipo Panorámica

**Changelog 2.1 (2026-07-21):** documentados puntos de venta, pipeline CRM Seguimiento de Clientes (14 endpoints, incl. hitos y bitácora), listas de precios custom (`/listas-precio`, filtro `priceList`, costos y márgenes en respuestas de productos), PDF de cotizaciones (binario + URL firmada) y gestión de API keys.
