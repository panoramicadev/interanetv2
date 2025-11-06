import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  numeric,
  date,
  integer,
  boolean,
  unique,
  uniqueIndex,
  primaryKey,
  pgSchema,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table 
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // For email/password auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // admin, supervisor, salesperson, client, tecnico_obra, reception
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales transactions table
export const salesTransactions = pgTable("sales_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Core transaction fields from CSV
  nudo: varchar("nudo").notNull(), // Transaction number
  feemdo: date("feemdo").notNull(), // Transaction date
  koprct: varchar("koprct"), // Product SKU
  nokoen: text("nokoen"), // Client name
  noruen: varchar("noruen"), // Segment
  nokoprct: text("nokoprct"), // Product name
  nokofu: varchar("nokofu"), // Salesperson
  caprad2: numeric("caprad2", { precision: 10, scale: 2 }), // Secondary units (actual quantity sold)
  
  // Additional fields from CSV for complete data storage  
  idmaeedo: numeric("idmaeedo", { precision: 10, scale: 2 }), // ERP identifier (can have duplicates)
  tido: varchar("tido"),
  endo: varchar("endo"),
  suendo: varchar("suendo"),
  sudo: varchar("sudo"),
  feulvedo: date("feulvedo"),
  kofudo: varchar("kofudo"),
  modo: varchar("modo"),
  timodo: varchar("timodo"),
  tamodo: numeric("tamodo", { precision: 10, scale: 2 }),
  caprad: numeric("caprad", { precision: 10, scale: 2 }),
  caprex: numeric("caprex", { precision: 10, scale: 2 }),
  vanedo: numeric("vanedo", { precision: 15, scale: 2 }),
  vaivdo: numeric("vaivdo", { precision: 15, scale: 2 }),
  vabrdo: numeric("vabrdo", { precision: 15, scale: 2 }),
  lilg: varchar("lilg"),
  nulido: varchar("nulido"),
  sulido: varchar("sulido"),
  luvtlido: integer("luvtlido"),
  bosulido: varchar("bosulido"),
  kofulido: varchar("kofulido"),
  prct: varchar("prct"),
  tict: varchar("tict"),
  tipr: varchar("tipr"),
  nusepr: varchar("nusepr"),
  udtrpr: numeric("udtrpr", { precision: 10, scale: 2 }),
  rludpr: numeric("rludpr", { precision: 10, scale: 2 }),
  caprco1: numeric("caprco1", { precision: 10, scale: 2 }),
  caprad1: numeric("caprad1", { precision: 10, scale: 2 }),
  caprex1: numeric("caprex1", { precision: 10, scale: 2 }),
  caprnc1: numeric("caprnc1", { precision: 10, scale: 2 }),
  ud01pr: varchar("ud01pr"),
  caprco2: numeric("caprco2", { precision: 10, scale: 2 }),
  caprex2: numeric("caprex2", { precision: 10, scale: 2 }),
  caprnc2: numeric("caprnc2", { precision: 10, scale: 2 }),
  ud02pr: varchar("ud02pr"),
  ppprne: numeric("ppprne", { precision: 15, scale: 2 }),
  ppprbr: numeric("ppprbr", { precision: 15, scale: 2 }),
  vaneli: numeric("vaneli", { precision: 15, scale: 2 }),
  vabrli: numeric("vabrli", { precision: 15, scale: 2 }),
  feemli: date("feemli"),
  feerli: date("feerli"),
  ppprpm: numeric("ppprpm", { precision: 15, scale: 2 }),
  ppprpmifrs: numeric("ppprpmifrs", { precision: 15, scale: 2 }),
  logistica: numeric("logistica", { precision: 10, scale: 2 }),
  eslido: varchar("eslido"),
  ppprnere1: numeric("ppprnere1", { precision: 15, scale: 2 }),
  ppprnere2: numeric("ppprnere2", { precision: 15, scale: 2 }),
  idmaeddo: numeric("idmaeddo", { precision: 15, scale: 2 }),
  fmpr: varchar("fmpr"),
  mrpr: varchar("mrpr"),
  zona: varchar("zona"),
  ruen: varchar("ruen"),
  recaprre: numeric("recaprre", { precision: 15, scale: 2 }),
  pfpr: varchar("pfpr"),
  hfpr: varchar("hfpr"),
  monto: numeric("monto", { precision: 15, scale: 2 }),
  ocdo: varchar("ocdo"),
  nofmpr: varchar("nofmpr"),
  nopfpr: varchar("nopfpr"),
  nohfpr: varchar("nohfpr"),
  devol1: numeric("devol1", { precision: 10, scale: 2 }),
  devol2: numeric("devol2", { precision: 10, scale: 2 }),
  stockfis: numeric("stockfis", { precision: 10, scale: 2 }),
  listacost: varchar("listacost"),
  liscosmod: numeric("liscosmod", { precision: 10, scale: 2 }),
  
  // Missing name fields from CSV export
  nokozo: varchar("nokozo"), // Zone name
  nosudo: varchar("nosudo"), // Document branch name  
  nokofudo: varchar("nokofudo"), // Document employee name
  nobosuli: varchar("nobosuli"), // Warehouse branch name
  nomrpr: varchar("nomrpr"), // Name field
  
  // ETL control fields
  dataSource: varchar("data_source", { length: 20 }).default('csv'), // 'csv' | 'etl_sql_server'
  lastEtlSync: timestamp("last_etl_sync"), // Last ETL synchronization timestamp
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

// Manual schema for CSV import - ALL COLUMNS from CSV file (79 fields)
export const insertSalesTransactionSchema = z.object({
  // Core required fields
  nudo: z.string(),
  feemdo: z.string(),
  tido: z.string().optional().nullable(), // CRITICAL: Document type for NCV logic
  
  // ALL CSV columns as strings (numeric fields processed by Drizzle)
  idmaeedo: z.string().optional().nullable(), // Transaction ID
  endo: z.string().optional().nullable(),
  suendo: z.string().optional().nullable(),
  sudo: z.string().optional().nullable(),
  feulvedo: z.string().optional().nullable(), // Date fields
  kofudo: z.string().optional().nullable(),
  modo: z.string().optional().nullable(),
  timodo: z.string().optional().nullable(),
  tamodo: z.string().optional().nullable(),
  caprad: z.string().optional().nullable(),
  caprex: z.string().optional().nullable(),
  vanedo: z.string().optional().nullable(),
  vaivdo: z.string().optional().nullable(),
  vabrdo: z.string().optional().nullable(),
  lilg: z.string().optional().nullable(),
  nulido: z.string().optional().nullable(),
  sulido: z.string().optional().nullable(),
  luvtlido: z.number().optional().nullable(), // Integer field
  bosulido: z.string().optional().nullable(),
  kofulido: z.string().optional().nullable(),
  prct: z.string().optional().nullable(),
  tict: z.string().optional().nullable(),
  tipr: z.string().optional().nullable(),
  nusepr: z.string().optional().nullable(),
  koprct: z.string().optional().nullable(),
  udtrpr: z.string().optional().nullable(),
  rludpr: z.string().optional().nullable(),
  caprco1: z.string().optional().nullable(),
  caprad1: z.string().optional().nullable(),
  caprex1: z.string().optional().nullable(),
  caprnc1: z.string().optional().nullable(),
  ud01pr: z.string().optional().nullable(),
  caprco2: z.string().optional().nullable(),
  caprad2: z.string().optional().nullable(),
  caprex2: z.string().optional().nullable(),
  caprnc2: z.string().optional().nullable(),
  ud02pr: z.string().optional().nullable(),
  ppprne: z.string().optional().nullable(),
  ppprbr: z.string().optional().nullable(),
  vaneli: z.string().optional().nullable(),
  vabrli: z.string().optional().nullable(),
  feemli: z.string().optional().nullable(), // Date field
  feerli: z.string().optional().nullable(), // Date field
  ppprpm: z.string().optional().nullable(),
  ppprpmifrs: z.string().optional().nullable(),
  logistica: z.string().optional().nullable(),
  eslido: z.string().optional().nullable(),
  ppprnere1: z.string().optional().nullable(),
  ppprnere2: z.string().optional().nullable(),
  idmaeddo: z.string().optional().nullable(),
  fmpr: z.string().optional().nullable(),
  mrpr: z.string().optional().nullable(),
  zona: z.string().optional().nullable(),
  ruen: z.string().optional().nullable(),
  recaprre: z.string().optional().nullable(),
  pfpr: z.string().optional().nullable(),
  hfpr: z.string().optional().nullable(),
  monto: z.string().optional().nullable(),
  ocdo: z.string().optional().nullable(),
  nokoprct: z.string().optional().nullable(),
  nokozo: z.string().optional().nullable(),
  nosudo: z.string().optional().nullable(),
  nokofu: z.string().optional().nullable(),
  nokofudo: z.string().optional().nullable(),
  nobosuli: z.string().optional().nullable(),
  nokoen: z.string().optional().nullable(),
  noruen: z.string().optional().nullable(),
  nomrpr: z.string().optional().nullable(),
  nofmpr: z.string().optional().nullable(),
  nopfpr: z.string().optional().nullable(),
  nohfpr: z.string().optional().nullable(),
  devol1: z.string().optional().nullable(),
  devol2: z.string().optional().nullable(),
  stockfis: z.string().optional().nullable(),
  listacost: z.string().optional().nullable(),
  liscosmod: z.string().optional().nullable(),
});

export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect & {
  // Additional fields for salesperson users
  salespersonName?: string;
  username?: string;
  isActive?: boolean;
  supervisorId?: string;
  assignedSegment?: string;
};

// Products table - Simplified KOPR-based structure with only necessary fields
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kopr: varchar("kopr").notNull().unique(), // KOPR - Product Code (Primary Key)
  name: text("name").notNull(), // NOKOPR - Product Name
  ud02pr: varchar("ud02pr"), // UD02PR - Secondary unit presentation (Galón/Balde/Litro)
  priceProduct: numeric("price_product", { precision: 15, scale: 2 }), // Precio normal
  priceOffer: numeric("price_offer", { precision: 15, scale: 2 }), // Precio de oferta
  showInStore: boolean("show_in_store").default(false), // Mostrar en tienda
  
  // eCommerce fields
  slug: varchar("slug"), // SEO-friendly URL slug
  ecomActive: boolean("ecom_active").default(false), // Show in eCommerce store
  ecomPrice: numeric("ecom_price", { precision: 15, scale: 2 }), // eCommerce-specific price
  category: varchar("category"), // Product category for eCommerce
  tags: text("tags").array(), // Product tags for filtering/search
  images: jsonb("images").default(sql`'[]'::jsonb`), // Product images: [{id, url, alt, primary, sort}]
  seoTitle: varchar("seo_title"), // SEO title for product page
  seoDescription: text("seo_description"), // SEO description for product page
  ogImageUrl: varchar("og_image_url"), // Open Graph image URL
  
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Partial unique index for slug to avoid truncation prompt
  uniqueSlugIndex: uniqueIndex('products_slug_unique').on(table.slug).where(sql`${table.slug} is not null`)
}));

// Warehouses table - Master data for warehouses
export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kobo: varchar("kobo").notNull().unique(), // KOBO - Warehouse Code
  kosu: varchar("kosu").notNull(), // KOSU - Branch Code
  name: varchar("name").notNull(), // Warehouse Name
  branchName: varchar("branch_name"), // Branch Name
  location: text("location"), // Physical location
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueWarehouseBranch: unique("unique_warehouse_branch").on(table.kobo, table.kosu),
}));

// Product stock table - Stock by warehouse and branch based on CSV structure
export const productStock = pgTable("product_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kopr: varchar("kopr").notNull(), // FK to products.kopr
  productSku: varchar("product_sku").notNull(), // FK to products.sku (compatibility)
  kosu: varchar("kosu").notNull(), // KOSU - Branch Code from CSV
  kobo: varchar("kobo").notNull(), // KOBO - Warehouse Code from CSV
  datosubic: text("datosubic"), // DATOSUBIC - Warehouse Location from CSV
  branchCode: varchar("branch_code").notNull(), // KOSU from CSV (compatibility)
  warehouseCode: varchar("warehouse_code").notNull(), // KOBO from CSV (compatibility)
  warehouseLocation: text("warehouse_location"), // DATOSUBIC from CSV (compatibility)
  
  // Physical stock
  physicalStock1: numeric("physical_stock1", { precision: 15, scale: 4 }), // STFI1
  physicalStock2: numeric("physical_stock2", { precision: 15, scale: 4 }), // STFI2
  
  // Available stock for sales  
  availableStock1: numeric("available_stock1", { precision: 15, scale: 4 }), // STDV1
  availableStock2: numeric("available_stock2", { precision: 15, scale: 4 }), // STDV2
  
  // Committed stock
  committedStock1: numeric("committed_stock1", { precision: 15, scale: 4 }), // STOCNV1
  committedStock2: numeric("committed_stock2", { precision: 15, scale: 4 }), // STOCNV2
  
  // Committed stock alternative
  committedStock1Alt: numeric("committed_stock1_alt", { precision: 15, scale: 4 }), // STDV1C
  committedStock2Alt: numeric("committed_stock2_alt", { precision: 15, scale: 4 }), // STDV2C
  
  // Additional stock fields
  committedStockAlt1: numeric("committed_stock_alt1", { precision: 15, scale: 4 }), // STOCNV1C
  committedStockAlt2: numeric("committed_stock_alt2", { precision: 15, scale: 4 }), // STOCNV2C
  
  // Receipts and dispatches without invoice
  receiptNoInvoice1: numeric("receipt_no_invoice1", { precision: 15, scale: 4 }), // RECENOFAC1
  receiptNoInvoice2: numeric("receipt_no_invoice2", { precision: 15, scale: 4 }), // RECENOFAC2
  dispatchNoInvoice1: numeric("dispatch_no_invoice1", { precision: 15, scale: 4 }), // DESPNOFAC1
  dispatchNoInvoice2: numeric("dispatch_no_invoice2", { precision: 15, scale: 4 }), // DESPNOFAC2
  
  // Additional CSV fields from stock CSV
  fmpr: varchar("fmpr"), // FMPR - Family code
  pfpr: varchar("pfpr"), // PFPR - Price list code
  hfpr: varchar("hfpr"), // HFPR - Price list hierarchy
  rupr: varchar("rupr"), // RUPR - Route code
  mrpr: varchar("mrpr"), // MRPR - Brand code
  
  // RLUD - Unit Relation from CSV (varies by location)
  rlud: numeric("rlud", { precision: 10, scale: 2 }), // RLUD - Unit Relation from CSV
  
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Constraint único compuesto para upsert operations using KOPR
  uniqueProductStockLocation: unique("unique_product_stock_location").on(table.kopr, table.kosu, table.kobo),
  // Compatibility constraint for existing systems
  uniqueProductStockLocationCompat: unique("unique_product_stock_location_compat").on(table.productSku, table.branchCode, table.warehouseCode),
}));

// Product price history table - Track price changes
export const productPriceHistory = pgTable("product_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productSku: varchar("product_sku").notNull(), // FK to products.sku
  oldPrice: numeric("old_price", { precision: 15, scale: 2 }),
  newPrice: numeric("new_price", { precision: 15, scale: 2 }).notNull(),
  changedBy: varchar("changed_by"), // User ID who made the change
  changeReason: text("change_reason"),
  effectiveDate: timestamp("effective_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory Products table - Complete inventory snapshot synced from ERP
// Changed from catalog (one product = one row) to inventory (product x sucursal x bodega = one row)
export const inventoryProducts = pgTable("inventory_products", {
  sku: varchar("sku").notNull(), // KOPR - Product code from ERP
  sucursal: varchar("sucursal").notNull(), // KOSU - Branch/Sucursal code
  bodega: varchar("bodega").notNull(), // KOBO - Warehouse code
  nombre: text("nombre").notNull(), // NOKOPR - Product name
  nombreBodega: varchar("nombre_bodega"), // NOKOBO - Warehouse name
  unidad1: varchar("unidad1"), // UD01PR - Primary unit
  unidad2: varchar("unidad2"), // UD02PR - Secondary unit
  categoria: varchar("categoria"), // Product category/family
  stock1: numeric("stock1", { precision: 15, scale: 2 }).default("0"), // STFI1 - Stock in primary unit
  stock2: numeric("stock2", { precision: 15, scale: 2 }).default("0"), // STFI2 - Stock in secondary unit
  precioMedio: numeric("precio_medio", { precision: 15, scale: 2 }), // PM - Precio Medio from ERP
  valorInventario: numeric("valor_inventario", { precision: 15, scale: 2 }), // Calculated: stock2 × precioMedio
  activo: boolean("activo").default(true), // Product is active in inventory
  ultimaSincronizacion: timestamp("ultima_sincronizacion"), // Last time synced from ERP
  sincronizadoPor: varchar("sincronizado_por"), // User ID who triggered sync
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Composite primary key: one product in one warehouse at one branch = unique row
  pk: primaryKey({ columns: [table.sku, table.sucursal, table.bodega] }),
}));

// Inventory Sync Log table - Audit trail for catalog synchronizations
export const inventorySyncLog = pgTable("inventory_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // User who triggered the sync
  userEmail: varchar("user_email"), // Email of user for reference
  status: varchar("status").notNull(), // 'success', 'error', 'partial'
  productsNew: integer("products_new").default(0), // New products added
  productsUpdated: integer("products_updated").default(0), // Products updated
  productsDeactivated: integer("products_deactivated").default(0), // Products marked inactive
  totalProcessed: integer("total_processed").default(0), // Total products processed
  duration: integer("duration"), // Sync duration in milliseconds
  errorMessage: text("error_message"), // Error details if failed
  summary: jsonb("summary"), // Detailed summary of changes
  startedAt: timestamp("started_at").notNull(), // When sync started
  completedAt: timestamp("completed_at"), // When sync completed
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales ETL Sync Log table
export const salesEtlSyncLog = pgTable("sales_etl_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // User who triggered the sync
  userEmail: varchar("user_email"), // Email of user for reference
  status: varchar("status").notNull(), // 'success', 'error', 'partial'
  syncMode: varchar("sync_mode").notNull(), // 'incremental' | 'full'
  startDate: date("start_date"), // Start date filter
  endDate: date("end_date"), // End date filter
  recordsNew: integer("records_new").default(0), // New records inserted
  recordsUpdated: integer("records_updated").default(0), // Records updated
  totalProcessed: integer("total_processed").default(0), // Total records processed
  duration: integer("duration"), // Sync duration in milliseconds
  errorMessage: text("error_message"), // Error details if failed
  summary: jsonb("summary"), // Detailed summary of changes
  startedAt: timestamp("started_at").notNull(), // When sync started
  completedAt: timestamp("completed_at"), // When sync completed
  createdAt: timestamp("created_at").defaultNow(),
});

// Clients table - Complete structure from CSV import
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Core identification fields
  idmaeen: numeric("idmaeen", { precision: 15, scale: 5 }), // ID Master Entity
  koen: varchar("koen").unique(), // Client code (unique identifier)
  nokoen: text("nokoen").notNull(), // Client name (relates to sales_transactions)
  rten: varchar("rten"), // RUT/Tax ID
  
  // Entity and branch information
  tien: varchar("tien"), // Entity type
  suen: varchar("suen"), // Branch code
  tiposuc: varchar("tiposuc"), // Branch type
  
  // Business and industry information
  sien: text("sien"), // Industry sector
  gien: text("gien"), // Business type/description
  
  // Location information
  paen: varchar("paen"), // Country
  cien: varchar("cien"), // City code
  cmen: varchar("cmen"), // City name
  dien: text("dien"), // Address
  zoen: varchar("zoen"), // Zone
  comuna: varchar("comuna"), // Comuna
  provincia: varchar("provincia"), // Province
  departame: varchar("departame"), // Department
  distrito: varchar("distrito"), // District
  codubigeo: varchar("codubigeo"), // Ubigeo code
  urbaniz: varchar("urbaniz"), // Urbanization
  cpostal: varchar("cpostal"), // Postal code
  
  // Contact information
  foen: varchar("foen"), // Phone
  faen: varchar("faen"), // Fax
  email: text("email"), // Email
  emailcomer: text("emailcomer"), // Commercial email
  cnen: varchar("cnen"), // Contact number
  cnen2: varchar("cnen2"), // Contact number 2
  
  // Credit management (key business fields)
  crsd: numeric("crsd", { precision: 15, scale: 2 }), // Credit balance/debt
  crch: numeric("crch", { precision: 15, scale: 2 }), // Credit checks
  crlt: numeric("crlt", { precision: 15, scale: 2 }), // Credit limit total
  crpa: numeric("crpa", { precision: 15, scale: 2 }), // Credit paid
  crto: numeric("crto", { precision: 15, scale: 2 }), // Credit total
  cren: numeric("cren", { precision: 15, scale: 2 }), // Available credit
  fevecren: varchar("fevecren"), // Credit expiry date
  feultr: varchar("feultr"), // Last transaction date
  nuvecr: numeric("nuvecr", { precision: 15, scale: 2 }), // Credit times
  dccr: numeric("dccr", { precision: 15, scale: 2 }), // Credit days
  incr: numeric("incr", { precision: 15, scale: 2 }), // Credit interest
  popicr: numeric("popicr", { precision: 15, scale: 2 }), // Credit percentage
  koplcr: varchar("koplcr"), // Credit place
  
  // Sales and pricing
  kofuen: varchar("kofuen"), // Sales rep code
  assignedSalespersonUserId: varchar("assigned_salesperson_user_id"), // FK to users.id (assigned salesperson)
  userId: varchar("user_id"), // FK to users.id (client user for ecommerce access)
  lcen: varchar("lcen"), // Price list
  lven: varchar("lven"), // Sale list
  prefen: varchar("prefen"), // Preference
  porprefen: numeric("porprefen", { precision: 15, scale: 2 }), // Preference percentage
  
  // Accounting information
  contab: varchar("contab"), // Accounting account
  subauxi: varchar("subauxi"), // Sub auxiliary
  contabvta: varchar("contabvta"), // Sales account
  subauxivta: varchar("subauxivta"), // Sales sub auxiliary
  codcc: varchar("codcc"), // Cost center
  nutransmi: varchar("nutransmi"), // Transmission number
  
  // Route and collection
  ruen: varchar("ruen"), // Route
  cpen: numeric("cpen", { precision: 15, scale: 2 }), // Collection percentage
  cobrador: varchar("cobrador"), // Collector
  diacobra: numeric("diacobra", { precision: 15, scale: 2 }), // Collection day
  
  // Route days (delivery schedule)
  rutalun: integer("rutalun"), // Monday route
  rutamar: integer("rutamar"), // Tuesday route
  rutamie: integer("rutamie"), // Wednesday route
  rutajue: integer("rutajue"), // Thursday route
  rutavie: integer("rutavie"), // Friday route
  rutasab: integer("rutasab"), // Saturday route
  rutadom: integer("rutadom"), // Sunday route
  
  // Status and configuration fields
  bloqueado: integer("bloqueado"), // Blocked flag
  actien: integer("actien"), // Active entity
  habilita: varchar("habilita"), // Enable flag
  bloqencom: integer("bloqencom"), // Commerce block
  blovenex: integer("blovenex"), // External sale block
  
  // Business configuration
  dimoper: numeric("dimoper", { precision: 15, scale: 2 }), // Operation day
  tipoen: varchar("tipoen"), // Entity type
  tamaen: varchar("tamaen"), // Entity size
  claveen: varchar("claveen"), // Entity key
  acteco: varchar("acteco"), // Economic activity
  cattrib: varchar("cattrib"), // Attribute category
  
  // Tax and legal information
  agretiva: integer("agretiva"), // IVA retention agent
  agretiibb: integer("agretiibb"), // IIBB retention agent
  agretgan: integer("agretgan"), // Earnings retention agent
  agperiva: integer("agperiva"), // IVA perception agent
  agperiibb: integer("agperiibb"), // IIBB perception agent
  catlegret: varchar("catlegret"), // Legal retention category
  catlegmer: varchar("catlegmer"), // Commercial legal category
  imptoret: numeric("imptoret", { precision: 15, scale: 2 }), // Retention tax
  tiporuc: varchar("tiporuc"), // RUC type
  podetrac: integer("podetrac"), // DETRAC percentage
  
  // Protests and financial risk
  proteacum: numeric("proteacum", { precision: 15, scale: 2 }), // Accumulated protest
  protevige: numeric("protevige", { precision: 15, scale: 2 }), // Current protest
  diasvenci: numeric("diasvenci", { precision: 15, scale: 2 }), // Expiry days
  
  // Special features and validation
  nvvpidepie: integer("nvvpidepie"), // Request foot note
  recepelect: integer("recepelect"), // Electronic reception
  nvvobli: integer("nvvobli"), // Mandatory NVV
  occobli: integer("occobli"), // Mandatory OCC
  extenxml: varchar("extenxml"), // XML extension
  
  // Additional business fields
  codconve: varchar("codconve"), // Agreement code
  notraedeud: varchar("notraedeud"), // No debt transfer
  nokoenamp: text("nokoenamp"), // Extended client name
  transpoen: varchar("transpoen"), // Transport
  oben: text("oben"), // Observations
  diprve: numeric("diprve", { precision: 15, scale: 2 }), // Previous day
  valivenpag: numeric("valivenpag", { precision: 15, scale: 2 }), // Valid sale payment
  tipocontr: varchar("tipocontr"), // Contract type
  ferefauto: varchar("ferefauto"), // Auto reference date
  cuentabco: varchar("cuentabco"), // Bank account
  
  // Pending and alternative clients
  koendpen: varchar("koendpen"), // Pending client
  suendpen: varchar("suendpen"), // Pending branch
  koenal: varchar("koenal"), // Alternative client
  kofuweb: varchar("kofuweb"), // Web sales rep
  
  // Sequence and control
  secuecom: integer("secuecom"), // Commercial sequence
  secueven: integer("secueven"), // Sales sequence
  avisadpven: integer("avisadpven"), // Sales advice
  
  // Linked entities
  entiliga: varchar("entiliga"), // Linked entity
  porceliga: numeric("porceliga", { precision: 15, scale: 2 }), // Link percentage
  
  // GPS and location
  gpslat: numeric("gpslat", { precision: 15, scale: 8 }), // GPS latitude
  gpslon: numeric("gpslon", { precision: 15, scale: 8 }), // GPS longitude
  
  // Dates
  fecreen: varchar("fecreen"), // Creation date
  femoen: varchar("femoen"), // Movement date
  feemdo: varchar("feemdo"), // Document date
  
  // Document and signature
  firma: varchar("firma"), // Signature
  nodocum: varchar("nodocum"), // Document number
  
  // Account and currency
  moctaen: varchar("moctaen"), // Account currency
  ctasdelaen: varchar("ctasdelaen"), // Entity accounts
  
  // Personal information (for individuals)
  nacionen: varchar("nacionen"), // Nationality
  dirparen: text("dirparen"), // Parent address
  fecnacen: varchar("fecnacen"), // Birth date
  estciven: varchar("estciven"), // Civil status
  profecen: varchar("profecen"), // Profession
  conyugen: varchar("conyugen"), // Spouse
  rutconen: varchar("rutconen"), // Contact RUT
  rutsocen: varchar("rutsocen"), // Partner RUT
  sexoen: varchar("sexoen"), // Gender
  relacien: varchar("relacien"), // Relationship
  
  // Annexes and additional data
  anexen1: varchar("anexen1"), // Annex 1
  anexen2: varchar("anexen2"), // Annex 2
  anexen3: varchar("anexen3"), // Annex 3
  anexen4: varchar("anexen4"), // Annex 4
  
  // Time fields
  dten: varchar("dten"), // Entity day
  uren: varchar("uren"), // Entity hour
  
  // Collection economic activity
  actecobco: varchar("actecobco"), // Collection economic activity
  
  // Outstanding balances
  deudaven: numeric("deudaven", { precision: 15, scale: 2 }), // Due debt
  chvnocan: numeric("chvnocan", { precision: 15, scale: 2 }), // Uncanceled checks
  ltvnocan: numeric("ltvnocan", { precision: 15, scale: 2 }), // Uncanceled letters
  pagnocan: numeric("pagnocan", { precision: 15, scale: 2 }), // Uncanceled payments
  anticipos: numeric("anticipos", { precision: 15, scale: 2 }), // Advances
}, (table) => ({
  // Indexes for performance
  clientCodeIdx: index("IDX_clients_koen").on(table.koen),
  clientNameIdx: index("IDX_clients_nokoen").on(table.nokoen),
}));

