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
  role: varchar("role").default("user"), // admin, supervisor, salesperson, client
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

// Client relations - Connect clients with sales transactions
export const clientsRelations = relations(clients, ({ many }) => ({
  transactionsByName: many(salesTransactions),
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

// Type exports for CSV import
export type CsvProductStockImport = z.infer<typeof csvProductStockImportSchema>;
export type CsvProductImport = z.infer<typeof csvProductImportSchema>;
export type InsertWarehouseInput = z.infer<typeof insertWarehouseSchema>;
export type InsertProductStockInput = z.infer<typeof insertProductStockSchema>;
export type InsertProductPriceHistoryInput = z.infer<typeof insertProductPriceHistorySchema>;

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
  role: varchar("role").default("salesperson"), // "admin" | "supervisor" | "salesperson" | "client"
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
  role: z.enum(["admin", "supervisor", "salesperson", "client"]).default("salesperson"),
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

// Orders system - Tomador de Pedidos
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(), // Auto-generated order number
  clientName: text("client_name").notNull(), // Client name (referencing clients.nokoen)
  clientId: varchar("client_id"), // Optional FK to clients.id for structured reference
  createdBy: varchar("created_by").notNull(), // FK to users.id - who created the order
  status: varchar("status").default("draft"), // draft, confirmed, processing, completed, cancelled
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  notes: text("notes"), // Additional notes about the order
  estimatedDeliveryDate: timestamp("estimated_delivery_date"), // Optional estimated delivery
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }), // Calculated total if items exist
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(), // FK to orders.id
  productName: text("product_name").notNull(), // Product name
  productCode: varchar("product_code"), // Optional product code (KOPR)
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 15, scale: 2 }),
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

// Schemas for validation
export const insertOrderSchema = createInsertSchema(orders, {
  clientName: z.string().min(1, "Nombre del cliente es requerido"),
  status: z.enum(["draft", "confirmed", "processing", "completed", "cancelled"]).default("draft"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  notes: z.string().optional(),
  estimatedDeliveryDate: z.string().optional().or(z.null()),
}).omit({
  id: true,
  orderNumber: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
  productName: z.string().min(1, "Nombre del producto es requerido"),
  quantity: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? val : val.toString()
  ),
  unitPrice: z.union([z.string(), z.number()]).optional().transform((val) => 
    val === undefined || val === null ? undefined : (typeof val === 'string' ? val : val.toString())
  ),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertOrderInput = z.infer<typeof insertOrderSchema>;
export type InsertOrderItemInput = z.infer<typeof insertOrderItemSchema>;

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

// eCommerce Products - Vinculación de productos de priceList con configuración ecommerce
export const ecommerceProducts = pgTable("ecommerce_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  priceListId: varchar("price_list_id").notNull(), // FK to priceList.id
  activo: boolean("activo").default(false), // Si aparece en la tienda
  categoria: varchar("categoria"), // Categoría asignada
  descripcion: text("descripcion"), // Descripción para la tienda
  imagenUrl: varchar("imagen_url"), // URL de imagen del producto
  precioEcommerce: numeric("precio_ecommerce", { precision: 15, scale: 2 }), // Precio específico para ecommerce
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

// Schemas for eCommerce Products  
export const insertEcommerceProductSchema = createInsertSchema(ecommerceProducts, {
  priceListId: z.string().min(1, "ID de producto de lista de precios es requerido"),
  categoria: z.string().optional(),
  descripcion: z.string().optional(),
  imagenUrl: z.string().url("URL de imagen inválida").optional().or(z.literal("")),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type EcommerceCategory = typeof ecommerceCategories.$inferSelect;
export type InsertEcommerceCategory = typeof ecommerceCategories.$inferInsert;
export type EcommerceProduct = typeof ecommerceProducts.$inferSelect;
export type InsertEcommerceProduct = typeof ecommerceProducts.$inferInsert;
export type InsertEcommerceCategoryInput = z.infer<typeof insertEcommerceCategorySchema>;
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
