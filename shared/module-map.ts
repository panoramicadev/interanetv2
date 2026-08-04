/**
 * Mapa de Módulos — Fuente única de verdad para capacitación
 * ---------------------------------------------------------------
 * Describe QUÉ es cada módulo de la intranet, PARA QUÉ sirve, QUIÉN lo usa,
 * DÓNDE vive en el menú y CÓMO se hacen las tareas típicas, paso a paso.
 *
 * Se comparte entre:
 * - server/ai-modules.ts  → arma el índice que ve el asistente y resuelve
 *                            las herramientas list_modules / get_module_guide.
 * - client/src/components/guided-tour → ejecuta las guías marcando en pantalla
 *                            dónde tiene que hacer clic el usuario.
 *
 * Reglas para mantenerlo:
 * - `permission` debe ser una clave real de shared/permissions.ts (o null si
 *   el módulo no está gobernado por permisos). El asistente filtra por esto:
 *   nunca capacita a un usuario en un módulo que no puede abrir.
 * - `nav.label` / `nav.parentLabel` deben coincidir EXACTO con el label del
 *   ítem en sidebar-config.ts: es el nombre que el asistente le dice al usuario
 *   y el texto de respaldo con el que el tour ubica el ítem en el menú. El
 *   marcado en sí se resuelve por `href` en tiempo real, porque el anidamiento
 *   del menú cambia según el rol.
 * - En los `target` de los pasos, preferir `text` (el texto visible del botón
 *   o pestaña) sobre `testid`: el texto sobrevive refactors del markup. El
 *   tour resuelve en cascada selector → testid → texto y, si no encuentra
 *   nada, muestra el paso como tarjeta sin marcar (nunca marca algo al azar).
 */

// ─────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────

export interface TourTarget {
  /**
   * Ruta de un módulo, para que el tour ubique su acceso en el menú lateral en
   * tiempo real. Es la forma correcta de marcar el menú: el anidamiento cambia
   * según el rol (para un admin "Productos" vive dentro de Panorámica Market,
   * para un vendedor está en el primer nivel), así que un selector fijo se
   * equivocaría en la mitad de los roles. Si el módulo está dentro de un grupo
   * cerrado, el tour marca el grupo y, al abrirse, salta al ítem.
   */
  navHref?: string;
  /** Selector CSS exacto. Máxima prioridad. */
  selector?: string;
  /** data-testid del elemento. */
  testid?: string;
  /** Texto visible del elemento (botón, pestaña, enlace). Insensible a mayúsculas/acentos. */
  text?: string;
  /** Acota la búsqueda por texto a un tipo de control. */
  as?: "button" | "tab" | "link" | "field" | "any";
}

export interface GuideStep {
  /** Instrucción en imperativo. Una sola acción por paso. */
  title: string;
  /** Detalle: qué esperar, qué escribir, qué revisar antes de seguir. */
  detail?: string;
  /** Ruta en la que debe estar el usuario para este paso. */
  route?: string;
  /** Qué marcar en pantalla. Sin target, el paso se muestra como tarjeta centrada. */
  target?: TourTarget;
  /**
   * El clic lo tiene que dar el usuario: el tour marca el elemento y espera,
   * sin navegar por su cuenta. Se usa en los pasos que abren el módulo desde
   * el menú, donde el objetivo pedagógico ES el clic.
   */
  manual?: boolean;
}

export interface ModuleGuide {
  id: string;
  title: string;
  /** Frases con las que un usuario pediría esta guía (para búsqueda difusa). */
  intent: string[];
  /** Si es false, la guía no arranca con los pasos de navegación del menú. */
  fromMenu?: boolean;
  steps: GuideStep[];
}

export interface ModuleSection {
  label: string;
  what: string;
  /** value de la pestaña, cuando la sección es un tab. */
  tab?: string;
}

export interface ModuleDef {
  id: string;
  label: string;
  href: string;
  /** Clave de shared/permissions.ts que gobierna el acceso. null = abierto. */
  permission: string | null;
  group: string;
  /** Ubicación en el menú. null = no aparece en el sidebar. */
  nav: { label: string; parentLabel?: string } | null;
  /** Para qué sirve, en una o dos frases, sin jerga. */
  purpose: string;
  /** Quién lo usa en el día a día. */
  whoUses: string;
  sections?: ModuleSection[];
  keyTerms?: { term: string; meaning: string }[];
  /** Trampas y cosas que confunden a los usuarios nuevos. */
  gotchas?: string[];
  guides?: ModuleGuide[];
}

// ─────────────────────────────────────────────────────────────────
// Helpers de navegación
// ─────────────────────────────────────────────────────────────────

/** Paso para llegar al módulo desde el menú lateral. */
export function navStepsFor(mod: ModuleDef): GuideStep[] {
  if (!mod.nav) {
    return [
      {
        title: `Abre la dirección ${mod.href}`,
        detail: `${mod.label} no tiene acceso directo en el menú lateral. Se entra desde donde está embebido o escribiendo la ruta en el navegador.`,
      },
    ];
  }
  return [
    {
      title: `Entra a "${mod.nav.label}" en el menú lateral`,
      detail: mod.nav.parentLabel
        ? `Está dentro del grupo "${mod.nav.parentLabel}": ábrelo y haz clic en "${mod.nav.label}".`
        : undefined,
      route: mod.href,
      target: { navHref: mod.href, text: mod.nav.label },
      manual: true,
    },
  ];
}

/** Guía de orientación generada automáticamente para cualquier módulo. */
export function orientationGuide(mod: ModuleDef): ModuleGuide {
  const steps: GuideStep[] = [...navStepsFor(mod)];
  for (const section of mod.sections || []) {
    steps.push({
      title: section.tab ? `Pestaña "${section.label}"` : section.label,
      detail: section.what,
      route: mod.href,
      target: section.tab
        ? { testid: `tab-${section.tab}`, text: section.label, as: "tab" }
        : { text: section.label, as: "any" },
    });
  }
  return {
    id: `${mod.id}::orientacion`,
    title: `Dónde está y qué tiene ${mod.label}`,
    intent: [
      `donde esta ${mod.label}`,
      `como entro a ${mod.label}`,
      `que es ${mod.label}`,
      `para que sirve ${mod.label}`,
      `recorreme ${mod.label}`,
    ],
    fromMenu: false,
    steps,
  };
}

// ─────────────────────────────────────────────────────────────────
// Catálogo de módulos
// ─────────────────────────────────────────────────────────────────