// Relations
export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stock: many(productStock),
}));

export const productsRelations = relations(products, ({ many }) => ({
  stock: many(productStock),
  priceHistory: many(productPriceHistory),
}));

export const productStockRelations = relations(productStock, ({ one }) => ({
  product: one(products, {
    fields: [productStock.kopr],
    references: [products.kopr],
  }),
  warehouse: one(warehouses, {
    fields: [productStock.kobo, productStock.kosu],
    references: [warehouses.kobo, warehouses.kosu],
  }),
}));

export const productPriceHistoryRelations = relations(productPriceHistory, ({ one }) => ({
  product: one(products, {
    fields: [productPriceHistory.productSku],
    references: [products.kopr],
  }),
}));

// Client relations - Connect clients with sales transactions, salesperson and user
export const clientsRelations = relations(clients, ({ many, one }) => ({
  transactionsByName: many(salesTransactions),
  assignedSalesperson: one(users, {
    fields: [clients.assignedSalespersonUserId],
    references: [users.id],
  }),
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
}));

export const salesTransactionsClientRelations = relations(salesTransactions, ({ one }) => ({
  clientByName: one(clients, {
    fields: [salesTransactions.nokoen],
    references: [clients.nokoen],
  }),
}));

// Product types
export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = typeof warehouses.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type ProductStock = typeof productStock.$inferSelect;
export type InsertProductStock = typeof productStock.$inferInsert;
export type ProductPriceHistory = typeof productPriceHistory.$inferSelect;
export type InsertProductPriceHistory = typeof productPriceHistory.$inferInsert;

// Product schemas for validation
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// eCommerce-specific schemas (defined first to avoid initialization order issues)
export const productImageSchema = z.object({
  id: z.string().min(1, "Image ID is required"),
  url: z.string().url("Invalid image URL"),
  alt: z.string().min(1, "Image alt text is required for accessibility"),
  primary: z.boolean().default(false),
  sort: z.number().int().min(0, "Sort order must be a non-negative integer").default(0),
});

// Base eCommerce product object schema (for extending/partial operations)
export const ecommerceProductObject = z.object({
  // Core product fields
  kopr: z.string().min(1, "Product code is required"),
  name: z.string().min(1, "Product name is required"),
  ud02pr: z.string().optional(),
  priceProduct: z.number().min(0, "Product price must be non-negative").optional(),
  priceOffer: z.number().min(0, "Offer price must be non-negative").optional(),
  
  // eCommerce fields - conditional validation based on ecomActive
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  ecomActive: z.boolean().default(false),
  ecomPrice: z.number().min(0, "eCommerce price must be non-negative").optional(),
  category: z.string().min(1, "Category is required for active eCommerce products").optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(productImageSchema).default([]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  ogImageUrl: z.string().url("Invalid Open Graph image URL").optional().or(z.literal("")),
  
  // Base fields
  showInStore: z.boolean().default(false),
  active: z.boolean().default(true),
});

// Enhanced eCommerce product schema with validation (for API validation)
export const ecommerceProductSchema = ecommerceProductObject
.superRefine((data, ctx) => {
  // When ecommerce is active, enforce additional requirements
  if (data.ecomActive) {
    // Require at least one image with primary=true when active
    if (data.images.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one image is required for active eCommerce products",
        path: ["images"]
      });
    } else {
      const hasPrimaryImage = data.images.some(img => img.primary);
      if (!hasPrimaryImage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one image must be marked as primary for active eCommerce products",
          path: ["images"]
        });
      }
    }
    
    // Require category when active
    if (!data.category || data.category.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category is required for active eCommerce products",
        path: ["category"]
      });
    }
    
    // Require at least one pricing option
    if (!data.ecomPrice && !data.priceOffer && !data.priceProduct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one price (ecomPrice, priceOffer, or priceProduct) is required for active eCommerce products",
        path: ["ecomPrice"]
      });
    }
  }
});

// Base object for creating eCommerce product with price calculation (extends base object)
const createEcommerceProductWithPriceObject = ecommerceProductObject.extend({
  // Additional field for price calculation
  displayPrice: z.number().optional(), // Will be calculated automatically
});

// Enhanced eCommerce product creation schema with price calculation
export const createEcommerceProductWithPriceSchema = createEcommerceProductWithPriceObject
.superRefine((data, ctx) => {
  // When ecommerce is active, enforce additional requirements
  if (data.ecomActive) {
    // Require at least one image with primary=true when active
    if (data.images.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one image is required for active eCommerce products",
        path: ["images"]
      });
    } else {
      const hasPrimaryImage = data.images.some(img => img.primary);
      if (!hasPrimaryImage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one image must be marked as primary for active eCommerce products",
          path: ["images"]
        });
      }
    }
    
    // Require category when active
    if (!data.category || data.category.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category is required for active eCommerce products",
        path: ["category"]
      });
    }
    
    // Require at least one pricing option
    if (!data.ecomPrice && !data.priceOffer && !data.priceProduct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one price (ecomPrice, priceOffer, or priceProduct) is required for active eCommerce products",
        path: ["ecomPrice"]
      });
    }
  }
})
.transform((data) => {
  // Calculate display price using proper precedence
  const displayPrice = data.ecomPrice ?? data.priceOffer ?? data.priceProduct;
  return {
    ...data,
    displayPrice
  };
});

// Base object for updating eCommerce products (uses partial of base object)
const updateEcommerceProductObject = ecommerceProductObject.omit({ kopr: true }).partial();

// Enhanced update schema with validation
export const updateEcommerceProductSchema = updateEcommerceProductObject
.superRefine((data, ctx) => {
  // Apply same validation rules as create schema when ecomActive is being set to true
  if (data.ecomActive === true) {
    // Validate images if provided
    if (data.images && data.images.length > 0) {
      const hasPrimaryImage = data.images.some(img => img.primary);
      if (!hasPrimaryImage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one image must be marked as primary when activating eCommerce",
          path: ["images"]
        });
      }
    }
    
    // Validate category if provided
    if (data.category !== undefined && (!data.category || data.category.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category is required when activating eCommerce",
        path: ["category"]
      });
    }
  }
});

// Base object for eCommerce product filters (for extending/partial operations)
export const ecommerceProductFiltersObject = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  active: z.boolean().optional(),
  ecomActive: z.boolean().optional(),
  minPrice: z.number().min(0, "Minimum price must be non-negative").optional(),
  maxPrice: z.number().min(0, "Maximum price must be non-negative").optional(),
  tags: z.array(z.string().min(1, "Tag cannot be empty")).optional(),
  limit: z.number().int().min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100").default(20),
  offset: z.number().int().min(0, "Offset must be non-negative").default(0),
});

// Enhanced filters schema with validation
export const ecommerceProductFiltersSchema = ecommerceProductFiltersObject
.superRefine((data, ctx) => {
  // Ensure maxPrice is greater than or equal to minPrice when both are provided
  if (data.minPrice !== undefined && data.maxPrice !== undefined && data.maxPrice < data.minPrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Maximum price must be greater than or equal to minimum price",
      path: ["maxPrice"]
    });
  }
});

// CSV import schema for products and stock (KOPR-based)
export const csvProductStockImportSchema = z.object({
  // Product identification from CSV
  KOPR: z.string(), // Product Code (Primary)
  NOKOPR: z.string(), // Product Name
  UD01PR: z.string().optional(), // Unit 1
  UD02PR: z.string().optional(), // Unit 2
  
  // Location identification from CSV
  KOSU: z.string(), // Branch Code
  KOBO: z.string(), // Warehouse Code
  DATOSUBIC: z.string().optional(), // Warehouse Location
  
  // Stock fields from CSV (all as strings for parsing)
  STFI1: z.string().optional(), // Physical Stock 1
  STDV1: z.string().optional(), // Available Stock 1
  STOCNV1: z.string().optional(), // Committed Stock 1
  STDV1C: z.string().optional(), // Committed Stock 1 Alt
  STOCNV1C: z.string().optional(), // Committed Stock Alt 1
  RECENOFAC1: z.string().optional(), // Receipt No Invoice 1
  DESPNOFAC1: z.string().optional(), // Dispatch No Invoice 1
  
  STFI2: z.string().optional(), // Physical Stock 2
  STDV2: z.string().optional(), // Available Stock 2
  STOCNV2: z.string().optional(), // Committed Stock 2
  STDV2C: z.string().optional(), // Committed Stock 2 Alt
  STOCNV2C: z.string().optional(), // Committed Stock Alt 2
  RECENOFAC2: z.string().optional(), // Receipt No Invoice 2
  DESPNOFAC2: z.string().optional(), // Dispatch No Invoice 2
  
  // Additional fields from CSV
  RLUD: z.string().optional(), // Unit Relation
  FMPR: z.string().optional(), // Family code
  PFPR: z.string().optional(), // Price list code
  HFPR: z.string().optional(), // Price list hierarchy
  RUPR: z.string().optional(), // Route code
  MRPR: z.string().optional(), // Brand code
});

// Legacy CSV import schema for products (compatibility)
export const csvProductImportSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  pricePerUnit: z.string().optional(), // String because it comes from CSV
  taxCode: z.string().optional(),
  taxName: z.string().optional(),
  taxRate: z.string().optional(),
  weight: z.string().optional(),
  weightUnit: z.string().optional(),
  length: z.string().optional(),
  lengthUnit: z.string().optional(),
  width: z.string().optional(),
  widthUnit: z.string().optional(),
  height: z.string().optional(),
  heightUnit: z.string().optional(),
  volume: z.string().optional(),
  volumeUnit: z.string().optional(),
  minUnit: z.string().optional(),
  stepSize: z.string().optional(),
  packagingUnit: z.string().optional(),
  packagingUnitName: z.string().optional(), // Presentación del producto
  packagingPackageName: z.string().optional(),
  packagingPackageUnit: z.string().optional(),
  packagingAmountPerPackage: z.string().optional(),
  packagingBoxName: z.string().optional(),
  packagingBoxUnit: z.string().optional(),
  packagingAmountPerBox: z.string().optional(),
  packagingPalletName: z.string().optional(),
  packagingPalletUnit: z.string().optional(),
  packagingAmountPerPallet: z.string().optional(),
});

export const insertWarehouseSchema = createInsertSchema(warehouses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductStockSchema = createInsertSchema(productStock).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertProductPriceHistorySchema = createInsertSchema(productPriceHistory).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryProductSchema = createInsertSchema(inventoryProducts).omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  // Transform numeric fields to strings
  stock1: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'number' ? val.toString() : val
  ).optional(),
  stock2: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'number' ? val.toString() : val
  ).optional(),
  precioMedio: z.union([z.string(), z.number(), z.null()]).transform(val => 
    val === null || val === undefined ? null : (typeof val === 'number' ? val.toString() : val)
  ).nullable().optional(),
  valorInventario: z.union([z.string(), z.number(), z.null()]).transform(val => 
    val === null || val === undefined ? null : (typeof val === 'number' ? val.toString() : val)
  ).nullable().optional(),
});

export const insertInventorySyncLogSchema = createInsertSchema(inventorySyncLog).omit({
  id: true,
  createdAt: true,
});

// Type exports for CSV import
export type CsvProductStockImport = z.infer<typeof csvProductStockImportSchema>;
export type CsvProductImport = z.infer<typeof csvProductImportSchema>;
export type InsertWarehouseInput = z.infer<typeof insertWarehouseSchema>;
export type InsertProductStockInput = z.infer<typeof insertProductStockSchema>;
export type InsertProductPriceHistoryInput = z.infer<typeof insertProductPriceHistorySchema>;

// Inventory types
export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type InsertInventoryProduct = z.infer<typeof insertInventoryProductSchema>;
export type InventorySyncLog = typeof inventorySyncLog.$inferSelect;
export type InsertInventorySyncLog = z.infer<typeof insertInventorySyncLogSchema>;

// Slug validation schema for separate validation endpoint
export const validateSlugSchema = z.object({
  slug: z.string()
    .min(1, "Slug is required")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .regex(/^[a-z0-9].*[a-z0-9]$|^[a-z0-9]$/, "Slug cannot start or end with hyphens")
    .refine(val => !val.includes("--"), "Slug cannot contain consecutive hyphens"),
  excludeKopr: z.string().optional(),
});

// Toggle active status schema
export const toggleEcommerceActiveSchema = z.object({
  ecomActive: z.boolean(),
});

// eCommerce type exports
export type UpdateEcommerceProduct = z.infer<typeof updateEcommerceProductSchema>;
export type EcommerceProductFilters = z.infer<typeof ecommerceProductFiltersSchema>;
export type ValidateSlugInput = z.infer<typeof validateSlugSchema>;
export type ToggleEcommerceActiveInput = z.infer<typeof toggleEcommerceActiveSchema>;

// Client types and schemas
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// Client schemas for validation
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// CSV import schema for clients (all fields as optional strings for flexible parsing)
export const csvClientImportSchema = z.object({
  // Core CSV headers from client import file
  IDMAEEN: z.string().optional(),
  KOEN: z.string().optional(),
  TIEN: z.string().optional(),
  RTEN: z.string().optional(),
  SUEN: z.string().optional(),
  TIPOSUC: z.string().optional(),
  NOKOEN: z.string().optional(),
  SIEN: z.string().optional(),
  GIEN: z.string().optional(),
  PAEN: z.string().optional(),
  CIEN: z.string().optional(),
  CMEN: z.string().optional(),
  DIEN: z.string().optional(),
  ZOEN: z.string().optional(),
  FOEN: z.string().optional(),
  FAEN: z.string().optional(),
  CNEN: z.string().optional(),
  KOFUEN: z.string().optional(),
  LCEN: z.string().optional(),
  LVEN: z.string().optional(),
  CRSD: z.string().optional(), // Credit balance
  CRCH: z.string().optional(), // Credit checks
  CRLT: z.string().optional(), // Credit limit
  CRPA: z.string().optional(), // Credit paid
  CRTO: z.string().optional(), // Credit total
  CREN: z.string().optional(), // Available credit
  FEVECREN: z.string().optional(), // Credit expiry
  FEULTR: z.string().optional(), // Last transaction
  NUVECR: z.string().optional(),
  DCCR: z.string().optional(),
  INCR: z.string().optional(),
  POPICR: z.string().optional(),
  KOPLCR: z.string().optional(),
  CONTAB: z.string().optional(),
  SUBAUXI: z.string().optional(),
  CONTABVTA: z.string().optional(),
  SUBAUXIVTA: z.string().optional(),
  CODCC: z.string().optional(),
  NUTRANSMI: z.string().optional(),
  RUEN: z.string().optional(),
  CPEN: z.string().optional(),
  OBEN: z.string().optional(),
  DIPRVE: z.string().optional(),
  EMAIL: z.string().optional(),
  CNEN2: z.string().optional(),
  COBRADOR: z.string().optional(),
  PROTEACUM: z.string().optional(),
  PROTEVIGE: z.string().optional(),
  CPOSTAL: z.string().optional(),
  HABILITA: z.string().optional(),
  CODCONVE: z.string().optional(),
  NOTRAEDEUD: z.string().optional(),
  NOKOENAMP: z.string().optional(),
  BLOQUEADO: z.string().optional(),
  DIMOPER: z.string().optional(),
  PREFEN: z.string().optional(),
  BLOQENCOM: z.string().optional(),
  TIPOEN: z.string().optional(),
  ACTIEN: z.string().optional(),
  TAMAEN: z.string().optional(),
  PORPREFEN: z.string().optional(),
  CLAVEEN: z.string().optional(),
  NVVPIDEPIE: z.string().optional(),
  RECEPELECT: z.string().optional(),
  ACTECO: z.string().optional(),
  DIASVENCI: z.string().optional(),
  CATTRIB: z.string().optional(),
  AGRETIVA: z.string().optional(),
  AGRETIIBB: z.string().optional(),
  AGRETGAN: z.string().optional(),
  AGPERIVA: z.string().optional(),
  AGPERIIBB: z.string().optional(),
  TRANSPOEN: z.string().optional(),
  FECREEN: z.string().optional(),
  FIRMA: z.string().optional(),
  MOCTAEN: z.string().optional(),
  CTASDELAEN: z.string().optional(),
  NACIONEN: z.string().optional(),
  DIRPAREN: z.string().optional(),
  FECNACEN: z.string().optional(),
  ESTCIVEN: z.string().optional(),
  PROFECEN: z.string().optional(),
  CONYUGEN: z.string().optional(),
  RUTCONEN: z.string().optional(),
  RUTSOCEN: z.string().optional(),
  SEXOEN: z.string().optional(),
  RELACIEN: z.string().optional(),
  ANEXEN1: z.string().optional(),
  ANEXEN2: z.string().optional(),
  ANEXEN3: z.string().optional(),
  ANEXEN4: z.string().optional(),
  OCCOBLI: z.string().optional(),
  VALIVENPAG: z.string().optional(),
  EMAILCOMER: z.string().optional(),
  TIPOCONTR: z.string().optional(),
  FEREFAUTO: z.string().optional(),
  DIACOBRA: z.string().optional(),
  CUENTABCO: z.string().optional(),
  KOENDPEN: z.string().optional(),
  SUENDPEN: z.string().optional(),
  RUTALUN: z.string().optional(),
  RUTAMAR: z.string().optional(),
  RUTAMIE: z.string().optional(),
  RUTAJUE: z.string().optional(),
  RUTAVIE: z.string().optional(),
  RUTASAB: z.string().optional(),
  RUTADOM: z.string().optional(),
  CATLEGRET: z.string().optional(),
  IMPTORET: z.string().optional(),
  ENTILIGA: z.string().optional(),
  PORCELIGA: z.string().optional(),
  ACTECOBCO: z.string().optional(),
  NVVOBLI: z.string().optional(),
  SECUECOM: z.string().optional(),
  SECUEVEN: z.string().optional(),
  AVISADPVEN: z.string().optional(),
  EXTENXML: z.string().optional(),
  KOENAL: z.string().optional(),
  KOFUWEB: z.string().optional(),
  CATLEGMER: z.string().optional(),
  GPSLAT: z.string().optional(),
  GPSLON: z.string().optional(),
  URBANIZ: z.string().optional(),
  PROVINCIA: z.string().optional(),
  DEPARTAME: z.string().optional(),
  DISTRITO: z.string().optional(),
  CODUBIGEO: z.string().optional(),
  TIPORUC: z.string().optional(),
  PODETRAC: z.string().optional(),
  DTEN: z.string().optional(),
  UREN: z.string().optional(),
  BLOVENEX: z.string().optional(),
  FEMOEN: z.string().optional(),
  FEEMDO: z.string().optional(),
  COMUNA: z.string().optional(),
  NODOCUM: z.string().optional(),
  DEUDAVEN: z.string().optional(),
  CHVNOCAN: z.string().optional(),
  LTVNOCAN: z.string().optional(),
  PAGNOCAN: z.string().optional(),
  ANTICIPOS: z.string().optional(),
});

