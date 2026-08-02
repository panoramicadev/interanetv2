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

### Tab activo (variante sutil sobre fondo claro — ej. Panel de Trabajo)
Sobre `TabsList` con `bg-slate-100/70`, el tab activo va **blanco con texto naranja**,
no fondo naranja:
```
className="... data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm rounded-lg"
```
Son dos estilos de tab distintos y ambos son válidos según el contenedor: fondo
sólido naranja cuando la TabsList es blanca/plana; blanco+texto-naranja cuando la
TabsList es un track gris.

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

### Selector de Área (contexto global)
El selector de Área vive **siempre en el header de la página** (junto al CTA
"Nueva Tarea"), visible en **todas las pestañas** — cambia el contexto de todo
el módulo, no de una sola vista (corrección del usuario, jul-2026: antes iba en
la fila de filtros en Tareas/Marketing y parecía "desaparecer" en otras pestañas).

### Badge contador
```
<Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full">N ítems</Badge>
```

## Convenciones de estado (badges)

- **Facturado / OK / listo:** verde (`emerald`/`green`), pill con check.
- **Pendiente / sin factura:** naranja/ámbar.
- **Error / vencido:** rojo (`red`/`rose`).

## Layout y tono general

### Shell de tarjetas (jul-2026) — sidebar y módulo son dos tarjetas

`client/src/components/layout/dashboard-layout.tsx` monta un shell de dos
tarjetas flotando sobre un canvas gris:

- Canvas de la app: `bg-slate-100 dark:bg-slate-950` (el gris SOLO vive acá).
- Sidebar: `fixed inset-y-0 left-0 p-3` + tarjeta interna
  `bg-[#0a0a0a] rounded-3xl shadow-xl shadow-slate-900/10 overflow-hidden`.
  Anchos del contenedor: `w-[17.5rem]` expandido / `w-[5.75rem]` colapsado
  (el `p-3` deja la tarjeta en 256px / 68px).
- Módulo: `<main className="p-3 lg:pl-0">` con tarjeta
  `bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 shadow-sm
  min-h-[calc(100vh-1.5rem)] overflow-clip`.
  ⚠️ `overflow-clip`, **no** `overflow-hidden`: hidden convierte la tarjeta en
  scroll container y rompe los `sticky top-0` de las páginas.

- **Fondo de página: BLANCO.** `--background` es `hsl(0,0%,100%)` y el root de
  cada página va `bg-white dark:bg-slate-900` (o sin bg, heredando la tarjeta).
  ❌ Nada de `bg-gray-50`, `bg-slate-50/50` ni el gradiente
  `from-slate-50 via-white to-orange-50/30` como fondo de módulo — el usuario lo
  corrigió explícitamente: el módulo se ve blanco, el gris es solo el canvas.
- El sidebar **no** tiene buscador de módulos (se eliminó en jul-2026).
- Radios grandes: `rounded-xl` / `rounded-2xl` para cards y contenedores;
  `rounded-3xl` para las dos tarjetas del shell.
- Tipografía de títulos: `font-bold text-slate-800 dark:text-slate-100`.
- Soportar dark mode siempre con los prefijos `dark:`.

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
