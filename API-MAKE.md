# API Documentation for Make.com Integration

## Overview

Esta documentación describe cómo integrar Make.com (anteriormente Integromat) con la aplicación Panorámica para automatizar flujos de trabajo, leer datos, crear registros y actualizar información del sistema.

## Autenticación

Todas las peticiones a la API externa requieren un API Key válido.

### Generar un API Key

1. Inicia sesión como administrador
2. Navega a **API Keys** en el menú lateral
3. Haz clic en **Nueva API Key**
4. Completa el formulario:
   - **Nombre**: Describe el uso (ej: "Make.com Integration")
   - **Descripción**: Detalles adicionales (opcional)
   - **Permisos**:
     - `readonly`: Solo lectura de datos
     - `read_write`: Lectura y escritura (recomendado para Make)
     - `admin`: Acceso completo incluyendo gestión de API keys
   - **Fecha de Expiración**: Opcional
5. Guarda la clave generada en un lugar seguro (solo se muestra una vez)

### Usar el API Key en Make.com

En Make.com, al configurar una petición HTTP:

1. Agrega un Header personalizado:
   - **Key**: `X-API-Key`
   - **Value**: Tu API key completa (ej: `mk_readonly_abc123...`)

**Ejemplo de Headers en Make:**
```
X-API-Key: mk_read_write_abc123def456ghi789
Content-Type: application/json
```

## Endpoint Base

```
https://tu-dominio.replit.app/api/external
```

Reemplaza `tu-dominio` con el dominio de tu aplicación Replit.

## Endpoints Disponibles

### 1. Ventas (Sales Transactions)

#### Obtener ventas
```http
GET /api/external/ventas
```

**Query Parameters:**
- `startDate` (opcional): Fecha inicio (YYYY-MM-DD)
- `endDate` (opcional): Fecha fin (YYYY-MM-DD)
- `salesperson` (opcional): Nombre del vendedor
- `segment` (opcional): Segmento de cliente
- `limit` (opcional): Cantidad de registros (default: 100)
- `offset` (opcional): Offset para paginación (default: 0)

**Ejemplo en Make:**
```
URL: https://tu-dominio.replit.app/api/external/ventas?startDate=2025-01-01&limit=50
Method: GET
Headers: X-API-Key: tu-api-key
```

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "nudo": "12345",
    "feemdo": "2025-01-15",
    "nokoen": "Cliente ABC",
    "nokoprct": "Producto XYZ",
    "nokofu": "Juan Pérez",
    "monto": "150000",
    "tido": "FCV",
    "noruen": "Industrial"
  }
]
```

### 2. Clientes

#### Obtener clientes
```http
GET /api/external/clientes
```

**Query Parameters:**
- `search` (opcional): Búsqueda por nombre o RUT
- `limit` (opcional): Cantidad de registros
- `offset` (opcional): Offset para paginación

**Ejemplo en Make:**
```
URL: https://tu-dominio.replit.app/api/external/clientes?search=Industrial&limit=20
Method: GET
```

### 3. CRM - Leads

#### Obtener leads
```http
GET /api/external/crm/leads
```

**Query Parameters:**
- `stage` (opcional): Etapa del pipeline (nuevo, contacto, visita, etc.)
- `salespersonId` (opcional): ID del vendedor

#### Crear nuevo lead
```http
POST /api/external/crm/leads
```

**Body:**
```json
{
  "clientName": "Empresa Nueva",
  "clientPhone": "+56912345678",
  "clientEmail": "contacto@empresa.com",
  "salespersonId": "vendedor-id",
  "clientType": "nuevo",
  "estimatedValue": "5000000",
  "notes": "Cliente potencial del sector construcción"
}
```

**Ejemplo en Make:**
```
URL: https://tu-dominio.replit.app/api/external/crm/leads
Method: POST
Headers:
  X-API-Key: tu-api-key
  Content-Type: application/json
Body (JSON):
  {
    "clientName": "{{1.nombre}}",
    "clientPhone": "{{1.telefono}}",
    "clientEmail": "{{1.email}}",
    "salespersonId": "{{1.vendedor_id}}",
    "clientType": "nuevo",
    "estimatedValue": "{{1.monto}}"
  }