// Sistema de usuarios vendedores
export const salespeopleUsers = pgTable("salespeople_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salespersonName: varchar("salesperson_name").notNull().unique(), // Nombre del vendedor de las ventas
  username: varchar("username").unique(), // Usuario para login (primera letra + apellido)
  email: varchar("email").unique(),
  password: varchar("password"), // Hash de la contraseña
  isActive: boolean("is_active").default(true),
  role: varchar("role").default("salesperson"), // "admin" | "supervisor" | "salesperson" | "tecnico_obra" | "client" | "reception"
  supervisorId: varchar("supervisor_id"), // ID del supervisor que gestiona este vendedor (solo para role="salesperson")
  assignedSegment: varchar("assigned_segment"), // Segmento asignado al supervisor (solo para role="supervisor")
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SalespersonUser = typeof salespeopleUsers.$inferSelect;
export type InsertSalespersonUser = typeof salespeopleUsers.$inferInsert;

// Relaciones para usuarios vendedores
export const salespeopleUsersRelations = relations(salespeopleUsers, ({ one, many }) => ({
  supervisor: one(salespeopleUsers, {
    fields: [salespeopleUsers.supervisorId],
    references: [salespeopleUsers.id],
    relationName: "supervisor"
  }),
  managedSalespeople: many(salespeopleUsers, {
    relationName: "supervisor"
  }),
}));

// Esquemas de validación para usuarios vendedores
export const insertSalespersonUserSchema = createInsertSchema(salespeopleUsers, {
  salespersonName: z.string().min(1, "Nombre del usuario es requerido"),
  username: z.string().min(2, "Usuario debe tener al menos 2 caracteres").optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional().or(z.literal("")),
  role: z.enum(["admin", "supervisor", "salesperson", "tecnico_obra", "client", "reception", "laboratorio", "area_materia_prima", "area_colores", "area_aplicacion", "area_envase", "area_etiqueta", "area_produccion", "area_logistica", "produccion", "logistica_bodega", "planificacion", "bodega_materias_primas", "prevencion_riesgos"]).default("salesperson"),
  supervisorId: z.string().optional().nullable(),
  assignedSegment: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSalespersonUserInput = z.infer<typeof insertSalespersonUserSchema>;

// Goals/Metas table for managing sales targets
export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'global', 'segment', 'salesperson'
  target: varchar("target"), // segment name or salesperson name (null for global)
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  period: varchar("period").notNull(), // 'YYYY-MM' format for monthly goals
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;
export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
});
export type InsertSalesTransaction = z.infer<typeof insertSalesTransactionSchema>;
export type SalesTransaction = typeof salesTransactions.$inferSelect;

// Tasks system - Panel de Tareas
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"), // Added description field
  type: varchar("type").notNull(), // 'texto', 'formulario', 'visita'
  status: varchar("status").default("pendiente"), // 'pendiente', 'en_progreso', 'completada'
  progress: integer("progress").default(0), // 0-100
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high'
  dueDate: timestamp("due_date"), // nullable, changed to timestamp for datetime support
  createdByUserId: varchar("created_by_user_id").notNull(), // FK to users.id
  assignedToUserId: varchar("assigned_to_user_id"), // FK to users.id (nullable)
  payload: jsonb("payload"), // Type-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Indexes for performance
  assignedToUserIdIdx: index("IDX_tasks_assigned_to_user_id").on(table.assignedToUserId),
  statusIdx: index("IDX_tasks_status").on(table.status),
  typeIdx: index("IDX_tasks_type").on(table.type),
  dueDateIdx: index("IDX_tasks_due_date").on(table.dueDate),
}));

export const taskAssignments = pgTable("task_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(), // FK to tasks.id
  assigneeType: varchar("assignee_type").notNull(), // "user" | "segment"
  assigneeId: varchar("assignee_id").notNull(), // userId or segment code
  status: varchar("status").default("pending"), // pending, in_progress, completed, declined
  readAt: timestamp("read_at"), // nullable
  completedAt: timestamp("completed_at"), // nullable
  notes: text("notes"), // nullable
  evidenceImages: text("evidence_images").array(), // Array of image URLs for evidence
  createdAt: timestamp("created_at").defaultNow(),
});

export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type InsertTaskAssignment = typeof taskAssignments.$inferInsert;

// Relations
export const tasksRelations = relations(tasks, ({ many, one }) => ({
  assignments: many(taskAssignments),
  createdBy: one(users, {
    fields: [tasks.createdByUserId],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [tasks.assignedToUserId],
    references: [users.id],
  }),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignments.taskId],
    references: [tasks.id],
  }),
}));

// Payload schemas for different task types with enhanced validation
export const textoTaskPayloadSchema = z.object({
  description: z.string().optional(),
  notes: z.string().optional(),
}).optional();

export const formularioTaskPayloadSchema = z.object({
  formKey: z.literal("compras_potenciales"),
  clientId: z.string().optional(),
  clientName: z.string().min(1, "Nombre del cliente es requerido"),
  montoEstimado: z.number().positive("El monto debe ser mayor a 0"),
  semanaISO: z.string().regex(/^\d{4}-W\d{2}$/, "Formato debe ser YYYY-Www (ej: 2025-W37)"), // YYYY-Www format validation
  notas: z.string().optional(),
});

const formularioTaskPayloadOptionalSchema = formularioTaskPayloadSchema.optional();

export const visitaTaskPayloadSchema = z.object({
  locationName: z.string().min(1, "Nombre de la ubicación es requerido"),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90, "Latitud debe estar entre -90 y 90").optional(),
  lng: z.number().min(-180).max(180, "Longitud debe estar entre -180 y 180").optional(),
  scheduledAt: z.string().refine((date) => {
    if (!date) return true;
    // Accept datetime-local format (YYYY-MM-DDTHH:mm) or full ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
    const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    const isoDatetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return datetimeLocalRegex.test(date) || isoDatetimeRegex.test(date) || !isNaN(Date.parse(date));
  }, "Fecha debe ser formato válido (YYYY-MM-DDTHH:mm o ISO datetime)").optional(),
});

const visitaTaskPayloadOptionalSchema = visitaTaskPayloadSchema.optional();

// Task schema with discriminated union validation for security and type safety
const baseTaskSchema = z.object({
  title: z.string().min(1, "Título es requerido"),
  description: z.string().optional(),
  status: z.enum(["pendiente", "en_progreso", "completada"]).default("pendiente"),
  progress: z.number().min(0).max(100).default(0),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().refine((date) => {
    if (!date) return true;
    // Accept datetime-local format (YYYY-MM-DDTHH:mm) or full ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
    const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    const isoDatetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return datetimeLocalRegex.test(date) || isoDatetimeRegex.test(date) || !isNaN(Date.parse(date));
  }, "Fecha debe ser formato válido (YYYY-MM-DDTHH:mm o ISO datetime)").optional().or(z.null()),
  assignedToUserId: z.string().optional().or(z.null()),
});

// Discriminated union for strict type-based validation
export const insertTaskSchema = z.discriminatedUnion("type", [
  // Texto task - payload is optional
  baseTaskSchema.extend({
    type: z.literal("texto"),
    payload: textoTaskPayloadSchema,
  }),
  // Formulario task - requires specific payload
  baseTaskSchema.extend({
    type: z.literal("formulario"),
    payload: formularioTaskPayloadSchema, // Required for formulario type
  }),
  // Visita task - requires location payload
  baseTaskSchema.extend({
    type: z.literal("visita"),
    payload: visitaTaskPayloadSchema, // Required for visita type
  }),
]);

// SECURITY: Server-only schema that includes createdByUserId - NEVER expose this to frontend
export const serverInsertTaskSchema = baseTaskSchema.extend({
  createdByUserId: z.string().min(1, "Usuario creador es requerido"),
}).and(z.discriminatedUnion("type", [
  z.object({
    type: z.literal("texto"),
    payload: textoTaskPayloadSchema,
  }),
  z.object({
    type: z.literal("formulario"),
    payload: formularioTaskPayloadSchema,
  }),
  z.object({
    type: z.literal("visita"),
    payload: visitaTaskPayloadSchema,
  }),
]));

export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments, {
  assigneeType: z.enum(["user", "segment"]),
  assigneeId: z.string().min(1, "Asignado es requerido"),
  status: z.enum(["pending", "in_progress", "completed", "declined"]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
});

// TypeScript types - CRITICAL: Export all task-related types
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type InsertTaskInput = z.infer<typeof insertTaskSchema>;
export type ServerInsertTaskInput = z.infer<typeof serverInsertTaskSchema>;
export type InsertTaskAssignmentInput = z.infer<typeof insertTaskAssignmentSchema>;
export type TextoTaskPayload = z.infer<typeof textoTaskPayloadSchema>;
export type FormularioTaskPayload = z.infer<typeof formularioTaskPayloadSchema>;
export type VisitaTaskPayload = z.infer<typeof visitaTaskPayloadSchema>;

// TaskPayload union type - CRITICAL export requested by architect
export type TaskPayload = TextoTaskPayload | FormularioTaskPayload | VisitaTaskPayload;

// Orders system - Tomador de Pedidos (Enhanced with Quote parity)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(), // Auto-generated order number
  clientName: text("client_name").notNull(), // Client name (referencing clients.nokoen)
  clientId: varchar("client_id"), // Optional FK to clients.id for structured reference
  // Additional client fields for complete orders (parity with quotes)
  clientRut: varchar("client_rut"), // Client RUT for new clients
  clientEmail: varchar("client_email"), // Client email
  clientPhone: varchar("client_phone"), // Client phone
  clientAddress: text("client_address"), // Client address
  createdBy: varchar("created_by").notNull(), // FK to users.id - who created the order
  status: varchar("status").default("draft"), // draft, confirmed, processing, completed, cancelled
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  notes: text("notes"), // Additional notes about the order
  estimatedDeliveryDate: timestamp("estimated_delivery_date"), // Optional estimated delivery
  // Financial fields (parity with quotes)
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }), // Subtotal before taxes
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"), // Discount amount
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("19"), // IVA rate (19% default)
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }), // Calculated tax
  total: numeric("total", { precision: 15, scale: 2 }), // Final total
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }), // Legacy field for compatibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(), // FK to orders.id
  type: varchar("type").notNull().default("standard"), // "standard" | "custom" (parity with quoteItems)
  // For standard products
  productCode: varchar("product_code"), // From price_list.codigo (enhanced)
  productName: text("product_name").notNull(), // Product name
  // For custom products (parity with quoteItems)
  customSku: varchar("custom_sku"), // Custom SKU
  costOfProduction: numeric("cost_of_production", { precision: 15, scale: 2 }), // Custom cost
  profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }), // Custom profit %
  pricingMode: varchar("pricing_mode"), // "calculated" | "direct"
  // Common fields
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"), // Item-specific notes
  createdAt: timestamp("created_at").defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Relations
export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  creator: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

// Enhanced schemas for validation (parity with quotes)
export const insertOrderSchema = createInsertSchema(orders, {
  clientName: z.string().min(1, "Nombre del cliente es requerido"),
  clientRut: z.string().optional(),
  clientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  status: z.enum(["draft", "confirmed", "processing", "completed", "cancelled"]).default("draft"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  notes: z.string().optional(),
  estimatedDeliveryDate: z.string().optional().or(z.null()),
}).omit({
  id: true,
  orderNumber: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
  // Allow subtotal, taxAmount, total to be sent from frontend
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
  type: z.enum(["standard", "custom"]).default("standard"),
  productName: z.string().min(1, "Nombre del producto es requerido"),
  customSku: z.string().optional(),
  pricingMode: z.enum(["calculated", "direct"]).optional(),
  quantity: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  unitPrice: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  costOfProduction: z.union([z.string(), z.number()]).optional().transform((val) => 
    val === undefined || val === null ? undefined : (typeof val === 'string' ? val : val.toString())
  ),
  profitMargin: z.union([z.string(), z.number()]).optional().transform((val) => 
    val === undefined || val === null ? undefined : (typeof val === 'string' ? val : val.toString())
  ),
}).omit({
  id: true,
  createdAt: true,
  totalPrice: true, // Calculated
});

// Update schemas for PATCH operations
export const updateOrderSchema = insertOrderSchema.partial().omit({
  createdBy: true, // Cannot change creator
});

export const updateOrderItemSchema = insertOrderItemSchema.partial();

// Schema for adding individual items to existing orders
export const addOrderItemSchema = insertOrderItemSchema.extend({
  orderId: z.string().min(1, "ID del pedido es requerido"),
}).omit({
  totalPrice: true, // Calculated automatically
});

// Schema for updating individual items
export const updateOrderItemByIdSchema = updateOrderItemSchema.extend({
  id: z.string().min(1, "ID del item es requerido"),
});

// Schema for order totals recalculation
export const orderTotalsSchema = z.object({
  subtotal: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  discount: z.union([z.string(), z.number()]).optional().transform((val) => 
    val === undefined || val === null ? "0" : (typeof val === 'string' ? val : val.toString())
  ),
  taxRate: z.union([z.string(), z.number()]).optional().transform((val) => 
    val === undefined || val === null ? "19" : (typeof val === 'string' ? val : val.toString())
  ),
  taxAmount: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  total: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
});

// Types
export type InsertOrderInput = z.infer<typeof insertOrderSchema>;
export type InsertOrderItemInput = z.infer<typeof insertOrderItemSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type UpdateOrderItemByIdInput = z.infer<typeof updateOrderItemByIdSchema>;
export type OrderTotalsInput = z.infer<typeof orderTotalsSchema>;

// Helper function to calculate order totals
export function calculateOrderTotals(
  items: { quantity: number; unitPrice: number }[],
  discountAmount: number = 0,
  taxRate: number = 19
): { subtotal: number; discount: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountedAmount = subtotal - discountAmount;
  const taxAmount = discountedAmount * (taxRate / 100);
  const total = discountedAmount + taxAmount;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}


// Price List - Lista de Precios Comercial
export const priceList = pgTable("price_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codigo: varchar("codigo").notNull().unique(), // Product code
  producto: text("producto").notNull(), // Product name
  unidad: varchar("unidad"), // Unit (1/4 de galón, etc.)
  lista: numeric("lista", { precision: 15, scale: 2 }), // List price
  desc10: numeric("desc10", { precision: 15, scale: 2 }), // 10% discount price
  desc10_5: numeric("desc10_5", { precision: 15, scale: 2 }), // 10%+5% discount price
  desc10_5_3: numeric("desc10_5_3", { precision: 15, scale: 2 }), // 10%+5%+3% discount price
  minimo: numeric("minimo", { precision: 15, scale: 2 }), // Minimum price
  canalDigital: numeric("canal_digital", { precision: 15, scale: 2 }), // Digital channel price
  esPersonalizado: varchar("es_personalizado").default("No"), // Is customized
  costoProduccion: numeric("costo_produccion", { precision: 15, scale: 2 }), // Production cost
  porcentajeUtilidad: numeric("porcentaje_utilidad", { precision: 10, scale: 2 }), // Profit percentage
  modoPrecio: varchar("modo_precio"), // Price mode
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Helper function for flexible value transformation
const flexibleTransform = (val: any): string | undefined => {
  // Handle null, undefined, empty strings, and common null representations
  if (val === undefined || val === null || val === '' || 
      (typeof val === 'string' && ['N/A', 'NULL', 'null', '-', '--', 'n/a'].includes(val.trim().toLowerCase()))) {
    return undefined;
  }
  
  // Convert to string and trim
  const stringVal = String(val).trim();
  
  // Return undefined for empty string after trim
  return stringVal === '' ? undefined : stringVal;
};

// Price List schemas with robust validation
export const insertPriceListSchema = createInsertSchema(priceList, {
  codigo: z.string().min(1, "Código es requerido"),
  producto: z.string().min(1, "Producto es requerido"),
  unidad: z.any().optional().transform(flexibleTransform),
  
  // Numeric fields with flexible parsing
  lista: z.any().optional().transform(flexibleTransform),
  desc10: z.any().optional().transform(flexibleTransform),
  desc10_5: z.any().optional().transform(flexibleTransform),
  desc10_5_3: z.any().optional().transform(flexibleTransform),
  minimo: z.any().optional().transform(flexibleTransform),
  canalDigital: z.any().optional().transform(flexibleTransform),
  
  // Special fields
  esPersonalizado: z.any().optional().transform((val) => {
    if (val === undefined || val === null || val === '') return "No";
    const stringVal = String(val).toLowerCase().trim();
    return ['si', 'sí', 'yes', 'true', '1'].includes(stringVal) ? "Si" : "No";
  }),
  
  // Cost and utility fields - more flexible
  costoProduccion: z.any().optional().transform(flexibleTransform),
  porcentajeUtilidad: z.any().optional().transform(flexibleTransform),
  modoPrecio: z.any().optional().transform(flexibleTransform),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Validation schema for CSV import with detailed error reporting
export const csvPriceListRowSchema = z.object({
  codigo: z.string().min(1, "Código es requerido"),
  producto: z.string().min(1, "Producto es requerido"),
  unidad: z.string().optional(),
  lista: z.string().optional(),
  desc10: z.string().optional(),
  desc10_5: z.string().optional(),
  desc10_5_3: z.string().optional(),
  minimo: z.string().optional(),
  canalDigital: z.string().optional(),
  esPersonalizado: z.string().optional(),
  costoProduccion: z.string().optional(),
  porcentajeUtilidad: z.string().optional(),
  modoPrecio: z.string().optional(),
}).passthrough(); // Allow extra fields that will be ignored

// Types
export type PriceList = typeof priceList.$inferSelect;
export type InsertPriceList = typeof priceList.$inferInsert;
export type InsertPriceListInput = z.infer<typeof insertPriceListSchema>;

// Quotes system - Constructor de Presupuesto
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: varchar("quote_number").notNull().unique(), // Auto-generated quote number
  clientName: text("client_name").notNull(), // Client name
  clientId: varchar("client_id"), // Optional FK to clients.id
  clientRut: varchar("client_rut"), // Client RUT for new clients
  clientEmail: varchar("client_email"), // Client email
  clientPhone: varchar("client_phone"), // Client phone
  clientAddress: text("client_address"), // Client address
  createdBy: varchar("created_by").notNull(), // FK to users.id
  status: varchar("status").default("draft"), // draft, sent, accepted, rejected, converted
  validUntil: timestamp("valid_until"), // Quote expiration
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }), // Subtotal before taxes
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"), // Discount amount
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("19"), // IVA rate (19% default)
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }), // Calculated tax
  total: numeric("total", { precision: 15, scale: 2 }), // Final total
  notes: text("notes"), // Additional notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull(), // FK to quotes.id
  type: varchar("type").notNull(), // "standard" | "custom"
  // For standard products
  productCode: varchar("product_code"), // From price_list.codigo
  productName: text("product_name").notNull(), // Product name
  // For custom products
  customSku: varchar("custom_sku"), // Custom SKU
  costOfProduction: numeric("cost_of_production", { precision: 15, scale: 2 }), // Custom cost
  profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }), // Custom profit %
  pricingMode: varchar("pricing_mode"), // "calculated" | "direct"
  // Common fields
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"), // Item-specific notes
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for quotes
export const quotesRelations = relations(quotes, ({ many, one }) => ({
  items: many(quoteItems),
  creator: one(users, {
    fields: [quotes.createdBy],
    references: [users.id],
  }),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
}));

// Quote schemas
export const insertQuoteSchema = createInsertSchema(quotes, {
  clientName: z.string().min(1, "Nombre del cliente es requerido"),
  clientRut: z.string().optional(),
  clientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "converted"]).default("draft"),
  validUntil: z.string().optional().or(z.null()),
  notes: z.string().optional(),
}).omit({
  id: true,
  quoteNumber: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
  // Allow subtotal, taxAmount, total to be sent from frontend
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems, {
  type: z.enum(["standard", "custom"]),
  productName: z.string().min(1, "Nombre del producto es requerido"),
  customSku: z.string().optional(),
  pricingMode: z.enum(["calculated", "direct"]).optional(),
  quantity: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  unitPrice: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  costOfProduction: z.union([z.string(), z.number()]).optional().transform((val) => 
    val === undefined || val === null ? undefined : (typeof val === 'string' ? val : val.toString())
  ),
  profitMargin: z.union([z.string(), z.number()]).optional().transform((val) => 
    val === undefined || val === null ? undefined : (typeof val === 'string' ? val : val.toString())
  ),
}).omit({
  id: true,
  createdAt: true,
  totalPrice: true, // Calculated
});

// Update schemas for Quote CRUD operations (enhance existing for consistency)
export const updateQuoteSchema = insertQuoteSchema.partial().omit({
  createdBy: true, // Cannot change creator
});

export const updateQuoteItemSchema = insertQuoteItemSchema.partial();

// Schema for adding individual items to existing quotes
export const addQuoteItemSchema = insertQuoteItemSchema.extend({
  quoteId: z.string().min(1, "ID de la cotización es requerido"),
});

// Schema for updating individual quote items
export const updateQuoteItemByIdSchema = updateQuoteItemSchema.extend({
  id: z.string().min(1, "ID del item es requerido"),
});

// Additional Quote types for consistency
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;
export type AddQuoteItemInput = z.infer<typeof addQuoteItemSchema>;
export type UpdateQuoteItemByIdInput = z.infer<typeof updateQuoteItemByIdSchema>;

// Types
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;
export type InsertQuoteInput = z.infer<typeof insertQuoteSchema>;
export type InsertQuoteItemInput = z.infer<typeof insertQuoteItemSchema>;

// eCommerce Categories - Categorías para organizar productos en la tienda
export const ecommerceCategories = pgTable("ecommerce_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre").notNull().unique(), // Category name
  descripcion: text("descripcion"), // Category description
  activa: boolean("activa").default(true), // Is category active
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// eCommerce Product Groups - Grupos de productos para manejar variaciones
export const ecommerceProductGroups = pgTable("ecommerce_product_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre").notNull(), // Nombre del grupo (ej: "Anticorrosivo Estructural Galón")
  descripcion: text("descripcion"), // Descripción del grupo
  imagenPrincipal: varchar("imagen_principal"), // Imagen principal del grupo
  categoria: varchar("categoria"), // Categoría del grupo
  activo: boolean("activo").default(true), // Si el grupo aparece en la tienda
  orden: integer("orden").default(0), // Orden de visualización
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// eCommerce Products - Vinculación de productos de priceList con configuración ecommerce
export const ecommerceProducts = pgTable("ecommerce_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  priceListId: varchar("price_list_id").notNull(), // FK to priceList.id
  groupId: varchar("group_id"), // FK to ecommerceProductGroups.id (null si no está agrupado)
  activo: boolean("activo").default(false), // Si aparece en la tienda
  categoria: varchar("categoria"), // Categoría asignada
  descripcion: text("descripcion"), // Descripción para la tienda
  imagenUrl: varchar("imagen_url"), // URL de imagen del producto
  precioEcommerce: numeric("precio_ecommerce", { precision: 15, scale: 2 }), // Precio específico para ecommerce
  variantLabel: varchar("variant_label"), // Etiqueta de variación (ej: "Color: Rojo")
  isMainVariant: boolean("is_main_variant").default(false), // Si es la variante principal del grupo
  orden: integer("orden").default(0), // Orden de visualización
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Constraint único para un producto por priceList
  uniquePriceListProduct: unique("unique_price_list_product").on(table.priceListId),
}));