export const MODULE_MAP: ModuleDef[] = [
  // ══════════════ GENERAL ══════════════
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    permission: "dashboard",
    group: "General",
    nav: { label: "Dashboard" },
    purpose:
      "Pantalla de entrada con las métricas de venta del período: venta acumulada, avance de meta, clientes, y desglose por segmento, sucursal, vendedor y producto.",
    whoUses:
      "Admin, supervisor y encargado de área para mirar el negocio completo. El vendedor ve el mismo tablero pero fijado a sus propios datos.",
    keyTerms: [
      { term: "Período", meaning: "Mes que se está mirando (formato YYYY-MM). Casi todos los números del sistema dependen del período seleccionado." },
      { term: "Segmento", meaning: "Agrupación comercial de clientes (FERRETERIAS, MCT, etc.)." },
      { term: "Meta", meaning: "Objetivo de venta del período; se configura en Configuración → Gestión de Metas." },
    ],
    gotchas: [
      "Si los números se ven en cero, lo primero es revisar el período seleccionado, no asumir que falta data.",
      "El vendedor no puede ver datos de otros vendedores: el tablero se autofija a su cartera.",
    ],
    guides: [
      {
        id: "leer-dashboard",
        title: "Leer el dashboard y cambiar de período",
        intent: ["como leo el dashboard", "cambiar periodo", "ver ventas del mes", "no me cuadran las ventas", "entender el tablero"],
        steps: [
          {
            title: "Ubica el selector de período",
            detail: "Está en la cabecera del tablero. Todo lo que ves abajo corresponde al período elegido.",
            route: "/",
          },
          {
            title: "Elige el mes que quieres analizar",
            detail: "Al cambiarlo se recargan las tarjetas de venta, el avance de meta y los desgloses.",
            route: "/",
          },
          {
            title: "Revisa primero la tarjeta de venta del período y el avance de meta",
            detail: "Ese par te dice si el mes va bien o mal antes de entrar a los detalles.",
            route: "/",
          },
          {
            title: "Baja a los desgloses para encontrar la causa",
            detail: "Segmento, sucursal, vendedor y producto. Ahí se ve qué explica la subida o la caída.",
            route: "/",
          },
        ],
      },
    ],
  },

  {
    id: "tareas",
    label: "Panel de Trabajo",
    href: "/tareas",
    permission: null,
    group: "Operación diaria",
    nav: { label: "Panel de Trabajo" },
    purpose:
      "Centro de trabajo diario: tareas propias y asignadas, seguimiento comercial de clientes, promesas de compra, obras en construcción, CRM, rutas comerciales, visitas técnicas y calendario, todo en pestañas de una misma pantalla.",
    whoUses: "Vendedores y supervisores todos los días; marketing para sus tareas; admin para supervisar.",
    sections: [
      { label: "Tareas", tab: "tareas", what: "Tus tareas y las que te asignaron: crear, completar, filtrar y buscar." },
      { label: "Seguimiento", tab: "seguimiento", what: "Seguimiento comercial de la cartera: qué clientes hay que contactar y qué se les prometió. En Construcción se abre en dos vistas: Clientes y Obras (el resumen de cada obra con su ficha y su bitácora)." },
      { label: "Estimación", tab: "estimacion", what: "Estimación de venta del período por cliente." },
      { label: "Obras", tab: "obras", what: "Control de obras de construcción: pedidos y avances por producto." },
      { label: "CRM", tab: "crm", what: "Ficha de seguimiento de clientes. Es el único acceso al CRM: no está en el menú lateral." },
      { label: "Rutas Comerciales", tab: "rutas-comerciales", what: "Planificación de rutas de visita a clientes." },
      { label: "Visitas Técnicas", tab: "visitas-tecnicas", what: "Visitas técnicas a obra. Es el acceso oficial: tampoco está en el menú lateral." },
      { label: "Calendario", tab: "calendario", what: "Vista de calendario de tareas y compromisos." },
    ],
    keyTerms: [
      { term: "Promesa de compra", meaning: "Compromiso de compra registrado sobre un cliente, con monto y fecha. Alimenta la estimación del período." },
      { term: "Obra", meaning: "Proyecto de construcción al que se le hace seguimiento de pedidos y avances por producto." },
      { term: "Bitácora de la obra", meaning: "El relato de lo que pasa en terreno: visitas, avances, pedidos comprometidos y problemas. Se escribe desde Seguimiento → Obras, al abrir una obra." },
    ],
    gotchas: [
      "CRM y Visitas Técnicas ya no están en el menú lateral: se entra por las pestañas de este panel. Si un usuario los busca en el menú, no los va a encontrar.",
      "Las pestañas visibles dependen del rol: un vendedor no ve las mismas que un supervisor.",
    ],
    guides: [
      {
        id: "crear-tarea",
        title: "Crear una tarea",
        intent: ["crear tarea", "nueva tarea", "asignar tarea", "como agrego una tarea", "anotar pendiente"],
        steps: [
          { title: 'Quédate en la pestaña "Tareas"', route: "/tareas", target: { testid: "tab-tareas", text: "Tareas", as: "tab" } },
          {
            title: "Haz clic en el botón para crear tarea",
            detail: "Se abre el formulario de la tarea nueva.",
            route: "/tareas",
            target: { testid: "button-create-task", text: "Nueva tarea", as: "button" },
          },
          {
            title: "Escribe el título y, si corresponde, asígnala",
            detail: "El título es lo único obligatorio. Si la tarea es para otra persona, elige el responsable; si es tuya, déjalo en blanco.",
            route: "/tareas",
          },
          {
            title: "Pon fecha de vencimiento",
            detail: "Sin fecha la tarea no aparece en el calendario ni en los recordatorios.",
            route: "/tareas",
          },
          { title: "Guarda la tarea", detail: "Queda al inicio del listado y, si la asignaste, le llega notificación a esa persona.", route: "/tareas" },
        ],
      },
      {
        id: "completar-tarea",
        title: "Marcar una tarea como completada",
        intent: ["completar tarea", "cerrar tarea", "terminar pendiente", "marcar lista"],
        steps: [
          { title: 'Entra a la pestaña "Tareas"', route: "/tareas", target: { testid: "tab-tareas", text: "Tareas", as: "tab" } },
          { title: "Busca la tarea en el listado", detail: "Puedes escribir en el buscador para filtrar.", route: "/tareas" },
          {
            title: "Marca la tarea como completada",
            detail: "El botón de completar está en la fila de la tarea.",
            route: "/tareas",
            target: { testid: "button-complete-task", text: "Completar", as: "button" },
          },
        ],
      },
      {
        id: "registrar-promesa",
        title: "Registrar una promesa de compra",
        intent: ["promesa de compra", "registrar compromiso", "el cliente me prometio", "estimacion de venta", "cargar promesa"],
        steps: [
          {
            title: 'Entra a la pestaña "Seguimiento"',
            route: "/tareas",
            target: { testid: "tab-seguimiento", text: "Seguimiento", as: "tab" },
          },
          {
            title: "Haz clic en crear una promesa nueva",
            route: "/tareas",
            target: { testid: "button-nueva-promesa", text: "Nueva promesa", as: "button" },
          },
          { title: "Elige el cliente", detail: "Busca por nombre o RUT.", route: "/tareas" },
          { title: "Escribe el monto prometido y la fecha comprometida", detail: "Ese monto es el que alimenta la estimación del período.", route: "/tareas" },
          {
            title: "Guarda la promesa",
            route: "/tareas",
            target: { testid: "button-guardar-promesa", text: "Guardar", as: "button" },
          },
        ],
      },
      {
        id: "abrir-crm",
        title: "Abrir el CRM de un cliente",
        intent: ["donde esta el crm", "seguimiento de clientes", "abrir crm", "no encuentro el crm", "ficha de seguimiento"],
        steps: [
          {
            title: 'Entra a la pestaña "CRM"',
            detail: "El CRM no tiene ítem propio en el menú lateral: vive acá dentro del Panel de Trabajo.",
            route: "/tareas",
            target: { testid: "tab-crm", text: "CRM", as: "tab" },
          },
          { title: "Busca el cliente en el listado", route: "/tareas" },
          { title: "Abre la ficha para ver y registrar interacciones", detail: "Ahí queda la bitácora de contactos, tareas y compromisos del cliente.", route: "/tareas" },
        ],
      },
      {
        id: "abrir-visitas-tecnicas",
        title: "Abrir las visitas técnicas",
        intent: ["visitas tecnicas", "donde estan las visitas", "agendar visita tecnica", "no encuentro visitas tecnicas"],
        steps: [
          {
            title: 'Entra a la pestaña "Visitas Técnicas"',
            detail: "Igual que el CRM, salió del menú lateral y vive en este panel.",
            route: "/tareas",
            target: { testid: "tab-visitas-tecnicas", text: "Visitas Técnicas", as: "tab" },
          },
          { title: "Revisa las visitas programadas o crea una nueva", route: "/tareas" },
        ],
      },
    ],
  },

  // ══════════════ COMERCIAL ══════════════
  {
    id: "tomador_pedidos",
    label: "Tomador de Pedidos",
    href: "/tomador-pedidos-v2",
    permission: "tomador_pedidos",
    group: "Comercial",
    nav: { label: "Tomador de Pedidos" },
    purpose:
      "Herramienta para armar pedidos y presupuestos: se elige el cliente, se cargan productos con su precio, y se genera el documento en PDF.",
    whoUses: "Vendedores en terreno y recepción. Es el módulo más usado por la fuerza de venta.",
    sections: [
      { label: "Cliente", tab: "client", what: "Buscar el cliente existente por nombre o RUT, o crear uno nuevo." },
      { label: "Productos", tab: "products", what: "Buscar productos de la lista de precios y agregarlos con cantidad y precio." },
      { label: "Carrito", tab: "cart", what: "Revisar el pedido armado, ajustar cantidades y descuentos, y emitirlo." },
    ],
    keyTerms: [
      { term: "Tier de precio", meaning: "Nivel de precio que se le aplica al cliente. Por defecto es precio lista." },
      { term: "Precio Directo", meaning: "Modo en que escribes el precio final a mano." },
      { term: "Cálculo (Costo + Utilidad)", meaning: "Modo en que el precio se calcula desde el costo más el margen que definas." },
      { term: "Presupuesto", meaning: "Cotización formal, con PDF, que todavía no es una nota de venta." },
    ],
    gotchas: [
      "Siempre elige el cliente primero: los precios y el crédito disponible dependen de él.",
      "Existe un tomador clásico (/tomador-pedidos) y el v2 del menú. Son la misma página en dos variantes; el respaldo es el clásico.",
      "Antes de cargar productos conviene revisar el crédito del cliente: si está bloqueado, el pedido no va a avanzar.",
    ],
    guides: [
      {
        id: "crear-pedido",
        title: "Armar un pedido de principio a fin",
        intent: [
          "como hago un pedido",
          "crear pedido",
          "tomar un pedido",
          "hacer una cotizacion",
          "generar presupuesto",
          "cargar productos a un cliente",
        ],
        steps: [
          {
            title: 'Quédate en la pestaña "Cliente"',
            route: "/tomador-pedidos-v2",
            target: { text: "Cliente", as: "tab" },
          },
          {
            title: "Abre el buscador de clientes",
            detail: "Busca por nombre o RUT. Si el cliente no existe, más abajo verás cómo crearlo.",
            route: "/tomador-pedidos-v2",
            target: { testid: "button-open-client-search", text: "Buscar cliente", as: "button" },
          },
          {
            title: "Selecciona el cliente y revisa su ficha",
            detail: "Confirma crédito disponible y deuda antes de seguir. Si está sin crédito, avisa a Finanzas.",
            route: "/tomador-pedidos-v2",
            target: { testid: "button-ficha-cliente", text: "Ficha", as: "button" },
          },
          {
            title: 'Pasa a la pestaña "Productos"',
            route: "/tomador-pedidos-v2",
            target: { text: "Productos", as: "tab" },
          },
          {
            title: "Busca cada producto por nombre o código y agrégalo",
            detail: "Un producto suele tener varias variantes de color y formato: fíjate en el código y la unidad antes de agregar.",
            route: "/tomador-pedidos-v2",
          },
          {
            title: "Define cantidad y precio de cada línea",
            detail: 'Con "Precio Directo" escribes el precio final; con "Cálculo (Costo + Utilidad)" lo calculas desde el costo más el margen.',
            route: "/tomador-pedidos-v2",
          },
          {
            title: 'Pasa a la pestaña "Carrito"',
            detail: "Acá se revisa el pedido completo antes de emitirlo.",
            route: "/tomador-pedidos-v2",
            target: { text: "Carrito", as: "tab" },
          },
          {
            title: "Revisa totales, descuento e IVA",
            detail: "Verifica línea por línea. Después de emitir, corregir cuesta mucho más.",
            route: "/tomador-pedidos-v2",
          },
          {
            title: "Emite el pedido o presupuesto",
            detail: "Se genera el documento y su PDF, que puedes enviar al cliente.",
            route: "/tomador-pedidos-v2",
          },
        ],
      },
      {
        id: "cliente-nuevo",
        title: "Crear un cliente nuevo desde el tomador",
        intent: ["cliente nuevo", "el cliente no existe", "crear cliente", "validar rut", "no encuentro el cliente"],
        steps: [
          { title: 'Quédate en la pestaña "Cliente"', route: "/tomador-pedidos-v2", target: { text: "Cliente", as: "tab" } },
          {
            title: "Escribe el RUT y valídalo",
            detail: "La validación te dice si el cliente ya existe en el sistema. Así se evitan clientes duplicados.",
            route: "/tomador-pedidos-v2",
            target: { testid: "button-check-rut", text: "Validar", as: "button" },
          },
          {
            title: "Si no existe, créalo con los datos mínimos",
            detail: "Razón social, RUT y contacto. Dirección y giro se pueden completar después desde Clientes.",
            route: "/tomador-pedidos-v2",
            target: { testid: "button-create-quote-new-client", text: "Crear", as: "button" },
          },
          { title: "Sigue con los productos como en un pedido normal", route: "/tomador-pedidos-v2", target: { text: "Productos", as: "tab" } },
        ],
      },
    ],
  },

  {
    id: "productos",
    label: "Productos",
    href: "/productos",
    permission: "productos",
    group: "Comercial",
    nav: { label: "Productos" },
    purpose:
      "Catálogo maestro: lista de precios, catálogo del ERP, agrupación comercial, inventario, fletes, categorías, SKUs, segmentos y datos SEO para la tienda.",
    whoUses: "Admin y supervisor para mantener precios y catálogo; vendedores para consultar precios y fichas.",
    sections: [
      { label: "Lista de Precios", tab: "lista-precios", what: "Precios oficiales por producto. Es la fuente de verdad para cotizar." },
      { label: "Catálogo SAP", tab: "sap", what: "Productos tal como vienen del ERP." },
      { label: "Agrupación Comercial", tab: "grouped", what: "Productos agrupados por familia comercial." },
      { label: "Inventario", tab: "inventario", what: "Stock disponible por producto." },
      { label: "Fletes", tab: "fletes", what: "Costos de flete asociados." },
      { label: "Categorías y Etiquetas", tab: "categorias", what: "Categorías y tags que ordenan el catálogo de la tienda." },
      { label: "SKUs Disponibles", tab: "skus", what: "Códigos disponibles para publicar." },
      { label: "Segmentos", tab: "segments", what: "Relación producto ↔ segmento de cliente." },
      { label: "SEO", tab: "seo", what: "Título, descripción e imagen que usa la tienda pública." },
    ],
    keyTerms: [
      { term: "SKU / código", meaning: "Identificador único del producto. Es lo que hay que mirar cuando hay variantes de color o formato." },
      { term: "Ficha técnica", meaning: "Datos técnicos del producto: rendimiento, dilución, secado, usos." },
    ],
    gotchas: [
      "Los buscadores de código del sistema consultan la lista de precios y los productos de la tienda, no una tabla genérica de productos: si un código no aparece, es porque no está en esas fuentes.",
      'Ver costos y márgenes dentro de Productos requiere el permiso "Costos y márgenes de productos". Sin él se muestra la vista de vendedor, sin costos.',
    ],
    guides: [
      {
        id: "buscar-precio",
        title: "Buscar el precio de un producto",
        intent: ["cuanto vale un producto", "buscar precio", "consultar lista de precios", "precio de venta", "buscar sku"],
        steps: [
          {
            title: 'Entra a la pestaña "Lista de Precios"',
            route: "/productos",
            target: { text: "Lista de Precios", as: "tab" },
          },
          {
            title: "Escribe el nombre o el código en el buscador",
            detail: "Si el producto tiene variantes, van a aparecer varias filas: cada color y formato es un código distinto.",
            route: "/productos",
          },
          { title: "Confirma código, unidad y precio de la fila correcta", detail: "La unidad (UN, LT, GL, KG) cambia el precio: revísala siempre.", route: "/productos" },
        ],
      },
      {
        id: "actualizar-precio",
        title: "Actualizar el precio de un producto",
        intent: ["cambiar precio", "actualizar precio", "subir precios", "modificar lista de precios"],
        steps: [
          { title: 'Entra a la pestaña "Lista de Precios"', route: "/productos", target: { text: "Lista de Precios", as: "tab" } },
          { title: "Busca el producto por código", route: "/productos" },
          {
            title: "Escribe el precio nuevo",
            route: "/productos",
            target: { testid: "input-new-price", as: "field" },
          },
          {
            title: "Confirma el cambio",
            detail: "El precio nuevo queda vigente para las cotizaciones siguientes; los documentos ya emitidos no cambian.",
            route: "/productos",
            target: { testid: "button-update-price", text: "Actualizar", as: "button" },
          },
        ],
      },
      {
        id: "publicar-en-market",
        title: "Publicar un producto en Panorámica Market",
        intent: ["publicar producto", "subir producto a la tienda", "mostrar producto en market", "activar producto ecommerce"],
        steps: [
          { title: "Busca el producto en el catálogo", route: "/productos" },
          {
            title: "Abre su configuración de tienda",
            detail: "Ahí se define precio de tienda, slug, categoría e imágenes.",
            route: "/productos",
          },
          {
            title: "Completa precio, categoría y slug",
            detail: "El slug es la dirección con la que el producto queda accesible en la tienda pública.",
            route: "/productos",
            target: { testid: "input-ecom-price", as: "field" },
          },
          {
            title: "Activa el producto",
            detail: "Sin activarlo no se ve en la tienda, aunque tenga precio e imágenes.",
            route: "/productos",
            target: { testid: "switch-ecom-active", as: "any" },
          },
          {
            title: "Guarda los cambios",
            route: "/productos",
            target: { testid: "button-save-ecom", text: "Guardar", as: "button" },
          },
          {
            title: 'Completa el SEO en la pestaña "SEO"',
            detail: "Título, descripción e imagen: es lo que ve Google y lo que aparece al compartir el link.",
            route: "/productos",
            target: { text: "SEO", as: "tab" },
          },
        ],
      },
    ],
  },

  {
    id: "clientes",
    label: "Clientes",
    href: "/clientes",
    permission: "clientes",
    group: "Comercial",
    nav: { label: "Clientes" },
    purpose:
      "Listado y ficha de clientes: datos de contacto, segmento, crédito disponible, deuda e historial de compras.",
    whoUses: "Vendedores para su cartera; admin, supervisor y recepción para todos los clientes.",
    keyTerms: [
      { term: "Crédito disponible", meaning: "Cuánto puede comprar el cliente a crédito hoy. Si está en cero, el pedido queda frenado." },
      { term: "Segmento", meaning: "Clasificación comercial del cliente; define precios y campañas." },
    ],
    gotchas: [
      "El vendedor solo ve su propia cartera: no es un error si un cliente no le aparece.",
      "El seguimiento comercial del cliente (CRM) no está acá: vive en el Panel de Trabajo → CRM.",
    ],
    guides: [
      {
        id: "ver-ficha-cliente",
        title: "Revisar la ficha de un cliente",
        intent: ["ficha del cliente", "ver datos de un cliente", "cuanto credito tiene", "deuda del cliente", "buscar cliente"],
        steps: [
          { title: "Escribe el nombre o RUT en el buscador", route: "/clientes" },
          { title: "Abre el cliente del listado", route: "/clientes" },
          {
            title: "Revisa crédito y deuda antes de venderle",
            detail: "Es el chequeo que evita pedidos que después se caen en Finanzas.",
            route: "/clientes",
          },
          { title: "Mira el historial de compras", detail: "Sirve para saber qué compra habitualmente y detectar caídas de consumo.", route: "/clientes" },
        ],
      },
    ],
  },

  {
    id: "clientes.seguimiento",
    label: "CRM / Seguimiento de Clientes",
    href: "/seguimiento-clientes",
    permission: "clientes.seguimiento",
    group: "Comercial",
    nav: null,
    purpose: "Seguimiento comercial de la cartera: bitácora de contactos, compromisos y estado de cada cliente.",
    whoUses: "Vendedores y supervisores que hacen gestión de cartera.",
    gotchas: [
      "No tiene ítem en el menú lateral: se entra por Panel de Trabajo → pestaña CRM. La ruta directa sigue funcionando.",
    ],
    guides: [],
  },

  {
    id: "clientes.ayuda_memoria",
    label: "Ayuda Memoria",
    href: "/ayuda-memoria",
    permission: "clientes.ayuda_memoria",
    group: "Comercial",
    nav: { label: "Ayuda Memoria" },
    purpose: "Resumen rápido de cada cliente para llevar a terreno: lo esencial en una vista.",
    whoUses: "Vendedores antes de salir a visitar.",
    guides: [],
  },

  {
    id: "seguimiento_pedidos",
    label: "Pedidos",
    href: "/seguimiento-pedidos",
    permission: "seguimiento_pedidos",
    group: "Comercial",
    nav: { label: "Pedidos" },
    purpose:
      "Listado de los pedidos del ERP con sus KPIs, filtros y detalle. Los pedidos que entraron por Panorámica Market quedan destacados.",
    whoUses: "Vendedores para seguir sus propios pedidos.",
    keyTerms: [
      { term: "NVV", meaning: "Nota de venta: el pedido ya comprometido, pendiente de facturar." },
      { term: "GDV", meaning: "Guía de despacho: la mercadería que salió, pendiente de facturar." },
    ],
    gotchas: ["El listado se filtra automáticamente por el vendedor logueado; es la misma vista que el admin ve completa en Market → Pedidos."],
    guides: [
      {
        id: "seguir-pedido",
        title: "Seguir el estado de un pedido",
        intent: ["donde va mi pedido", "estado del pedido", "ya se facturo", "el cliente pregunta por su pedido", "seguimiento de pedido"],
        steps: [
          { title: "Busca el pedido por cliente o número de documento", route: "/seguimiento-pedidos" },
          {
            title: "Mira el estado del documento",
            detail: "El recorrido normal es nota de venta → facturación → despacho.",
            route: "/seguimiento-pedidos",
          },
          { title: "Abre el detalle para ver líneas y fechas", route: "/seguimiento-pedidos" },
        ],
      },
    ],
  },

  {
    id: "mis_pedidos",
    label: "Mis Pedidos",
    href: "/mis-pedidos",
    permission: "mis_pedidos",
    group: "Comercial",
    nav: { label: "Mis Pedidos" },
    purpose: "Pedidos propios del usuario, con su estado.",
    whoUses: "Vendedores y clientes del portal.",
    guides: [],
  },

  {
    id: "marketing",
    label: "Marketing",
    href: "/marketing",
    permission: "marketing",
    group: "Comercial",
    nav: { label: "Marketing" },
    purpose:
      "Panel del área de marketing: tablero, tareas propias, solicitudes que llegan del resto de la empresa, email marketing, inventario de material, gastos, presupuesto y proveedores.",
    whoUses: "Equipo de marketing; vendedores y supervisores para pedir material o piezas.",
    sections: [
      { label: "Dashboard", tab: "dashboard", what: "Estado general del área." },
      { label: "Mis tareas", tab: "mis-tareas", what: "Tareas asignadas al usuario dentro de marketing." },
      { label: "Solicitudes", tab: "solicitudes", what: "Pedidos de material o piezas que hacen otras áreas." },
      { label: "Email Marketing", tab: "email-marketing", what: "Campañas de correo masivo. Es el acceso a Campañas: no está en el menú lateral." },
      { label: "Inventario", tab: "inventario", what: "Stock de material promocional." },
      { label: "Gastos", tab: "gastos", what: "Gastos del área." },
      { label: "Presupuesto", tab: "presupuesto", what: "Presupuesto de marketing y su consumo." },
      { label: "Proveedores", tab: "proveedores", what: "Proveedores del área." },
    ],
    gotchas: ["Email Marketing (Campañas) salió del menú lateral y vive como pestaña acá."],
    guides: [
      {
        id: "solicitud-marketing",
        title: "Pedirle algo a Marketing",
        intent: ["solicitar material", "pedir piezas graficas", "solicitud a marketing", "necesito un afiche", "pedir apoyo de marketing"],
        steps: [
          {
            title: 'Entra a la pestaña "Solicitudes"',
            route: "/marketing",
            target: { testid: "tab-solicitudes", text: "Solicitudes", as: "tab" },
          },
          { title: "Crea una solicitud nueva", route: "/marketing" },
          {
            title: "Describe qué necesitas, para cuándo y para qué cliente",
            detail: "Mientras más concreto el pedido, menos vueltas después.",
            route: "/marketing",
          },
          { title: "Envía la solicitud", detail: "Queda en la bandeja del área con su estado.", route: "/marketing" },
        ],
      },
    ],
  },

  {
    id: "mi_catalogo",
    label: "Mi Catálogo",
    href: "/catalogo",
    permission: "mi_catalogo",
    group: "Comercial",
    nav: { label: "Mi Catálogo" },
    purpose:
      "Catálogo público personal del vendedor: un link que puede compartir por WhatsApp y donde el cliente cotiza solo, atendido por el asistente virtual en modo tomador de pedidos.",
    whoUses: "Vendedores.",
    gotchas: [
      "El ítem del menú abre el catálogo en una pestaña nueva del navegador y solo aparece si el usuario tiene su enlace público configurado.",
      "En el catálogo público el asistente no ve datos internos: solo productos, precios y cotizaciones.",
    ],
    guides: [],
  },

  // ══════════════ PANORÁMICA MARKET ══════════════
  {
    id: "market.pedidos",
    label: "Pedidos Market",
    href: "/ecommerce-pedidos",
    permission: "market.pedidos",
    group: "Panorámica Market",
    nav: { label: "Pedidos", parentLabel: "Panorámica Market" },
    purpose: "Bandeja de pedidos que entran por el eCommerce, para revisarlos y procesarlos.",
    whoUses: "Recepción, admin y supervisor.",
    gotchas: ["El menú muestra un punto rojo cuando hay pedidos pendientes por atender."],
    guides: [
      {
        id: "procesar-pedido-market",
        title: "Procesar un pedido que llegó por la tienda",
        intent: ["pedido de la tienda", "pedido del market", "procesar pedido ecommerce", "llego un pedido web"],
        steps: [
          { title: "Abre el pedido pendiente del listado", route: "/ecommerce-pedidos" },
          { title: "Revisa cliente, productos y dirección de entrega", route: "/ecommerce-pedidos" },
          { title: "Confirma el pedido y avanza su estado", detail: "Desde acá sigue a facturación y despacho.", route: "/ecommerce-pedidos" },
        ],
      },
    ],
  },

  {
    id: "market.logistica",
    label: "Logística",
    href: "/logistica-rutas",
    permission: "market.logistica",
    group: "Panorámica Market",
    nav: { label: "Logística" },
    purpose: "Rutas de despacho y entregas: armar la ruta del día y seguir el estado de las entregas.",
    whoUses: "Logística y bodega, recepción, admin.",
    gotchas: ["En el sidebar del admin Logística está en el primer nivel; en otros roles aparece dentro del grupo Panorámica Market."],
    guides: [],
  },

  {
    id: "market.donde_comprar",
    label: "Dónde Comprar",
    href: "/donde-comprar-admin",
    permission: "market.donde_comprar",
    group: "Panorámica Market",
    nav: { label: "Dónde Comprar", parentLabel: "Panorámica Market" },
    purpose: "Administración del mapa público de puntos de venta: sucursales y ferreterías que aparecen en el sitio.",
    whoUses: "Marketing y admin.",
    guides: [],
  },

  {
    id: "market.mailing",
    label: "Mailing",
    href: "/mailing",
    permission: "market.mailing",
    group: "Panorámica Market",
    nav: { label: "Mailing", parentLabel: "Panorámica Market" },
    purpose:
      "Centro de comunicaciones transaccionales con el cliente: correos de venta, cobranza y notificaciones automáticas.",
    whoUses: "Admin, supervisor, encargado de área y recepción.",
    gotchas: [
      "Mailing es el correo transaccional (uno a uno, disparado por un hecho). Las campañas masivas son otro módulo: Campañas.",
    ],
    guides: [],
  },

  {
    id: "market.campanas",
    label: "Campañas Mailing",
    href: "/campanas",
    permission: "market.campanas",
    group: "Panorámica Market",
    nav: null,
    purpose:
      "Armar y enviar campañas de correo masivo (newsletters) eligiendo la audiencia: clientes, CRM, seguimiento, cotizador web, Market, inactivos, obras o distribuidores.",
    whoUses: "Marketing.",
    keyTerms: [
      { term: "Audiencia", meaning: "De dónde salen los correos de la campaña (clientes, CRM, cotizador web, inactivos, obras, distribuidores, etc.)." },
      { term: "Estados de campaña", meaning: "Borrador → Programada → Enviando → Enviada. También puede quedar Parcial, Falló o Cancelada." },
    ],
    gotchas: ["Se entra por Marketing → pestaña Email Marketing: no hay ítem en el menú lateral."],
    guides: [
      {
        id: "enviar-campana",
        title: "Crear y enviar una campaña de correo",
        intent: ["enviar campaña", "mandar newsletter", "correo masivo", "campaña de mailing", "email marketing"],
        fromMenu: false,
        steps: [
          {
            title: 'Entra a Marketing en el menú lateral',
            route: "/marketing",
            target: { navHref: "/marketing", text: "Marketing" },
            manual: true,
          },
          {
            title: 'Abre la pestaña "Email Marketing"',
            route: "/marketing",
            target: { testid: "tab-email-marketing", text: "Email Marketing", as: "tab" },
          },
          { title: "Crea una campaña nueva", detail: "Queda en estado Borrador hasta que la envíes o programes.", route: "/campanas" },
          { title: "Elige la audiencia", detail: "Define a quién le llega: clientes, CRM, cotizador web, inactivos, obras, distribuidores.", route: "/campanas" },
          { title: "Escribe asunto y contenido", detail: "El asunto es lo que decide si la abren: sé concreto.", route: "/campanas" },
          {
            title: "Manda una prueba a tu propio correo",
            detail: "Revisa cómo se ve en el celular antes de enviar a miles de personas.",
            route: "/campanas",
          },
          { title: "Envía o programa la campaña", detail: "Después pasa a Enviando y termina en Enviada; si algo falla queda Parcial o Falló.", route: "/campanas" },
        ],
      },
    ],
  },

  {
    id: "market.configuracion",
    label: "Configuración Market",
    href: "/ecommerce",
    permission: "market.configuracion",
    group: "Panorámica Market",
    nav: { label: "Configuración", parentLabel: "Panorámica Market" },
    purpose: "Ajustes de la tienda: catálogo publicado, categorías, ofertas y configuración general del eCommerce.",
    whoUses: "Admin y marketing.",
    guides: [],
  },

  // ══════════════ OPERACIÓN ══════════════
  {
    id: "inventario",
    label: "Inventario",
    href: "/inventario",
    permission: null,
    group: "Operación diaria",
    nav: { label: "Inventario" },
    purpose: "Stock de productos, con sincronización desde el ERP.",
    whoUses: "Bodega, recepción, vendedores que necesitan confirmar disponibilidad.",
    gotchas: ["Si el stock se ve raro, revisa primero cuándo fue la última sincronización antes de corregir a mano."],
    guides: [
      {
        id: "consultar-stock",
        title: "Consultar el stock de un producto",
        intent: ["hay stock", "cuanto stock queda", "consultar inventario", "disponibilidad de producto"],
        steps: [
          { title: "Busca el producto por nombre o código", route: "/inventario" },
          { title: "Revisa la cantidad disponible", detail: "Fíjate en la unidad de medida: no es lo mismo litros que unidades.", route: "/inventario" },
        ],
      },
    ],
  },

  {
    id: "gastos",
    label: "Rendición de Gastos",
    href: "/gastos-empresariales",
    permission: "gastos",
    group: "Finanzas",
    nav: { label: "Rendición de Gastos" },
    purpose:
      "Rendir gastos de la empresa con su respaldo, pedir fondos por rendir, y aprobar o rechazar lo que rinde el equipo.",
    whoUses: "Todo el que gasta plata de la empresa. Las aprobaciones las hacen jefaturas, admin y RRHH.",
    sections: [
      { label: "Dashboard", tab: "dashboard", what: "Resumen de gastos del período y estado de las aprobaciones." },
      { label: "Rendición de Gastos", tab: "rendicion", what: "Cargar gastos con su boleta y seguir su estado." },
      { label: "Gestión de Fondos", tab: "fondos", what: "Solicitar y administrar fondos por rendir." },
    ],
    keyTerms: [
      { term: "Fondo por rendir", meaning: "Plata que la empresa te adelanta y que después tienes que respaldar con boletas." },
      { term: "Rendición", meaning: "El gasto cargado con su respaldo, esperando aprobación." },
    ],
    gotchas: [
      "Sin foto o imagen del respaldo, la rendición se rechaza. Sacar la foto de la boleta en el momento ahorra el problema.",
      "Este módulo se agrega automáticamente al menú de casi todos los roles, así que si un usuario dice que no lo ve, revisa el permiso, no el sidebar.",
    ],
    guides: [
      {
        id: "rendir-gasto",
        title: "Rendir un gasto",
        intent: ["rendir gasto", "cargar boleta", "como rindo", "subir gasto", "declarar un gasto", "gasto de bencina"],
        steps: [
          {
            title: 'Entra a la pestaña "Rendición de Gastos"',
            route: "/gastos-empresariales",
            target: { testid: "tab-rendicion", text: "Rendición de Gastos", as: "tab" },
          },
          {
            title: "Haz clic para agregar un gasto",
            route: "/gastos-empresariales",
            target: { testid: "button-add-gasto", text: "Agregar", as: "button" },
          },
          {
            title: "Completa fecha, monto, categoría y motivo",
            detail: "El motivo tiene que explicar el gasto a alguien que no estuvo ahí.",
            route: "/gastos-empresariales",
            target: { testid: "input-motivo", as: "field" },
          },
          {
            title: "Adjunta la foto de la boleta",
            detail: "Es obligatoria. Sin respaldo el gasto se rechaza.",
            route: "/gastos-empresariales",
          },
          {
            title: "Envía la rendición",
            detail: "Queda pendiente de aprobación de tu jefatura.",
            route: "/gastos-empresariales",
          },
        ],
      },
      {
        id: "solicitar-fondo",
        title: "Solicitar un fondo por rendir",
        intent: ["pedir fondo", "solicitar fondo por rendir", "necesito plata para un viaje", "adelanto de dinero"],
        steps: [
          {
            title: 'Entra a la pestaña "Gestión de Fondos"',
            route: "/gastos-empresariales",
            target: { testid: "tab-fondos", text: "Gestión de Fondos", as: "tab" },
          },
          {
            title: "Haz clic en solicitar fondo",
            route: "/gastos-empresariales",
            target: { testid: "button-solicitar-fondo", text: "Solicitar", as: "button" },
          },
          {
            title: "Escribe el monto que necesitas",
            route: "/gastos-empresariales",
            target: { testid: "input-monto-solicitud", as: "field" },
          },
          {
            title: "Indica el motivo y la fecha en que lo vas a rendir",
            route: "/gastos-empresariales",
            target: { testid: "input-fecha-termino-solicitud", as: "field" },
          },
          {
            title: "Envía la solicitud",
            route: "/gastos-empresariales",
            target: { testid: "button-submit-solicitar-fondo", text: "Enviar", as: "button" },
          },
        ],
      },
      {
        id: "aprobar-gasto",
        title: "Aprobar o rechazar la rendición de alguien del equipo",
        intent: ["aprobar gasto", "rechazar rendicion", "revisar gastos del equipo", "autorizar gasto"],
        steps: [
          {
            title: 'Entra a la pestaña "Rendición de Gastos"',
            route: "/gastos-empresariales",
            target: { testid: "tab-rendicion", text: "Rendición de Gastos", as: "tab" },
          },
          {
            title: "Filtra o busca la rendición pendiente",
            route: "/gastos-empresariales",
            target: { testid: "input-search", as: "field" },
          },
          { title: "Abre el detalle y revisa el respaldo", detail: "Compara monto, fecha y motivo con la imagen de la boleta.", route: "/gastos-empresariales" },
          {
            title: "Aprueba o rechaza",
            detail: "Si rechazas, deja el motivo: la persona lo va a ver y tiene que poder corregirlo.",
            route: "/gastos-empresariales",
            target: { testid: "button-approve-detail", text: "Aprobar", as: "button" },
          },
        ],
      },
    ],
  },

  // ══════════════ FINANZAS ══════════════
  {
    id: "finanzas",
    label: "Finanzas",
    href: "/facturas",
    permission: "finanzas",
    group: "Finanzas",
    nav: { label: "Finanzas" },
    purpose:
      "Documentos y proyección del negocio: lista de precios, facturas, notas de venta, guías de despacho, proyección del mes, solicitudes de crédito y presupuesto de ventas.",
    whoUses: "Admin, supervisor, encargado de área, recepción y logística.",
    sections: [
      { label: "Lista de Precios", tab: "lista-precios", what: "Precios vigentes, para consulta desde Finanzas." },
      { label: "Facturas", tab: "facturas", what: "Facturas emitidas." },
      { label: "Notas de Venta", tab: "nvv", what: "NVV: pedidos comprometidos pendientes de facturar." },
      { label: "Guías Despacho", tab: "gdv", what: "GDV: mercadería despachada pendiente de facturar." },
      { label: "Proyección", tab: "proyeccion", what: "Cómo va a cerrar el mes según lo facturado y lo pendiente." },
      { label: "Solicitud Crédito", tab: "solicitud-credito", what: "Solicitudes de crédito de clientes, con sus antecedentes." },
      { label: "Presupuesto", tab: "presupuesto-ventas", what: "Presupuesto de ventas del período." },
    ],
    keyTerms: [
      { term: "NVV", meaning: "Nota de venta. Venta comprometida que todavía no se factura." },
      { term: "GDV", meaning: "Guía de despacho. Salió la mercadería, falta facturar." },
      { term: "Proyección", meaning: "Facturado + NVV + GDV pendientes: el cierre estimado del mes." },
    ],
    gotchas: ["NVV y GDV pendientes son plata comprometida que todavía no es venta facturada: no las sumes dos veces."],
    guides: [
      {
        id: "revisar-pendientes",
        title: "Revisar NVV y guías pendientes de facturar",
        intent: ["nvv pendientes", "guias pendientes", "que falta facturar", "cuanto hay comprometido", "gdv pendiente"],
        steps: [
          {
            title: 'Entra a la pestaña "Notas de Venta"',
            route: "/facturas",
            target: { text: "Notas de Venta", as: "tab" },
          },
          { title: "Revisa el total pendiente y su antigüedad", detail: "Una NVV vieja sin facturar es una alerta, no un dato.", route: "/facturas" },
          {
            title: 'Haz lo mismo en "Guías Despacho"',
            detail: "Mercadería que ya salió y no está facturada es el caso más urgente.",
            route: "/facturas",
            target: { text: "Guías Despacho", as: "tab" },
          },
          {
            title: 'Cierra el análisis en "Proyección"',
            detail: "Ahí ves el cierre estimado del mes con todo lo pendiente incluido.",
            route: "/facturas",
            target: { text: "Proyección", as: "tab" },
          },
        ],
      },
      {
        id: "solicitar-credito",
        title: "Cargar una solicitud de crédito de un cliente",
        intent: ["solicitud de credito", "el cliente quiere credito", "ampliar credito", "cargar antecedentes de credito"],
        steps: [
          {
            title: 'Entra a la pestaña "Solicitud Crédito"',
            route: "/facturas",
            target: { text: "Solicitud Crédito", as: "tab" },
          },
          {
            title: "Completa los datos de la empresa",
            detail: "Razón social, RUT, giro, dirección y contacto.",
            route: "/facturas",
            target: { testid: "input-razon-social", as: "field" },
          },
          {
            title: "Carga representante legal, bancos y socios",
            detail: "Los antecedentes bancarios son los que permiten evaluar el crédito.",
            route: "/facturas",
            target: { testid: "input-representante-nombre", as: "field" },
          },
          {
            title: "Indica el monto de crédito solicitado",
            route: "/facturas",
            target: { testid: "input-credito-solicitado", as: "field" },
          },
          {
            title: "Envía la solicitud",
            route: "/facturas",
            target: { testid: "button-submit-credito", text: "Enviar", as: "button" },
          },
        ],
      },
    ],
  },

  {
    id: "margen",
    label: "Margen",
    href: "/margen",
    permission: "margen",
    group: "Finanzas",
    nav: { label: "Margen" },
    purpose: "Análisis de márgenes: cuánto se gana realmente por producto y por venta, con el detalle de costos.",
    whoUses: "Admin y supervisor. Información sensible.",
    sections: [
      { label: "Dashboard", tab: "dashboard", what: "Margen global del período y su evolución." },
      { label: "Productos & costos", tab: "productos", what: "Margen por producto, con su costo." },
      { label: "ETL Costos", tab: "etl", what: "Estado de la carga de costos que alimenta el módulo." },
    ],
    gotchas: [
      "Es información sensible: no se comparte con vendedores ni clientes.",
      "Si un margen se ve imposible, revisa primero ETL Costos: probablemente el costo no cargó.",
    ],
    guides: [
      {
        id: "revisar-margen",
        title: "Revisar el margen del período",
        intent: ["ver margen", "cuanto estamos ganando", "margen por producto", "rentabilidad", "revisar costos"],
        steps: [
          { title: 'Parte en la pestaña "Dashboard"', route: "/margen", target: { text: "Dashboard", as: "tab" } },
          { title: "Mira el margen global y compáralo con el mes anterior", route: "/margen" },
          {
            title: 'Entra a "Productos & costos" para encontrar la causa',
            detail: "Ordena por margen: arriba y abajo están los casos que hay que mirar.",
            route: "/margen",
            target: { text: "Productos & costos", as: "tab" },
          },
          {
            title: 'Si algo no cuadra, revisa "ETL Costos"',
            detail: "Un costo no cargado deja el margen inflado o negativo.",
            route: "/margen",
            target: { text: "ETL Costos", as: "tab" },
          },
        ],
      },
    ],
  },

  {
    id: "rrhh.comisiones",
    label: "Comisiones",
    href: "/comisiones",
    permission: "rrhh.comisiones",
    group: "Recursos Humanos",
    nav: { label: "Comisiones" },
    purpose: "Cálculo de comisiones por vendedor sobre el margen facturado del período.",
    whoUses: "RRHH y admin. Información sensible.",
    gotchas: ["La comisión se calcula sobre margen facturado, no sobre venta bruta: es la confusión más común al explicarlo."],
    guides: [],
  },

  // ══════════════ POST-VENTA ══════════════
  {
    id: "postventa.reclamos",
    label: "Reclamos",
    href: "/reclamos-generales",
    permission: "postventa.reclamos",
    group: "Post-Venta",
    nav: { label: "Reclamos" },
    purpose:
      "Gestión de reclamos de clientes de punta a punta: se ingresa el reclamo con evidencia, se deriva al área responsable, se resuelve y se cierra.",
    whoUses:
      "Vendedores y recepción ingresan; laboratorio, producción, logística y las áreas responsables resuelven; jefaturas cierran.",
    sections: [
      { label: "Mis Reclamos", tab: "mis-reclamos", what: "Reclamos que te involucran, con su estado." },
      { label: "Estadísticas", tab: "estadisticas", what: "Volumen y tipo de reclamos, para ver patrones." },
    ],
    keyTerms: [
      { term: "Área responsable", meaning: "Área a la que se deriva el reclamo (producción, logística, aplicación, materia prima, colores, envase, etiqueta)." },
      { term: "Resolución", meaning: "Respuesta técnica del área, con la que el reclamo se puede cerrar." },
    ],
    gotchas: [
      "Sin evidencia (fotos, lote, documento) el área no puede resolver: cargarla al ingresar ahorra días.",
      "Es el único módulo que ven muchos roles de planta: para ellos el sistema es esta pantalla.",
    ],
    guides: [
      {
        id: "crear-reclamo",
        title: "Ingresar un reclamo de cliente",
        intent: ["crear reclamo", "ingresar reclamo", "el cliente reclamo", "producto malo", "problema con un producto", "registrar queja"],
        steps: [
          {
            title: "Haz clic en crear reclamo",
            route: "/reclamos-generales",
            target: { testid: "button-create-reclamo", text: "Nuevo reclamo", as: "button" },
          },
          {
            title: "Elige el cliente",
            detail: "Si el cliente no está en el listado, se puede agregar manualmente.",
            route: "/reclamos-generales",
          },
          {
            title: "Describe el problema con datos concretos",
            detail: "Producto, código, lote, cantidad afectada y qué pasó. Sin esos datos el área no puede analizar.",
            route: "/reclamos-generales",
          },
          {
            title: "Adjunta la evidencia",
            detail: "Fotos del producto, de la etiqueta y del defecto. Es lo que decide la rapidez de la respuesta.",
            route: "/reclamos-generales",
            target: { testid: "button-add-evidencia", text: "Evidencia", as: "button" },
          },
          {
            title: "Selecciona el área responsable",
            detail: "Es a quién le llega el reclamo para resolver.",
            route: "/reclamos-generales",
          },
          {
            title: "Envía el reclamo",
            route: "/reclamos-generales",
            target: { testid: "button-submit-reclamo", text: "Enviar", as: "button" },
          },
        ],
      },
      {
        id: "resolver-reclamo",
        title: "Responder un reclamo asignado a tu área",
        intent: ["resolver reclamo", "responder reclamo", "me asignaron un reclamo", "cargar resolucion"],
        steps: [
          {
            title: 'Entra a "Mis Reclamos"',
            route: "/reclamos-generales",
            target: { testid: "tab-mis-reclamos", text: "Mis Reclamos", as: "tab" },
          },
          { title: "Abre el reclamo que tienes asignado", route: "/reclamos-generales" },
          { title: "Revisa la evidencia y el detalle del cliente", route: "/reclamos-generales" },
          {
            title: "Carga la resolución técnica",
            detail: "Explica la causa y qué se va a hacer. Esa respuesta es la que se le comunica al cliente.",
            route: "/reclamos-generales",
            target: { testid: "button-submit-resolucion", text: "Resolución", as: "button" },
          },
          {
            title: "Deja el reclamo listo para cierre",
            detail: "El cierre formal lo hace la jefatura correspondiente.",
            route: "/reclamos-generales",
          },
        ],
      },
    ],
  },

  {
    id: "postventa.visitas",
    label: "Visitas Técnicas",
    href: "/visitas-tecnicas",
    permission: "postventa.visitas",
    group: "Post-Venta",
    nav: null,
    purpose: "Programación y registro de visitas técnicas a obra: qué se fue a ver, qué se encontró y qué quedó comprometido.",
    whoUses: "Técnicos de obra, laboratorio, supervisores.",
    gotchas: ["Salió del menú lateral: se entra por Panel de Trabajo → pestaña Visitas Técnicas. La ruta directa sigue activa."],
    guides: [],
  },

  // ══════════════ TINTOMETRÍA ══════════════
  {
    id: "tintometria.selector",
    label: "Selector Visual de Colores",
    href: "/tintometria/selector",
    permission: "tintometria.selector",
    group: "Tintometría",
    nav: { label: "Selector Visual", parentLabel: "Tintometría" },
    purpose: "Selector visual de colores para elegir y mostrarle el color al cliente.",
    whoUses: "Vendedores, laboratorio, clientes en mesón.",
    guides: [],
  },

  {
    id: "tintometria.calculadora",
    label: "Calculadora de Costos de Tintometría",
    href: "/tintometria/calculadora",
    permission: "tintometria.calculadora",
    group: "Tintometría",
    nav: { label: "Calcular Costos", parentLabel: "Tintometría" },
    purpose: "Calcular el costo de una preparación tintométrica según base, colorantes y formato.",
    whoUses: "Laboratorio y vendedores que cotizan color a pedido.",
    guides: [
      {
        id: "calcular-costo-color",
        title: "Calcular el costo de un color a pedido",
        intent: ["cuanto cuesta un color", "calcular tintometria", "costo de preparacion", "color a pedido"],
        steps: [
          { title: "Elige la base y el formato", route: "/tintometria/calculadora" },
          { title: "Carga los colorantes y sus cantidades", route: "/tintometria/calculadora" },
          { title: "Revisa el costo resultante antes de cotizar", detail: "Ese costo es el piso: el precio al cliente va sobre eso.", route: "/tintometria/calculadora" },
        ],
      },
    ],
  },

  {
    id: "tintometria.admin",
    label: "Administrar Datos de Tintometría",
    href: "/tintometria/admin",
    permission: "tintometria.admin",
    group: "Tintometría",
    nav: { label: "Administrar Datos", parentLabel: "Tintometría" },
    purpose: "Mantención de los datos base de tintometría: bases, colorantes, costos y fórmulas.",
    whoUses: "Laboratorio y admin.",
    gotchas: ["Al entrar a /tintometria el sistema redirige a esta pantalla."],
    guides: [],
  },

  // ══════════════ MANTENCIÓN (CMMS) ══════════════
  {
    id: "cmms.ordenes",
    label: "Órdenes de Trabajo",
    href: "/mantenciones",
    permission: "cmms.ordenes",
    group: "Mantención (CMMS)",
    nav: { label: "Órdenes de Trabajo", parentLabel: "Mantención" },
    purpose:
      "Órdenes de trabajo de mantención: se solicita el trabajo, se asigna, se ejecuta (iniciar, pausar, reanudar), se cargan gastos de materiales y se cierra con su resolución.",
    whoUses: "Mantención, jefe de planta, producción, logística y bodega.",
    keyTerms: [
      { term: "OT", meaning: "Orden de trabajo: la solicitud de mantención con su ciclo de vida completo." },
      { term: "Equipo crítico", meaning: "Máquina cuya falla detiene la planta; se administra en Equipos Críticos." },
    ],
    gotchas: [
      "Pausar el trabajo no es cerrarlo: la OT sigue abierta y contando.",
      "Los roles de planta llegan directo a este módulo al entrar al sistema.",
    ],
    guides: [
      {
        id: "crear-orden-trabajo",
        title: "Pedir una mantención (crear orden de trabajo)",
        intent: ["crear orden de trabajo", "solicitar mantencion", "se echo a perder una maquina", "reportar falla", "nueva ot"],
        steps: [
          {
            title: "Haz clic en nueva solicitud",
            route: "/mantenciones",
            target: { testid: "button-nueva-solicitud", text: "Nueva solicitud", as: "button" },
          },
          {
            title: "Selecciona el equipo afectado",
            route: "/mantenciones",
            target: { testid: "button-select-equipo", text: "Equipo", as: "button" },
          },
          {
            title: "Describe la falla y su urgencia",
            detail: "Di qué se ve, qué se escucha y si la máquina está detenida. Eso define la prioridad.",
            route: "/mantenciones",
          },
          {
            title: "Envía la solicitud",
            route: "/mantenciones",
            target: { testid: "button-submit-crear", text: "Crear", as: "button" },
          },
        ],
      },
      {
        id: "ejecutar-orden-trabajo",
        title: "Ejecutar y cerrar una orden de trabajo",
        intent: ["iniciar trabajo", "cerrar orden de trabajo", "terminar mantencion", "cargar gasto de materiales", "pausar ot"],
        steps: [
          { title: "Abre la orden asignada del listado", route: "/mantenciones" },
          {
            title: "Inicia el trabajo",
            detail: "Desde ahí empieza a contar el tiempo de la intervención.",
            route: "/mantenciones",
            target: { testid: "button-iniciar-trabajo", text: "Iniciar", as: "button" },
          },
          {
            title: "Si tienes que detenerte, usa pausar",
            detail: "Pausar deja constancia del motivo; no cierra la orden.",
            route: "/mantenciones",
            target: { testid: "button-pausar-trabajo", text: "Pausar", as: "button" },
          },
          {
            title: "Carga los materiales usados",
            detail: "Sin esto el costo de la mantención queda incompleto y el presupuesto miente.",
            route: "/mantenciones",
            target: { testid: "button-add-gasto", text: "Agregar gasto", as: "button" },
          },
          {
            title: "Envía la resolución para cerrar",
            detail: "Explica qué se hizo y qué quedó pendiente.",
            route: "/mantenciones",
            target: { testid: "button-enviar-resolucion", text: "Resolución", as: "button" },
          },
        ],
      },
    ],
  },

  {
    id: "cmms.dashboard",
    label: "Dashboard CMMS",
    href: "/cmms",
    permission: "cmms.dashboard",
    group: "Mantención (CMMS)",
    nav: { label: "Dashboard CMMS", parentLabel: "Mantención" },
    purpose: "Métricas y estado general de mantención: OT abiertas, atrasos, cumplimiento del plan.",
    whoUses: "Jefe de planta, mantención, supervisor.",
    guides: [],
  },

  {
    id: "cmms.mantenciones_planificadas",
    label: "Mantenciones Planificadas",
    href: "/cmms/mantenciones-planificadas",
    permission: "cmms.mantenciones_planificadas",
    group: "Mantención (CMMS)",
    nav: { label: "Mantenciones Planificadas", parentLabel: "Mantención" },
    purpose: "Planificación de las mantenciones del período y su avance.",
    whoUses: "Mantención y jefe de planta.",
    guides: [],
  },

  {
    id: "cmms.planes_preventivos",
    label: "Planes Preventivos",
    href: "/cmms/planes-preventivos",
    permission: "cmms.planes_preventivos",
    group: "Mantención (CMMS)",
    nav: { label: "Planes Preventivos", parentLabel: "Mantención" },
    purpose: "Definición de los planes de mantención preventiva por equipo y su frecuencia.",
    whoUses: "Mantención y jefe de planta.",
    guides: [],
  },

  {
    id: "cmms.equipos",
    label: "Equipos Críticos",
    href: "/cmms/equipos",
    permission: "cmms.equipos",
    group: "Mantención (CMMS)",
    nav: { label: "Equipos Críticos", parentLabel: "Mantención" },
    purpose: "Catastro de equipos de planta, con su criticidad e historial de intervenciones.",
    whoUses: "Mantención y jefe de planta.",
    guides: [],
  },

  {
    id: "cmms.proveedores",
    label: "Proveedores de Mantención",
    href: "/cmms/proveedores",
    permission: "cmms.proveedores",
    group: "Mantención (CMMS)",
    nav: { label: "Proveedores", parentLabel: "Mantención" },
    purpose: "Proveedores y servicios externos de mantención.",
    whoUses: "Mantención y jefe de planta.",
    guides: [],
  },

  {
    id: "cmms.presupuesto",
    label: "Presupuesto de Mantención",
    href: "/cmms/presupuesto",
    permission: "cmms.presupuesto",
    group: "Mantención (CMMS)",
    nav: { label: "Presupuesto", parentLabel: "Mantención" },
    purpose: "Presupuesto del área de mantención y cuánto se ha consumido.",
    whoUses: "Jefe de planta y admin.",
    guides: [],
  },

  {
    id: "cmms.gastos_materiales",
    label: "Gastos de Materiales",
    href: "/cmms/gastos-materiales",
    permission: "cmms.gastos_materiales",
    group: "Mantención (CMMS)",
    nav: { label: "Gastos de Materiales", parentLabel: "Mantención" },
    purpose: "Materiales y repuestos consumidos por las órdenes de trabajo.",
    whoUses: "Mantención y jefe de planta.",
    guides: [],
  },

  {
    id: "cmms.calendario",
    label: "Calendario de Mantenciones",
    href: "/cmms/calendario",
    permission: "cmms.calendario",
    group: "Mantención (CMMS)",
    nav: { label: "Calendario", parentLabel: "Mantención" },
    purpose: "Calendario de mantenciones programadas.",
    whoUses: "Todo el equipo de planta.",
    guides: [],
  },

  // ══════════════ ADMINISTRACIÓN ══════════════
  {
    id: "configuracion",
    label: "Configuración",
    href: "/configuracion",
    permission: "configuracion",
    group: "Administración",
    nav: { label: "Configuración" },
    purpose:
      "Centro de administración del sistema en pestañas: usuarios, roles y permisos, metas, monitor ETL, API keys, importación de datos, correos, WhatsApp e integraciones.",
    whoUses: "Admin. Algunas pestañas se pueden abrir a supervisor y encargado de área.",
    sections: [
      { label: "Gestión de Usuarios", tab: "usuarios", what: "Crear, editar y desactivar usuarios y su rol." },
      { label: "Roles y Permisos", tab: "roles", what: "Qué módulos ve cada rol. Es acá donde se resuelve un “no me aparece el módulo”." },
      { label: "Gestión de Metas", tab: "metas", what: "Metas de venta por vendedor y segmento." },
      { label: "Monitor ETL", tab: "etl", what: "Estado de las sincronizaciones con el ERP." },
      { label: "API Keys", tab: "api-keys", what: "Llaves de acceso programático. Sensible." },
      { label: "Importar Datos", tab: "importar", what: "Carga manual de datos al sistema. Sensible." },
      { label: "Correos", tab: "correos", what: "Notificaciones y plantillas de correo." },
      { label: "WhatsApp", tab: "whatsapp", what: "Integración de WhatsApp." },
      { label: "Integraciones", tab: "integraciones", what: "Integraciones con servicios externos." },
    ],
    keyTerms: [
      { term: "Permiso", meaning: "Llave que habilita un módulo. El menú lateral se arma con los permisos efectivos del usuario." },
      { term: "Override de usuario", meaning: "Permiso otorgado o quitado a una persona puntual, por encima de lo que dice su rol." },
    ],
    gotchas: [
      "El rol admin siempre tiene todos los permisos: no se puede bloquear a sí mismo.",
      "Los permisos de una persona = permisos de su rol + sus overrides personales. Si a alguien le falta un módulo, se revisa en ese orden.",
    ],
    guides: [
      {
        id: "crear-usuario",
        title: "Crear un usuario nuevo",
        intent: ["crear usuario", "dar de alta a alguien", "nuevo vendedor en el sistema", "agregar usuario", "dar acceso a una persona"],
        steps: [
          {
            title: 'Entra a la pestaña "Gestión de Usuarios"',
            route: "/configuracion",
            target: { text: "Gestión de Usuarios", as: "tab" },
          },
          { title: "Haz clic en crear usuario", route: "/configuracion" },
          {
            title: "Completa nombre, correo y rol",
            detail: "El rol define de entrada qué módulos va a ver: elígelo bien y después ajusta con permisos.",
            route: "/configuracion",
          },
          {
            title: "Si es vendedor, vincúlalo con su nombre de vendedor del ERP",
            detail: "Sin ese vínculo no ve sus ventas ni su cartera.",
            route: "/configuracion",
          },
          { title: "Guarda el usuario", route: "/configuracion" },
        ],
      },
      {
        id: "dar-permiso",
        title: "Habilitar un módulo para un rol o una persona",
        intent: [
          "no me aparece el modulo",
          "dar permiso",
          "habilitar modulo",
          "no puedo entrar a",
          "no veo el menu",
          "configurar permisos",
          "roles y permisos",
        ],
        steps: [
          {
            title: 'Entra a la pestaña "Roles y Permisos"',
            route: "/configuracion",
            target: { text: "Roles y Permisos", as: "tab" },
          },
          { title: "Elige el rol de la persona", detail: "Si el problema es de una sola persona, usa su override personal en vez de cambiar el rol completo.", route: "/configuracion" },
          {
            title: "Activa el permiso del módulo que falta",
            detail: "Cada permiso corresponde a un módulo o pestaña del sistema.",
            route: "/configuracion",
          },
          { title: "Guarda los cambios", route: "/configuracion" },
          {
            title: "Pídele a la persona que recargue la página",
            detail: "El menú lateral se arma con los permisos al cargar: sin recargar sigue viendo el menú viejo.",
            route: "/configuracion",
          },
        ],
      },
      {
        id: "configurar-meta",
        title: "Configurar la meta de venta de un vendedor",
        intent: ["configurar meta", "cambiar meta de venta", "meta del mes", "poner objetivo de venta"],
        steps: [
          {
            title: 'Entra a la pestaña "Gestión de Metas"',
            route: "/configuracion",
            target: { text: "Gestión de Metas", as: "tab" },
          },
          { title: "Elige el período", detail: "Las metas son por mes.", route: "/configuracion" },
          { title: "Carga la meta del vendedor o del segmento", route: "/configuracion" },
          { title: "Guarda", detail: "El avance de meta del dashboard se calcula contra este número.", route: "/configuracion" },
        ],
      },
    ],
  },

  {
    id: "config.usuarios",
    label: "Gestión de Usuarios",
    href: "/usuarios",
    permission: "config.usuarios",
    group: "Administración",
    nav: null,
    purpose: "Crear, editar y desactivar usuarios, con su rol y sus accesos.",
    whoUses: "Admin.",
    gotchas: ["Se usa normalmente como pestaña de Configuración; la ruta directa /usuarios existe igual."],
    guides: [],
  },

  {
    id: "config.metas",
    label: "Gestión de Metas",
    href: "/metas",
    permission: "config.metas",
    group: "Administración",
    nav: null,
    purpose: "Metas de venta por vendedor y por segmento, por período.",
    whoUses: "Admin y supervisor.",
    guides: [],
  },

  {
    id: "etl_monitor",
    label: "Monitor ETL",
    href: "/etl-monitor",
    permission: "etl_monitor",
    group: "Administración",
    nav: { label: "Monitor ETL" },
    purpose: "Estado de las sincronizaciones con el ERP: qué corrió, cuándo y si falló.",
    whoUses: "Admin y supervisor.",
    gotchas: ["Cuando alguien dice “los datos están mal”, este módulo es la primera parada: casi siempre es una sincronización caída."],
    guides: [
      {
        id: "revisar-etl",
        title: "Revisar si los datos están al día",
        intent: ["los datos estan mal", "no se actualizo", "falta informacion del erp", "revisar sincronizacion", "etl fallo"],
        steps: [
          { title: "Mira la última ejecución de cada proceso", route: "/etl-monitor" },
          {
            title: "Busca procesos con error o con fecha vieja",
            detail: "Un proceso que no corre hoy explica casi cualquier número raro del sistema.",
            route: "/etl-monitor",
          },
          { title: "Si hay un proceso caído, avisa a soporte con el nombre y la hora", route: "/etl-monitor" },
        ],
      },
    ],
  },

  {
    id: "config.apikeys",
    label: "API Keys",
    href: "/api-keys",
    permission: "config.apikeys",
    group: "Administración",
    nav: null,
    purpose: "Llaves de acceso programático a la API del sistema.",
    whoUses: "Solo admin.",
    gotchas: ["Es información sensible: una llave filtrada da acceso a los datos del sistema. No se comparte por chat ni por correo."],
    guides: [],
  },

  // ══════════════ HERRAMIENTAS ══════════════
  {
    id: "ai_assistant",
    label: "Panorámica AI",
    href: "/ai-assistant",
    permission: null,
    group: "Herramientas",
    // El layout tiene estilos para un ítem de menú del asistente, pero hoy
    // SIDEBAR_CONFIG no lo incluye para ningún rol: se entra por la ruta.
    nav: null,
    purpose:
      "El asistente virtual: responde sobre ventas, clientes, productos y cotizaciones con los datos reales del sistema, y enseña a usar cada módulo con guías paso a paso marcadas en pantalla.",
    whoUses: "Todos, según su rol: el asistente solo muestra datos y módulos que el usuario tiene permitidos.",
    sections: [
      { label: "Chat", what: "Conversación con el asistente." },
      { label: "Base de Conocimiento", what: "Documentos e instrucciones que el administrador le carga al asistente." },
    ],
    gotchas: [
      "Hoy no tiene ítem en el menú lateral: se entra escribiendo /ai-assistant en el navegador o desde donde esté embebido el chat.",
    ],
    guides: [
      {
        id: "usar-asistente",
        title: "Pedirle ayuda al asistente",
        intent: ["como uso el asistente", "para que sirve la ia", "que le puedo preguntar", "ayuda del asistente"],
        steps: [
          {
            title: "Pregúntale en lenguaje normal",
            detail: 'Sirve tanto "¿cuánto vendí este mes?" como "¿cómo hago un pedido?".',
            route: "/ai-assistant",
          },
          {
            title: "Si es una tarea, pídele la guía",
            detail: 'Escribe "guíame para..." y te va a dar los pasos y marcarlos en pantalla.',
            route: "/ai-assistant",
          },
          {
            title: 'Usa "Mostrarme en pantalla" cuando aparezca',
            detail: "El asistente te lleva al módulo y va marcando dónde hacer clic en cada paso.",
            route: "/ai-assistant",
          },
        ],
      },
    ],
  },

  {
    id: "notificaciones",
    label: "Notificaciones",
    href: "/notificaciones",
    permission: null,
    group: "Herramientas",
    nav: null,
    purpose: "Bandeja de notificaciones del sistema: tareas asignadas, aprobaciones pendientes, reclamos y pedidos.",
    whoUses: "Todos.",
    gotchas: ["Tampoco tiene ítem en el menú lateral: se entra por la ruta /notificaciones."],
    guides: [],
  },
];

