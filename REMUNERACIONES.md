# Remuneraciones (Talana × intranet)

Módulo de RR.HH. que cruza lo que **Talana** va a pagar con lo que la **intranet**
calculó. Ruta `/remuneraciones`, permiso `rrhh.remuneraciones` (por defecto solo
`admin`; a cualquier otra persona se le entrega a mano desde el panel de
permisos).

La pregunta que responde es una sola: *antes de cerrar el mes, ¿la liquidación de
cada persona coincide con la comisión y los reembolsos que se calcularon acá?*

## Qué cruza

| De Talana | De la intranet |
|---|---|
| Contratos: cargo, centro de costo, sucursal, sueldo base | Usuario (`users`) de cada persona |
| Días trabajados del mes vigente | Comisión calculada sobre margen (`server/commissions.ts`) |
| Liquidaciones: días, haberes, descuentos, líquido, costo empresa, anticipos, atrasos | Reembolsos de gastos ya aprobados (`gastos_empresariales`) |
| Comisión pagada (ítems `Comision1` + `Comision2`) | Nombre del vendedor en el ERP (`ventas.fact_ventas.nokofu`) |

## El puente: `talana_vinculos`

Las tres fuentes identifican a la misma persona de tres formas distintas —RUT en
Talana, `users.id` en la intranet, nombre del vendedor en el ERP— y ninguna tabla
las tenía juntas. `talana_vinculos` guarda esa correspondencia.

- El sistema **propone** el calce por nombre (todas las palabras del nombre más
  corto tienen que estar en el más largo, con al menos dos coincidencias). Eso
  aparece como vínculo *Automático*. La propuesta la calcula **una sola
  función** (`proponerVinculo`) que usan el cruce y la pestaña de vínculos: con
  una copia por lado, la planilla decía "Automático" donde la otra pantalla
  mostraba "Sin asignar".
- Guardarlo desde la pestaña **Vínculos** lo deja *Confirmado*.
- *Ignorado* es para quien no corresponde cruzar: deja de generar alertas sin
  borrar el dato.

La tabla se crea en runtime (`CREATE TABLE IF NOT EXISTS`) y también en el
arranque (`ensureRemuneracionesTables()` en `server/index.ts`), porque el runner
de migraciones no es confiable en producción.

## Pantallas

1. **Planilla del período** — una fila por persona. Las columnas las elige cada
   usuario (ver más abajo); el set por defecto trae días, sueldo base, haberes,
   descuentos, costo empresa, las dos comisiones, la diferencia y los
   reembolsos. En celular es una lista de tarjetas: la tabla no entra.
2. **Descuadres** — solo lo que no calza, agrupado por tipo, con acceso directo a
   arreglar el vínculo cuando esa es la causa.
3. **Vínculos** — asignar/confirmar la persona de la intranet y el vendedor del
   ERP. Lista a **todas** las personas que Talana liquida, no solo las que
   devuelve `/contracts`: son 56 contratos contra 64 liquidaciones, y los 8 de
   diferencia incluían vendedores con comisión que no se podían vincular.
   Abre filtrada en **Pendientes de confirmar** (lo que no cruzó más lo que el
   sistema propuso y nadie revisó): con 64 personas liquidadas, las tres que hay
   que tocar se perdían en la lista completa.

Además: selector de período (los meses que informa Talana, con su estado
abierto/cerrado), filtro **por vendedor** del ERP, botón **Actualizar** (vacía el
caché de la API) y **Exportar CSV**.

## El costo empresa manda sobre el líquido

Acordado con Paolo el **16-sep-2026**: la cifra del mes es lo que la gente le
cuesta a la empresa, no lo que se transfiere. Por eso el indicador de arriba
dice *Costo empresa* con el líquido como línea de apoyo, y en la planilla las
dos van en **una sola celda**: costo empresa en negrita y `Líquido $…` debajo.

El líquido no se sacó —se sigue cuadrando contra el banco—: existe además como
columna propia, apagada por defecto, para cuando se quiere mirar solo eso.

