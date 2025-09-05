import { sql } from 'drizzle-orm';
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

export const insertSalesTransactionSchema = createInsertSchema(salesTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Override numeric fields to accept numbers instead of strings
  idmaeedo: z.number().optional().nullable(),
  tamodo: z.number().optional().nullable(),
  caprad: z.number().optional().nullable(),
  caprex: z.number().optional().nullable(),
  vanedo: z.number().optional().nullable(),
  vaivdo: z.number().optional().nullable(),
  vabrdo: z.number().optional().nullable(),
  udtrpr: z.number().optional().nullable(),
  rludpr: z.number().optional().nullable(),
  caprco1: z.number().optional().nullable(),
  caprad1: z.number().optional().nullable(),
  caprex1: z.number().optional().nullable(),
  caprnc1: z.number().optional().nullable(),
  caprco2: z.number().optional().nullable(),
  caprad2: z.number().optional().nullable(),
  caprex2: z.number().optional().nullable(),
  caprnc2: z.number().optional().nullable(),
  ppprne: z.number().optional().nullable(),
  ppprbr: z.number().optional().nullable(),
  vaneli: z.number().optional().nullable(),
  vabrli: z.number().optional().nullable(),
  ppprpm: z.number().optional().nullable(),
  ppprpmifrs: z.number().optional().nullable(),
  logistica: z.number().optional().nullable(),
  ppprnere1: z.number().optional().nullable(),
  ppprnere2: z.number().optional().nullable(),
  idmaeddo: z.number().optional().nullable(),
  recaprre: z.number().optional().nullable(),
  monto: z.number().optional().nullable(),
  devol1: z.number().optional().nullable(),
  devol2: z.number().optional().nullable(),
  stockfis: z.number().optional().nullable(),
  liscosmod: z.number().optional().nullable(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertSalesTransaction = z.infer<typeof insertSalesTransactionSchema>;
export type SalesTransaction = typeof salesTransactions.$inferSelect;
