# 📊 ANÁLISIS COMPARATIVO: Columnas CSV vs ETL Actual

## Fecha de Análisis: 23 Octubre 2025

---

## ✅ COLUMNAS IMPORTÁNDOSE CORRECTAMENTE (Con Datos Reales)

### Desde MAEEDO (Encabezado del Documento)
| Campo CSV | Campo fact_ventas | Estado | Fuente | Observaciones |
|-----------|-------------------|--------|--------|---------------|
| IDMAEEDO | idmaeedo | ✅ 97% | ed.idmaeedo | Clave principal documento |
| TIDO | tido | ✅ 97% | ed.tido | Tipo de documento (FCV, GDV, etc.) |
| NUDO | nudo | ✅ 97% | ed.nudo | Número de documento |
| ENDO | endo | ✅ 97% | ed.endo | Código entidad/cliente |
| SUENDO | suendo | ✅ 97% | ed.suendo | Sub-entidad |
| SUDO | sudo | ✅ 97% | ed.sudo | Código sucursal |
| FEEMDO | feemdo | ✅ 97% | ed.feemdo | Fecha emisión documento |
| FEULVEDO | feulvedo | ✅ 97% | ed.feer | Fecha última modificación |
| KOFUDO | kofudo | ✅ 97% | ed.kofudo | Código vendedor |
| MODO | modo | ✅ 97% | ed.modo | Modalidad documento |
| TIMODO | timodo | ✅ 97% | ed.timodo | Tipo modalidad |
| TAMODO | tamodo | ✅ 97% | ed.tamodo | Tasa modalidad |
| VANEDO | vanedo | ✅ 97% | ed.vanedo | Valor neto documento |
| VAIVDO | vaivdo | ✅ 97% | ed.vaivdo | Valor IVA documento |
| VABRDO | vabrdo | ✅ 97% | ed.vabrdo | Valor bruto documento |
| LILG | lilg | ✅ 97% | ed.lilg | Indicador liquidación |
| BOSULIDO | bosulido | ✅ 97% | ed.bosulido | Bodega sucursal liquidación |
| OCDO | ocdo | ✅ 97% | ed.ocdo | Orden de compra |
| **ESDO** | esdo | ✅ 97% | ed.esdo | **Estado documento** (FASE 1) |
| **ESPGDO** | espgdo | ✅ 97% | ed.espgdo | **Estado pago** (FASE 1) |

### Desde MAEDDO (Detalle del Documento)
| Campo CSV | Campo fact_ventas | Estado | Fuente | Observaciones |
|-----------|-------------------|--------|--------|---------------|
| IDMAEDDO | idmaeddo | ✅ 97% | dd.idmaeddo | Clave principal línea detalle |
| KOPRCT | koprct | ✅ 97% | dd.koprct | Código producto |
| UDTRPR | udtrpr | ✅ 97% | dd.udtrpr | Unidad transacción producto |
| CAPRCO1 | caprco1 | ✅ 97% | dd.caprco | Cantidad producto (UD1) |
| CAPRCO2 | caprco2 | ✅ 97% | dd.caprco | Cantidad producto (UD2) |
| PPPRNE | ppprne | ✅ 97% | dd.preuni | Precio unitario neto |
| VANELI | vaneli | ✅ 97% | dd.vaneli | Valor neto línea |
| FEEMLI | feemli | ✅ 97% | dd.feemli | Fecha emisión línea |
| FEERLI | feerli | ✅ 97% | dd.feerli | Fecha emisión/recepción línea |
| DEVOL1 | devol1 | ✅ 97% | dd.devol1 | Devolución 1 |
| DEVOL2 | devol2 | ✅ 97% | dd.devol2 | Devolución 2 |
| STOCKFIS | stockfis | ✅ 97% | dd.stockfis | Stock físico |
| NOKOPRCT | nokoprct | ✅ 97% | dd.nokopr | Nombre producto |