Ojo con el caso del finiquito: Talana **no** emite `CostoEmpresa` en la
liquidación de finiquito, así que en un mes con finiquito la indemnización no
está sumada en esa columna (sí en el líquido). Es la misma advertencia que ya
estaba en el tooltip, y ahora pesa más porque el costo empresa es el número
principal.

## Columnas: cada usuario elige las suyas

La planilla mostraba trece columnas fijas. Una liquidación de Talana trae del
orden de **200 ítems** (gratificación, movilización, colación, AFP, salud,
seguro de cesantía, cada haber y cada descuento con su glosa) y ninguno estaba
disponible sin tocar código.

Ahora el cruce devuelve, por persona, **todos** los ítems de la liquidación
(`FilaCruce.itemsTalana`, `tipoItem → monto`) y, aparte, el catálogo de lo que
ese mes informó Talana (`columnasTalana`): id, glosa, en cuántas personas viene
con valor, y si es plata o días. Ese último dato no es cosmético:
`diasTrabajadosItem` es 21, no $21.

El botón **Columnas** de la planilla abre las dos listas —las propias del módulo
y los ítems de Talana, con buscador— y lo elegido se guarda **por usuario** en
`remuneraciones_columnas`. Es por usuario y no por rol a propósito: la misma
planilla la mira RR.HH. para cuadrar sueldos y gerencia para mirar costo
empresa, y no necesitan las mismas columnas.

- `columnas: null` (sin fila) = *nunca eligió* → abre con el set por defecto.
- `columnas: []` = eligió dejar solo la persona. Por eso el botón "volver a las
  columnas por defecto" **borra la fila** en vez de guardar un arreglo vacío.
- El catálogo depende del período: un mes sin liquidaciones cargadas no ofrece
  ítems, y la pantalla lo dice en vez de mostrar una lista vacía.
- El CSV sigue trayendo siempre las columnas del cierre de mes; los ítems de
  Talana que la persona sumó a la planilla se agregan al final
  (`export.csv?items=Gratificacion,Colacion`).

La tabla se crea en `ensureRemuneracionesTables()` como las otras dos: el runner
de migraciones no es confiable en producción.

## Filtrar por vendedor

El selector al lado del buscador deja la planilla en un solo vendedor del ERP,
más dos opciones que no son un vendedor: *Todos* y *Sin vendedor asignado* —esta
última es la lista de quién no tiene puente hacia la comisión, que es justo lo
que se va a arreglar a Vínculos—. La lista sale de los vendedores **presentes en
el período**, no del catálogo completo: elegir a alguien que no tiene a nadie
liquidado ese mes daría una tabla vacía sin explicar por qué.

El filtro es de la vista: el CSV exporta el período completo.

## Alertas

Los grupos se muestran **por gravedad**: primero lo que mueve plata (comisiones)
y al final las personas sin vincular, que en un mes recién configurado son
decenas y tapaban el resto. Cada grupo pliega a partir de 6 ítems.

| Tipo | Cuándo se levanta |
|---|---|
| `comision_descuadrada` | La diferencia entre lo calculado y lo pagado supera $1.000 (el umbral existe porque la intranet calcula con decimales y Talana redondea al peso). |
| `comision_no_pagada` | La intranet calculó comisión y la liquidación no la trae. |
| `comision_sin_respaldo` | Talana paga comisión y la persona no está vinculada a un vendedor del ERP. |
| `sin_vinculo` | Persona de Talana que no se pudo calzar con nadie. |
| `vendedor_sin_liquidacion` | Vendedor con comisión calculada y sin liquidación en el período. |
| `sin_liquidacion` | Contrato vigente sin liquidación en un mes ya cerrado. |

### Los "vendedores" que no son personas

