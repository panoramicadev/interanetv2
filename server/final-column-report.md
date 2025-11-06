# Reporte Completo de Columnas del CSV de Ventas

## Resumen Ejecutivo
**Total de columnas en CSV:** 79  
**Columnas encontradas en SQL Server:** 62 (78.5%)  
**Columnas NO encontradas:** 17 (21.5%)

---

## 📊 TABLAS PRINCIPALES IDENTIFICADAS

### Top 3 Tablas con más columnas del CSV:

1. **MAEDDO** (Detalle de Documentos) → **40 columnas**
2. **MAEEDO** (Encabezado de Documentos) → **17 columnas** 
3. **MAEPR** (Maestro de Productos) → **Necesaria para JOINs**

---

## ✅ COLUMNAS ENCONTRADAS (62)

### De MAEEDO (Encabezado - 17 columnas):
```
IDMAEEDO, TIDO, NUDO, ENDO, SUENDO, SUDO, FEEMDO, FEULVEDO,
KOFUDO, MODO, TIMODO, TAMODO, CAPRAD, CAPREX, VANEDO, VAIVDO, VABRDO
```

### De MAEDDO (Detalle - 40 columnas):
```
IDMAEDDO, LILG, NULIDO, SULIDO, LUVTLIDO, BOSULIDO, KOFULIDO,
PRCT, TICT, TIPR, NUSEPR, KOPRCT, UDTRPR, RLUDPR,
CAPRCO1, CAPRAD1, CAPREX1, CAPRNC1, UD01PR,
CAPRCO2, CAPRAD2, CAPREX2, CAPRNC2, UD02PR,
PPPRNE, PPPRBR, VANELI, VABRLI, FEEMLI, FEERLI,
PPPRPM, PPPRPMIFRS, ESLIDO, PPPRNERE1, PPPRNERE2
```

### De MAEPR (Productos - códigos para JOIN):
```
FMPR, MRPR, PFPR, HFPR, RUEN (existe como RUPR en MAEPR)
```

### Otros:
```
RECAPRRE, OCDO (encontradas en otras tablas)
```

---

## ❌ COLUMNAS NO ENCONTRADAS (17)

### 1. Columnas con equivalente en SQL Server:

| CSV Column | SQL Server Equivalent | Tabla | Notas |
|------------|----------------------|-------|-------|
| **ZONA** | ZONAPR | MAEPR | Código de zona del producto |
| **NOKOPRCT** | NOKOPR | MAEPR | Nombre del producto |
| **NOKOEN** | NOKOEN | MAEEN | Nombre del cliente |
| **NOKOFU** | NOKOFU | TABFU | Nombre del funcionario (vendedor) |
| **NOKOFUDO** | NOKOFU | TABFU | Nombre del funcionario de línea |
| **NOSUDO** | NOKOSU | TABSU | Nombre de la sucursal |
| **NOBOSULI** | NOKOBO | TABBO | Nombre de la bodega |
| **NOKOZO** | NOKOZO | TABZO | Nombre de la zona |
| **NORUEN** | NOKORU | TABRU | Nombre de la ruta/segmento |
| **NOMRPR** | NOKOMR | TABMR | Nombre de la marca |
| **NOFMPR** | NOKOFM | TABFM | Nombre de la familia |
| **NOPFPR** | NOKOPF | TABPF | Nombre de la sub-familia |
| **NOHFPR** | NOKOHF | TABHF | Nombre de la marca comercial |

### 2. Columnas sin equivalente directo (posiblemente calculadas):

| CSV Column | Tipo | Descripción Probable |
|------------|------|---------------------|
| **LOGISTICA** | Calculado | Campo de logística (no estándar en tablas base) |
| **MONTO** | Calculado | Monto calculado o campo personalizado |
| **DEVOL1** | Calculado | Devoluciones unidad 1 |
| **DEVOL2** | Calculado | Devoluciones unidad 2 |
| **STOCKFIS** | Calculado | Stock físico (podría venir de MAEST o calculado) |
| **LISTACOST** | Calculado | Lista de costo |
| **LISCOSMOD** | Calculado | Lista de costo modificada |

---

## 🔧 QUERY SQL COMPLETA SUGERIDA

