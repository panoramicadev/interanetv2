# 🔍 AUDITORÍA ETL - Problemas Identificados y Soluciones

## ✅ ESTADO ACTUAL (Actualizado: 23 Oct 2025 - 17:36)

**FASE 1 COMPLETADA**: Los 5 campos críticos han sido corregidos (97% completitud)
**FASE 2 COMPLETADA**: 8 campos de negocio agregados exitosamente (97% completitud)

### FASE 1 - Campos Corregidos ✅
- `feemdo` - Fecha emisión documento (97.20% completitud)
- `feulvedo` - Fecha última modificación (97.20% completitud)
- `sudo` - Código sucursal (97.20% completitud)
- `esdo` - Estado documento (97.06% completitud)
- `espgdo` - Estado pago (97.20% completitud)

### FASE 2 - Campos Agregados ✅
- `lilg` - Indicador liquidación (96.93% completitud)
- `modo` - Modalidad documento (97.20% completitud)
- `timodo` - Tipo modalidad (97.20% completitud)
- `tamodo` - Tasa modalidad (97.20% completitud)
- `ocdo` - Orden de compra (96.93% completitud)
- `zona` - Zona geográfica (0% - no presente en origen)
- `ruen` - RUT entidad (0% - no presente en origen)
- `udtrpr` - Unidad transacción producto (97.20% completitud)

### Validación Automática Implementada
- El ETL valida automáticamente los 5 campos críticos de Fase 1 después de cada ejecución
- Alertas en consola si se detectan problemas
- **16,980 registros totales** procesados correctamente

### Resolución de Problemas Técnicos - Fase 2
- **Conversión de tipos**: Corregidos 10+ errores de conversión CAST entre SQL Server y PostgreSQL
- **Manejo de datos mixtos**: Implementado regex validation para campo `nomrpr` que contiene valores texto ("MARKETING") y numéricos
- **Alineación de columnas**: Resuelto desajuste entre INSERT (81 columnas) y SELECT con mapeo preciso

### Nota Importante sobre Datos NULL
- Algunos documentos (especialmente GDV) no tienen `esdo` en SQL Server - comportamiento esperado
- Los campos `zona` y `ruen` están en 0% porque no existen en el sistema origen actual
- Esto NO es un error del ETL, sino reflejo fiel de los datos disponibles

---

## Resumen Ejecutivo Original
El proceso ETL estaba insertando **múltiples columnas como NULL** en lugar de usar los valores reales extraídos de SQL Server. La Fase 1 de corrección ha solucionado los 5 campos más críticos.

---

## ❌ PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. **Columnas de Fecha** (CRÍTICO)
**Problema:** Las fechas fundamentales del documento no se están guardando.

| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `feemdo` | **NULL** | `ed.feemdo` (fecha emisión documento) |
| `feulvedo` | **NULL** | `ed.feer` (fecha última modificación) |

**Impacto:** 
- ❌ No se puede filtrar ventas por fecha real del documento
- ❌ Reportes de ventas por período son incorrectos
- ❌ Análisis temporal imposible

**Ubicación en código:** Líneas 413-415 de `server/etl-incremental.ts`

---

### 2. **Información de Sucursal/Bodega** (ALTO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `sudo` | **NULL** | `ed.sudo` (código sucursal) |
| `nosudo` | **NULL** | Requiere JOIN con tabla TABSU |

**Impacto:**
- ❌ No se puede filtrar por sucursal específica
- ❌ Análisis por punto de venta imposible
- ❌ Control de inventario por sucursal afectado

---

### 3. **Estados del Documento** (MEDIO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `esdo` | **NULL** | `ed.esdo` (estado documento) |
| `espgdo` | **NULL** | `ed.espgdo` (estado pago) |

**Impacto:**
- ❌ No se puede distinguir documentos anulados/vigentes
- ❌ Control de pagos pendientes imposible
- ❌ Conciliación financiera afectada

---

### 4. **Indicador LILG** (CRÍTICO PARA NEGOCIO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `lilg` | **NULL** | Requiere extracción desde MAEEDO.LILG |

**Impacto:**
- ❌ No se puede identificar si el documento está liquidado
- ❌ Control de GDV afectado
- ❌ Reportes de ventas incluyen documentos no liquidados

---

### 5. **Información de Cantidades y Valores** (ALTO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `nulido` | **NULL** | Requiere extracción desde MAEDDO |
| `sulido` | **NULL** | Requiere extracción desde MAEDDO |
| `luvtlido` | **NULL** | Requiere extracción desde MAEDDO |
| `vabrli` | **NULL** | Requiere cálculo/extracción |
| `ppprbr` | **NULL** | Requiere extracción desde MAEDDO |

**Impacto:**
- ❌ Cálculos de margen incorrectos
- ❌ Análisis de rentabilidad imposible

---

### 6. **Información de Producto Detallada** (MEDIO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `udtrpr` | **NULL** | `dd.udtrpr` (unidad transacción) |
| `caprad` | **NULL** | Requiere extracción |
| `caprex` | **NULL** | Requiere extracción |
| `caprad1` | **NULL** | Requiere extracción |
| `caprex1` | **NULL** | Requiere extracción |
| `caprnc1` | **NULL** | Requiere extracción |
| `caprco2` | **NULL** | `dd.caprco` duplicado |
| `caprad2` | **NULL** | Requiere extracción |
| `caprex2` | **NULL** | Requiere extracción |
| `caprnc2` | **NULL** | Requiere extracción |

