# Remuneraciones (Talana × intranet)

Módulo de RR.HH. que cruza lo que **Talana** va a pagar con lo que la **intranet**
calculó. Ruta `/remuneraciones`, permiso `rrhh.remuneraciones` (por defecto solo
`admin` y `recursos_humanos`).

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

1. **Planilla del período** — una fila por persona con días, sueldo base,
   haberes, descuentos, líquido, las dos comisiones, la diferencia y los
   reembolsos. En celular es una lista de tarjetas: la tabla no entra.
2. **Descuadres** — solo lo que no calza, agrupado por tipo, con acceso directo a
   arreglar el vínculo cuando esa es la causa.
3. **Vínculos** — asignar/confirmar la persona de la intranet y el vendedor del
   ERP. Lista a **todas** las personas que Talana liquida, no solo las que
   devuelve `/contracts`: son 56 contratos contra 64 liquidaciones, y los 8 de
   diferencia incluían vendedores con comisión que no se podían vincular.

Además: selector de período (los meses que informa Talana, con su estado
abierto/cerrado), botón **Actualizar** (vacía el caché de la API) y **Exportar CSV**.

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
| `client/src/pages/remuneraciones.tsx` | La pantalla (planilla, descuadres, vínculos). |
| `shared/schema.ts` | Tabla `talana_vinculos`. |
| `shared/permissions.ts` | Permiso `rrhh.remuneraciones`. |

## Pendiente / a decidir con RR.HH.

- Los reembolsos se imputan al período por **fecha de aprobación**. Si en la
  práctica se pagan con otro criterio (por ejemplo, corte al día 20), hay que
  ajustar `getReembolsosAprobados()`.
- Hoy el módulo solo **lee** Talana. Escribir la comisión calculada directo en la
  liquidación (en vez de cargarla a mano) es el paso siguiente natural, y
  requiere confirmar con Talana qué endpoint acepta ítems por contrato.
