import {
  users,
  sessions,
  salesTransactions,
  goals,
  salespeopleUsers,
  products,
  productStock,
  productPriceHistory,
  warehouses,
  clients,
  tasks,
  taskAssignments,
  orders,
  orderItems,
  priceList,
  quotes,
  quoteItems,
  storeConfig,
  storeBanners,
  ecommerceProducts,
  nvvPendingSales,
  type User,
  type UpsertUser,
  type InsertUser,
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
  type Warehouse,
  type InsertWarehouse,
  type Client,
  type InsertClient,
  type CsvProductStockImport,
  type Task,
  type InsertTask,
  type InsertTaskInput,
  type TaskAssignment,
  type InsertTaskAssignment,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type PriceList,
  type InsertPriceList,
  type InsertPriceListInput,
  type Quote,
  type InsertQuote,
  type QuoteItem,
  type InsertQuoteItem,
  type InsertQuoteItemInput,
  type EcommerceProduct,
  type UpdateEcommerceProduct,
  type EcommerceProductFilters,
  type StoreConfig,
  type StoreBanner,
  type NvvPendingSales,
  type InsertNvvPendingSales,
  type NvvImportResult,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte, lt, inArray, or, isNull } from "drizzle-orm";
import { getComunaRegion } from "./chile-regions";
import { comunaRegionService } from "./comunaRegionService";

// Utility function to normalize comuna names for consistent regional mapping
function normalizeComunaName(name: string | null): string | null {
  if (!name) return null;
  return name.trim().toUpperCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\s+/g, ' '); // collapse spaces
}

