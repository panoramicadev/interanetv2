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
- **Header de página:** título con un ícono-chip naranja cuadrado + subtítulo gris.
- **Dark mode** siempre contemplado; diseño responsive (los filtros colapsan en móvil).

## El diseño está bloqueado

El look ya está definido. Los cambios nuevos **aplican** estos tokens; no
rediseñan ni introducen paletas nuevas. Antes de dar algo por terminado se corre
la "Definición de diseño terminado" (checklist en la skill). Si el usuario ajusta
un criterio, se actualiza la skill **y** este archivo en la misma sesión.
