/**
 * Pestañas tipo pastilla del módulo de Rendición de Gastos.
 *
 * Es el patrón de tabs que traía primerosresultados/rendicion-gastos
 * (client/src/components/ui/tabs.tsx: TabsList `rounded-full` con borde y
 * sombra, trigger `rounded-full` y activo en sólido), adaptado al naranja de
 * marca de Panorámica (#fd6301) y a los tokens dark: del resto de la app.
 *
 * Se aplica sobre el `Tabs` de shadcn (Radix): `cn` usa tailwind-merge, así que
 * estas clases pisan los defaults del componente (`rounded-md`, `bg-muted`,
 * `h-10`, `data-[state=active]:bg-background`).
 */

/** Contenedor: pastilla blanca con borde suave; scrollea en móvil. */
export const TABS_LIST_PILL =
  "inline-flex h-auto w-full items-center justify-start gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap " +
  // En móvil la barra scrollea; la scrollbar del sistema cortaba el borde
  // inferior de la pastilla. Se oculta acá y no en index.css para no tocar un
  // archivo compartido por el resto de los módulos.
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden " +
  "rounded-full border border-slate-200/70 bg-white p-1 shadow-sm lg:w-auto " +
  "dark:border-slate-700 dark:bg-slate-900";

/**
 * Trigger: pastilla; activo en naranja de marca sólido.
 *
 * Los `dark:data-[state=active]:…` son necesarios, no redundantes: `dark:` y
 * `data-[state=active]:` tienen la misma especificidad, así que sin la variante
 * combinada el color del tab activo queda a merced del orden en que Tailwind
 * emite las reglas y en oscuro se pierde el contraste.
 */
export const TAB_PILL =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 " +
  "text-sm font-medium text-slate-500 transition-colors " +
  "hover:bg-orange-50 hover:text-slate-700 " +
  "data-[state=active]:bg-[#fd6301] data-[state=active]:text-white " +
  "data-[state=active]:shadow-sm data-[state=active]:shadow-orange-500/25 " +
  "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 " +
  "dark:data-[state=active]:bg-[#fd6301] dark:data-[state=active]:text-white";

/**
 * Variante compacta para las sub-pestañas (p. ej. los cuatro catálogos), que
 * viven dentro de una pestaña principal y no deben competir con ella: pastilla
 * sobre track gris, activo en blanco con texto naranja.
 */
export const TABS_LIST_PILL_SOFT =
  "inline-flex h-auto w-full items-center justify-start gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap " +
  // En móvil la barra scrollea; la scrollbar del sistema cortaba el borde
  // inferior de la pastilla. Se oculta acá y no en index.css para no tocar un
  // archivo compartido por el resto de los módulos.
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden " +
  "rounded-full border border-slate-200/60 bg-slate-100/70 p-1 lg:w-auto " +
  "dark:border-slate-700/60 dark:bg-slate-800/60";

export const TAB_PILL_SOFT =
  "inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 " +
  "text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 " +
  "data-[state=active]:bg-white data-[state=active]:text-[#fd6301] data-[state=active]:shadow-sm " +
  "dark:text-slate-400 dark:hover:text-slate-200 " +
  // En oscuro el activo debe ser MÁS CLARO que el track (slate-800/60), igual
  // que el blanco sobre gris del tema claro; slate-900 lo dejaba más oscuro.
  "dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-orange-400";