// ─────────────────────────────────────────────────────────────────
// Consultas
// ─────────────────────────────────────────────────────────────────

const BY_ID = new Map(MODULE_MAP.map((m) => [m.id, m]));

export function getModule(id: string): ModuleDef | undefined {
  return BY_ID.get(id);
}

/** Normaliza texto para búsqueda: minúsculas, sin acentos, sin puntuación. */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Módulos que el usuario puede abrir según sus permisos efectivos.
 * `permissions` es el mapa clave→boolean de shared/permissions.ts.
 * Admin ve todo. Módulos con permission null son accesibles a cualquier usuario logueado.
 */
export function getAccessibleModules(
  permissions: Record<string, boolean> | null | undefined,
  role?: string,
): ModuleDef[] {
  if (role === "admin") return MODULE_MAP;
  return MODULE_MAP.filter((m) => {
    if (!m.permission) return true;
    if (!permissions) return false;
    return !!permissions[m.permission];
  });
}

/** Todas las guías de un módulo, incluida la de orientación generada. */
export function guidesOf(mod: ModuleDef): ModuleGuide[] {
  return [orientationGuide(mod), ...(mod.guides || [])];
}

/**
 * Id completo de una guía (`moduloId::guiaId`). Siempre se expone esta forma
 * hacia afuera: si dos módulos llegaran a tener una guía con el mismo id corto
 * (por ejemplo "crear-usuario"), el id calificado evita que se resuelva la del
 * módulo equivocado.
 */
