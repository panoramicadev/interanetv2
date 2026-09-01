---
name: panoramica-design
description: >-
  Sistema de diseño de la intranet de Panorámica (Pinturas Panorámica). Úsala
  SIEMPRE que vayas a construir o retocar UI en este repo: elegir colores,
  estilar pestañas/tabs, botones, tarjetas KPI, headers de módulo, badges de
  estado, o cuando el usuario pida "que respete el diseño de Panorámica",
  "el naranjo del sidebar", "que se vea como el resto", "unificar colores" o
  similar. El objetivo es no volver a indicar las mismas reglas cada vez.
  Es un documento vivo: cuando el usuario corrija un criterio de diseño,
  actualízalo aquí.
---

# Diseño de Panorámica

Sistema de diseño de la intranet (React + Vite + Tailwind + shadcn/ui). El foco
es **consistencia**: la app tiene un naranja de marca y muchos componentes que
históricamente usaron variantes distintas. Esta skill fija el criterio único.

Referencia canónica en código: **`client/src/pages/tareas.tsx` (Panel de Trabajo)**.
Cuando dudes de una medida exacta, cópiala de ahí — es el módulo de referencia.

## Regla de oro: aplicar, no rediseñar

**El diseño ya está DEFINIDO y BLOQUEADO.** Tu trabajo es aplicar estos tokens y
patrones, no proponer un look nuevo.

- Reutiliza los patrones tal cual. No inventes colores, radios, sombras ni
  gradientes fuera de esta guía.
- Un cambio funcional/de contenido **no** debe arrastrar un rediseño: toca lo mínimo.
- Si crees que falta un patrón, **pregunta antes de crearlo**; si se aprueba,
  documéntalo aquí en la misma sesión (documento vivo).
- Antes de dar algo por listo, corre la **Definición de "diseño terminado"** (abajo).
  Si el checklist pasa, para: no sigas puliendo.

## Regla de oro: el naranja de marca es `#fd6301`

El naranja de Panorámica es **`#fd6301`** — el mismo del logo y del ítem activo
del sidebar (`client/src/components/layout/dashboard-layout.tsx`). Todo acento
naranja "fuerte" (tab activo, botón primario CTA, header de módulo, KPI naranja)
debe usar exactamente ese valor.

- **Hover del naranja:** `#e35400`.
- **Sombra de realce:** `shadow-[#fd6301]/25` o `/30`.

### ⚠️ Gotcha: hay DOS naranjas en el código

| Fuente | Valor | Dónde | Usar |
|---|---|---|---|
| `#fd6301` (marca) | `hsl(23 99% 50%)` | sidebar, logo, hardcodeado en ~78 lugares | ✅ **este** |
| `--primary` / `bg-primary` | `hsl(20.45 100% 56.86%)` | token de shadcn en `index.css` | ⚠️ más claro, NO matchea el sidebar |
| `orange-600` de Tailwind | `#ea580c` | default de shadcn, apagado | ❌ evitar para acentos de marca |

`--primary` **no** es igual a `#fd6301` (es más claro). Por eso `bg-primary`,
`bg-orange-600` y `bg-[#fd6301]` se ven distintos en pantalla. Cuando el usuario
diga "el naranjo debe ser el del sidebar", casi siempre significa reemplazar
`bg-orange-600` / `bg-primary` por **`bg-[#fd6301]`**.

## Patrones canónicos (copiar/pegar)

### Botón primario / CTA (ej. "Nueva Tarea")
```
className="bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
```

### Tab activo (TabsTrigger tipo píldora, fondo sólido — ej. Marketing)
```
className="... data-[state=active]:bg-[#fd6301] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
```

### Tab activo (variante sutil sobre fondo claro — sub-pestañas)
Sobre `TabsList` con `bg-slate-100/70`, el tab activo va **blanco con texto naranja**,
no fondo naranja:
```
className="... data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm rounded-lg"
```
Esta variante queda **solo para sub-pestañas** dentro de una vista (ficha de
cliente, detalle). Para la barra principal de un módulo, ver abajo.

