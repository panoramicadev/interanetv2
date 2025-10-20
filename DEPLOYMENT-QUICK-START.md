# 🚀 Deployment Quick Start - PANORAMICA

## ⚡ Pasos Rápidos para Producción

### 1️⃣ Configurar Secrets (Antes de Publicar)

Ve a **Secrets** en Replit y configura con valores de **PRODUCCIÓN**:

```
SQL_SERVER_HOST = [tu-servidor-produccion.com]
SQL_SERVER_PORT = 1433
SQL_SERVER_USER = [usuario-prod]
SQL_SERVER_PASSWORD = [password-prod]
SQL_SERVER_DATABASE = PANORAMICA
```

> ℹ️ `DATABASE_URL` se configura automáticamente por Replit

---

### 2️⃣ Publicar

1. Presiona el botón **"Publish"** en Replit
2. Selecciona **"Autoscale Deployment"**
3. Nombre sugerido: `panoramica-dashboard-prod`

---

### 3️⃣ Configurar Comandos de Deployment

**Build Command:**
```bash
sh -c "npm run db:push && npm run build"
```

**Run Command:**
```bash
sh scripts/production-start.sh
```

---

### 4️⃣ Deploy

Presiona **"Deploy"** y espera 2-5 minutos

---

## ✅ Verificación Post-Deployment

### Paso 1: Verificar App
Accede a: `https://tu-deployment.replit.app`

### Paso 2: Verificar ETL
1. Ve a: `/etl-monitor`
2. Espera 30 segundos
3. Confirma que aparezca la primera ejecución automática
4. Estado debe ser: **"Éxito"** ✅

### Paso 3: Verificar Dashboard
1. Ve a: `/dashboard`
2. Confirma que se muestran datos de ventas

---

## 🔧 Características en Producción

### ✨ Funcionamiento Automático

- ✅ **ETL**: Se ejecuta automáticamente cada 15 minutos
- ✅ **Migraciones**: Se aplican automáticamente en cada deploy
- ✅ **Primera Ejecución**: ETL corre 30 segundos después de arrancar

### 📊 Monitoreo

- Panel ETL: `/etl-monitor`
- Auto-refresh cada 10 segundos
- Historial completo de ejecuciones
- Ejecución manual disponible

---

## 🆘 ¿Problemas?

### ETL no ejecuta
→ Verifica secrets de SQL Server en deployment

### Panel no muestra datos
→ Revisa logs del deployment, busca errores de ETL

### Error de conexión
→ Confirma que SQL Server permite conexiones desde Replit

---

## 📖 Documentación Completa

Para más detalles, ver: **`GUIA-DEPLOYMENT-PRODUCCION.md`**

---

**¡Listo para producción! 🎉**
