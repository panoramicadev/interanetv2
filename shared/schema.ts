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

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // admin, salesperson, client
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
  idmaeedo: numeric("idmaeedo", { precision: 10, scale: 2 }),
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

// Manual schema for CSV import to handle numeric fields correctly
export const insertSalesTransactionSchema = z.object({
  nudo: z.string(),
  feemdo: z.string(),
  koprct: z.string().optional().nullable(),
  nokoen: z.string().optional().nullable(),
  noruen: z.string().optional().nullable(),
  nokoprct: z.string().optional().nullable(),
  nokofu: z.string().optional().nullable(),
  luvtlido: z.number().optional().nullable(),
  
  // All numeric fields as strings (Drizzle numeric columns accept strings)
  idmaeedo: z.string().optional().nullable(),
  tamodo: z.string().optional().nullable(),
  caprad: z.string().optional().nullable(),
  caprex: z.string().optional().nullable(),
  vanedo: z.string().optional().nullable(),
  vaivdo: z.string().optional().nullable(),
  vabrdo: z.string().optional().nullable(),
  udtrpr: z.string().optional().nullable(),
  rludpr: z.string().optional().nullable(),
  caprco1: z.string().optional().nullable(),
  caprad1: z.string().optional().nullable(),
  caprex1: z.string().optional().nullable(),
  caprnc1: z.string().optional().nullable(),
  caprco2: z.string().optional().nullable(),
  caprad2: z.string().optional().nullable(),
  caprex2: z.string().optional().nullable(),
  caprnc2: z.string().optional().nullable(),
  ppprne: z.string().optional().nullable(),
  ppprbr: z.string().optional().nullable(),
  vaneli: z.string().optional().nullable(),
  vabrli: z.string().optional().nullable(),
  ppprpm: z.string().optional().nullable(),
  ppprpmifrs: z.string().optional().nullable(),
  logistica: z.string().optional().nullable(),
  ppprnere1: z.string().optional().nullable(),
  ppprnere2: z.string().optional().nullable(),
  idmaeddo: z.string().optional().nullable(),
  recaprre: z.string().optional().nullable(),
  monto: z.string().optional().nullable(),
  devol1: z.string().optional().nullable(),
  devol2: z.string().optional().nullable(),
  stockfis: z.string().optional().nullable(),
  liscosmod: z.string().optional().nullable(),
  
  // Text fields
  emdo: z.string().optional().nullable(),
  endo: z.string().optional().nullable(),
  suendo: z.string().optional().nullable(),
  kofuendo: z.string().optional().nullable(),
  emdofi: z.string().optional().nullable(),
  endofi: z.string().optional().nullable(),
  fmpr: z.string().optional().nullable(),
  femado: z.string().optional().nullable(),
  edoren: z.string().optional().nullable(),
  nlcomtr: z.string().optional().nullable(),
  nofmen: z.string().optional().nullable(),
  tijofm: z.string().optional().nullable(),
  foen: z.string().optional().nullable(),
  fuenma: z.string().optional().nullable(),
  koendmds: z.string().optional().nullable(),
  koen: z.string().optional().nullable(),
  suen: z.string().optional().nullable(),
  kofuen: z.string().optional().nullable(),
  nokoen1: z.string().optional().nullable(),
  nokoen2: z.string().optional().nullable(),
  nokoendirren: z.string().optional().nullable(),
  dirigido: z.string().optional().nullable(),
  lien: z.string().optional().nullable(),
  ruen: z.string().optional().nullable(),
  pfpr: z.string().optional().nullable(),
  hfpr: z.string().optional().nullable(),
  ocdo: z.string().optional().nullable(),
  nofmpr: z.string().optional().nullable(),
  nopfpr: z.string().optional().nullable(),
  nohfpr: z.string().optional().nullable(),
  listacost: z.string().optional().nullable(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