// Schemas for eCommerce Categories
export const insertEcommerceCategorySchema = createInsertSchema(ecommerceCategories, {
  nombre: z.string().min(1, "Nombre de categoría es requerido"),
  descripcion: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schemas for eCommerce Product Groups
export const insertEcommerceProductGroupSchema = createInsertSchema(ecommerceProductGroups, {
  nombre: z.string().min(1, "Nombre del grupo es requerido"),
  descripcion: z.string().optional(),
  imagenPrincipal: z.string().optional(),
  categoria: z.string().optional(),
  activo: z.boolean().optional(),
  orden: z.number().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateEcommerceProductGroupSchema = insertEcommerceProductGroupSchema.partial();

// Schemas for eCommerce Products  
export const insertEcommerceProductSchema = createInsertSchema(ecommerceProducts, {
  priceListId: z.string().min(1, "ID de producto de lista de precios es requerido"),
  groupId: z.string().optional(),
  categoria: z.string().optional(),
  descripcion: z.string().optional(),
  imagenUrl: z.string().url("URL de imagen inválida").optional().or(z.literal("")),
  variantLabel: z.string().optional(),
  isMainVariant: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type EcommerceCategory = typeof ecommerceCategories.$inferSelect;
export type InsertEcommerceCategory = typeof ecommerceCategories.$inferInsert;
export type InsertEcommerceCategoryInput = z.infer<typeof insertEcommerceCategorySchema>;

export type EcommerceProductGroup = typeof ecommerceProductGroups.$inferSelect;
export type InsertEcommerceProductGroup = typeof ecommerceProductGroups.$inferInsert;
export type InsertEcommerceProductGroupInput = z.infer<typeof insertEcommerceProductGroupSchema>;
export type UpdateEcommerceProductGroupInput = z.infer<typeof updateEcommerceProductGroupSchema>;

export type EcommerceProduct = typeof ecommerceProducts.$inferSelect;
export type InsertEcommerceProduct = typeof ecommerceProducts.$inferInsert;
export type InsertEcommerceProductInput = z.infer<typeof insertEcommerceProductSchema>;

// Store Configuration - Configuración general de la tienda
export const storeConfig = pgTable("store_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteName: varchar("site_name").default("Pinturas Panoramica"),
  logoUrl: varchar("logo_url"), // URL del logo principal
  faviconUrl: varchar("favicon_url"), // Favicon
  primaryColor: varchar("primary_color").default("#FF6B35"), // Color naranja principal
  secondaryColor: varchar("secondary_color").default("#2C3E50"), // Color secundario
  headerSearchPlaceholder: varchar("header_search_placeholder").default("Buscar productos..."),
  contactInfo: jsonb("contact_info").$type<{
    phone?: string;
    email?: string;
    address?: string;
    whatsapp?: string;
  }>(), // Información de contacto
  socialMedia: jsonb("social_media").$type<{
    facebook?: string;
    instagram?: string;
    twitter?: string;
  }>(), // Redes sociales
  seoSettings: jsonb("seo_settings").$type<{
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  }>(), // Configuración SEO
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store Banners - Banners administrables para la tienda
export const storeBanners = pgTable("store_banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  titulo: varchar("titulo").notNull(), // Ej: "OFERTA DEL MES"
  subtitulo: varchar("subtitulo"), // Ej: "STAIN"
  descripcion: text("descripcion"), // Ej: "IMPERMEANTE DE MADERA"
  imagenDesktop: varchar("imagen_desktop").notNull(), // Imagen para escritorio
  imagenMobile: varchar("imagen_mobile"), // Imagen específica para móvil
  colorFondo: varchar("color_fondo").default("#FF6B35"), // Color de fondo del banner
  colorTexto: varchar("color_texto").default("#FFFFFF"), // Color del texto
  linkUrl: varchar("link_url"), // URL de destino del banner
  orden: integer("orden").default(0), // Orden de visualización
  activo: boolean("activo").default(true), // Si el banner está activo
  tipoVisualizacion: varchar("tipo_visualizacion").default("hero"), // hero, secundario, lateral
  fechaInicio: timestamp("fecha_inicio"), // Fecha de inicio (opcional)
  fechaFin: timestamp("fecha_fin"), // Fecha de fin (opcional)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Images - Múltiples imágenes por producto
export const productImages = pgTable("product_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ecommerceProductId: varchar("ecommerce_product_id").notNull(), // FK to ecommerceProducts.id
  imageUrl: varchar("image_url").notNull(), // URL de la imagen
  altText: varchar("alt_text"), // Texto alternativo
  orden: integer("orden").default(0), // Orden de visualización (0 = principal, 1 = segunda, etc.)
  tipoImagen: varchar("tipo_imagen").default("producto"), // producto, detalle, ambiente, etc.
  activa: boolean("activa").default(true), // Si la imagen está activa
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Índice para búsquedas rápidas por producto
  productImageIndex: index("product_image_idx").on(table.ecommerceProductId, table.orden),
}));

// Store Categories - Categorías específicas para la navegación de la tienda
export const storeNavigation = pgTable("store_navigation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre").notNull(), // Nombre del menú
  slug: varchar("slug").notNull().unique(), // URL amigable
  icono: varchar("icono"), // Ícono opcional
  descripcion: text("descripcion"), // Descripción
  parentId: varchar("parent_id"), // Para submenús
  orden: integer("orden").default(0), // Orden en el menú
  activo: boolean("activo").default(true), // Si aparece en navegación
  linkExterno: varchar("link_externo"), // Para enlaces externos
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schemas for Store Config
export const insertStoreConfigSchema = createInsertSchema(storeConfig, {
  siteName: z.string().min(1, "Nombre del sitio es requerido"),
  logoUrl: z.string().url("URL del logo inválida").optional().or(z.literal("")),
  faviconUrl: z.string().url("URL del favicon inválida").optional().or(z.literal("")),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schemas for Store Banners
export const insertStoreBannerSchema = createInsertSchema(storeBanners, {
  titulo: z.string().min(1, "Título del banner es requerido"),
  imagenDesktop: z.string().url("URL de imagen de escritorio inválida"),
  imagenMobile: z.string().url("URL de imagen móvil inválida").optional().or(z.literal("")),
  linkUrl: z.string().url("URL de destino inválida").optional().or(z.literal("")),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schemas for Product Images
export const insertProductImageSchema = createInsertSchema(productImages, {
  ecommerceProductId: z.string().min(1, "ID de producto es requerido"),
  imageUrl: z.string().url("URL de imagen inválida"),
  altText: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schemas for Store Navigation
export const insertStoreNavigationSchema = createInsertSchema(storeNavigation, {
  nombre: z.string().min(1, "Nombre del menú es requerido"),
  slug: z.string().min(1, "Slug es requerido"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type StoreConfig = typeof storeConfig.$inferSelect;
export type InsertStoreConfig = typeof storeConfig.$inferInsert;
export type StoreBanner = typeof storeBanners.$inferSelect;
export type InsertStoreBanner = typeof storeBanners.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = typeof productImages.$inferInsert;
export type StoreNavigation = typeof storeNavigation.$inferSelect;
export type InsertStoreNavigation = typeof storeNavigation.$inferInsert;

export type InsertStoreConfigInput = z.infer<typeof insertStoreConfigSchema>;
export type InsertStoreBannerInput = z.infer<typeof insertStoreBannerSchema>;
export type InsertProductImageInput = z.infer<typeof insertProductImageSchema>;
export type InsertStoreNavigationInput = z.infer<typeof insertStoreNavigationSchema>;

// ================================
// CART DATA MODEL & TYPES
// ================================

// Cart item interface - represents a product with selections in the cart
export interface CartItem {
  // Product identification
  id: string; // Unique cart item ID (allows same product with different variations)
  productId: string; // Product ID from products table
  productCode: string; // KOPR code from products table
  productName: string; // Product name
  productSlug?: string; // For product page navigation
  
  // Product variations/selections
  selectedPackaging?: string; // E.g., "Galón", "Balde 4 Galones", "1/4"
  selectedColor?: string; // E.g., "BLANCO", "NEGRO", etc.
  selectedFinish?: string; // E.g., "Mate", "Satinado", etc.
  unit: string; // Base unit from ud02pr (GL, BD4, 1/4, etc.)
  
  // Pricing and quantity
  unitPrice: number; // Price per unit in CLP
  quantity: number; // Selected quantity (must follow validation rules)
  subtotal: number; // unitPrice * quantity (calculated)
  
  // Product information for display
  imageUrl?: string; // Primary product image
  category?: string; // Product category
  
  // Metadata
  addedAt: string; // ISO timestamp when added to cart
  updatedAt: string; // ISO timestamp when last modified
  
  // Validation metadata
  minQuantity: number; // Minimum quantity based on unit type
  quantityStep: number; // Step increment (1 for BD, 4 for GL, 6 for 1/4)
}

// Cart state interface
export interface CartState {
  items: CartItem[];
  
  // Calculated totals
  subtotal: number; // Sum of all item subtotals
  taxAmount: number; // IVA (19% in Chile)
  discountAmount: number; // Total discount amount
  total: number; // Final total (subtotal + tax - discount)
  
  // Cart metrics
  itemCount: number; // Total number of different items
  unitCount: number; // Total number of units (sum of all quantities)
  
  // Applied discounts/coupons
  appliedCoupons: Array<{
    code: string;
    discount: number; // Discount amount in CLP
    type: 'percentage' | 'fixed'; // Discount type
    description?: string;
  }>;
  
  // Metadata
  lastUpdated: string; // ISO timestamp
  sessionId?: string; // For guest cart tracking
  version: string; // Schema version for future migrations
}

// Cart action types
export type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'id' | 'subtotal' | 'addedAt' | 'updatedAt'> }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<CartItem> } }
  | { type: 'CLEAR_CART' }
  | { type: 'APPLY_COUPON'; payload: { code: string; discount: number; type: 'percentage' | 'fixed'; description?: string } }
  | { type: 'REMOVE_COUPON'; payload: { code: string } }
  | { type: 'LOAD_CART'; payload: CartState }
  | { type: 'CALCULATE_TOTALS' };

// Quantity validation rules based on unit types
export interface QuantityRules {
  unit: string; // Unit identifier (GL, BD4, BD5, 1/4, etc.)
  minQuantity: number; // Minimum order quantity
  stepQuantity: number; // Increment step (1, 4, 6, etc.)
  displayName: string; // Human readable unit name
  description: string; // Help text for quantity rules
}

// Cart configuration constants
export const CART_CONFIG = {
  TAX_RATE: 0.19, // Chilean IVA rate (19%)
  CURRENCY: 'CLP',
  CURRENCY_SYMBOL: '$',
  MAX_ITEMS: 50, // Maximum number of different items in cart
  MAX_QUANTITY_PER_ITEM: 999,
  
  // Quantity rules by unit type
  QUANTITY_RULES: {
    // Baldes - individual units
    BD4: { minQuantity: 1, stepQuantity: 1, displayName: 'Balde 4 Galones', description: 'Mínimo 1 unidad' },
    BD5: { minQuantity: 1, stepQuantity: 1, displayName: 'Balde 5 Galones', description: 'Mínimo 1 unidad' },
    
    // Galones - multiples of 4
    GL: { minQuantity: 4, stepQuantity: 4, displayName: 'Galón', description: 'Mínimo 4 galones' },
    GAL: { minQuantity: 4, stepQuantity: 4, displayName: 'Galón', description: 'Mínimo 4 galones' },
    
    // Cuartos - multiples of 6
    '1/4': { minQuantity: 6, stepQuantity: 6, displayName: '1/4 Galón', description: 'Mínimo 6 unidades' },
    'CUARTO': { minQuantity: 6, stepQuantity: 6, displayName: '1/4 Galón', description: 'Mínimo 6 unidades' },
    
    // Default for other units
    DEFAULT: { minQuantity: 1, stepQuantity: 1, displayName: 'Unidad', description: 'Mínimo 1 unidad' }
  } as const
} as const;

// Helper functions for cart calculations
export interface CartCalculations {
  calculateItemSubtotal: (unitPrice: number, quantity: number) => number;
  calculateCartSubtotal: (items: CartItem[]) => number;
  calculateTax: (subtotal: number, taxRate?: number) => number;
  calculateDiscount: (subtotal: number, coupons: CartState['appliedCoupons']) => number;
  calculateTotal: (subtotal: number, taxAmount: number, discountAmount: number) => number;
  validateQuantity: (quantity: number, unit: string) => { isValid: boolean; validQuantity: number; minQuantity: number; stepQuantity: number };
  generateCartItemId: (productId: string, variations?: Record<string, string>) => string;
}

// Zod schemas for cart validation
export const cartItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productCode: z.string(),
  productName: z.string(),
  productSlug: z.string().optional(),
  selectedPackaging: z.string().optional(),
  selectedColor: z.string().optional(), 
  selectedFinish: z.string().optional(),
  unit: z.string(),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1),
  subtotal: z.number().min(0),
  imageUrl: z.string().optional(),
  category: z.string().optional(),
  addedAt: z.string(),
  updatedAt: z.string(),
  minQuantity: z.number().int().min(1),
  quantityStep: z.number().int().min(1),
});

export const cartStateSchema = z.object({
  items: z.array(cartItemSchema),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0),
  total: z.number().min(0),
  itemCount: z.number().int().min(0),
  unitCount: z.number().int().min(0),
  appliedCoupons: z.array(z.object({
    code: z.string(),
    discount: z.number().min(0),
    type: z.enum(['percentage', 'fixed']),
    description: z.string().optional(),
  })),
  lastUpdated: z.string(),
  sessionId: z.string().optional(),
  version: z.string().default('1.0.0'),
});

// Export cart types for TypeScript inference
export type CartItemType = z.infer<typeof cartItemSchema>;
export type CartStateType = z.infer<typeof cartStateSchema>;

// ==============================================
// NVV (Notas de Ventas Pendientes) Table
// ==============================================

// Notas de Ventas Pendientes table for committed orders
export const nvvPendingSales = pgTable("nvv_pending_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // ALL NVV CSV COLUMNS WITH EXACT NAMES - For easy linking with other systems
  IDMAEEDO: numeric("IDMAEEDO", { precision: 15, scale: 2 }),
  TIDO: varchar("TIDO"),
  NUDO: varchar("NUDO"), 
  ENDO: varchar("ENDO"),
  SUENDO: varchar("SUENDO"),
  SUDO: varchar("SUDO"),
  FEEMDO: date("FEEMDO"),
  FEER: date("FEER"),
  MODO: varchar("MODO"),
  TIMODO: varchar("TIMODO"),
  TIDEVE: varchar("TIDEVE"),
  TIDEVEFE: date("TIDEVEFE"),
  TIDEVEHO: varchar("TIDEVEHO"),
  PPPRNE: numeric("PPPRNE", { precision: 15, scale: 2 }),
  TAMOPPPR: numeric("TAMOPPPR", { precision: 15, scale: 2 }),
  VANELI: numeric("VANELI", { precision: 15, scale: 2 }),
  FEEMLI: date("FEEMLI"),
  KOFULIDO: varchar("KOFULIDO"), // Vendedor
  LILG: varchar("LILG"),
  PRCT: varchar("PRCT"),
  NULIDO: varchar("NULIDO"),
  FEERLI: date("FEERLI"), // Fecha compromiso - CAMPO PRINCIPAL
  SULIDO: varchar("SULIDO"),
  BOSULIDO: varchar("BOSULIDO"),
  LUVTLIDO: integer("LUVTLIDO"),
  KOPRCT: varchar("KOPRCT"), // Código producto/SKU
  UD01PR: varchar("UD01PR"),
  NOKOZO: varchar("NOKOZO"),
  IDMAEDDO: numeric("IDMAEDDO", { precision: 15, scale: 2 }),
  NUSEPR: varchar("NUSEPR"),
  CAPRCO1: numeric("CAPRCO1", { precision: 10, scale: 2 }),
  CAPRAD1: numeric("CAPRAD1", { precision: 10, scale: 2 }),
  CAPREX1: numeric("CAPREX1", { precision: 10, scale: 2 }),
  UD02PR: varchar("UD02PR"),
  CAPRCO2: numeric("CAPRCO2", { precision: 10, scale: 2 }), // Cantidad confirmada
  CAPRAD2: numeric("CAPRAD2", { precision: 10, scale: 2 }),
  CAPREX2: numeric("CAPREX2", { precision: 10, scale: 2 }), // Cantidad requerida
  OCDO: varchar("OCDO"),
  OBDO: varchar("OBDO"),
  NOKOEN: varchar("NOKOEN"), // Nombre cliente
  ZOEN: varchar("ZOEN"),
  DIEN: varchar("DIEN"),
  COMUNA: varchar("COMUNA"), // Comuna
  TIPR: varchar("TIPR"),
  NOKOPR: text("NOKOPR"), // Nombre producto
  PFPR: varchar("PFPR"),
  FMPR: varchar("FMPR"),
  RUPR: varchar("RUPR"),
  MRPR: varchar("MRPR"),
  STFI1: numeric("STFI1", { precision: 10, scale: 2 }),
  STFI2: numeric("STFI2", { precision: 10, scale: 2 }),
  PRRG: varchar("PRRG"),
  KOPRTE: varchar("KOPRTE"),
  ENDOFI: varchar("ENDOFI"),
  UBICACION: varchar("UBICACION"),
  OBSERVA: text("OBSERVA"), // Observaciones
  
  // Calculated fields as requested
  cantidadPendiente: numeric("cantidad_pendiente", { precision: 10, scale: 2 }), // CAPRCO2 - CAPREX2
  totalPendiente: numeric("total_pendiente", { precision: 15, scale: 2 }), // PPPRNE * cantidadPendiente
  
  // System fields for tracking
  importedAt: timestamp("imported_at").defaultNow(),
  importBatch: varchar("import_batch"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Indexes for performance on key fields
  nudoIdx: index("nvv_pending_sales_nudo_idx").on(table.NUDO),
  nokoenIdx: index("nvv_pending_sales_nokoen_idx").on(table.NOKOEN),
  koprctIdx: index("nvv_pending_sales_koprct_idx").on(table.KOPRCT),
  feerliIdx: index("nvv_pending_sales_feerli_idx").on(table.FEERLI),
  kofulidoIdx: index("nvv_pending_sales_kofulido_idx").on(table.KOFULIDO),
  importBatchIdx: index("nvv_pending_sales_import_batch_idx").on(table.importBatch),
}));

// ==============================================
// NVV (Nivel de Venta y Variación) Schemas
// ==============================================

// NVV Summary KPIs
export const nvvSummarySchema = z.object({
  totalSales: z.number(),
  salesVarianceVsTarget: z.number().nullable(), // Percentage variance vs goal
  salesVarianceVsPrevious: z.number().nullable(), // Percentage variance vs previous period
  totalUnits: z.number(),
  averageTicket: z.number(),
  period: z.string(),
  periodLabel: z.string(),
});

// NVV Trend data points
export const nvvTrendPointSchema = z.object({
  period: z.string(), // Date string or period identifier
  periodLabel: z.string(), // Human readable period label
  sales: z.number(),
  units: z.number(),
  target: z.number().nullable(), // Goal for this period if available
});

// NVV Breakdown items (by segment or salesperson)
export const nvvBreakdownItemSchema = z.object({
  name: z.string(), // Segment name or salesperson name
  type: z.enum(['segment', 'salesperson']),
  sales: z.number(),
  units: z.number(),
  target: z.number().nullable(),
  varianceVsTarget: z.number().nullable(), // Percentage variance vs target
  varianceVsPrevious: z.number().nullable(), // Percentage variance vs previous period
  previousSales: z.number().nullable(),
});

// Export NVV types for TypeScript inference
export type NVVSummary = z.infer<typeof nvvSummarySchema>;
export type NVVTrendPoint = z.infer<typeof nvvTrendPointSchema>;
export type NVVBreakdownItem = z.infer<typeof nvvBreakdownItemSchema>;

// ==============================================
// NVV Pending Sales Schemas
// ==============================================

// NVV Pending Sales insert schema (for CSV import)
export const insertNvvPendingSalesSchema = createInsertSchema(nvvPendingSales).omit({
  id: true,
  importedAt: true,
  createdAt: true,
  updatedAt: true,
});

// NVV Pending Sales CSV import schema (flexible for different CSV formats)
export const nvvCsvImportSchema = z.object({
  // Core required fields
  documentNumber: z.string().min(1, "Número de documento requerido"),
  clientName: z.string().min(1, "Nombre del cliente requerido"),
  productName: z.string().min(1, "Nombre del producto requerido"),
  quantity: z.number().positive("Cantidad debe ser positiva"),
  totalAmount: z.number().positive("Monto total debe ser positivo"),
  
  // Optional fields with defaults
  documentType: z.string().optional(),
  clientCode: z.string().optional(),
  productCode: z.string().optional(),
  salesperson: z.string().optional(),
  segment: z.string().optional(),
  unitPrice: z.number().optional(),
  currency: z.string().default("CLP"),
  commitmentDate: z.date().optional(),
  expectedDeliveryDate: z.date().optional(),
  orderDate: z.date().optional(),
  status: z.enum(["pending", "confirmed", "delivered", "cancelled"]).default("pending"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  warehouse: z.string().optional(),
  region: z.string().optional(),
  commune: z.string().optional(),
  notes: z.string().optional(),
});

// NVV Import result schema
export const nvvImportResultSchema = z.object({
  success: z.boolean(),
  totalRows: z.number(),
  successfulImports: z.number(),
  errors: z.array(z.object({
    row: z.number(),
    field: z.string().optional(),
    message: z.string(),
    data: z.record(z.any()).optional(),
  })),
  importBatch: z.string(),
});

// Comuna-Region mapping table for intelligent geographic analysis
export const comunaRegionMapping = pgTable("comuna_region_mapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  comuna: varchar("comuna").notNull(), // Comuna name as it appears in original data
  region: varchar("region").notNull(), // Official region name
  comunaNormalized: varchar("comuna_normalized").notNull(), // Normalized for matching
  regionNormalized: varchar("region_normalized").notNull(), // Normalized region name
  isActive: boolean("is_active").default(true), // For soft deletes/deactivation
  matchingStrategy: varchar("matching_strategy").default("exact"), // exact, partial, manual
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for fast lookup by normalized comuna
  comunaNormalizedIdx: index("IDX_comuna_normalized").on(table.comunaNormalized),
  // Index for queries by region
  regionIdx: index("IDX_region").on(table.region),
  // Unique constraint to prevent duplicates
  uniqueComunaRegion: unique("unique_comuna_region").on(table.comunaNormalized),
}));

// Insert schema for comuna-region mapping
export const insertComunaRegionMappingSchema = createInsertSchema(comunaRegionMapping).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export NVV Pending Sales types
export type NvvPendingSales = typeof nvvPendingSales.$inferSelect;
export type InsertNvvPendingSales = z.infer<typeof insertNvvPendingSalesSchema>;
export type NvvCsvImport = z.infer<typeof nvvCsvImportSchema>;
export type NvvImportResult = z.infer<typeof nvvImportResultSchema>;

// Export Comuna-Region Mapping types
export type ComunaRegionMapping = typeof comunaRegionMapping.$inferSelect;
export type InsertComunaRegionMapping = z.infer<typeof insertComunaRegionMappingSchema>;

// ==============================================
// File Uploads Registry
// ==============================================

// Track all CSV file uploads for data import history and image ZIP imports
export const fileUploads = pgTable("file_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileType: varchar("file_type").notNull(), // 'sales', 'products', 'nvv', 'prices', 'image_zip', etc.
  fileName: varchar("file_name").notNull(), // Original filename
  uploadedBy: varchar("uploaded_by").notNull(), // User ID who uploaded the file
  uploadedAt: timestamp("uploaded_at").defaultNow(), // When file was uploaded
  recordsImported: integer("records_imported").default(0), // How many records were imported
  recordsErrors: integer("records_errors").default(0), // How many records failed
  status: varchar("status").default("pending"), // 'pending', 'processing', 'success', 'partial', 'error', 'cancelled'
  errorMessage: text("error_message"), // Error details if import failed
  fileSize: integer("file_size"), // File size in bytes
  // Extended fields for image ZIP import tracking
  totalFiles: integer("total_files").default(0), // Total files in ZIP to process
  processedFiles: integer("processed_files").default(0), // Files processed so far
  successfulFiles: integer("successful_files").default(0), // Files successfully uploaded
  failedFiles: integer("failed_files").default(0), // Files that failed
  progressData: jsonb("progress_data"), // JSON for detailed progress tracking
  resultData: jsonb("result_data"), // JSON for detailed results (matched/unmatched products, errors)
  isCompleted: boolean("is_completed").default(false), // Whether job is done (success/error/partial)
  completedAt: timestamp("completed_at"), // When job finished
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schema for file uploads
export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({
  id: true,
  createdAt: true,
});

// Export File Upload types
export type FileUpload = typeof fileUploads.$inferSelect;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;

// ==============================================
// OBRAS (PROJECTS/WORKS) SYSTEM
// ==============================================

// Obras table - Projects/Works assigned to clients
export const obras = pgTable("obras", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clienteId: varchar("cliente_id").notNull(), // FK to clients.id
  nombre: text("nombre").notNull(), // Nombre de la obra
  direccion: text("direccion").notNull(), // Dirección de la obra
  descripcion: text("descripcion"), // Descripción opcional
  estado: varchar("estado").notNull().default("activa"), // 'activa', 'completada', 'cancelada'
  fechaInicio: date("fecha_inicio"), // Fecha de inicio opcional
  fechaEstimadaFin: date("fecha_estimada_fin"), // Fecha estimada de fin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema for obras
export const insertObraSchema = createInsertSchema(obras).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export Obra types
export type Obra = typeof obras.$inferSelect;
export type InsertObra = z.infer<typeof insertObraSchema>;

// ==============================================
// VISITAS TÉCNICAS SYSTEM
// ==============================================

// Visitas técnicas table - Main table for technical visits
export const visitasTecnicas = pgTable("visitas_tecnicas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Información básica de la visita
  obraId: varchar("obra_id"), // FK to obras.id (opcional)
  nombreObra: text("nombre_obra").notNull(),
  direccionObra: text("direccion_obra").notNull(),
  tecnicoId: varchar("tecnico_id").notNull(), // FK to users.id
  vendedorId: varchar("vendedor_id"), // FK to users.id
  clienteId: varchar("cliente_id"), // FK to clients.id (opcional si se usa clienteManual)
  clienteManual: text("cliente_manual"), // Cliente manual si no está en la lista
  
  // Recepcionista
  recepcionistaNombre: text("recepcionista_nombre"),
  recepcionistaCargo: text("recepcionista_cargo"),
  
  // Estados de la visita
  estado: varchar("estado").notNull().default("borrador"), // 'borrador', 'completada'
  
  // Evaluación técnica general
  aplicacionGeneral: varchar("aplicacion_general"), // 'correcta', 'deficiente'
  tipoSuperficie: text("tipo_superficie"),
  ambiente: varchar("ambiente"), // 'interior', 'exterior'
  condicionesClimaticas: text("condiciones_climaticas"),
  dilucion: text("dilucion"),
  observacionesGenerales: text("observaciones_generales"),
  
  // Comentarios generales
  comentarios: text("comentarios"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contactos de visita table - Specific contacts for each visit
export const contactosVisita = pgTable("contactos_visita", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id").notNull(), // FK to visitasTecnicas.id
  
  // Contratista
  contratistaNombre: varchar("contratista_nombre"),
  contratistaTelefono: varchar("contratista_telefono"),
  contratistaEmail: varchar("contratista_email"),
  
  // Administrador de obra
  administradorNombre: varchar("administrador_nombre"),
  administradorTelefono: varchar("administrador_telefono"),
  administradorEmail: varchar("administrador_email"),
  
  // Supervisor/Capataz
  supervisorNombre: varchar("supervisor_nombre"),
  supervisorTelefono: varchar("supervisor_telefono"),
  supervisorEmail: varchar("supervisor_email"),
  
  // Campo contacto general (legacy)
  contactoGeneral: text("contacto_general"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Productos evaluados table - Products evaluated in each visit
export const productosEvaluados = pgTable("productos_evaluados", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id").notNull(), // FK to visitasTecnicas.id
  productoId: varchar("producto_id"), // FK to products.id (opcional)
  productoManual: text("producto_manual"), // Producto manual si no está en catálogo
  
  // Información del producto en la obra
  formato: varchar("formato"),
  color: varchar("color"),
  lote: varchar("lote"),
  fechaLlegada: date("fecha_llegada"),
  metrosCuadradosAplicados: numeric("metros_cuadrados_aplicados", { precision: 10, scale: 2 }),
  porcentajeAvance: numeric("porcentaje_avance", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Evaluaciones técnicas table - Technical evaluations for each product
export const evaluacionesTecnicas = pgTable("evaluaciones_tecnicas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productoEvaluadoId: varchar("producto_evaluado_id").notNull(), // FK to productosEvaluados.id
  
  // Evaluación técnica específica por producto
  aplicacion: varchar("aplicacion"), // 'correcta', 'deficiente'
  tipoSuperficie: text("tipo_superficie"),
  ambiente: varchar("ambiente"), // 'interior', 'exterior'
  condicionesClimaticas: text("condiciones_climaticas"),
  dilucion: text("dilucion"),
  observacionesTecnicas: text("observaciones_tecnicas"),
  preparacionSuperficie: text("preparacion_superficie"),
  rendimiento: text("rendimiento"),
  adherencia: text("adherencia"),
  anomalias: text("anomalias"),
  accionesRecomendadas: text("acciones_recomendadas"),
  imagenesUrls: jsonb("imagenes_urls").default(sql`'[]'::jsonb`), // Array de URLs de imágenes
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reclamos table - Claims associated with visits
export const reclamos = pgTable("reclamos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id").notNull(), // FK to visitasTecnicas.id
  
  // Información del reclamo
  descripcion: text("descripcion").notNull(),
  loteInvolucrado: varchar("lote_involucrado"),
  sectorAfectado: text("sector_afectado"),
  observacionTecnica: text("observacion_tecnica"),
  requiereAnalisisLaboratorio: boolean("requiere_analisis_laboratorio").default(false),
  estado: varchar("estado").default("pendiente"), // 'pendiente', 'en_proceso', 'resuelto'
  notasResolucion: text("notas_resolucion"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Firmas digitales table - Digital signatures captured in visits
export const firmasDigitales = pgTable("firmas_digitales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id").notNull(), // FK to visitasTecnicas.id
  
  // Tipos de firma
  tipoFirma: varchar("tipo_firma").notNull(), // 'contratista', 'constructor', 'tecnico'
  nombreFirmante: varchar("nombre_firmante"),
  cargoFirmante: varchar("cargo_firmante"),
  
  // Datos de la firma (base64)
  datosBase64: text("datos_base64").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Evidencias table - Images and evidence files
export const evidencias = pgTable("evidencias", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id"), // FK to visitasTecnicas.id (opcional)
  productoEvaluadoId: varchar("producto_evaluado_id"), // FK to productosEvaluados.id (opcional)
  reclamoId: varchar("reclamo_id"), // FK to reclamos.id (opcional)
  
  // Información del archivo
  tipoEvidencia: varchar("tipo_evidencia").notNull(), // 'producto', 'reclamo', 'general'
  nombreArchivo: varchar("nombre_archivo").notNull(),
  urlArchivo: text("url_archivo").notNull(),
  tipoArchivo: varchar("tipo_archivo"), // 'image/jpeg', 'image/png', etc.
  tamanio: integer("tamanio"), // Size in bytes
  descripcion: text("descripcion"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for visitas técnicas system
export const visitasTecnicasRelations = relations(visitasTecnicas, ({ one, many }) => ({
  tecnico: one(users, {
    fields: [visitasTecnicas.tecnicoId],
    references: [users.id],
  }),
  vendedor: one(users, {
    fields: [visitasTecnicas.vendedorId],
    references: [users.id],
  }),
  cliente: one(clients, {
    fields: [visitasTecnicas.clienteId],
    references: [clients.id],
  }),
  contactos: one(contactosVisita, {
    fields: [visitasTecnicas.id],
    references: [contactosVisita.visitaId],
  }),
  productosEvaluados: many(productosEvaluados),
  reclamos: many(reclamos),
  firmas: many(firmasDigitales),
  evidencias: many(evidencias),
}));

export const contactosVisitaRelations = relations(contactosVisita, ({ one }) => ({
  visita: one(visitasTecnicas, {
    fields: [contactosVisita.visitaId],
    references: [visitasTecnicas.id],
  }),
}));

export const productosEvaluadosRelations = relations(productosEvaluados, ({ one, many }) => ({
  visita: one(visitasTecnicas, {
    fields: [productosEvaluados.visitaId],
    references: [visitasTecnicas.id],
  }),
  producto: one(products, {
    fields: [productosEvaluados.productoId],
    references: [products.id],
  }),
  evaluacionTecnica: one(evaluacionesTecnicas, {
    fields: [productosEvaluados.id],
    references: [evaluacionesTecnicas.productoEvaluadoId],
  }),
  evidencias: many(evidencias),
}));

export const evaluacionesTecnicasRelations = relations(evaluacionesTecnicas, ({ one }) => ({
  productoEvaluado: one(productosEvaluados, {
    fields: [evaluacionesTecnicas.productoEvaluadoId],
    references: [productosEvaluados.id],
  }),
}));

export const reclamosRelations = relations(reclamos, ({ one, many }) => ({
  visita: one(visitasTecnicas, {
    fields: [reclamos.visitaId],
    references: [visitasTecnicas.id],
  }),
  evidencias: many(evidencias),
}));

export const firmasDigitalesRelations = relations(firmasDigitales, ({ one }) => ({
  visita: one(visitasTecnicas, {
    fields: [firmasDigitales.visitaId],
    references: [visitasTecnicas.id],
  }),
}));

export const evidenciasRelations = relations(evidencias, ({ one }) => ({
  visita: one(visitasTecnicas, {
    fields: [evidencias.visitaId],
    references: [visitasTecnicas.id],
  }),
  productoEvaluado: one(productosEvaluados, {
    fields: [evidencias.productoEvaluadoId],
    references: [productosEvaluados.id],
  }),
  reclamo: one(reclamos, {
    fields: [evidencias.reclamoId],
    references: [reclamos.id],
  }),
}));

// Insert schemas for visitas técnicas system
export const insertVisitaTecnicaSchema = createInsertSchema(visitasTecnicas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactoVisitaSchema = createInsertSchema(contactosVisita).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductoEvaluadoSchema = createInsertSchema(productosEvaluados).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluacionTecnicaSchema = createInsertSchema(evaluacionesTecnicas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReclamoSchema = createInsertSchema(reclamos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFirmaDigitalSchema = createInsertSchema(firmasDigitales).omit({
  id: true,
  createdAt: true,
});

export const insertEvidenciaSchema = createInsertSchema(evidencias).omit({
  id: true,
  createdAt: true,
});

// Export types for visitas técnicas system
export type VisitaTecnica = typeof visitasTecnicas.$inferSelect;
export type InsertVisitaTecnica = z.infer<typeof insertVisitaTecnicaSchema>;

export type ContactoVisita = typeof contactosVisita.$inferSelect;
export type InsertContactoVisita = z.infer<typeof insertContactoVisitaSchema>;

export type ProductoEvaluado = typeof productosEvaluados.$inferSelect;
export type InsertProductoEvaluado = z.infer<typeof insertProductoEvaluadoSchema>;

export type EvaluacionTecnica = typeof evaluacionesTecnicas.$inferSelect;
export type InsertEvaluacionTecnica = z.infer<typeof insertEvaluacionTecnicaSchema>;

export type Reclamo = typeof reclamos.$inferSelect;
export type InsertReclamo = z.infer<typeof insertReclamoSchema>;

export type FirmaDigital = typeof firmasDigitales.$inferSelect;
export type InsertFirmaDigital = z.infer<typeof insertFirmaDigitalSchema>;

export type Evidencia = typeof evidencias.$inferSelect;
export type InsertEvidencia = z.infer<typeof insertEvidenciaSchema>;

// =============================================================================
// TINTOMETRÍA SYSTEM TABLES
// =============================================================================

// 1. Pigmentos table
export const pigments = pgTable("pigments", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  pigmentoCode: text("pigmento_code").unique().notNull(),
  nombre: text("nombre").notNull(),
  compatibleBase: text("compatible_base").notNull(), // "Agua" / "Solvente"
  costoKgClp: numeric("costo_kg_clp", { precision: 15, scale: 2 }).notNull(),
  proveedor: text("proveedor"),
  notas: text("notas"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 2. Bases table
export const bases = pgTable("bases", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  baseId: text("base_id").unique().notNull(),
  tipoBase: text("tipo_base").notNull(), // "Agua" / "Solvente"
  colorBase: text("color_base").notNull(), // "Blanco" / "Incoloro"
  costoKgClp: numeric("costo_kg_clp", { precision: 15, scale: 2 }).notNull(),
  notas: text("notas"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 3. Envases table
export const envases = pgTable("envases", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  envaseId: text("envase_id").unique().notNull(),
  material: text("material").notNull(), // "Plástico" / "Metálico"
  capacidad: text("capacidad").notNull(), // "BD", "BD5", "1/4", "GL", "BD4"
  kgPorEnvase: numeric("kg_por_envase", { precision: 10, scale: 3 }).notNull(),
  costoEnvaseClp: numeric("costo_envase_clp", { precision: 15, scale: 2 }).notNull(),
  notas: text("notas"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 4. Colores table
export const colores = pgTable("colores", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  colorId: text("color_id").unique().notNull(),
  nombreColor: text("nombre_color").notNull(),
  baseId: text("base_id").notNull().references(() => bases.baseId),
  observaciones: text("observaciones"),
  notas: text("notas"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 5. Recetas table
export const recetas = pgTable("recetas", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  colorId: text("color_id").notNull().references(() => colores.colorId),
  pigmentoCode: text("pigmento_code").notNull().references(() => pigments.pigmentoCode),
  fraccionPeso: numeric("fraccion_peso", { precision: 10, scale: 6 }).notNull(), // proporción sobre 1 kg final
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 6. Parámetros table
export const parametros = pgTable("parametros", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  parametro: text("parametro").unique().notNull(),
  valor: numeric("valor", { precision: 15, scale: 6 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for tintometría system
export const tintometriaRelations = relations(colores, ({ one, many }) => ({
  base: one(bases, {
    fields: [colores.baseId],
    references: [bases.baseId],
  }),
  recetas: many(recetas),
}));

export const recetasRelations = relations(recetas, ({ one }) => ({
  color: one(colores, {
    fields: [recetas.colorId],
    references: [colores.colorId],
  }),
  pigmento: one(pigments, {
    fields: [recetas.pigmentoCode],
    references: [pigments.pigmentoCode],
  }),
}));

// Insert schemas for tintometría system
export const insertPigmentSchema = createInsertSchema(pigments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  costoKgClp: z.number().positive("El costo por kg debe ser mayor a 0"),
  compatibleBase: z.enum(["Agua", "Solvente"]),
});

export const insertBaseSchema = createInsertSchema(bases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  costoKgClp: z.number().positive("El costo por kg debe ser mayor a 0"),
  tipoBase: z.enum(["Agua", "Solvente"]),
  colorBase: z.enum(["Blanco", "Incoloro"]),
});

export const insertEnvaseSchema = createInsertSchema(envases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  kgPorEnvase: z.number().positive("El peso por envase debe ser mayor a 0"),
  costoEnvaseClp: z.number().positive("El costo del envase debe ser mayor a 0"),
  material: z.enum(["Plástico", "Metálico"]),
  capacidad: z.enum(["BD", "BD5", "1/4", "GL", "BD4"]),
});

export const insertColorSchema = createInsertSchema(colores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecetaSchema = createInsertSchema(recetas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  fraccionPeso: z.number().positive("La fracción de peso debe ser mayor a 0").max(1, "La fracción de peso no puede ser mayor a 1"),
});

export const insertParametroSchema = createInsertSchema(parametros).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types for tintometría system
export type Pigment = typeof pigments.$inferSelect;
export type InsertPigment = z.infer<typeof insertPigmentSchema>;

export type Base = typeof bases.$inferSelect;
export type InsertBase = z.infer<typeof insertBaseSchema>;

export type Envase = typeof envases.$inferSelect;
export type InsertEnvase = z.infer<typeof insertEnvaseSchema>;

export type Color = typeof colores.$inferSelect;
export type InsertColor = z.infer<typeof insertColorSchema>;

export type Receta = typeof recetas.$inferSelect;
export type InsertReceta = z.infer<typeof insertRecetaSchema>;

export type Parametro = typeof parametros.$inferSelect;
export type InsertParametro = z.infer<typeof insertParametroSchema>;

// Pedidos del eCommerce - Purchases made from ecommerce that need approval from salesperson
export const ecommerceOrders = pgTable("ecommerce_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(), // FK to users.id (client user)
  clientName: text("client_name").notNull(), // Client name for display
  clientEmail: varchar("client_email"), // Client email
  clientPhone: varchar("client_phone"), // Client phone
  
  // Assigned salesperson and supervisor
  assignedSalespersonId: varchar("assigned_salesperson_id"), // FK to users.id (salesperson)
  assignedSalespersonName: varchar("assigned_salesperson_name"), // Salesperson name for display
  assignedSupervisorId: varchar("assigned_supervisor_id"), // FK to users.id (supervisor)
  
  // Order details (JSON for flexibility)
  items: jsonb("items").notNull(), // Array of {productId, productName, sku, quantity, unitPrice, totalPrice}
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 15, scale: 2 }).notNull(),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  
  // Order status flow
  status: varchar("status").default("pending"), // pending, approved, modified, rejected, sent
  notes: text("notes"), // Client notes or special instructions
  shippingAddress: text("shipping_address"), // Shipping/delivery address
  
  // Approval tracking
  approvedAt: timestamp("approved_at"),
  approvedById: varchar("approved_by_id"), // FK to users.id (who approved)
  modifiedAt: timestamp("modified_at"),
  modifiedById: varchar("modified_by_id"), // FK to users.id (who modified)
  
  // Quote reference (if converted to quote)
  quoteId: varchar("quote_id"), // FK to quotes.id
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clientIdIdx: index("IDX_ecommerce_orders_client_id").on(table.clientId),
  salespersonIdIdx: index("IDX_ecommerce_orders_salesperson_id").on(table.assignedSalespersonId),
  statusIdx: index("IDX_ecommerce_orders_status").on(table.status),
}));

// Notificaciones - Sistema robusto de notificaciones internas
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Destinatario (solo para notificaciones personales)
  userId: varchar("user_id"), // FK to users.id (solo para targetType='personal')
  
  // Tipo de notificación
  targetType: varchar("target_type").notNull().default('personal'), // 'personal', 'general', 'departamento'
  department: varchar("department"), // Para targetType='departamento': 'laboratorio', 'logistica', 'finanzas', 'ventas', 'produccion', 'planificacion', etc.
  
  // Contenido
  type: varchar("type").notNull(), // 'manual', 'stock_bajo', 'stock_critico', 'producto_agotado', 'ecommerce_order', 'task_assigned', etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  priority: varchar("priority").default("media"), // 'baja', 'media', 'alta', 'critica'
  
  // Referencias relacionadas
  relatedOrderId: varchar("related_order_id"), // FK to ecommerce_orders.id
  relatedQuoteId: varchar("related_quote_id"), // FK to quotes.id
  relatedTaskId: varchar("related_task_id"), // FK to tasks.id
  relatedReclamoId: varchar("related_reclamo_id"), // FK to reclamos_generales.id
  relatedInventoryProductId: varchar("related_inventory_product_id"), // FK to inventory_products.id
  relatedWarehouseId: varchar("related_warehouse_id"), // FK to warehouses.id
  
  // Estado (DEPRECATED - usar notification_reads en su lugar para seguimiento individual)
  read: boolean("read").default(false),
  readAt: timestamp("read_at"),
  
  // Archivado
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  
  // Expiración
  expiresAt: timestamp("expires_at"), // Fecha de expiración opcional
  
  // URL de acción
  actionUrl: varchar("action_url"),
  
  // Creador
  createdBy: varchar("created_by").notNull().default('system'), // FK to users.id (quien creó la notificación)
  createdByName: varchar("created_by_name"), // Nombre del creador
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("IDX_notifications_user_id").on(table.userId),
  targetTypeIdx: index("IDX_notifications_target_type").on(table.targetType),
  departmentIdx: index("IDX_notifications_department").on(table.department),
  typeIdx: index("IDX_notifications_type").on(table.type),
  priorityIdx: index("IDX_notifications_priority").on(table.priority),
  readIdx: index("IDX_notifications_read").on(table.read),
  isArchivedIdx: index("IDX_notifications_is_archived").on(table.isArchived),
  createdByIdx: index("IDX_notifications_created_by").on(table.createdBy),
}));

// Tabla de seguimiento de lecturas de notificaciones
export const notificationReads = pgTable("notification_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  notificationId: varchar("notification_id").notNull(), // FK to notifications.id
  userId: varchar("user_id").notNull(), // FK to users.id (quien leyó)
  
  readAt: timestamp("read_at").defaultNow(),
}, (table) => ({
  notificationUserIdx: unique("notification_user_unique").on(table.notificationId, table.userId), // Un usuario solo puede leer una vez cada notificación
  notificationIdIdx: index("IDX_notification_reads_notification_id").on(table.notificationId),
  userIdIdx: index("IDX_notification_reads_user_id").on(table.userId),
}));

// Relations for ecommerce orders
export const ecommerceOrdersRelations = relations(ecommerceOrders, ({ one }) => ({
  client: one(users, {
    fields: [ecommerceOrders.clientId],
    references: [users.id],
  }),
  assignedSalesperson: one(users, {
    fields: [ecommerceOrders.assignedSalespersonId],
    references: [users.id],
  }),
  assignedSupervisor: one(users, {
    fields: [ecommerceOrders.assignedSupervisorId],
    references: [users.id],
  }),
}));

// Relations for notifications
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  relatedOrder: one(ecommerceOrders, {
    fields: [notifications.relatedOrderId],
    references: [ecommerceOrders.id],
  }),
}));

// Types for ecommerce orders
export type EcommerceOrder = typeof ecommerceOrders.$inferSelect;
export type InsertEcommerceOrder = typeof ecommerceOrders.$inferInsert;

// Types for notifications
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationRead = typeof notificationReads.$inferSelect;
export type InsertNotificationRead = typeof notificationReads.$inferInsert;

// Schemas for ecommerce orders
export const insertEcommerceOrderSchema = createInsertSchema(ecommerceOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  items: z.array(z.object({
    productId: z.string().optional(),
    productName: z.string(),
    sku: z.string().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive(),
  })),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().positive(),
  shippingAddress: z.string().optional().nullable(),
});

// Schemas for notifications
export const insertNotificationSchema = createInsertSchema(notifications, {
  targetType: z.enum(['personal', 'general', 'departamento']),
  department: z.enum(['laboratorio', 'logistica', 'finanzas', 'ventas', 'produccion', 'planificacion', 'bodega_materias_primas', 'area_produccion', 'area_logistica', 'area_aplicacion', 'area_materia_prima', 'area_colores', 'area_envase', 'area_etiqueta', 'reception']).optional().nullable(),
  type: z.string().min(1, "Tipo es requerido"),
  title: z.string().min(1, "Título es requerido"),
  message: z.string().min(1, "Mensaje es requerido"),
  priority: z.enum(['baja', 'media', 'alta', 'critica']).default('media'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  read: true,
  readAt: true,
  isArchived: true,
  archivedAt: true,
});

export type InsertNotificationInput = z.infer<typeof insertNotificationSchema>;

export const insertNotificationReadSchema = createInsertSchema(notificationReads).omit({
  id: true,
  readAt: true,
});

export type InsertNotificationReadInput = z.infer<typeof insertNotificationReadSchema>;

// ============================================
// SISTEMA DE RECLAMOS GENERALES (separado de visitas técnicas)
// ============================================

// Tabla principal de reclamos generales
export const reclamosGenerales = pgTable("reclamos_generales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Información del cliente
  clientName: text("client_name").notNull(),
  clientRut: varchar("client_rut"),
  clientEmail: varchar("client_email"),
  clientPhone: varchar("client_phone"),
  clientAddress: text("client_address"),
  
  // Información del producto/servicio
  productName: text("product_name").notNull(),
  productSku: varchar("product_sku"),
  lote: varchar("lote"), // Lote del producto
  
  // Descripción del reclamo
  description: text("description").notNull(),
  gravedad: varchar("gravedad").notNull(), // baja, media, alta, critica
  motivo: varchar("motivo"), // Motivo del reclamo que sugiere área responsable
  
  // Flujo de trabajo
  estado: varchar("estado").default("registrado").notNull(), // registrado, en_revision_tecnica, en_area_responsable, en_laboratorio, en_produccion, resuelto, cerrado
  procede: boolean("procede"), // NULL = sin revisar, true = procede, false = no procede (decidido por técnico)
  
  // Áreas responsables
  areaAsignadaInicial: varchar("area_asignada_inicial"), // materia_prima, colores, aplicacion, envase, etiqueta - Sugerida al crear
  areaResponsableActual: varchar("area_responsable_actual"), // Área responsable actual (editable por técnico)
  categoriaResponsable: varchar("categoria_responsable"), // DEPRECATED: usar areaResponsableActual (mantener por compatibilidad)
  
  // Asignaciones
  vendedorId: varchar("vendedor_id").notNull(), // FK to users.id (quien registra)
  vendedorName: varchar("vendedor_name"), // Nombre del vendedor
  tecnicoId: varchar("tecnico_id"), // FK to users.id (técnico asignado)
  tecnicoName: varchar("tecnico_name"), // Nombre del técnico
  responsableAreaId: varchar("responsable_area_id"), // FK to users.id (responsable del área asignada)
  responsableAreaName: varchar("responsable_area_name"), // Nombre del responsable del área
  
  // Derivaciones
  derivadoLaboratorio: boolean("derivado_laboratorio").default(false),
  derivadoProduccion: boolean("derivado_produccion").default(false),
  
  // Informes y notas
  informeLaboratorio: text("informe_laboratorio"), // DEPRECATED: usar resolucionDescripcion
  informeProduccion: text("informe_produccion"),
  informeTecnico: text("informe_tecnico"),
  notasInternas: text("notas_internas"),
  
  // Resolución del área responsable
  resolucionDescripcion: text("resolucion_descripcion"), // Descripción de la resolución (cualquier área)
  resolucionUsuarioId: varchar("resolucion_usuario_id"), // Usuario que subió la resolución
  resolucionUsuarioName: varchar("resolucion_usuario_name"), // Nombre del usuario que resolvió
  fechaResolucion: timestamp("fecha_resolucion"), // Fecha de la resolución
  
  // Fechas de seguimiento
  fechaRegistro: timestamp("fecha_registro").defaultNow(),
  fechaAsignacionTecnico: timestamp("fecha_asignacion_tecnico"),
  fechaEnvioLaboratorio: timestamp("fecha_envio_laboratorio"),
  fechaRespuestaLaboratorio: timestamp("fecha_respuesta_laboratorio"),
  fechaCierre: timestamp("fecha_cierre"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  vendedorIdIdx: index("IDX_reclamos_gen_vendedor_id").on(table.vendedorId),
  tecnicoIdIdx: index("IDX_reclamos_gen_tecnico_id").on(table.tecnicoId),
  responsableAreaIdIdx: index("IDX_reclamos_gen_responsable_area_id").on(table.responsableAreaId),
  estadoIdx: index("IDX_reclamos_gen_estado").on(table.estado),
  gravedadIdx: index("IDX_reclamos_gen_gravedad").on(table.gravedad),
}));

// Tabla de fotos de reclamos generales
export const reclamosGeneralesPhotos = pgTable("reclamos_generales_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reclamoId: varchar("reclamo_id").notNull(), // FK to reclamosGenerales.id
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  reclamoIdIdx: index("IDX_reclamos_gen_photos_reclamo_id").on(table.reclamoId),
}));

// Tabla de fotos de resolución del laboratorio
export const reclamosGeneralesResolucionPhotos = pgTable("reclamos_generales_resolucion_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reclamoId: varchar("reclamo_id").notNull(), // FK to reclamosGenerales.id
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  reclamoIdIdx: index("IDX_reclamos_gen_resolucion_photos_reclamo_id").on(table.reclamoId),
}));

// Tabla de historial de estados de reclamos generales
export const reclamosGeneralesHistorial = pgTable("reclamos_generales_historial", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reclamoId: varchar("reclamo_id").notNull(), // FK to reclamosGenerales.id
  estadoAnterior: varchar("estado_anterior"),
  estadoNuevo: varchar("estado_nuevo").notNull(),
  userId: varchar("user_id").notNull(), // FK to users.id (quien hizo el cambio)
  userName: varchar("user_name"), // Nombre del usuario
  notas: text("notas"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  reclamoIdIdx: index("IDX_reclamos_gen_hist_reclamo_id").on(table.reclamoId),
}));

// Relaciones para reclamos generales
export const reclamosGeneralesRelations = relations(reclamosGenerales, ({ one, many }) => ({
  vendedor: one(users, {
    fields: [reclamosGenerales.vendedorId],
    references: [users.id],
  }),
  tecnico: one(users, {
    fields: [reclamosGenerales.tecnicoId],
    references: [users.id],
  }),
  photos: many(reclamosGeneralesPhotos),
  resolucionPhotos: many(reclamosGeneralesResolucionPhotos),
  historial: many(reclamosGeneralesHistorial),
}));

export const reclamosGeneralesPhotosRelations = relations(reclamosGeneralesPhotos, ({ one }) => ({
  reclamo: one(reclamosGenerales, {
    fields: [reclamosGeneralesPhotos.reclamoId],
    references: [reclamosGenerales.id],
  }),
}));

export const reclamosGeneralesResolucionPhotosRelations = relations(reclamosGeneralesResolucionPhotos, ({ one }) => ({
  reclamo: one(reclamosGenerales, {
    fields: [reclamosGeneralesResolucionPhotos.reclamoId],
    references: [reclamosGenerales.id],
  }),
}));

export const reclamosGeneralesHistorialRelations = relations(reclamosGeneralesHistorial, ({ one }) => ({
  reclamo: one(reclamosGenerales, {
    fields: [reclamosGeneralesHistorial.reclamoId],
    references: [reclamosGenerales.id],
  }),
  user: one(users, {
    fields: [reclamosGeneralesHistorial.userId],
    references: [users.id],
  }),
}));

// Types para reclamos generales
export type ReclamoGeneral = typeof reclamosGenerales.$inferSelect;
export type InsertReclamoGeneral = typeof reclamosGenerales.$inferInsert;

export type ReclamoGeneralPhoto = typeof reclamosGeneralesPhotos.$inferSelect;
export type InsertReclamoGeneralPhoto = typeof reclamosGeneralesPhotos.$inferInsert;

export type ReclamoGeneralResolucionPhoto = typeof reclamosGeneralesResolucionPhotos.$inferSelect;
export type InsertReclamoGeneralResolucionPhoto = typeof reclamosGeneralesResolucionPhotos.$inferInsert;

export type ReclamoGeneralHistorial = typeof reclamosGeneralesHistorial.$inferSelect;
export type InsertReclamoGeneralHistorial = typeof reclamosGeneralesHistorial.$inferInsert;

// Schemas de validación para reclamos generales
export const insertReclamoGeneralSchema = createInsertSchema(reclamosGenerales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  fechaRegistro: true,
}).extend({
  clientName: z.string().min(1, "El nombre del cliente es requerido"),
  productName: z.string().min(1, "El nombre del producto es requerido"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  gravedad: z.enum(["baja", "media", "alta", "critica"]),
  estado: z.enum(["registrado", "en_revision_tecnica", "en_area_responsable", "en_laboratorio", "en_produccion", "resuelto", "cerrado"]).optional(),
  motivo: z.string().optional(),
  // Expanded to include all valid area values
  areaAsignadaInicial: z.enum(["produccion", "laboratorio", "logistica", "aplicacion", "envase", "etiqueta", "materia_prima", "colores"]).optional(),
});

export const insertReclamoGeneralPhotoSchema = createInsertSchema(reclamosGeneralesPhotos).omit({
  id: true,
  uploadedAt: true,
});

export const insertReclamoGeneralResolucionPhotoSchema = createInsertSchema(reclamosGeneralesResolucionPhotos).omit({
  id: true,
  uploadedAt: true,
});

export const insertReclamoGeneralHistorialSchema = createInsertSchema(reclamosGeneralesHistorial).omit({
  id: true,
  createdAt: true,
});

// ==================================================================================
// SISTEMA CMMS - COMPUTERIZED MAINTENANCE MANAGEMENT SYSTEM
// ==================================================================================

// ===== CATÁLOGO DE EQUIPOS CRÍTICOS =====
export const equiposCriticos = pgTable("equipos_criticos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codigo: varchar("codigo", { length: 50 }).unique(), // Código único del equipo (auto-generated if not provided)
  nombre: varchar("nombre", { length: 255 }).notNull(),
  area: varchar("area").notNull(), // administracion, produccion, laboratorio, bodega_materias_primas, bodega_productos_terminados
  criticidad: varchar("criticidad").notNull().default("media"), // baja, media, alta, critica
  ubicacionEspecifica: text("ubicacion_especifica"),
  
  // Jerarquía de equipos (equipo padre para componentes)
  equipoPadreId: varchar("equipo_padre_id"), // Referencia al equipo padre si es un componente
  
  // Información técnica
  marca: varchar("marca", { length: 100 }),
  modelo: varchar("modelo", { length: 100 }),
  numeroSerie: varchar("numero_serie", { length: 100 }),
  potencia: varchar("potencia", { length: 50 }), // ej: "5.5 HP", "220V 3-phase"
  
  // Plan preventivo
  frecuenciaPreventivo: varchar("frecuencia_preventivo"), // semanal, mensual, trimestral, semestral, anual
  ultimoMantPreventivo: timestamp("ultimo_mant_preventivo"),
  proximoMantPreventivo: timestamp("proximo_mant_preventivo"),
  
  // Información adicional
  repuestosCriticos: text("repuestos_criticos"), // Lista de repuestos críticos
  arbolFallas: text("arbol_fallas"), // Árbol simple de fallas (texto)
  manualesUrl: text("manuales_url"), // URLs de manuales/PDFs separados por comas
  notas: text("notas"),
  
  // Estado
  estadoActual: varchar("estado_actual").default("operativo"), // operativo, detenido, en_mantenimiento, dado_de_baja
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  codigoIdx: index("IDX_equipos_codigo").on(table.codigo),
  areaIdx: index("IDX_equipos_area").on(table.area),
  criticidadIdx: index("IDX_equipos_criticidad").on(table.criticidad),
}));

// ===== PROVEEDORES EXTERNOS =====
export const proveedoresMantencion = pgTable("proveedores_mantencion", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  contacto: varchar("contacto", { length: 255 }), // Nombre de contacto
  telefono: varchar("telefono", { length: 50 }),
  email: varchar("email", { length: 255 }),
  especialidad: text("especialidad"), // ej: "Electricidad Industrial", "Mecánica"
  evaluacion: numeric("evaluacion", { precision: 3, scale: 2 }), // 1.00 - 5.00
  costoPromedioHora: numeric("costo_promedio_hora", { precision: 15, scale: 2 }),
  notas: text("notas"),
  activo: boolean("activo").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===== PRESUPUESTO ANUAL DE MANTENCIÓN =====
export const presupuestoMantencion = pgTable("presupuesto_mantencion", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  anio: integer("anio").notNull(),
  mes: integer("mes").notNull(), // 1-12, o 0 para presupuesto anual global
  area: varchar("area"), // NULL para global, o área específica
  
  presupuestoAsignado: numeric("presupuesto_asignado", { precision: 15, scale: 2 }).notNull(),
  presupuestoEjecutado: numeric("presupuesto_ejecutado", { precision: 15, scale: 2 }).default(sql`0`),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  anioMesIdx: index("IDX_presupuesto_anio_mes").on(table.anio, table.mes),
  areaIdx: index("IDX_presupuesto_area").on(table.area),
}));

// ===== GASTOS DE MATERIALES =====
export const gastosMaterialesMantencion = pgTable("gastos_materiales_mantencion", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fecha: timestamp("fecha").notNull().defaultNow(),
  item: varchar("item", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  cantidad: numeric("cantidad", { precision: 10, scale: 2 }).notNull(),
  costoUnitario: numeric("costo_unitario", { precision: 15, scale: 2 }).notNull(),
  costoTotal: numeric("costo_total", { precision: 15, scale: 2 }).notNull(),
  
  area: varchar("area"), // Centro de costo/área
  otId: varchar("ot_id"), // FK opcional a solicitudes_mantencion
  proveedorId: varchar("proveedor_id"), // FK opcional a proveedores_mantencion
  adjuntoUrl: text("adjunto_url"), // URL de factura/foto
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  fechaIdx: index("IDX_gastos_materiales_fecha").on(table.fecha),
  otIdIdx: index("IDX_gastos_materiales_ot_id").on(table.otId),
}));

// ===== MANTENCIONES PLANIFICADAS (Proyectos grandes futuros) =====
export const mantencionesPlanificadas = pgTable("mantenciones_planificadas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  equipoId: varchar("equipo_id"), // FK a equipos_criticos (puede ser NULL para mantenciones generales)
  equipoNombre: varchar("equipo_nombre", { length: 255 }).notNull(),
  
  titulo: varchar("titulo", { length: 255 }).notNull(), // ej: "Rectificación Eje Dispersora"
  descripcion: text("descripcion"),
  categoria: varchar("categoria").notNull(), // gran_mantenimiento, overhaul, rectificacion, reemplazo, mejora
  
  costoEstimado: numeric("costo_estimado", { precision: 15, scale: 2 }).notNull(),
  mes: integer("mes").notNull(), // 1-12
  anio: integer("anio").notNull(),
  area: varchar("area"), // NULL para global, o área específica
  
  estado: varchar("estado").default("planificado").notNull(), // planificado, aprobado, en_ejecucion, completado, cancelado
  
  prioridad: varchar("prioridad").default("media"), // baja, media, alta
  notas: text("notas"),
  
  // Vinculación a OT real cuando se ejecute
  otGeneradaId: varchar("ot_generada_id"), // FK a solicitudes_mantencion cuando se crea la OT
  
  creadoPorId: varchar("creado_por_id").notNull(),
  creadoPorName: varchar("creado_por_name"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  anioMesIdx: index("IDX_mantenciones_planificadas_anio_mes").on(table.anio, table.mes),
  estadoIdx: index("IDX_mantenciones_planificadas_estado").on(table.estado),
  equipoIdIdx: index("IDX_mantenciones_planificadas_equipo_id").on(table.equipoId),
}));

// ===== PLANES PREVENTIVOS =====
export const planesPreventivos = pgTable("planes_preventivos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  equipoId: varchar("equipo_id").notNull(), // FK a equipos_criticos
  nombrePlan: varchar("nombre_plan", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  frecuencia: varchar("frecuencia").notNull(), // semanal, mensual, trimestral, semestral, anual
  
  ultimaEjecucion: date("ultima_ejecucion"),
  proximaEjecucion: date("proxima_ejecucion"),
  
  tareasPreventivas: text("tareas_preventivas"), // Checklist de tareas (texto o JSON)
  
  activo: boolean("activo").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  equipoIdIdx: index("IDX_planes_preventivos_equipo_id").on(table.equipoId),
  proximaEjecucionIdx: index("IDX_planes_preventivos_proxima_ejecucion").on(table.proximaEjecucion),
}));

// ===== ÓRDENES DE TRABAJO (OTs) - Tabla principal actualizada =====
export const solicitudesMantencion = pgTable("solicitudes_mantencion", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  numeroOT: varchar("numero_ot", { length: 50 }), // Número correlativo de OT (ej: "OT-2025-001")
  
  // Información del equipo/máquina
  equipoId: varchar("equipo_id"), // FK a equipos_criticos (opcional, puede ser equipo no catalogado)
  equipoNombre: text("equipo_nombre").notNull(), // Nombre del equipo o máquina
  equipoCodigo: varchar("equipo_codigo"), // Código interno del equipo
  area: varchar("area").notNull(), // administracion, produccion, laboratorio, bodega_materias_primas, bodega_productos_terminados
  ubicacion: text("ubicacion"), // Ubicación específica dentro del área
  
  // Descripción del problema
  descripcionProblema: text("descripcion_problema").notNull(),
  prioridad: varchar("prioridad").notNull().default("media"), // baja, media, alta (para SLA)
  gravedad: varchar("gravedad").notNull(), // baja, media, alta, critica (impacto técnico)
  tipoMantencion: varchar("tipo_mantencion").default("correctivo"), // preventivo, correctivo
  
  // Flujo de trabajo CMMS: Registrado → Programada → En Reparación → Pausada → Resuelto → Cerrado
  estado: varchar("estado").default("registrado").notNull(), // registrado, programada, en_reparacion, pausada, resuelto, cerrado
  
  // Programación y pausas
  fechaProgramada: timestamp("fecha_programada"), // Fecha programada para atender la OT (si no es inmediata)
  fechaInicioTrabajo: timestamp("fecha_inicio_trabajo"), // Fecha en que se inició el trabajo
  motivoPausa: text("motivo_pausa"), // Motivo de pausa (ej: falta material, aprobación pendiente)
  fechaPausa: timestamp("fecha_pausa"), // Fecha en que se pausó la OT
  
  // Asignaciones
  solicitanteId: varchar("solicitante_id").notNull(), // FK to users.id (quien crea la solicitud)
  solicitanteName: varchar("solicitante_name"), // Nombre del solicitante
  
  // Asignación: técnico interno O proveedor externo
  tipoAsignacion: varchar("tipo_asignacion"), // tecnico_interno, proveedor_externo
  tecnicoAsignadoId: varchar("tecnico_asignado_id"), // FK to users.id (técnico interno)
  tecnicoAsignadoName: varchar("tecnico_asignado_name"),
  proveedorAsignadoId: varchar("proveedor_asignado_id"), // FK to proveedores_mantencion
  proveedorAsignadoName: varchar("proveedor_asignado_name"),
  
  // Resolución
  resolucionDescripcion: text("resolucion_descripcion"), // Descripción de la reparación realizada
  resolucionUsuarioId: varchar("resolucion_usuario_id"), // Usuario que resolvió
  resolucionUsuarioName: varchar("resolucion_usuario_name"),
  fechaResolucion: timestamp("fecha_resolucion"),
  
  // Información de costos y tiempos
  costoEstimado: numeric("costo_estimado", { precision: 15, scale: 2 }),
  costoReal: numeric("costo_real", { precision: 15, scale: 2 }),
  tiempoEstimado: integer("tiempo_estimado"), // Minutos estimados (legacy)
  tiempoReal: integer("tiempo_real"), // Minutos reales (legacy)
  tiempoEstimadoHoras: numeric("tiempo_estimado_horas", { precision: 5, scale: 2 }), // Horas estimadas
  tiempoRealHoras: numeric("tiempo_real_horas", { precision: 5, scale: 2 }), // Horas reales trabajadas
  costoManoObra: numeric("costo_mano_obra", { precision: 15, scale: 2 }),
  costoMateriales: numeric("costo_materiales", { precision: 15, scale: 2 }),
  repuestosUtilizados: text("repuestos_utilizados"), // Lista de repuestos
  notasCierre: text("notas_cierre"), // Notas al cerrar la OT
  
  // Fechas de seguimiento (para KPIs)
  fechaSolicitud: timestamp("fecha_solicitud").defaultNow(),
  fechaAsignacion: timestamp("fecha_asignacion"),
  fechaCierre: timestamp("fecha_cierre"), // Cuando se cierra administrativamente
  
  // Vinculación a plan preventivo
  planPreventivoId: varchar("plan_preventivo_id"), // FK a planes_preventivos (si es preventiva)
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  solicitanteIdIdx: index("IDX_mantencion_solicitante_id").on(table.solicitanteId),
  tecnicoIdIdx: index("IDX_mantencion_tecnico_id").on(table.tecnicoAsignadoId),
  proveedorIdIdx: index("IDX_mantencion_proveedor_id").on(table.proveedorAsignadoId),
  estadoIdx: index("IDX_mantencion_estado").on(table.estado),
  prioridadIdx: index("IDX_mantencion_prioridad").on(table.prioridad),
  areaIdx: index("IDX_mantencion_area").on(table.area),
  equipoIdIdx: index("IDX_mantencion_equipo_id").on(table.equipoId),
}));

// Tabla de fotos de evidencia inicial
export const mantencionPhotos = pgTable("mantencion_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mantencionId: varchar("mantencion_id").notNull(), // FK to solicitudesMantencion.id
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  mantencionIdIdx: index("IDX_mantencion_photos_mantencion_id").on(table.mantencionId),
}));

// Tabla de fotos de resolución
export const mantencionResolucionPhotos = pgTable("mantencion_resolucion_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mantencionId: varchar("mantencion_id").notNull(), // FK to solicitudesMantencion.id
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  mantencionIdIdx: index("IDX_mantencion_resolucion_photos_mantencion_id").on(table.mantencionId),
}));

// Tabla de historial de estados
export const mantencionHistorial = pgTable("mantencion_historial", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mantencionId: varchar("mantencion_id").notNull(), // FK to solicitudesMantencion.id
  estadoAnterior: varchar("estado_anterior"),
  estadoNuevo: varchar("estado_nuevo").notNull(),
  userId: varchar("user_id").notNull(), // FK to users.id (quien hizo el cambio)
  userName: varchar("user_name"), // Nombre del usuario que hizo el cambio
  notas: text("notas"), // Notas adicionales sobre el cambio
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  mantencionIdIdx: index("IDX_mantencion_historial_mantencion_id").on(table.mantencionId),
}));