### Barra de pestañas principal del módulo (sin track, ago-2026)

Corrección del usuario (ago-2026, posterior a la barra negra): la barra principal de
pestañas **no lleva track**. Va directamente sobre el fondo blanco de la página, con el
texto en negro y solo la pestaña activa en píldora naranja de marca. La versión de track
negro que replicaba el sidebar quedó descartada: sumaba un bloque oscuro entre el
encabezado y las tarjetas, y partía la pantalla en dos.

```
TabsList    → gap-1.5 bg-transparent dark:bg-transparent p-0 border-0 rounded-2xl
TabsTrigger → group ... font-medium text-[#0a0a0a] dark:text-slate-200
              hover:text-[#fd6301] hover:bg-orange-50
              dark:hover:bg-slate-800/70 dark:hover:text-white
              data-[state=active]:bg-[#fd6301] data-[state=active]:text-white
              data-[state=active]:shadow-md data-[state=active]:shadow-[#fd6301]/30
              dark:data-[state=active]:bg-[#fd6301] dark:data-[state=active]:text-white
              rounded-lg
```
Peso de fuente `font-medium`, igual que los ítems del sidebar.

**En celular el riel se reemplaza por un desplegable** (corrección del usuario, ago-2026):
en una barra no entran cinco o seis pestañas, y arrastrarlas a ciegas no deja ver dónde
estás parado. El riel va `hidden sm:block` y en su lugar aparece la misma **tarjeta-pill de
filtro** con la que se elige la vista en el panel de filtros del dashboard: ícono-chip
naranjo, micro-label (`SECCIÓN`) y el nombre de la pestaña activa. Referencia:
`client/src/pages/tareas.tsx`. Las pestañas se declaran **como datos** (`{ value, label,
Icon }[]`) para que el riel y el desplegable no se desincronicen.

Si en algún caso hay que dejar el riel scrolleable en celular: `flex w-full justify-start
overflow-x-auto` en la propia `TabsList`, `shrink-0` en los triggers, scrollbar oculta
(`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`) y la activa centrada ajustando
`scrollLeft` con rects. `justify-start` es obligatorio (la `TabsList` de shadcn trae
`justify-center` y eso vuelve inalcanzable el comienzo de la lista), y **no** sangrar el
contenedor con `-mx-*`: la barra se corta contra el borde de la pantalla, sin su esquina
redondeada.

**Badge contador dentro de una pestaña:** naranja sobre el fondo blanco, pero se
**invierte a blanco con texto naranja** cuando la pestaña está activa (si no,
naranja sobre naranja desaparece). Igual que el badge del sidebar. Requiere `group`
en el trigger:
```
bg-[#fd6301] text-white group-data-[state=active]:bg-white group-data-[state=active]:text-[#fd6301]
```

### Tab pastilla (`rounded-full` — Rendición de Gastos)
Variante ovalada, aprobada por el usuario en jul-2026 al incorporar el sistema de
`primerosresultados/rendicion-gastos`. La `TabsList` es una **pastilla blanca con
borde** y el trigger activo va en naranja sólido:

Fuente única: **`client/src/components/gastos/tabs-pill.ts`** (`TABS_LIST_PILL` /
`TAB_PILL`, más `*_SOFT` para sub-pestañas anidadas). Importar de ahí, no copiar
las clases.

```
TabsList  → rounded-full border border-slate-200/70 bg-white p-1 shadow-sm
TabsTrigger → h-9 rounded-full px-4 + data-[state=active]:bg-[#fd6301] text-white
sub-tabs  → track bg-slate-100/70 + activo bg-white text-[#fd6301]
```