```

#### Actualizar lead
```http
PATCH /api/external/crm/leads/:id
```

**Body (campos a actualizar):**
```json
{
  "stage": "visita",
  "notes": "Reunión agendada para el 20 de enero"
}
```

#### Eliminar lead
```http
DELETE /api/external/crm/leads/:id
```

### 4. Reclamos Generales

#### Obtener reclamos
```http
GET /api/external/reclamos
```

**Query Parameters:**
- `estado` (opcional): registrado, en_revision_tecnica, en_area_responsable, resuelto, cerrado
- `areaResponsable` (opcional): produccion, laboratorio, logistica, aplicacion
- `limit` (opcional): Cantidad de registros

#### Crear reclamo
```http
POST /api/external/reclamos
```

**Body:**
```json
{
  "clienteNombre": "Cliente ABC",
  "clienteRut": "12345678-9",
  "clienteEmail": "cliente@email.com",
  "clienteTelefono": "+56912345678",
  "motivo": "Calidad de producto",
  "descripcion": "El producto llegó con defectos de fabricación",
  "severidad": "media"
}
```

### 5. Mantención

#### Obtener solicitudes de mantención
```http
GET /api/external/mantencion
```

**Query Parameters:**
- `estado` (opcional): registrado, en_reparacion, resuelto, cerrado
- `tipoMantencion` (opcional): correctivo, preventivo, predictivo
- `limit` (opcional): Cantidad de registros

#### Crear solicitud de mantención
```http
POST /api/external/mantencion
```

**Body:**
```json
{
  "equipoNombre": "Mezcladora Industrial 3",
  "equipoCodigo": "MIX-003",
  "equipoArea": "Producción",
  "equipoUbicacion": "Planta Principal - Sector B",
  "descripcionProblema": "La mezcladora presenta ruido anormal y vibración excesiva",
  "tipoMantencion": "correctivo",
  "severidad": "alta",
  "solicitadoPor": "usuario-id"
}
```

### 6. Tareas

#### Obtener tareas
```http
GET /api/external/tareas
```

**Query Parameters:**
- `assignedTo` (opcional): ID del usuario asignado
- `status` (opcional): pending, in_progress, completed, cancelled
- `limit` (opcional): Cantidad de registros

#### Crear tarea
```http
POST /api/external/tareas
```

**Body:**
```json
{
  "title": "Revisar inventario de pinturas",
  "description": "Realizar conteo físico del inventario de pinturas en bodega principal",
  "priority": "high",
  "dueDate": "2025-02-01",
  "createdBy": "usuario-id"
}
```

#### Actualizar tarea
```http
PATCH /api/external/tareas/:id
```

**Body:**
```json
{
  "status": "completed",
  "notes": "Inventario completado sin novedades"
}
```

#### Eliminar tarea
```http
DELETE /api/external/tareas/:id
```

### 7. Notificaciones

#### Obtener notificaciones
```http
GET /api/external/notificaciones
```

**Query Parameters:**
- `type` (opcional): personal, general, departamento
- `priority` (opcional): baja, media, alta, crítica
- `departamento` (opcional): Logística, Laboratorio, Finanzas, Ventas, Producción, Planificación
- `archived` (opcional): true/false
- `limit` (opcional): Cantidad de registros

#### Crear notificación
```http
POST /api/external/notificaciones
```

**Body:**
```json
{
  "title": "Nueva actualización del sistema",
  "message": "Se ha implementado una nueva funcionalidad de reportes",
  "type": "general",
  "priority": "media",
  "departamento": null,
  "actionUrl": "/reportes"
}
```

### 8. Inventario

#### Obtener productos con stock
```http
GET /api/external/inventario
```

**Query Parameters:**
- `bodega` (opcional): Código de bodega
- `sucursal` (opcional): Código de sucursal
- `limit` (opcional): Cantidad de registros
- `offset` (opcional): Offset para paginación

**Respuesta:**
```json
[
  {
    "sku": "PROD-001",
    "nombre": "Pintura Látex Blanco 1GL",
    "categoria": "Pinturas",
    "unidad1": "GL",
    "unidad2": "LT",
    "precioMedio": "15000",
    "stockTotal": "250",
    "activo": true
  }
]
```

### 9. E-commerce - Pedidos

#### Obtener pedidos e-commerce
```http
GET /api/external/ecommerce/orders
```

**Query Parameters:**
- `status` (opcional): pending, confirmed, in_preparation, dispatched, delivered, cancelled
- `limit` (opcional): Cantidad de registros

#### Actualizar estado de pedido
```http
PATCH /api/external/ecommerce/orders/:id
```

**Body:**
```json
{
  "status": "dispatched"
}
```

### 10. Usuarios

#### Obtener usuarios
```http
GET /api/external/usuarios
```

**Respuesta (sin contraseñas):**
```json
[
  {
    "id": "uuid",
    "email": "usuario@empresa.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "salesperson",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

## Ejemplos de Flujos en Make.com

### Flujo 1: Crear Lead desde Formulario Web

**Escenario**: Cuando un prospecto llena un formulario en tu sitio web, crear automáticamente un lead en el CRM.

**Módulos en Make:**

1. **Webhook** (Trigger)
   - Escucha formularios web entrantes

2. **HTTP - Make a Request** (Action)
   - URL: `https://tu-dominio.replit.app/api/external/crm/leads`
   - Method: `POST`
   - Headers:
     ```
     X-API-Key: tu-api-key
     Content-Type: application/json
     ```
   - Body:
     ```json
     {
       "clientName": "{{1.nombre}}",
       "clientPhone": "{{1.telefono}}",
       "clientEmail": "{{1.email}}",
       "salespersonId": "default-salesperson-id",
       "clientType": "nuevo",
       "estimatedValue": "{{1.presupuesto}}",
       "notes": "Lead generado desde formulario web: {{1.mensaje}}"
     }
     ```

3. **Email** (Action - Opcional)
   - Enviar confirmación al prospecto
   - Notificar al vendedor asignado

### Flujo 2: Sincronizar Ventas con Google Sheets

**Escenario**: Cada día a las 8:00 AM, exportar las ventas del día anterior a Google Sheets.

**Módulos en Make:**

1. **Schedule** (Trigger)
   - Ejecutar diariamente a las 8:00 AM

2. **HTTP - Make a Request** (Action)
   - URL: `https://tu-dominio.replit.app/api/external/ventas?startDate={{formatDate(addDays(now; -1); "YYYY-MM-DD")}}&endDate={{formatDate(now; "YYYY-MM-DD")}}`
   - Method: `GET`
   - Headers:
     ```
     X-API-Key: tu-api-key
     ```

3. **Google Sheets - Add a Row** (Action)
   - Para cada venta del array de respuesta
   - Mapear campos: fecha, cliente, producto, vendedor, monto

### Flujo 3: Notificación Automática de Reclamos Críticos

**Escenario**: Cuando se crea un reclamo con severidad "crítica", enviar notificación inmediata por WhatsApp al supervisor.

**Módulos en Make:**

1. **HTTP - Make a Request** (Trigger/Polling)
   - Cada 5 minutos
   - URL: `https://tu-dominio.replit.app/api/external/reclamos?severidad=critica&limit=10`
   - Method: `GET`
   - Headers:
     ```
     X-API-Key: tu-api-key
     ```

2. **Filter** (Logic)
   - Condición: `createdAt` > última ejecución del flujo

3. **WhatsApp Business - Send Message** (Action)
   - Mensaje: "🚨 RECLAMO CRÍTICO: Cliente {{clienteNombre}} reportó: {{descripcion}}"

### Flujo 4: Actualizar Estado de Tareas desde Slack

**Escenario**: Cuando un usuario marca una tarea como completada en Slack, actualizar el estado en el sistema.

**Módulos en Make:**

1. **Slack - Watch Messages** (Trigger)
   - Escuchar canal #tareas
   - Filtrar mensajes que contengan "completada"

2. **Text Parser** (Logic)
   - Extraer ID de tarea del mensaje

3. **HTTP - Make a Request** (Action)
   - URL: `https://tu-dominio.replit.app/api/external/tareas/{{tarea_id}}`
   - Method: `PATCH`
   - Headers:
     ```
     X-API-Key: tu-api-key
     Content-Type: application/json
     ```
   - Body:
     ```json
     {
       "status": "completed",
       "notes": "Completada desde Slack por {{slack_user}}"
     }
     ```

## Manejo de Errores

La API devuelve códigos HTTP estándar:

- `200 OK`: Petición exitosa
- `201 Created`: Recurso creado exitosamente
- `400 Bad Request`: Datos inválidos o faltantes
- `401 Unauthorized`: API Key faltante o inválida
- `403 Forbidden`: API Key sin permisos suficientes
- `404 Not Found`: Recurso no encontrado
- `500 Internal Server Error`: Error del servidor

**Ejemplo de respuesta de error:**
```json
{
  "error": "Unauthorized",
  "message": "X-API-Key header is required"
}
```

## Mejores Prácticas

1. **Seguridad**
   - Nunca compartas tu API Key públicamente
   - Usa API Keys con permisos mínimos necesarios
   - Rota las API Keys periódicamente
   - Usa HTTPS siempre

2. **Rate Limiting**
   - No excedas 100 peticiones por minuto
   - Implementa retry con backoff exponencial en Make

3. **Paginación**
   - Usa `limit` y `offset` para conjuntos de datos grandes
   - Valor recomendado de `limit`: 50-100 registros

4. **Filtrado**
   - Filtra en el servidor usando query parameters
   - Evita traer todos los registros y filtrar en Make

5. **Manejo de Fechas**
   - Usa formato ISO 8601: `YYYY-MM-DD`
   - Considera zona horaria: Chile (UTC-3 o UTC-4)

6. **Testing**
   - Prueba endpoints con Postman antes de configurar en Make
   - Usa un API Key de prueba diferente a producción

## Recursos Adicionales

- **Postman Collection**: Importa la colección de ejemplo para testing
- **Make.com Templates**: Descarga plantillas pre-configuradas
- **Soporte**: Contacta al administrador del sistema para ayuda

## Ejemplo de Curl para Testing

```bash
# GET ventas
curl -X GET "https://tu-dominio.replit.app/api/external/ventas?limit=5" \
  -H "X-API-Key: tu-api-key"

# POST lead
curl -X POST "https://tu-dominio.replit.app/api/external/crm/leads" \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Test Client",
    "clientPhone": "+56912345678",
    "clientEmail": "test@example.com",
    "salespersonId": "vendedor-123",
    "clientType": "nuevo"
  }'

# PATCH tarea
curl -X PATCH "https://tu-dominio.replit.app/api/external/tareas/tarea-id" \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

---

**Versión**: 1.0  
**Última actualización**: 2 de Noviembre 2025  
**Mantenido por**: Equipo Panorámica