export function qualifiedGuideId(mod: ModuleDef, guide: ModuleGuide): string {
  return guide.id.includes("::") ? guide.id : `${mod.id}::${guide.id}`;
}

/** Resuelve una guía por su id (`moduleId::guideId` o solo `guideId`). */
export function resolveGuide(
  guideId: string,
): { module: ModuleDef; guide: ModuleGuide; steps: GuideStep[] } | null {
  const [maybeModule, maybeGuide] = guideId.includes("::") ? guideId.split("::") : [null, guideId];
  for (const mod of MODULE_MAP) {
    if (maybeModule && mod.id !== maybeModule) continue;
    for (const guide of guidesOf(mod)) {
      const bareId = guide.id.includes("::") ? guide.id.split("::")[1] : guide.id;
      if (guide.id === guideId || qualifiedGuideId(mod, guide) === guideId || bareId === maybeGuide) {
        return { module: mod, guide, steps: fullStepsOf(mod, guide) };
      }
    }
  }
  return null;
}

/** Pasos completos de una guía: navegación desde el menú + pasos propios. */
export function fullStepsOf(mod: ModuleDef, guide: ModuleGuide): GuideStep[] {
  const own = guide.steps.map((s) => ({ ...s, route: s.route || mod.href }));
  if (guide.fromMenu === false) return own;
  return [...navStepsFor(mod), ...own];
}