`fact_ventas.nokofu` no guarda solo vendedores: también mostradores y canales.
De los 32 nombres que facturaron en 2026, **13 son canales** (MCT Puerto Montt,
Osorno, Concepción, Los Ángeles, Temuco, Castro y Villarrica; Mercado Libre,
Falabella y Ripley Marketplace; Venta Tienda Online, WhatsApp Venta y Cliente
Fábrica). Uno de ellos —**MCT TEMUCO**— tiene 7% de comisión configurado sobre
$241M vendidos, así que levanta `vendedor_sin_liquidacion` todos los meses.

Esa alerta no se puede resolver: no hay liquidación que buscarle porque no hay
a quién pagarle sueldo. Por eso el botón del ojo tachado en cada alerta de ese
grupo la manda a `talana_vendedores_ignorados`, y el pie de la pestaña deja
verlas y devolverlas. Va en tabla aparte de `talana_vinculos` porque el
`ignorado` de esa tabla se guarda por `talanaEmpleadoId`, y lo que define a un
canal es justamente no tener uno.

### El nombre del vendedor viene cortado

`fact_ventas.nokofu` es `varchar(30)`. Hay 6 vendedores cortados; el que importa
es `PATRICIO HERNAN GHISELLINI KRO`, que en la intranet es
`PATRICIO HERNAN GHISELLINI KROLL`. Sin tratar el corte no calzaba con nadie, su
comisión de la intranet se leía como 0 y el módulo inventaba un descuadre por el
monto completo. `calzaNombre()` acepta la última palabra como prefijo **solo**
cuando el nombre viene cortado a 30, y `mismoVendedor()` hace lo mismo con el
calce exacto que busca la comisión.

### "No calculado" no es "calculó cero"

`getCommissionSummary()` multiplica el margen por el % de `commission_settings`.
Si el vendedor no tiene fila ahí, o la tiene en 0, devuelve `commissionAmount: 0`
**sin haber calculado nada**. Leer ese 0 como "la intranet calculó cero" convierte
cada vendedor sin configurar en un descuadre por el monto completo.

Medido contra Talana (julio 2026): de las **8 personas que cobran comisión**, solo
3 tienen % configurado. Las otras 5 salían como descuadre por ~$1.97M:

| Persona | Comisión Talana | Qué pasa de verdad |
|---|---|---|
| Israel Sanhueza | $2.853.203 | 7% configurado — comparación válida |
| Pablo Soto | $1.373.222 | 6% configurado — comparación válida |
| Héctor Urizar | $882.735 | 7% configurado — comparación válida |
| Mauricio Chaparro | $917.832 | calza como vendedor, **0%** configurado |
| Fabián Zenteno | $490.986 | calza como vendedor, **sin fila** en commission_settings |
| Omar Arámbula | $265.996 | calza como vendedor, **0%** configurado |
| David Aranzáez | $142.268 | no calza con ningún vendedor del ERP |
| Pierre Bravo | $155.640 | no calza con ningún vendedor del ERP |

Por eso `comisionIntranet` es `null` (y la celda muestra un guion con la
explicación al pasar el mouse) cuando no hay con qué calcular, y la alerta se
parte en dos, porque se arreglan en lugares distintos:
`comision_sin_porcentaje` manda a **Comisiones** y `comision_sin_respaldo` a
**Vínculos**.

### Sueldo y finiquito

Verificado contra la API (julio 2026, empleado 3047453): el finiquito trae 12
ítems —`IndemnizacionAnosServicios`, `IndemnizacionMesdeAviso`,
`IndemnizacionVacaciones`, `montoTransfer`— y **ninguno se repite** con los 224
del sueldo. Son documentos complementarios, así que sumarlos es correcto. El
código anterior se quedaba con el id mayor (el finiquito) y perdía el sueldo
entero de esa persona.

Ojo: el finiquito **no trae** `SumaHaberes` ni `CostoEmpresa`, así que esa fila
muestra un líquido muy por encima de sus haberes ($6.346.687 contra $84.125 en
el caso real). No está mal —es lo que Talana transfirió— pero es justo lo que
hace dudar del total, y para eso está el chip.

