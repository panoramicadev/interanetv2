# Instrucciones para Replicar el Schema ETL en Producción

## ⚠️ IMPORTANTE
Como agente de IA, **no tengo acceso a la base de datos de producción** por razones de seguridad. Debes seguir estos pasos manualmente para replicar el schema y ejecutar el ETL en producción.

## 📋 Pasos para Configurar el ETL en Producción

### 1. Crear el Schema en la Base de Datos de Producción

1. **Abre el panel de Base de Datos en Replit**
   - En el menú lateral izquierdo, haz clic en el ícono de "Database"
   - Cambia a la pestaña **"Production"** (no Development)

2. **Ejecuta el script SQL**
   - Abre el archivo `production-etl-setup.sql` que se encuentra en la raíz del proyecto
   - Copia todo el contenido del archivo
   - En el panel de Base de Datos de Producción, busca el **SQL Runner** o **Query Editor**
   - Pega el contenido completo del script
   - Haz clic en **"Run"** o **"Execute"**

3. **Verifica que las tablas se crearon correctamente**
   - Ejecuta la siguiente consulta para verificar:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'ventas'
   ORDER BY table_name;
   ```
   - Deberías ver 8 tablas:
     - etl_execution_log
     - fact_ventas
     - stg_maeddo
     - stg_maeedo
     - stg_maeen
     - stg_maepr
     - stg_maeven
     - stg_tabbo
     - stg_tabpp

### 2. Verificar las Variables de Entorno de SQL Server

El proceso ETL necesita las siguientes variables de entorno para conectarse a SQL Server:

- `SQL_SERVER_HOST` - Host del servidor SQL Server
- `SQL_SERVER_PORT` - Puerto (usualmente 1433)
- `SQL_SERVER_USER` - Usuario de SQL Server
- `SQL_SERVER_PASSWORD` - Contraseña de SQL Server
- `SQL_SERVER_DATABASE` - Nombre de la base de datos (PANORAMICA)

**Verifica que estas variables estén configuradas:**
1. Ve a "Tools" → "Secrets" en Replit
2. Confirma que todas las variables listadas arriba existen y tienen los valores correctos

### 3. Ejecutar el ETL en Producción

Una vez que el schema esté creado en producción:

#### Opción A: Ejecutar desde la Terminal de Replit

```bash
# Ejecutar el ETL para el año 2025
NODE_ENV=production tsx server/etl-process.ts
```

#### Opción B: Crear un Script Programado

Puedes configurar un cron job o tarea programada para ejecutar el ETL automáticamente:

1. Crea un archivo `.replit` o modifica el existente para agregar:
```toml
[deployment]
run = ["tsx", "server/etl-process.ts"]
```

### 4. Monitorear la Ejecución del ETL

El proceso ETL:
- Muestra logs detallados en la consola
- Registra cada ejecución en la tabla `ventas.etl_execution_log`
- Procesa los siguientes tipos de documento: **FCV, GDV, FVL, NCV, BLV, FDV**
- Procesa las sucursales: **004, 006, 007**
- Procesa todos los meses del año 2025 (enero a octubre)

**Para revisar el historial de ejecuciones:**
```sql
SELECT 
  execution_date,
  status,
  period,
  document_types,
  records_processed,
  execution_time_ms,
  error_message
FROM ventas.etl_execution_log
ORDER BY execution_date DESC
LIMIT 10;
```

### 5. Consultar los Datos Cargados

Una vez completado el ETL, puedes consultar los datos:

```sql
-- Ver resumen de ventas por mes
SELECT 
  DATE_TRUNC('month', feemli) as mes,
  COUNT(*) as total_registros,
  SUM(monto) as monto_total
FROM ventas.fact_ventas
GROUP BY DATE_TRUNC('month', feemli)
ORDER BY mes DESC;

-- Ver total de registros por tipo de documento
SELECT 
  tido,
  COUNT(*) as cantidad,
  SUM(monto) as monto_total
FROM ventas.fact_ventas
GROUP BY tido
ORDER BY cantidad DESC;
```

## 🔍 Verificación de Datos

Para verificar que los datos se cargaron correctamente:

```sql
-- Total de registros cargados
SELECT COUNT(*) FROM ventas.fact_ventas;

-- Rango de fechas
SELECT 
  MIN(feemli) as fecha_inicial,
  MAX(feemli) as fecha_final
FROM ventas.fact_ventas;

-- Tipos de documento procesados
SELECT DISTINCT tido 
FROM ventas.fact_ventas
ORDER BY tido;
```

## 📊 Tipos de Documento Incluidos

El ETL ahora procesa los siguientes tipos de documento:
- **FCV** - Facturas de Venta
- **GDV** - Guías de Despacho de Venta (solo pendientes)
- **FVL** - Facturas de Venta Libres
- **NCV** - Notas de Crédito de Venta
- **BLV** - Boletas de Venta (NUEVO)
- **FDV** - Facturas de Despacho de Venta (NUEVO)

## ⚙️ Configuración Avanzada

### Cambiar el Año a Procesar

Si necesitas procesar un año diferente, edita el archivo `server/etl-process.ts`:

```typescript
// Línea ~641
const year = 2025;  // Cambia el año aquí
const currentMonth = 10;  // O el mes hasta el que quieres procesar
```

### Agregar Más Tipos de Documento

Si necesitas agregar más tipos de documento, edita el archivo `server/etl-process.ts`:

```typescript
// Línea ~44
const tiposDoc = ['FCV', 'GDV', 'FVL', 'NCV', 'BLV', 'FDV'];  // Agrega más aquí
```

## 🆘 Solución de Problemas

### Error: "relation ventas.fact_ventas does not exist"
- **Solución**: Ejecuta el script `production-etl-setup.sql` en la base de datos de producción

### Error: "Login failed for user"
- **Solución**: Verifica las credenciales de SQL Server en las variables de entorno

### Error: "Deadlock victim"
- **Solución**: Este es un error temporal de SQL Server. Simplemente vuelve a ejecutar el ETL

### El ETL tarda mucho tiempo
- **Normal**: Procesar un año completo puede tomar 1-2 minutos dependiendo del volumen de datos

## 📝 Notas Importantes

1. **El ETL limpia y recarga** la tabla `fact_ventas` completamente en cada ejecución
2. **Las tablas staging** (`stg_*`) se limpian y recargan en cada mes procesado
3. **Los índices** ayudan a mejorar el rendimiento de las consultas
4. **El log de ejecuciones** te permite auditar todas las ejecuciones del ETL

---

Si tienes alguna duda o problema, revisa los logs del ETL o consulta la tabla `ventas.etl_execution_log`.
