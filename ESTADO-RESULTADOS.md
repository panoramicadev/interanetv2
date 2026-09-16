# Estado de Resultados (× Talana)

Módulo de Finanzas que arma el resultado de la empresa —ingresos menos egresos—
leyendo la contabilidad de Softland en vivo. Ruta `/estado-resultados`, permiso
`finanzas.balance` (solo `admin`: el permiso existe para el panel, pero el
cerrojo real es el rol, en la ruta —`client/src/App.tsx`— y en los endpoints
—`server/routes-balance.ts`—).

Va pegado a Remuneraciones en el sidebar porque comparten una pregunta: lo que
Talana paga por sueldos tiene que calzar con lo que la contabilidad cargó.

## Se llamaba "Balance" y era un error de concepto

Un **balance general** es el estado de situación: activo, pasivo y patrimonio en
un momento dado. Un **estado de resultados** es el flujo del período: ingresos
menos egresos. Este módulo hace lo segundo y se llamaba como lo primero.

Qué cambió y qué no:

| | Antes | Ahora |
|---|---|---|
| Nombre y sidebar | Balance | Estado de Resultados |
| Ruta | `/balance` | `/estado-resultados` (la vieja redirige) |
| Archivo de pantalla | `pages/balance.tsx` | `pages/estado-resultados.tsx` |
| Clave del permiso | `finanzas.balance` | **igual** |
| Tablas y rutas del server | `balance_*`, `routes-balance.ts` | **igual** |

Los identificadores internos no se tocan a propósito: de `finanzas.balance`
cuelgan los grants ya otorgados y de las tablas `balance_*` los datos cargados.
Renombrarlos sería un cambio de datos disfrazado de cambio de nombre, y el
primer síntoma sería un 403 o un mes que desapareció.

## Qué se importa

Se traen **solo** las grandes cuentas `41` (ingresos), `51` (egresos de la
operación) y `52` (no operacionales).

Ojo con el motivo, porque cambió. No es que el activo y el pasivo no existan:
el plan 2026 de Softland tiene `11`, `12`, `13` (activo), `21`, `22` (pasivo) y
`31` (patrimonio), 347 cuentas en total. Es que `armarResultado()` arma la
jerarquía con **todas** las cuentas que encuentre y `naturalezaDe()` sólo sabe
distinguir ingreso de egreso: traer el activo hoy lo pintaría como gasto en el
detalle. El corte está en `GRANDES_CUENTAS` (`server/etl-contabilidad.ts`), y
abrir el estado de situación es trabajo de pantalla, no de ETL.

## De dónde salen los datos

| Qué | De dónde | Estado |
|---|---|---|
| Plan de cuentas | **Softland en vivo** (`CGRANCUE` ⋈ `CMAYOR` ⋈ `CCUENTAS`) | Se trae desde la pantalla |
| Saldos del mes | **Softland en vivo** (`CCOMPRD` ⋈ `CCOMPRE`) | Se trae desde la pantalla |
| Plan y saldos, respaldo | Archivo Excel/CSV | Sigue andando, para cuando el ERP no esté |
| Presupuesto | Se carga a mano, solo ingresos | Ver más abajo |
| Costo empresa por persona | `construirCruce()` de `server/routes-remuneraciones.ts` (API de Talana) | En vivo, sin persistir |

`balance_periodos.origen` (`excel` | `erp` | `manual`) dice de dónde salió cada
mes, y la pantalla lo muestra al lado del selector de período: un número traído
del ERP y uno tecleado desde una planilla no valen lo mismo.

## El mapa de la contabilidad en Softland

El ETL de ventas nunca tocó una tabla contable (sólo `MAEEDO`, `MAEDDO`,
`MAEEN`, `MAEPR`, `TABFU`, `TABBO`, `TABRU`, `TABSU`, `FMAEDTE`), así que esto es
territorio nuevo. Todo verificado contra la base `PANORAMICA` (SQL Server 2012):

| Tabla | Qué es | Filas |
|---|---|---|
| `CGRANCUE` | Nivel 1 del plan: la gran cuenta | 129 |
| `CMAYOR` | Nivel 2. **No es el libro mayor** | 403 |
| `CCUENTAS` | Nivel 3: la cuenta imputable | 3.640 |
| `CCOMPRE` | Comprobante, encabezado (`FECHCOM`, `EMPRESA`) | 104.137 |
| `CCOMPRD` | Comprobante, detalle (`DEBE`, `HABER`) | 350.340 |

