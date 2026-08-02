# Guía de diseño — Panorámica

Resumen humano del sistema de diseño de la intranet. La **fuente de verdad
completa** (para Claude y para copiar/pegar) vive en la skill
[`.claude/skills/panoramica-design/SKILL.md`](.claude/skills/panoramica-design/SKILL.md).
El módulo de referencia en código es el **Panel de Trabajo**
(`client/src/pages/tareas.tsx`).

## Lo esencial

- **Naranja de marca: `#fd6301`** (el del sidebar/logo). Nunca `--primary` (más
  claro) ni `orange-600` de Tailwind (apagado). Hover: `#e35400`.
- **Botones:** esquinas `rounded-2xl` (≈16px), igual radio que las tarjetas de filtro.
  - Primario: gradiente naranja + texto blanco + sombra naranja.
  - Secundario: blanco con borde gris y hover naranja.
- **Tabs:** track gris `rounded-2xl`; pestaña activa = fondo blanco + texto naranja.
- **Filtros:** cada filtro es una "tarjeta-pill" blanca con un ícono de color y un
  selector sin bordes. La fila deja los filtros a la izquierda y el contador a la
  derecha. El selector de contexto (Área) vive siempre en el header de la página,
  visible en todas las pestañas.
- **Shell de tarjetas:** el sidebar es una tarjeta negra flotante (`rounded-3xl`)
  y el módulo otra tarjeta **blanca** (`rounded-3xl`), separadas por un canvas
  gris claro. El gris vive solo en el canvas: **el fondo de cada módulo es blanco**
  (nada de `bg-gray-50` ni gradientes de fondo). El sidebar no tiene buscador.
- **Header de página:** título con un ícono-chip naranja cuadrado + subtítulo gris.
- **Dark mode** siempre contemplado; diseño responsive (los filtros colapsan en móvil).

## Móvil no es "lo mismo más angosto"

- Una **tabla de más de ~5 columnas no se muestra en móvil**: se oculta y en su
  lugar va una lista de tarjetas con lo justo para decidir de un vistazo (ícono,
  título, meta, monto, estado) y el detalle a un toque.
- El encabezado y los filtros no pueden comerse la primera pantalla: la bajada
  del título solo en escritorio, las barras de 3+ botones scrollean en horizontal
  (no se apilan), y las etiquetas de un filtro que ya tiene ícono se ocultan.

## Módulo de Gastos: usa su kit

Rendición de Gastos tiene componentes propios en
`client/src/components/gastos/` (`ui.tsx` y `tabs-pill.ts`): montos, chips de
estado, KPI, estados vacíos y pestañas. **Impórtalos, no copies las clases** — el
kit existe justamente porque antes cada pantalla pintaba el mismo estado de un
color distinto.

## El diseño está bloqueado

El look ya está definido. Los cambios nuevos **aplican** estos tokens; no
rediseñan ni introducen paletas nuevas. Antes de dar algo por terminado se corre
la "Definición de diseño terminado" (checklist en la skill). Si el usuario ajusta
un criterio, se actualiza la skill **y** este archivo en la misma sesión.