### Desde MAEPR (Productos)
| Campo CSV | Campo fact_ventas | Estado | Fuente | Observaciones |
|-----------|-------------------|--------|--------|---------------|
| TIPR | tipr | ✅ 97% | pr.tipr | Tipo producto |
| UD01PR | ud01pr | ✅ 97% | pr.ud01pr | Unidad 1 producto |
| UD02PR | ud02pr | ✅ 97% | pr.ud02pr | Unidad 2 producto |
| **PM** | listacost | ✅ 97% | pr.PM | Precio medio/costo (de MAEPR) |
| **PM** | liscosmod | ✅ 97% | pr.PM | Lista costo modificada (de MAEPR) |

### Desde MAEEN (Entidades/Clientes)
| Campo CSV | Campo fact_ventas | Estado | Fuente | Observaciones |
|-----------|-------------------|--------|--------|---------------|
| **KOEN** | nokoen | ✅ 97% | en.nokoen | Nombre cliente/entidad |
| **RUEN** | noruen | ✅ 97% | en.rut | RUT entidad (como texto) |
| ZONA | zona | ⚪ 0% | en.zona | Zona geográfica (con regex validation) |
| RUEN | ruen | ⚪ 0% | en.rut | RUT como numérico (con regex validation) |

### Desde TABFU/MAEVEN (Vendedores)
| Campo CSV | Campo fact_ventas | Estado | Fuente | Observaciones |
|-----------|-------------------|--------|--------|---------------|
| **NOKOFU** | nokofu | ✅ 97% | ve.nokofu | Nombre vendedor |

### Desde TABBO (Bodegas)
| Campo CSV | Campo fact_ventas | Estado | Fuente | Observaciones |
|-----------|-------------------|--------|--------|---------------|
| **NOBOSULI** | nobosuli | ✅ 97% | bo.nobosuli | Nombre bodega |

### Campos Calculados
| Campo | Estado | Fórmula | Observaciones |
|-------|--------|---------|---------------|
| MONTO | ✅ 97% | `caprco * preuni * (NCV ? -1 : 1)` | Calculado según tipo documento |

---

## ❌ COLUMNAS NO IMPORTÁNDOSE (Actualmente NULL)