Tres detalles que hay que respetar al reusarla:
- **Duplicar la variante `dark:data-[state=active]:…`.** `dark:` y
  `data-[state=active]:` tienen la misma especificidad; sin la combinada, el
  color del tab activo depende del orden en que Tailwind emite las reglas y en
  oscuro se pierde el contraste.
- **Ocultar la scrollbar** (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`):
  en móvil la barra del sistema corta el borde inferior de la pastilla.
- **Centrar el tab activo** al montar y al cambiar de pestaña, ajustando
  `scrollLeft` de la lista (no `scrollIntoView`, que arrastra el scroll de la
  página) dentro de un `requestAnimationFrame` y con `behavior: "auto"` — con
  scroll suave, el re-layout del contenido al montarse aborta la animación.

### Kit del módulo de Gastos (`components/gastos/ui.tsx`)

Rendición de Gastos tiene su propio kit, aprobado en ago-2026 al portar el
sistema de `primerosresultados/rendicion-gastos`. **No dupliques estas clases:
importa los componentes.**

| Export | Para qué |
|---|---|
| `Monto` / `formatoMoneda` | CLP con `tabular-nums`. Todo monto va tabular: sin eso las columnas no alinean al comparar filas. |
| `EstadoChip` | Pill de estado en MAYÚSCULAS. **Un solo mapa** para gastos, informes y fondos. |
| `CategoriaIcono` | Círculo naranja con el ícono de la categoría del gasto. |
| `KpiCard` | Tarjeta de indicador con barra de acento (`tono`: marca/ok/alerta/error/info). |
| `EstadoVacio` | Estado vacío: chip de ícono + título + bajada + acción. |
| `EncabezadoSeccion` | Título + bajada + acciones, con el mismo ritmo en todas las pantallas. |
| `BOTON_MARCA`, `SUPERFICIE` | Clases del botón primario y de la tarjeta base. |

La razón de existir del kit no es estética: antes **cada pantalla tenía su propio
`getEstadoBadge`**, así que un mismo "aprobado" se veía distinto en gastos que en
fondos. Si agregas un estado nuevo, va en el mapa de `ui.tsx`, no en la página.

### Dashboards: todo el acento va en la familia naranja (ago-2026)

Barrido pedido por el usuario sobre el dashboard principal y las vistas de
segmento, sucursal, vendedor, supervisor y técnico. Regla:

- **Ícono-chip de tarjeta o panel: naranjo SÓLIDO con el ícono en blanco.**
  Fuente única: **`client/src/lib/icono-chip.ts`** (`ICONO_CHIP` / `ICONO_CHIP_ICONO`,
  más las variantes `_SM` para chips dentro de una fila). Importar de ahí en vez de
  repetir las clases.
  ```
  bg-[#fd6301] rounded-xl p-2.5 shadow-md shadow-[#fd6301]/25   ← contenedor
  h-5 w-5 text-white                                            ← ícono
  ```
  Corrección del usuario (ago-2026): antes esta guía pedía la versión **suave**
  (`bg-orange-50` + ícono `text-[#fd6301]`), y quedó conviviendo con la sólida que ya
  usaban Meta y Documentos Pendientes. Dos tarjetas vecinas con chips distintos se leen
  como si tuvieran distinta jerarquía. Se barrió toda la app a la sólida.
  Nada de chips celestes, verdes o lilas — ni de emojis en lugar del ícono.
  ⚠️ **`bg-orange-50` sigue siendo válido** para fondos de fila, filas de total y
  avisos. Lo que cambió es el chip que envuelve a un ícono.
- **Botones de acción dentro de un panel** ("Análisis completo", "Exportar"):
  `bg-[#fd6301] hover:bg-[#e35400]`.
- **Barras de ranking de una sola serie** (top productos, top vendedores, top
  clientes): `bg-[#fd6301]`.
- **Cifras destacadas y variaciones positivas:** `text-[#fd6301]`.
  **Las negativas se quedan en `text-red-600`** — es la única alerta que sobrevive
  al barrido, y sin ella una caída se lee igual que una subida.
- **Dos series que hay que distinguir** (NVV vs GDV en Documentos Pendientes):
  una en naranjo y la otra en pizarra (`slate`), no en dos colores nuevos.
- La paleta categórica de gráficos (abajo) es la excepción: ahí sí hacen falta
  colores distintos, y arranca en el naranjo de marca.
  Fuente única: **`client/src/lib/chart-palette.ts`** (`CHART_COLORS`,
  `CHART_COLORS_SOFT`, `ESTADO_COLORS`). No declarar arrays de colores en cada
  gráfico.

### Gráficos: paleta y reglas (ago-2026)

Definida al modernizar el dashboard de Gastos
(`client/src/pages/gastos-empresariales-dashboard.tsx`). Vale para cualquier
gráfico de la intranet.

- **Categórica, en orden fijo** (validada contra daltonismo sobre fondo claro;
  pares vecinos ΔE ≥ 9): `#fd6301` · `#2563eb` · `#10b981` · `#db2777` ·
  `#f59e0b` · `#7c3aed` · `#0d9488`. De la 8ª serie en adelante se **agrupa en
  "Otras"** con `#64748b`; no se generan colores nuevos.
- **El color sigue a la entidad, no a su ranking.** Se asigna por nombre desde un
  orden estable, así filtrar el período no repinta las categorías que quedan.
- **Estados reservados** (nunca como color de serie): pendiente `#d97706`,
  aprobado `#059669`, rechazado `#dc2626` — los mismos conceptos del `EstadoChip`.
- **Marcas finas y grilla recesiva:** línea de 2px, sin puntos salvo en hover,
  grilla `rgba(148,163,184,0.16)`, ejes sin borde y ticks en
  `rgba(100,116,139,0.9)`. Nada de porcentajes impresos sobre cada marca.
- **Un ranking se lee mejor como lista con barra** (nombre + monto + % + barra
  `h-2 rounded-full`) que como gráfico de barras: entra en móvil y muestra la
  cifra exacta. Los gráficos quedan para composición (dona) y tiempo (línea).
- La dona va con `cutout: '72%'`, aro blanco de 2px entre porciones y el **total
  al centro**; la leyenda son filas con monto al costado, no la de Chart.js.

### Formularios largos (alta de gasto)

Patrón de `components/gastos/formulario-gasto.tsx`:

- **Dos columnas** en escritorio: campos a la izquierda, resumen `lg:sticky` a la
  derecha con el total, el financiamiento y el botón primario siempre a la vista.
- Bloques numerados (chip naranja `1`, `2`, `3`) sobre tarjetas `SUPERFICIE`.
- **Categoría en chips** en vez de un `Select`: se elige de un toque y se ve todo
  el catálogo. Activo = `bg-[#fd6301]` con texto blanco.
- **Control segmentado** para opciones binarias (Reembolso / Con fondo): mismo
  track gris + activo blanco con texto naranja de `TAB_PILL_SOFT`.
- Campos en `rounded-xl`, `bg-slate-50/60` y foco naranja
  (`focus-visible:border-[#fd6301]` + `ring-orange-500/20`).
- El formulario **arranca listo**: colaborador y fecha puestos, foco en el monto.

### Móvil: tabla ≠ lista

Regla del módulo de Gastos, extensible al resto: **una tabla de más de ~5 columnas
no se muestra en móvil**. Se renderiza `hidden md:block` y debajo va una lista de
tarjetas `md:hidden` con lo mínimo para decidir de un vistazo (ícono, título,
meta, monto y estado), y el detalle a un toque.

Cuando el chip de estado es largo (p. ej. "EN APROBACIÓN"), en móvil el monto y el
estado **bajan a su propia fila** dentro de la tarjeta; en línea con el título lo
truncan. Patrón: contenedor `flex-wrap`, bloque de monto/estado con
`w-full … sm:w-auto sm:flex-col`.

### Móvil: presupuesto de alto antes del contenido

En un teléfono la primera pantalla se llena con el encabezado y los filtros, y el
contenido queda a un scroll y medio. Criterios que se aplicaron en Gastos:

- Encabezado: ícono y título más chicos, **la bajada solo en escritorio**
  (`hidden md:block`), y los indicadores en una fila con separador.
- Barras de acciones con 3+ botones: tira que scrollea en horizontal
  (`overflow-x-auto` + ocultar scrollbar), no `flex-wrap`.
- Etiquetas de texto de un filtro que ya tiene ícono (`Vista:`, `Período:`):
  `hidden sm:inline`.
- Selectores cortos de a dos por fila (`grid-cols-2`), no apilados.
- Ritmo vertical: `space-y-3/4` en móvil contra `md:space-y-5/8`.

### Tarjeta de meta del dashboard (negro + naranjo, ago-2026)

Fuente única: **`client/src/components/dashboard/meta-goal-card.tsx`**. La usan el
dashboard principal y las vistas de segmento, sucursal y vendedor. Antes cada
pantalla tenía su propia copia con lila/celeste/cian y el mismo logro se veía
distinto en cada una.

- Ícono-chip `bg-[#fd6301] rounded-xl p-2.5 shadow-md shadow-[#fd6301]/25`, ícono blanco.
- **% grande: el color dice el modo** — `text-[#0a0a0a]` (negro) en Combinado y
  `text-[#fd6301]` (naranjo) en Facturado, igual que las dos barras. No se pinta
  por umbral de cumplimiento (corrección del usuario, ago-2026).
- Bajo el %, la etiqueta va con la misma tipografía y color que las cifras de
  Documentos Pendientes: `text-xs text-gray-500 dark:text-gray-400`, en texto
  normal — "Logrado" o "Logrado combinado" según el modo.
- **Sin subtítulo de período** bajo el título: el período ya está en el selector
  de arriba (corrección del usuario, ago-2026).
- Dos tiles: **Meta Mensual** en `bg-[#0a0a0a]` con borde `slate-800/80`, y
  **Ventas Actuales / Total Combinado** en `bg-[#fd6301]`. Las dos etiquetas van
  en **blanco** (corrección del usuario, ago-2026: en gris sobre negro/naranjo no se leen).
- Barras: la gruesa (facturado) `from-[#fd6301] to-[#e35400]`; la fina (combinado)
  `from-slate-700 to-[#0a0a0a]`. Sin monto ni % impresos debajo: esa cifra ya está
  en los tiles y en el % grande (corrección del usuario, ago-2026).

**El período siempre en español.** La etiqueta del selector se arma desde la
selección misma en `year-month-selector.tsx` (nunca del campo `display` guardado,
que puede venir en inglés), y `formatPeriodDisplay` de `FilterContext` da
"Agosto 2026" con mayúscula inicial.

**Modo Facturado / Combinado:** vive en `FilterContext` (`showCombined`), arranca
en **Combinado** y vuelve a Combinado al cambiar de vista. El % grande de la meta
sigue ese interruptor; el combinado solo aplica al mes en curso.

### Header de módulo (ícono cuadrado + título)
```
<div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
```
El ícono de marca cuadrado del sidebar usa `bg-[#fd6301] rounded-xl`.

### Tarjeta KPI naranja
```
className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-orange-600 text-white"
```

### Banner de header de sección (CardHeader naranja lleno)
```
className="bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white"
```
❌ **Nunca** `from-orange-700 to-orange-800` para estos banners: se ve rojizo/rust
apagado. Siempre el gradiente de marca de arriba.

## Radios (consistencia clave)

Fijado en el Panel de Trabajo (jul-2026):

- **Botones**: `rounded-2xl` (≈16px) — el mismo radio que las tarjetas-pill de filtro.
  Antes usaban el default de shadcn (`rounded-md`); ahora TODO botón del panel va `rounded-2xl`.
- **Tarjetas / pills de filtro / contenedores**: `rounded-2xl`.
- **Ícono-chip grande** (header): `rounded-xl`. **Ícono chico** dentro de un pill: `rounded-lg`.
- **TabsList**: `rounded-2xl`; **Tab trigger**: `rounded-lg`.
- **Badge contador**: `rounded-full`.
- Botones de solo-ícono chicos pueden quedar `rounded-lg`.

### Tarjeta-pill de filtro (selector con ícono)
Card blanca `rounded-2xl`, ícono en cuadro de color (`w-9 h-9 rounded-xl`) y un
`Select` sin bordes. El label micro-uppercase va **pegado** al valor (`mb-0.5`).
Color del ícono por categoría: Vista→naranja, Estado→emerald, Prioridad→amber.
```
<div className="flex items-center gap-3 bg-white ... border border-slate-200/70 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-orange-200 hover:shadow transition-all">
  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex-shrink-0"><Icon className="h-4 w-4" /></div>
  <div className="flex flex-col leading-none">
    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Label</span>
    <Select>…<SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" />…</Select>
  </div>
</div>
```

### Barra de filtros (uso del espacio)
Fila `flex ... justify-between`: los filtros a la **izquierda**; a la **derecha**,
el badge contador. No dejar el contador solo flotando: aprovechar el ancho.

### Encabezado de módulo en celular (Panel de Trabajo, ago-2026)

Orden fijado por el usuario, de arriba hacia abajo:

1. **Título** + la **campana** anclada arriba a la derecha, a la altura del título.
   La bajada del módulo no se muestra en celular (`hidden sm:block`).
2. **Selector de Área** (el contexto manda: primero el área…).
3. **Selector de sección** (…y después dónde dentro de ella).
4. **Botón de acción** naranjo.

Jerarquía de peso visual en esa pila, de menor a mayor:

- **Campana:** círculo `bg-[#0a0a0a]` de `w-9 h-9` con el ícono blanco en celular; de `sm`
  para arriba vuelve a ser la tarjeta blanca de 44px. Es un aviso, no una decisión.
- **Chips del Área y de la Sección:** naranjo **suave** — `bg-orange-50` con el ícono
  `text-[#fd6301]`, sin relleno sólido ni sombra. Los dos iguales: son selectores de
  contexto, no acciones.
- **Botón de acción:** el único naranjo sólido de la pantalla.

Tres naranjos sólidos seguidos (Área, Sección y el botón) se leen como tres botones; por eso
los dos selectores bajan a suave y la campana sale del naranjo. Y sus **íconos tienen que ser
distintos entre sí**: con el edificio en los dos, las dos tarjetas se leían como la misma
(Seguimiento pasó a `UserCheck`). Se mueve **con posición**, no dibujando
dos campanas: una segunda instancia traería su propio estado.

### Selector de Área y de Vendedor (contexto global)
El selector de Área vive **siempre en el header de la página** (junto al CTA
"Nueva Tarea"), visible en **todas las pestañas** — cambia el contexto de todo
el módulo, no de una sola vista (corrección del usuario, jul-2026: antes iba en
la fila de filtros en Tareas/Marketing y parecía "desaparecer" en otras pestañas).

**El Vendedor del CRM vive en el mismo lugar, apilado DEBAJO del Área** (pedido del
usuario, ago-2026), con el **mismo pill** que el Área: mismo borde, mismo micro-label
en mayúsculas y el ícono naranjo suelto sin recuadro. Se leen de arriba hacia abajo
—área → vendedor—, no uno al lado del otro. Solo aparece en la pestaña CRM (es lo
único que filtra) y solo para quien ve más de una cartera. Su ícono es `User`, **no**
`UserCheck`: ese es el de la pestaña Seguimiento, y dos controles con el mismo ícono se
leen como el mismo control.

En celular el orden de la pila queda: **Área → Vendedor → Sección → botón de acción**.

**Corolario: la pestaña embebida no repite el filtro abajo.** Al subir el Vendedor al
encabezado se sacó la caja de filtros completa del CRM embebido (buscador, Estado,
Prioridad, Región, Comuna, Destacados, Problemas primero y el contador): entre los KPI y
el tablero metía una fila de ocho controles que empujaba el pipeline fuera de la primera
pantalla. La página standalone (`/seguimiento-clientes`) conserva su toolbar.

### Badge contador
```
<Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full">N ítems</Badge>
```

## Convenciones de estado (badges)

- **Facturado / OK / listo:** verde (`emerald`/`green`), pill con check.
- **Pendiente / sin factura:** naranja/ámbar.
- **Error / vencido:** rojo (`red`/`rose`).

## Layout y tono general

### Shell (ago-2026) — todo a sangre, sin tarjetas ni canvas

`client/src/components/layout/dashboard-layout.tsx`:

- Fondo de la app: **`bg-white dark:bg-slate-900`**. No hay canvas gris.
- Sidebar: `fixed top-0 left-0 h-[100dvh]` **sin padding**, con
  `w-[16rem]` expandido / `w-[4.25rem]` colapsado (256px / 68px, el mismo ancho
  visible de siempre). Adentro `bg-[#0a0a0a] shadow-xl shadow-slate-900/10
  overflow-hidden`, **sin `rounded-*`**: llega pegado arriba, abajo y a la izquierda.
  ⚠️ `h-[100dvh]`, **no** `inset-y-0`: en el teléfono un `fixed` con top+bottom se estira
  al viewport grande (el de la barra de direcciones escondida) y la tarjeta de usuario
  queda debajo del borde. Y `transition-[transform,width]`, **no** `transition-all`.
- Módulo: `<main>` sin padding, con
  `bg-white dark:bg-slate-900 min-h-screen overflow-clip`, desplazado con
  `lg:pl-[16rem]` / `lg:pl-[4.25rem]`. Ocupa todo el ancho y alto disponible,
  **sin borde, sin esquinas redondeadas y sin margen**.
  ⚠️ `overflow-clip`, **no** `overflow-hidden`: hidden convierte el bloque en
  scroll container y rompe los `sticky top-0` de las páginas.

- **Móvil: dónde va el botón del menú.** En el **Dashboard principal** sigue arriba a la
  izquierda (`fixed top-[42px] left-4`), calzado con su barra superior del logo. En **todos
  los demás módulos** (Panorámica Market, Panel de Trabajo, Tomador de Pedidos, Inventario…)
  no hay barra arriba y el círculo tapaba el ícono y el título de la página: ahí va en una
  **barra blanca fija al pie** (`fixed bottom-0 inset-x-0 h-14`, borde superior
  `border-slate-200`, `pb-[env(safe-area-inset-bottom)]`) y el módulo reserva ese alto con
  `pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0` — los dos números van juntos.
  Esa barra va en `z-40`, pero **baja a `z-30` mientras el menú móvil está abierto**: en
  `z-40` quedaba por encima de la capa oscura (`z-35`), sin oscurecer y comiéndose los
  toques, justo donde cae el pulgar para cerrar el menú.
  El shell no adivina la ruta ni el rol: la página que tiene barra propia lo pide con
  `useBotonMenuArriba()` (exportado por `dashboard-layout.tsx`). Cualquier barra fija propia
  de una página tiene que subir por encima en móvil
  (`bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:bottom-0`).

Corrección del usuario (ago-2026), en dos pasos: hasta julio esto era un **shell de dos
tarjetas** (sidebar y módulo con `rounded-3xl` y `p-3`, flotando sobre un canvas
`bg-slate-100`). Primero se sacó el marco del módulo —el recuadro lo hacía leer como una
ventana dentro de la pantalla en vez de como la pantalla misma— y después el del menú,
por lo mismo. **Si vas a tocar los anchos, acordate de que el `pl-` del módulo tiene que
seguir al `w-` del sidebar**: son el mismo número en dos lugares.

- **Fondo de página: BLANCO.** `--background` es `hsl(0,0%,100%)` y el root de
  cada página va `bg-white dark:bg-slate-900` (o sin bg, heredando).
  ❌ Nada de `bg-gray-50`, `bg-slate-50/50` ni el gradiente
  `from-slate-50 via-white to-orange-50/30` como fondo de módulo.
- El sidebar **no** tiene buscador de módulos (se eliminó en jul-2026).
- Radios grandes: `rounded-xl` / `rounded-2xl` para cards y contenedores;
  `rounded-3xl` para las dos tarjetas del shell.
- Tipografía de títulos: `font-bold text-slate-800 dark:text-slate-100`.
- Soportar dark mode siempre con los prefijos `dark:`.

### Panel de filtros en móvil (Drawer)

Reglas fijadas en el cajón de filtros del dashboard (ago-2026), válidas para cualquier
panel de filtros en celular:

- **Nada de popovers adentro.** Un Radix Popover se portala al `body`, y mientras el
  Drawer está abierto el `body` va con `pointer-events: none`: el popover se ve pero no se
  puede tocar. El contenido se dibuja **inline**, sin portal — `YearMonthSelector` tiene la
  prop `inline` justamente para eso.
- **Un solo botón "Aplicar"**, el del pie del cajón. Los controles de adentro publican su
  selección al toque (`onChange` en cada cambio); dos botones seguidos se leen como dos
  pasos distintos.
- **Sin cabecera de cajón ni títulos repetidos.** El `DrawerHeader` va `sr-only` (los
  lectores de pantalla sí lo necesitan para nombrar el diálogo): el título y la bajada
  llenaban la primera pantalla del celular sin aportar nada.
- **Ancho:** el default del cajón es `w-[16rem]`, muy angosto para un calendario. Si adentro
  hay una grilla, subilo (`w-[92vw] max-w-[26rem] sm:w-[24rem]`).
- **Objetivos de toque de 36px** (`h-9`) para años, meses y días, en `rounded-xl` (días
  `rounded-lg`), con el activo en `bg-[#fd6301]`.

## Landing por rol

El aterrizaje por rol vive en `client/src/App.tsx` (switch en `<Route path="/" .../>`).
Regla vigente: el rol **marketing** aterriza en el **Panel de Trabajo** (`TareasPage`),
no en el módulo Marketing (que queda accesible desde el sidebar).

## Definición de "diseño terminado" (checklist)

Antes de dar por listo un cambio de UI, verifica:

- [ ] Todo naranja de marca es `#fd6301` (ni `--primary` ni `orange-600`).
- [ ] Botones en `rounded-2xl`; tabs/filtros con los radios de la tabla de arriba.
- [ ] Header de página con ícono-chip + subtítulo cuando corresponde.
- [ ] Estados hover/active presentes y en naranja donde toca.
- [ ] Dark mode contemplado (`dark:` en superficies, bordes y textos).
- [ ] Responsive: en móvil los filtros colapsan, sin overflow horizontal.
- [ ] No se introdujeron colores/radios/sombras fuera de esta guía.

Si todo lo anterior se cumple, **el diseño está listo — no sigas puliendo.**

## Cuando el usuario corrija algo de diseño

Este archivo es la fuente de verdad y es **vivo**: si el usuario ajusta un color,
un patrón de tab, o una regla nueva, edítalo aquí en la misma sesión para no
volver a pedir la misma indicación. La copia humana resumida vive en `DESIGN.md`
(raíz del repo) — mantenla en sync cuando cambien los tokens.