// ===== RELACIONES CMMS =====
export const equiposCriticosRelations = relations(equiposCriticos, ({ many }) => ({
  ots: many(solicitudesMantencion),
  planesPreventivos: many(planesPreventivos),
}));

export const proveedoresMantencionRelations = relations(proveedoresMantencion, ({ many }) => ({
  ots: many(solicitudesMantencion),
  gastosMateriales: many(gastosMaterialesMantencion),
}));

export const planesPreventivosRelations = relations(planesPreventivos, ({ one, many }) => ({
  equipo: one(equiposCriticos, {
    fields: [planesPreventivos.equipoId],
    references: [equiposCriticos.id],
  }),
  ots: many(solicitudesMantencion),
}));

export const mantencionesPlanificadasRelations = relations(mantencionesPlanificadas, ({ one }) => ({
  equipo: one(equiposCriticos, {
    fields: [mantencionesPlanificadas.equipoId],
    references: [equiposCriticos.id],
  }),
  otGenerada: one(solicitudesMantencion, {
    fields: [mantencionesPlanificadas.otGeneradaId],
    references: [solicitudesMantencion.id],
  }),
  creadoPor: one(users, {
    fields: [mantencionesPlanificadas.creadoPorId],
    references: [users.id],
  }),
}));

export const gastosMaterialesMantencionRelations = relations(gastosMaterialesMantencion, ({ one }) => ({
  ot: one(solicitudesMantencion, {
    fields: [gastosMaterialesMantencion.otId],
    references: [solicitudesMantencion.id],
  }),
  proveedor: one(proveedoresMantencion, {
    fields: [gastosMaterialesMantencion.proveedorId],
    references: [proveedoresMantencion.id],
  }),
}));