Quien se va a mitad de mes tiene **dos** liquidaciones de pago en el mismo
período. Los montos de la fila (haberes, descuentos, líquido, costo empresa,
comisión, atrasos) suman las dos, y la planilla marca el caso con un chip
"2 liquidaciones" para que nadie lea la fila como un sueldo normal.

## Configuración

```
TALANA_API_TOKEN=<token de integracion-rem@pintureriapanoramica.cl>
TALANA_API_BASE=https://talana.com/es/api   # opcional
```

Sin token el módulo **abre igual** y explica qué falta; nunca tumba la pantalla.
Lo mismo si Talana responde error o si el cálculo de comisiones no está
disponible (ahí el cruce se muestra sin esa columna).

## La API de Talana, verificada contra el ambiente real (sep-2026)

Auth: `Authorization: Token <token>`. Base `https://talana.com/es/api`.

- `GET /periodos/` → **array plano**, sin paginar, del mes más nuevo al más
  viejo, con `cerrado`.
- `GET /workedDays` → pagina con `page`/`page_size`. **Siempre responde el
  período vigente**: acepta `?periodo=` pero lo ignora (mismo `count`). Por eso
  los días de un mes cerrado se leen del ítem `diasTrabajadosItem` de la
  liquidación, y `workedDays` solo se usa para el mes en curso.
- `GET /liquidaciones/` → pagina **por cursor** (`next` trae `?cursor=`) y sí
  filtra por `?periodo=`. Devuelve `sueldo`, `anticipo` y `finiquito` mezclados:
  hay que separar por `tipoLiquidacion`.
- `GET /contracts/` → pagina con `page`/`page_size`; trae cargo, centro de costo,
  sucursal, jornada y sueldo base. `GET /contract` (singular) está **eliminado**
  (410).

Ítems de liquidación que usa el módulo: `diasTrabajadosItem`, `SueldoBase`,
`SumaHaberes`, `SumaDescuentosLegalesyAdicionales`, `SueldoLiquido`,
`montoTransfer`, `CostoEmpresa`, `Comision1`, `Comision2`, `Atraso`,
`diasAusenciaItem`, `diasLicenciaItem`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `server/services/talana.ts` | Único lugar que habla HTTP con Talana. Tipos, paginación y caché (10 min). |
| `server/routes-remuneraciones.ts` | El cruce, las alertas y los endpoints `/api/rrhh/remuneraciones/*`. |
| `client/src/pages/remuneraciones.tsx` | La pantalla (planilla, descuadres, vínculos) y el selector de columnas. |
| `shared/schema.ts` | Tablas `talana_vinculos` y `talana_vendedores_ignorados`. |
| `remuneraciones_columnas` | Qué columnas eligió ver cada usuario. Se crea en runtime, no tiene modelo en `shared/schema.ts`. |
| `shared/permissions.ts` | Permiso `rrhh.remuneraciones`. |

## Pendiente / a decidir con RR.HH.

- Los reembolsos se imputan al período por **fecha de aprobación**. No es un
  detalle: medido contra la base real, **48 de los 82 reembolsos aprobados se
  aprobaron en un mes distinto al de su creación** (desfase promedio 13 días,
  máximo 43), así que la regla mueve de mes a más de la mitad de la plata. Si
  RR.HH. paga con otro criterio (por ejemplo, corte al día 20), hay que ajustar
  `getReembolsosAprobados()`.
- Al validar el módulo, **no usar julio 2026**: ese mes no tiene ningún reembolso
  aprobado y la columna sale en cero para todos, que se lee igual que "no hubo".
  Los meses con datos son febrero (31 · $486.444), mayo (4 · $110.000), junio
  (18 · $557.784) y agosto (30 · $504.179).
- Hoy el módulo solo **lee** Talana. Escribir la comisión calculada directo en la
  liquidación (en vez de cargarla a mano) es el paso siguiente natural, y
  requiere confirmar con Talana qué endpoint acepta ítems por contrato.