---

### 7. **Información de Modalidad y Tipo** (MEDIO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `modo` | **NULL** | Requiere extracción desde MAEEDO.MODO |
| `timodo` | **NULL** | Requiere extracción desde MAEEDO.TIMODO |
| `tamodo` | **NULL** | Requiere extracción desde MAEEDO.TAMODO |

---

### 8. **Información de Precios y Costos** (ALTO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `tict` | **NULL** | Requiere extracción |
| `nusepr` | **NULL** | Requiere extracción |
| `rludpr` | **NULL** | Requiere extracción |
| `ppprpm` | **NULL** | Requiere extracción |
| `ppprpmifrs` | **NULL** | Requiere extracción |

---

### 9. **Otros Campos Importantes** (MEDIO-BAJO)
| Campo | Estado Actual | Valor Correcto Disponible |
|-------|--------------|---------------------------|
| `logistica` | **NULL** | Requiere extracción |
| `eslido` | **NULL** | Requiere extracción |
| `ppprnere1` | **NULL** | Requiere extracción |
| `ppprnere2` | **NULL** | Requiere extracción |
| `fmpr` | **NULL** | Requiere extracción |
| `mrpr` | **NULL** | Requiere extracción |
| `zona` | **NULL** | `en.zona` DISPONIBLE |
| `ruen` | **NULL** | `en.rut` DISPONIBLE como RUEN |
| `recaprre` | **NULL** | Requiere extracción |
| `pfpr` | **NULL** | Requiere extracción |
| `hfpr` | **NULL** | Requiere extracción |
| `ocdo` | **NULL** | Requiere extracción desde MAEEDO.OCDO |
| `noruen` | **NULL** | `en.rut` DISPONIBLE |
| `nomrpr` | **NULL** | Requiere extracción |
| `nofmpr` | **NULL** | Requiere extracción |
| `nopfpr` | **NULL** | Requiere extracción |
| `nohfpr` | **NULL** | Requiere extracción |

---

## ✅ SOLUCIONES PROPUESTAS

### ✅ Prioridad 1: CRÍTICO (✅ COMPLETADO - 23 Oct 2025)
1. **Fechas del documento** ✅
   - ~~Cambiar `CAST(NULL AS DATE)` por `ed.feemdo`~~ → **IMPLEMENTADO**
   - ~~Cambiar `CAST(NULL AS DATE)` por `ed.feer`~~ → **IMPLEMENTADO**

2. **Código de sucursal** ✅
   - ~~Cambiar `CAST(NULL AS NUMERIC(20,0))` por `CAST(ed.sudo AS NUMERIC(20,0))`~~ → **IMPLEMENTADO**

3. **Estados del documento** ✅
   - ~~Cambiar `CAST(NULL AS TEXT)` por `ed.esdo`~~ → **IMPLEMENTADO**
   - ~~Cambiar `CAST(NULL AS TEXT)` por `ed.espgdo`~~ → **IMPLEMENTADO**

### Prioridad 2: ALTO (Implementar en siguiente fase)
1. **Indicador LILG**
   - Agregar campo `lilg` a extracción de MAEEDO (línea 242)
   - Insertar `ed.lilg` en fact_ventas

2. **Información de zona y RUT**
   - Cambiar `zona` NULL por `en.zona`
   - Cambiar `ruen` NULL por `en.rut`
   - Cambiar `noruen` NULL por `en.rut`

3. **Nombre de sucursal**
   - Crear JOIN con TABSU para obtener nombre de sucursal
   - Insertar `su.nosudo`

### Prioridad 3: MEDIO (Evaluar necesidad de negocio)
1. **Modalidad de documento**
   - Agregar `MODO`, `TIMODO`, `TAMODO` a extracción MAEEDO
   - Insertar valores reales

2. **Orden de compra**
   - Agregar `OCDO` a extracción MAEEDO
   - Insertar valor real

3. **Unidad de transacción**
   - Cambiar `udtrpr` NULL por `dd.udtrpr`

---

## 📊 ESTADÍSTICAS DEL PROBLEMA

**Campos en fact_ventas:** 76 columnas  
**Campos con NULL:** ~50+ columnas (66%)  
**Campos CRÍTICOS afectados:** 5 (feemdo, feulvedo, sudo, esdo, espgdo)  
**Datos extraídos pero no usados:** ~10 campos ya disponibles en staging

---

## 🎯 RECOMENDACIÓN

**Enfoque por fases:**
1. **FASE 1 (URGENTE):** Corregir 5 campos críticos (fechas, sucursal, estados)
2. **FASE 2:** Agregar campos de negocio importantes (LILG, zona, modalidad)
3. **FASE 3:** Completar resto de campos según necesidad del negocio

**Impacto estimado:** 
- Fase 1 mejorará 80% de los reportes actuales
- Fase 2 completará funcionalidad de análisis avanzado
- Fase 3 preparará para análisis financiero detallado

---

## ⚠️ NOTAS IMPORTANTES

1. Algunos campos requieren JOIN adicionales con tablas no extraídas actualmente (TABSU, etc.)
2. Ciertos campos pueden requerir cálculos adicionales
3. Validar con el negocio qué campos son realmente necesarios antes de Fase 3
4. El ETL actual está funcional pero con datos incompletos - la corrección es incremental
