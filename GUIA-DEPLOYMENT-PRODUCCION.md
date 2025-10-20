# 🚀 Guía de Deployment a Producción - PANORAMICA Dashboard

## 📋 Resumen

Esta guía te permitirá desplegar el sistema completo (Panel Web + ETL Worker) a producción en Replit usando **Autoscale Deployment**.

## ✅ Pre-requisitos

Antes de iniciar el deployment, asegúrate de tener:

### 1. Secrets de Producción SQL Server
Configura estos secrets en la pestaña "Secrets" de Replit con valores de **producción**:

- `SQL_SERVER_HOST` - Host del servidor SQL Server de producción
- `SQL_SERVER_PORT` - Puerto (normalmente 1433)
- `SQL_SERVER_USER` - Usuario de SQL Server
- `SQL_SERVER_PASSWORD` - Contraseña de SQL Server
- `SQL_SERVER_DATABASE` - Nombre de la base de datos (PANORAMICA)

> **Nota:** El `DATABASE_URL` de PostgreSQL se configura automáticamente por Replit

### 2. Verificar Secrets en Development

Puedes verificar que los secrets están configurados ejecutando:
```bash
echo $SQL_SERVER_HOST
```

## 🎯 Pasos para Desplegar

### Paso 1: Preparar el Deployment

1. Haz clic en el botón **"Publish"** (Publicar) en la parte superior de Replit
2. Selecciona **"Autoscale Deployment"**
3. Dale un nombre descriptivo: `panoramica-dashboard-prod`

### Paso 2: Configurar Build y Run Commands

En la configuración del deployment, establece:

#### **Build Command:**
```bash
sh -c "npm run db:push && npm run build"
```

O alternativamente:
```bash
sh scripts/production-build.sh && npm run db:push
```

> **Explicación:** Esto ejecutará primero las migraciones de base de datos y luego construirá la aplicación.

#### **Run Command:**
```bash
sh scripts/production-start.sh
```

O alternativamente:
```bash
sh -c "npm run db:push && npm run start"
```

> **Explicación:** Esto asegura que las migraciones estén aplicadas antes de arrancar el servidor.

### Paso 3: Configurar Secrets de Producción (Opcional)

Si necesitas valores **diferentes** para producción vs desarrollo:

1. En la configuración del deployment, busca **"Deployment Secrets"**
2. Desvincula (unsync) los secrets que quieras sobrescribir
3. Ingresa los valores específicos de producción

Los secrets que normalmente son iguales:
- `DATABASE_URL` (auto-configurado por Replit)

Los secrets que debes configurar para producción:
- `SQL_SERVER_HOST`
- `SQL_SERVER_PORT`
- `SQL_SERVER_USER`
- `SQL_SERVER_PASSWORD`
- `SQL_SERVER_DATABASE`

### Paso 4: Publicar

1. Revisa la configuración
2. Haz clic en **"Deploy"** (Desplegar)
3. Espera a que el deployment se complete (puede tomar 2-5 minutos)

## 🔄 Funcionamiento del ETL en Producción

### ETL Automático
El ETL está configurado para ejecutarse automáticamente:

- ✅ **Primera ejecución:** 30 segundos después de arrancar el servidor
- ✅ **Ejecuciones periódicas:** Cada 15 minutos
- ✅ **Proceso:** Extrae de SQL Server → Transforma → Carga a PostgreSQL

### ETL Manual

Puedes ejecutar el ETL manualmente desde el panel:

1. Accede a: `https://tu-deployment.replit.app/etl-monitor`
2. Haz clic en **"Ejecutar ETL Ahora"**
3. El sistema procesará solo registros nuevos/modificados (incremental)

### Monitoreo del ETL

El panel `/etl-monitor` muestra:

- 📊 Estado de la última ejecución (éxito/error)
- ⏰ Timestamp de última ejecución
- 📈 Estadísticas (registros procesados, tiempo de ejecución)
- 📝 Historial de ejecuciones
- 🔄 Auto-refresh cada 10 segundos

## 🗄️ Migraciones de Base de Datos

### Migraciones Automáticas

Las migraciones se ejecutan automáticamente en estos momentos:

1. **Durante el Build:** `npm run db:push` en build command
2. **Durante el Start:** `npm run db:push` en start command (redundancia)

