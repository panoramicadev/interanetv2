import {
  users,
  salesTransactions,
  type User,
  type UpsertUser,
  type SalesTransaction,
  type InsertSalesTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Sales operations
  insertSalesTransaction(transaction: InsertSalesTransaction): Promise<SalesTransaction>;
  insertMultipleSalesTransactions(transactions: InsertSalesTransaction[]): Promise<void>;
  getSalesTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
    limit?: number;
    offset?: number;
  }): Promise<SalesTransaction[]>;
  getSalesMetrics(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  }): Promise<{
    totalSales: number;
    totalTransactions: number;
    totalUnits: number;
    activeCustomers: number;
  }>;
  getTopSalespeople(limit?: number): Promise<Array<{
    salesperson: string;
    totalSales: number;
    transactionCount: number;
  }>>;
  getTopProducts(limit?: number): Promise<Array<{
    productName: string;
    totalSales: number;
    totalUnits: number;
  }>>;
  getTopClients(limit?: number): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
  }>>;
  getSegmentAnalysis(): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>>;
  getSalesChartData(period: 'weekly' | 'monthly' | 'daily'): Promise<Array<{
    period: string;
    sales: number;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Sales operations
  async insertSalesTransaction(transaction: InsertSalesTransaction): Promise<SalesTransaction> {
    const [result] = await db
      .insert(salesTransactions)
      .values(transaction)
      .returning();
    return result;
  }

  async insertMultipleSalesTransactions(transactions: InsertSalesTransaction[]): Promise<void> {
    if (transactions.length === 0) return;
    
    await db.insert(salesTransactions).values(transactions);
  }

  async getSalesTransactions(filters: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SalesTransaction[]> {
    const { startDate, endDate, salesperson, segment, limit = 50, offset = 0 } = filters;
    
    let query = db.select().from(salesTransactions);
    const conditions = [];
    
    if (startDate) {
      conditions.push(gte(salesTransactions.feemdo, startDate));
    }
    if (endDate) {
      conditions.push(lte(salesTransactions.feemdo, endDate));
    }
    if (salesperson) {
      conditions.push(eq(salesTransactions.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(salesTransactions.noruen, segment));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query
      .orderBy(desc(salesTransactions.feemdo))
      .limit(limit)
      .offset(offset);
  }

  async getSalesMetrics(filters: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  } = {}): Promise<{
    totalSales: number;
    totalTransactions: number;
    totalUnits: number;
    activeCustomers: number;
  }> {
    const { startDate, endDate, salesperson, segment } = filters;
    const conditions = [];
    
    if (startDate) {
      conditions.push(gte(salesTransactions.feemdo, startDate));
    }
    if (endDate) {
      conditions.push(lte(salesTransactions.feemdo, endDate));
    }
    if (salesperson) {
      conditions.push(eq(salesTransactions.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(salesTransactions.noruen, segment));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprad2}), 0)`,
        activeCustomers: sql<number>`COUNT(DISTINCT ${salesTransactions.nokoen})`,
      })
      .from(salesTransactions)
      .where(whereClause);

    return {
      totalSales: Number(metrics.totalSales),
      totalTransactions: Number(metrics.totalTransactions),
      totalUnits: Number(metrics.totalUnits),
      activeCustomers: Number(metrics.activeCustomers),
    };
  }

  async getTopSalespeople(limit = 10): Promise<Array<{
    salesperson: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    const results = await db
      .select({
        salesperson: salesTransactions.nokofu,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokofu} IS NOT NULL AND ${salesTransactions.nokofu} != ''`)
      .groupBy(salesTransactions.nokofu)
      .orderBy(sql`SUM(${salesTransactions.monto}) DESC`)
      .limit(limit);

    return results.map(r => ({
      salesperson: r.salesperson || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async getTopProducts(limit = 10): Promise<Array<{
    productName: string;
    totalSales: number;
    totalUnits: number;
  }>> {
    const results = await db
      .select({
        productName: salesTransactions.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprad2}), 0)`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokoprct} IS NOT NULL AND ${salesTransactions.nokoprct} != ''`)
      .groupBy(salesTransactions.nokoprct)
      .orderBy(sql`SUM(${salesTransactions.monto}) DESC`)
      .limit(limit);

    return results.map(r => ({
      productName: r.productName || '',
      totalSales: Number(r.totalSales),
      totalUnits: Number(r.totalUnits),
    }));
  }

  async getTopClients(limit = 10): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    const results = await db
      .select({
        clientName: salesTransactions.nokoen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokoen} IS NOT NULL AND ${salesTransactions.nokoen} != ''`)
      .groupBy(salesTransactions.nokoen)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS DECIMAL)) DESC`)
      .limit(limit);

    return results.map(r => ({
      clientName: r.clientName || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async getSegmentAnalysis(): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>> {
    const [totalSalesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions);

    const totalSales = Number(totalSalesResult.total);

    const results = await db
      .select({
        segment: salesTransactions.noruen,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.noruen} IS NOT NULL AND ${salesTransactions.noruen} != ''`)
      .groupBy(salesTransactions.noruen)
      .orderBy(sql`SUM(${salesTransactions.monto}) DESC`);

    return results.map(r => ({
      segment: r.segment || '',
      totalSales: Number(r.totalSales),
      percentage: totalSales > 0 ? (Number(r.totalSales) / totalSales) * 100 : 0,
    }));
  }

  async getSalesChartData(period: 'weekly' | 'monthly' | 'daily'): Promise<Array<{
    period: string;
    sales: number;
  }>> {
    let query: any;
    
    switch (period) {
      case 'daily':
        query = db
          .select({
            period: sql<string>`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM-DD')`,
            sales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
          })
          .from(salesTransactions)
          .where(sql`${salesTransactions.feemdo} IS NOT NULL`)
          .groupBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM-DD')`)
          .orderBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM-DD')`);
        break;
      case 'weekly':
        query = db
          .select({
            period: sql<string>`'Semana ' || EXTRACT(week FROM ${salesTransactions.feemdo})`,
            sales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
          })
          .from(salesTransactions)
          .where(sql`${salesTransactions.feemdo} IS NOT NULL`)
          .groupBy(sql`EXTRACT(week FROM ${salesTransactions.feemdo})`)
          .orderBy(sql`EXTRACT(week FROM ${salesTransactions.feemdo})`);
        break;
      case 'monthly':
      default:
        query = db
          .select({
            period: sql<string>`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM')`,
            sales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
          })
          .from(salesTransactions)
          .where(sql`${salesTransactions.feemdo} IS NOT NULL`)
          .groupBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM')`);
        break;
    }

    const results = await query;

    return results.map(r => ({
      period: r.period,
      sales: Number(r.sales),
    }));
  }
}

export const storage = new DatabaseStorage();
