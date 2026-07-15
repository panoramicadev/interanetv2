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
los selectores de contexto (p.ej. el selector de Área) + el badge contador
agrupados. No dejar el contador solo flotando: aprovechar el ancho.

### Badge contador
```
<Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full">N ítems</Badge>
```

## Convenciones de estado (badges)

- **Facturado / OK / listo:** verde (`emerald`/`green`), pill con check.
- **Pendiente / sin factura:** naranja/ámbar.
- **Error / vencido:** rojo (`red`/`rose`).

## Layout y tono general

- Fondos de página: `bg-gradient-to-br from-slate-50 via-white to-orange-50/30`
  (light) / `dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/20` (dark).
- Radios grandes: `rounded-xl` / `rounded-2xl` para cards y contenedores.
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