Esto garantiza que el esquema de producción esté siempre sincronizado con el código.

### Migraciones Manuales (si es necesario)

Si necesitas ejecutar migraciones manualmente:

```bash
npm run db:push
```

## 🔐 Gestión de Secrets

### Sincronización Automática

Por defecto, los secrets de tu workspace se copian automáticamente al deployment.

### Sobrescribir Secrets para Producción

Si necesitas valores diferentes en producción:

1. En el deployment config, busca el secret específico
2. Haz clic en **"Unsync"** (Desvincular)
3. Ingresa el valor de producción

## ✅ Verificación Post-Deployment

### 1. Verificar que la App está corriendo

Accede a tu deployment URL: `https://tu-deployment.replit.app`

### 2. Verificar Login

Intenta hacer login con un usuario existente.

### 3. Verificar ETL

1. Ve a `/etl-monitor`
2. Espera 30 segundos después del deployment
3. Verifica que aparezca la primera ejecución automática
4. Revisa el estado: debe ser **"Éxito"**

### 4. Verificar Dashboard

1. Ve a `/dashboard`
2. Verifica que se muestren datos de ventas
3. Confirma que las métricas sean correctas

### 5. Verificar Logs

En el deployment panel de Replit:

1. Ve a la pestaña **"Logs"**
2. Busca estos mensajes:
   ```
   🔄 ETL automatic scheduler initialized (runs every 15 minutes)
   📊 Running initial ETL on startup...
   ✅ ETL completed successfully
   ```

## 🐛 Troubleshooting

### Error: "Cannot connect to SQL Server"

**Solución:**
1. Verifica que los secrets estén configurados correctamente
2. Confirma que el servidor SQL Server permita conexiones desde Replit
3. Verifica firewall/IP whitelist del SQL Server

### Error: "Database migration failed"

**Solución:**
1. Revisa los logs del deployment
2. Verifica que `DATABASE_URL` esté configurado
3. Confirma que PostgreSQL esté provisionado

### ETL no se ejecuta automáticamente

**Solución:**
1. Verifica los logs del servidor
2. Busca errores de conexión a SQL Server
3. Ejecuta manualmente desde `/etl-monitor` para ver error específico

### Panel muestra "Cargando..." indefinidamente

**Solución:**
1. Verifica que el ETL haya ejecutado al menos una vez
2. Confirma que hay datos en `fact_ventas` table
3. Revisa logs del navegador (F12 → Console)

## 📊 Monitoreo Continuo

### Métricas a Vigilar

1. **ETL Status:**
   - Frecuencia: Revisar diariamente
   - Métrica: Tasa de éxito > 95%
   - Acción: Si falla, revisar logs

2. **Performance:**
   - Tiempo de carga del dashboard < 3 segundos
   - Tiempo de ejecución ETL < 60 segundos

3. **Errores:**
   - Revisar logs semanalmente
   - Configurar alertas para errores críticos

## 🔄 Actualizaciones Futuras

### Para actualizar el código en producción:

1. Haz los cambios en tu workspace de desarrollo
2. Prueba que todo funcione correctamente
3. Ve al deployment
4. Haz clic en **"Redeploy"**
5. El sistema ejecutará automáticamente:
   - Migraciones de base de datos
   - Build del código nuevo
   - Reinicio del servidor

## 📞 Soporte

Si encuentras problemas que no están cubiertos en esta guía:

1. Revisa los logs del deployment
2. Verifica que todos los secrets estén configurados
3. Contacta al equipo de desarrollo con:
   - Descripción del error
   - Screenshots de logs
   - Pasos para reproducir el problema

---

## ✅ Checklist de Deployment

Antes de publicar, confirma:

- [ ] Secrets de SQL Server configurados (producción)
- [ ] Build command: `sh -c "npm run db:push && npm run build"`
- [ ] Run command: `sh scripts/production-start.sh`
- [ ] Deployment type: **Autoscale**
- [ ] Secrets sincronizados o sobrescritos según sea necesario

Después de publicar, verifica:

- [ ] App cargando correctamente
- [ ] Login funcional
- [ ] ETL ejecutándose automáticamente
- [ ] Dashboard mostrando datos
- [ ] Panel `/etl-monitor` accesible
- [ ] No hay errores en logs

---

**¡Listo para producción! 🎉**