```sql
SELECT 
  -- ENCABEZADO (MAEEDO)
  e.IDMAEEDO,
  e.TIDO,
  e.NUDO,
  e.ENDO,
  e.SUENDO,
  e.SUDO,
  e.FEEMDO,
  e.FEULVEDO,
  e.KOFUDO,
  e.MODO,
  e.TIMODO,
  e.TAMODO,
  e.CAPRAD,
  e.CAPREX,
  e.VANEDO,
  e.VAIVDO,
  e.VABRDO,
  
  -- DETALLE (MAEDDO)
  d.IDMAEDDO,
  d.LILG,
  d.NULIDO,
  d.SULIDO,
  d.LUVTLIDO,
  d.BOSULIDO,
  d.KOFULIDO,
  d.PRCT,
  d.TICT,
  d.TIPR,
  d.NUSEPR,
  d.KOPRCT,
  d.UDTRPR,
  d.RLUDPR,
  d.CAPRCO1,
  d.CAPRAD1,
  d.CAPREX1,
  d.CAPRNC1,
  d.UD01PR,
  d.CAPRCO2,
  d.CAPRAD2,
  d.CAPREX2,
  d.CAPRNC2,
  d.UD02PR,
  d.PPPRNE,
  d.PPPRBR,
  d.VANELI,
  d.VABRLI,
  d.FEEMLI,
  d.FEERLI,
  d.PPPRPM,
  d.PPPRPMIFRS,
  d.ESLIDO,
  d.PPPRNERE1,
  d.PPPRNERE2,
  
  -- CLASIFICACIÓN DE PRODUCTO (MAEPR)
  pr.FMPR,
  pr.MRPR,
  pr.PFPR,
  pr.HFPR,
  pr.RUPR as RUEN,
  pr.ZONAPR as ZONA,
  
  -- CAMPO ADICIONAL
  d.RECAPRRE,
  -- d.OCDO, -- verificar si existe
  
  -- NOMBRES DESCRIPTIVOS (JOINS)
  pr.NOKOPR as NOKOPRCT,          -- Nombre producto
  cl.NOKOEN,                       -- Nombre cliente
  ru.NOKORU as NORUEN,             -- Nombre ruta/segmento
  fu.NOKOFU,                       -- Nombre funcionario encabezado
  fu2.NOKOFU as NOKOFUDO,          -- Nombre funcionario línea
  su.NOKOSU as NOSUDO,             -- Nombre sucursal
  bo.NOKOBO as NOBOSULI,           -- Nombre bodega línea
  zo.NOKOZO,                       -- Nombre zona
  mr.NOKOMR as NOMRPR,             -- Nombre marca
  fm.NOKOFM as NOFMPR,             -- Nombre familia
  pf.NOKOPF as NOPFPR,             -- Nombre sub-familia
  hf.NOKOHF as NOHFPR,             -- Nombre marca comercial
  
  -- CAMPOS CALCULADOS O PERSONALIZADOS
  '' as LOGISTICA,                 -- Campo personalizado
  0 as MONTO,                      -- Calculado
  0 as DEVOL1,                     -- Calculado
  0 as DEVOL2,                     -- Calculado
  0 as STOCKFIS,                   -- Calculado o de MAEST
  '' as LISTACOST,                 -- Personalizado
  0 as LISCOSMOD                   -- Personalizado

FROM MAEEDO e
INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
LEFT JOIN MAEPR pr ON d.KOPRCT = pr.KOPR
LEFT JOIN MAEEN cl ON e.ENDO = cl.KOEN
LEFT JOIN TABRU ru ON pr.RUPR = ru.KORU
LEFT JOIN TABFU fu ON e.KOFUDO = fu.KOFU
LEFT JOIN TABFU fu2 ON d.KOFULIDO = fu2.KOFU
LEFT JOIN TABSU su ON e.SUDO = su.KOSU
LEFT JOIN TABBO bo ON d.BOSULIDO = bo.KOBO
LEFT JOIN TABZO zo ON pr.ZONAPR = zo.KOZO
LEFT JOIN TABMR mr ON pr.MRPR = mr.KOMR
LEFT JOIN TABFM fm ON pr.FMPR = fm.KOFM
LEFT JOIN TABPF pf ON pr.PFPR = pf.KOPF
LEFT JOIN TABHF hf ON pr.HFPR = hf.KOHF

WHERE e.FEEMDO >= '2025-01-01'  -- Filtro de fecha ejemplo
ORDER BY e.IDMAEEDO, d.LILG
```

---

## 📝 NOTAS IMPORTANTES

1. **Campos NO ENCONTRADOS que son NOMBRES** requieren JOINs con tablas maestras (TABXX)
2. **Campos CALCULADOS** (DEVOL1, DEVOL2, MONTO, etc.) probablemente son generados en el proceso de extracción del CSV
3. **LOGISTICA, LISTACOST, LISCOSMOD** parecen ser campos personalizados que no están en el modelo estándar
4. La tabla **MAEEN** almacena clientes/entidades
5. La tabla **MAEPR** es fundamental para obtener clasificaciones y nombres de productos
6. Las tablas **TABxx** son tablas maestras de parámetros del sistema

---

## 🎯 RECOMENDACIONES

1. Para replicar exactamente el CSV, usar la query completa con todos los JOINs
2. Los campos calculados pueden requerir lógica adicional (devoluciones, stock, etc.)
3. Validar si campos como LOGISTICA, MONTO vienen de vistas o procedimientos almacenados
4. Considerar crear una vista en SQL Server que replique la estructura del CSV para facilitar futuras extracciones

---

**Generado:** 2025-01-06