// Relaciones para solicitudes de mantención (OTs)
export const solicitudesMantencionRelations = relations(solicitudesMantencion, ({ one, many }) => ({
  solicitante: one(users, {
    fields: [solicitudesMantencion.solicitanteId],
    references: [users.id],
  }),
  tecnicoAsignado: one(users, {
    fields: [solicitudesMantencion.tecnicoAsignadoId],
    references: [users.id],
  }),
  proveedorAsignado: one(proveedoresMantencion, {
    fields: [solicitudesMantencion.proveedorAsignadoId],
    references: [proveedoresMantencion.id],
  }),
  equipo: one(equiposCriticos, {
    fields: [solicitudesMantencion.equipoId],
    references: [equiposCriticos.id],
  }),
  planPreventivo: one(planesPreventivos, {
    fields: [solicitudesMantencion.planPreventivoId],
    references: [planesPreventivos.id],
  }),
  photos: many(mantencionPhotos),
  resolucionPhotos: many(mantencionResolucionPhotos),
  historial: many(mantencionHistorial),
  gastosMateriales: many(gastosMaterialesMantencion),
}));

export const mantencionPhotosRelations = relations(mantencionPhotos, ({ one }) => ({
  mantencion: one(solicitudesMantencion, {
    fields: [mantencionPhotos.mantencionId],
    references: [solicitudesMantencion.id],
  }),
}));