export interface GuideMatch {
  moduleId: string;
  moduleLabel: string;
  guideId: string;
  title: string;
  score: number;
}

/**
 * Busca guías por texto libre entre los módulos accesibles.
 * Puntúa por coincidencia con los `intent`, el título de la guía,
 * el nombre del módulo y su propósito.
 */
export function searchGuides(
  query: string,
  modules: ModuleDef[] = MODULE_MAP,
  limit = 5,
): GuideMatch[] {
  const q = normalizeForSearch(query);
  if (!q) return [];
  const words = q.split(" ").filter((w) => w.length > 2);
  const matches: GuideMatch[] = [];

  for (const mod of modules) {
    const modText = normalizeForSearch(`${mod.label} ${mod.purpose} ${mod.group}`);
    for (const guide of guidesOf(mod)) {
      const intentText = normalizeForSearch([guide.title, ...guide.intent].join(" "));
      let score = 0;

      // Frase completa dentro de un intent: la señal más fuerte.
      if (intentText.includes(q)) score += 50;
      for (const word of words) {
        if (intentText.includes(word)) score += 6;
        if (modText.includes(word)) score += 2;
      }
      // Empujón cuando el nombre del módulo aparece literal en la consulta.
      if (q.includes(normalizeForSearch(mod.label))) score += 10;

      if (score > 0) {
        matches.push({
          moduleId: mod.id,
          moduleLabel: mod.label,
          guideId: qualifiedGuideId(mod, guide),
          title: guide.title,
          score,
        });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
