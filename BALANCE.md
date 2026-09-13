# Balance (estado de resultados × Talana)

Módulo de Finanzas que arma el resultado de la empresa a partir del plan de
cuentas de Softland. Ruta `/balance`, permiso `finanzas.balance` (solo `admin`:
el permiso existe para el panel, pero el cerrojo real es el rol, en la ruta
—`client/src/App.tsx`— y en los endpoints —`server/routes-balance.ts`—).

Va pegado a Remuneraciones en el sidebar porque comparten una pregunta: lo que
Talana paga por sueldos tiene que calzar con lo que la contabilidad cargó.

## ⚠️ Es un estado de resultados, no un balance general

El plan que entregó el cliente trae **solo** las grandes cuentas `41` (ingresos),
`51` (egresos de la operación) y `52` (no operacionales). No hay activo, pasivo
ni patrimonio, así que no existe el estado de situación. La pantalla lo dice
arriba a propósito: el nombre del módulo promete otra cosa.

Si algún día llegan las cuentas 1/2/3, entran por el mismo importador
(`naturalezaDe` es lo único que habría que extender).

## De dónde salen los datos

| Qué | De dónde | Estado |
|---|---|---|
| Plan de cuentas | Archivo de Softland (`CGRANCUE, NOGRANCUE, CMAYOR, NOMAYOR, CUENTA, NOCUENTA`) | Se importa desde la pantalla |
| Saldos del mes | Archivo Excel/CSV | **Pendiente de definir con el cliente** |
| Presupuesto | Se carga a mano, solo ingresos | Ver más abajo |
| Costo empresa por persona | `construirCruce()` de `server/routes-remuneraciones.ts` (API de Talana) | En vivo, sin persistir |

El ETL de Softland **no toca ninguna tabla contable** (solo `MAEEDO`, `MAEDDO`,
`MAEEN`, `MAEPR`, `TABFU`, `TABBO`, `TABRU`, `TABSU`, `FMAEDTE`). Si más adelante
se conectan las tablas contables, `server/etl-contabilidad.ts` escribiría en las
mismas tablas siguiendo `server/etl-clients.ts`, y
`balance_periodos.origen` (`excel` | `erp` | `manual`) distingue los meses viejos
de los nuevos sin tocar el modelo.

## Lo que el archivo del cliente trae torcido

Verificado sobre las 77 filas reales. Todo esto se corrige al importar:

**1. 20 de 77 códigos vienen mal formados.** Softland no rellena el mayor a tres
dígitos —`CMAYOR = "20"` en vez de `"020"`— y deja el hueco como un **espacio**
dentro del código: `"5120 106"` cuando la cuenta real es `51020106`. Es todo el
mayor de GASTOS DE OPERACION, incluida `REMUNERACIONES DE OPERACI`, que es una de
las del cruce con Talana.

Además, la hoja de cálculo lee las columnas como números y se come el cero de
`"010"`. Por eso `normalizarCodigo` (`server/balance-plan.ts`) **reconstruye** el
código en vez de leerlo: rellena el mayor siempre y toma el sufijo de los últimos
tres caracteres, en lugar de descontarle el prefijo —que es justamente lo que
llega mal escrito—.

Se guardan las dos formas: `codigo` (normalizado, con el que se indexa y compara)
y `codigo_erp` (crudo). La cruda hace falta porque es la que va a llegar en el
archivo de saldos, y `parsearSaldos` resuelve por cualquiera de las dos.

**2. 18 nombres truncados a 25 caracteres** (`REMUNERACIONES ADMINISTRA`,
`DEPREC. ACTIVOS EN LEASIN`, `COMISION RIPLEY - FALABEL`). Por eso existe
`nombre_largo`, editable desde la pestaña Cuentas: el ERP manda en el código,
nosotros en cómo se lee. Un re-import **no pisa** `nombre_largo` ni `activa`.

**3. `INDEMNIZACIONES VENTAS` está dos veces** (`51030429` y `51030431`). Se
importan las dos —el código manda— y salen marcadas como posible duplicado.

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
2. **Presupuesto** — solo ingresos, y la pantalla dice por qué.
3. **Personal** — el cruce por área, más los centros de costo sin asignar.
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

## Pendiente

- **Probar con la app levantada.** La verificación fue contra un Postgres creado
  al vuelo: 77 cuentas importadas, `"5120 106"` guardado como `51020106` con el
  crudo al lado, saldos con códigos del ERP calzando y la aritmética cuadrando.
  No hay `.env` en el repo local.
- **Preguntas al cliente:**
  1. ¿De dónde salen los saldos: export de Softland, acceso a las tablas
     contables, o carga manual?
  2. `51030429` vs `51030431`, ambas "INDEMNIZACIONES VENTAS": ¿en qué se
     diferencian?
  3. ¿Existen las cuentas de balance (1/2/3) o solo trabajan el resultado?

## Archivos

| Archivo | Qué |
|---|---|
| `server/balance-plan.ts` | Parseo y normalización. Sin `db` ni Express |
| `server/routes-balance.ts` | 13 endpoints + `ensureBalanceTables()` |
| `client/src/pages/balance.tsx` | Las cuatro pestañas |
| `migrations/086_balance.sql` | DDL |
| `shared/schema.ts` | Tablas Drizzle + schemas Zod (al final del archivo) |

PR #421.