export const mantencionResolucionPhotosRelations = relations(mantencionResolucionPhotos, ({ one }) => ({
  mantencion: one(solicitudesMantencion, {
    fields: [mantencionResolucionPhotos.mantencionId],
    references: [solicitudesMantencion.id],
  }),
}));

export const mantencionHistorialRelations = relations(mantencionHistorial, ({ one }) => ({
  mantencion: one(solicitudesMantencion, {
    fields: [mantencionHistorial.mantencionId],
    references: [solicitudesMantencion.id],
  }),
  user: one(users, {
    fields: [mantencionHistorial.userId],
    references: [users.id],
  }),
}));

// ===== TYPES CMMS =====
// Equipos Críticos
export type EquipoCritico = typeof equiposCriticos.$inferSelect;
export type InsertEquipoCritico = typeof equiposCriticos.$inferInsert;

// Proveedores
export type ProveedorMantencion = typeof proveedoresMantencion.$inferSelect;
export type InsertProveedorMantencion = typeof proveedoresMantencion.$inferInsert;

// Presupuesto
export type PresupuestoMantencion = typeof presupuestoMantencion.$inferSelect;
export type InsertPresupuestoMantencion = typeof presupuestoMantencion.$inferInsert;

// Gastos de Materiales
export type GastoMaterialMantencion = typeof gastosMaterialesMantencion.$inferSelect;
export type InsertGastoMaterialMantencion = typeof gastosMaterialesMantencion.$inferInsert;

// Planes Preventivos
export type PlanPreventivo = typeof planesPreventivos.$inferSelect;
export type InsertPlanPreventivo = typeof planesPreventivos.$inferInsert;

export type MantencionPlanificada = typeof mantencionesPlanificadas.$inferSelect;
export type InsertMantencionPlanificada = typeof mantencionesPlanificadas.$inferInsert;

// Órdenes de Trabajo
export type SolicitudMantencion = typeof solicitudesMantencion.$inferSelect;
export type InsertSolicitudMantencion = typeof solicitudesMantencion.$inferInsert;

// Fotos y Historial
export type MantencionPhoto = typeof mantencionPhotos.$inferSelect;
export type InsertMantencionPhoto = typeof mantencionPhotos.$inferInsert;

export type MantencionResolucionPhoto = typeof mantencionResolucionPhotos.$inferSelect;
export type InsertMantencionResolucionPhoto = typeof mantencionResolucionPhotos.$inferInsert;

export type MantencionHistorial = typeof mantencionHistorial.$inferSelect;
export type InsertMantencionHistorial = typeof mantencionHistorial.$inferInsert;

// ===== SCHEMAS DE VALIDACIÓN CMMS =====
// Equipos Críticos
export const insertEquipoCriticoSchema = createInsertSchema(equiposCriticos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  codigo: z.string().optional(), // Optional - will be auto-generated if not provided
  nombre: z.string().min(1, "El nombre del equipo es requerido"),
  area: z.enum(["administracion", "produccion", "laboratorio", "bodega_materias_primas", "bodega_productos_terminados"]),
  criticidad: z.enum(["baja", "media", "alta", "critica"]).default("media"),
  frecuenciaPreventivo: z.enum(["semanal", "mensual", "trimestral", "semestral", "anual"]).optional(),
});

// Proveedores
export const insertProveedorMantencionSchema = createInsertSchema(proveedoresMantencion).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  nombre: z.string().min(1, "El nombre del proveedor es requerido"),
  activo: z.boolean().default(true),
  // Convert empty strings to null for numeric fields
  evaluacion: z.union([z.string(), z.null()]).optional().transform(val => 
    val === "" || val === null || val === undefined ? null : val
  ),
  costoPromedioHora: z.union([z.string(), z.null()]).optional().transform(val => 
    val === "" || val === null || val === undefined ? null : val
  ),
});

// Presupuesto
export const insertPresupuestoMantencionSchema = createInsertSchema(presupuestoMantencion).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  anio: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(0).max(12), // 0 = anual global
});

// Gastos de Materiales
export const insertGastoMaterialMantencionSchema = createInsertSchema(gastosMaterialesMantencion).omit({
  id: true,
  createdAt: true,
}).extend({
  item: z.string().min(1, "El ítem es requerido"),
  cantidad: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  costoUnitario: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  costoTotal: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
});

// Planes Preventivos
export const insertPlanPreventivoSchema = createInsertSchema(planesPreventivos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  equipoId: z.string().min(1, "El ID del equipo es requerido"),
  nombrePlan: z.string().min(1, "El nombre del plan es requerido"),
  frecuencia: z.enum(["semanal", "mensual", "trimestral", "semestral", "anual"]),
  activo: z.boolean().default(true),
});

// Mantenciones Planificadas
export const insertMantencionPlanificadaSchema = createInsertSchema(mantencionesPlanificadas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  otGeneradaId: true,
}).extend({
  equipoId: z.string().optional(),
  equipoNombre: z.string().min(1, "El nombre del equipo es requerido"),
  titulo: z.string().min(1, "El título es requerido"),
  descripcion: z.string().optional(),
  categoria: z.enum(["gran_mantenimiento", "overhaul", "rectificacion", "reemplazo", "mejora"]),
  costoEstimado: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2020).max(2100),
  area: z.string().optional(),
  estado: z.enum(["planificado", "aprobado", "en_ejecucion", "completado", "cancelado"]).default("planificado"),
  prioridad: z.enum(["baja", "media", "alta"]).default("media").optional(),
  notas: z.string().optional(),
});

// Órdenes de Trabajo (Solicitudes de Mantención)
export const insertSolicitudMantencionSchema = createInsertSchema(solicitudesMantencion).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  fechaSolicitud: true,
}).extend({
  equipoNombre: z.string().min(1, "El nombre del equipo es requerido"),
  area: z.enum(["administracion", "produccion", "laboratorio", "bodega_materias_primas", "bodega_productos_terminados"]),
  descripcionProblema: z.string().min(5, "La descripción debe tener al menos 5 caracteres"),
  prioridad: z.enum(["baja", "media", "alta"]).default("media"),
  gravedad: z.enum(["baja", "media", "alta", "critica"]),
  estado: z.enum(["pendiente", "en_curso", "finalizada", "cerrada"]).default("pendiente").optional(),
  tipoMantencion: z.enum(["preventivo", "correctivo"]).default("correctivo").optional(),
  tipoAsignacion: z.enum(["tecnico_interno", "proveedor_externo"]).optional(),
});

export const insertMantencionPhotoSchema = createInsertSchema(mantencionPhotos).omit({
  id: true,
  uploadedAt: true,
});

export const insertMantencionResolucionPhotoSchema = createInsertSchema(mantencionResolucionPhotos).omit({
  id: true,
  uploadedAt: true,
});

export const insertMantencionHistorialSchema = createInsertSchema(mantencionHistorial).omit({
  id: true,
  createdAt: true,
});

// ==================================================================================
// MARKETING MODULE
// ==================================================================================

// Tabla de presupuesto mensual de marketing
export const presupuestoMarketing = pgTable("presupuesto_marketing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mes: integer("mes").notNull(), // 1-12
  anio: integer("anio").notNull(), // 2024, 2025, etc
  presupuestoTotal: numeric("presupuesto_total", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_mes_anio").on(table.mes, table.anio)
]);

// Tabla de solicitudes de marketing
export const solicitudesMarketing = pgTable("solicitudes_marketing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descripcion: text("descripcion").notNull(),
  monto: numeric("monto", { precision: 15, scale: 2 }), // Nullable - se ingresa al aprobar
  urlReferencia: text("url_referencia"), // URL de referencia (ingresada por supervisor)
  pdfPresupuesto: text("pdf_presupuesto"), // URL del PDF presupuestado (subido por admin)
  pasos: jsonb("pasos").$type<{ nombre: string; completado: boolean; orden: number }[]>().default(sql`'[]'::jsonb`), // Array de pasos/checklist
  notas: text("notas"), // Notas sobre la actividad de la solicitud
  urgencia: varchar("urgencia").notNull().default("baja"), // baja, media, alta (máximo 3 con urgencia "alta" por usuario)
  estado: varchar("estado").notNull().default("solicitado"), // solicitado, en_proceso, completado, rechazado
  supervisorId: varchar("supervisor_id").references(() => salespeopleUsers.id),
  supervisorName: varchar("supervisor_name"),
  fechaSolicitud: timestamp("fecha_solicitud").notNull().defaultNow(),
  fechaEntrega: date("fecha_entrega"), // Fecha esperada de entrega
  fechaCompletado: timestamp("fecha_completado"), // Fecha real de completado
  motivoRechazo: text("motivo_rechazo"), // Solo si estado = rechazado
  mes: integer("mes").notNull(), // Mes al que pertenece la solicitud
  anio: integer("anio").notNull(), // Año al que pertenece la solicitud
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const presupuestoMarketingRelations = relations(presupuestoMarketing, ({ many }) => ({
  solicitudes: many(solicitudesMarketing),
}));

export const solicitudesMarketingRelations = relations(solicitudesMarketing, ({ one }) => ({
  supervisor: one(salespeopleUsers, {
    fields: [solicitudesMarketing.supervisorId],
    references: [salespeopleUsers.id],
  }),
}));

// Types
export type PresupuestoMarketing = typeof presupuestoMarketing.$inferSelect;
export type InsertPresupuestoMarketing = typeof presupuestoMarketing.$inferInsert;

export type SolicitudMarketing = typeof solicitudesMarketing.$inferSelect;
export type InsertSolicitudMarketing = typeof solicitudesMarketing.$inferInsert;

// Schemas de validación
export const insertPresupuestoMarketingSchema = createInsertSchema(presupuestoMarketing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  mes: z.number().min(1).max(12),
  anio: z.number().min(2020).max(2100),
  presupuestoTotal: z.string().or(z.number()).transform(val => typeof val === 'string' ? parseFloat(val) : val),
});

export const insertSolicitudMarketingSchema = createInsertSchema(solicitudesMarketing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  fechaSolicitud: true,
}).extend({
  titulo: z.string().min(1, "El título es requerido"),
  descripcion: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  monto: z.string().or(z.number()).transform(val => typeof val === 'string' ? parseFloat(val) : val).optional(),
  estado: z.enum(["solicitado", "en_proceso", "completado", "rechazado"]).optional(),
  mes: z.number().min(1).max(12),
  anio: z.number().min(2020).max(2100),
});

// Tabla de inventario de marketing
export const inventarioMarketing = pgTable("inventario_marketing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  cantidad: integer("cantidad").notNull().default(0),
  unidad: varchar("unidad", { length: 50 }).notNull().default("unidades"), // unidades, paquetes, cajas, etc
  ubicacion: varchar("ubicacion", { length: 255 }), // bodega o ubicación física
  costoUnitario: numeric("costo_unitario", { precision: 15, scale: 2 }),
  proveedor: varchar("proveedor", { length: 255 }),
  estado: varchar("estado").notNull().default("disponible"), // disponible, agotado, por_llegar
  stockMinimo: integer("stock_minimo").default(0), // Alerta de stock bajo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types
export type InventarioMarketing = typeof inventarioMarketing.$inferSelect;
export type InsertInventarioMarketing = typeof inventarioMarketing.$inferInsert;

// Schema de validación
export const insertInventarioMarketingSchema = createInsertSchema(inventarioMarketing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  nombre: z.string().min(1, "El nombre es requerido"),
  cantidad: z.number().min(0, "La cantidad no puede ser negativa"),
  unidad: z.string().min(1, "La unidad es requerida"),
  estado: z.enum(["disponible", "agotado", "por_llegar"]).default("disponible"),
  costoUnitario: z.string().or(z.number()).transform(val => typeof val === 'string' ? parseFloat(val) : val).optional(),
  stockMinimo: z.number().min(0).optional(),
});

// Tabla de gastos empresariales
export const gastosEmpresariales = pgTable("gastos_empresariales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  monto: numeric("monto", { precision: 15, scale: 2 }).notNull(),
  descripcion: text("descripcion").notNull(),
  userId: varchar("user_id").notNull(), // Usuario que crea el gasto (vendedor)
  centroCostos: varchar("centro_costos", { length: 255 }),
  categoria: varchar("categoria", { length: 100 }).notNull(), // Combustibles, Colación, Gestión Ventas, etc.
  tipoGasto: varchar("tipo_gasto", { length: 100 }).notNull().default("Reembolso"), // Reembolso, Gasto Directo, etc.
  tipoDocumento: varchar("tipo_documento", { length: 100 }), // Boleta, Factura, Recibo, etc.
  proveedor: varchar("proveedor", { length: 255 }),
  rutProveedor: varchar("rut_proveedor", { length: 20 }),
  numeroDocumento: varchar("numero_documento", { length: 100 }),
  fechaEmision: date("fecha_emision"),
  archivoUrl: varchar("archivo_url", { length: 500 }), // URL del documento adjunto
  estado: varchar("estado", { length: 50 }).notNull().default("pendiente"), // pendiente, aprobado, rechazado
  supervisorId: varchar("supervisor_id"), // Supervisor que aprueba/rechaza
  fechaAprobacion: timestamp("fecha_aprobacion"),
  comentarioRechazo: text("comentario_rechazo"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types
export type GastoEmpresarial = typeof gastosEmpresariales.$inferSelect;
export type InsertGastoEmpresarial = typeof gastosEmpresariales.$inferInsert;

// Schema de validación
export const insertGastoEmpresarialSchema = createInsertSchema(gastosEmpresariales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  fechaAprobacion: true,
}).extend({
  monto: z.string().or(z.number()).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  descripcion: z.string().min(1, "La descripción es requerida"),
  userId: z.string().min(1, "El usuario es requerido"),
  categoria: z.string().min(1, "La categoría es requerida"),
  tipoGasto: z.string().min(1, "El tipo de gasto es requerido"),
  estado: z.enum(["pendiente", "aprobado", "rechazado"]).default("pendiente"),
  fechaEmision: z.string().or(z.date()).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ).optional(),
});

// Tabla de promesas de compra semanales
export const promesasCompra = pgTable("promesas_compra", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendedorId: varchar("vendedor_id").notNull(), // FK to users.id
  clienteId: varchar("cliente_id").notNull(), // Código del cliente (koen)
  clienteNombre: varchar("cliente_nombre", { length: 255 }).notNull(),
  clienteTipo: varchar("cliente_tipo", { length: 20 }).default("activo"), // "activo" o "potencial"
  montoPrometido: numeric("monto_prometido", { precision: 15, scale: 2 }).notNull(),
  ventasRealesManual: numeric("ventas_reales_manual", { precision: 15, scale: 2 }), // Ventas reales ingresadas manualmente por admin/supervisor
  semana: varchar("semana", { length: 10 }).notNull(), // Formato: YYYY-WW (ej: 2025-42)
  anio: integer("anio").notNull(),
  numeroSemana: integer("numero_semana").notNull(), // 1-52
  fechaInicio: date("fecha_inicio").notNull(), // Primer día de la semana
  fechaFin: date("fecha_fin").notNull(), // Último día de la semana
  observaciones: text("observaciones"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  vendedorIdx: index("IDX_promesas_compra_vendedor").on(table.vendedorId),
  semanaIdx: index("IDX_promesas_compra_semana").on(table.semana),
  clienteIdx: index("IDX_promesas_compra_cliente").on(table.clienteId),
}));

// Types
export type PromesaCompra = typeof promesasCompra.$inferSelect;
export type InsertPromesaCompra = typeof promesasCompra.$inferInsert;

// Schema de validación
export const insertPromesaCompraSchema = createInsertSchema(promesasCompra).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  montoPrometido: z.string().or(z.number()).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  vendedorId: z.string().min(1, "El vendedor es requerido"),
  clienteId: z.string().min(1, "El cliente es requerido"),
  clienteNombre: z.string().min(1, "El nombre del cliente es requerido"),
  semana: z.string().regex(/^\d{4}-\d{2}$/, "Formato de semana inválido (debe ser YYYY-WW)"),
  anio: z.number().min(2020).max(2100),
  numeroSemana: z.number().min(1).max(53),
  fechaInicio: z.string().or(z.date()).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  fechaFin: z.string().or(z.date()).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
});

// Tabla de hitos de marketing (calendario)
export const hitosMarketing = pgTable("hitos_marketing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  fecha: date("fecha").notNull(),
  tipo: varchar("tipo", { length: 50 }).notNull().default("general"), // general, campaña, evento, deadline
  color: varchar("color", { length: 20 }).default("#3b82f6"), // Color para visualización
  completado: boolean("completado").default(false),
  createdBy: varchar("created_by").notNull(), // Usuario que creó el hito
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fechaIdx: index("IDX_hitos_marketing_fecha").on(table.fecha),
  tipoIdx: index("IDX_hitos_marketing_tipo").on(table.tipo),
}));

// Types
export type HitoMarketing = typeof hitosMarketing.$inferSelect;
export type InsertHitoMarketing = typeof hitosMarketing.$inferInsert;

// Schema de validación
export const insertHitoMarketingSchema = createInsertSchema(hitosMarketing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  titulo: z.string().min(1, "El título es requerido"),
  fecha: z.string().or(z.date()).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  tipo: z.enum(["general", "campaña", "evento", "deadline"]).default("general"),
  completado: z.boolean().default(false),
  createdBy: z.string().min(1, "El creador es requerido"),
});

// ===== ESQUEMA VENTAS PARA TABLAS ETL =====
export const ventasSchema = pgSchema("ventas");