Cuatro cosas que cuesta caro no saber:

1. **`CMAYOR` no es el libro mayor.** Por el nombre lo parece; es el segundo
   nivel del plan de cuentas. El movimiento está en `CCOMPRD`.
2. **El código de cuenta no existe como columna.** Lo que la intranet llama
   `41010105` son tres columnas: `GRANCUE char(2)` + `MAYOR char(3)` +
   `CUENTA char(3)`. El export que entregó el cliente las concatenaba en crudo.
3. **El plan se versiona por año** (`PERIODO char(4)`): 2026 tiene 347 cuentas,
   2014 tenía 193. Todo join lleva `PERIODO`, y el del movimiento va contra el
   `PERIODO` del comprobante — un asiento de 2024 se lee con el plan de 2024.
   Verificado: `PERIODO` y `YEAR(FECHCOM)` no discrepan en ninguna de las 104.137
   filas.
4. **`ESTACOM` no sirve de filtro.** Vale `NOCON` en el 100% de los comprobantes,
   así que no hay forma de separar borradores de contabilizados. No se filtra.
5. **Las fechas van sin guiones.** `CONVERT(datetime, '2026-08-01', 23)` **falla**
   en este servidor (`us_english`, error 241). Hay que usar `'20260801'` con
   estilo 112. Y `FORMAT()` tampoco existe: corre con *lightweight pooling* y
   toda función CLR revienta.

Dos cosas más que aparecieron y no se usan, para no volver a buscarlas:

- **`CPRESUP` está vacía.** El presupuesto no vive en el ERP; sigue cargándose a
  mano.
- **Los centros de costo no sirven para el cruce con Talana.** `CCOMPRC` reparte
  por `CODCC`, pero de las cinco cuentas de remuneración con movimiento en agosto
  2026, sólo una tiene distribución. El puente por área sigue siendo a mano.

## Lo que viene torcido (y no era culpa del Excel)

**1. 42 de 177 códigos están mal guardados, en el ERP.** Softland no rellena los
niveles a su largo: en el plan 2026, el mayor de GASTOS DE OPERACION está como
`'20 '` —dos caracteres y un espacio— en vez de `'020'`, y hay cinco cuentas
iguales (`'10 '`, `'65 '`, `'01 '`, `'40 '`). Concatenado sale `"5120 106"`
cuando la cuenta real es `51020106`.

Esto se creyó un defecto del export en Excel. No lo es: está así en la base. La
diferencia importa, porque significa que el ETL tiene que normalizar igual que el
importador de archivos, y no podía asumir datos limpios por venir del ERP.

Hay dos normalizadores, uno por camino, y no se pueden fusionar:

- `normalizarCodigo` (`server/balance-plan.ts`) recibe el código **ya
  concatenado** desde una planilla, así que tiene que adivinar dónde cortaba el
  prefijo y toma el sufijo de los últimos tres caracteres.
- `codigoDesdeErp` (`server/etl-contabilidad.ts`) recibe los **tres niveles por
  separado** y rellena cada uno con ceros a la izquierda. No adivina nada.

Se guardan las dos formas: `codigo` (normalizado, con el que se indexa y compara)
y `codigo_erp` (crudo). La cruda hace falta porque es la que va a llegar en el
archivo de saldos, y `parsearSaldos` resuelve por cualquiera de las dos.

**2. 18 nombres truncados a 25 caracteres** (`REMUNERACIONES ADMINISTRA`,
`DEPREC. ACTIVOS EN LEASIN`, `COMISION RIPLEY - FALABEL`). Por eso existe
`nombre_largo`, editable desde la pestaña Cuentas: el ERP manda en el código,
nosotros en cómo se lee. Un re-import **no pisa** `nombre_largo` ni `activa`.

**3. Hay 5 nombres repetidos con códigos distintos**, no uno. Con el plan
completo del ERP aparecen `REMUNERACIONES ADMINISTRA` (`51030105` y `51030106`),
`REMUNERACIONES DE OPERACI` (`51020105` y `51020106`), `REMUNERACIONES VENTAS`
(`51030340` y `51030341`), `INDEMNIZACIONES VENTAS` (`51030429` y `51030431`) y
`CORRECCION MONETARIA` (`41020110` y `52030105`, que además son de signo
contrario). Se importan todas —el código manda— y salen marcadas.

En cada par, la que tiene movimiento es la de código más alto; la otra quedó
muerta. Pero **las dos están en el plan**, y de eso se ocupa el punto siguiente.

