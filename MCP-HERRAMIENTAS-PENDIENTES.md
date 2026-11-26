# Pendiente en `mcp-panoramica-v2` (servidor MCP)

*Escrito el 26-11-2026.* La intranet ya publica todo lo de abajo en `/api/external` (ver [API.md](API.md)). Falta que el servidor MCP lo ofrezca como herramientas. Ese proyecto vive en otro repositorio (`mcp-panoramica-v2`) que no estaba en este equipo.

Mientras tanto se puede usar con `call_module_tool` solo si el MCP deja llamar rutas que no conoce. Si no deja, hay que sumar las herramientas allá.

## 1. Permisos por persona: lo que ya cambió en la intranet

No hay que tocar nada en el MCP para que funcione: la intranet corta con **403** lo que la persona no tiene en su menú (Roles y Permisos), y a los vendedores les fija el filtro en sus propios datos.

Se recomienda en el MCP:

- **Mostrar el mensaje del 403 tal cual.** Viene en `message`, en español y listo para mostrar: *No tienes acceso a "Margen". Tu usuario no tiene este módulo…*. Así el asistente no reintenta ni inventa.
- **`list_modules` y `describe_module` acordes a la persona.** `GET /api/external/help` con el token del usuario ya devuelve solo las rutas que esa persona puede usar, más `tuAcceso` (nombre y rol). Si el MCP arma su índice desde `/help` o filtra contra él, cada persona ve solo sus herramientas.
- Las herramientas que siempre van a fallar para un rol (márgenes para un vendedor, por ejemplo) no rompen nada: responden 403.

## 2. Herramientas nuevas sugeridas

| Herramienta | Ruta en `/api/external` | Módulo sugerido |
|---|---|---|
| `list_complaints` (ampliar) | `GET /reclamos` + `numero`, `periodo`, `desde`, `hasta`, `soloSinLeer` | reclamos |
| `get_complaint_unread` | `GET /reclamos/mensajes-sin-leer` | reclamos |
| `list_complaint_messages` | `GET /reclamos/:id/mensajes` | reclamos |
| `send_complaint_message` | `POST /reclamos/:id/mensajes` `{ mensaje }` | reclamos |
| `mark_complaint_messages_read` | `POST /reclamos/:id/mensajes/leidos` | reclamos |
| `get_ventas_sin_cargo` | `GET /ventas/sin-cargo` (`period`, `groupBy` vendedor·segmento·cliente, `salesperson`, `segment`, `client`, `limit`) | ventas |
| `list_sample_requests` | `GET /intranet/solicitudes-muestra` | solicitudes |
| `get_sample_request` | `GET /intranet/solicitudes-muestra/:id` | solicitudes |
| `create_sample_request` | `POST /intranet/solicitudes-muestra` | solicitudes |
| `update_sample_request` | `PATCH /intranet/solicitudes-muestra/:id/datos` | solicitudes |
| `decide_sample_request` | `POST /intranet/solicitudes-muestra/:id/aprobacion` | solicitudes |
| `mark_sample_ready` | `POST /intranet/solicitudes-muestra/:id/lista` `{ ubicacion, fecha }` | solicitudes |
| `close_sample_request` | `POST /intranet/solicitudes-muestra/:id/cerrar` `{ comentario }` | solicitudes |
| `reopen_sample_request` | `POST /intranet/solicitudes-muestra/:id/reabrir` `{ motivo }` | solicitudes |
| `send_sample_message` | `POST /intranet/solicitudes-muestra/:id/mensajes` `{ mensaje }` | solicitudes |
| `list_credit_requests` | `GET /intranet/solicitudes-credito` | solicitudes |
| `create_credit_request` · `update_credit_request` · `resolve_credit_request` | `POST /intranet/solicitudes-credito` · `PATCH …/:id/datos` · `PATCH …/:id` | solicitudes |
| `get_new_client_catalogs` | `GET /intranet/nuevo-cliente/catalogos` | solicitudes |
| `list_new_client_requests` | `GET /intranet/solicitudes-nuevo-cliente` | solicitudes |
| `create_new_client_request` · `update_new_client_request` · `resolve_new_client_request` | `POST /intranet/solicitudes-nuevo-cliente` · `PATCH …/:id/datos` · `PATCH …/:id` | solicitudes |
| `get_billing_detail_summary` | `GET /intranet/detalle-facturacion/resumen` (`desde`*, `hasta`*, `sucursal`, …) | finanzas |
| `list_billing_documents` | `GET /intranet/detalle-facturacion/documentos` | finanzas |
| `list_billing_lines` | `GET /intranet/detalle-facturacion/lineas` | finanzas |
| `get_color_chart` | `GET /intranet/tintometria/carta` | tintometria |
| `get_color_formulas` | `GET /intranet/tintometria/carta/:id/formulas` | tintometria |
| `list_formula_books` | `GET /intranet/tintometria/libros` | tintometria |
| `get_formula_book` | `GET /intranet/tintometria/libros/:id/formulas` | tintometria |

Las rutas `/intranet/*` y las de mensajes de reclamos necesitan el token del usuario (OAuth): con una API key compartida responden 400.

## 3. Lo que todavía no cubre el filtro de vendedor

El filtro de vendedor actúa sobre los **listados**. Si un vendedor pide un registro puntual por su número (una cotización por id, la ficha de ventas de un cliente por nombre), hoy no se revisa que sea suyo. Si hace falta cerrarlo, es el siguiente paso en `server/permisos-mcp.ts`.