### Alta Prioridad - Datos Disponibles en CSV
| Campo CSV | Campo fact_ventas | Razón | Impacto | Solución Propuesta |
|-----------|-------------------|-------|---------|-------------------|
| **CAPRAD** | caprad | NULL | ALTO | Cantidad producto adicional - necesita mapeo desde MAEDDO.CAPRAD |
| **CAPREX** | caprex | NULL | ALTO | Cantidad producto excedente - necesita mapeo desde MAEDDO.CAPREX |
| **NULIDO** | nulido | NULL | MEDIO | Número liquidación - disponible en MAEEDO |
| **SULIDO** | sulido | NULL | MEDIO | Sucursal liquidación - disponible en MAEEDO |
| **LUVTLIDO** | luvtlido | NULL | MEDIO | Valor total liquidación - disponible en MAEEDO |
| **KOFULIDO** | kofulido | ⚠️ Valor fijo | MEDIO | Código vendedor liquidación - actualmente usa ed.kofudo |
| **PRCT** | prct | NULL | BAJO | Porcentaje - necesita mapeo |
| **TICT** | tict | NULL | BAJO | Tipo cuenta - necesita mapeo |
| **NUSEPR** | nusepr | NULL | BAJO | Número serie producto - necesita mapeo desde MAEDDO |
| **RLUDPR** | rludpr | NULL | MEDIO | Relación unidad producto - necesita mapeo desde MAEDDO |
| **CAPRAD1** | caprad1 | NULL | ALTO | Cantidad adicional UD1 - necesita mapeo desde MAEDDO |
| **CAPREX1** | caprex1 | NULL | ALTO | Cantidad excedente UD1 - necesita mapeo desde MAEDDO |
| **CAPRNC1** | caprnc1 | NULL | ALTO | Cantidad neta UD1 - necesita mapeo desde MAEDDO |
| **CAPRAD2** | caprad2 | NULL | ALTO | Cantidad adicional UD2 - necesita mapeo desde MAEDDO |
| **CAPREX2** | caprex2 | NULL | ALTO | Cantidad excedente UD2 - necesita mapeo desde MAEDDO |
| **CAPRNC2** | caprnc2 | NULL | ALTO | Cantidad neta UD2 - necesita mapeo desde MAEDDO |
| **PPPRBR** | ppprbr | NULL | ALTO | Precio bruto producto - necesita mapeo desde MAEDDO |
| **VABRLI** | vabrli | NULL | MEDIO | Valor bruto línea - necesita mapeo desde MAEDDO |
| **PPPRPM** | ppprpm | NULL | MEDIO | Precio promedio - necesita mapeo desde MAEDDO |
| **PPPRPMIFRS** | ppprpmifrs | NULL | MEDIO | Precio promedio IFRS - necesita mapeo desde MAEDDO |
| **LOGISTICA** | logistica | NULL | MEDIO | Indicador logística - necesita mapeo desde MAEDDO |
| **ESLIDO** | eslido | NULL | BAJO | Estado liquidación - necesita mapeo desde MAEDDO |
| **PPPRNERE1** | ppprnere1 | NULL | MEDIO | Precio neto real 1 - necesita mapeo desde MAEDDO |
| **PPPRNERE2** | ppprnere2 | NULL | MEDIO | Precio neto real 2 - necesita mapeo desde MAEDDO |
| **FMPR** | fmpr | NULL | MEDIO | Familia producto - necesita mapeo desde MAEPR |
| **MRPR** | mrpr | NULL | MEDIO | Marca producto - necesita mapeo desde MAEPR |
| **PFPR** | pfpr | NULL | BAJO | Peso factor producto - necesita mapeo |
| **HFPR** | hfpr | NULL | BAJO | Altura factor producto - necesita mapeo |
| **NOKOZO** | nokozo | NULL | BAJO | Nombre zona - necesita mapeo desde TABZO |
| **NOSUDO** | nosudo | NULL | MEDIO | Nombre sucursal - necesita JOIN con TABSU |
| **NOKOFUDO** | nokofudo | NULL | BAJO | Nombre código fundo - actualmente usa nokoen |
| **NOMRPR** | nomrpr | ⚠️ Regex | BAJO | Nombre marca producto - con validación regex (texto/numérico) |
| **NOFMPR** | nofmpr | NULL | BAJO | Nombre familia producto - necesita mapeo |
| **NOPFPR** | nopfpr | NULL | BAJO | Nombre peso factor - necesita mapeo |
| **NOHFPR** | nohfpr | NULL | BAJO | Nombre altura factor - necesita mapeo |

### Campos con Valor Fijo (No de Origen)
| Campo fact_ventas | Valor Actual | Notas |
|-------------------|--------------|-------|
| recaprre | `false` | Valor fijo - no viene del CSV |
| kofulido | `ed.kofudo` | Duplica kofudo - CSV muestra que puede ser diferente |
| nokofudo | `en.nokoen` | Duplica nokoen - CSV muestra que puede ser diferente |

---

## 🔍 ANÁLISIS DE EXTRACCIÓN DESDE SQL SERVER

### Tablas Extraídas Completamente (SELECT *)
1. **MAEEDO** ✅ - Se extraen TODOS los campos disponibles
2. **MAEDDO** ✅ - Se extraen TODOS los campos disponibles

### Tablas Extraídas Parcialmente (SELECT específico)
3. **MAEEN** ⚠️ - Solo extrae: KOEN, NOKOEN, RUEN, ZOEN
   - **Faltantes**: Muchos campos adicionales de entidad
4. **MAEPR** ⚠️ - Solo extrae: KOPR, NOKOPR, UD01PR, UD02PR, TIPR
   - **Faltantes**: FMPR, MRPR, PFPR, HFPR, y otros atributos de producto
5. **TABFU** ⚠️ - Solo extrae: KOFU, NOKOFU
   - **OK**: Parece completo para lo necesario
6. **TABBO** ⚠️ - Solo extrae: EMPRESA, KOBO, NOKOBO
   - **OK**: Parece completo para lo necesario
7. **MAEPR** (TABPP) ⚠️ - Solo extrae: KOPR, PM (como listacost y liscosmod)
   - **Faltantes**: Otros costos y propiedades