// Utility function to extract packaging type from product names
function extractPackagingType(productName: string | null): string {
  if (!productName) return 'OT'; // Other
  
  const nameUpper = productName.toUpperCase().trim();
  
  // Define packaging type patterns - order matters for specificity
  const packagingPatterns = [
    { type: 'BD', patterns: ['BALDE', 'BALDES'] },
    { type: 'GL', patterns: ['GL.', 'GL ', ' GL', 'GALON', 'GALONES'] },
    { type: 'Q4', patterns: ['4 GALONES', '4 GL', '4GL', 'CUARTO'] },
    { type: 'KT', patterns: ['KIT', 'KT'] },
    { type: 'UN', patterns: ['UNIDAD', ' UN.', ' UN ', 'UNITARIO'] },
    { type: 'KG', patterns: ['KG.', 'KG ', ' KG', 'KILO', 'KILOGRAMO'] },
    { type: 'LT', patterns: ['LT.', 'LT ', ' LT', 'LITRO', 'LITROS'] },
    { type: 'GB', patterns: ['GARRAFA', 'BIDÓN'] },
    { type: 'OD', patterns: ['ONZA', 'OZ'] }
  ];
  
  // Check each pattern in order of specificity
  for (const packagingGroup of packagingPatterns) {
    for (const pattern of packagingGroup.patterns) {
      if (nameUpper.includes(pattern)) {
        return packagingGroup.type;
      }
    }
  }
  
  // Special cases for fractions
  if (nameUpper.match(/1\/4\s*GL/)) return 'Q4';
  if (nameUpper.match(/1\/2\s*GL/)) return 'GL';
  
  return 'OT'; // Other - unclassified packaging
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  
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
    totalOrders: number;
    totalUnits: number;
    activeCustomers: number;
  }>;
  getTopSalespeople(limit?: number, startDate?: string, endDate?: string, segment?: string): Promise<{
    items: Array<{
      salesperson: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
  }>;
  getTopProducts(limit?: number, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<{
    items: Array<{
      productName: string;
      totalSales: number;
      totalUnits: number;
    }>;
    periodTotalSales: number;
  }>;
  getTopClients(limit?: number, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<{
    items: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
  }>;
  getSegmentAnalysis(startDate?: string, endDate?: string): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>>;
  getSegmentAnalysisByUniqueClients(startDate?: string, endDate?: string): Promise<Array<{
    segment: string;
    uniqueClients: number;
    percentage: number;
  }>>;
  getComunasAnalysis(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  }): Promise<Array<{
    comuna: string;
    totalSales: number;
    transactionCount: number;
    percentage: number;
  }>>;
  getRegionAnalysis(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  }): Promise<Array<{
    region: string;
    totalSales: number;
    transactionCount: number;
    percentage: number;
  }>>;
  getSalesChartData(period: 'weekly' | 'monthly' | 'daily', startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<Array<{
    period: string;
    sales: number;
  }>>;
  
  // Packaging metrics operations
  getPackagingMetrics(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  }): Promise<Array<{
    packagingType: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    salesPercentage: number;
    unitPercentage: number;
  }>>;
  
  // Product analytics operations
  getProductDetails(productName: string, filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    productName: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    averageOrderValue: number;
    topClient: string;
    topSalesperson: string;
  }>;
  
  getProductFormats(productName: string, filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    format: string;
    totalSales: number;
    totalUnits: number;
    percentage: number;
  }>>;
  
  getProductColors(productName: string, filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    color: string;
    totalSales: number;
    totalUnits: number;
    percentage: number;
  }>>;
  
  // Goals operations
  getGoals(): Promise<Goal[]>;
  getGoalsByType(type: string): Promise<Goal[]>;
  getGoalsBySalesperson(salesperson: string): Promise<Goal[]>;
  getSalespersonAlerts(salesperson: string): Promise<any[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, goal: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
  
  // Data for goals form and filtering
  getUniqueSegments(): Promise<string[]>;
  getUniqueSalespeople(): Promise<string[]>;
  getUniqueClients(): Promise<string[]>;
  getUniqueSuppliers(): Promise<string[]>;
  getUniqueBusinessTypes(): Promise<string[]>;
  getUniqueEntityTypes(): Promise<string[]>;
  
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
  
  // Session management
  invalidateUserSessions(userId: string): Promise<void>;
  
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
  
  // Nuevas funciones para métricas del equipo
  getTopProductsByTeam(salespeopleNames: string[], limit?: number): Promise<Array<{
    productId: string;
    productName: string;
    totalSales: number;
    totalQuantity: number;
    salesCount: number;
  }>>;
  
  getTeamMetrics(salespeopleNames: string[]): Promise<{
    totalSales: number;
    totalTransactions: number;
    averagePerSalesperson: number;
    bestPerformer: { name: string; sales: number } | null;
    teamGrowth: number;
  }>;
  
  // Warehouse operations  
  getWarehouse(kobo: string, kosu: string): Promise<Warehouse | undefined>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(kobo: string, kosu: string, warehouse: Partial<InsertWarehouse>): Promise<Warehouse>;
  
  // Product operations (KOPR-based)
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
  getProduct(kopr: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>; // Compatibility
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(kopr: string, product: Partial<InsertProduct>): Promise<Product>;
  updateProductPrice(kopr: string, newPrice: number, changedBy: string, reason?: string): Promise<Product>;
  
  // eCommerce product operations
  getEcommerceProducts(filters?: EcommerceProductFilters): Promise<Array<Product & {
    primaryImageUrl?: string;
    totalStock?: number;
    displayPrice?: number;
  }>>;
  getEcommerceProduct(kopr: string): Promise<(Product & { displayPrice?: number }) | undefined>;
  createEcommerceProduct(product: EcommerceProduct): Promise<Product>;
  updateEcommerceProduct(kopr: string, product: UpdateEcommerceProduct): Promise<Product>;
  getEcommerceProductByCode(code: string): Promise<any | null>;
  toggleEcommerceActive(kopr: string): Promise<Product>;
  getEcommerceCategories(): Promise<string[]>;
  validateProductSlug(slug: string, excludeKopr?: string): Promise<boolean>;
  
  // eCommerce Admin operations (Simple approach using priceList)
  getEcommerceAdminProducts(filters?: {
    search?: string;
    categoria?: string;
    activo?: boolean;
  }): Promise<Array<{
    id: string;
    codigo: string;
    producto: string;
    unidad?: string;
    precio: number;
    precioOriginal?: number;
    categoria?: string;
    descripcion?: string;
    activo: boolean;
    imagenUrl?: string;
    stock?: number;
  }>>;
  getEcommerceAdminCategories(): Promise<Array<{
    id: string;
    nombre: string;
    descripcion?: string;
    activa: boolean;
    productoCount: number;
  }>>;
  getEcommerceAdminStats(): Promise<{
    totalProductos: number;
    productosActivos: number;
    totalCategorias: number;
    ventasMes: number;
  }>;
  updateEcommerceAdminProduct(id: string, updates: {
    categoria?: string;
    descripcion?: string;
    imagenUrl?: string;
    precioEcommerce?: number;
    activo?: boolean;
  }): Promise<{
    id: string;
    codigo: string;
    producto: string;
    categoria?: string;
    descripcion?: string;
    activo: boolean;
  }>;
  toggleEcommerceAdminProduct(id: string): Promise<{
    id: string;
    activo: boolean;
  }>;
  createEcommerceAdminCategory(data: {
    nombre: string;
    descripcion?: string;
  }): Promise<{
    id: string;
    nombre: string;
    descripcion?: string;
    activa: boolean;
  }>;
  
  // Product stock operations (KOPR-based)
  getProductStock(kopr: string): Promise<ProductStock[]>;
  getProductStockByWarehouse(kopr: string, kobo: string, kosu?: string): Promise<ProductStock[]>;
  upsertProductStock(stock: InsertProductStock): Promise<ProductStock>;
  
  // Client operations
  getClients(filters?: {
    search?: string;
    segment?: string;
    salesperson?: string;
    creditStatus?: string;
    businessType?: string;
    debtStatus?: string; // con/sin deuda
    entityType?: string; // cliente/proveedor/otro
    limit?: number;
    offset?: number;
  }): Promise<Array<Client & {
    totalTransactions?: number;
    totalSales?: number;
    lastTransactionDate?: string;
  }>>;
  getClientByKoen(koen: string): Promise<Client | undefined>;
  insertClient(client: InsertClient): Promise<Client>;
  insertMultipleClients(clients: InsertClient[]): Promise<{ inserted: number; updated: number; skipped: number } | undefined>;
  updateClient(koen: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(koen: string): Promise<void>;

  // CSV import for new KOPR-based format
  importProductStockFromKOPRCSV(csvData: Array<{
    KOPR: string;
    NOKOPR: string;
    UD01PR?: string;
    UD02PR?: string;
    KOSU: string;
    KOBO: string;
    DATOSUBIC?: string;
    STFI1?: string;
    STFI2?: string;
  }>): Promise<{
    processedProducts: number;
    newProducts: number;
    updatedStock: number;
    newWarehouses: number;
    errors: string[];
  }>;
  
  // Legacy import for compatibility
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

  // Task management operations
  getTasks(filters?: {
    creatorId?: string;
    assigneeUserId?: string;
    status?: string;
    priority?: string;
  }): Promise<Array<Task & { assignments: TaskAssignment[] }>>;
  getTask(id: string): Promise<Task & { assignments: TaskAssignment[] } | undefined>;
  createTask(task: InsertTask, assignments: InsertTaskAssignment[]): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  updateAssignmentStatus(assignmentId: string, status: string, notes?: string): Promise<TaskAssignment>;
  markAssignmentRead(assignmentId: string): Promise<TaskAssignment>;
  getTasksForUser(userId: string, userSegments: string[]): Promise<Array<Task & { assignments: TaskAssignment[] }>>;
  
  // Personal Task Management - SECURITY: All methods filter by assignedToUserId = userId
  createMyTask(task: InsertTaskInput, userId: string): Promise<Task>;
  getMyTasks(filters: {
    status?: 'pendiente' | 'en_progreso' | 'completada';
    type?: 'texto' | 'formulario' | 'visita';
    period?: 'week' | 'month';
  }, userId: string): Promise<Task[]>;
  updateMyTask(id: string, patch: Partial<Task>, userId: string): Promise<Task>;
  deleteMyTask(id: string, userId: string): Promise<void>;
  getMyTaskSummary(filters: {
    period?: 'week' | 'month';
  }, userId: string): Promise<{
    statusCounts: {
      pendiente: number;
      en_progreso: number;
      completada: number;
    };
    typeCounts: {
      texto: number;
      formulario: number;
      visita: number;
    };
    montoEstimadoTotal: number;
  }>;
  
  // Order management operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrders(filters?: {
    createdBy?: string;
    status?: string;
    clientName?: string;
    userRole?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order>;
  deleteOrder(id: string): Promise<void>;
  
  // Order items operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  updateOrderItem(id: string, orderItem: Partial<InsertOrderItem>): Promise<OrderItem>;
  deleteOrderItem(id: string): Promise<void>;

  // Price List operations
  getPriceList(filters?: {
    search?: string;
    unidad?: string;
    tipoProducto?: string;
    color?: string;
    limit?: number;
    offset?: number;
  }): Promise<PriceList[]>;
  getPriceListCount(search?: string, unidad?: string, tipoProducto?: string, color?: string): Promise<number>;
  getAvailableUnits(): Promise<string[]>;
  getProductTypes(): Promise<string[]>;
  getAllProductColors(): Promise<string[]>;
  getPriceListById(id: string): Promise<PriceList | undefined>;
  getPriceListByCodigo(codigo: string): Promise<PriceList | undefined>;
  createPriceListItem(item: InsertPriceListInput): Promise<PriceList>;
  createMultiplePriceListItems(items: InsertPriceListInput[]): Promise<void>;
  updatePriceListItem(id: string, updates: Partial<InsertPriceListInput>): Promise<PriceList>;
  deletePriceListItem(id: string): Promise<void>;
  deleteAllPriceListItems(): Promise<void>;

  // Quote operations
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuotes(filters?: {
    createdBy?: string;
    status?: string;
    clientName?: string;
    limit?: number;
    offset?: number;
  }): Promise<Quote[]>;
  getQuoteById(id: string): Promise<Quote | undefined>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;
  
  // Quote items operations
  createQuoteItem(quoteItem: InsertQuoteItemInput): Promise<QuoteItem>;
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  updateQuoteItem(id: string, quoteItem: Partial<InsertQuoteItem>): Promise<QuoteItem>;
  deleteQuoteItem(id: string): Promise<void>;
  
  // Quote to Order conversion
  convertQuoteToOrder(quoteId: string, userId: string): Promise<Order>;
  
  // Additional helper for quote items
  getQuoteItemById(id: string): Promise<QuoteItem | undefined>;

  // Store operations
  getStoreConfig(): Promise<any>;
  getStoreBanners(): Promise<any[]>;
  getEcommerceProducts(filters?: {
    search?: string;
    categoria?: string;
    activo?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;
  getEcommerceCategories(): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    // First, try to find user in the main users table
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (user) {
      return user;
    }

    // If not found, try to find in salespeople_users table
    const [salespersonUser] = await db.select().from(salespeopleUsers).where(eq(salespeopleUsers.id, id));
    if (salespersonUser) {
      // Convert salesperson user to User format for authentication
      return {
        id: salespersonUser.id,
        email: salespersonUser.email,
        password: salespersonUser.password,
        firstName: salespersonUser.salespersonName ? salespersonUser.salespersonName.split(' ')[0] : null,
        lastName: salespersonUser.salespersonName ? salespersonUser.salespersonName.split(' ').slice(1).join(' ') : null,
        profileImageUrl: null,
        role: salespersonUser.role,
        createdAt: salespersonUser.createdAt,
        updatedAt: salespersonUser.updatedAt,
        // Add salesperson-specific fields for compatibility
        salespersonName: salespersonUser.salespersonName,
        username: salespersonUser.username,
        isActive: salespersonUser.isActive,
        supervisorId: salespersonUser.supervisorId,
        assignedSegment: salespersonUser.assignedSegment,
      } as User;
    }

    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // First, try to find user in the main users table
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (user) {
      return user;
    }

    // If not found, try to find in salespeople_users table
    const [salespersonUser] = await db.select().from(salespeopleUsers).where(eq(salespeopleUsers.email, email));
    if (salespersonUser) {
      // Convert salesperson user to User format for authentication
      return {
        id: salespersonUser.id,
        email: salespersonUser.email,
        password: salespersonUser.password,
        firstName: salespersonUser.salespersonName ? salespersonUser.salespersonName.split(' ')[0] : null,
        lastName: salespersonUser.salespersonName ? salespersonUser.salespersonName.split(' ').slice(1).join(' ') : null,
        profileImageUrl: null,
        role: salespersonUser.role,
        createdAt: salespersonUser.createdAt,
        updatedAt: salespersonUser.updatedAt,
        // Add salesperson-specific fields for compatibility
        salespersonName: salespersonUser.salespersonName,
        username: salespersonUser.username,
        isActive: salespersonUser.isActive,
        supervisorId: salespersonUser.supervisorId,
        assignedSegment: salespersonUser.assignedSegment,
      } as User;
    }

    return undefined;
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

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
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
    
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalSkipped = 0;
    
    console.log(`📊 Starting import of ${transactions.length} transactions in batches of ${BATCH_SIZE}`);
    
    // Process transactions in batches to avoid memory issues
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(transactions.length / BATCH_SIZE);
      
      // Get unique IDMAEEDO values from this batch
      const batchIds = Array.from(new Set(batch.map(t => t.idmaeedo)));
      
      // Check which IDMAEEDO values already exist in database
      const validBatchIds = batchIds.filter(id => id != null && id !== '').map(id => id!.toString());
      
      const existingIds = validBatchIds.length > 0 ? await db
        .select({ idmaeedo: salesTransactions.idmaeedo })
        .from(salesTransactions)
        .where(inArray(salesTransactions.idmaeedo, validBatchIds)) : [];
      
      const existingIdSet = new Set(existingIds.map(row => row.idmaeedo?.toString()));
      
      // Filter out transactions with existing IDMAEEDO
      const newTransactions = batch.filter(transaction => 
        !existingIdSet.has(transaction.idmaeedo?.toString() || '')
      );
      
      const batchSkipped = batch.length - newTransactions.length;
      
      // Insert only new transactions from this batch
      if (newTransactions.length > 0) {
        await db
          .insert(salesTransactions)
          .values(newTransactions);
      }
      
      totalInserted += newTransactions.length;
      totalSkipped += batchSkipped;
      
      console.log(`📦 Batch ${batchNumber}/${totalBatches}: Inserted ${newTransactions.length}, Skipped ${batchSkipped} duplicates`);
    }
    
    console.log(`✅ Import completed: ${totalInserted} new transactions imported, ${totalSkipped} duplicates skipped`);
  }

  // Delete transactions by date range - for clean reimports
  async deleteTransactionsByDateRange(startDate: string, endDate: string): Promise<number> {
    const result = await db
      .delete(salesTransactions)
      .where(
        and(
          gte(salesTransactions.feemdo, startDate),
          lte(salesTransactions.feemdo, endDate)
        )
      );
    
    return result.rowCount || 0;
  }

  // Atomic operation: delete existing + insert new transactions
  async replaceTransactionsByDateRange(
    transactions: InsertSalesTransaction[], 
    startDate: string, 
    endDate: string
  ): Promise<{ deleted: number; inserted: number }> {
    if (transactions.length === 0) {
      throw new Error('No transactions to import');
    }

    console.log(`🔄 Starting atomic replace operation for period ${startDate} to ${endDate}`);
    
    return await db.transaction(async (tx) => {
      // 1. Delete existing transactions in the date range
      const deleteResult = await tx
        .delete(salesTransactions)
        .where(
          and(
            gte(salesTransactions.feemdo, startDate),
            lte(salesTransactions.feemdo, endDate)
          )
        );
      
      const deletedCount = deleteResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCount} existing transactions`);

      // 2. Insert new transactions in batches
      const BATCH_SIZE = 100;
      let totalInserted = 0;
      
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        await tx.insert(salesTransactions).values(batch);
        totalInserted += batch.length;
        
        if (i + BATCH_SIZE < transactions.length) {
          console.log(`📦 Inserted batch: ${totalInserted}/${transactions.length}`);
        }
      }
      
      console.log(`✅ Replace operation completed: ${deletedCount} deleted, ${totalInserted} inserted`);
      
      return {
        deleted: deletedCount,
        inserted: totalInserted
      };
    });
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

  // Helper function for date range normalization  
  private normalizeDateForSQL(startDate?: string, endDate?: string): {
    startDateCondition?: any;
    endDateCondition?: any;
  } {
    const conditions: any = {};
    
    if (startDate) {
      conditions.startDateCondition = gte(salesTransactions.feemdo, startDate);
    }
    
    if (endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.endDateCondition = lt(salesTransactions.feemdo, endDateExclusive);
    }
    
    return conditions;
  }

  async getSalesMetrics(filters: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
    client?: string;
    supplier?: string;
  } = {}): Promise<{
    totalSales: number;
    totalTransactions: number;
    totalOrders: number;
    totalUnits: number;
    activeCustomers: number;
  }> {
    const { startDate, endDate, salesperson, segment, client, supplier } = filters;
    const conditions = [];
    
    // Use proper date boundaries for inclusive range
    const { startDateCondition, endDateCondition } = this.normalizeDateForSQL(startDate, endDate);
    
    if (startDateCondition) {
      conditions.push(startDateCondition);
    }
    if (endDateCondition) {
      conditions.push(endDateCondition);
    }
    if (salesperson) {
      conditions.push(eq(salesTransactions.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(salesTransactions.noruen, segment));
    }
    if (client) {
      conditions.push(eq(salesTransactions.nokoen, client));
    }
    if (supplier) {
      // Note: No supplier field in current schema, so this will be a no-op for now
      // When suppliers are implemented, add the appropriate condition here
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Calculate metrics using MONTO field directly - NCV already comes with negative values
    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
        totalOrders: sql<number>`COUNT(DISTINCT ${salesTransactions.nudo})`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
        activeCustomers: sql<number>`COUNT(DISTINCT ${salesTransactions.nokoen})`,
      })
      .from(salesTransactions)
      .where(whereClause);

    return {
      totalSales: Number(metrics.totalSales),
      totalTransactions: Number(metrics.totalTransactions),
      totalOrders: Number(metrics.totalOrders),
      totalUnits: Number(metrics.totalUnits),
      activeCustomers: Number(metrics.activeCustomers),
    };
  }

  async getTopSalespeople(limit = 10, startDate?: string, endDate?: string, segment?: string): Promise<{
    items: Array<{
      salesperson: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
  }> {
    const conditions = [
      sql`nokofu IS NOT NULL AND nokofu != ''`
    ];
    
    if (startDate) {
      conditions.push(sql`feemdo >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`feemdo <= ${endDate}`);
    }
    if (segment) {
      conditions.push(sql`noruen = ${segment}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(monto), 0)`,
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
      ) as unique_transactions`);
    
    const results = await db
      .select({
        salesperson: sql<string>`nokofu`,
        totalSales: sql<number>`COALESCE(SUM(monto), 0)`,
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
      .orderBy(sql`SUM(monto) DESC`)
      .limit(limit);

    return {
      items: results.map(r => ({
        salesperson: r.salesperson || '',
        totalSales: Number(r.totalSales),
        transactionCount: Number(r.transactionCount),
      })),
      periodTotalSales: Number(totalResult.total),
    };
  }

  async getTopProducts(limit = 10, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<{
    items: Array<{
      productName: string;
      totalSales: number;
      totalUnits: number;
    }>;
    periodTotalSales: number;
  }> {
    const conditions = [];
    
    // Use proper date boundaries for inclusive range
    const { startDateCondition, endDateCondition } = this.normalizeDateForSQL(startDate, endDate);
    
    if (startDateCondition) {
      conditions.push(startDateCondition);
    }
    if (endDateCondition) {
      conditions.push(endDateCondition);
    }
    if (salesperson) {
      conditions.push(eq(salesTransactions.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(salesTransactions.noruen, segment));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${salesTransactions.tido} = 'NCV' THEN -${salesTransactions.ppprne} ELSE ${salesTransactions.ppprne} END), 0)`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokoprct} IS NOT NULL AND ${salesTransactions.nokoprct} != '' ${whereClause ? sql`AND ${whereClause}` : sql``}`);
    
    // For products, sum by individual product lines (not NUDO grouping)
    const results = await db
      .select({
        productName: salesTransactions.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.ppprne}), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.nokoprct} IS NOT NULL AND ${salesTransactions.nokoprct} != '' ${whereClause ? sql`AND ${whereClause}` : sql``}`)
      .groupBy(salesTransactions.nokoprct)
      .orderBy(sql`SUM(CASE WHEN ${salesTransactions.tido} = 'NCV' THEN -${salesTransactions.ppprne} ELSE ${salesTransactions.ppprne} END) DESC`)
      .limit(limit);

    return {
      items: results.map(r => ({
        productName: r.productName || '',
        totalSales: Number(r.totalSales),
        totalUnits: Number(r.totalUnits),
      })),
      periodTotalSales: Number(totalResult.total),
    };
  }

  async getTopClients(limit = 10, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<{
    items: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
  }> {
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
    if (segment) {
      conditions.push(sql`noruen = ${segment}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(monto), 0)`,
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
      ) as unique_transactions`);
    
    const results = await db
      .select({
        clientName: sql<string>`nokoen`,
        totalSales: sql<number>`COALESCE(SUM(monto), 0)`,
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
      .orderBy(sql`SUM(monto) DESC`)
      .limit(limit);

    return {
      items: results.map(r => ({
        clientName: r.clientName || '',
        totalSales: Number(r.totalSales),
        transactionCount: Number(r.transactionCount),
      })),
      periodTotalSales: Number(totalResult.total),
    };
  }

  async getSegmentAnalysis(startDate?: string, endDate?: string): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>> {
    // Use proper date boundaries for inclusive range
    const { startDateCondition, endDateCondition } = this.normalizeDateForSQL(startDate, endDate);
    
    const dateConditions = [];
    if (startDateCondition) {
      dateConditions.push(startDateCondition);
    }
    if (endDateCondition) {
      dateConditions.push(endDateCondition);
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
    if (startDateCondition) {
      conditions.push(startDateCondition);
    }
    if (endDateCondition) {
      conditions.push(endDateCondition);
    }

    const results = await db
      .select({
        segment: salesTransactions.noruen,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
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

  async getSalesChartData(period: 'weekly' | 'monthly' | 'daily', startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<Array<{
    period: string;
    sales: number;
  }>> {
    const conditions = [sql`${salesTransactions.feemdo} IS NOT NULL`];
    
    // Use proper date boundaries for inclusive range
    const { startDateCondition, endDateCondition } = this.normalizeDateForSQL(startDate, endDate);
    
    if (startDateCondition) {
      conditions.push(startDateCondition);
    }
    if (endDateCondition) {
      conditions.push(endDateCondition);
    }
    if (salesperson) {
      conditions.push(eq(salesTransactions.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(salesTransactions.noruen, segment));
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

  // Packaging metrics operations
  async getPackagingMetrics(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  }): Promise<Array<{
    packagingType: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    salesPercentage: number;
    unitPercentage: number;
  }>> {
    const conditions = [sql`${salesTransactions.feemdo} IS NOT NULL`];
    
    // Use proper date boundaries for inclusive range
    const { startDateCondition, endDateCondition } = this.normalizeDateForSQL(filters?.startDate, filters?.endDate);
    
    if (startDateCondition) {
      conditions.push(startDateCondition);
    }
    if (endDateCondition) {
      conditions.push(endDateCondition);
    }
    if (filters?.salesperson) {
      conditions.push(eq(salesTransactions.nokofu, filters.salesperson));
    }
    if (filters?.segment) {
      conditions.push(eq(salesTransactions.noruen, filters.segment));
    }

    // Get totals for percentage calculations
    const [totalResult] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
      })
      .from(salesTransactions)
      .where(and(...conditions));

    const grandTotalSales = Number(totalResult.totalSales);
    const grandTotalUnits = Number(totalResult.totalUnits);

    // Query for packaging metrics using CASE for SQL-based packaging type extraction
    const results = await db
      .select({
        packagingType: sql<string>`
          CASE 
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%BALDE%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%BALDES%' THEN 'BD'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%4 GALONES%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%4 GL%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%4GL%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%CUARTO%' THEN 'Q4'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%GL.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%GL %' OR UPPER(${salesTransactions.nokoprct}) LIKE '% GL%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%GALON%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%GALONES%' THEN 'GL'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%KIT%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KT%' THEN 'KT'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%UNIDAD%' OR UPPER(${salesTransactions.nokoprct}) LIKE '% UN.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '% UN %' OR UPPER(${salesTransactions.nokoprct}) LIKE '%UNITARIO%' THEN 'UN'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%KG.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KG %' OR UPPER(${salesTransactions.nokoprct}) LIKE '% KG%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KILO%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KILOGRAMO%' THEN 'KG'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%LT.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%LT %' OR UPPER(${salesTransactions.nokoprct}) LIKE '% LT%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%LITRO%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%LITROS%' THEN 'LT'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%GARRAFA%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%BIDÓN%' THEN 'GB'
            WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%ONZA%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%OZ%' THEN 'OD'
            ELSE 'OT'
          END`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(salesTransactions)
      .where(and(...conditions))
      .groupBy(sql`
        CASE 
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%BALDE%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%BALDES%' THEN 'BD'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%4 GALONES%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%4 GL%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%4GL%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%CUARTO%' THEN 'Q4'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%GL.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%GL %' OR UPPER(${salesTransactions.nokoprct}) LIKE '% GL%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%GALON%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%GALONES%' THEN 'GL'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%KIT%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KT%' THEN 'KT'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%UNIDAD%' OR UPPER(${salesTransactions.nokoprct}) LIKE '% UN.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '% UN %' OR UPPER(${salesTransactions.nokoprct}) LIKE '%UNITARIO%' THEN 'UN'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%KG.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KG %' OR UPPER(${salesTransactions.nokoprct}) LIKE '% KG%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KILO%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%KILOGRAMO%' THEN 'KG'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%LT.%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%LT %' OR UPPER(${salesTransactions.nokoprct}) LIKE '% LT%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%LITRO%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%LITROS%' THEN 'LT'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%GARRAFA%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%BIDÓN%' THEN 'GB'
          WHEN UPPER(${salesTransactions.nokoprct}) LIKE '%ONZA%' OR UPPER(${salesTransactions.nokoprct}) LIKE '%OZ%' THEN 'OD'
          ELSE 'OT'
        END`)
      .orderBy(sql`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0) DESC`);

    return results.map((r: any) => ({
      packagingType: r.packagingType,
      totalSales: Number(r.totalSales),
      totalUnits: Number(r.totalUnits),
      transactionCount: Number(r.transactionCount),
      salesPercentage: grandTotalSales > 0 ? (Number(r.totalSales) / grandTotalSales) * 100 : 0,
      unitPercentage: grandTotalUnits > 0 ? (Number(r.totalUnits) / grandTotalUnits) * 100 : 0,
    }));
  }

  // Product analytics operations
  async getProductDetails(productName: string, filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    productName: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    averageOrderValue: number;
    topClient: string;
    topSalesperson: string;
  }> {
    const conditions = [
      sql`LOWER(${salesTransactions.nokoprct}) = LOWER(${productName})`
    ];
    
    if (filters?.startDate) {
      conditions.push(gte(salesTransactions.feemdo, filters.startDate));
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(lt(salesTransactions.feemdo, endDateExclusive));
    }
    
    const whereClause = and(...conditions);

    // Get main product metrics
    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause);

    // Get top client for this product
    const [topClient] = await db
      .select({
        clientName: sql<string>`${salesTransactions.nokoen}`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause)
      .groupBy(salesTransactions.nokoen)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS DECIMAL)) DESC`)
      .limit(1);

    // Get top salesperson for this product
    const [topSalesperson] = await db
      .select({
        salesperson: sql<string>`${salesTransactions.nokofu}`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause)
      .groupBy(salesTransactions.nokofu)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS DECIMAL)) DESC`)
      .limit(1);

    return {
      productName,
      totalSales: Number(metrics.totalSales),
      totalUnits: Number(metrics.totalUnits),
      transactionCount: Number(metrics.transactionCount),
      averageOrderValue: Number(metrics.averageOrderValue),
      topClient: topClient?.clientName || 'N/A',
      topSalesperson: topSalesperson?.salesperson || 'N/A',
    };
  }

  async getProductFormats(productName: string, filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    format: string;
    totalSales: number;
    totalUnits: number;
    percentage: number;
  }>> {
    const conditions = [
      sql`LOWER(${salesTransactions.nokoprct}) = LOWER(${productName})`
    ];
    
    if (filters?.startDate) {
      conditions.push(gte(salesTransactions.feemdo, filters.startDate));
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(lt(salesTransactions.feemdo, endDateExclusive));
    }
    
    const whereClause = and(...conditions);

    // Get total sales for percentage calculation
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause);
    
    const totalSales = Number(totalResult.total);

    // Extract format from product names using regex patterns for common formats
    const results = await db
      .select({
        productName: salesTransactions.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause)
      .groupBy(salesTransactions.nokoprct);

    // Process results to extract formats
    const formatMap = new Map<string, { totalSales: number; totalUnits: number }>();
    
    results.forEach(result => {
      const productName = result.productName || '';
      let format = 'Otro'; // Default format
      
      // Extract format from product name using common patterns
      const lowerName = productName.toLowerCase();
      
      // Check for specific patterns in order of specificity
      if (lowerName.includes('4 galones') || lowerName.includes('4gal')) {
        format = '4 Galones';
      } else if (lowerName.includes('1/4') || lowerName.includes('cuarto')) {
        format = '1/4 Galón';
      } else if (lowerName.includes('galón') || lowerName.includes('galon') || lowerName.includes(' gl') || lowerName.endsWith(' gl') || lowerName.includes(' gal ') || lowerName.endsWith(' gal')) {
        format = 'Galón';
      } else if (lowerName.includes('balde') || lowerName.includes('bd') || lowerName.includes('bld')) {
        format = 'Balde';
      } else if (lowerName.includes('kilo') || lowerName.includes(' kg') || lowerName.endsWith(' kg')) {
        format = 'Kilo';
      } else if (lowerName.includes('litro') || lowerName.includes(' lt') || lowerName.endsWith(' lt') || lowerName.includes(' lts')) {
        format = 'Litro';
      } else if (lowerName.includes('onza') || lowerName.includes(' oz')) {
        format = 'Onza';
      } else if (lowerName.includes('metro') || lowerName.includes(' mt') || lowerName.includes(' m ')) {
        format = 'Metro';
      }
      
      const existing = formatMap.get(format) || { totalSales: 0, totalUnits: 0 };
      formatMap.set(format, {
        totalSales: existing.totalSales + Number(result.totalSales),
        totalUnits: existing.totalUnits + Number(result.totalUnits),
      });
    });

    // Convert to array and calculate percentages
    return Array.from(formatMap.entries()).map(([format, data]) => ({
      format,
      totalSales: isNaN(data.totalSales) ? 0 : data.totalSales,
      totalUnits: isNaN(data.totalUnits) ? 0 : data.totalUnits,
      percentage: totalSales > 0 && !isNaN(totalSales) && !isNaN(data.totalSales) 
        ? (data.totalSales / totalSales) * 100 
        : 0,
    })).filter(item => item.totalSales > 0).sort((a, b) => b.totalSales - a.totalSales);
  }

  async getProductColors(productName: string, filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    color: string;
    totalSales: number;
    totalUnits: number;
    percentage: number;
  }>> {
    const conditions = [
      sql`LOWER(${salesTransactions.nokoprct}) = LOWER(${productName})`
    ];
    
    if (filters?.startDate) {
      conditions.push(gte(salesTransactions.feemdo, filters.startDate));
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(lt(salesTransactions.feemdo, endDateExclusive));
    }
    
    const whereClause = and(...conditions);

    // Get total sales for percentage calculation
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause);
    
    const totalSales = Number(totalResult.total);

    // Get all product variations for this product
    const results = await db
      .select({
        productName: salesTransactions.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause)
      .groupBy(salesTransactions.nokoprct);

    // Process results to extract colors
    const colorMap = new Map<string, { totalSales: number; totalUnits: number }>();
    
    results.forEach(result => {
      const productName = result.productName || '';
      let color = 'Sin especificar'; // Default color
      
      // Extract color from product name using common color patterns
      const lowerName = productName.toLowerCase();
      
      // Use simple string matching since it's more reliable than regex in this context
      if (lowerName.includes('blanco')) {
        color = 'Blanco';
      } else if (lowerName.includes('negro')) {
        color = 'Negro';
      } else if (lowerName.includes('rojo')) {
        color = 'Rojo';
      } else if (lowerName.includes('azul pacifico')) {
        color = 'Azul Pacífico';
      } else if (lowerName.includes('azul')) {
        color = 'Azul';
      } else if (lowerName.includes('verde')) {
        color = 'Verde';
      } else if (lowerName.includes('amarillo')) {
        color = 'Amarillo';
      } else if (lowerName.includes('gris')) {
        color = 'Gris';
      } else if (lowerName.includes('cafe') || lowerName.includes('café') || lowerName.includes('marron') || lowerName.includes('marrón')) {
        color = 'Café';
      } else if (lowerName.includes('rosa') || lowerName.includes('rosado')) {
        color = 'Rosa';
      } else if (lowerName.includes('naranja') || lowerName.includes('anaranjado')) {
        color = 'Naranja';
      } else if (lowerName.includes('violeta') || lowerName.includes('morado')) {
        color = 'Violeta';
      } else if (lowerName.includes('incoloro') || lowerName.includes('transparente')) {
        color = 'Incoloro';
      }
      
      const existing = colorMap.get(color) || { totalSales: 0, totalUnits: 0 };
      colorMap.set(color, {
        totalSales: existing.totalSales + Number(result.totalSales),
        totalUnits: existing.totalUnits + Number(result.totalUnits),
      });
    });

    // Convert to array and calculate percentages
    return Array.from(colorMap.entries()).map(([color, data]) => ({
      color,
      totalSales: isNaN(data.totalSales) ? 0 : data.totalSales,
      totalUnits: isNaN(data.totalUnits) ? 0 : data.totalUnits,
      percentage: totalSales > 0 && !isNaN(totalSales) && !isNaN(data.totalSales) 
        ? (data.totalSales / totalSales) * 100 
        : 0,
    })).filter(item => item.totalSales > 0).sort((a, b) => b.totalSales - a.totalSales);
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

  async getTransactionDetails(transactionId: string) {
    const [transaction] = await db
      .select()
      .from(salesTransactions)
      .where(eq(salesTransactions.id, transactionId));

    return transaction;
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

  async getUniqueSuppliers(): Promise<string[]> {
    // For now, return empty array since we don't have supplier data in the schema
    // When suppliers are implemented, replace this with actual query
    return [];
  }

  async getUniqueBusinessTypes(): Promise<string[]> {
    const result = await db
      .selectDistinct({ gien: clients.gien })
      .from(clients)
      .where(sql`${clients.gien} IS NOT NULL AND ${clients.gien} != '' AND LENGTH(${clients.gien}) > 1`)
      .orderBy(clients.gien)
      .limit(200); // Limit results to avoid heavy queries
    
    // Simple filter for obvious placeholder values  
    return result
      .map(row => row.gien?.trim())
      .filter(type => type && !['..', '.', '-', 'N/A'].includes(type)) as string[];
  }

  async getUniqueEntityTypes(): Promise<string[]> {
    const result = await db
      .selectDistinct({ tien: clients.tien })
      .from(clients)
      .where(sql`${clients.tien} IS NOT NULL AND ${clients.tien} != ''`)
      .orderBy(clients.tien);
    
    return result
      .map(row => row.tien?.trim())
      .filter(type => type && type.length > 0) as string[];
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
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${salesTransactions.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
            );
          }
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${salesTransactions.feemdo}) >= ${startDate} AND DATE(${salesTransactions.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
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
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${salesTransactions.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
            );
          }
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${salesTransactions.feemdo}) >= ${startDate} AND DATE(${salesTransactions.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
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

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${salesTransactions.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
            );
          }
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${salesTransactions.feemdo}) >= ${startDate} AND DATE(${salesTransactions.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
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

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${salesTransactions.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
            );
          }
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${salesTransactions.feemdo}) >= ${startDate} AND DATE(${salesTransactions.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
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

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${salesTransactions.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
            );
          }
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${salesTransactions.feemdo}) >= ${startDate} AND DATE(${salesTransactions.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
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

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${salesTransactions.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`
            );
          }
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${salesTransactions.feemdo}) >= ${startDate} AND DATE(${salesTransactions.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
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
    // Get salespeople/supervisors from salespeopleUsers table
    const salespeople = await db.select().from(salespeopleUsers).orderBy(salespeopleUsers.salespersonName);
    
    // Get admin users from users table and map to SalespersonUser format
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
    
    // Remove password from salespeople responses
    const safeSalespeople = salespeople.map(user => ({
      ...user,
      password: '' // Never expose password hashes
    }));
    
    const mappedAdmins: SalespersonUser[] = adminUsers.map(admin => ({
      id: admin.id,
      salespersonName: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email,
      username: admin.email, // Use email as username for admins
      email: admin.email,
      password: '', // Never expose password hashes
      isActive: true,
      role: admin.role as 'admin' | 'supervisor' | 'salesperson' | 'client',
      supervisorId: null, // Admins don't have supervisors
      assignedSegment: null, // Admins don't have assigned segments
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    }));
    
    // Combine both arrays, deduplicate by id, and sort by salespersonName
    const allUsers = [...safeSalespeople, ...mappedAdmins];
    const deduplicatedUsers = allUsers.filter((user, index, arr) => 
      arr.findIndex(u => u.id === user.id) === index
    );
    return deduplicatedUsers.sort((a, b) => (a.salespersonName || '').localeCompare(b.salespersonName || ''));
  }

  async createSalespersonUser(user: InsertSalespersonUser): Promise<SalespersonUser> {
    const [result] = await db
      .insert(salespeopleUsers)
      .values(user)
      .returning();
    return result;
  }

  async updateSalespersonUser(id: string, user: Partial<InsertSalespersonUser>): Promise<SalespersonUser> {
    const bcrypt = await import('bcryptjs');
    
    // Hash password if provided and not already hashed (robust bcrypt detection)
    let hashedPassword: string | undefined;
    const bcryptHashRegex = /^\$2[aby]\$\d{2}\$/;
    if (user.password && !bcryptHashRegex.test(user.password)) {
      hashedPassword = await bcrypt.hash(user.password, 12);
    } else if (user.password) {
      hashedPassword = user.password; // Already hashed
    }
    
    // Track if we need to invalidate sessions
    const needsSessionInvalidation = hashedPassword || user.isActive === false;
    
    // First check if it's a salesperson/supervisor user
    const [existingSalesperson] = await db
      .select({ id: salespeopleUsers.id })
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.id, id));
    
    if (existingSalesperson) {
      // Update in salespeopleUsers table
      const updateData = { ...user, updatedAt: new Date() };
      if (hashedPassword) updateData.password = hashedPassword;
      
      const [result] = await db
        .update(salespeopleUsers)
        .set(updateData)
        .where(eq(salespeopleUsers.id, id))
        .returning();
      
      // Invalidate sessions if password changed or user deactivated
      if (needsSessionInvalidation) {
        await this.invalidateUserSessions(id);
      }
      
      // Return without password hash
      return {
        ...result,
        password: '' // Never expose password hashes
      };
    }
    
    // Check if it's an admin user
    const [existingAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'admin')));
    
    if (existingAdmin) {
      // Map SalespersonUser fields back to User fields for admin users
      const adminUpdate: Partial<typeof users.$inferInsert> = {};
      
      if (user.salespersonName) {
        const nameParts = user.salespersonName.split(' ');
        adminUpdate.firstName = nameParts[0] || '';
        adminUpdate.lastName = nameParts.slice(1).join(' ') || '';
      }
      
      if (user.email) adminUpdate.email = user.email;
      if (hashedPassword) adminUpdate.password = hashedPassword;
      
      adminUpdate.updatedAt = new Date();
      
      // Update in users table
      const [updatedAdmin] = await db
        .update(users)
        .set(adminUpdate)
        .where(eq(users.id, id))
        .returning();
      
      // Invalidate sessions if password changed or user deactivated
      if (needsSessionInvalidation) {
        await this.invalidateUserSessions(id);
      }
      
      // Return in SalespersonUser format without password hash
      return {
        id: updatedAdmin.id,
        salespersonName: `${updatedAdmin.firstName || ''} ${updatedAdmin.lastName || ''}`.trim() || updatedAdmin.email,
        username: updatedAdmin.email,
        email: updatedAdmin.email,
        password: '', // Never expose password hashes
        isActive: true,
        role: updatedAdmin.role as 'admin' | 'supervisor' | 'salesperson' | 'client',
        supervisorId: null,
        assignedSegment: null,
        createdAt: updatedAdmin.createdAt,
        updatedAt: updatedAdmin.updatedAt,
      };
    }
    
    throw new Error(`User with id ${id} not found`);
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
    // First try to find in salespeopleUsers table
    const [salespersonUser] = await db
      .select()
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.id, id));
    
    if (salespersonUser) {
      return {
        ...salespersonUser,
        password: '' // Never expose password hashes
      };
    }
    
    // If not found, try to find in admin users table
    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'admin')));
    
    if (adminUser) {
      return {
        id: adminUser.id,
        salespersonName: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email,
        username: adminUser.email,
        email: adminUser.email,
        password: '', // Never expose password hashes
        isActive: true,
        role: adminUser.role as 'admin' | 'supervisor' | 'salesperson' | 'client',
        supervisorId: null,
        assignedSegment: null,
        createdAt: adminUser.createdAt,
        updatedAt: adminUser.updatedAt,
      };
    }
    
    return undefined;
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
  }): Promise<Array<Product & { primaryImageUrl?: string }>> {
    const conditions = [];
    
    // Only show products that are active AND eCommerceActive
    conditions.push(eq(products.active, true));
    conditions.push(eq(products.ecomActive, true));
    
    if (filters?.search) {
      conditions.push(
        sql`(${products.kopr} ILIKE ${`%${filters.search}%`} OR ${products.name} ILIKE ${`%${filters.search}%`})`
      );
    }
    
    if (filters?.category) {
      conditions.push(eq(products.category, filters.category));
    }

    let query = db.select({
      id: products.id,
      kopr: products.kopr,
      name: products.name,
      ud02pr: products.ud02pr,
      category: products.category,
      tags: products.tags,
      images: products.images,
      seoTitle: products.seoTitle,
      seoDescription: products.seoDescription,
      active: products.active,
      ecomActive: products.ecomActive,
      slug: products.slug,
      ecomPrice: products.ecomPrice,
      ogImageUrl: products.ogImageUrl,
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
    
    // Map to include missing fields and extract primary image
    return publicProducts.map(p => {
      let primaryImageUrl: string | undefined = undefined;
      if (p.images && Array.isArray(p.images)) {
        const primaryImage = p.images.find((img: any) => img.primary);
        const firstImage = p.images[0];
        primaryImageUrl = (primaryImage || firstImage)?.url;
      }

      return {
        ...p,
        priceProduct: null,
        priceOffer: null,
        showInStore: null,
        primaryImageUrl
      };
    });
  }

  // Get all product prices (only for authenticated users) - prioritizes ecomPrice
  async getAllProductPrices(): Promise<Record<string, string>> {
    const productPrices = await db.select({
      kopr: products.kopr,
      ecomPrice: products.ecomPrice,
      priceProduct: products.priceProduct,
      priceOffer: products.priceOffer
    }).from(products).where(eq(products.active, true));

    const pricesMap: Record<string, string> = {};
    productPrices.forEach(product => {
      // Priority: ecomPrice > priceOffer > priceProduct
      const price = product.ecomPrice || product.priceOffer || product.priceProduct;
      if (price && price !== '0') {
        pricesMap[product.kopr] = price.toString();
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
  }): Promise<Array<Product & { sku?: string; price?: string; totalStock?: number; warehouses?: string[] }>> {
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        sql`(${products.kopr} ILIKE ${`%${filters.search}%`} OR ${products.name} ILIKE ${`%${filters.search}%`})`
      );
    }
    
    if (filters?.active !== undefined) {
      conditions.push(eq(products.active, filters.active));
    }
    
    if (filters?.hasPrices !== undefined) {
      if (filters.hasPrices) {
        conditions.push(sql`${products.priceProduct} IS NOT NULL AND ${products.priceProduct} != '0'`);
      } else {
        conditions.push(sql`${products.priceProduct} IS NULL OR ${products.priceProduct} = '0'`);
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
      }).from(productStock).where(eq(productStock.kopr, product.kopr));
      
      const totalStock = stocks.reduce((sum, stock) => {
        return sum + (Number(stock.availableStock1) || 0) + (Number(stock.availableStock2) || 0);
      }, 0);
      
      const warehouseSet = new Set(stocks.map(s => s.warehouseCode));
      const warehouses = Array.from(warehouseSet);
      
      return {
        ...product,
        // Mapear campos para compatibilidad con frontend
        sku: product.kopr, // Frontend espera 'sku'
        price: product.priceProduct?.toString() || "0", // Frontend espera 'price'
        offerPrice: product.priceOffer?.toString() || null, // Precio de oferta
        showInStore: product.showInStore || false, // Mostrar en tienda
        totalStock,
        warehouses
      };
    }));

    return enrichedProducts;
  }

  // New KOPR-based function
  async getProduct(kopr: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.kopr, kopr));
    return product;
  }

  // Compatibility function for existing SKU-based calls
  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.kopr, sku));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(kopr: string, productData: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(products.kopr, kopr))
      .returning();
    return updatedProduct;
  }

  async updateProductPrice(kopr: string, newPrice: number, changedBy: string, reason?: string): Promise<Product> {
    // Get current product
    const currentProduct = await this.getProduct(kopr);
    if (!currentProduct) {
      throw new Error(`Product with KOPR ${kopr} not found`);
    }
    
    const oldPrice = currentProduct.priceProduct ? Number(currentProduct.priceProduct) : null;
    const oldOfferPrice = currentProduct.priceOffer ? Number(currentProduct.priceOffer) : null;

    // Update product prices
    const updateData: any = { 
      priceProduct: newPrice.toString(), 
      updatedAt: new Date() 
    };

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.kopr, kopr))
      .returning();

    // Record price history - creating entry for regular price change
    await db.insert(productPriceHistory).values({
      productSku: kopr, // Using KOPR as productSku for compatibility
      oldPrice: oldPrice?.toString() || null,
      newPrice: newPrice.toString(),
      changedBy,
      changeReason: reason || 'Precio actualizado'
    });

    return updatedProduct;
  }

  // eCommerce product operations
  async getEcommerceProducts(filters?: {
    search?: string;
    category?: string;
    active?: boolean;
    ecomActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Array<Product & { primaryImageUrl?: string; totalStock?: number }>> {
    const conditions = [];

    if (filters?.search) {
      conditions.push(sql`LOWER(${products.name}) LIKE LOWER('%' || ${filters.search} || '%')`);
    }

    if (filters?.category) {
      conditions.push(eq(products.category, filters.category));
    }

    if (filters?.active !== undefined) {
      conditions.push(eq(products.active, filters.active));
    }

    if (filters?.ecomActive !== undefined) {
      conditions.push(eq(products.ecomActive, filters.ecomActive));
    }

    if (filters?.minPrice !== undefined) {
      conditions.push(sql`COALESCE(${products.ecomPrice}, ${products.priceProduct}, 0) >= ${filters.minPrice}`);
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push(sql`COALESCE(${products.ecomPrice}, ${products.priceProduct}, 0) <= ${filters.maxPrice}`);
    }

    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(sql`${products.tags} && ${filters.tags}`);
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
    
    // Enrich with primary image and stock info
    const enrichedProducts = await Promise.all(productsList.map(async (product) => {
      // Get primary image URL
      let primaryImageUrl: string | undefined = undefined;
      if (product.images && Array.isArray(product.images)) {
        const primaryImage = product.images.find((img: any) => img.primary);
        const firstImage = product.images[0];
        primaryImageUrl = (primaryImage || firstImage)?.url;
      }

      // Get total stock
      const stocks = await db.select({
        availableStock1: productStock.availableStock1,
        availableStock2: productStock.availableStock2
      }).from(productStock).where(eq(productStock.kopr, product.kopr));
      
      const totalStock = stocks.reduce((sum, stock) => {
        return sum + (Number(stock.availableStock1) || 0) + (Number(stock.availableStock2) || 0);
      }, 0);

      return {
        ...product,
        primaryImageUrl,
        totalStock
      };
    }));

    return enrichedProducts;
  }

  async getEcommerceProduct(kopr: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.kopr, kopr));
    return product;
  }

  async createEcommerceProduct(product: EcommerceProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values({
      kopr: product.id, // Use the EcommerceProduct id as kopr
      name: product.descripcion || '',
      slug: product.id, // Use id as slug
      ecomActive: product.activo ?? false,
      ecomPrice: product.precioEcommerce,
      category: product.categoria,
      // Map other fields as needed
    }).returning();
    return newProduct;
  }

  async updateEcommerceProduct(kopr: string, productData: Partial<{
    name: string;
    slug: string;
    ecomActive: boolean;
    ecomPrice?: number;
    category?: string;
    tags?: string[];
    images?: Array<{id: string, url: string, alt: string, primary: boolean, sort: number}>;
    seoTitle?: string;
    seoDescription?: string;
    ogImageUrl?: string;
    ud02pr?: string;
    priceProduct?: number;
    priceOffer?: number;
    showInStore?: boolean;
    active?: boolean;
  }>): Promise<Product> {
    const updateData: any = { 
      ...productData, 
      updatedAt: new Date()
    };

    // Convert numeric fields to strings if provided
    if (productData.ecomPrice !== undefined) {
      updateData.ecomPrice = productData.ecomPrice?.toString();
    }
    if (productData.priceProduct !== undefined) {
      updateData.priceProduct = productData.priceProduct?.toString();
    }
    if (productData.priceOffer !== undefined) {
      updateData.priceOffer = productData.priceOffer?.toString();
    }

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.kopr, kopr))
      .returning();
    return updatedProduct;
  }

  async getEcommerceProductByCode(code: string): Promise<any | null> {
    try {
      // Look for the product in ecommerceProducts table first (matches ZIP import use case)
      const result = await db
        .select()
        .from(ecommerceProducts)
        .innerJoin(priceList, eq(ecommerceProducts.priceListId, priceList.id))
        .where(eq(priceList.codigo, code))
        .limit(1);

      if (result.length > 0) {
        return {
          id: result[0].ecommerce_products.id,
          kopr: result[0].price_list.codigo,
          codigo: result[0].price_list.codigo,
          producto: result[0].price_list.producto,
          precio: result[0].ecommerce_products.precioEcommerce,
          activo: result[0].ecommerce_products.activo
        };
      }

      // If not found in ecommerceProducts, check priceList and auto-create ecommerce entry
      const priceListProduct = await db
        .select()
        .from(priceList)
        .where(eq(priceList.codigo, code))
        .limit(1);

      if (priceListProduct.length > 0) {
        console.log(`[ZIP IMPORT] Auto-creating ecommerce product for code: ${code}`);
        
        // Create ecommerce product entry
        const [newEcomProduct] = await db
          .insert(ecommerceProducts)
          .values({
            priceListId: priceListProduct[0].id,
            activo: true, // Make it active by default for ZIP import
            precioEcommerce: priceListProduct[0].lista || priceListProduct[0].desc10 || null
          })
          .returning();

        return {
          id: newEcomProduct.id,
          kopr: priceListProduct[0].codigo,
          codigo: priceListProduct[0].codigo,
          producto: priceListProduct[0].producto,
          precio: newEcomProduct.precioEcommerce,
          activo: newEcomProduct.activo
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting ecommerce product by code:", error);
      return null;
    }
  }

  async toggleEcommerceActive(kopr: string): Promise<Product> {
    const currentProduct = await this.getProduct(kopr);
    if (!currentProduct) {
      throw new Error(`Product with KOPR ${kopr} not found`);
    }

    const [updatedProduct] = await db
      .update(products)
      .set({ 
        ecomActive: !currentProduct.ecomActive,
        updatedAt: new Date()
      })
      .where(eq(products.kopr, kopr))
      .returning();
    return updatedProduct;
  }

  async getEcommerceCategories(): Promise<string[]> {
    const result = await db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(and(
        eq(products.active, true),
        sql`${products.category} IS NOT NULL AND ${products.category} != ''`
      ))
      .orderBy(products.category);

    return result.map(r => r.category).filter((cat): cat is string => !!cat);
  }

  async validateProductSlug(slug: string, excludeKopr?: string): Promise<boolean> {
    const conditions = [eq(products.slug, slug)];
    
    if (excludeKopr) {
      conditions.push(sql`${products.kopr} != ${excludeKopr}`);
    }

    const [existingProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(...conditions))
      .limit(1);

    return !existingProduct; // Return true if slug is available (not found)
  }

  // eCommerce Admin operations (Simple approach using priceList)
  async getEcommerceAdminProducts(filters?: {
    search?: string;
    categoria?: string;
    activo?: boolean;
  }): Promise<Array<{
    id: string;
    codigo: string;
    producto: string;
    unidad?: string;
    precio: number;
    precioOriginal?: number;
    categoria?: string;
    descripcion?: string;
    activo: boolean;
    imagenUrl?: string;
    stock?: number;
  }>> {
    // Use direct imports instead of dynamic imports
    const { priceList, ecommerceProducts } = await import('@shared/schema');
    
    // Build the main query
    let baseQuery = db
      .select({
        id: priceList.id,
        codigo: priceList.codigo,
        producto: priceList.producto,
        unidad: priceList.unidad,
        precio: priceList.canalDigital, // Use canal digital as default ecommerce price
        precioOriginal: priceList.lista,
        // eCommerce fields from join
        ecomId: ecommerceProducts.id,
        categoria: ecommerceProducts.categoria,
        descripcion: ecommerceProducts.descripcion,
        activo: ecommerceProducts.activo,
        imagenUrl: ecommerceProducts.imagenUrl,
        precioEcommerce: ecommerceProducts.precioEcommerce,
      })
      .from(priceList)
      .leftJoin(ecommerceProducts, eq(priceList.id, ecommerceProducts.priceListId));

    const conditions = [];

    // Apply search filter
    if (filters?.search && filters.search.trim() !== '') {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(or(
        sql`LOWER(${priceList.codigo}) LIKE ${searchTerm}`,
        sql`LOWER(${priceList.producto}) LIKE ${searchTerm}`
      ));
    }

    // Apply categoria filter - only if it's a specific category, not 'all'
    if (filters?.categoria && filters.categoria !== 'all' && filters.categoria.trim() !== '') {
      conditions.push(eq(ecommerceProducts.categoria, filters.categoria));
    }

    // Apply activo filter - simplified logic
    if (filters?.activo !== undefined) {
      if (filters.activo) {
        // Show products that are active: either explicitly true OR null (default active)
        conditions.push(or(
          eq(ecommerceProducts.activo, true),
          isNull(ecommerceProducts.activo)
        ));
      } else {
        // Show products that are explicitly inactive
        conditions.push(eq(ecommerceProducts.activo, false));
      }
    }

    // Apply filters only if any exist
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as typeof baseQuery;
    }

    // Execute query with safety limit to prevent memory issues on large datasets
    // Current dataset: ~270 products, but this protects against future growth
    const results = await baseQuery
      .orderBy(priceList.producto)
      .limit(1000);

    return results.map(row => ({
      id: row.ecomId || row.id, // Use ecommerce ID if exists, otherwise priceList ID
      codigo: row.codigo || '',
      producto: row.producto || '',
      unidad: row.unidad || undefined,
      precio: Number(row.precioEcommerce) || Number(row.precio) || 0,
      precioOriginal: Number(row.precioOriginal) || undefined,
      categoria: row.categoria || undefined,
      descripcion: row.descripcion || undefined,
      activo: row.activo ?? true, // Default to active if not specified in ecommerceProducts
      imagenUrl: row.imagenUrl || undefined,
      stock: undefined, // TODO: Add stock integration if needed
    }));
  }

  async getEcommerceAdminCategories(): Promise<Array<{
    id: string;
    nombre: string;
    descripcion?: string;
    activa: boolean;
    productoCount: number;
  }>> {
    const { ecommerceCategories, ecommerceProducts } = await import('@shared/schema');
    
    const results = await db
      .select({
        id: ecommerceCategories.id,
        nombre: ecommerceCategories.nombre,
        descripcion: ecommerceCategories.descripcion,
        activa: ecommerceCategories.activa,
        productoCount: sql<number>`COUNT(${ecommerceProducts.id})`
      })
      .from(ecommerceCategories)
      .leftJoin(ecommerceProducts, eq(ecommerceCategories.nombre, ecommerceProducts.categoria))
      .groupBy(ecommerceCategories.id, ecommerceCategories.nombre, ecommerceCategories.descripcion, ecommerceCategories.activa)
      .orderBy(ecommerceCategories.nombre);

    return results.map(row => ({
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion || undefined,
      activa: row.activa ?? true,
      productoCount: Number(row.productoCount) || 0,
    }));
  }

  async getEcommerceAdminStats(): Promise<{
    totalProductos: number;
    productosActivos: number;
    totalCategorias: number;
    ventasMes: number;
  }> {
    const { priceList, ecommerceProducts, ecommerceCategories, salesTransactions } = await import('@shared/schema');
    
    // Get current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [productStats] = await db
      .select({
        totalProductos: sql<number>`COUNT(${priceList.id})`,
        productosActivos: sql<number>`COUNT(CASE WHEN ${ecommerceProducts.activo} = true THEN 1 END)`
      })
      .from(priceList)
      .leftJoin(ecommerceProducts, eq(priceList.id, ecommerceProducts.priceListId));

    const [categoryStats] = await db
      .select({
        totalCategorias: sql<number>`COUNT(${ecommerceCategories.id})`
      })
      .from(ecommerceCategories)
      .where(eq(ecommerceCategories.activa, true));

    const [salesStats] = await db
      .select({
        ventasMes: sql<number>`COALESCE(SUM(${salesTransactions.vanedo}), 0)`
      })
      .from(salesTransactions)
      .where(and(
        gte(salesTransactions.feemdo, startOfMonth.toISOString().split('T')[0]),
        lte(salesTransactions.feemdo, endOfMonth.toISOString().split('T')[0])
      ));

    return {
      totalProductos: Number(productStats.totalProductos) || 0,
      productosActivos: Number(productStats.productosActivos) || 0,
      totalCategorias: Number(categoryStats.totalCategorias) || 0,
      ventasMes: Number(salesStats.ventasMes) || 0,
    };
  }

  async updateEcommerceAdminProduct(id: string, updates: {
    categoria?: string;
    descripcion?: string;
    imagenUrl?: string;
    precioEcommerce?: number;
    activo?: boolean;
  }): Promise<{
    id: string;
    codigo: string;
    producto: string;
    categoria?: string;
    descripcion?: string;
    activo: boolean;
  }> {
    console.log('🏪 [STORAGE] Iniciando updateEcommerceAdminProduct:', {
      id,
      updates,
      timestamp: new Date().toISOString()
    });

    const { priceList, ecommerceProducts } = await import('@shared/schema');

    try {
      // First check if this is a priceList ID or ecommerce product ID
      console.log('🔍 [STORAGE] Buscando producto en priceList con ID:', id);
      const [priceListProduct] = await db
        .select({ id: priceList.id, codigo: priceList.codigo, producto: priceList.producto })
        .from(priceList)
        .where(eq(priceList.id, id))
        .limit(1);

      console.log('📦 [STORAGE] Producto encontrado en priceList:', priceListProduct);

      if (!priceListProduct) {
        console.error('❌ [STORAGE] Producto no encontrado en priceList con ID:', id);
        throw new Error('Product not found');
      }

      // Check if ecommerce record exists
      console.log('🔍 [STORAGE] Buscando registro ecommerce existente para priceListId:', id);
      const [existingEcomProduct] = await db
        .select()
        .from(ecommerceProducts)
        .where(eq(ecommerceProducts.priceListId, id))
        .limit(1);

      console.log('🛒 [STORAGE] Registro ecommerce existente:', existingEcomProduct);

      let ecomProduct;
      
      if (existingEcomProduct) {
        // Update existing ecommerce record
        console.log('🔄 [STORAGE] Actualizando registro ecommerce existente:', {
          existingId: existingEcomProduct.id,
          updates: {
            ...updates,
            precioEcommerce: updates.precioEcommerce?.toString(),
            updatedAt: new Date()
          }
        });

        [ecomProduct] = await db
          .update(ecommerceProducts)
          .set({
            ...updates,
            precioEcommerce: updates.precioEcommerce?.toString(),
            updatedAt: new Date()
          })
          .where(eq(ecommerceProducts.id, existingEcomProduct.id))
          .returning();

        console.log('✅ [STORAGE] Registro ecommerce actualizado:', ecomProduct);
      } else {
        // Create new ecommerce record
        console.log('➕ [STORAGE] Creando nuevo registro ecommerce:', {
          priceListId: id,
          updates: {
            ...updates,
            precioEcommerce: updates.precioEcommerce?.toString(),
          }
        });

        [ecomProduct] = await db
          .insert(ecommerceProducts)
          .values({
            priceListId: id,
            ...updates,
            precioEcommerce: updates.precioEcommerce?.toString(),
          })
          .returning();

        console.log('✅ [STORAGE] Nuevo registro ecommerce creado:', ecomProduct);
      }

      const result = {
        id: ecomProduct.id,
        codigo: priceListProduct.codigo,
        producto: priceListProduct.producto,
        categoria: ecomProduct.categoria || undefined,
        descripcion: ecomProduct.descripcion || undefined,
        activo: ecomProduct.activo ?? false,
      };

      console.log('🎉 [STORAGE] Resultado final de updateEcommerceAdminProduct:', result);
      return result;

    } catch (error: any) {
      console.error('❌ [STORAGE] Error en updateEcommerceAdminProduct:', {
        error: error.message,
        stack: error.stack,
        id,
        updates
      });
      throw error;
    }
  }

  async toggleEcommerceAdminProduct(id: string): Promise<{
    id: string;
    activo: boolean;
  }> {
    const { priceList, ecommerceProducts } = await import('@shared/schema');

    // Check if ecommerce record exists
    const [existingEcomProduct] = await db
      .select()
      .from(ecommerceProducts)
      .where(eq(ecommerceProducts.priceListId, id))
      .limit(1);

    let ecomProduct;

    if (existingEcomProduct) {
      // Toggle existing record
      [ecomProduct] = await db
        .update(ecommerceProducts)
        .set({
          activo: !existingEcomProduct.activo,
          updatedAt: new Date()
        })
        .where(eq(ecommerceProducts.id, existingEcomProduct.id))
        .returning();
    } else {
      // Create new record as active
      [ecomProduct] = await db
        .insert(ecommerceProducts)
        .values({
          priceListId: id,
          activo: true,
        })
        .returning();
    }

    return {
      id: ecomProduct.id,
      activo: ecomProduct.activo ?? false,
    };
  }

  async createEcommerceAdminCategory(data: {
    nombre: string;
    descripcion?: string;
  }): Promise<{
    id: string;
    nombre: string;
    descripcion?: string;
    activa: boolean;
  }> {
    const { ecommerceCategories } = await import('@shared/schema');

    try {
      const [newCategory] = await db
        .insert(ecommerceCategories)
        .values({
          nombre: data.nombre,
          descripcion: data.descripcion,
          activa: true,
        })
        .returning();

      return {
        id: newCategory.id,
        nombre: newCategory.nombre,
        descripcion: newCategory.descripcion || undefined,
        activa: newCategory.activa ?? false,
      };
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Ya existe una categoría con ese nombre');
      }
      throw error;
    }
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
        let product = await this.getProductBySku(row.sku);
        
        if (!product) {
          console.log(`➕ Creando nuevo producto: ${row.sku}`);
          // Crear nuevo producto (sin precio, se establece manualmente)
          product = await this.createProduct({
            kopr: row.sku, // Use SKU as KOPR for legacy compatibility
            name: row.name,
            ud02pr: row.unit2 || 'UN', // Secondary unit
            active: true
          });
          newProducts++;
        } else {
          console.log(`🔄 Actualizando producto existente: ${row.sku}`);
          // Actualizar información del producto (preservando precio)
          await this.updateProduct(product.kopr, {
            name: row.name,
            ud02pr: row.unit2 || 'UN' // Secondary unit
          });
        }

        // Actualizar stock
        console.log(`📊 Actualizando stock para ${row.sku}: Stock Físico 1: ${row.physicalStock1}, Disponible 1: ${row.availableStock1}`);
        
        const stockData = {
          kopr: product.kopr, // Use KOPR from product
          productSku: row.sku, // Compatibility field
          kosu: row.branchCode, // New field structure
          kobo: row.warehouseCode, // New field structure
          branchCode: row.branchCode, // Compatibility field
          warehouseCode: row.warehouseCode, // Compatibility field
          datosubic: row.warehouseLocation || '', // New field name
          warehouseLocation: row.warehouseLocation || '', // Compatibility field
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
          mrpr: row.mrpr || '',
          rlud: row.unitRatio?.toString() || '1'
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
        const existingProduct = await this.getProduct(row.productId);
        
        if (!existingProduct) {
          console.log(`➕ Creando nuevo producto: ${row.productId}`);
          
          // Crear nuevo producto
          await db.insert(products).values({
            kopr: row.productId,
            name: row.name,
            ud02pr: row.packagingUnitName || 'UN', // Use packaging unit name as secondary unit
            priceProduct: row.pricePerUnit ? parseFloat(row.pricePerUnit.replace(',', '.')).toString() : null,
            active: true
          });
          
          newProducts++;
        } else {
          console.log(`🔄 Actualizando producto existente: ${row.productId}`);
          
          // Actualizar producto existente (preservando precios existentes)
          const updateData: any = {
            name: row.name,
            ud02pr: row.packagingUnitName || 'UN' // Use packaging unit name as secondary unit
          };

          // Solo actualizar el precio del CSV si no hay precio establecido
          if (!existingProduct.priceProduct && row.pricePerUnit) {
            updateData.priceProduct = parseFloat(row.pricePerUnit.replace(',', '.')).toString();
          }

          await db
            .update(products)
            .set(updateData)
            .where(eq(products.kopr, row.productId));
          
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

  // Función auxiliar para obtener producto por productId (usando kopr)
  async getProductByProductId(productId: string): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.kopr, productId));
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
    const warehouseData = await db
      .select({
        code: productStock.warehouseCode,
        location: productStock.warehouseLocation,
        productCount: sql<number>`COUNT(DISTINCT ${productStock.productSku})`
      })
      .from(productStock)
      .groupBy(productStock.warehouseCode, productStock.warehouseLocation);

    return warehouseData.map(w => ({
      code: w.code,
      name: w.code, // Using code as name since we don't have warehouse names from stock data
      location: w.location || undefined,
      productCount: Number(w.productCount)
    }));
  }

  async getWarehouse(kobo: string, kosu: string): Promise<Warehouse | undefined> {
    const [warehouse] = await db
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.kobo, kobo), eq(warehouses.kosu, kosu)));
    return warehouse;
  }

  async createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse> {
    const [result] = await db
      .insert(warehouses)
      .values(warehouse)
      .returning();
    return result;
  }

  async updateWarehouse(kobo: string, kosu: string, warehouse: Partial<InsertWarehouse>): Promise<Warehouse> {
    const [result] = await db
      .update(warehouses)
      .set({ ...warehouse, updatedAt: new Date() })
      .where(and(eq(warehouses.kobo, kobo), eq(warehouses.kosu, kosu)))
      .returning();
    return result;
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
        unit1: products.ud02pr, // Secondary unit
        unit2: products.ud02pr // Secondary unit
      })
      .from(productStock)
      .leftJoin(products, eq(productStock.productSku, products.kopr))
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

  // Get available vendors in a segment that haven't been claimed yet
  async getAvailableVendorsInSegment(segment: string) {
    try {
      // Get vendors from sales_transactions in this segment that are not yet in salespeople_users
      const query = sql`
        SELECT DISTINCT 
          nokofu as salesperson_name,
          noruen as segment,
          COUNT(*) as total_transactions,
          SUM(CAST(monto as numeric)) as total_sales
        FROM sales_transactions 
        WHERE noruen = ${segment}
          AND nokofu IS NOT NULL 
          AND nokofu != ''
          AND nokofu NOT IN (
            SELECT salesperson_name 
            FROM salespeople_users 
            WHERE salesperson_name IS NOT NULL
              AND supervisor_id IS NOT NULL
          )
        GROUP BY nokofu, noruen
        ORDER BY total_sales DESC
      `;
      
      const result = await db.execute(query);
      return result.rows.map((row: any) => ({
        salespersonName: row.salesperson_name,
        segment: row.segment,
        totalTransactions: parseInt(row.total_transactions),
        totalSales: parseFloat(row.total_sales)
      }));
    } catch (error) {
      console.error("Error fetching available vendors:", error);
      throw error;
    }
  }

  // Claim a vendor (convert from sales data to user account)
  async claimVendor(data: {
    salespersonName: string;
    email: string;
    password: string;
    supervisorId: string;
    assignedSegment: string;
  }) {
    try {
      // Hash the password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Create user account in salespeople_users
      const [user] = await db
        .insert(salespeopleUsers)
        .values({
          salespersonName: data.salespersonName,
          email: data.email,
          password: hashedPassword,
          username: data.email,
          role: 'salesperson',
          isActive: true,
          supervisorId: data.supervisorId,
          assignedSegment: data.assignedSegment,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return user;
    } catch (error) {
      console.error("Error claiming vendor:", error);
      throw error;
    }
  }

  async getTopProductsByTeam(salespeopleNames: string[], limit: number = 10): Promise<Array<{
    productId: string;
    productName: string;
    totalSales: number;
    totalQuantity: number;
    salesCount: number;
  }>> {
    if (salespeopleNames.length === 0) return [];

    const results = await db
      .select({
        productId: salesTransactions.koprct,
        productName: salesTransactions.nokoprct,
        totalSales: sql<number>`SUM(${salesTransactions.monto})::numeric`,
        totalQuantity: sql<number>`SUM(${salesTransactions.caprco2})::numeric`,
        salesCount: sql<number>`COUNT(*)`,
      })
      .from(salesTransactions)
      .where(inArray(salesTransactions.nokofu, salespeopleNames))
      .groupBy(salesTransactions.koprct, salesTransactions.nokoprct)
      .orderBy(desc(sql`SUM(${salesTransactions.monto})`))
      .limit(limit);

    return results.map(r => ({
      productId: r.productId || '',
      productName: r.productName || '',
      totalSales: Number(r.totalSales) || 0,
      totalQuantity: Number(r.totalQuantity) || 0,
      salesCount: Number(r.salesCount) || 0,
    }));
  }

  async getTeamMetrics(salespeopleNames: string[]): Promise<{
    totalSales: number;
    totalTransactions: number;
    averagePerSalesperson: number;
    bestPerformer: { name: string; sales: number } | null;
    teamGrowth: number;
  }> {
    if (salespeopleNames.length === 0) {
      return {
        totalSales: 0,
        totalTransactions: 0,
        averagePerSalesperson: 0,
        bestPerformer: null,
        teamGrowth: 0
      };
    }

    // Métricas totales del equipo
    const [totalMetrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)::numeric`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(salesTransactions)
      .where(inArray(salesTransactions.nokofu, salespeopleNames));

    // Mejor performer (vendedor con más ventas)
    const bestPerformerQuery = await db
      .select({
        vendedor: salesTransactions.nokofu,
        totalSales: sql<number>`SUM(${salesTransactions.monto})::numeric`,
      })
      .from(salesTransactions)
      .where(inArray(salesTransactions.nokofu, salespeopleNames))
      .groupBy(salesTransactions.nokofu)
      .orderBy(desc(sql`SUM(${salesTransactions.monto})`))
      .limit(1);

    const bestPerformer = bestPerformerQuery.length > 0 
      ? { name: bestPerformerQuery[0].vendedor || '', sales: Number(bestPerformerQuery[0].totalSales) }
      : null;

    const totalSales = Number(totalMetrics?.totalSales) || 0;
    const totalTransactions = Number(totalMetrics?.totalTransactions) || 0;
    const averagePerSalesperson = salespeopleNames.length > 0 ? totalSales / salespeopleNames.length : 0;

    // Crecimiento del equipo (comparado con mes anterior - simplificado)
    const teamGrowth = 0; // Temporalmente 0, se puede calcular comparando con meses anteriores

    return {
      totalSales,
      totalTransactions,
      averagePerSalesperson,
      bestPerformer,
      teamGrowth
    };
  }

  // Session management - invalidate all active sessions for a user
  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      // Delete all sessions where the user ID matches in the passport data
      await db
        .delete(sessions)
        .where(sql`sess::jsonb -> 'passport' ->> 'user' = ${userId}`);
      
      console.log('[DEBUG] Successfully invalidated sessions for user:', userId);
    } catch (error) {
      console.error('[ERROR] Failed to invalidate user sessions:', error);
      throw error;
    }
  }

  // Nueva función de importación CSV basada en KOPR - Esquema simplificado
  async importProductStockFromKOPRCSV(csvData: Array<{
    KOPR: string;
    NOKOPR: string;
    UD02PR?: string;
    KOSU: string;
    KOBO: string;
    DATOSUBIC?: string;
    STFI2?: string;
  }>): Promise<{
    processedProducts: number;
    newProducts: number;
    updatedStock: number;
    newWarehouses: number;
    errors: string[];
  }> {
    console.log(`🚀 Iniciando importación KOPR de ${csvData.length} registros`);
    
    const errors: string[] = [];
    let processedProducts = 0;
    let newProducts = 0;
    let updatedStock = 0;
    let newWarehouses = 0;
    
    // Mapa para rastrear productos ya procesados (un producto por KOPR)
    const processedKOPRs = new Set<string>();

    for (const row of csvData) {
      try {
        // Validación de datos críticos
        if (!row.KOPR || row.KOPR.trim().length === 0) {
          errors.push(`KOPR vacío o inválido`);
          continue;
        }

        if (!row.NOKOPR || row.NOKOPR.trim().length === 0) {
          errors.push(`NOKOPR (nombre) vacío para KOPR ${row.KOPR}`);
          continue;
        }

        if (!row.KOSU || !row.KOBO) {
          errors.push(`KOSU (${row.KOSU}) o KOBO (${row.KOBO}) inválidos para KOPR ${row.KOPR}`);
          continue;
        }

        console.log(`📦 Procesando KOPR: ${row.KOPR} (${row.NOKOPR}) - Sucursal: ${row.KOSU}, Bodega: ${row.KOBO}`);

        // 1. Crear producto único por KOPR (solo la primera vez que aparece)
        if (!processedKOPRs.has(row.KOPR)) {
          const [existingProduct] = await db
            .select()
            .from(products)
            .where(eq(products.kopr, row.KOPR))
            .limit(1);
          
          if (!existingProduct) {
            console.log(`➕ Creando nuevo producto: ${row.KOPR} - ${row.NOKOPR}`);
            
            await db.insert(products).values({
              kopr: row.KOPR,
              name: row.NOKOPR,
              ud02pr: row.UD02PR || null, // Unidad secundaria para presentación
              priceProduct: null, // Precio se puede agregar después
              active: true
            });
            
            newProducts++;
          }
          
          processedKOPRs.add(row.KOPR);
        }

        // 2. Crear warehouse si no existe
        const existingWarehouse = await this.getWarehouse(row.KOBO, row.KOSU);
        if (!existingWarehouse) {
          console.log(`➕ Creando nueva bodega: ${row.KOBO} - Sucursal: ${row.KOSU}`);
          
          await this.createWarehouse({
            kobo: row.KOBO,
            kosu: row.KOSU,
            name: `Bodega ${row.KOBO}`,
            branchName: `Sucursal ${row.KOSU}`,
            location: row.DATOSUBIC || '',
            active: true
          });
          
          newWarehouses++;
        }

        // 3. Crear/actualizar stock por KOPR+KOBO (usando STFI2 únicamente)
        const physicalStock2 = row.STFI2 ? parseFloat(row.STFI2.replace(/,/g, '.')) : 0;

        await this.upsertProductStock({
          kopr: row.KOPR,
          productSku: row.KOPR, // Compatibilidad
          kosu: row.KOSU,
          kobo: row.KOBO,
          branchCode: row.KOSU, // Compatibilidad
          warehouseCode: row.KOBO, // Compatibilidad
          warehouseLocation: row.DATOSUBIC || '',
          datosubic: row.DATOSUBIC || '',
          physicalStock2: physicalStock2.toString(), // STFI2 - Stock en unidad secundaria como string
          availableStock2: physicalStock2.toString(),
        });

        updatedStock++;
        processedProducts++;
        
        if (processedProducts % 100 === 0) {
          console.log(`📈 Progreso: ${processedProducts} registros procesados`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando KOPR ${row.KOPR}:`, error);
        errors.push(`KOPR ${row.KOPR}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const summary = {
      processedProducts,
      newProducts,
      updatedStock,
      newWarehouses,
      errors
    };

    console.log(`🎉 Importación KOPR completada:`, summary);
    return summary;
  }

  // Segment analysis by unique clients (instead of sales volume)
  async getSegmentAnalysisByUniqueClients(startDate?: string, endDate?: string) {
    const whereConditions = [];
    if (startDate) whereConditions.push(gte(salesTransactions.feemdo, startDate));
    if (endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      whereConditions.push(lt(salesTransactions.feemdo, endDateExclusive));
    }

    const query = db
      .select({
        segment: salesTransactions.noruen,
        uniqueClients: sql<number>`COUNT(DISTINCT ${salesTransactions.nokoen})`,
      })
      .from(salesTransactions)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(salesTransactions.noruen);

    const segments = await query;
    
    // Calculate total unique clients across all segments for percentage
    const totalUniqueClients = segments.reduce((sum, segment) => sum + Number(segment.uniqueClients), 0);
    
    return segments.map(segment => ({
      segment: segment.segment || '',
      uniqueClients: Number(segment.uniqueClients),
      percentage: totalUniqueClients > 0 ? (Number(segment.uniqueClients) / totalUniqueClients) * 100 : 0
    })).sort((a, b) => b.uniqueClients - a.uniqueClients);
  }

  // Comunas analysis - sales by comuna with filters
  async getComunasAnalysis(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  }): Promise<Array<{
    comuna: string;
    totalSales: number;
    transactionCount: number;
    percentage: number;
  }>> {
    const conditions = [];

    // Add date filters
    if (filters?.startDate) {
      conditions.push(gte(salesTransactions.feemdo, filters.startDate));
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(lt(salesTransactions.feemdo, endDateExclusive));
    }

    // Add salesperson filter
    if (filters?.salesperson) {
      conditions.push(eq(salesTransactions.nokofu, filters.salesperson));
    }

    // Add segment filter
    if (filters?.segment) {
      conditions.push(eq(salesTransactions.noruen, filters.segment));
    }

    // Get total sales for percentage calculation (includes ALL transactions)
    const [totalSalesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions)
      .leftJoin(clients, eq(salesTransactions.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalSales = Number(totalSalesResult.total);

    // Get sales grouped by normalized comuna using fallback data source
    const results = await db
      .select({
        rawComuna: sql<string>`COALESCE(
          NULLIF(TRIM(${clients.comuna}), ''), 
          NULLIF(TRIM(${salesTransactions.zona}), ''),
          'Sin comuna'
        )`,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(salesTransactions)
      .leftJoin(clients, eq(salesTransactions.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`COALESCE(
        NULLIF(TRIM(${clients.comuna}), ''), 
        NULLIF(TRIM(${salesTransactions.zona}), ''),
        'Sin comuna'
      )`)
      .orderBy(sql`SUM(${salesTransactions.monto}) DESC`);

    // Normalize and group by normalized comuna names
    const normalizedMap = new Map<string, { totalSales: number; transactionCount: number }>();
    
    for (const result of results) {
      const normalizedComuna = normalizeComunaName(result.rawComuna) || 'Sin comuna';
      const existing = normalizedMap.get(normalizedComuna) || { totalSales: 0, transactionCount: 0 };
      
      normalizedMap.set(normalizedComuna, {
        totalSales: existing.totalSales + Number(result.totalSales),
        transactionCount: existing.transactionCount + Number(result.transactionCount)
      });
    }

    // Convert to array and sort by total sales
    const normalizedResults = Array.from(normalizedMap.entries())
      .map(([comuna, data]) => ({
        comuna,
        totalSales: data.totalSales,
        transactionCount: data.transactionCount,
        percentage: totalSales > 0 ? (data.totalSales / totalSales) * 100 : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    return normalizedResults;
  }

  // Region analysis - sales by region (grouped from comunas) with filters
  async getRegionAnalysis(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
  }): Promise<Array<{
    region: string;
    totalSales: number;
    transactionCount: number;
    percentage: number;
  }>> {
    const conditions = [];

    // Add date filters
    if (filters?.startDate) {
      conditions.push(gte(salesTransactions.feemdo, filters.startDate));
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(lt(salesTransactions.feemdo, endDateExclusive));
    }

    // Add salesperson filter
    if (filters?.salesperson) {
      conditions.push(eq(salesTransactions.nokofu, filters.salesperson));
    }

    // Add segment filter
    if (filters?.segment) {
      conditions.push(eq(salesTransactions.noruen, filters.segment));
    }

    // Get total sales for percentage calculation (includes ALL transactions)
    const [totalSalesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions)
      .leftJoin(clients, eq(salesTransactions.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalSales = Number(totalSalesResult.total);

    // Get sales grouped by normalized comuna using fallback data source
    const comunaResults = await db
      .select({
        rawComuna: sql<string>`COALESCE(
          NULLIF(TRIM(${clients.comuna}), ''), 
          NULLIF(TRIM(${salesTransactions.zona}), ''),
          'Sin comuna'
        )`,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(salesTransactions)
      .leftJoin(clients, eq(salesTransactions.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`COALESCE(
        NULLIF(TRIM(${clients.comuna}), ''), 
        NULLIF(TRIM(${salesTransactions.zona}), ''),
        'Sin comuna'
      )`);

    // Map comunas to regions using the new intelligent matching service
    const regionMap = new Map<string, { totalSales: number; transactionCount: number }>();
    let unknownRegionSales = 0;
    let unknownRegionCount = 0;
    
    for (const comunaData of comunaResults) {
      // Use the new ComunaRegionService for intelligent matching
      const regionMatch = await comunaRegionService.findRegion(comunaData.rawComuna);
      
      // Map regions with confidence-based handling
      const finalRegion = regionMatch.region === 'Sin región' || regionMatch.confidence < 0.6
        ? 'Sin región' 
        : regionMatch.region;
      
      if (finalRegion === 'Sin región') {
        unknownRegionSales += Number(comunaData.totalSales);
        unknownRegionCount += Number(comunaData.transactionCount);
      }
      
      const existing = regionMap.get(finalRegion) || { totalSales: 0, transactionCount: 0 };
      
      regionMap.set(finalRegion, {
        totalSales: existing.totalSales + Number(comunaData.totalSales),
        transactionCount: existing.transactionCount + Number(comunaData.transactionCount)
      });
    }

    // Convert to array and sort by total sales
    const regionResults = Array.from(regionMap.entries())
      .map(([region, data]) => ({
        region,
        totalSales: data.totalSales,
        transactionCount: data.transactionCount,
        percentage: totalSales > 0 ? (data.totalSales / totalSales) * 100 : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    // Log unknown region stats for observability
    if (unknownRegionSales > 0) {
      console.log(`📊 Regional analysis: ${unknownRegionCount} transactions (${(unknownRegionSales / totalSales * 100).toFixed(2)}%) mapped to 'Sin región'`);
    }

    return regionResults;
  }

  // Client operations implementation
  async getClients(filters?: {
    search?: string;
    segment?: string;
    salesperson?: string;
    creditStatus?: string;
    businessType?: string;
    debtStatus?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<Client & {
    totalTransactions?: number;
    totalSales?: number;
    lastTransactionDate?: string;
  }>> {
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        sql`(${clients.nokoen} ILIKE ${`%${filters.search}%`} OR ${clients.rten} ILIKE ${`%${filters.search}%`} OR ${clients.koen} ILIKE ${`%${filters.search}%`})`
      );
    }

    if (filters?.segment) {
      conditions.push(eq(clients.ruen, filters.segment));
    }

    if (filters?.businessType) {
      conditions.push(sql`${clients.gien} ILIKE ${`%${filters.businessType}%`}`);
    }

    if (filters?.debtStatus) {
      // Filter by debt status using crsd (credit balance/debt)
      switch (filters.debtStatus) {
        case 'con_deuda':
          conditions.push(sql`${clients.crsd} > 0`);
          break;
        case 'sin_deuda':
          conditions.push(sql`${clients.crsd} <= 0 OR ${clients.crsd} IS NULL`);
          break;
      }
    }

    if (filters?.entityType) {
      // Filter by entity type using tien column
      conditions.push(eq(clients.tien, filters.entityType));
    }

    if (filters?.creditStatus) {
      // Map credit status strings to actual credit logic
      switch (filters.creditStatus) {
        case 'excellent':
          conditions.push(sql`${clients.cren} > ${clients.crlt} * 0.8`);
          break;
        case 'good':
          conditions.push(sql`${clients.cren} BETWEEN ${clients.crlt} * 0.5 AND ${clients.crlt} * 0.8`);
          break;
        case 'limited':
          conditions.push(sql`${clients.cren} BETWEEN ${clients.crlt} * 0.1 AND ${clients.crlt} * 0.5`);
          break;
        case 'blocked':
          conditions.push(sql`${clients.cren} >= ${clients.crlt} OR ${clients.crsd} = 'S'`);
          break;
      }
    }

    // First get all clients with basic info
    let query = db.select().from(clients);

    // If filtering by salesperson, we need to join with sales transactions
    if (filters?.salesperson) {
      const salespersonConditions = conditions.length > 0 
        ? [...conditions, eq(salesTransactions.nokofu, filters.salesperson)]
        : [eq(salesTransactions.nokofu, filters.salesperson)];

      query = db
        .selectDistinct({
          id: clients.id,
          koen: clients.koen,
          nokoen: clients.nokoen,
          rten: clients.rten,
          dien: clients.dien,
          gien: clients.gien,
          cien: clients.cien,
          foen: clients.foen,
          email: clients.email,
          cren: clients.cren,
          crlt: clients.crlt,
          crsd: clients.crsd,
          ruen: clients.ruen,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt
        })
        .from(clients)
        .innerJoin(salesTransactions, eq(clients.nokoen, salesTransactions.nokoen))
        .where(and(...salespersonConditions)) as any;
    } else {
      query = conditions.length > 0 ? query.where(and(...conditions)) as any : query;
    }

    const clientsData = await query
      .orderBy(desc(clients.updatedAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    // Then add computed fields for each client
    const clientsWithMetrics = await Promise.all(
      clientsData.map(async (client) => {
        const [transactionCount] = await db
          .select({ count: sql`COUNT(*)`.as('count') })
          .from(salesTransactions)
          .where(eq(salesTransactions.nokoen, client.nokoen));

        const [salesData] = await db
          .select({ 
            totalSales: sql<number>`COALESCE(SUM(${salesTransactions.vabrdo}), 0)`,
            lastTransactionDate: sql<string>`MAX(${salesTransactions.feemdo})::text`
          })
          .from(salesTransactions)
          .where(eq(salesTransactions.nokoen, client.nokoen));

        return {
          ...client,
          totalTransactions: Number(transactionCount?.count || 0),
          totalSales: Number(salesData?.totalSales || 0),
          lastTransactionDate: salesData?.lastTransactionDate || undefined
        };
      })
    );

    return clientsWithMetrics;
  }

  async getClientByKoen(koen: string) {
    const result = await db
      .select()
      .from(clients)
      .where(eq(clients.koen, koen))
      .limit(1);
    
    return result[0];
  }

  async insertClient(client: InsertClient) {
    const result = await db
      .insert(clients)
      .values(client)
      .returning();
    
    return result[0];
  }

  async insertMultipleClients(clientsData: InsertClient[]) {
    if (clientsData.length === 0) return { inserted: 0, updated: 0, skipped: 0 };
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    console.log(`🚀 Starting FAST batch import of ${clientsData.length} clients`);
    
    try {
      // Get ALL existing clients in ONE query for super fast lookup (only needed columns)
      const existingClients = await db.select({
        id: clients.id,
        koen: clients.koen,
        nokoen: clients.nokoen
      }).from(clients);
      const existingByKoen = new Map(existingClients.filter(c => c.koen).map(c => [c.koen!, c]));
      const existingByName = new Map(existingClients.filter(c => c.nokoen).map(c => [c.nokoen, c]));
      
      // Separate clients into insert and update batches
      const toInsert: InsertClient[] = [];
      const toUpdate: Array<{ id: string; data: InsertClient }> = [];
      
      console.log(`📋 Analyzing ${clientsData.length} clients for duplicates...`);
      
      for (const client of clientsData) {
        try {
          // Super fast lookup using Maps (no database queries)
          const existingByKoenMatch = client.koen ? existingByKoen.get(client.koen) : null;
          const existingByNameMatch = !existingByKoenMatch && client.nokoen ? existingByName.get(client.nokoen) : null;
          const existing = existingByKoenMatch || existingByNameMatch;
          
          if (existing) {
            toUpdate.push({ id: existing.id, data: client });
          } else {
            toInsert.push(client);
          }
        } catch (error) {
          console.error(`❌ Error analyzing client ${client.nokoen}:`, error);
          skipped++;
        }
      }
      
      console.log(`📊 Analysis complete: ${toInsert.length} new, ${toUpdate.length} existing`);
      
      // Batch insert new clients (SUPER fast - 500 at a time)
      if (toInsert.length > 0) {
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(toInsert.length / BATCH_SIZE);
        
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
          
          try {
            await db.insert(clients).values(batch);
            inserted += batch.length;
            console.log(`✅ Batch ${batchNumber}/${totalBatches}: Inserted ${batch.length} clients`);
          } catch (error) {
            console.error(`❌ Error inserting batch ${batchNumber}:`, error);
            skipped += batch.length;
          }
        }
      }
      
      // Update existing clients (still fast, individual updates)
      if (toUpdate.length > 0) {
        console.log(`🔄 Updating ${toUpdate.length} existing clients...`);
        for (const { id, data } of toUpdate) {
          try {
            await db
              .update(clients)
              .set({ ...data, updatedAt: new Date() })
              .where(eq(clients.id, id));
            updated++;
          } catch (error) {
            console.error(`❌ Error updating client ${data.nokoen}:`, error);
            skipped++;
          }
        }
        console.log(`✅ Updated ${updated} existing clients`);
      }
      
    } catch (error) {
      console.error(`💥 Critical error in FAST client import:`, error);
      throw error;
    }
    
    console.log(`🎉 FAST import completed in seconds: ${inserted} new, ${updated} updated, ${skipped} errors`);
    return { inserted, updated, skipped };
  }

  async updateClient(koen: string, client: Partial<InsertClient>) {
    const result = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.koen, koen))
      .returning();
    
    return result[0];
  }

  async deleteClient(koen: string) {
    await db
      .delete(clients)
      .where(eq(clients.koen, koen));
  }

  // Task management operations implementation
  // SECURE: Role-based task access with RBAC filtering
  async getTasks(filters: {
    creatorId?: string;
    assigneeUserId?: string;
    assigneeSegments?: string[];
    status?: string;
    priority?: string;
    userRole?: string; // NEW: Role-based filtering
    userId?: string; // NEW: User ID for access control
  } = {}): Promise<Array<Task & { assignments: TaskAssignment[] }>> {
    const { creatorId, assigneeUserId, assigneeSegments, status, priority, userRole, userId } = filters;
    
    // SECURITY: Implement strict RBAC at database level
    if (userRole && userId) {
      switch (userRole) {
        case 'admin':
          // Admin gets all tasks - no additional filtering
          break;
        case 'supervisor':
          // Supervisor gets: tasks they created + tasks assigned to their team
          // This requires additional filtering which we'll implement
          break;
        case 'salesperson':
          // Salesperson gets only tasks assigned to them directly or via segment
          return this.getTasksForUser(userId, assigneeSegments || []);
        default:
          // Unknown role - deny access
          throw new Error('Unauthorized: Invalid user role');
      }
    }
    
    const conditions = [];

    if (creatorId) {
      conditions.push(eq(tasks.createdByUserId, creatorId));
    }
    if (status) {
      conditions.push(eq(tasks.status, status));
    }
    if (priority) {
      conditions.push(eq(tasks.priority, priority));
    }

    let query = db.select().from(tasks);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const allTasks = await query.orderBy(desc(tasks.createdAt));

    // Get assignments for all tasks (N+1 query - will fix with optimized method)
    const tasksWithAssignments = await Promise.all(
      allTasks.map(async (task) => {
        const assignments = await db
          .select()
          .from(taskAssignments)
          .where(eq(taskAssignments.taskId, task.id))
          .orderBy(taskAssignments.createdAt);

        return {
          ...task,
          assignments,
        };
      })
    );

    // Filter by assignee if specified
    if (assigneeUserId) {
      return tasksWithAssignments.filter(task =>
        task.assignments.some(assignment =>
          assignment.assigneeType === "user" && assignment.assigneeId === assigneeUserId
        )
      );
    }

    return tasksWithAssignments;
  }

  // OPTIMIZED: Single query with joins to prevent N+1
  async getTasksWithAssignmentsOptimized(filters: {
    status?: string;
    priority?: string;
    userRole?: string;
    userId?: string;
    assigneeSegments?: string[];
  } = {}): Promise<Array<Task & { assignments: TaskAssignment[] }>> {
    const { status, priority, userRole, userId, assigneeSegments } = filters;
    
    // SECURITY: Apply RBAC filtering at database level
    const taskConditions = [];
    const assignmentConditions = [];
    
    // Basic filtering conditions
    if (status) {
      taskConditions.push(eq(tasks.status, status));
    }
    if (priority) {
      taskConditions.push(eq(tasks.priority, priority));
    }
    
    // SECURITY: Role-based access control
    if (userRole && userId) {
      switch (userRole) {
        case 'admin':
          // Admin sees all tasks - no additional filtering
          break;
        case 'supervisor':
          // Supervisor sees: tasks they created OR tasks assigned to their team
          const supervisorConditions = [
            eq(tasks.createdByUserId, userId), // Tasks they created
          ];
          if (assigneeSegments && assigneeSegments.length > 0) {
            // Also include tasks assigned to their segments - but this is handled in the main SQL condition below
            // No need to build additional conditions here as they would be undefined
          }
          // SECURITY FIX: Use safe Drizzle ORM methods instead of string interpolation to prevent SQL injection
          if (assigneeSegments && assigneeSegments.length > 0) {
            taskConditions.push(sql`(
              ${tasks.createdByUserId} = ${userId} OR 
              EXISTS (
                SELECT 1 FROM ${taskAssignments} 
                WHERE ${taskAssignments.taskId} = ${tasks.id} 
                AND (
                  (${taskAssignments.assigneeType} = 'user' AND ${taskAssignments.assigneeId} = ${userId}) OR
                  (${taskAssignments.assigneeType} = 'segment' AND ${taskAssignments.assigneeId} = ANY(ARRAY[${sql.join(assigneeSegments.map(seg => sql`${seg}`), sql`, `)}]))
                )
              )
            )`);
          } else {
            taskConditions.push(sql`(
              ${tasks.createdByUserId} = ${userId} OR 
              EXISTS (
                SELECT 1 FROM ${taskAssignments} 
                WHERE ${taskAssignments.taskId} = ${tasks.id} 
                AND ${taskAssignments.assigneeType} = 'user' AND ${taskAssignments.assigneeId} = ${userId}
              )
            )`);
          }
          break;
        case 'salesperson':
          // SECURITY FIX: Salesperson sees only tasks assigned to them - use safe SQL 
          if (assigneeSegments && assigneeSegments.length > 0) {
            taskConditions.push(sql`
              EXISTS (
                SELECT 1 FROM ${taskAssignments} 
                WHERE ${taskAssignments.taskId} = ${tasks.id} 
                AND (
                  (${taskAssignments.assigneeType} = 'user' AND ${taskAssignments.assigneeId} = ${userId}) OR
                  (${taskAssignments.assigneeType} = 'segment' AND ${taskAssignments.assigneeId} = ANY(ARRAY[${sql.join(assigneeSegments.map(seg => sql`${seg}`), sql`, `)}]))
                )
              )
            `);
          } else {
            taskConditions.push(sql`
              EXISTS (
                SELECT 1 FROM ${taskAssignments} 
                WHERE ${taskAssignments.taskId} = ${tasks.id} 
                AND ${taskAssignments.assigneeType} = 'user' AND ${taskAssignments.assigneeId} = ${userId}
              )
            `);
          }
          break;
        default:
          throw new Error('Unauthorized: Invalid user role');
      }
    }
    
    // Build the optimized query with LEFT JOIN
    let query = db
      .select({
        // Task fields (including missing ones)
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        type: tasks.type,
        status: tasks.status,
        progress: tasks.progress,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        assignedToUserId: tasks.assignedToUserId,
        payload: tasks.payload,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        createdByUserId: tasks.createdByUserId,
        // Assignment fields (will be null if no assignments)
        assignmentId: taskAssignments.id,
        assigneeType: taskAssignments.assigneeType,
        assigneeId: taskAssignments.assigneeId,
        assignmentStatus: taskAssignments.status,
        assignmentNotes: taskAssignments.notes,
        readAt: taskAssignments.readAt,
        assignmentCreatedAt: taskAssignments.createdAt,
      })
      .from(tasks)
      .leftJoin(taskAssignments, eq(tasks.id, taskAssignments.taskId));
    
    if (taskConditions.length > 0) {
      query = query.where(and(...taskConditions)) as any;
    }
    
    const results = await query.orderBy(desc(tasks.createdAt), taskAssignments.createdAt);
    
    // Group results by task and build assignments
    const taskMap = new Map<string, Task & { assignments: TaskAssignment[] }>();
    
    results.forEach((row) => {
      if (!taskMap.has(row.id)) {
        taskMap.set(row.id, {
          id: row.id,
          title: row.title,
          description: row.description,
          type: row.type,
          status: row.status,
          progress: row.progress,
          priority: row.priority,
          dueDate: row.dueDate,
          assignedToUserId: row.assignedToUserId,
          payload: row.payload,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          createdByUserId: row.createdByUserId,
          assignments: [],
        });
      }
      
      // Add assignment if it exists
      if (row.assignmentId) {
        const task = taskMap.get(row.id)!;
        task.assignments.push({
          id: row.assignmentId,
          taskId: row.id,
          assigneeType: row.assigneeType || '',
          assigneeId: row.assigneeId || '',
          status: row.assignmentStatus,
          notes: row.assignmentNotes,
          readAt: row.readAt,
          completedAt: null, // Add missing completedAt field
          createdAt: row.assignmentCreatedAt,
        });
      }
    });
    
    return Array.from(taskMap.values());
  }

  async getTask(id: string): Promise<Task & { assignments: TaskAssignment[] } | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id));

    if (!task) return undefined;

    const assignments = await db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, task.id))
      .orderBy(taskAssignments.createdAt);

    return {
      ...task,
      assignments,
    };
  }

  async createTask(task: InsertTask, assignments: InsertTaskAssignment[]): Promise<Task> {
    const [newTask] = await db
      .insert(tasks)
      .values(task)
      .returning();

    // Add assignments
    if (assignments.length > 0) {
      const assignmentsWithTaskId = assignments.map(assignment => ({
        ...assignment,
        taskId: newTask.id,
      }));
      
      await db
        .insert(taskAssignments)
        .values(assignmentsWithTaskId);
    }

    return newTask;
  }

  async updateTask(id: string, task: Partial<InsertTask>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    // Delete assignments first (foreign key constraint)
    await db
      .delete(taskAssignments)
      .where(eq(taskAssignments.taskId, id));

    // Delete task
    await db
      .delete(tasks)
      .where(eq(tasks.id, id));
  }

  async updateAssignmentStatus(assignmentId: string, status: string, notes?: string): Promise<TaskAssignment> {
    const updates: any = {
      status,
      ...(notes && { notes }),
      ...(status === "completed" && { completedAt: new Date() }),
    };

    const [updatedAssignment] = await db
      .update(taskAssignments)
      .set(updates)
      .where(eq(taskAssignments.id, assignmentId))
      .returning();

    return updatedAssignment;
  }

  async markAssignmentRead(assignmentId: string): Promise<TaskAssignment> {
    const [updatedAssignment] = await db
      .update(taskAssignments)
      .set({ readAt: new Date() })
      .where(eq(taskAssignments.id, assignmentId))
      .returning();

    return updatedAssignment;
  }

  async getTasksForUser(userId: string, userSegments: string[]): Promise<Array<Task & { assignments: TaskAssignment[] }>> {
    // Get all task assignments for this user (direct or by segment)
    const conditions = [
      and(
        eq(taskAssignments.assigneeType, "user"),
        eq(taskAssignments.assigneeId, userId)
      )
    ];

    // Add segment conditions if user has segments
    if (userSegments.length > 0) {
      conditions.push(
        and(
          eq(taskAssignments.assigneeType, "segment"),
          inArray(taskAssignments.assigneeId, userSegments)
        )
      );
    }

    const userAssignments = await db
      .select()
      .from(taskAssignments)
      .where(sql`${conditions.map(c => sql`(${c})`).join(' OR ')}`);

    const taskIds = Array.from(new Set(userAssignments.map(a => a.taskId)));

    if (taskIds.length === 0) return [];

    // Get tasks with all their assignments
    const userTasks = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, taskIds))
      .orderBy(desc(tasks.createdAt));

    const tasksWithAssignments = await Promise.all(
      userTasks.map(async (task) => {
        const assignments = await db
          .select()
          .from(taskAssignments)
          .where(eq(taskAssignments.taskId, task.id))
          .orderBy(taskAssignments.createdAt);

        return {
          ...task,
          assignments,
        };
      })
    );

    return tasksWithAssignments;
  }

  // Personal Task Management - SECURITY: All methods filter by assignedToUserId = userId
  async createMyTask(task: InsertTaskInput, userId: string): Promise<Task> {
    // SECURITY: Automatically assign both createdByUserId and assignedToUserId to the current user
    const taskToInsert: InsertTask = {
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status || 'pendiente',
      progress: task.progress || 0,
      priority: task.priority || 'medium',
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      createdByUserId: userId, // SECURITY: Always set to current user
      assignedToUserId: userId, // SECURITY: Always assign to current user
      payload: task.payload,
    };

    const [newTask] = await db
      .insert(tasks)
      .values(taskToInsert)
      .returning();

    return newTask;
  }

  async getMyTasks(filters: {
    status?: 'pendiente' | 'en_progreso' | 'completada';
    type?: 'texto' | 'formulario' | 'visita';
    period?: 'week' | 'month';
  }, userId: string): Promise<Task[]> {
    // SECURITY: ALWAYS filter by assignedToUserId = userId
    const conditions = [eq(tasks.assignedToUserId, userId)];

    // Apply status filter
    if (filters.status) {
      conditions.push(eq(tasks.status, filters.status));
    }

    // Apply type filter
    if (filters.type) {
      conditions.push(eq(tasks.type, filters.type));
    }

    // Apply period filter based on createdAt
    if (filters.period) {
      const now = new Date();
      let startDate: Date;
      
      if (filters.period === 'week') {
        // Get start of current week (Monday)
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek;
      } else if (filters.period === 'month') {
        // Get start of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        startDate = new Date(0); // Default: all time
      }
      
      conditions.push(gte(tasks.createdAt, startDate));
    }

    const userTasks = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));

    return userTasks;
  }

  async updateMyTask(id: string, patch: Partial<Task>, userId: string): Promise<Task> {
    // SECURITY: First verify the task belongs to the current user
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.id, id),
        eq(tasks.assignedToUserId, userId)
      ));

    if (!existingTask) {
      throw new Error('Task not found or access denied');
    }

    // Whitelist allowed fields for security
    const allowedUpdates: Partial<InsertTask> = {};
    if (patch.title !== undefined) allowedUpdates.title = patch.title;
    if (patch.description !== undefined) allowedUpdates.description = patch.description;
    if (patch.status !== undefined) allowedUpdates.status = patch.status;
    if (patch.progress !== undefined) allowedUpdates.progress = patch.progress;
    if (patch.priority !== undefined) allowedUpdates.priority = patch.priority;
    if (patch.dueDate !== undefined) {
      allowedUpdates.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    }
    if (patch.payload !== undefined) allowedUpdates.payload = patch.payload;

    // Always update updatedAt
    allowedUpdates.updatedAt = new Date();

    const [updatedTask] = await db
      .update(tasks)
      .set(allowedUpdates)
      .where(and(
        eq(tasks.id, id),
        eq(tasks.assignedToUserId, userId) // SECURITY: Double-check ownership
      ))
      .returning();

    if (!updatedTask) {
      throw new Error('Task not found or access denied');
    }

    return updatedTask;
  }

  async deleteMyTask(id: string, userId: string): Promise<void> {
    // SECURITY: First verify the task belongs to the current user
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.id, id),
        eq(tasks.assignedToUserId, userId)
      ));

    if (!existingTask) {
      throw new Error('Task not found or access denied');
    }

    // Delete the task (no assignments to worry about for personal tasks)
    const result = await db
      .delete(tasks)
      .where(and(
        eq(tasks.id, id),
        eq(tasks.assignedToUserId, userId) // SECURITY: Double-check ownership
      ));

    // No need to check result.count for delete operations in Drizzle
  }

  async getMyTaskSummary(filters: {
    period?: 'week' | 'month';
  }, userId: string): Promise<{
    statusCounts: {
      pendiente: number;
      en_progreso: number;
      completada: number;
    };
    typeCounts: {
      texto: number;
      formulario: number;
      visita: number;
    };
    montoEstimadoTotal: number;
  }> {
    // SECURITY: ALWAYS filter by assignedToUserId = userId
    const baseConditions = [eq(tasks.assignedToUserId, userId)];

    // Apply period filter if specified
    if (filters.period) {
      const now = new Date();
      let startDate: Date;
      
      if (filters.period === 'week') {
        // Get start of current week (Monday)
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek;
      } else if (filters.period === 'month') {
        // Get start of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        startDate = new Date(0); // Default: all time
      }
      
      baseConditions.push(gte(tasks.createdAt, startDate));
    }

    // Get all tasks for the user in the specified period
    const userTasks = await db
      .select()
      .from(tasks)
      .where(and(...baseConditions));

    // Calculate status counts
    const statusCounts = {
      pendiente: 0,
      en_progreso: 0,
      completada: 0,
    };

    // Calculate type counts
    const typeCounts = {
      texto: 0,
      formulario: 0,
      visita: 0,
    };

    // Calculate montoEstimado total for 'formulario' tasks with 'compras_potenciales' payload
    let montoEstimadoTotal = 0;

    userTasks.forEach(task => {
      // Count by status
      if (task.status === 'pendiente') statusCounts.pendiente++;
      else if (task.status === 'en_progreso') statusCounts.en_progreso++;
      else if (task.status === 'completada') statusCounts.completada++;

      // Count by type
      if (task.type === 'texto') typeCounts.texto++;
      else if (task.type === 'formulario') typeCounts.formulario++;
      else if (task.type === 'visita') typeCounts.visita++;

      // Sum montoEstimado for formulario tasks with compras_potenciales
      if (task.type === 'formulario' && task.payload) {
        try {
          const payload = typeof task.payload === 'string' 
            ? JSON.parse(task.payload) 
            : task.payload;
          
          if (payload.formKey === 'compras_potenciales' && payload.montoEstimado) {
            montoEstimadoTotal += payload.montoEstimado;
          }
        } catch (error) {
          // Ignore invalid JSON payload
          console.warn('Invalid JSON payload in task:', task.id);
        }
      }
    });

    return {
      statusCounts,
      typeCounts,
      montoEstimadoTotal,
    };
  }

  // Order management operations
  async createOrder(order: InsertOrder): Promise<Order> {
    // Generate unique order number
    const orderCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders);
    
    const orderNumber = `ORD-${new Date().getFullYear()}-${String((Number(orderCount[0]?.count) || 0) + 1).padStart(6, '0')}`;
    
    const [newOrder] = await db
      .insert(orders)
      .values({
        ...order,
        orderNumber,
      })
      .returning();

    return newOrder;
  }

  async getOrders(filters: {
    createdBy?: string;
    status?: string;
    clientName?: string;
    userRole?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Order[]> {
    const { createdBy, status, clientName, userRole, userId, limit = 50, offset = 0 } = filters;
    
    const conditions = [];
    
    // Role-based access control
    if (userRole && userId) {
      switch (userRole) {
        case 'admin':
        case 'supervisor':
          // Admin and supervisor can see all orders
          break;
        case 'salesperson':
          // Salesperson can only see orders they created
          conditions.push(eq(orders.createdBy, userId));
          break;
        default:
          // Unknown role - deny access
          throw new Error('Unauthorized: Invalid user role');
      }
    }
    
    if (createdBy) {
      conditions.push(eq(orders.createdBy, createdBy));
    }
    if (status) {
      conditions.push(eq(orders.status, status));
    }
    if (clientName) {
      conditions.push(sql`${orders.clientName} ILIKE ${'%' + clientName + '%'}`);
    }

    let query = db.select().from(orders);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const ordersList = await query
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    return ordersList;
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));

    return order;
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<void> {
    // Delete order items first (foreign key constraint)
    await db
      .delete(orderItems)
      .where(eq(orderItems.orderId, id));

    // Delete order
    await db
      .delete(orders)
      .where(eq(orders.id, id));
  }

  // Order items operations
  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db
      .insert(orderItems)
      .values(orderItem)
      .returning();

    return newOrderItem;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(orderItems.createdAt);

    return items;
  }

  async updateOrderItem(id: string, orderItem: Partial<InsertOrderItem>): Promise<OrderItem> {
    const [updatedOrderItem] = await db
      .update(orderItems)
      .set(orderItem)
      .where(eq(orderItems.id, id))
      .returning();

    return updatedOrderItem;
  }

  async deleteOrderItem(id: string): Promise<void> {
    await db
      .delete(orderItems)
      .where(eq(orderItems.id, id));
  }

  // Price List operations
  async getPriceList(filters?: {
    search?: string;
    unidad?: string;
    tipoProducto?: string;
    color?: string;
    limit?: number;
    offset?: number;
  }): Promise<PriceList[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    let query = db.select().from(priceList);
    
    // Build where conditions
    const conditions = [];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        sql`${priceList.codigo} ILIKE ${searchTerm} OR 
            ${priceList.producto} ILIKE ${searchTerm}`
      );
    }
    
    if (filters?.unidad) {
      conditions.push(eq(priceList.unidad, filters.unidad));
    }
    
    if (filters?.tipoProducto) {
      conditions.push(sql`${priceList.producto} ILIKE ${'%' + filters.tipoProducto + '%'}`);
    }
    
    if (filters?.color) {
      conditions.push(sql`${priceList.producto} ILIKE ${'%' + filters.color + '%'}`);
    }
    
    // Apply conditions dynamically
    if (conditions.length > 0) {
      let combinedCondition = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        combinedCondition = sql`${combinedCondition} AND ${conditions[i]}`;
      }
      query = query.where(combinedCondition) as any;
    }
    
    const items = await query
      .orderBy(priceList.codigo)
      .limit(limit)
      .offset(offset);
      
    return items;
  }

  async getPriceListCount(search?: string, unidad?: string, tipoProducto?: string, color?: string): Promise<number> {
    let query = db.select({ count: sql`count(*)`.as('count') }).from(priceList);
    
    // Build where conditions
    const conditions = [];
    
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        sql`${priceList.codigo} ILIKE ${searchTerm} OR 
            ${priceList.producto} ILIKE ${searchTerm}`
      );
    }
    
    if (unidad) {
      conditions.push(eq(priceList.unidad, unidad));
    }
    
    if (tipoProducto) {
      conditions.push(sql`${priceList.producto} ILIKE ${'%' + tipoProducto + '%'}`);
    }
    
    if (color) {
      conditions.push(sql`${priceList.producto} ILIKE ${'%' + color + '%'}`);
    }
    
    // Apply conditions dynamically
    if (conditions.length > 0) {
      let combinedCondition = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        combinedCondition = sql`${combinedCondition} AND ${conditions[i]}`;
      }
      query = query.where(combinedCondition) as any;
    }
    
    const [result] = await query;
    return Number(result.count) || 0;
  }

  async getAvailableUnits(): Promise<string[]> {
    const result = await db
      .selectDistinct({ unidad: priceList.unidad })
      .from(priceList)
      .where(sql`${priceList.unidad} IS NOT NULL AND ${priceList.unidad} != ''`)
      .orderBy(priceList.unidad);
    
    return result.map(row => row.unidad).filter(Boolean) as string[];
  }

  async getProductTypes(): Promise<string[]> {
    // Extract product types from product names using common keywords
    const result = await db
      .select({ producto: priceList.producto })
      .from(priceList)
      .where(sql`${priceList.producto} IS NOT NULL AND ${priceList.producto} != ''`);
    
    // Extract common product type keywords
    const productTypes = new Set<string>();
    const keywords = ['ESMALTE', 'PINTURA', 'BARNIZ', 'SELLADOR', 'DILUYENTE', 'THINNER', 'MASILLA', 'PRIMER', 'ANTICORROSIVO', 'LACA', 'FONDO', 'CONVERTIDOR', 'REMOVEDOR'];
    
    result.forEach(row => {
      const producto = row.producto?.toUpperCase() || '';
      keywords.forEach(keyword => {
        if (producto.includes(keyword)) {
          productTypes.add(keyword);
        }
      });
    });
    
    return Array.from(productTypes).sort();
  }

  async getAllProductColors(): Promise<string[]> {
    // Extract colors from product names using common color keywords
    const result = await db
      .select({ producto: priceList.producto })
      .from(priceList)
      .where(sql`${priceList.producto} IS NOT NULL AND ${priceList.producto} != ''`);
    
    // Extract common color keywords
    const productColors = new Set<string>();
    const colors = ['BLANCO', 'NEGRO', 'ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'GRIS', 'CAFE', 'MARRON', 'NARANJA', 'ROSA', 'VIOLETA', 'MORADO', 'CELESTE', 'BEIGE', 'CREMA', 'DORADO', 'PLATEADO', 'TRANSPARENTE', 'INCOLORO'];
    
    result.forEach(row => {
      const producto = row.producto?.toUpperCase() || '';
      colors.forEach(color => {
        if (producto.includes(color)) {
          productColors.add(color);
        }
      });
    });
    
    return Array.from(productColors).sort();
  }

  async getPriceListById(id: string): Promise<PriceList | undefined> {
    const [item] = await db
      .select()
      .from(priceList)
      .where(eq(priceList.id, id));
      
    return item;
  }

  async getPriceListByCodigo(codigo: string): Promise<PriceList | undefined> {
    const [item] = await db
      .select()
      .from(priceList)
      .where(eq(priceList.codigo, codigo));
      
    return item;
  }

  async createPriceListItem(item: InsertPriceListInput): Promise<PriceList> {
    const [newItem] = await db
      .insert(priceList)
      .values(item)
      .returning();
      
    return newItem;
  }

  async createMultiplePriceListItems(items: InsertPriceListInput[]): Promise<void> {
    if (items.length === 0) return;
    
    // Process in batches to avoid too large queries
    const batchSize = 100;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await db.insert(priceList).values(batch);
    }
  }

  async updatePriceListItem(id: string, updates: Partial<InsertPriceListInput>): Promise<PriceList> {
    const [updatedItem] = await db
      .update(priceList)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(priceList.id, id))
      .returning();
      
    return updatedItem;
  }

  async deletePriceListItem(id: string): Promise<void> {
    await db
      .delete(priceList)
      .where(eq(priceList.id, id));
  }

  async deleteAllPriceListItems(): Promise<void> {
    await db.delete(priceList);
  }

  // Quote operations
  async createQuote(quote: InsertQuote): Promise<Quote> {
    // Generate quote number
    const quoteNumber = `Q-${Date.now()}`;
    
    const [newQuote] = await db
      .insert(quotes)
      .values({
        ...quote,
        quoteNumber,
      })
      .returning();
      
    return newQuote;
  }

  async getQuotes(filters?: {
    createdBy?: string;
    status?: string;
    clientName?: string;
    limit?: number;
    offset?: number;
  }): Promise<Quote[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    let query = db.select().from(quotes);
    
    const conditions = [];
    if (filters?.createdBy) {
      conditions.push(eq(quotes.createdBy, filters.createdBy));
    }
    if (filters?.status) {
      conditions.push(eq(quotes.status, filters.status));
    }
    if (filters?.clientName) {
      conditions.push(sql`${quotes.clientName} ILIKE ${'%' + filters.clientName + '%'}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const result = await query
      .orderBy(desc(quotes.createdAt))
      .limit(limit)
      .offset(offset);
      
    return result;
  }

  async getQuoteById(id: string): Promise<Quote | undefined> {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, id));
      
    return quote;
  }

  async updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote> {
    const [updatedQuote] = await db
      .update(quotes)
      .set({ ...quote, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
      
    return updatedQuote;
  }

  async deleteQuote(id: string): Promise<void> {
    // First delete all quote items
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
    
    // Then delete the quote
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  // Quote items operations
  async createQuoteItem(quoteItem: InsertQuoteItemInput): Promise<QuoteItem> {
    // Calculate totalPrice from quantity and unitPrice to ensure data consistency
    const quantity = typeof quoteItem.quantity === 'string' ? parseFloat(quoteItem.quantity) : quoteItem.quantity;
    const unitPrice = typeof quoteItem.unitPrice === 'string' ? parseFloat(quoteItem.unitPrice) : quoteItem.unitPrice;
    const totalPrice = quantity * unitPrice;
    
    const [newItem] = await db
      .insert(quoteItems)
      .values({
        ...quoteItem,
        totalPrice: totalPrice.toString(), // Ensure totalPrice is calculated and provided
      })
      .returning();
      
    return newItem;
  }

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    const result = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId))
      .orderBy(desc(quoteItems.createdAt));
      
    return result;
  }

  async updateQuoteItem(id: string, quoteItem: Partial<InsertQuoteItem>): Promise<QuoteItem> {
    // Calculate totalPrice if quantity or unitPrice are provided
    let updatedData = { ...quoteItem };
    if (quoteItem.quantity !== undefined && quoteItem.unitPrice !== undefined) {
      const quantity = typeof quoteItem.quantity === 'string' ? parseFloat(quoteItem.quantity) : quoteItem.quantity;
      const unitPrice = typeof quoteItem.unitPrice === 'string' ? parseFloat(quoteItem.unitPrice) : quoteItem.unitPrice;
      updatedData.totalPrice = (quantity * unitPrice).toString();
    } else if (quoteItem.quantity !== undefined || quoteItem.unitPrice !== undefined) {
      // If only one is updated, fetch the current item to get the other value
      const currentItem = await this.getQuoteItemById(id);
      if (currentItem) {
        const quantity = quoteItem.quantity !== undefined 
          ? (typeof quoteItem.quantity === 'string' ? parseFloat(quoteItem.quantity) : quoteItem.quantity)
          : parseFloat(currentItem.quantity);
        const unitPrice = quoteItem.unitPrice !== undefined 
          ? (typeof quoteItem.unitPrice === 'string' ? parseFloat(quoteItem.unitPrice) : quoteItem.unitPrice)
          : parseFloat(currentItem.unitPrice);
        updatedData.totalPrice = (quantity * unitPrice).toString();
      }
    }
    
    const [updatedItem] = await db
      .update(quoteItems)
      .set(updatedData)
      .where(eq(quoteItems.id, id))
      .returning();
      
    return updatedItem;
  }

  async deleteQuoteItem(id: string): Promise<void> {
    await db
      .delete(quoteItems)
      .where(eq(quoteItems.id, id));
  }

  async getQuoteItemById(id: string): Promise<QuoteItem | undefined> {
    const [item] = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.id, id));
      
    return item;
  }

  // Quote to Order conversion
  async convertQuoteToOrder(quoteId: string, userId: string): Promise<Order> {
    // Get the quote and its items
    const quote = await this.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }

    const items = await this.getQuoteItems(quoteId);

    // Create the order
    const order = await this.createOrder({
      clientName: quote.clientName,
      clientId: quote.clientId,
      orderNumber: `ORD-${Date.now()}`, // Generate order number
      createdBy: userId,
      status: 'draft',
      priority: 'medium',
      notes: `Converted from quote ${quote.quoteNumber}. Original notes: ${quote.notes || 'N/A'}`,
      totalAmount: quote.total,
    });

    // Convert quote items to order items
    for (const item of items) {
      await this.createOrderItem({
        orderId: order.id,
        productName: item.productName,
        productCode: item.productCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        notes: item.notes,
      });
    }

    // Update quote status to converted
    await this.updateQuote(quoteId, { status: 'converted' });

    return order;
  }

  // Store operations
  async getStoreConfig(): Promise<StoreConfig | null> {
    try {
      const [config] = await db.select().from(storeConfig).limit(1);
      return config || null;
    } catch (error) {
      console.error('Error fetching store config:', error);
      return null;
    }
  }

  async getStoreBanners(): Promise<StoreBanner[]> {
    try {
      const banners = await db
        .select()
        .from(storeBanners)
        .where(eq(storeBanners.activo, true))
        .orderBy(storeBanners.orden);
      return banners;
    } catch (error) {
      console.error('Error fetching store banners:', error);
      return [];
    }
  }

  // ==============================================
  // NVV (Notas de Ventas Pendientes) Operations
  // ==============================================

  async importNvvFromCsv(nvvData: InsertNvvPendingSales[], importBatch: string): Promise<NvvImportResult> {
    const result: NvvImportResult = {
      success: true,
      totalRows: nvvData.length,
      successfulImports: 0,
      errors: [],
      importBatch,
    };

    try {
      for (let i = 0; i < nvvData.length; i++) {
        const data = nvvData[i];
        try {
          await db.insert(nvvPendingSales).values({
            ...data,
            importBatch,
            importedAt: new Date(),
          });
          result.successfulImports++;
        } catch (error) {
          console.error(`Error importing NVV row ${i + 1}:`, error);
          result.errors.push({
            row: i + 1,
            message: error instanceof Error ? error.message : 'Error desconocido',
            data: data,
          });
        }
      }

      if (result.errors.length > 0) {
        result.success = result.successfulImports > 0;
      }

    } catch (error) {
      console.error('Error during NVV import:', error);
      result.success = false;
      result.errors.push({
        row: 0,
        message: 'Error general durante la importación',
      });
    }

    return result;
  }

  async getNvvPendingSales(options: {
    status?: string;
    salesperson?: string;
    segment?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<NvvPendingSales[]> {
    try {
      let query = db.select().from(nvvPendingSales);

      const conditions = [];

      if (options.status) {
        conditions.push(eq(nvvPendingSales.status, options.status));
      }

      if (options.salesperson) {
        conditions.push(eq(nvvPendingSales.salesperson, options.salesperson));
      }

      if (options.segment) {
        conditions.push(eq(nvvPendingSales.segment, options.segment));
      }

      if (options.startDate) {
        conditions.push(gte(nvvPendingSales.commitmentDate, options.startDate.toISOString().split('T')[0]));
      }

      if (options.endDate) {
        conditions.push(lte(nvvPendingSales.commitmentDate, options.endDate.toISOString().split('T')[0]));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(desc(nvvPendingSales.commitmentDate));

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.offset(options.offset);
      }

      const results = await query;
      return results;
    } catch (error) {
      console.error('Error fetching NVV pending sales:', error);
      return [];
    }
  }

  async getNvvSummaryMetrics(options: {
    startDate?: Date;
    endDate?: Date;
    salesperson?: string;
    segment?: string;
  } = {}): Promise<{
    totalAmount: number;
    totalQuantity: number;
    pendingCount: number;
    confirmedCount: number;
    deliveredCount: number;
    cancelledCount: number;
  }> {
    try {
      const conditions = [];

      if (options.startDate) {
        conditions.push(gte(nvvPendingSales.commitmentDate, options.startDate.toISOString().split('T')[0]));
      }

      if (options.endDate) {
        conditions.push(lte(nvvPendingSales.commitmentDate, options.endDate.toISOString().split('T')[0]));
      }

      if (options.salesperson) {
        conditions.push(eq(nvvPendingSales.salesperson, options.salesperson));
      }

      if (options.segment) {
        conditions.push(eq(nvvPendingSales.segment, options.segment));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select({
          totalAmount: sql<number>`COALESCE(SUM(${nvvPendingSales.totalAmount}), 0)`,
          totalQuantity: sql<number>`COALESCE(SUM(${nvvPendingSales.quantity}), 0)`,
          pendingCount: sql<number>`COALESCE(SUM(CASE WHEN ${nvvPendingSales.status} = 'pending' THEN 1 ELSE 0 END), 0)`,
          confirmedCount: sql<number>`COALESCE(SUM(CASE WHEN ${nvvPendingSales.status} = 'confirmed' THEN 1 ELSE 0 END), 0)`,
          deliveredCount: sql<number>`COALESCE(SUM(CASE WHEN ${nvvPendingSales.status} = 'delivered' THEN 1 ELSE 0 END), 0)`,
          cancelledCount: sql<number>`COALESCE(SUM(CASE WHEN ${nvvPendingSales.status} = 'cancelled' THEN 1 ELSE 0 END), 0)`,
        })
        .from(nvvPendingSales)
        .where(whereClause);

      return results[0] || {
        totalAmount: 0,
        totalQuantity: 0,
        pendingCount: 0,
        confirmedCount: 0,
        deliveredCount: 0,
        cancelledCount: 0,
      };
    } catch (error) {
      console.error('Error fetching NVV summary metrics:', error);
      return {
        totalAmount: 0,
        totalQuantity: 0,
        pendingCount: 0,
        confirmedCount: 0,
        deliveredCount: 0,
        cancelledCount: 0,
      };
    }
  }

  async updateNvvStatus(id: string, status: string): Promise<boolean> {
    try {
      const [updated] = await db
        .update(nvvPendingSales)
        .set({ 
          status, 
          updatedAt: new Date() 
        })
        .where(eq(nvvPendingSales.id, id))
        .returning();

      return !!updated;
    } catch (error) {
      console.error('Error updating NVV status:', error);
      return false;
    }
  }

  async deleteNvvBatch(importBatch: string): Promise<boolean> {
    try {
      await db
        .delete(nvvPendingSales)
        .where(eq(nvvPendingSales.importBatch, importBatch));

      return true;
    } catch (error) {
      console.error('Error deleting NVV batch:', error);
      return false;
    }
  }

  // Get unique comunas that don't match any region (for diagnostics)
  async getUnmatchedComunas(): Promise<Array<{
    comuna: string;
    transactionCount: number;
    totalSales: number;
  }>> {
    try {
      // Get sales grouped by comuna with fallback data source
      const comunaResults = await db
        .select({
          rawComuna: sql<string>`COALESCE(
            NULLIF(TRIM(${clients.comuna}), ''), 
            NULLIF(TRIM(${salesTransactions.zona}), ''),
            'Sin comuna'
          )`,
          totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
          transactionCount: sql<number>`COUNT(*)`,
        })
        .from(salesTransactions)
        .leftJoin(clients, eq(salesTransactions.nokoen, clients.nokoen))
        .groupBy(sql`COALESCE(
          NULLIF(TRIM(${clients.comuna}), ''), 
          NULLIF(TRIM(${salesTransactions.zona}), ''),
          'Sin comuna'
        )`)
        .orderBy(sql`COUNT(*) DESC`); // Sort by transaction count

      // Return only the raw data without normalization
      // The actual region matching will be done by the ComunaRegionService
      return comunaResults.map(result => ({
        comuna: result.rawComuna,
        transactionCount: Number(result.transactionCount),
        totalSales: Number(result.totalSales)
      }));
    } catch (error) {
      console.error('Error getting unmatched comunas:', error);
      return [];
    }
  }

}

export const storage = new DatabaseStorage();