**4. El mayor `030` mezcla administración y ventas** ("GASTOS DE ADMIN. Y
VENTAS"). El corte admin/ventas no se puede hacer por mayor, solo cuenta por
cuenta. Es la razón de fondo por la que el cruce con Talana necesita agrupar
cuentas a mano.

## El puente con Talana: `balance_puente_personal`

**No se cruza cuenta a cuenta.** El `costoEmpresa` de Talana viene todo junto por
persona; la contabilidad lo reparte entre remuneración, indemnización y leyes
sociales. Lo que sí calza es el **área**, que es el mismo corte con el que Talana
asigna el centro de costo de cada contrato.

| Área | Cuentas |
|---|---|
| `administracion` | `51030106`, `51030451`, `51030454` |
| `ventas` | `51030341`, `51030429`, `51030431` |
| `operacion` | `51020106`, `51020121`, `51020122` |
| `store_concepcion` | `51030342` |
| `socios` | `51030240`, `51030245` |

Una sola tabla con `tipo` (`cuenta` | `centro_costo`) en vez de dos, porque los
dos lados responden la misma pregunta —qué pertenece al área— y así el mapeo sale
de una consulta. El índice único es por `(tipo, valor)`: un centro de costo
pertenece a **un** área, si no su costo se contaría dos veces.

Las cuentas se siembran al importar el plan (`CONCEPTOS_PERSONAL`). Los centros
de costo **no**: nadie sabe todavía cómo se llaman en Talana, así que se mapean
desde la pantalla y hasta entonces salen listados con su monto. Un área sin
centros mapeados **no cuadra**: no se está comparando, y `comparable: false` lo
distingue de una diferencia de cero.

### El puente quedó corto y ahora se nota

`CONCEPTOS_PERSONAL` se armó con las 77 cuentas del export viejo y mapea 9. El
plan completo del ERP tiene **30 cuentas de personal**: las cuatro de LEYES
SOCIALES (`51020115`, `51030115`, `51030305`, `51030345`), las sucursales que ya
no operan (Puerto Montt, Valdivia, Santiago, Los Ángeles) y el gemelo muerto de
cada par duplicado.

Hoy todas están en cero, así que el cruce de agosto 2026 cuadra. El riesgo es el
día que alguien impute a una: el costo contable se compararía **de menos** contra
Talana y nada lo delataría.

No se adivina el mapeo —a qué área pertenece cada una es una decisión del
cliente—. En cambio `armarPersonal()` devuelve `cuentasSinMapear`: cuentas que
`PARECE_DE_PERSONAL` reconoce por el nombre, tienen movimiento en el mes y no
están en ningún área. Es el espejo exacto de `centrosSinMapear`, y se asignan
desde la misma pantalla. Lo que no se está comparando se ve.

Umbral de descuadre: `$1.000`, el mismo de Remuneraciones.

## El signo de los montos

`montoDeFila` (`server/balance-plan.ts`) es el **único** lugar que decide cuánto
pesa una cuenta:

- Con `debe` y `haber`, la cuenta es inequívoca: ingreso → `haber − debe`;
  egreso → `debe − haber`.
- Con solo `saldo`, hay que asumir la convención contable (el haber va negativo,
  así que un ingreso llega en negativo). **Pendiente de confirmar contra un
  export real de Softland.**

## Tablas (migración 086)

| Tabla | Para qué |
|---|---|
| `cuentas_contables` | El plan. `codigo` (PK, normalizado) + `codigo_erp` (único, crudo) |
| `balance_periodos` | Un mes: `periodo` (`YYYY-MM`, PK), `estado`, `origen` |
| `balance_saldos` | `debe`, `haber`, `saldo` por `(periodo, cuenta_codigo)` |
| `balance_presupuesto` | Meta por `(periodo, cuenta_codigo)` |
| `balance_puente_personal` | `concepto` + `tipo` + `valor` |

DDL **triplicado** (migración SQL, Drizzle y `ensureBalanceTables()` llamada
desde `server/index.ts`), como el resto del repo: el runner corta al primer fallo
y en producción puede no llegar a correr.

Cargar un mes **reemplaza sus saldos completos**: una carga parcial dejaría
cuentas del archivo anterior mezcladas con las del nuevo y el resultado no
cuadraría. Un período `cerrado` se rechaza con 409 hasta que se reabra.

## Pantallas

1. **Resultado** — las líneas del EERR (ingresos, costo de ventas, margen bruto,
   gastos, resultado operacional, no operacionales, resultado) contra el mes
   anterior y el acumulado del año; debajo, el detalle plegable gran cuenta →
   mayor → cuenta. En celular la tabla se reemplaza por tarjetas: son 5 columnas.

   Un mes que no está cargado **no se muestra como `$0`**: la columna dice "sin
   cargar" y la variación queda en `—`. Y mientras falten meses del año, el
   acumulado dice cuántos cubre ("1 de 7 meses") en vez de prometer un año
   entero. Con el ETL limitado a julio ése es el estado normal, no la excepción,
   y un cero ahí se leería como "junio no vendió nada".
2. **Presupuesto** — solo ingresos, y la pantalla dice por qué.
3. **Personal** — el cruce por área, los centros de costo sin asignar y las
   cuentas de personal con movimiento que nadie asignó.
4. **Cuentas** — el plan, con el nombre largo editable y los duplicados marcados.

## Presupuesto: por qué solo ingresos

`info-extra/PRESUPUESTO 2026.csv` es 100% presupuesto de **ventas**, por unidad
de negocio y vendedor (MCT, Panorámica Store, Construcción, Canales Digitales,
Ferreterías, Fabricación Modular). No trae una sola línea de gastos y no está
expresado en cuentas contables.

Los gastos quedan sin meta y se dice en pantalla, en vez de mostrar una columna
vacía que se leería como incumplimiento. `balance_presupuesto` igual es por
cuenta para que un presupuesto de gastos entre sin rehacer el modelo.

## Por qué `balance-plan.ts` está separado

El parseo no toca la base ni Express. Está aparte para poder probar la
normalización del código de cuenta sin levantar el servidor — y sirvió: la prueba
cazó que `XLSX` se comía los ceros de `CMAYOR`, cosa que leyendo el código no se
veía.

## Cómo se verificó

Con la app levantada contra un Postgres local y el SQL Server **real** de
producción (sólo lectura del lado del ERP):

| Qué | Resultado |
|---|---|
| Plan 2026 | 177 cuentas, 42 con el código corregido, 5 nombres duplicados |
| Plan 2025 | 167 cuentas |
| Agosto 2026 | 58 cuentas con movimiento, 388 líneas, 0 huérfanas, 0 comprobantes descuadrados |
| Julio 2026 | 60 cuentas, 434 líneas, 0 huérfanas |
| `51020106` | guardada con `codigo_erp = "5120 106"` al lado |
| Rechazos | `anio: "pepe"` → 400; plan 1999 → 404; mes 2013-05 → 404; mes fuera del límite → 409 |
| Mes vacío | Pedir un mes sin movimiento **no borra** los saldos que ya estaban |

El número que importa: el resultado de agosto 2026 que arma la intranet
—**$937.718**— sale idéntico a sumar `CCOMPRD` directo en el ERP
(ingresos 300.918.759 − egresos 299.210.154 − no operacionales 770.887).

## Pendiente

- **Preguntas al cliente:**
  1. En cada par duplicado (`51030105`/`51030106`, `51020105`/`51020106`,
     `51030340`/`51030341`, `51030429`/`51030431`), ¿la de código bajo está
     muerta o se sigue usando en algún caso?
  2. Las cuatro cuentas de LEYES SOCIALES están en cero. ¿Se dejaron de usar, o
     hay que mapearlas al área que corresponde antes de que aparezcan?
  3. ¿Quieren el estado de situación (activo, pasivo, patrimonio)? Los datos
     están; falta la pantalla.
- **Automatizar la traída.** Hoy alguien aprieta un botón. El scheduler del ETL
  de ventas (`server/index.ts`, 10:00 / 14:00 / 18:00) es el lugar natural, pero
  un mes `cerrado` no se puede pisar solo: primero hay que decidir qué pasa
  cuando el ERP corrige un mes ya cerrado.

## Archivos

| Archivo | Qué |
|---|---|
| `server/etl-contabilidad.ts` | **El ETL desde Softland**: mapa de tablas, `codigoDesdeErp`, las tres funciones |
| `server/balance-plan.ts` | Parseo y normalización del archivo. Sin `db` ni Express |
| `server/routes-balance.ts` | 16 endpoints + `ensureBalanceTables()` |
| `client/src/pages/estado-resultados.tsx` | Las cuatro pestañas |
| `migrations/086_balance.sql` | DDL |
| `shared/schema.ts` | Tablas Drizzle + schemas Zod (al final del archivo) |

PR #421 (el módulo) y la rama `trabajo/2026-09-15-contabilidad-erp` (el ETL).