---

## 📋 RESUMEN EJECUTIVO

### Total de Campos en CSV: ~77 campos
### Total de Campos en fact_ventas: 81 campos
### Campos con Datos Reales: **48 campos (59%)**
### Campos NULL o Valores Fijos: **33 campos (41%)**

### Razones Principales de Campos NULL:

1. **No se extraen de SQL Server** (30 campos)
   - Principalmente de MAEDDO: CAPRAD, CAPREX, CAPRAD1, CAPREX1, CAPRNC1, CAPRAD2, CAPREX2, CAPRNC2, RLUDPR, NUSEPR, PPPRBR, VABRLI, PPPRPM, PPPRPMIFRS, LOGISTICA, ESLIDO, PPPRNERE1, PPPRNERE2
   - De MAEEDO: NULIDO, SULIDO, LUVTLIDO, PRCT, TICT
   - De MAEPR: FMPR, MRPR, PFPR, HFPR, NOFMPR, NOPFPR, NOHFPR
   - De TABZO: NOKOZO
   - De TABSU: NOSUDO

2. **Datos no disponibles en origen** (2 campos)
   - ZONA: 0% (campo no poblado en SQL Server)
   - RUEN: 0% (campo no poblado en SQL Server)

3. **Valores fijos en código** (1 campo)
   - RECAPRRE: Hardcodeado a `false`

---

## 🎯 RECOMENDACIONES

### Fase 3 Propuesta - Campos de Cantidad y Precio (ALTA PRIORIDAD)
**Objetivo**: Mejorar análisis de rentabilidad y márgenes
```
- CAPRAD, CAPREX (cantidades adicionales/excedentes)
- CAPRAD1, CAPREX1, CAPRNC1 (cantidades UD1 detalladas)
- CAPRAD2, CAPREX2, CAPRNC2 (cantidades UD2 detalladas)
- RLUDPR (relación unidad)
- PPPRBR (precio bruto)
- VABRLI (valor bruto línea)
- PPPRPM, PPPRPMIFRS (precios promedio)
```
**Impacto**: Cálculos de márgenes precisos, análisis de rentabilidad

### Fase 4 Propuesta - Clasificación de Productos (MEDIA PRIORIDAD)
**Objetivo**: Mejorar segmentación y reportes
```
- FMPR, NOFMPR (familia producto)
- MRPR, NOMRPR (marca producto - ya con regex)
- PFPR, HFPR (factores físicos)
```
**Impacto**: Reportes por familia/marca, análisis de categorías

### Fase 5 Propuesta - Liquidación y Logística (MEDIA PRIORIDAD)
**Objetivo**: Control de proceso operativo
```
- NULIDO, SULIDO, LUVTLIDO (datos liquidación)
- LOGISTICA, ESLIDO (control logística)
- KOFULIDO corregir (actualmente duplica kofudo)
```
**Impacto**: Trazabilidad de liquidaciones, control operativo

### Fase 6 Propuesta - Nombres Descriptivos (BAJA PRIORIDAD)
**Objetivo**: Mejorar legibilidad de reportes
```
- NOSUDO (nombre sucursal desde TABSU)
- NOKOZO (nombre zona desde TABZO)
- NOKOFUDO corregir (diferente de nokoen según CSV)
```
**Impacto**: Reportes más legibles sin JOINs adicionales

---

## ⚠️ NOTAS TÉCNICAS IMPORTANTES

1. **SELECT * es Eficiente**: Las tablas MAEEDO y MAEDDO ya usan `SELECT *`, lo que significa que todos esos datos están disponibles en staging, solo falta mapearlos en el INSERT final.

2. **Regex Validation Implementada**: Los campos mixtos (texto/numérico) como NOMRPR, ZONA, RUEN ya tienen validación regex funcionando correctamente.

3. **Performance**: Agregar más campos al INSERT no impacta significativamente el rendimiento ya que los datos ya están en las tablas staging.

4. **Priorización**: Se recomienda implementar por fases según impacto de negocio, no por facilidad técnica.
