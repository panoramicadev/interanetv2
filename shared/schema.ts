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
export type User = typeof users.$inferSelect;

// Products table - Simplified KOPR-based structure with only necessary fields
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kopr: varchar("kopr").notNull().unique(), // KOPR - Product Code (Primary Key)
  name: text("name").notNull(), // NOKOPR - Product Name
  ud02pr: varchar("ud02pr"), // UD02PR - Secondary unit presentation (Galón/Balde/Litro)
  priceProduct: numeric("price_product", { precision: 15, scale: 2 }), // Price field separate from CSV
  
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
