// Riel de pestañas de los módulos con la pestaña activa en naranjo: Finanzas y Margen
// (pedido del usuario, nov-2026). Va sobre el encabezado blanco, con una línea base gris
// bajo todas las pestañas; el `-mb-px` monta el subrayado sobre esa línea.

/** La `TabsList`. */
export const TABS_MODULO =
  "flex w-full min-w-max justify-start gap-1.5 p-0 h-auto bg-transparent dark:bg-transparent border-0 border-b border-slate-200 dark:border-slate-800 rounded-none";

/** Cada `TabsTrigger`. */
export const TAB_MODULO =
  "flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium text-[#0a0a0a] dark:text-slate-200 hover:text-[#fd6301] dark:hover:text-white border-b-2 border-transparent bg-transparent -mb-px rounded-none transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold data-[state=active]:text-[#fd6301] data-[state=active]:border-[#fd6301] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-[#fd6301] dark:data-[state=active]:border-[#fd6301]";