// ===== TABLAS DE STAGING PARA IMPORTACIÓN DESDE SQL SERVER =====

// Staging: MAEEDO (Encabezado de documentos)
export const stgMaeedo = ventasSchema.table("stg_maeedo", {
  idmaeedo: numeric("idmaeedo", { precision: 20, scale: 0 }).primaryKey(),
  empresa: text("empresa"),
  tido: text("tido"),
  nudo: text("nudo"),
  endo: text("endo"),
  suendo: text("suendo"),
  endofi: text("endofi"),
  tigedo: text("tigedo"),
  sudo: text("sudo"),
  luvtdo: text("luvtdo"),
  feemdo: date("feemdo"),
  kofudo: text("kofudo"),
  esdo: text("esdo"),
  espgdo: text("espgdo"),
  suli: text("suli"),
  bosulido: text("bosulido"),
  feer: date("feer"),
  vanedo: numeric("vanedo", { precision: 18, scale: 4 }),
  vaivdo: numeric("vaivdo", { precision: 18, scale: 4 }),
  vabrdo: numeric("vabrdo", { precision: 18, scale: 4 }),
  lilg: text("lilg"),
  modo: text("modo"),
  timodo: text("timodo"),
  tamodo: numeric("tamodo", { precision: 18, scale: 4 }),
  ocdo: text("ocdo"),
});

// Staging: MAEDDO (Detalle de documentos)
export const stgMaeddo = ventasSchema.table("stg_maeddo", {
  idmaeddo: numeric("idmaeddo", { precision: 20, scale: 0 }).primaryKey(),
  idmaeedo: numeric("idmaeedo", { precision: 20, scale: 0 }).notNull(),
  koprct: text("koprct"),
  nokopr: text("nokopr"),
  udtrpr: text("udtrpr"),
  caprco: numeric("caprco", { precision: 18, scale: 4 }),
  preuni: numeric("preuni", { precision: 18, scale: 6 }),
  vaneli: numeric("vaneli", { precision: 18, scale: 4 }),
  feemli: timestamp("feemli"),
  feerli: timestamp("feerli"),
  devol1: numeric("devol1", { precision: 18, scale: 4 }),
  devol2: numeric("devol2", { precision: 18, scale: 4 }),
  stockfis: numeric("stockfis", { precision: 18, scale: 4 }),
});

// Staging: MAEEN (Entidades/Clientes)
export const stgMaeen = ventasSchema.table("stg_maeen", {
  koen: text("koen").primaryKey(),
  nokoen: text("nokoen"),
  rut: text("rut"),
  zona: text("zona"),
});

// Staging: MAEPR (Productos)
export const stgMaepr = ventasSchema.table("stg_maepr", {
  kopr: text("kopr").primaryKey(),
  nomrpr: text("nomrpr"),
  ud01pr: text("ud01pr"),
  ud02pr: text("ud02pr"),
  tipr: text("tipr"),
});

// Staging: MAEVEN (Vendedores)
export const stgMaeven = ventasSchema.table("stg_maeven", {
  kofu: text("kofu").primaryKey(),
  nokofu: text("nokofu"),
});

// Staging: TABBO (Bodegas)
export const stgTabbo = ventasSchema.table("stg_tabbo", {
  suli: text("suli").notNull(),
  bosuli: text("bosuli").notNull(),
  nobosuli: text("nobosuli"),
}, (table) => ({
  pk: primaryKey({ columns: [table.suli, table.bosuli] }),
}));

// Staging: TABPP (Precios de productos)
export const stgTabpp = ventasSchema.table("stg_tabpp", {
  kopr: text("kopr").primaryKey(),
  listacost: numeric("listacost", { precision: 18, scale: 4 }),
  liscosmod: numeric("liscosmod", { precision: 18, scale: 4 }),
});

// ===== TABLA DE CONFIGURACIÓN ETL =====
export const etlConfig = ventasSchema.table("etl_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  etlName: varchar("etl_name", { length: 100 }).notNull().unique(), // Identificador del ETL
  customWatermark: timestamp("custom_watermark"), // Watermark personalizado (si se configura)
  useCustomWatermark: boolean("use_custom_watermark").default(false).notNull(), // Si usar watermark personalizado
  keepCustomWatermark: boolean("keep_custom_watermark").default(false).notNull(), // Si mantener watermark personalizado permanente
  timeoutMinutes: integer("timeout_minutes").default(10).notNull(), // Timeout en minutos
  intervalMinutes: integer("interval_minutes").default(15).notNull(), // Intervalo de ejecución automática en minutos
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types para etlConfig
export type EtlConfig = typeof etlConfig.$inferSelect;
export type InsertEtlConfig = typeof etlConfig.$inferInsert;

// ===== TABLA DE CONTROL ETL (Watermark) =====
export const etlExecutionLog = ventasSchema.table("etl_execution_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  etlName: varchar("etl_name", { length: 100 }).notNull().default('ventas_incremental'), // Identificador del ETL
  executionDate: timestamp("execution_date").notNull().defaultNow(),
  status: varchar("status", { length: 20 }).notNull(), // success, failed, running
  period: varchar("period", { length: 100 }).notNull(), // Formato: Descripción del período (ej: "2025-10-01 to 2025-10-20")
  documentTypes: text("document_types").notNull(), // FCV,GDV,FVL,NCV
  branches: text("branches").notNull(), // 004,006,007
  recordsProcessed: integer("records_processed"),
  executionTimeMs: integer("execution_time_ms"),
  errorMessage: text("error_message"),
  statistics: text("statistics"), // JSON con detalles de cada tabla
  watermarkDate: timestamp("watermark_date"), // Última fecha procesada
});

// Types para etlExecutionLog
export type EtlExecutionLog = typeof etlExecutionLog.$inferSelect;
export type InsertEtlExecutionLog = typeof etlExecutionLog.$inferInsert;

// ===== TABLA FINAL: FACT_VENTAS (84 columnas - incluye campos de control) =====
export const factVentas = ventasSchema.table("fact_ventas", {
  idmaeddo: numeric("idmaeddo", { precision: 20, scale: 0 }).primaryKey(),
  idmaeedo: numeric("idmaeedo", { precision: 20, scale: 0 }),
  tido: text("tido"),
  nudo: numeric("nudo", { precision: 20, scale: 0 }),
  endo: text("endo"),
  suendo: text("suendo"),
  sudo: numeric("sudo", { precision: 20, scale: 0 }),
  feemdo: date("feemdo"),
  feulvedo: date("feulvedo"),
  esdo: text("esdo"),
  espgdo: text("espgdo"),
  kofudo: text("kofudo"),
  modo: text("modo"),
  timodo: text("timodo"),
  tamodo: numeric("tamodo", { precision: 18, scale: 6 }),
  caprad: numeric("caprad", { precision: 20, scale: 0 }),
  caprex: numeric("caprex", { precision: 20, scale: 0 }),
  vanedo: numeric("vanedo", { precision: 20, scale: 0 }),
  vaivdo: numeric("vaivdo", { precision: 18, scale: 6 }),
  vabrdo: numeric("vabrdo", { precision: 20, scale: 0 }),
  lilg: text("lilg"),
  nulido: numeric("nulido", { precision: 20, scale: 0 }),
  sulido: numeric("sulido", { precision: 20, scale: 0 }),
  luvtlido: numeric("luvtlido", { precision: 18, scale: 6 }),
  bosulido: numeric("bosulido", { precision: 20, scale: 0 }),
  kofulido: text("kofulido"),
  prct: boolean("prct"),
  tict: numeric("tict", { precision: 18, scale: 6 }),
  tipr: text("tipr"),
  nusepr: numeric("nusepr", { precision: 18, scale: 6 }),
  koprct: text("koprct"),
  udtrpr: numeric("udtrpr", { precision: 20, scale: 0 }),
  rludpr: numeric("rludpr", { precision: 18, scale: 6 }),
  caprco1: numeric("caprco1", { precision: 18, scale: 6 }),
  caprad1: numeric("caprad1", { precision: 18, scale: 6 }),
  caprex1: numeric("caprex1", { precision: 18, scale: 6 }),
  caprnc1: numeric("caprnc1", { precision: 18, scale: 6 }),
  ud01pr: text("ud01pr"),
  caprco2: numeric("caprco2", { precision: 20, scale: 0 }),
  caprad2: numeric("caprad2", { precision: 20, scale: 0 }),
  caprex2: numeric("caprex2", { precision: 20, scale: 0 }),
  caprnc2: numeric("caprnc2", { precision: 20, scale: 0 }),
  ud02pr: text("ud02pr"),
  ppprne: numeric("ppprne", { precision: 18, scale: 6 }),
  ppprbr: numeric("ppprbr", { precision: 18, scale: 6 }),
  vaneli: numeric("vaneli", { precision: 20, scale: 0 }),
  vabrli: numeric("vabrli", { precision: 20, scale: 0 }),
  feemli: date("feemli"),
  feerli: timestamp("feerli"),
  ppprpm: numeric("ppprpm", { precision: 18, scale: 6 }),
  ppprpmifrs: numeric("ppprpmifrs", { precision: 18, scale: 6 }),
  logistica: numeric("logistica", { precision: 20, scale: 0 }),
  eslido: text("eslido"),
  ppprnere1: numeric("ppprnere1", { precision: 18, scale: 6 }),
  ppprnere2: numeric("ppprnere2", { precision: 18, scale: 6 }),
  fmpr: numeric("fmpr", { precision: 20, scale: 0 }),
  mrpr: numeric("mrpr", { precision: 18, scale: 6 }),
  zona: numeric("zona", { precision: 18, scale: 6 }),
  ruen: numeric("ruen", { precision: 18, scale: 6 }),
  recaprre: boolean("recaprre"),
  pfpr: numeric("pfpr", { precision: 18, scale: 6 }),
  hfpr: numeric("hfpr", { precision: 18, scale: 6 }),
  monto: numeric("monto", { precision: 20, scale: 2 }),
  ocdo: text("ocdo"),
  nokoprct: text("nokoprct"),
  nokozo: numeric("nokozo", { precision: 18, scale: 6 }),
  nosudo: text("nosudo"),
  nokofu: text("nokofu"),
  nokofudo: text("nokofudo"),
  nobosuli: text("nobosuli"),
  nokoen: text("nokoen"),
  noruen: text("noruen"),
  nomrpr: numeric("nomrpr", { precision: 18, scale: 6 }),
  nofmpr: text("nofmpr"),
  nopfpr: text("nopfpr"),
  nohfpr: text("nohfpr"),
  devol1: numeric("devol1", { precision: 20, scale: 0 }),
  devol2: numeric("devol2", { precision: 20, scale: 0 }),
  stockfis: numeric("stockfis", { precision: 20, scale: 0 }),
  listacost: numeric("listacost", { precision: 18, scale: 6 }),
  liscosmod: numeric("liscosmod", { precision: 20, scale: 0 }),
  
  // ETL control fields - for compatibility with sales_transactions
  id: varchar("id").notNull().default(sql`gen_random_uuid()`).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  dataSource: varchar("data_source", { length: 20 }).notNull().default('etl_sql_server'),
  lastEtlSync: timestamp("last_etl_sync"),
}, (table) => ({
  ixFeemli: index("ix_fact_ventas_feemli_id").on(table.feemli, table.idmaeedo, table.idmaeddo),
  ixCliente: index("ix_fact_ventas_cliente").on(table.endo),
  ixProducto: index("ix_fact_ventas_producto").on(table.koprct),
  ixVendedor: index("ix_fact_ventas_vendedor").on(table.kofudo),
  ixBodega: index("ix_fact_ventas_bodega").on(table.bosulido),
  // Additional indexes for query optimization
  ixFeemdo: index("ix_fact_ventas_feemdo").on(table.feemdo),
  ixNokoen: index("ix_fact_ventas_nokoen").on(table.nokoen),
  ixNoruen: index("ix_fact_ventas_noruen").on(table.noruen),
  ixNokofu: index("ix_fact_ventas_nokofu").on(table.nokofu),
  ixDataSource: index("ix_fact_ventas_data_source").on(table.dataSource),
}));

// Types para fact_ventas
export type FactVentas = typeof factVentas.$inferSelect;
export type InsertFactVentas = typeof factVentas.$inferInsert;

// Schema de validación para importación
export const insertFactVentasSchema = createInsertSchema(factVentas);

// ===== CRM PIPELINE SYSTEM =====

// CRM Leads - Pipeline de ventas
export const crmLeads = pgTable("crm_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  clientPhone: varchar("client_phone"),
  clientEmail: varchar("client_email"),
  clientCompany: text("client_company"),
  clientAddress: text("client_address"),
  
  // Pipeline stage
  stage: varchar("stage").notNull().default("lead"), // 'lead', 'contacto', 'visita', 'lista_precio', 'campana', 'primera_venta', 'promesa', 'venta'
  
  // Assignment
  salespersonId: varchar("salesperson_id").notNull(), // FK to salespeopleUsers.id
  salespersonName: text("salesperson_name"), // Denormalized for performance
  supervisorId: varchar("supervisor_id"), // FK to salespeopleUsers.id
  segment: varchar("segment"), // Segment (noruen)
  
  // Activity tracking
  hasCall: boolean("has_call").default(false),
  hasWhatsapp: boolean("has_whatsapp").default(false),
  lastContactDate: timestamp("last_contact_date"),
  
  // Purchase history tracking
  hasHistoricalSales: boolean("has_historical_sales").default(false), // True if client has previous purchases
  
  // Client classification
  clientType: varchar("client_type").default("nuevo"), // 'nuevo' o 'recurrente'
  nombreObra: text("nombre_obra"), // Nombre de la obra (solo para segmento construcción)
  
  // Metadata
  estimatedValue: numeric("estimated_value", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  salespersonIdIdx: index("IDX_crm_leads_salesperson_id").on(table.salespersonId),
  supervisorIdIdx: index("IDX_crm_leads_supervisor_id").on(table.supervisorId),
  stageIdx: index("IDX_crm_leads_stage").on(table.stage),
  segmentIdx: index("IDX_crm_leads_segment").on(table.segment),
}));

// CRM Comments - Comentarios por lead
export const crmComments = pgTable("crm_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(), // FK to crmLeads.id
  userId: varchar("user_id").notNull(), // FK to salespeopleUsers.id (quien escribió)
  userName: text("user_name"), // Denormalized for performance
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  leadIdIdx: index("IDX_crm_comments_lead_id").on(table.leadId),
  userIdIdx: index("IDX_crm_comments_user_id").on(table.userId),
}));

// Relations
export const crmLeadsRelations = relations(crmLeads, ({ many, one }) => ({
  comments: many(crmComments),
  salesperson: one(salespeopleUsers, {
    fields: [crmLeads.salespersonId],
    references: [salespeopleUsers.id],
  }),
  supervisor: one(salespeopleUsers, {
    fields: [crmLeads.supervisorId],
    references: [salespeopleUsers.id],
  }),
}));

export const crmCommentsRelations = relations(crmComments, ({ one }) => ({
  lead: one(crmLeads, {
    fields: [crmComments.leadId],
    references: [crmLeads.id],
  }),
  user: one(salespeopleUsers, {
    fields: [crmComments.userId],
    references: [salespeopleUsers.id],
  }),
}));

// Types
export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = typeof crmLeads.$inferInsert;
export type CrmComment = typeof crmComments.$inferSelect;
export type InsertCrmComment = typeof crmComments.$inferInsert;

// Validation schemas
export const insertCrmLeadSchema = createInsertSchema(crmLeads, {
  clientName: z.string().min(1, "Nombre del cliente es requerido"),
  clientPhone: z.string().optional().nullable(),
  clientEmail: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  stage: z.string().default("lead"),
  salespersonId: z.string().min(1, "Vendedor es requerido"),
  clientType: z.enum(["nuevo", "recurrente"]).default("nuevo"),
  nombreObra: z.string().optional().nullable(),
  estimatedValue: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmCommentSchema = createInsertSchema(crmComments, {
  leadId: z.string().min(1, "Lead ID es requerido"),
  userId: z.string().min(1, "User ID es requerido"),
  comment: z.string().min(1, "Comentario es requerido"),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCrmLeadInput = z.infer<typeof insertCrmLeadSchema>;
export type InsertCrmCommentInput = z.infer<typeof insertCrmCommentSchema>;

// CRM Pipeline Stages - Etapas personalizables del pipeline
export const crmStages = pgTable("crm_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // Nombre de la etapa
  stageKey: varchar("stage_key").notNull().unique(), // Identificador único (ej: 'lead', 'contacto')
  color: varchar("color").notNull(), // Color en formato HSL o hex
  order: integer("order").notNull(), // Orden de visualización
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orderIdx: index("IDX_crm_stages_order").on(table.order),
}));

export type CrmStage = typeof crmStages.$inferSelect;
export type InsertCrmStage = typeof crmStages.$inferInsert;

export const insertCrmStageSchema = createInsertSchema(crmStages, {
  name: z.string().min(1, "Nombre es requerido"),
  stageKey: z.string().min(1, "Identificador es requerido"),
  color: z.string().min(1, "Color es requerido"),
  order: z.number().min(0, "Orden debe ser positivo"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrmStageInput = z.infer<typeof insertCrmStageSchema>;

// Clientes Inactivos - Alertas de clientes que necesitan seguimiento
export const clientesInactivos = pgTable("clientes_inactivos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Información del cliente
  clientName: text("client_name").notNull(),
  clientKoen: varchar("client_koen").notNull().unique(), // ID del cliente en el sistema de ventas - UNIQUE para UPSERT
  clientRut: varchar("client_rut"),
  clientEmail: varchar("client_email"),
  clientPhone: varchar("client_phone"),
  
  // Información de ventas
  lastPurchaseDate: timestamp("last_purchase_date"),
  lastPurchaseAmount: numeric("last_purchase_amount", { precision: 15, scale: 2 }),
  daysSinceLastPurchase: integer("days_since_last_purchase"),
  totalPurchasesLastYear: numeric("total_purchases_last_year", { precision: 15, scale: 2 }),
  
  // Segmentación y asignación
  segment: varchar("segment"), // Segmento del cliente (noruen)
  salespersonId: varchar("salesperson_id"), // Vendedor asignado (si lo tiene)
  salespersonName: text("salesperson_name"),
  supervisorId: varchar("supervisor_id"), // Supervisor del segmento
  supervisorName: text("supervisor_name"),
  
  // Estado de la alerta
  addedToCrm: boolean("added_to_crm").default(false),
  crmLeadId: varchar("crm_lead_id"), // FK a crmLeads si fue añadido
  dismissed: boolean("dismissed").default(false), // Si el usuario descartó la alerta
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clientKoenIdx: index("IDX_clientes_inactivos_koen").on(table.clientKoen),
  segmentIdx: index("IDX_clientes_inactivos_segment").on(table.segment),
  salespersonIdx: index("IDX_clientes_inactivos_salesperson").on(table.salespersonId),
  supervisorIdx: index("IDX_clientes_inactivos_supervisor").on(table.supervisorId),
  addedToCrmIdx: index("IDX_clientes_inactivos_added_to_crm").on(table.addedToCrm),
}));

export type ClienteInactivo = typeof clientesInactivos.$inferSelect;
export type InsertClienteInactivo = typeof clientesInactivos.$inferInsert;

export const insertClienteInactivoSchema = createInsertSchema(clientesInactivos, {
  clientName: z.string().min(1, "Nombre del cliente es requerido"),
  daysSinceLastPurchase: z.number().min(0, "Días debe ser positivo"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClienteInactivoInput = z.infer<typeof insertClienteInactivoSchema>;

// API Keys for external integrations (Make.com, Zapier, etc.)
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API Key information
  keyHash: varchar("key_hash").notNull().unique(), // Hashed API key
  keyPrefix: varchar("key_prefix").notNull(), // First 8 chars for identification (e.g., "mk_live_abcd1234...")
  name: varchar("name").notNull(), // Descriptive name for the key
  description: text("description"), // Optional description
  
  // Access control
  role: varchar("role").notNull().default("readonly"), // readonly, read_write, admin
  isActive: boolean("is_active").default(true),
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),
  
  // Metadata
  createdBy: varchar("created_by").notNull(), // User ID who created the key
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration date
}, (table) => ({
  keyHashIdx: index("IDX_api_keys_hash").on(table.keyHash),
  isActiveIdx: index("IDX_api_keys_active").on(table.isActive),
  createdByIdx: index("IDX_api_keys_created_by").on(table.createdBy),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

export const insertApiKeySchema = createInsertSchema(apiKeys, {
  name: z.string().min(1, "Nombre es requerido"),
  description: z.string().optional().nullable(),
  role: z.enum(["readonly", "read_write", "admin"]).default("readonly"),
  createdBy: z.string().min(1, "Creador es requerido"),
}).omit({
  id: true,
  keyHash: true,
  keyPrefix: true,
  lastUsedAt: true,
  usageCount: true,
  createdAt: true,
});

export type InsertApiKeyInput = z.infer<typeof insertApiKeySchema>;

// Proyecciones Manuales de Ventas - Planificación futura por vendedor y cliente
export const proyeccionesVentas = pgTable("proyecciones_ventas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Información de la proyección
  year: integer("year").notNull(), // Año de la proyección
  month: integer("month"), // Mes de la proyección (1-12), null para proyecciones anuales
  salespersonCode: varchar("salesperson_code").notNull(), // Código del vendedor (vavven de fact_ventas)
  salespersonName: text("salesperson_name"), // Nombre del vendedor para referencia
  clientCode: varchar("client_code").notNull(), // Código del cliente (vakoen de fact_ventas)
  clientName: text("client_name"), // Nombre del cliente para referencia
  
  // Datos de la proyección
  projectedAmount: numeric("projected_amount", { precision: 15, scale: 2 }).default('0'), // Monto proyectado
  segment: varchar("segment"), // Segmento del cliente (noruen)
  
  // Metadata
  createdBy: varchar("created_by").notNull(), // Usuario que creó la proyección
  createdByName: text("created_by_name"), // Nombre del usuario
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Índices para búsqueda eficiente
  yearIdx: index("IDX_proyecciones_year").on(table.year),
  monthIdx: index("IDX_proyecciones_month").on(table.month),
  salespersonIdx: index("IDX_proyecciones_salesperson").on(table.salespersonCode),
  clientIdx: index("IDX_proyecciones_client").on(table.clientCode),
}));

export type ProyeccionVenta = typeof proyeccionesVentas.$inferSelect;
export type InsertProyeccionVenta = typeof proyeccionesVentas.$inferInsert;

export const insertProyeccionVentaSchema = createInsertSchema(proyeccionesVentas, {
  year: z.number().int().min(2020).max(2050),
  month: z.number().int().min(1).max(12).optional().nullable(),
  salespersonCode: z.string().min(1, "Código de vendedor es requerido"),
  clientCode: z.string().min(1, "Código de cliente es requerido"),
  projectedAmount: z.string().or(z.number()).transform(val => String(val)).default('0'),
  createdBy: z.string().min(1, "Usuario creador es requerido"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProyeccionVentaInput = z.infer<typeof insertProyeccionVentaSchema>;
