import {
  users,
  salesTransactions,
  goals,
  salespeopleUsers,
  products,
  productStock,
  productPriceHistory,
  type User,
  type UpsertUser,
  type SalesTransaction,
  type InsertSalesTransaction,
  type Goal,
  type InsertGoal,
  type SalespersonUser,
  type InsertSalespersonUser,
  type Product,
  type InsertProduct,
  type ProductStock,
  type InsertProductStock,
  type ProductPriceHistory,
  type InsertProductPriceHistory,
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
  getTopSalespeople(limit?: number, startDate?: string, endDate?: string): Promise<Array<{
    salesperson: string;
    totalSales: number;
    transactionCount: number;
  }>>;
  getTopProducts(limit?: number, startDate?: string, endDate?: string): Promise<Array<{
    productName: string;
    totalSales: number;
    totalUnits: number;
  }>>;
  getTopClients(limit?: number, startDate?: string, endDate?: string, salesperson?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
  }>>;
  getSegmentAnalysis(startDate?: string, endDate?: string): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>>;
  getSalesChartData(period: 'weekly' | 'monthly' | 'daily', startDate?: string, endDate?: string, salesperson?: string): Promise<Array<{
    period: string;
    sales: number;
  }>>;
  
  // Goals operations
  getGoals(): Promise<Goal[]>;
  getGoalsByType(type: string): Promise<Goal[]>;
  getGoalsBySalesperson(salesperson: string): Promise<Goal[]>;
  getSalespersonAlerts(salesperson: string): Promise<any[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, goal: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
  
  // Data for goals form
  getUniqueSegments(): Promise<string[]>;
  getUniqueSalespeople(): Promise<string[]>;
  getUniqueClients(): Promise<string[]>;
  
  // Client categorization for salespeople
  getSalespersonClientsAnalysis(salesperson: string): Promise<{
    vipClients: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
      averageTicket: number;
      lastPurchaseDate: string;
      daysSinceLastPurchase: number;
    }>;
    inactiveClients: Array<{
      clientName: string;
      totalSales: number;
      lastPurchaseDate: string;
      daysSinceLastPurchase: number;
    }>;
    frequentClients: Array<{
      clientName: string;
      transactionCount: number;
      totalSales: number;
      purchaseFrequency: number;
    }>;
    clientsWithTopProducts: Array<{
      clientName: string;
      topProduct: string;
      productSales: number;
      totalClientSales: number;
    }>;
  }>;
  
  // Sales data for goals comparison
  getGlobalSalesForPeriod(period: string): Promise<number>;
  getSegmentSalesForPeriod(segment: string, period: string): Promise<number>;
  getSalespersonSalesForPeriod(salesperson: string, period: string): Promise<number>;
  
  // Segment detail operations
  getSegmentClients(segmentName: string, period?: string, filterType?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>>;
  getSegmentSalespeople(segmentName: string, period?: string, filterType?: string): Promise<Array<{
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>>;
  
  // Salesperson detail operations
  getSalespersonDetails(salespersonName: string, period?: string, filterType?: string): Promise<{
    totalSales: number;
    totalClients: number;
    transactionCount: number;
    averageTicket: number;
    salesFrequency: number; // days between sales
  }>;
  getSalespersonClients(salespersonName: string, period?: string, filterType?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    lastSale: string;
    daysSinceLastSale: number;
  }>>;
  
  // Client detail operations
  getClientDetails(clientName: string, period?: string, filterType?: string): Promise<{
    totalPurchases: number;
    totalProducts: number;
    transactionCount: number;
    averageTicket: number;
    purchaseFrequency: number; // days between purchases
  }>;
  getClientProducts(clientName: string, period?: string, filterType?: string): Promise<Array<{
    productName: string;
    totalPurchases: number;
    transactionCount: number;
    averagePrice: number;
    lastPurchase: string;
    daysSinceLastPurchase: number;
  }>>;
  
  // Salesperson users management
  getSalespeopleUsers(): Promise<SalespersonUser[]>;
  getSupervisors(): Promise<SalespersonUser[]>;
  createSalespersonUser(user: InsertSalespersonUser): Promise<SalespersonUser>;
  updateSalespersonUser(id: string, user: Partial<InsertSalespersonUser>): Promise<SalespersonUser>;
  deleteSalespersonUser(id: string): Promise<void>;
  getSalespersonUser(id: string): Promise<SalespersonUser | undefined>;
  getSalespersonUserByEmail(email: string): Promise<SalespersonUser | undefined>;
  
  // Supervisor specific methods
  getSalespeopleUnderSupervisor(supervisorId: string): Promise<Array<{
    id: string;
    salespersonName: string;
    email: string;
    totalSales: number;
    transactionCount: number;
    lastSale: string;
    goals: Array<{
      id: string;
      description: string;
      targetAmount: number;
      currentSales: number;
      remaining: number;
      period: string;
      progress: number;
    }>;
  }>>;
  getSupervisorGoals(supervisorId: string): Promise<Goal[]>;
  getSupervisorAlerts(supervisorId: string): Promise<Array<{
    type: 'inactive' | 'below_goal' | 'projection';
    severity: 'low' | 'medium' | 'high';
    salesperson: string;
    message: string;
    data: any;
  }>>;
  
  // Product operations
  getProducts(filters?: {
    search?: string;
    active?: boolean;
    hasPrices?: boolean;
    warehouseCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<Product & {
    totalStock?: number;
    warehouses?: string[];
  }>>;
  getProduct(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(sku: string, product: Partial<InsertProduct>): Promise<Product>;
  updateProductPrice(sku: string, newPrice: number, changedBy: string, reason?: string): Promise<Product>;
  
  // Product stock operations
  getProductStock(sku: string): Promise<ProductStock[]>;
  getProductStockByWarehouse(sku: string, warehouseCode: string, branchCode?: string): Promise<ProductStock[]>;
  upsertProductStock(stock: InsertProductStock): Promise<ProductStock>;
  importProductStockFromCSV(csvData: Array<{
    sku: string;
    name: string;
    unit1: string;
    unit2: string;
    branchCode: string;
    warehouseCode: string;
    warehouseLocation?: string;
    physicalStock1?: number;
    physicalStock2?: number;
    availableStock1?: number;
    availableStock2?: number;
    committedStock1?: number;
    committedStock2?: number;
    unitRatio?: number;
    fmpr?: string;
    pfpr?: string;
    hfpr?: string;
    rupr?: string;
    mrpr?: string;
  }>): Promise<{
    processedProducts: number;
    newProducts: number;
    updatedStock: number;
    errors: string[];
  }>;
  
  // Product analytics
  getProductAnalytics(sku: string): Promise<{
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    averagePrice: number;
    topClients: Array<{
      clientName: string;
      totalPurchases: number;
      units: number;
    }>;
    salesTrend: Array<{
      period: string;
      sales: number;
      units: number;
    }>;
  }>;
  
  // Price history
  getProductPriceHistory(sku: string): Promise<ProductPriceHistory[]>;
  
  // Warehouse and branch operations
  getWarehouses(): Promise<Array<{
    code: string;
    name: string;
    location?: string;
    productCount: number;
  }>>;
  getBranches(): Promise<Array<{
    code: string;
    name: string;
    warehouseCount: number;
  }>>;
  getStockSummaryByWarehouse(): Promise<Array<{
    warehouseCode: string;
    warehouseName: string;
    totalProducts: number;
    totalPhysicalStock: number;
    totalAvailableStock: number;
  }>>;
  getWarehouseStock(warehouseCode: string, branchCode?: string): Promise<Array<{
    productSku: string;
    productName: string;
    branchCode: string;
    physicalStock1: number;
    physicalStock2: number;
    availableStock1: number;
    availableStock2: number;
    unit1?: string;
    unit2?: string;
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
    
    // Direct insertion - all transactions will be saved
    // Duplicates are handled in queries through NUDO grouping
    await db
      .insert(salesTransactions)
      .values(transactions);
    
    console.log(`🔄 Successfully imported ${transactions.length} sales transactions`);
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
      query = query.where(and(...conditions)) as any;
    }
    
    const result = await query
      .orderBy(desc(salesTransactions.feemdo))
      .limit(limit)
      .offset(offset);
    
    return result;
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

    // Calculate metrics using MONTO field - group by NUDO first to avoid double counting
    const salesByNudo = await db
      .select({
        nudo: salesTransactions.nudo,
        tido: salesTransactions.tido,
        monto: salesTransactions.monto,
        nokoen: salesTransactions.nokoen,
        totalUnits: sql<number>`SUM(${salesTransactions.caprco2})`,
      })
      .from(salesTransactions)
      .where(whereClause)
      .groupBy(salesTransactions.nudo, salesTransactions.tido, salesTransactions.monto, salesTransactions.nokoen);

    // Calculate final metrics from grouped data
    const totalSales = salesByNudo.reduce((sum, row) => {
      const amount = row.tido === 'NCV' ? -Number(row.monto) : Number(row.monto);
      return sum + amount;
    }, 0);

    const totalTransactions = new Set(salesByNudo.map(row => row.nudo)).size;
    const activeCustomers = new Set(salesByNudo.map(row => row.nokoen)).size;
    const totalUnits = salesByNudo.reduce((sum, row) => sum + Number(row.totalUnits), 0);

    const metrics = {
      totalSales,
      totalTransactions,
      totalUnits,
      activeCustomers,
    };

    return {
      totalSales: Number(metrics.totalSales),
      totalTransactions: Number(metrics.totalTransactions),
      totalUnits: Number(metrics.totalUnits),
      activeCustomers: Number(metrics.activeCustomers),
    };
  }

  async getTopSalespeople(limit = 10, startDate?: string, endDate?: string): Promise<Array<{
    salesperson: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    const conditions = [
      sql`nokofu IS NOT NULL AND nokofu != ''`
    ];
    
    if (startDate) {
      conditions.push(sql`feemdo >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`feemdo <= ${endDate}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    const results = await db
      .select({
        salesperson: sql<string>`nokofu`,
        totalSales: sql<number>`COALESCE(SUM(
          CASE 
            WHEN tido = 'NCV' THEN -monto
            ELSE monto
          END
        ), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(sql`(
        SELECT DISTINCT 
          nudo,
          nokofu,
          tido,
          monto
        FROM ${salesTransactions} 
        ${whereClause}
        GROUP BY nudo, nokofu, tido, monto
      ) as unique_transactions`)
      .groupBy(sql`nokofu`)
      .orderBy(sql`SUM(CASE WHEN tido = 'NCV' THEN -monto ELSE monto END) DESC`)
      .limit(limit);

    return results.map(r => ({
      salesperson: r.salesperson || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async getTopProducts(limit = 10, startDate?: string, endDate?: string): Promise<Array<{
    productName: string;
    totalSales: number;
    totalUnits: number;
  }>> {
    const conditions = [];
    
    if (startDate) {
      conditions.push(gte(salesTransactions.feemdo, startDate));
    }
    if (endDate) {
      conditions.push(lte(salesTransactions.feemdo, endDate));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // For products, sum by individual product lines (not NUDO grouping)
    const results = await db
      .select({
        productName: salesTransactions.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(
          CASE 
            WHEN ${salesTransactions.tido} = 'NCV' THEN -${salesTransactions.ppprne}
            ELSE ${salesTransactions.ppprne}
          END
        ), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokoprct} IS NOT NULL AND ${salesTransactions.nokoprct} != '' ${whereClause ? sql`AND ${whereClause}` : sql``}`)
      .groupBy(salesTransactions.nokoprct)
      .orderBy(sql`SUM(CASE WHEN ${salesTransactions.tido} = 'NCV' THEN -${salesTransactions.ppprne} ELSE ${salesTransactions.ppprne} END) DESC`)
      .limit(limit);

    return results.map(r => ({
      productName: r.productName || '',
      totalSales: Number(r.totalSales),
      totalUnits: Number(r.totalUnits),
    }));
  }

  async getTopClients(limit = 10, startDate?: string, endDate?: string, salesperson?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    const conditions = [
      sql`nokoen IS NOT NULL AND nokoen != ''`
    ];
    
    if (startDate) {
      conditions.push(sql`feemdo >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`feemdo <= ${endDate}`);
    }
    if (salesperson) {
      conditions.push(sql`nokofu = ${salesperson}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    const results = await db
      .select({
        clientName: sql<string>`nokoen`,
        totalSales: sql<number>`COALESCE(SUM(
          CASE 
            WHEN tido = 'NCV' THEN -monto
            ELSE monto
          END
        ), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(sql`(
        SELECT DISTINCT 
          nudo,
          nokoen,
          tido,
          monto
        FROM ${salesTransactions} 
        ${whereClause}
        GROUP BY nudo, nokoen, tido, monto
      ) as unique_transactions`)
      .groupBy(sql`nokoen`)
      .orderBy(sql`SUM(CASE WHEN tido = 'NCV' THEN -monto ELSE monto END) DESC`)
      .limit(limit);

    return results.map(r => ({
      clientName: r.clientName || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async getSegmentAnalysis(startDate?: string, endDate?: string): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>> {
    const dateConditions = [];
    if (startDate) {
      dateConditions.push(gte(salesTransactions.feemdo, startDate));
    }
    if (endDate) {
      dateConditions.push(lte(salesTransactions.feemdo, endDate));
    }
    const dateFilter = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const [totalSalesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions)
      .where(dateFilter);

    const totalSales = Number(totalSalesResult.total);

    const conditions = [
      sql`${salesTransactions.noruen} IS NOT NULL AND ${salesTransactions.noruen} != ''`
    ];
    if (startDate) {
      conditions.push(gte(salesTransactions.feemdo, startDate));
    }
    if (endDate) {
      conditions.push(lte(salesTransactions.feemdo, endDate));
    }

    const results = await db
      .select({
        segment: salesTransactions.noruen,
        totalSales: sql<number>`COALESCE(SUM(
          CASE 
            WHEN ${salesTransactions.tido} = 'NCV' THEN -${salesTransactions.monto}
            ELSE ${salesTransactions.monto}
          END
        ), 0)`,
      })
      .from(salesTransactions)
      .where(and(...conditions))
      .groupBy(salesTransactions.noruen)
      .orderBy(sql`SUM(${salesTransactions.monto}) DESC`);

    return results.map(r => ({
      segment: r.segment || '',
      totalSales: Number(r.totalSales),
      percentage: totalSales > 0 ? (Number(r.totalSales) / totalSales) * 100 : 0,
    }));
  }

  async getSalesChartData(period: 'weekly' | 'monthly' | 'daily', startDate?: string, endDate?: string, salesperson?: string): Promise<Array<{
    period: string;
    sales: number;
  }>> {
    const conditions = [sql`${salesTransactions.feemdo} IS NOT NULL`];
    
    if (startDate) {
      conditions.push(gte(salesTransactions.feemdo, startDate));
    }
    if (endDate) {
      conditions.push(lte(salesTransactions.feemdo, endDate));
    }
    if (salesperson) {
      conditions.push(eq(salesTransactions.nokofu, salesperson));
    }
    
    let query: any;
    
    switch (period) {
      case 'daily':
        query = db
          .select({
            period: sql<string>`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM-DD')`,
            sales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
          })
          .from(salesTransactions)
          .where(and(...conditions))
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
          .where(and(...conditions))
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
          .where(and(...conditions))
          .groupBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM')`);
        break;
    }

    const results = await query;

    return results.map((r: any) => ({
      period: r.period,
      sales: Number(r.sales),
    }));
  }

  // Goals operations
  async getGoals(): Promise<Goal[]> {
    return await db.select().from(goals).orderBy(desc(goals.createdAt));
  }

  async getGoalsByType(type: string): Promise<Goal[]> {
    return await db.select().from(goals).where(eq(goals.type, type)).orderBy(desc(goals.createdAt));
  }

  async getGoalsBySalesperson(salesperson: string): Promise<Goal[]> {
    return await db.select().from(goals)
      .where(sql`${goals.type} = 'salesperson' AND ${goals.target} = ${salesperson}`)
      .orderBy(desc(goals.createdAt));
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  async getGoal(goalId: string): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, goalId));
    return goal;
  }

  async updateGoal(goalId: string, data: Partial<InsertGoal>): Promise<Goal> {
    const [updatedGoal] = await db
      .update(goals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(goals.id, goalId))
      .returning();
    return updatedGoal;
  }

  async getSalespersonUserByName(name: string): Promise<SalespersonUser | undefined> {
    const [user] = await db
      .select()
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.salespersonName, name));
    return user;
  }

  async deleteGoal(id: string): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }

  // Alerts for salesperson
  async getSalespersonAlerts(salesperson: string): Promise<any[]> {
    const alerts: any[] = [];
    
    try {
      // 1. Clientes que no han comprado hace tiempo (más de 60 días)
      const inactiveClients = await db
        .select({
          client: salesTransactions.nokoen,
          lastPurchase: sql<string>`MAX(${salesTransactions.feemdo})`,
          daysSince: sql<number>`EXTRACT(DAY FROM NOW() - MAX(${salesTransactions.feemdo}))`
        })
        .from(salesTransactions)
        .where(eq(salesTransactions.nokofu, salesperson))
        .groupBy(salesTransactions.nokoen)
        .having(sql`EXTRACT(DAY FROM NOW() - MAX(${salesTransactions.feemdo})) > 60`)
        .orderBy(sql`MAX(${salesTransactions.feemdo}) DESC`)
        .limit(3);

      inactiveClients.forEach(client => {
        if (client.client) {
          alerts.push({
            type: 'inactive_client',
            priority: 'medium',
            title: 'Cliente inactivo',
            message: `${client.client} no compra hace ${Math.round(client.daysSince)} días`,
            actionText: 'Contactar cliente',
            data: { client: client.client, daysSince: client.daysSince }
          });
        }
      });

      // 2. Clientes con patrones estacionales (compran en fechas similares cada mes)
      const seasonalClients = await db
        .select({
          client: salesTransactions.nokoen,
          purchaseMonth: sql<string>`EXTRACT(MONTH FROM ${salesTransactions.feemdo})`,
          transactionCount: sql<number>`COUNT(*)`
        })
        .from(salesTransactions)
        .where(eq(salesTransactions.nokofu, salesperson))
        .groupBy(salesTransactions.nokoen, sql`EXTRACT(MONTH FROM ${salesTransactions.feemdo})`)
        .having(sql`COUNT(*) >= 2`)
        .limit(2);

      seasonalClients.forEach(client => {
        if (client.client) {
          const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          alerts.push({
            type: 'seasonal_pattern',
            priority: 'high',
            title: 'Patrón estacional',
            message: `${client.client} compra regularmente en ${monthNames[parseInt(client.purchaseMonth)]}`,
            actionText: 'Preparar contacto',
            data: { client: client.client, month: client.purchaseMonth }
          });
        }
      });

      // 3. Clientes con alto volumen que pueden necesitar atención especial
      const highValueClients = await db
        .select({
          client: salesTransactions.nokoen,
          totalSales: sql<number>`SUM(CAST(${salesTransactions.monto} AS DECIMAL))`,
          transactionCount: sql<number>`COUNT(*)`
        })
        .from(salesTransactions)
        .where(eq(salesTransactions.nokofu, salesperson))
        .groupBy(salesTransactions.nokoen)
        .having(sql`SUM(CAST(${salesTransactions.monto} AS DECIMAL)) > 1000000`)
        .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS DECIMAL)) DESC`)
        .limit(2);

      highValueClients.forEach(client => {
        if (client.client) {
          alerts.push({
            type: 'high_value',
            priority: 'high',
            title: 'Cliente VIP',
            message: `${client.client} - Cliente de alto valor (${new Intl.NumberFormat('es-CL', {
              style: 'currency',
              currency: 'CLP',
              minimumFractionDigits: 0,
            }).format(client.totalSales)})`,
            actionText: 'Contacto prioritario',
            data: { client: client.client, totalSales: client.totalSales }
          });
        }
      });

      // 4. Oportunidades de venta cruzada (clientes que compran pocos productos)
      const crossSellOpportunities = await db
        .select({
          client: salesTransactions.nokoen,
          uniqueProducts: sql<number>`COUNT(DISTINCT ${salesTransactions.koprct})`,
          totalTransactions: sql<number>`COUNT(*)`
        })
        .from(salesTransactions)
        .where(eq(salesTransactions.nokofu, salesperson))
        .groupBy(salesTransactions.nokoen)
        .having(sql`COUNT(*) > 3 AND COUNT(DISTINCT ${salesTransactions.koprct}) <= 2`)
        .limit(2);

      crossSellOpportunities.forEach(client => {
        if (client.client) {
          alerts.push({
            type: 'cross_sell',
            priority: 'medium',
            title: 'Oportunidad venta cruzada',
            message: `${client.client} compra pocos productos diferentes - Oportunidad de ampliar`,
            actionText: 'Mostrar catálogo',
            data: { client: client.client, uniqueProducts: client.uniqueProducts }
          });
        }
      });

    } catch (error) {
      console.error('Error generating salesperson alerts:', error);
    }

    return alerts.slice(0, 5); // Limitar a 5 alertas máximo
  }

  // Data for goals form
  async getUniqueSegments(): Promise<string[]> {
    const result = await db
      .selectDistinct({ segment: salesTransactions.noruen })
      .from(salesTransactions)
      .where(sql`${salesTransactions.noruen} IS NOT NULL AND ${salesTransactions.noruen} != ''`)
      .orderBy(salesTransactions.noruen);
    
    return result.map((r: any) => r.segment).filter((segment: string | null): segment is string => Boolean(segment));
  }

  async getUniqueSalespeople(): Promise<string[]> {
    const result = await db
      .selectDistinct({ salesperson: salesTransactions.nokofu })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokofu} IS NOT NULL AND ${salesTransactions.nokofu} != ''`)
      .orderBy(salesTransactions.nokofu);
    
    return result.map((r: any) => r.salesperson).filter((salesperson: string | null): salesperson is string => Boolean(salesperson));
  }

  async getUniqueClients(): Promise<string[]> {
    const result = await db
      .selectDistinct({ client: salesTransactions.nokoen })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokoen} IS NOT NULL AND ${salesTransactions.nokoen} != ''`)
      .orderBy(salesTransactions.nokoen);
    
    return result.map((r: any) => r.client).filter((client: string | null): client is string => Boolean(client));
  }

  // Sales data for goals comparison
  async getGlobalSalesForPeriod(period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`
      })
      .from(salesTransactions)
      .where(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM') = ${period}`)
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getSegmentSalesForPeriod(segment: string, period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`
      })
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.noruen, segment),
          sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM') = ${period}`
        )
      )
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getSalespersonSalesForPeriod(salesperson: string, period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`
      })
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.nokofu, salesperson),
          sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM') = ${period}`
        )
      )
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getSegmentClients(segmentName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>> {
    const conditions = [eq(salesTransactions.noruen, segmentName)];

    // Apply date filters if period is provided
    if (period && filterType === 'month') {
      // Period format: YYYY-MM
      const [year, month] = period.split('-');
      conditions.push(
        sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
      );
    }

    const result = await db
      .select({
        clientName: salesTransactions.nokoen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`
      })
      .from(salesTransactions)
      .where(and(...conditions))
      .groupBy(salesTransactions.nokoen)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS NUMERIC)) DESC`);
    
    // Calculate segment total for percentages
    const segmentTotal = result.reduce((sum, client) => sum + client.totalSales, 0);
    
    return result.map(client => ({
      clientName: client.clientName || 'Cliente desconocido',
      totalSales: Number(client.totalSales),
      transactionCount: Number(client.transactionCount),
      averageTicket: Number(client.averageTicket),
      percentage: segmentTotal > 0 ? (Number(client.totalSales) / segmentTotal) * 100 : 0
    }));
  }

  async getSegmentSalespeople(segmentName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>> {
    const conditions = [eq(salesTransactions.noruen, segmentName)];

    // Apply date filters if period is provided
    if (period && filterType === 'month') {
      // Period format: YYYY-MM
      const [year, month] = period.split('-');
      conditions.push(
        sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
      );
    }

    const result = await db
      .select({
        salespersonName: salesTransactions.nokofu,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`
      })
      .from(salesTransactions)
      .where(and(...conditions))
      .groupBy(salesTransactions.nokofu)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS NUMERIC)) DESC`);
    
    // Calculate segment total for percentages
    const segmentTotal = result.reduce((sum, salesperson) => sum + salesperson.totalSales, 0);
    
    return result.map(salesperson => ({
      salespersonName: salesperson.salespersonName || 'Vendedor desconocido',
      totalSales: Number(salesperson.totalSales),
      transactionCount: Number(salesperson.transactionCount),
      averageTicket: Number(salesperson.averageTicket),
      percentage: segmentTotal > 0 ? (Number(salesperson.totalSales) / segmentTotal) * 100 : 0
    }));
  }

  // Salesperson detail operations
  async getSalespersonDetails(salespersonName: string, period?: string, filterType: string = 'month'): Promise<{
    totalSales: number;
    totalClients: number;
    transactionCount: number;
    averageTicket: number;
    salesFrequency: number;
  }> {
    const conditions = [eq(salesTransactions.nokofu, salespersonName)];

    if (period && filterType === 'month') {
      const [year, month] = period.split('-');
      conditions.push(
        sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
      );
    }

    const [result] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        totalClients: sql<number>`COUNT(DISTINCT ${salesTransactions.nokoen})`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        firstSale: sql<string>`MIN(${salesTransactions.feemdo})`,
        lastSale: sql<string>`MAX(${salesTransactions.feemdo})`
      })
      .from(salesTransactions)
      .where(and(...conditions));

    // Calculate sales frequency
    const firstSale = new Date(result.firstSale);
    const lastSale = new Date(result.lastSale);
    const daysBetween = Math.max(1, Math.floor((lastSale.getTime() - firstSale.getTime()) / (1000 * 60 * 60 * 24)));
    const salesFrequency = result.transactionCount > 1 ? daysBetween / result.transactionCount : 0;

    return {
      totalSales: Number(result.totalSales),
      totalClients: Number(result.totalClients),
      transactionCount: Number(result.transactionCount),
      averageTicket: Number(result.averageTicket),
      salesFrequency: Number(salesFrequency.toFixed(1))
    };
  }

  async getSalespersonClients(salespersonName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    lastSale: string;
    daysSinceLastSale: number;
  }>> {
    const conditions = [eq(salesTransactions.nokofu, salespersonName)];

    if (period && filterType === 'month') {
      const [year, month] = period.split('-');
      conditions.push(
        sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
      );
    }

    const result = await db
      .select({
        clientName: salesTransactions.nokoen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        lastSale: sql<string>`MAX(${salesTransactions.feemdo})`
      })
      .from(salesTransactions)
      .where(and(...conditions))
      .groupBy(salesTransactions.nokoen)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS NUMERIC)) DESC`);

    const today = new Date();
    return result.map(client => {
      const lastSaleDate = new Date(client.lastSale);
      const daysSinceLastSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        clientName: client.clientName || 'Cliente desconocido',
        totalSales: Number(client.totalSales),
        transactionCount: Number(client.transactionCount),
        averageTicket: Number(client.averageTicket),
        lastSale: client.lastSale,
        daysSinceLastSale
      };
    });
  }

  // Client detail operations
  async getClientDetails(clientName: string, period?: string, filterType: string = 'month'): Promise<{
    totalPurchases: number;
    totalProducts: number;
    transactionCount: number;
    averageTicket: number;
    purchaseFrequency: number;
  }> {
    const conditions = [eq(salesTransactions.nokoen, clientName)];

    if (period && filterType === 'month') {
      const [year, month] = period.split('-');
      conditions.push(
        sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
      );
    }

    const [result] = await db
      .select({
        totalPurchases: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        totalProducts: sql<number>`COUNT(DISTINCT ${salesTransactions.nokoprct})`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        firstPurchase: sql<string>`MIN(${salesTransactions.feemdo})`,
        lastPurchase: sql<string>`MAX(${salesTransactions.feemdo})`
      })
      .from(salesTransactions)
      .where(and(...conditions));

    // Calculate purchase frequency
    const firstPurchase = new Date(result.firstPurchase);
    const lastPurchase = new Date(result.lastPurchase);
    const daysBetween = Math.max(1, Math.floor((lastPurchase.getTime() - firstPurchase.getTime()) / (1000 * 60 * 60 * 24)));
    const purchaseFrequency = result.transactionCount > 1 ? daysBetween / result.transactionCount : 0;

    return {
      totalPurchases: Number(result.totalPurchases),
      totalProducts: Number(result.totalProducts),
      transactionCount: Number(result.transactionCount),
      averageTicket: Number(result.averageTicket),
      purchaseFrequency: Number(purchaseFrequency.toFixed(1))
    };
  }

  async getClientProducts(clientName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    productName: string;
    totalPurchases: number;
    transactionCount: number;
    averagePrice: number;
    lastPurchase: string;
    daysSinceLastPurchase: number;
  }>> {
    const conditions = [eq(salesTransactions.nokoen, clientName)];

    if (period && filterType === 'month') {
      const [year, month] = period.split('-');
      conditions.push(
        sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
      );
    }

    const result = await db
      .select({
        productName: salesTransactions.nokoprct,
        totalPurchases: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averagePrice: sql<number>`COALESCE(AVG(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        lastPurchase: sql<string>`MAX(${salesTransactions.feemdo})`
      })
      .from(salesTransactions)
      .where(and(...conditions))
      .groupBy(salesTransactions.nokoprct)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS NUMERIC)) DESC`);

    const today = new Date();
    return result.map(product => {
      const lastPurchaseDate = new Date(product.lastPurchase);
      const daysSinceLastPurchase = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        productName: product.productName || 'Producto desconocido',
        totalPurchases: Number(product.totalPurchases),
        transactionCount: Number(product.transactionCount),
        averagePrice: Number(product.averagePrice),
        lastPurchase: product.lastPurchase,
        daysSinceLastPurchase
      };
    });
  }

  // Client buyer dashboard methods
  async getClientLastOrder(clientName: string): Promise<{
    id: string;
    nudo: string;
    feemdo: string;
    nokoprct: string;
    monto: string;
    nokofu: string;
  } | null> {
    const [result] = await db
      .select({
        id: salesTransactions.id,
        nudo: salesTransactions.nudo,
        feemdo: salesTransactions.feemdo,
        nokoprct: salesTransactions.nokoprct,
        monto: sql<string>`CAST(${salesTransactions.monto} AS TEXT)`,
        nokofu: salesTransactions.nokofu
      })
      .from(salesTransactions)
      .where(eq(salesTransactions.nokoen, clientName))
      .orderBy(desc(salesTransactions.feemdo))
      .limit(1);

    if (!result) return null;
    
    return {
      id: result.id,
      nudo: result.nudo,
      feemdo: result.feemdo ? (typeof result.feemdo === 'string' ? result.feemdo : new Date(result.feemdo).toISOString().split('T')[0]) : '',
      nokoprct: result.nokoprct || '',
      monto: result.monto || '0',
      nokofu: result.nokofu || ''
    };
  }

  async getClientPurchaseHistory(clientName: string, limit: number = 10): Promise<Array<{
    id: string;
    nudo: string;
    feemdo: string;
    nokoprct: string;
    monto: string;
    nokofu: string;
  }>> {
    const result = await db
      .select({
        id: salesTransactions.id,
        nudo: salesTransactions.nudo,
        feemdo: salesTransactions.feemdo,
        nokoprct: salesTransactions.nokoprct,
        monto: sql<string>`CAST(${salesTransactions.monto} AS TEXT)`,
        nokofu: salesTransactions.nokofu
      })
      .from(salesTransactions)
      .where(eq(salesTransactions.nokoen, clientName))
      .orderBy(desc(salesTransactions.feemdo))
      .limit(limit);

    return result.map(r => ({
      id: r.id,
      nudo: r.nudo,
      feemdo: r.feemdo ? (typeof r.feemdo === 'string' ? r.feemdo : new Date(r.feemdo).toISOString().split('T')[0]) : '',
      nokoprct: r.nokoprct || '',
      monto: r.monto || '0',
      nokofu: r.nokofu || ''
    }));
  }

  // Salesperson users management
  async getSalespeopleUsers(): Promise<SalespersonUser[]> {
    return await db.select().from(salespeopleUsers).orderBy(salespeopleUsers.salespersonName);
  }

  async createSalespersonUser(user: InsertSalespersonUser): Promise<SalespersonUser> {
    const [result] = await db
      .insert(salespeopleUsers)
      .values(user)
      .returning();
    return result;
  }

  async updateSalespersonUser(id: string, user: Partial<InsertSalespersonUser>): Promise<SalespersonUser> {
    const [result] = await db
      .update(salespeopleUsers)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(salespeopleUsers.id, id))
      .returning();
    return result;
  }

  async deleteSalespersonUser(id: string): Promise<void> {
    await db.delete(salespeopleUsers).where(eq(salespeopleUsers.id, id));
  }

  async getSupervisors(): Promise<SalespersonUser[]> {
    return await db.select().from(salespeopleUsers)
      .where(eq(salespeopleUsers.role, 'supervisor'))
      .orderBy(salespeopleUsers.salespersonName);
  }

  async getSalespersonUser(id: string): Promise<SalespersonUser | undefined> {
    const [user] = await db
      .select()
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.id, id));
    return user;
  }

  async getSalespersonUserByEmail(email: string): Promise<SalespersonUser | undefined> {
    const [user] = await db
      .select()
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.email, email));
    return user;
  }

  async getSalespersonClientsAnalysis(salesperson: string): Promise<{
    vipClients: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
      averageTicket: number;
      lastPurchaseDate: string;
      daysSinceLastPurchase: number;
    }>;
    inactiveClients: Array<{
      clientName: string;
      totalSales: number;
      lastPurchaseDate: string;
      daysSinceLastPurchase: number;
    }>;
    frequentClients: Array<{
      clientName: string;
      transactionCount: number;
      totalSales: number;
      purchaseFrequency: number;
    }>;
    clientsWithTopProducts: Array<{
      clientName: string;
      topProduct: string;
      productSales: number;
      totalClientSales: number;
    }>;
  }> {
    const today = new Date();
    
    // Obtener todos los clientes del vendedor con estadísticas
    const allClients = await db
      .select({
        clientName: salesTransactions.nokoen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        lastPurchaseDate: sql<string>`MAX(${salesTransactions.feemdo})`,
        firstPurchaseDate: sql<string>`MIN(${salesTransactions.feemdo})`
      })
      .from(salesTransactions)
      .where(and(
        eq(salesTransactions.nokofu, salesperson),
        sql`${salesTransactions.nokoen} IS NOT NULL AND ${salesTransactions.nokoen} != ''`
      ))
      .groupBy(salesTransactions.nokoen)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS NUMERIC)) DESC`);

    // Calcular métricas para cada cliente
    const clientsWithMetrics = allClients.map(client => {
      const lastPurchaseDate = new Date(client.lastPurchaseDate);
      const firstPurchaseDate = new Date(client.firstPurchaseDate);
      const daysSinceLastPurchase = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysBetween = Math.max(1, Math.floor((lastPurchaseDate.getTime() - firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
      const purchaseFrequency = client.transactionCount > 1 ? daysBetween / client.transactionCount : 0;
      const averageTicket = client.totalSales / client.transactionCount;

      return {
        clientName: client.clientName || '',
        totalSales: Number(client.totalSales),
        transactionCount: Number(client.transactionCount),
        averageTicket: Number(averageTicket),
        lastPurchaseDate: client.lastPurchaseDate,
        daysSinceLastPurchase,
        purchaseFrequency: Number(purchaseFrequency.toFixed(1))
      };
    });

    // Determinar el umbral para clientes VIP (top 20%)
    const vipThreshold = Math.ceil(clientsWithMetrics.length * 0.2);
    const vipClients = clientsWithMetrics.slice(0, vipThreshold);

    // Clientes inactivos (más de 60 días sin compras)
    const inactiveClients = clientsWithMetrics
      .filter(client => client.daysSinceLastPurchase > 60)
      .map(client => ({
        clientName: client.clientName,
        totalSales: client.totalSales,
        lastPurchaseDate: client.lastPurchaseDate,
        daysSinceLastPurchase: client.daysSinceLastPurchase
      }));

    // Clientes frecuentes (frecuencia menor a 30 días y más de 3 transacciones)
    const frequentClients = clientsWithMetrics
      .filter(client => client.purchaseFrequency > 0 && client.purchaseFrequency < 30 && client.transactionCount > 3)
      .map(client => ({
        clientName: client.clientName,
        transactionCount: client.transactionCount,
        totalSales: client.totalSales,
        purchaseFrequency: client.purchaseFrequency
      }))
      .sort((a, b) => a.purchaseFrequency - b.purchaseFrequency);

    // Producto favorito por cliente
    const clientsWithTopProducts = [];
    for (const client of clientsWithMetrics.slice(0, 20)) { // Top 20 clientes
      const topProducts = await db
        .select({
          productName: salesTransactions.nokoprct,
          productSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`
        })
        .from(salesTransactions)
        .where(and(
          eq(salesTransactions.nokofu, salesperson),
          eq(salesTransactions.nokoen, client.clientName),
          sql`${salesTransactions.nokoprct} IS NOT NULL AND ${salesTransactions.nokoprct} != ''`
        ))
        .groupBy(salesTransactions.nokoprct)
        .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS NUMERIC)) DESC`)
        .limit(1);

      if (topProducts.length > 0) {
        clientsWithTopProducts.push({
          clientName: client.clientName,
          topProduct: topProducts[0].productName || 'Producto desconocido',
          productSales: Number(topProducts[0].productSales),
          totalClientSales: client.totalSales
        });
      }
    }

    return {
      vipClients,
      inactiveClients,
      frequentClients,
      clientsWithTopProducts
    };
  }

  async getSalespeopleUnderSupervisor(supervisorId: string): Promise<Array<{
    id: string;
    salespersonName: string;
    email: string;
    totalSales: number;
    transactionCount: number;
    lastSale: string;
    goals: Array<{
      id: string;
      description: string;
      targetAmount: number;
      currentSales: number;
      remaining: number;
      period: string;
      progress: number;
    }>;
  }>> {
    console.log(`[DEBUG] Looking for salespeople under supervisor: ${supervisorId}`);
    
    // Obtener vendedores bajo este supervisor
    const salespeople = await db
      .select()
      .from(salespeopleUsers)
      .where(and(
        eq(salespeopleUsers.supervisorId, supervisorId),
        eq(salespeopleUsers.role, 'salesperson'),
        eq(salespeopleUsers.isActive, true)
      ));

    console.log(`[DEBUG] Raw salespeople query result:`, salespeople);

    const results = [];
    for (const salesperson of salespeople) {
      // Obtener estadísticas de ventas para cada vendedor
      const [salesStats] = await db
        .select({
          totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`,
          transactionCount: sql<number>`COUNT(*)`,
          lastSale: sql<string>`MAX(${salesTransactions.feemdo})`
        })
        .from(salesTransactions)
        .where(eq(salesTransactions.nokofu, salesperson.salespersonName));

      // Obtener metas del vendedor
      console.log(`[DEBUG] Looking for goals for salesperson: ${salesperson.salespersonName}`);
      const salespersonGoals = await db
        .select()
        .from(goals)
        .where(and(
          eq(goals.type, 'salesperson'),
          eq(goals.target, salesperson.salespersonName)
        ))
        .orderBy(desc(goals.createdAt));
      
      console.log(`[DEBUG] Found ${salespersonGoals.length} goals for ${salesperson.salespersonName}:`, salespersonGoals);

      // Procesar metas con progreso
      const processedGoals = [];
      for (const goal of salespersonGoals) {
        // Calcular ventas actuales para la meta basado en el vendedor
        const currentSales = Number(salesStats?.totalSales || 0);
        const targetAmount = parseFloat(goal.amount || "0"); // CORREGIDO: era goal.targetAmount pero la BD tiene 'amount'
        const remaining = Math.max(targetAmount - currentSales, 0);
        const progress = targetAmount > 0 ? Math.min((currentSales / targetAmount) * 100, 100) : 0;

        const processedGoal = {
          id: goal.id,
          description: goal.description || "Meta de ventas",
          targetAmount,
          currentSales,
          remaining,
          period: goal.period || "",
          progress: Math.round(progress)
        };
        
        console.log(`[DEBUG] Processed goal for ${salesperson.salespersonName}:`, processedGoal);
        processedGoals.push(processedGoal);
      }

      const salespersonResult = {
        id: salesperson.id,
        salespersonName: salesperson.salespersonName,
        email: salesperson.email || '',
        totalSales: Number(salesStats?.totalSales || 0),
        transactionCount: Number(salesStats?.transactionCount || 0),
        lastSale: salesStats?.lastSale || '',
        goals: processedGoals
      };
      
      console.log(`[DEBUG] Final salesperson data for ${salesperson.salespersonName}:`, salespersonResult);
      results.push(salespersonResult);
    }

    return results.sort((a, b) => b.totalSales - a.totalSales);
  }

  async getSupervisorGoals(supervisorId: string): Promise<any[]> {
    // Obtener supervisor con su segmento asignado
    const [supervisor] = await db
      .select({ 
        salespersonName: salespeopleUsers.salespersonName,
        assignedSegment: salespeopleUsers.assignedSegment
      })
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.id, supervisorId));

    if (!supervisor) return [];

    const processedGoals = [];

    // 1. Obtener metas personales del supervisor
    const personalGoals = await db
      .select()
      .from(goals)
      .where(and(
        eq(goals.type, 'salesperson'),
        eq(goals.target, supervisor.salespersonName)
      ))
      .orderBy(desc(goals.createdAt));
    
    // Procesar metas personales
    for (const goal of personalGoals) {
      const currentSales = await this.getSalespersonSalesForPeriod(supervisor.salespersonName, goal.period);
      const targetAmount = parseFloat(goal.amount);
      const remaining = Math.max(targetAmount - currentSales, 0);
      const progress = targetAmount > 0 ? Math.min((currentSales / targetAmount) * 100, 100) : 0;

      processedGoals.push({
        id: goal.id,
        type: goal.type,
        target: goal.target,
        description: goal.description || `Meta personal - ${supervisor.salespersonName}`,
        targetAmount,
        currentSales,
        remaining,
        period: goal.period,
        progress: Math.round(progress)
      });
    }

    // 2. Obtener metas del segmento asignado (si tiene uno)
    if (supervisor.assignedSegment) {
      const segmentGoals = await db
        .select()
        .from(goals)
        .where(and(
          eq(goals.type, 'segment'),
          eq(goals.target, supervisor.assignedSegment)
        ))
        .orderBy(desc(goals.createdAt));
      
      // Procesar metas del segmento
      for (const goal of segmentGoals) {
        const currentSales = await this.getSegmentSalesForPeriod(supervisor.assignedSegment, goal.period);
        const targetAmount = parseFloat(goal.amount);
        const remaining = Math.max(targetAmount - currentSales, 0);
        const progress = targetAmount > 0 ? Math.min((currentSales / targetAmount) * 100, 100) : 0;

        processedGoals.push({
          id: goal.id,
          type: goal.type,
          target: goal.target,
          description: goal.description || `Meta del segmento ${supervisor.assignedSegment}`,
          targetAmount,
          currentSales,
          remaining,
          period: goal.period,
          progress: Math.round(progress)
        });
      }
    }

    // 3. Obtener metas de vendedores bajo supervisión
    const salespeople = await db
      .select({ salespersonName: salespeopleUsers.salespersonName })
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.supervisorId, supervisorId));

    for (const salesperson of salespeople) {
      const salespersonGoals = await db
        .select()
        .from(goals)
        .where(and(
          eq(goals.type, 'salesperson'),
          eq(goals.target, salesperson.salespersonName)
        ))
        .orderBy(desc(goals.createdAt));
      
      // Procesar metas de cada vendedor
      for (const goal of salespersonGoals) {
        const currentSales = await this.getSalespersonSalesForPeriod(salesperson.salespersonName, goal.period);
        const targetAmount = parseFloat(goal.amount);
        const remaining = Math.max(targetAmount - currentSales, 0);
        const progress = targetAmount > 0 ? Math.min((currentSales / targetAmount) * 100, 100) : 0;

        processedGoals.push({
          id: goal.id,
          type: goal.type,
          target: goal.target,
          description: goal.description || `Meta de ${salesperson.salespersonName}`,
          targetAmount,
          currentSales,
          remaining,
          period: goal.period,
          progress: Math.round(progress)
        });
      }
    }

    return processedGoals;
  }

  async getSupervisorAlerts(supervisorId: string): Promise<Array<{
    type: 'inactive' | 'below_goal' | 'projection';
    severity: 'low' | 'medium' | 'high';
    salesperson: string;
    message: string;
    data: any;
  }>> {
    const alerts = [];
    
    // Obtener vendedores del supervisor con sus datos
    const salespeople = await this.getSalespeopleUnderSupervisor(supervisorId);
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    for (const salesperson of salespeople) {
      // ALERTA 1: Vendedor inactivo (sin ventas en mucho tiempo)
      if (salesperson.lastSale) {
        const lastSaleDate = new Date(salesperson.lastSale);
        const daysSinceLastSale = Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastSale >= 30) {
          alerts.push({
            type: 'inactive' as const,
            severity: daysSinceLastSale >= 60 ? ('high' as const) : daysSinceLastSale >= 45 ? ('medium' as const) : ('low' as const),
            salesperson: salesperson.salespersonName,
            message: `${salesperson.salespersonName} no ha vendido en ${daysSinceLastSale} días`,
            data: { daysSinceLastSale, lastSale: salesperson.lastSale }
          });
        }
      } else if (salesperson.transactionCount === 0) {
        alerts.push({
          type: 'inactive' as const,
          severity: 'high' as const,
          salesperson: salesperson.salespersonName,
          message: `${salesperson.salespersonName} no ha registrado ventas`,
          data: { daysSinceLastSale: null, lastSale: null }
        });
      }
      
      // ALERTA 2 y 3: Metas bajo cumplimiento y proyecciones
      for (const goal of salesperson.goals) {
        const progress = goal.progress;
        
        // Alerta por estar bajo meta
        if (progress < 50) {
          alerts.push({
            type: 'below_goal' as const,
            severity: progress < 25 ? ('high' as const) : progress < 40 ? ('medium' as const) : ('low' as const),
            salesperson: salesperson.salespersonName,
            message: `${salesperson.salespersonName} está al ${progress}% de su meta (${goal.description})`,
            data: { 
              progress, 
              currentSales: goal.currentSales, 
              targetAmount: goal.targetAmount,
              goalDescription: goal.description
            }
          });
        }
        
        // ALERTA 3: Proyección negativa
        // Calcular ritmo de ventas mensual y proyectar
        const monthsInPeriod = this.getMonthsFromPeriod(goal.period);
        if (monthsInPeriod > 0) {
          const currentMonthsElapsed = 1; // Asumimos que estamos en el primer mes para simplificar
          const currentMonthlyRate = goal.currentSales / currentMonthsElapsed;
          const projectedTotal = currentMonthlyRate * monthsInPeriod;
          const projectionPercentage = (projectedTotal / goal.targetAmount) * 100;
          
          if (projectionPercentage < 80 && progress > 0) { // Solo si hay algo de progreso
            alerts.push({
              type: 'projection' as const,
              severity: projectionPercentage < 50 ? ('high' as const) : projectionPercentage < 65 ? ('medium' as const) : ('low' as const),
              salesperson: salesperson.salespersonName,
              message: `${salesperson.salespersonName} proyecta alcanzar solo ${Math.round(projectionPercentage)}% de su meta`,
              data: { 
                projectionPercentage: Math.round(projectionPercentage),
                projectedTotal,
                targetAmount: goal.targetAmount,
                currentMonthlyRate,
                goalDescription: goal.description
              }
            });
          }
        }
      }
    }
    
    // Ordenar alertas por severidad
    const severityOrder: Record<'high' | 'medium' | 'low', number> = { 'high': 3, 'medium': 2, 'low': 1 };
    return alerts.sort((a, b) => severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder]);
  }
  
  private getMonthsFromPeriod(period: string): number {
    if (!period) return 0;
    const periodLower = period.toLowerCase();
    if (periodLower.includes('mensual') || periodLower.includes('mes')) return 1;
    if (periodLower.includes('trimestral') || periodLower.includes('trimestre')) return 3;
    if (periodLower.includes('semestral') || periodLower.includes('semestre')) return 6;
    if (periodLower.includes('anual') || periodLower.includes('año')) return 12;
    return 3; // Default trimestral
  }

  // Product operations implementation
  // Public products method for shop (no prices, no authentication required)
  async getProductsPublic(filters?: {
    search?: string;
    category?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Product[]> {
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        sql`(${products.sku} ILIKE ${`%${filters.search}%`} OR ${products.name} ILIKE ${`%${filters.search}%`})`
      );
    }
    
    if (filters?.category) {
      conditions.push(eq(products.category, filters.category));
    }
    
    if (filters?.active !== undefined) {
      conditions.push(eq(products.active, filters.active));
    }

    let query = db.select({
      id: products.id,
      sku: products.sku,
      productId: products.productId,
      name: products.name,
      category: products.category,
      packagingUnit: products.packagingUnit,
      packagingUnitName: products.packagingUnitName,
      variantFeaturesKey: products.variantFeaturesKey,
      variantFeaturesValue: products.variantFeaturesValue,
      variantParentSku: products.variantParentSku,
      variantGenericDisplayName: products.variantGenericDisplayName,
      active: products.active,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt
      // No incluir campos de precio para acceso público
    }).from(products);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }

    const publicProducts = await query.orderBy(products.name);
    return publicProducts;
  }

  // Get all product prices (only for authenticated users)
  async getAllProductPrices(): Promise<Record<string, string>> {
    const productPrices = await db.select({
      sku: products.sku,
      pricePerUnit: products.pricePerUnit,
      manualPrice: products.manualPrice
    }).from(products).where(eq(products.active, true));

    const pricesMap: Record<string, string> = {};
    productPrices.forEach(product => {
      const price = product.manualPrice || product.pricePerUnit;
      if (price) {
        pricesMap[product.sku] = price.toString();
      }
    });

    return pricesMap;
  }

  async getProducts(filters?: {
    search?: string;
    active?: boolean;
    hasPrices?: boolean;
    warehouseCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<Product & { totalStock?: number; warehouses?: string[] }>> {
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        sql`(${products.sku} ILIKE ${`%${filters.search}%`} OR ${products.name} ILIKE ${`%${filters.search}%`})`
      );
    }
    
    if (filters?.active !== undefined) {
      conditions.push(eq(products.active, filters.active));
    }
    
    if (filters?.hasPrices !== undefined) {
      if (filters.hasPrices) {
        conditions.push(sql`(${products.manualPrice} IS NOT NULL AND ${products.manualPrice} != '0') OR (${products.pricePerUnit} IS NOT NULL AND ${products.pricePerUnit} != '0')`);
      } else {
        conditions.push(sql`(${products.manualPrice} IS NULL OR ${products.manualPrice} = '0') AND (${products.pricePerUnit} IS NULL OR ${products.pricePerUnit} = '0')`);
      }
    }

    let query = db.select().from(products);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }

    const productsList = await query.orderBy(products.name);
    
    // Get stock information for each product
    const enrichedProducts = await Promise.all(productsList.map(async (product) => {
      const stocks = await db.select({
        warehouseCode: productStock.warehouseCode,
        physicalStock1: productStock.physicalStock1,
        physicalStock2: productStock.physicalStock2,
        availableStock1: productStock.availableStock1,
        availableStock2: productStock.availableStock2
      }).from(productStock).where(eq(productStock.productSku, product.sku));
      
      const totalStock = stocks.reduce((sum, stock) => {
        return sum + (Number(stock.availableStock1) || 0) + (Number(stock.availableStock2) || 0);
      }, 0);
      
      const warehouseSet = new Set(stocks.map(s => s.warehouseCode));
      const warehouses = Array.from(warehouseSet);
      
      return {
        ...product,
        // Asegurar campos compatibles con frontend
        pricePerUnit: product.manualPrice || product.pricePerUnit,
        packagingUnitName: product.packagingUnitName,
        totalStock,
        warehouses
      };
    }));

    return enrichedProducts;
  }

  async getProduct(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(sku: string, productData: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(products.sku, sku))
      .returning();
    return updatedProduct;
  }

  async updateProductPrice(sku: string, newPrice: number, changedBy: string, reason?: string): Promise<Product> {
    // Get current price
    const currentProduct = await this.getProduct(sku);
    const oldPrice = currentProduct?.manualPrice ? Number(currentProduct.manualPrice) : (currentProduct?.pricePerUnit ? Number(currentProduct.pricePerUnit) : null);

    // Update product price
    const [updatedProduct] = await db
      .update(products)
      .set({ manualPrice: newPrice.toString(), updatedAt: new Date() })
      .where(eq(products.sku, sku))
      .returning();

    // Record price history
    await db.insert(productPriceHistory).values({
      productSku: sku,
      oldPrice: oldPrice?.toString() || null,
      newPrice: newPrice.toString(),
      changedBy,
      changeReason: reason
    });

    return updatedProduct;
  }

  async getProductStock(sku: string): Promise<ProductStock[]> {
    return await db.select().from(productStock).where(eq(productStock.productSku, sku));
  }

  async getProductStockByWarehouse(sku: string, warehouseCode: string, branchCode?: string): Promise<ProductStock[]> {
    const conditions = [
      eq(productStock.productSku, sku),
      eq(productStock.warehouseCode, warehouseCode)
    ];

    if (branchCode) {
      conditions.push(eq(productStock.branchCode, branchCode));
    }

    return await db.select().from(productStock).where(and(...conditions));
  }

  async upsertProductStock(stock: InsertProductStock): Promise<ProductStock> {
    const [upsertedStock] = await db
      .insert(productStock)
      .values({
        ...stock,
        lastUpdated: new Date()
      })
      .onConflictDoUpdate({
        target: [productStock.productSku, productStock.warehouseCode, productStock.branchCode],
        set: {
          ...stock,
          lastUpdated: new Date()
        }
      })
      .returning();
    return upsertedStock;
  }

  async importProductStockFromCSV(csvData: Array<{
    sku: string;
    name: string;
    unit1: string;
    unit2: string;
    branchCode: string;
    warehouseCode: string;
    warehouseLocation?: string;
    physicalStock1?: number;
    physicalStock2?: number;
    availableStock1?: number;
    availableStock2?: number;
    committedStock1?: number;
    committedStock2?: number;
    unitRatio?: number;
    fmpr?: string;
    pfpr?: string;
    hfpr?: string;
    rupr?: string;
    mrpr?: string;
    originalRowIndex?: number;
  }>): Promise<{
    processedProducts: number;
    newProducts: number;
    updatedStock: number;
    skippedProducts: number;
    errors: string[];
  }> {
    console.log(`🚀 Iniciando importación de ${csvData.length} productos`);
    
    const errors: string[] = [];
    let processedProducts = 0;
    let newProducts = 0;
    let updatedStock = 0;
    let skippedProducts = 0;

    for (const row of csvData) {
      try {
        // Validación extra de datos críticos
        if (!row.sku || row.sku.length === 0) {
          skippedProducts++;
          errors.push(`Fila ${row.originalRowIndex}: SKU vacío o inválido`);
          continue;
        }

        if (!row.name || row.name.length === 0) {
          skippedProducts++;
          errors.push(`Fila ${row.originalRowIndex}: Nombre de producto vacío para SKU ${row.sku}`);
          continue;
        }

        if (!row.branchCode || !row.warehouseCode) {
          skippedProducts++;
          errors.push(`Fila ${row.originalRowIndex}: Sucursal (${row.branchCode}) o Bodega (${row.warehouseCode}) inválida para SKU ${row.sku}`);
          continue;
        }

        console.log(`📦 Procesando SKU: ${row.sku} (${row.name}) - Sucursal: ${row.branchCode}, Bodega: ${row.warehouseCode}`);

        // Verificar si el producto existe
        let product = await this.getProduct(row.sku);
        
        if (!product) {
          console.log(`➕ Creando nuevo producto: ${row.sku}`);
          // Crear nuevo producto (sin precio, se establece manualmente)
          product = await this.createProduct({
            productId: row.sku, // Agregar productId requerido
            sku: row.sku,
            name: row.name,
            packagingUnitName: row.unit1 || 'UN', // Mantener compatibilidad
            packagingUnit: row.unit2 || 'UN', // Mantener compatibilidad
            active: true
          });
          newProducts++;
        } else {
          console.log(`🔄 Actualizando producto existente: ${row.sku}`);
          // Actualizar información del producto (preservando precio)
          await this.updateProduct(row.sku, {
            name: row.name,
            packagingUnitName: row.unit1 || 'UN', // Mantener compatibilidad
            packagingUnit: row.unit2 || 'UN', // Mantener compatibilidad
            // unitRatio removed from schema
          });
        }

        // Actualizar stock
        console.log(`📊 Actualizando stock para ${row.sku}: Stock Físico 1: ${row.physicalStock1}, Disponible 1: ${row.availableStock1}`);
        
        const stockData = {
          productSku: row.sku,
          branchCode: row.branchCode,
          warehouseCode: row.warehouseCode,
          warehouseLocation: row.warehouseLocation || '',
          physicalStock1: row.physicalStock1?.toString() || '0',
          physicalStock2: row.physicalStock2?.toString() || '0',
          availableStock1: row.availableStock1?.toString() || '0',
          availableStock2: row.availableStock2?.toString() || '0',
          committedStock1: row.committedStock1?.toString() || '0',
          committedStock2: row.committedStock2?.toString() || '0',
          fmpr: row.fmpr || '',
          pfpr: row.pfpr || '',
          hfpr: row.hfpr || '',
          rupr: row.rupr || '',
          mrpr: row.mrpr || ''
        };

        await this.upsertProductStock(stockData);
        
        updatedStock++;
        processedProducts++;
        
        if (processedProducts % 50 === 0) {
          console.log(`📈 Progreso: ${processedProducts} productos procesados`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando SKU ${row.sku} (Fila ${row.originalRowIndex}):`, error);
        errors.push(`Fila ${row.originalRowIndex} - SKU ${row.sku}: ${error instanceof Error ? error.message : String(error)}`);
        skippedProducts++;
      }
    }

    const summary = {
      processedProducts,
      newProducts,
      updatedStock,
      skippedProducts,
      errors
    };

    console.log(`🎉 Importación completada:`, summary);
    
    return summary;
  }

  // Nueva función para importar solo productos (separado del stock)
  async importProductsFromCSV(csvData: Array<{
    productId: string;
    name: string;
    description?: string;
    category?: string;
    pricePerUnit?: string;
    taxCode?: string;
    taxName?: string;
    taxRate?: string;
    weight?: string;
    weightUnit?: string;
    length?: string;
    lengthUnit?: string;
    width?: string;
    widthUnit?: string;
    height?: string;
    heightUnit?: string;
    volume?: string;
    volumeUnit?: string;
    minUnit?: string;
    stepSize?: string;
    packagingUnit?: string;
    packagingUnitName?: string; // Presentación del producto
    packagingPackageName?: string;
    packagingPackageUnit?: string;
    packagingAmountPerPackage?: string;
    packagingBoxName?: string;
    packagingBoxUnit?: string;
    packagingAmountPerBox?: string;
    packagingPalletName?: string;
    packagingPalletUnit?: string;
    packagingAmountPerPallet?: string;
    originalRowIndex?: number;
  }>): Promise<{
    processedProducts: number;
    newProducts: number;
    updatedProducts: number;
    skippedProducts: number;
    errors: string[];
  }> {
    console.log(`🚀 Iniciando importación de ${csvData.length} productos`);
    
    const errors: string[] = [];
    let processedProducts = 0;
    let newProducts = 0;
    let updatedProducts = 0;
    let skippedProducts = 0;

    for (const row of csvData) {
      try {
        // Validación extra de datos críticos
        if (!row.productId || row.productId.length === 0) {
          skippedProducts++;
          errors.push(`Fila ${row.originalRowIndex}: productId vacío o inválido`);
          continue;
        }

        if (!row.name || row.name.length === 0) {
          skippedProducts++;
          errors.push(`Fila ${row.originalRowIndex}: Nombre de producto vacío para productId ${row.productId}`);
          continue;
        }

        console.log(`📦 Procesando producto: ${row.productId} - ${row.name} - Precio: ${row.pricePerUnit}`);

        // Verificar si el producto existe
        const existingProduct = await this.getProductByProductId(row.productId);
        
        if (!existingProduct) {
          console.log(`➕ Creando nuevo producto: ${row.productId}`);
          
          // Crear nuevo producto
          await db.insert(products).values({
            productId: row.productId,
            sku: row.productId, // Mantener por compatibilidad
            name: row.name,
            description: row.description || '',
            category: row.category || '',
            pricePerUnit: row.pricePerUnit ? parseFloat(row.pricePerUnit.replace(',', '.')) : 0,
            taxCode: row.taxCode || '',
            taxName: row.taxName || '',
            taxRate: row.taxRate ? parseFloat(row.taxRate.replace(',', '.')) : 0,
            weight: row.weight ? parseFloat(row.weight.replace(',', '.')) : 0,
            weightUnit: row.weightUnit || '',
            length: row.length ? parseFloat(row.length.replace(',', '.')) : 0,
            lengthUnit: row.lengthUnit || '',
            width: row.width ? parseFloat(row.width.replace(',', '.')) : 0,
            widthUnit: row.widthUnit || '',
            height: row.height ? parseFloat(row.height.replace(',', '.')) : 0,
            heightUnit: row.heightUnit || '',
            volume: row.volume ? parseFloat(row.volume.replace(',', '.')) : 0,
            volumeUnit: row.volumeUnit || '',
            minUnit: row.minUnit ? parseFloat(row.minUnit.replace(',', '.')) : 0,
            stepSize: row.stepSize ? parseFloat(row.stepSize.replace(',', '.')) : 0,
            packagingUnit: row.packagingUnit || '',
            packagingUnitName: row.packagingUnitName || '', // Presentación del producto
            packagingPackageName: row.packagingPackageName || '',
            packagingPackageUnit: row.packagingPackageUnit || '',
            packagingAmountPerPackage: row.packagingAmountPerPackage ? parseFloat(row.packagingAmountPerPackage.replace(',', '.')) : 0,
            packagingBoxName: row.packagingBoxName || '',
            packagingBoxUnit: row.packagingBoxUnit || '',
            packagingAmountPerBox: row.packagingAmountPerBox ? parseFloat(row.packagingAmountPerBox.replace(',', '.')) : 0,
            packagingPalletName: row.packagingPalletName || '',
            packagingPalletUnit: row.packagingPalletUnit || '',
            packagingAmountPerPallet: row.packagingAmountPerPallet ? parseFloat(row.packagingAmountPerPallet.replace(',', '.')) : 0,
            // Campos básicos de variantes por ahora
            variantFeaturesKey: '',
            variantFeaturesValue: '', 
            variantParentSku: '',
            variantGenericDisplayName: '',
            variantIndex: 0,
            active: true
          });
          
          newProducts++;
        } else {
          console.log(`🔄 Actualizando producto existente: ${row.productId}`);
          
          // Actualizar producto existente (preservando precio manual si existe)
          const updateData: any = {
            name: row.name,
            description: row.description || '',
            category: row.category || '',
            taxCode: row.taxCode || '',
            taxName: row.taxName || '',
            taxRate: row.taxRate ? parseFloat(row.taxRate.replace(',', '.')) : 0,
            weight: row.weight ? parseFloat(row.weight.replace(',', '.')) : 0,
            weightUnit: row.weightUnit || '',
            length: row.length ? parseFloat(row.length.replace(',', '.')) : 0,
            lengthUnit: row.lengthUnit || '',
            width: row.width ? parseFloat(row.width.replace(',', '.')) : 0,
            widthUnit: row.widthUnit || '',
            height: row.height ? parseFloat(row.height.replace(',', '.')) : 0,
            heightUnit: row.heightUnit || '',
            volume: row.volume ? parseFloat(row.volume.replace(',', '.')) : 0,
            volumeUnit: row.volumeUnit || '',
            minUnit: row.minUnit ? parseFloat(row.minUnit.replace(',', '.')) : 0,
            stepSize: row.stepSize ? parseFloat(row.stepSize.replace(',', '.')) : 0,
            packagingUnit: row.packagingUnit || '',
            packagingUnitName: row.packagingUnitName || '', // Presentación del producto
            packagingPackageName: row.packagingPackageName || '',
            packagingPackageUnit: row.packagingPackageUnit || '',
            packagingAmountPerPackage: row.packagingAmountPerPackage ? parseFloat(row.packagingAmountPerPackage.replace(',', '.')) : 0,
            packagingBoxName: row.packagingBoxName || '',
            packagingBoxUnit: row.packagingBoxUnit || '',
            packagingAmountPerBox: row.packagingAmountPerBox ? parseFloat(row.packagingAmountPerBox.replace(',', '.')) : 0,
            packagingPalletName: row.packagingPalletName || '',
            packagingPalletUnit: row.packagingPalletUnit || '',
            packagingAmountPerPallet: row.packagingAmountPerPallet ? parseFloat(row.packagingAmountPerPallet.replace(',', '.')) : 0,
          };

          // Solo actualizar el precio del CSV si no hay un precio manual establecido
          if (!existingProduct.manualPrice && row.pricePerUnit) {
            updateData.pricePerUnit = parseFloat(row.pricePerUnit.replace(',', '.'));
          }

          await db
            .update(products)
            .set(updateData)
            .where(eq(products.productId, row.productId));
          
          updatedProducts++;
        }
        
        processedProducts++;
        
        if (processedProducts % 50 === 0) {
          console.log(`📈 Progreso: ${processedProducts} productos procesados`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando producto ${row.productId} (Fila ${row.originalRowIndex}):`, error);
        errors.push(`Fila ${row.originalRowIndex} - productId ${row.productId}: ${error instanceof Error ? error.message : String(error)}`);
        skippedProducts++;
      }
    }

    const summary = {
      processedProducts,
      newProducts,
      updatedProducts,
      skippedProducts,
      errors
    };

    console.log(`🎉 Importación de productos completada:`, summary);
    
    return summary;
  }

  // Función auxiliar para obtener producto por productId
  async getProductByProductId(productId: string): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.productId, productId));
    return product;
  }

  async getProductAnalytics(sku: string): Promise<{
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    averagePrice: number;
    topClients: Array<{
      clientName: string;
      totalPurchases: number;
      units: number;
    }>;
    salesTrend: Array<{
      period: string;
      sales: number;
      units: number;
    }>;
  }> {
    // Get sales data for this product
    const salesData = await db
      .select({
        monto: salesTransactions.monto,
        caprad2: salesTransactions.caprco2,
        nokoen: salesTransactions.nokoen,
        feemdo: salesTransactions.feemdo
      })
      .from(salesTransactions)
      .where(eq(salesTransactions.koprct, sku));

    const totalSales = salesData.reduce((sum, sale) => sum + (Number(sale.monto) || 0), 0);
    const totalUnits = salesData.reduce((sum, sale) => sum + (Number(sale.caprad2) || 0), 0);
    const transactionCount = salesData.length;
    const averagePrice = totalUnits > 0 ? totalSales / totalUnits : 0;

    // Top clients
    const clientSales = salesData.reduce((acc, sale) => {
      const client = sale.nokoen || 'Cliente Desconocido';
      if (!acc[client]) {
        acc[client] = { totalPurchases: 0, units: 0 };
      }
      acc[client].totalPurchases += Number(sale.monto) || 0;
      acc[client].units += Number(sale.caprad2) || 0;
      return acc;
    }, {} as Record<string, { totalPurchases: number; units: number }>);

    const topClients = Object.entries(clientSales)
      .map(([clientName, data]) => ({ clientName, ...data }))
      .sort((a, b) => b.totalPurchases - a.totalPurchases)
      .slice(0, 10);

    // Sales trend (monthly)
    const salesTrend = salesData.reduce((acc, sale) => {
      const period = sale.feemdo ? new Date(sale.feemdo).toISOString().substring(0, 7) : '2025-01';
      if (!acc[period]) {
        acc[period] = { sales: 0, units: 0 };
      }
      acc[period].sales += Number(sale.monto) || 0;
      acc[period].units += Number(sale.caprad2) || 0;
      return acc;
    }, {} as Record<string, { sales: number; units: number }>);

    const salesTrendArray = Object.entries(salesTrend)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      totalSales,
      totalUnits,
      transactionCount,
      averagePrice,
      topClients,
      salesTrend: salesTrendArray
    };
  }

  async getProductPriceHistory(sku: string): Promise<ProductPriceHistory[]> {
    return await db
      .select()
      .from(productPriceHistory)
      .where(eq(productPriceHistory.productSku, sku))
      .orderBy(desc(productPriceHistory.createdAt));
  }

  async getWarehouses(): Promise<Array<{
    code: string;
    name: string;
    location?: string;
    productCount: number;
  }>> {
    const warehouses = await db
      .select({
        code: productStock.warehouseCode,
        location: productStock.warehouseLocation,
        productCount: sql<number>`COUNT(DISTINCT ${productStock.productSku})`
      })
      .from(productStock)
      .groupBy(productStock.warehouseCode, productStock.warehouseLocation);

    return warehouses.map(w => ({
      code: w.code,
      name: w.code, // Using code as name since we don't have warehouse names in CSV
      location: w.location || undefined,
      productCount: w.productCount
    }));
  }

  async getBranches(): Promise<Array<{
    code: string;
    name: string;
    warehouseCount: number;
  }>> {
    const branches = await db
      .select({
        code: productStock.branchCode,
        warehouseCount: sql<number>`COUNT(DISTINCT ${productStock.warehouseCode})`
      })
      .from(productStock)
      .groupBy(productStock.branchCode);

    return branches.map(b => ({
      code: b.code,
      name: b.code, // Using code as name since we don't have branch names in CSV
      warehouseCount: b.warehouseCount
    }));
  }

  async getStockSummaryByWarehouse(): Promise<Array<{
    warehouseCode: string;
    warehouseName: string;
    totalProducts: number;
    totalPhysicalStock: number;
    totalAvailableStock: number;
  }>> {
    const stockSummary = await db
      .select({
        warehouseCode: productStock.warehouseCode,
        warehouseLocation: productStock.warehouseLocation,
        totalProducts: sql<number>`COUNT(DISTINCT ${productStock.productSku})`,
        totalPhysicalStock: sql<number>`COALESCE(SUM(CAST(${productStock.physicalStock1} AS DECIMAL)), 0) + COALESCE(SUM(CAST(${productStock.physicalStock2} AS DECIMAL)), 0)`,
        totalAvailableStock: sql<number>`COALESCE(SUM(CAST(${productStock.availableStock1} AS DECIMAL)), 0) + COALESCE(SUM(CAST(${productStock.availableStock2} AS DECIMAL)), 0)`
      })
      .from(productStock)
      .groupBy(productStock.warehouseCode, productStock.warehouseLocation);

    return stockSummary.map(s => ({
      warehouseCode: s.warehouseCode,
      warehouseName: s.warehouseLocation || s.warehouseCode,
      totalProducts: s.totalProducts,
      totalPhysicalStock: s.totalPhysicalStock,
      totalAvailableStock: s.totalAvailableStock
    }));
  }

  async getWarehouseStock(warehouseCode: string, branchCode?: string): Promise<Array<{
    productSku: string;
    productName: string;
    branchCode: string;
    physicalStock1: number;
    physicalStock2: number;
    availableStock1: number;
    availableStock2: number;
    unit1?: string;
    unit2?: string;
  }>> {
    const conditions = [eq(productStock.warehouseCode, warehouseCode)];
    
    if (branchCode) {
      conditions.push(eq(productStock.branchCode, branchCode));
    }

    const stockData = await db
      .select({
        productSku: productStock.productSku,
        productName: products.name,
        branchCode: productStock.branchCode,
        physicalStock1: productStock.physicalStock1,
        physicalStock2: productStock.physicalStock2,
        availableStock1: productStock.availableStock1,
        availableStock2: productStock.availableStock2,
        unit1: products.packagingUnitName, // Mantener compatibilidad
        unit2: products.packagingUnit // Mantener compatibilidad
      })
      .from(productStock)
      .leftJoin(products, eq(productStock.productSku, products.sku))
      .where(and(...conditions))
      .orderBy(productStock.productSku);

    return stockData.map(item => ({
      productSku: item.productSku,
      productName: item.productName || item.productSku,
      branchCode: item.branchCode,
      physicalStock1: Number(item.physicalStock1 || 0),
      physicalStock2: Number(item.physicalStock2 || 0),
      availableStock1: Number(item.availableStock1 || 0),
      availableStock2: Number(item.availableStock2 || 0),
      unit1: item.unit1 || undefined,
      unit2: item.unit2 || undefined
    }));
  }

}

export const storage = new DatabaseStorage();
