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
  fileUploads,
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
  obras,
  type Obra,
  type InsertObra,
  type Task,
  type InsertTask,
  type InsertTaskInput,
  type TaskAssignment,
  type InsertTaskAssignment,
  type Order,
  type InsertOrder,
  type UpdateOrderInput,
  type AddOrderItemInput,
  type UpdateOrderItemInput,
  type OrderItem,
  type InsertOrderItem,
  calculateOrderTotals,
  type PriceList,
  type InsertPriceList,
  type InsertPriceListInput,
  type Quote,
  type InsertQuote,
  type UpdateQuoteInput,
  type AddQuoteItemInput,
  type UpdateQuoteItemInput,
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
  visitasTecnicas,
  contactosVisita,
  productosEvaluados,
  evaluacionesTecnicas,
  reclamos,
  firmasDigitales,
  evidencias,
  type VisitaTecnica,
  type InsertVisitaTecnica,
  type ContactoVisita,
  type InsertContactoVisita,
  type ProductoEvaluado,
  type InsertProductoEvaluado,
  type EvaluacionTecnica,
  type InsertEvaluacionTecnica,
  type Reclamo,
  type InsertReclamo,
  type FirmaDigital,
  type InsertFirmaDigital,
  type Evidencia,
  type InsertEvidencia,
  type FileUpload,
  type InsertFileUpload,
  // Tintometría tables
  pigments,
  bases,
  envases,
  colores,
  recetas,
  parametros,
  type Pigment,
  type InsertPigment,
  type Base,
  type InsertBase,
  type Envase,
  type InsertEnvase,
  type Color,
  type InsertColor,
  type Receta,
  type InsertReceta,
  type Parametro,
  type InsertParametro,
  // Reclamos Generales tables
  reclamosGenerales,
  reclamosGeneralesPhotos,
  reclamosGeneralesResolucionPhotos,
  reclamosGeneralesHistorial,
  type ReclamoGeneral,
  type InsertReclamoGeneral,
  type ReclamoGeneralPhoto,
  type InsertReclamoGeneralPhoto,
  type ReclamoGeneralResolucionPhoto,
  type InsertReclamoGeneralResolucionPhoto,
  type ReclamoGeneralHistorial,
  type InsertReclamoGeneralHistorial,
  // Marketing module tables
  presupuestoMarketing,
  solicitudesMarketing,
  inventarioMarketing,
  hitosMarketing,
  type PresupuestoMarketing,
  type InsertPresupuestoMarketing,
  type SolicitudMarketing,
  type InsertSolicitudMarketing,
  type InventarioMarketing,
  type InsertInventarioMarketing,
  type HitoMarketing,
  type InsertHitoMarketing,
  // Gastos empresariales
  gastosEmpresariales,
  type GastoEmpresarial,
  type InsertGastoEmpresarial,
  // Promesas de compra
  promesasCompra,
  type PromesaCompra,
  type InsertPromesaCompra,
  // Staging tables and fact_ventas
  stgMaeedo,
  stgMaeddo,
  stgMaeen,
  stgMaepr,
  stgMaeven,
  stgTabbo,
  stgTabpp,
  factVentas,
  type FactVentas,
  type InsertFactVentas,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, and, gte, lte, lt, ne, inArray, or, isNull, isNotNull, ilike, count } from "drizzle-orm";
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
      transactionCount: number;
      averageOrderValue: number;
      percentage: number;
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
  
  getAvailablePeriods(): Promise<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>;
  
  getYearlyTotals(year: number): Promise<{
    currentYearTotal: number;
    previousYearTotal: number;
    comparisonYear: number;
    comparisonDate: string;
    isYTD: boolean;
  }>;
  
  getBestYearHistorical(): Promise<{
    bestYear: number;
    bestYearTotal: number;
  }>;
  
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
  getSimpleClients(): Promise<Array<{ id: string; nokoen: string; koen: string }>>;
  getClientsForDropdown(): Promise<Array<{ id: string; nokoen: string; koen: string }>>;
  getProductsForDropdown(): Promise<Array<{ id: string; kopr: string; name: string; ud02pr: string }>>;
  searchClientsByName(searchTerm: string): Promise<Array<{ id: string; nokoen: string; koen: string }>>;
  
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
    salesFrequency: number; // days between sales (average)
    daysSinceLastSale: number; // actual days since last sale
    lastSaleDate: string | null; // date of last sale
  }>;
  getSalespersonClients(salespersonName: string, period?: string, filterType?: string, segment?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    lastSale: string;
    daysSinceLastSale: number;
  }>>;
  getSalespersonSegments(salespersonName: string, period?: string, filterType?: string): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
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
    groupId?: string | null;
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
  
  // eCommerce Product Groups operations
  createProductGroup(data: InsertEcommerceProductGroupInput): Promise<EcommerceProductGroup>;
  getProductGroups(filters?: {
    search?: string;
    categoria?: string;
    activo?: boolean;
  }): Promise<Array<EcommerceProductGroup & {
    variantCount?: number;
    mainVariant?: EcommerceProduct | null;
  }>>;
  getProductGroup(id: string): Promise<EcommerceProductGroup | undefined>;
  getProductGroupWithVariants(id: string): Promise<{
    group: EcommerceProductGroup;
    variants: Array<EcommerceProduct & { 
      priceListProduct?: any;
    }>;
  } | null>;
  updateProductGroup(id: string, data: UpdateEcommerceProductGroupInput): Promise<EcommerceProductGroup>;
  deleteProductGroup(id: string): Promise<void>;
  assignProductToGroup(productId: string, groupId: string, variantLabel?: string, isMainVariant?: boolean): Promise<void>;
  removeProductFromGroup(productId: string): Promise<void>;
  
  // eCommerce Orders operations
  createEcommerceOrder(order: any): Promise<any>;
  getEcommerceOrders(filters?: {
    clientId?: string;
    salespersonId?: string;
    status?: string;
  }): Promise<any[]>;
  
  // Notification operations
  createNotification(notification: any): Promise<any>;
  
  // Helper operations
  getAdminUserId(): Promise<string | null>;
  
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
  getClientByUserId(userId: string): Promise<Client | undefined>;
  insertClient(client: InsertClient): Promise<Client>;
  insertMultipleClients(clients: InsertClient[]): Promise<{ inserted: number; updated: number; skipped: number } | undefined>;
  // SIMPLE and RELIABLE client import - identical to order system
  insertMultipleClientsSimple(clients: InsertClient[]): Promise<{ inserted: number; updated: number; skipped: number }>;
  updateClient(koen: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(koen: string): Promise<void>;

  // Obras operations
  getObras(clienteId?: string): Promise<Obra[]>;
  getObra(id: string): Promise<Obra | undefined>;
  createObra(obra: InsertObra): Promise<Obra>;
  updateObra(id: string, obra: Partial<InsertObra>): Promise<Obra>;
  deleteObra(id: string): Promise<void>;

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
  updateAssignmentStatus(assignmentId: string, status: string, notes?: string, evidenceImages?: string[]): Promise<TaskAssignment>;
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
  getOrderItemById(id: string): Promise<OrderItem | undefined>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order>;
  deleteOrder(id: string): Promise<void>;
  
  // Order items operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  updateOrderItem(id: string, orderItem: Partial<InsertOrderItem>): Promise<OrderItem>;
  deleteOrderItem(id: string): Promise<void>;
  
  // Enhanced Order operations with items CRUD
  getOrderWithItems(id: string): Promise<(Order & { items: OrderItem[] }) | undefined>;
  addOrderItem(orderId: string, item: AddOrderItemInput): Promise<OrderItem>;
  updateOrderItemById(itemId: string, updates: Partial<InsertOrderItem>): Promise<OrderItem>;
  deleteOrderItemById(itemId: string): Promise<void>;
  recalculateOrderTotals(orderId: string): Promise<Order>;

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
  
  // Enhanced Quote operations with items CRUD
  getQuoteWithItems(id: string): Promise<(Quote & { items: QuoteItem[] }) | undefined>;
  addQuoteItem(quoteId: string, item: InsertQuoteItemInput): Promise<QuoteItem>;
  updateQuoteItemById(itemId: string, updates: Partial<InsertQuoteItemInput>): Promise<QuoteItem>;
  deleteQuoteItemById(itemId: string): Promise<void>;
  recalculateQuoteTotals(quoteId: string): Promise<Quote>;
  
  // Quote to Order conversion
  convertQuoteToOrder(quoteId: string, userId: string): Promise<Order>;
  
  // Quote duplication for editing (atomic operation)
  duplicateQuote(originalQuoteId: string, userId: string): Promise<Quote>;
  
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
  
  // File Upload Registry operations
  recordFileUpload(upload: InsertFileUpload): Promise<FileUpload>;
  getLastFileUpload(fileType?: string): Promise<FileUpload | undefined>;
  getFileUploadHistory(fileType?: string, limit?: number): Promise<FileUpload[]>;

  // Reclamos Generales operations
  createReclamoGeneral(reclamo: InsertReclamoGeneral): Promise<ReclamoGeneral>;
  getReclamosGenerales(filters?: {
    vendedorId?: string;
    tecnicoId?: string;
    estado?: string;
    gravedad?: string;
    areaResponsable?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReclamoGeneral[]>;
  getReclamoGeneralById(id: string): Promise<ReclamoGeneral | undefined>;
  updateReclamoGeneral(id: string, updates: Partial<InsertReclamoGeneral>): Promise<ReclamoGeneral>;
  deleteReclamoGeneral(id: string): Promise<void>;

  // Reclamos Generales Photos operations
  createReclamoGeneralPhoto(photo: InsertReclamoGeneralPhoto): Promise<ReclamoGeneralPhoto>;
  getReclamoGeneralPhotos(reclamoId: string): Promise<ReclamoGeneralPhoto[]>;
  deleteReclamoGeneralPhoto(id: string): Promise<void>;

  // Reclamos Generales Historial operations
  createReclamoGeneralHistorial(historial: InsertReclamoGeneralHistorial): Promise<ReclamoGeneralHistorial>;
  getReclamoGeneralHistorial(reclamoId: string): Promise<ReclamoGeneralHistorial[]>;

  // Combined operations
  getReclamoGeneralWithDetails(id: string): Promise<(ReclamoGeneral & { 
    photos: ReclamoGeneralPhoto[];
    historial: ReclamoGeneralHistorial[];
  }) | undefined>;
  
  // Asignar técnico y cambiar estado
  assignTecnicoToReclamo(id: string, tecnicoId: string, tecnicoName: string, userId: string, userName: string): Promise<ReclamoGeneral>;
  
  // Cambiar estado del reclamo
  updateReclamoGeneralEstado(id: string, nuevoEstado: string, userId: string, userName: string, notas?: string): Promise<ReclamoGeneral>;
  
  // Derivar a laboratorio o producción
  derivarReclamoGeneralLaboratorio(id: string, userId: string, userName: string): Promise<ReclamoGeneral>;
  derivarReclamoGeneralProduccion(id: string, userId: string, userName: string): Promise<ReclamoGeneral>;
  
  // Validación técnica
  validarReclamoTecnico(
    id: string, 
    procede: boolean, 
    areaResponsable: string, 
    notas: string | undefined,
    userId: string, 
    userName: string
  ): Promise<ReclamoGeneral>;
  
  // Informes
  updateInformeLaboratorio(id: string, informe: string, userId: string, userName: string): Promise<ReclamoGeneral>;
  updateInformeProduccion(id: string, informe: string, userId: string, userName: string): Promise<ReclamoGeneral>;
  updateInformeTecnico(id: string, informe: string, userId: string, userName: string): Promise<ReclamoGeneral>;
  
  // Resolución laboratorio con evidencia (DEPRECATED - usar updateResolucionArea)
  updateResolucionLaboratorio(id: string, informe: string, categoriaResponsable: string, photos: Array<{ photoUrl: string; description?: string }>, userId: string, userName: string): Promise<ReclamoGeneral | null>;
  getReclamoGeneralResolucionPhotos(reclamoId: string): Promise<any[]>;
  
  // Resolución genérica para cualquier área responsable
  updateResolucionArea(id: string, resolucionDescripcion: string, photos: Array<{ photoUrl: string; description?: string }>, userId: string, userName: string, userRole: string): Promise<ReclamoGeneral | null>;
  
  // Cerrar reclamo
  cerrarReclamoGeneral(id: string, userId: string, userName: string, notas?: string, photos?: Array<{ photoUrl: string; description?: string }>): Promise<ReclamoGeneral>;

  // ==================================================================================
  // MARKETING MODULE operations
  // ==================================================================================
  
  // Presupuesto Marketing operations
  createPresupuestoMarketing(presupuesto: InsertPresupuestoMarketing): Promise<PresupuestoMarketing>;
  getPresupuestoMarketing(mes: number, anio: number): Promise<PresupuestoMarketing | undefined>;
  updatePresupuestoMarketing(id: string, presupuesto: Partial<InsertPresupuestoMarketing>): Promise<PresupuestoMarketing>;
  
  // Solicitudes Marketing operations
  createSolicitudMarketing(solicitud: InsertSolicitudMarketing): Promise<SolicitudMarketing>;
  getSolicitudesMarketing(filters?: {
    mes?: number;
    anio?: number;
    estado?: string;
    supervisorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SolicitudMarketing[]>;
  getSolicitudMarketingById(id: string): Promise<SolicitudMarketing | undefined>;
  getSolicitudesMarketingByUrgency(supervisorId: string, urgencia: string): Promise<SolicitudMarketing[]>;
  updateSolicitudMarketing(id: string, updates: Partial<InsertSolicitudMarketing>): Promise<SolicitudMarketing>;
  deleteSolicitudMarketing(id: string): Promise<void>;
  
  // Cambiar estado de solicitud
  updateSolicitudMarketingEstado(id: string, nuevoEstado: string, motivoRechazo?: string, monto?: number, pdfPresupuesto?: string): Promise<SolicitudMarketing>;
  
  // Métricas de marketing
  getMarketingMetrics(mes: number, anio: number): Promise<{
    presupuestoTotal: number;
    presupuestoUtilizado: number;
    presupuestoDisponible: number;
    totalSolicitudes: number;
    solicitudesPorEstado: {
      solicitado: number;
      en_proceso: number;
      completado: number;
      rechazado: number;
    };
  }>;

  // Inventario Marketing operations
  createInventarioMarketing(item: InsertInventarioMarketing): Promise<InventarioMarketing>;
  getInventarioMarketing(filters?: {
    search?: string;
    estado?: string;
    limit?: number;
    offset?: number;
  }): Promise<InventarioMarketing[]>;
  getInventarioMarketingById(id: string): Promise<InventarioMarketing | undefined>;
  updateInventarioMarketing(id: string, updates: Partial<InsertInventarioMarketing>): Promise<InventarioMarketing>;
  deleteInventarioMarketing(id: string): Promise<void>;
  getInventarioMarketingSummary(): Promise<{
    totalItems: number;
    stockBajo: number;
    valorTotal: number;
  }>;

  // ==================================================================================
  // INVENTORY operations
  // ==================================================================================
  
  getInventory(filters?: {
    search?: string;
    warehouse?: string;
  }): Promise<any[]>;
  
  getInventorySummary(filters?: {
    search?: string;
    warehouse?: string;
  }): Promise<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    lowStock: number;
  }>;
  
  getWarehouses(): Promise<{ code: string; name: string }[]>;

  // ==================================================================================
  // GASTOS EMPRESARIALES operations
  // ==================================================================================
  
  createGastoEmpresarial(gasto: InsertGastoEmpresarial): Promise<GastoEmpresarial>;
  getGastosEmpresariales(filters?: {
    userId?: string;
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    categoria?: string;
    limit?: number;
    offset?: number;
  }): Promise<GastoEmpresarial[]>;
  getGastoEmpresarialById(id: string): Promise<GastoEmpresarial | undefined>;
  updateGastoEmpresarial(id: string, updates: Partial<InsertGastoEmpresarial>): Promise<GastoEmpresarial>;
  deleteGastoEmpresarial(id: string): Promise<void>;
  aprobarGastoEmpresarial(id: string, supervisorId: string): Promise<GastoEmpresarial>;
  rechazarGastoEmpresarial(id: string, supervisorId: string, comentario: string): Promise<GastoEmpresarial>;
  getGastosEmpresarialesSummary(filters?: {
    userId?: string;
    mes?: number;
    anio?: number;
  }): Promise<{
    totalGastos: number;
    totalAprobados: number;
    totalPendientes: number;
    totalRechazados: number;
    montoPendiente: number;
    montoAprobado: number;
  }>;
  getGastosEmpresarialesByCategoria(filters?: {
    userId?: string;
    mes?: number;
    anio?: number;
  }): Promise<Array<{
    categoria: string;
    total: number;
    cantidad: number;
  }>>;
  getGastosEmpresarialesByUser(filters?: {
    mes?: number;
    anio?: number;
  }): Promise<Array<{
    userId: string;
    userName: string;
    total: number;
    cantidad: number;
  }>>;

  // ==================================================================================
  // PROMESAS DE COMPRA operations
  // ==================================================================================
  
  createPromesaCompra(promesa: InsertPromesaCompra): Promise<PromesaCompra>;
  getPromesasCompra(filters?: {
    vendedorId?: string;
    clienteId?: string;
    semana?: string;
    anio?: number;
    limit?: number;
    offset?: number;
  }): Promise<PromesaCompra[]>;
  getPromesaCompraById(id: string): Promise<PromesaCompra | undefined>;
  updatePromesaCompra(id: string, updates: Partial<InsertPromesaCompra>): Promise<PromesaCompra>;
  deletePromesaCompra(id: string): Promise<void>;
  getPromesasConCumplimiento(filters?: {
    vendedorId?: string;
    semana?: string;
    anio?: number;
  }): Promise<Array<{
    promesa: PromesaCompra;
    ventasReales: number;
    cumplimiento: number;
    estado: 'cumplido' | 'superado' | 'medianamente_cumplido' | 'cumplido_parcialmente' | 'no_cumplido';
  }>>;

  // ==================================================================================
  // ETL operations
  // ==================================================================================
  
  getRunningETLExecution(etlName: string): Promise<any | undefined>;
  cancelETLExecution(executionId: string, cancelledBy: string): Promise<void>;
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
    gdvSales: number;
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
    // totalSales EXCLUDES TIDO='GDV' to avoid double counting
    // gdvSales is calculated separately for TIDO = 'GDV' transactions only
    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CASE WHEN ${salesTransactions.tido} != 'GDV' THEN ${salesTransactions.monto} ELSE 0 END), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
        totalOrders: sql<number>`COUNT(DISTINCT ${salesTransactions.nudo})`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
        activeCustomers: sql<number>`COUNT(DISTINCT ${salesTransactions.nokoen})`,
        gdvSales: sql<number>`COALESCE(SUM(CASE WHEN ${salesTransactions.tido} = 'GDV' THEN ${salesTransactions.monto} ELSE 0 END), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause);

    return {
      totalSales: Number(metrics.totalSales),
      totalTransactions: Number(metrics.totalTransactions),
      totalOrders: Number(metrics.totalOrders),
      totalUnits: Number(metrics.totalUnits),
      activeCustomers: Number(metrics.activeCustomers),
      gdvSales: Number(metrics.gdvSales),
    };
  }

  async getYearlyTotals(year: number): Promise<{
    currentYearTotal: number;
    previousYearTotal: number;
    comparisonYear: number;
    comparisonDate: string;
    isYTD: boolean;
  }> {
    const today = new Date();
    const currentCalendarYear = today.getFullYear();
    const previousYear = year - 1;
    
    // Determine if we're looking at the current year (for YTD) or a historical year
    const isCurrentYear = year === currentCalendarYear;
    
    let requestedYearStart: string;
    let requestedYearEnd: string;
    let previousYearStart: string;
    let previousYearEnd: string;
    
    if (isCurrentYear) {
      // Year-to-date comparison: current year up to today vs last year up to same date
      requestedYearStart = `${year}-01-01`;
      requestedYearEnd = today.toISOString().split('T')[0]; // Today's date
      
      previousYearStart = `${previousYear}-01-01`;
      const sameDayLastYear = new Date(today);
      sameDayLastYear.setFullYear(previousYear);
      
      // Handle leap year edge case: if today is Feb 29 and previous year is not a leap year,
      // setFullYear will roll to March 1. Adjust to Feb 28 in that case.
      if (today.getMonth() === 1 && today.getDate() === 29 && sameDayLastYear.getMonth() === 2) {
        sameDayLastYear.setMonth(1, 28); // February 28
      }
      
      previousYearEnd = sameDayLastYear.toISOString().split('T')[0];
    } else {
      // Historical year: compare full year to full previous year
      requestedYearStart = `${year}-01-01`;
      requestedYearEnd = `${year}-12-31`;
      
      previousYearStart = `${previousYear}-01-01`;
      previousYearEnd = `${previousYear}-12-31`;
    }

    // Get requested year total (excluding GDV)
    const [requestedYearMetrics] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions)
      .where(
        and(
          gte(salesTransactions.feemdo, requestedYearStart),
          lte(salesTransactions.feemdo, requestedYearEnd),
          ne(salesTransactions.tido, 'GDV')
        )
      );

    // Get previous year total (excluding GDV) - same period
    const [previousYearMetrics] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions)
      .where(
        and(
          gte(salesTransactions.feemdo, previousYearStart),
          lte(salesTransactions.feemdo, previousYearEnd),
          ne(salesTransactions.tido, 'GDV')
        )
      );

    return {
      currentYearTotal: Number(requestedYearMetrics.total),
      previousYearTotal: Number(previousYearMetrics.total),
      comparisonYear: previousYear,
      comparisonDate: isCurrentYear ? today.toISOString().split('T')[0] : `${year}-12-31`,
      isYTD: isCurrentYear,
    };
  }

  async getBestYearHistorical(): Promise<{
    bestYear: number;
    bestYearTotal: number;
  }> {
    // Get sales by year (excluding GDV)
    const yearlyTotals = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${salesTransactions.feemdo})`,
        total: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
      })
      .from(salesTransactions)
      .where(ne(salesTransactions.tido, 'GDV'))
      .groupBy(sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo})`)
      .orderBy(sql`COALESCE(SUM(${salesTransactions.monto}), 0) DESC`)
      .limit(1);

    if (yearlyTotals.length === 0) {
      return {
        bestYear: new Date().getFullYear(),
        bestYearTotal: 0,
      };
    }

    return {
      bestYear: Number(yearlyTotals[0].year),
      bestYearTotal: Number(yearlyTotals[0].total),
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
      sql`nokofu IS NOT NULL AND nokofu != ''`,
      sql`tido != 'GDV'`
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
    
    // Get period total sales (exclude GDV to match dashboard metrics)
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(monto AS NUMERIC)), 0)`,
      })
      .from(sql`${salesTransactions} ${whereClause}`);
    
    const results = await db
      .select({
        salesperson: sql<string>`nokofu`,
        totalSales: sql<number>`COALESCE(SUM(CAST(monto AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(sql`${salesTransactions} ${whereClause}`)
      .groupBy(sql`nokofu`)
      .orderBy(sql`SUM(CAST(monto AS NUMERIC)) DESC`)
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
      transactionCount: number;
      averageOrderValue: number;
      percentage: number;
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
    
    // Get period total sales using MONTO (to match dashboard metrics)
    // Exclude GDV to be consistent with getSalesMetrics
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${salesTransactions.tido} != 'GDV' THEN ${salesTransactions.monto} ELSE 0 END), 0)`,
      })
      .from(salesTransactions)
      .where(whereClause);
    
    const periodTotal = Number(totalResult.total);
    
    // For products, filter only transactions with product name and exclude GDV
    const productConditions = [
      sql`${salesTransactions.nokoprct} IS NOT NULL AND ${salesTransactions.nokoprct} != ''`,
      sql`${salesTransactions.tido} != 'GDV'`
    ];
    
    if (whereClause) {
      productConditions.push(whereClause);
    }
    
    const productWhereClause = sql.join(productConditions, sql` AND `);
    
    // For products, sum by individual product lines using MONTO
    const results = await db
      .select({
        productName: salesTransactions.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(${salesTransactions.monto}), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${salesTransactions.caprco2}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        uniqueOrders: sql<number>`COUNT(DISTINCT ${salesTransactions.nudo})`,
      })
      .from(salesTransactions)
      .where(productWhereClause)
      .groupBy(salesTransactions.nokoprct)
      .orderBy(sql`SUM(${salesTransactions.monto}) DESC`)
      .limit(limit);

    return {
      items: results.map(r => {
        const totalSales = Number(r.totalSales);
        const uniqueOrders = Number(r.uniqueOrders) || 1;
        return {
          productName: r.productName || '',
          totalSales: totalSales,
          totalUnits: Number(r.totalUnits),
          transactionCount: Number(r.transactionCount),
          averageOrderValue: totalSales / uniqueOrders,
          percentage: periodTotal > 0 ? (totalSales / periodTotal) * 100 : 0,
        };
      }),
      periodTotalSales: periodTotal,
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
      sql`nokoen IS NOT NULL AND nokoen != ''`,
      sql`tido != 'GDV'`
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
    
    // Get period total sales (exclude GDV to match dashboard metrics)
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(monto AS NUMERIC)), 0)`,
      })
      .from(sql`${salesTransactions} ${whereClause}`);
    
    const results = await db
      .select({
        clientName: sql<string>`nokoen`,
        totalSales: sql<number>`COALESCE(SUM(CAST(monto AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(sql`${salesTransactions} ${whereClause}`)
      .groupBy(sql`nokoen`)
      .orderBy(sql`SUM(CAST(monto AS NUMERIC)) DESC`)
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

  async getAvailablePeriods(): Promise<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }> {
    // Get unique months with data
    const monthResults = await db
      .select({
        yearMonth: sql<string>`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM')`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.feemdo} IS NOT NULL`)
      .groupBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM') DESC`);

    // Get unique years with data
    const yearResults = await db
      .select({
        year: sql<string>`EXTRACT(YEAR FROM ${salesTransactions.feemdo})::text`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.feemdo} IS NOT NULL`)
      .groupBy(sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) DESC`);

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                       "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const months = monthResults.map((r: any) => {
      const [year, month] = r.yearMonth.split('-');
      const monthName = monthNames[parseInt(month) - 1];
      return {
        value: r.yearMonth,
        label: `${monthName} ${year}`
      };
    });

    const years = yearResults.map((r: any) => ({
      value: r.year,
      label: r.year
    }));

    return { months, years };
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

  async getSimpleClients(): Promise<Array<{ id: string; nokoen: string; koen: string }>> {
    const result = await db
      .select({
        id: clients.id,
        nokoen: clients.nokoen,
        koen: clients.koen
      })
      .from(clients)
      .orderBy(clients.nokoen);
    
    return result.map(client => ({
      id: client.id,
      nokoen: client.nokoen,
      koen: client.koen || ''
    }));
  }

  async getClientsForDropdown(): Promise<Array<{ id: string; nokoen: string; koen: string }>> {
    const result = await db
      .select({
        id: clients.id,
        nokoen: clients.nokoen,
        koen: clients.koen,
      })
      .from(clients)
      .where(sql`${clients.nokoen} IS NOT NULL`)
      .orderBy(asc(clients.nokoen))
      .limit(5000);
    
    return result as Array<{ id: string; nokoen: string; koen: string }>;
  }

  async getProductsForDropdown(): Promise<Array<{ id: string; kopr: string; name: string; ud02pr: string }>> {
    const result = await db
      .select({
        id: priceList.id,
        kopr: priceList.codigo,
        name: priceList.producto,
        ud02pr: priceList.unidad,
      })
      .from(priceList)
      .orderBy(asc(priceList.producto))
      .limit(5000);
    
    return result as Array<{ id: string; kopr: string; name: string; ud02pr: string }>;
  }

  async searchClientsByName(searchTerm: string): Promise<Array<{ id: string; nokoen: string; koen: string }>> {
    const searchPattern = `%${searchTerm}%`;
    const result = await db
      .select({
        id: clients.id,
        nokoen: clients.nokoen,
        koen: clients.koen,
      })
      .from(clients)
      .where(
        sql`${clients.nokoen} ILIKE ${searchPattern} OR ${clients.koen} ILIKE ${searchPattern}`
      )
      .orderBy(asc(clients.nokoen))
      .limit(50);
    
    return result as Array<{ id: string; nokoen: string; koen: string }>;
  }

  // Sales data for goals comparison
  async getGlobalSalesForPeriod(period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${salesTransactions.tido} != 'GDV' THEN CAST(${salesTransactions.monto} AS DECIMAL) ELSE 0 END), 0)`
      })
      .from(salesTransactions)
      .where(sql`TO_CHAR(${salesTransactions.feemdo}, 'YYYY-MM') = ${period}`)
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getSegmentSalesForPeriod(segment: string, period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${salesTransactions.tido} != 'GDV' THEN CAST(${salesTransactions.monto} AS DECIMAL) ELSE 0 END), 0)`
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
        total: sql<number>`COALESCE(SUM(CASE WHEN ${salesTransactions.tido} != 'GDV' THEN CAST(${salesTransactions.monto} AS DECIMAL) ELSE 0 END), 0)`
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
    daysSinceLastSale: number;
    lastSaleDate: string | null;
  }> {
    const conditions = [
      eq(salesTransactions.nokofu, salespersonName),
      ne(salesTransactions.tido, 'GDV') // Exclude GDV - only show invoiced sales
    ];

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

    // Calculate sales frequency (average days between sales)
    const firstSale = new Date(result.firstSale);
    const lastSale = new Date(result.lastSale);
    const daysBetween = Math.max(1, Math.floor((lastSale.getTime() - firstSale.getTime()) / (1000 * 60 * 60 * 24)));
    const salesFrequency = result.transactionCount > 1 ? daysBetween / result.transactionCount : 0;

    // Calculate days since last sale
    const now = new Date();
    const daysSinceLastSale = result.lastSale 
      ? Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalSales: Number(result.totalSales),
      totalClients: Number(result.totalClients),
      transactionCount: Number(result.transactionCount),
      averageTicket: Number(result.averageTicket),
      salesFrequency: Number(salesFrequency.toFixed(1)),
      daysSinceLastSale: daysSinceLastSale,
      lastSaleDate: result.lastSale || null
    };
  }

  async getSalespersonClients(salespersonName: string, period?: string, filterType: string = 'month', segment?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    lastSale: string;
    daysSinceLastSale: number;
  }>> {
    const conditions = [
      eq(salesTransactions.nokofu, salespersonName),
      ne(salesTransactions.tido, 'GDV') // Exclude GDV - only show invoiced sales
    ];
    
    // Filter by segment if provided
    if (segment) {
      conditions.push(eq(salesTransactions.noruen, segment));
    }

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

  async getSalespersonSegments(salespersonName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>> {
    const conditions = [
      eq(salesTransactions.nokofu, salespersonName),
      ne(salesTransactions.tido, 'GDV'), // Exclude GDV - only show invoiced sales
      sql`${salesTransactions.noruen} IS NOT NULL AND ${salesTransactions.noruen} != ''`
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          conditions.push(sql`DATE(${salesTransactions.feemdo}) = ${period}`);
          break;
        case 'month':
          if (period === 'current-month') {
            conditions.push(sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`);
          } else if (period === 'last-month') {
            conditions.push(sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`);
          } else {
            const [year, month] = period.split('-');
            conditions.push(sql`EXTRACT(YEAR FROM ${salesTransactions.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${salesTransactions.feemdo}) = ${month}`);
          }
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(sql`DATE(${salesTransactions.feemdo}) >= ${startDate} AND DATE(${salesTransactions.feemdo}) <= ${endDate}`);
          } else if (period === 'last-30-days') {
            conditions.push(sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`);
          } else if (period === 'last-7-days') {
            conditions.push(sql`${salesTransactions.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`);
          }
          break;
      }
    }

    const result = await db
      .select({
        segment: salesTransactions.noruen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${salesTransactions.monto} AS NUMERIC)), 0)`
      })
      .from(salesTransactions)
      .where(and(...conditions))
      .groupBy(salesTransactions.noruen)
      .orderBy(sql`SUM(CAST(${salesTransactions.monto} AS NUMERIC)) DESC`);

    const totalSales = result.reduce((sum, segment) => sum + Number(segment.totalSales), 0);

    return result.map(segment => ({
      segment: segment.segment || 'Sin segmento',
      totalSales: Number(segment.totalSales),
      percentage: totalSales > 0 ? (Number(segment.totalSales) / totalSales) * 100 : 0
    }));
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
    // Get supervisors from salespeopleUsers table
    const supervisors = await db.select().from(salespeopleUsers)
      .where(eq(salespeopleUsers.role, 'supervisor'));
    
    // Get admins from users table
    const admins = await db.select().from(users)
      .where(eq(users.role, 'admin'));
    
    // Convert admins to SalespersonUser format
    const adminsSalespersonFormat = admins.map(admin => ({
      id: admin.id,
      salespersonName: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email,
      username: admin.email,
      email: admin.email,
      password: '', // Never expose password hashes
      isActive: true,
      role: 'admin' as const,
      supervisorId: null,
      assignedSegment: null,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    }));
    
    // Combine both arrays and sort by name
    return [...supervisors, ...adminsSalespersonFormat]
      .sort((a, b) => a.salespersonName.localeCompare(b.salespersonName));
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
    groupId?: string | null;
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
    groupId?: string | null;
    variantLabel?: string | null;
    isMainVariant?: boolean;
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
        groupId: ecommerceProducts.groupId,
        variantLabel: ecommerceProducts.variantLabel,
        isMainVariant: ecommerceProducts.isMainVariant,
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

    // Apply groupId filter
    if (filters?.groupId !== undefined) {
      if (filters.groupId === null) {
        // Show products with no group
        conditions.push(isNull(ecommerceProducts.groupId));
      } else {
        // Show products in specific group
        conditions.push(eq(ecommerceProducts.groupId, filters.groupId));
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
      id: row.id, // Always use priceList ID for consistency with updateEcommerceAdminProduct
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
      groupId: row.groupId || null,
      variantLabel: row.variantLabel || null,
      isMainVariant: row.isMainVariant ?? false,
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
    const { priceList, ecommerceProducts, ecommerceCategories, ecommerceOrders } = await import('@shared/schema');
    
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

    const [ordersStats] = await db
      .select({
        ventasMes: sql<number>`COUNT(${ecommerceOrders.id})`
      })
      .from(ecommerceOrders)
      .where(and(
        gte(ecommerceOrders.createdAt, startOfMonth),
        lte(ecommerceOrders.createdAt, endOfMonth)
      ));

    return {
      totalProductos: Number(productStats.totalProductos) || 0,
      productosActivos: Number(productStats.productosActivos) || 0,
      totalCategorias: Number(categoryStats.totalCategorias) || 0,
      ventasMes: Number(ordersStats.ventasMes) || 0,
    };
  }

  async updateEcommerceAdminProduct(id: string, updates: {
    categoria?: string;
    descripcion?: string;
    imagenUrl?: string;
    precioEcommerce?: number;
    activo?: boolean;
    groupId?: string | null;
    variantLabel?: string | null;
    isMainVariant?: boolean;
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

  // eCommerce Product Groups operations
  async createProductGroup(data: InsertEcommerceProductGroupInput): Promise<EcommerceProductGroup> {
    const { ecommerceProductGroups } = await import('@shared/schema');
    
    const [newGroup] = await db
      .insert(ecommerceProductGroups)
      .values(data)
      .returning();
    
    return newGroup;
  }

  async getProductGroups(filters?: {
    search?: string;
    categoria?: string;
    activo?: boolean;
  }): Promise<Array<EcommerceProductGroup & {
    variantCount?: number;
    mainVariant?: EcommerceProduct | null;
  }>> {
    const { ecommerceProductGroups, ecommerceProducts } = await import('@shared/schema');
    
    let query = db.select().from(ecommerceProductGroups);
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(ecommerceProductGroups.nombre, `%${filters.search}%`),
          ilike(ecommerceProductGroups.descripcion, `%${filters.search}%`)
        )
      );
    }
    
    if (filters?.categoria) {
      conditions.push(eq(ecommerceProductGroups.categoria, filters.categoria));
    }
    
    if (filters?.activo !== undefined) {
      conditions.push(eq(ecommerceProductGroups.activo, filters.activo));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const groups = await query.orderBy(ecommerceProductGroups.orden, ecommerceProductGroups.nombre);
    
    // Get variant count and main variant for each group
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        const variants = await db
          .select()
          .from(ecommerceProducts)
          .where(eq(ecommerceProducts.groupId, group.id));
        
        const mainVariant = variants.find(v => v.isMainVariant) || null;
        
        return {
          ...group,
          variantCount: variants.length,
          mainVariant,
        };
      })
    );
    
    return groupsWithDetails;
  }

  async getProductGroup(id: string): Promise<EcommerceProductGroup | undefined> {
    const { ecommerceProductGroups } = await import('@shared/schema');
    
    const [group] = await db
      .select()
      .from(ecommerceProductGroups)
      .where(eq(ecommerceProductGroups.id, id));
    
    return group;
  }

  async getProductGroupWithVariants(id: string): Promise<{
    group: EcommerceProductGroup;
    variants: Array<EcommerceProduct & { priceListProduct?: any }>;
  } | null> {
    const { ecommerceProductGroups, ecommerceProducts, priceList } = await import('@shared/schema');
    
    const [group] = await db
      .select()
      .from(ecommerceProductGroups)
      .where(eq(ecommerceProductGroups.id, id));
    
    if (!group) {
      return null;
    }
    
    const variants = await db
      .select()
      .from(ecommerceProducts)
      .where(eq(ecommerceProducts.groupId, id))
      .orderBy(
        desc(ecommerceProducts.isMainVariant),
        ecommerceProducts.orden,
        ecommerceProducts.variantLabel
      );
    
    // Get price list data for each variant
    const variantsWithPriceList = await Promise.all(
      variants.map(async (variant) => {
        const [priceListProduct] = await db
          .select()
          .from(priceList)
          .where(eq(priceList.id, variant.priceListId));
        
        return {
          ...variant,
          priceListProduct,
        };
      })
    );
    
    return {
      group,
      variants: variantsWithPriceList,
    };
  }

  async updateProductGroup(id: string, data: UpdateEcommerceProductGroupInput): Promise<EcommerceProductGroup> {
    const { ecommerceProductGroups } = await import('@shared/schema');
    
    const [updated] = await db
      .update(ecommerceProductGroups)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(ecommerceProductGroups.id, id))
      .returning();
    
    if (!updated) {
      throw new Error('Grupo de productos no encontrado');
    }
    
    return updated;
  }

  async deleteProductGroup(id: string): Promise<void> {
    const { ecommerceProductGroups, ecommerceProducts } = await import('@shared/schema');
    
    // First, remove groupId from all products in this group
    await db
      .update(ecommerceProducts)
      .set({
        groupId: null,
        variantLabel: null,
        isMainVariant: false,
      })
      .where(eq(ecommerceProducts.groupId, id));
    
    // Then delete the group
    await db
      .delete(ecommerceProductGroups)
      .where(eq(ecommerceProductGroups.id, id));
  }

  async assignProductToGroup(
    productId: string,
    groupId: string,
    variantLabel?: string,
    isMainVariant?: boolean
  ): Promise<void> {
    const { ecommerceProducts } = await import('@shared/schema');
    
    await db
      .update(ecommerceProducts)
      .set({
        groupId,
        variantLabel,
        isMainVariant: isMainVariant ?? false,
        updatedAt: new Date(),
      })
      .where(eq(ecommerceProducts.id, productId));
  }

  async removeProductFromGroup(productId: string): Promise<void> {
    const { ecommerceProducts } = await import('@shared/schema');
    
    await db
      .update(ecommerceProducts)
      .set({
        groupId: null,
        variantLabel: null,
        isMainVariant: false,
        updatedAt: new Date(),
      })
      .where(eq(ecommerceProducts.id, productId));
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

    // Map comunas to regions using the new intelligent matching service (parallel processing)
    const regionMap = new Map<string, { totalSales: number; transactionCount: number }>();
    let unknownRegionSales = 0;
    let unknownRegionCount = 0;
    
    // Process all comunas in parallel for better performance
    const regionMatches = await Promise.all(
      comunaResults.map(async (comunaData) => {
        const regionMatch = await comunaRegionService.findRegion(comunaData.rawComuna);
        return { comunaData, regionMatch };
      })
    );
    
    for (const { comunaData, regionMatch } of regionMatches) {
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

  async getClientsCount(filters?: {
    search?: string;
    segment?: string;
    salesperson?: string;
    creditStatus?: string;
    businessType?: string;
    debtStatus?: string;
    entityType?: string;
  }): Promise<number> {
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
      conditions.push(eq(clients.tien, filters.entityType));
    }

    if (filters?.creditStatus) {
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

    // Count query
    let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(clients);

    // If filtering by salesperson, we need to join with sales transactions
    if (filters?.salesperson) {
      const salespersonConditions = conditions.length > 0 
        ? [...conditions, eq(salesTransactions.nokofu, filters.salesperson)]
        : [eq(salesTransactions.nokofu, filters.salesperson)];

      const [result] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${clients.id})` })
        .from(clients)
        .innerJoin(salesTransactions, eq(clients.nokoen, salesTransactions.nokoen))
        .where(and(...salespersonConditions));
      
      return Number(result?.count || 0);
    } else {
      countQuery = conditions.length > 0 ? countQuery.where(and(...conditions)) as any : countQuery;
    }

    const [result] = await countQuery;
    return Number(result?.count || 0);
  }

  async getClientByKoen(koen: string) {
    const result = await db
      .select()
      .from(clients)
      .where(eq(clients.koen, koen))
      .limit(1);
    
    return result[0];
  }

  async getClientByUserId(userId: string) {
    const result = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
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

  // SIMPLE CLIENT IMPORT - Identical to successful order system
  async insertMultipleClientsSimple(clientsData: InsertClient[]): Promise<{ inserted: number; updated: number; skipped: number }> {
    if (clientsData.length === 0) return { inserted: 0, updated: 0, skipped: 0 };
    
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalSkipped = 0;
    
    console.log(`📊 Starting import of ${clientsData.length} clients in batches of ${BATCH_SIZE}`);
    
    // Process clients in batches to avoid memory issues
    for (let i = 0; i < clientsData.length; i += BATCH_SIZE) {
      const batch = clientsData.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(clientsData.length / BATCH_SIZE);
      
      // Get unique KOEN values from this batch, filtering out nulls/empty
      const batchKoens = Array.from(new Set(
        batch.map(c => c.koen).filter(koen => koen != null && koen !== '')
      ));
      
      // Check which KOEN values already exist in database  
      const existingKoens = batchKoens.length > 0 ? await db
        .select({ koen: clients.koen })
        .from(clients)
        .where(inArray(clients.koen, batchKoens)) : [];
      
      const existingKoenSet = new Set(existingKoens.map(row => row.koen).filter(Boolean));
      
      // Filter out clients with existing KOEN + handle within-batch duplicates
      const batchKoensSeen = new Set<string>();
      const newClients = batch.filter(client => {
        const clientKoen = client.koen;
        // If client has no KOEN, allow it (unique constraint handles this)
        if (!clientKoen || clientKoen === '') return true;
        
        // Check if KOEN already exists in database
        if (existingKoenSet.has(clientKoen)) return false;
        
        // Check if KOEN already seen in this batch
        if (batchKoensSeen.has(clientKoen)) return false;
        
        // Mark this KOEN as seen in this batch
        batchKoensSeen.add(clientKoen);
        return true;
      });
      
      const batchSkipped = batch.length - newClients.length;
      
      // Insert only new clients from this batch
      if (newClients.length > 0) {
        await db
          .insert(clients)
          .values(newClients);
      }
      
      totalInserted += newClients.length;
      totalSkipped += batchSkipped;
      
      console.log(`📦 Batch ${batchNumber}/${totalBatches}: Inserted ${newClients.length}, Skipped ${batchSkipped} duplicates`);
    }
    
    console.log(`✅ Import completed: ${totalInserted} new clients imported, ${totalSkipped} duplicates skipped`);
    
    return { inserted: totalInserted, updated: 0, skipped: totalSkipped };
  }

  async insertMultipleClients(clientsData: InsertClient[]) {
    if (clientsData.length === 0) return { inserted: 0, updated: 0, skipped: 0 };
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    console.log(`🚀 Starting FAST batch import of ${clientsData.length} clients`);
    
    try {
      // Get ALL existing clients in ONE query for super fast lookup (only needed columns)
      const existingClients = await this.getClientsForDuplicateCheck();
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

  // OPTIMIZED VERSION for MASSIVE files (20,000 rows x 500 columns)
  async insertMultipleClientsOptimized(clientsData: InsertClient[]) {
    if (clientsData.length === 0) return { inserted: 0, updated: 0, skipped: 0 };
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    const startTime = Date.now();
    console.log(`🚀 MASSIVE CLIENT IMPORT: Starting optimized import of ${clientsData.length} clients`);
    
    try {
      // STEP 1: Ultra-fast duplicate checking with minimal data
      const duplicateCheckStart = Date.now();
      const existingClients = await this.getClientsForDuplicateCheck();
      const existingByKoen = new Map(existingClients.filter(c => c.koen).map(c => [c.koen!, c]));
      const existingByName = new Map(existingClients.filter(c => c.nokoen).map(c => [c.nokoen, c]));
      
      const duplicateCheckTime = Date.now() - duplicateCheckStart;
      console.log(`⚡ DUPLICATE CHECK: ${existingClients.length} existing clients processed in ${duplicateCheckTime}ms`);
      
      // 🔍 DEBUG: Show sample existing client keys to verify data format
      if (existingClients.length > 0) {
        const sampleKeys = existingClients.filter(c => c.koen).slice(0, 10).map(c => c.koen);
        console.log(`🔑 SAMPLE EXISTING KOEN KEYS:`, sampleKeys);
      }
      
      // STEP 2: Memory-efficient batch analysis
      const analysisStart = Date.now();
      const toInsert: InsertClient[] = [];
      const toUpdate: Array<{ id: string; data: InsertClient }> = [];
      
      const ANALYSIS_BATCH_SIZE = 2000; // Process analysis in chunks for memory efficiency
      console.log(`📊 MASSIVE ANALYSIS: Processing ${clientsData.length} clients in chunks of ${ANALYSIS_BATCH_SIZE}...`);
      
      for (let i = 0; i < clientsData.length; i += ANALYSIS_BATCH_SIZE) {
        const chunk = clientsData.slice(i, i + ANALYSIS_BATCH_SIZE);
        const chunkNumber = Math.floor(i / ANALYSIS_BATCH_SIZE) + 1;
        const totalChunks = Math.ceil(clientsData.length / ANALYSIS_BATCH_SIZE);
        
        console.log(`🔍 Processing analysis chunk ${chunkNumber}/${totalChunks} (${chunk.length} clients)`);
        
        for (const client of chunk) {
          try {
            // Ultra-fast lookup using Maps (no database queries)
            const existingByKoenMatch = client.koen ? existingByKoen.get(client.koen) : null;
            const existingByNameMatch = !existingByKoenMatch && client.nokoen ? existingByName.get(client.nokoen) : null;
            const existing = existingByKoenMatch || existingByNameMatch;
            
            // 🔍 DEBUG: Log first few duplicate checks to verify logic
            if (chunkNumber === 1 && toInsert.length + toUpdate.length < 5) {
              console.log(`🔍 DUPLICATE CHECK SAMPLE for "${client.nokoen}":`, {
                clientKoen: client.koen,
                existingByKoenMatch: existingByKoenMatch ? 'FOUND' : 'NOT_FOUND',
                existingByNameMatch: existingByNameMatch ? 'FOUND' : 'NOT_FOUND',
                decision: existing ? 'UPDATE' : 'INSERT'
              });
            }
            
            if (existing) {
              toUpdate.push({ id: existing.id, data: client });
            } else {
              toInsert.push(client);
            }
          } catch (error) {
            console.error(`❌ Analysis error for client ${client.nokoen}:`, error);
            skipped++;
          }
        }
      }
      
      const analysisTime = Date.now() - analysisStart;
      console.log(`⚡ ANALYSIS COMPLETE: ${toInsert.length} new, ${toUpdate.length} existing in ${analysisTime}ms`);
      
      // STEP 3: MASSIVE batch inserts with database transactions for performance
      if (toInsert.length > 0) {
        const insertStart = Date.now();
        const MASSIVE_BATCH_SIZE = 1000; // Larger batches for massive imports
        const totalBatches = Math.ceil(toInsert.length / MASSIVE_BATCH_SIZE);
        
        console.log(`📦 MASSIVE INSERT: ${toInsert.length} clients in ${totalBatches} batches of ${MASSIVE_BATCH_SIZE}`);
        
        for (let i = 0; i < toInsert.length; i += MASSIVE_BATCH_SIZE) {
          const batch = toInsert.slice(i, i + MASSIVE_BATCH_SIZE);
          const batchNumber = Math.floor(i/MASSIVE_BATCH_SIZE) + 1;
          
          try {
            // 🔍 DETAILED LOGGING - Inspect batch data before insertion
            console.log(`📈 BATCH ${batchNumber} DATA INSPECTION:`, {
              batchSize: batch.length,
              sampleFields: Object.keys(batch[0] || {}).length,
              firstRecord: batch[0] ? {
                nokoen: batch[0].nokoen,
                koen: batch[0].koen,
                hasNumericFields: ['crsd', 'crch', 'crlt'].some(field => batch[0][field] !== undefined)
              } : 'NO DATA'
            });
            
            // 🔍 Check for problematic values in the batch
            const problemValues = [];
            for (let i = 0; i < Math.min(batch.length, 3); i++) {
              const client = batch[i] as any;
              if (client) {
                for (const [field, value] of Object.entries(client)) {
                  if (value && typeof value === 'string' && field.toLowerCase().includes('cr') && /[A-Za-z]/.test(value)) {
                    problemValues.push(`Client ${i}: ${field}="${value}"`);
                  }
                }
              }
            }
            if (problemValues.length > 0) {
              console.warn(`⚠️  BATCH ${batchNumber} PROBLEM VALUES:`, problemValues);
            }
            
            // Use database transaction for better performance on large inserts
            await db.transaction(async (tx) => {
              console.log(`💾 INSERTING BATCH ${batchNumber}: ${batch.length} clients...`);
              await tx.insert(clients).values(batch);
              console.log(`✅ BATCH ${batchNumber} INSERT SUCCESS`);
            });
            
            inserted += batch.length;
            const progress = ((inserted / toInsert.length) * 100).toFixed(1);
            console.log(`✅ MASSIVE BATCH ${batchNumber}/${totalBatches}: ${batch.length} clients (${progress}% complete)`);
          } catch (error) {
            console.error(`❌ MASSIVE BATCH ${batchNumber} FAILED:`, error);
            
            // 🔍 DETAILED ERROR ANALYSIS
            if (error instanceof Error) {
              console.error(`📝 ERROR DETAILS:`, {
                message: error.message,
                batchSize: batch.length,
                firstClientFields: Object.keys(batch[0] || {}).length,
                sampleData: batch[0] ? JSON.stringify(batch[0], null, 2).substring(0, 300) + '...' : 'NO DATA'
              });
              
              // Attempt individual inserts to identify problematic records
              if (batch.length <= 10) {
                console.log(`🔍 ATTEMPTING INDIVIDUAL INSERTS FOR SMALL BATCH...`);
                for (let i = 0; i < batch.length; i++) {
                  try {
                    await db.insert(clients).values([batch[i]]);
                    console.log(`✅ Individual insert ${i+1}/${batch.length} success`);
                    inserted++;
                  } catch (individualError) {
                    console.error(`❌ Individual insert ${i+1}/${batch.length} failed:`, {
                      error: individualError instanceof Error ? individualError.message : 'Unknown error',
                      clientData: JSON.stringify(batch[i], null, 2).substring(0, 200) + '...'
                    });
                    skipped++;
                  }
                }
              } else {
                skipped += batch.length;
              }
            } else {
              skipped += batch.length;
            }
          }
        }
        
        const insertTime = Date.now() - insertStart;
        console.log(`⚡ MASSIVE INSERTS COMPLETE: ${inserted} clients in ${insertTime}ms (${Math.round(inserted/(insertTime/1000))} clients/sec)`);
      }
      
      // STEP 4: Efficient batch updates
      if (toUpdate.length > 0) {
        const updateStart = Date.now();
        console.log(`🔄 MASSIVE UPDATES: Processing ${toUpdate.length} existing clients...`);
        
        const UPDATE_BATCH_SIZE = 100; // Smaller batches for updates
        const updateBatches = Math.ceil(toUpdate.length / UPDATE_BATCH_SIZE);
        
        for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH_SIZE) {
          const batch = toUpdate.slice(i, i + UPDATE_BATCH_SIZE);
          const batchNumber = Math.floor(i/UPDATE_BATCH_SIZE) + 1;
          
          try {
            // Process updates in parallel for better performance
            await Promise.all(batch.map(async ({ id, data }) => {
              await db
                .update(clients)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(clients.id, id));
            }));
            
            updated += batch.length;
            console.log(`✅ UPDATE BATCH ${batchNumber}/${updateBatches}: ${batch.length} clients`);
          } catch (error) {
            console.error(`❌ UPDATE BATCH ${batchNumber} FAILED:`, error);
            skipped += batch.length;
          }
        }
        
        const updateTime = Date.now() - updateStart;
        console.log(`⚡ MASSIVE UPDATES COMPLETE: ${updated} clients in ${updateTime}ms`);
      }
      
    } catch (error) {
      console.error(`💥 CRITICAL ERROR in MASSIVE client import:`, error);
      throw error;
    }
    
    const totalTime = Date.now() - startTime;
    const throughput = Math.round(clientsData.length / (totalTime / 1000));
    
    console.log(`🎉 MASSIVE IMPORT COMPLETE: ${totalTime}ms total`);
    console.log(`📊 FINAL STATS: ${inserted} inserted, ${updated} updated, ${skipped} errors`);
    console.log(`⚡ PERFORMANCE: ${throughput} clients/second`);
    
    // 🔍 DETAILED COMPLETION ANALYSIS
    if (skipped > 0) {
      console.warn(`⚠️  IMPORT ISSUES DETECTED:`, {
        successRate: `${((inserted + updated) / clientsData.length * 100).toFixed(1)}%`,
        errorRate: `${(skipped / clientsData.length * 100).toFixed(1)}%`,
        recommendation: skipped > clientsData.length * 0.5 ? 'CHECK DATA TYPES AND VALIDATION' : 'Minor issues detected'
      });
    }
    
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

  // Obras operations implementation
  async getObras(clienteId?: string): Promise<Obra[]> {
    if (clienteId) {
      return await db
        .select()
        .from(obras)
        .where(eq(obras.clienteId, clienteId))
        .orderBy(desc(obras.createdAt));
    }
    return await db
      .select()
      .from(obras)
      .orderBy(desc(obras.createdAt));
  }

  async getObra(id: string): Promise<Obra | undefined> {
    const [obra] = await db
      .select()
      .from(obras)
      .where(eq(obras.id, id))
      .limit(1);
    return obra;
  }

  async createObra(obra: InsertObra): Promise<Obra> {
    const [newObra] = await db
      .insert(obras)
      .values(obra)
      .returning();
    return newObra;
  }

  async updateObra(id: string, obra: Partial<InsertObra>): Promise<Obra> {
    const [updatedObra] = await db
      .update(obras)
      .set({ ...obra, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(obras.id, id))
      .returning();
    return updatedObra;
  }

  async deleteObra(id: string): Promise<void> {
    await db
      .delete(obras)
      .where(eq(obras.id, id));
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

  async updateAssignmentStatus(assignmentId: string, status: string, notes?: string, evidenceImages?: string[]): Promise<TaskAssignment> {
    const updates: any = {
      status,
      ...(notes !== undefined && { notes }),
      ...(evidenceImages !== undefined && { evidenceImages }),
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

  async getOrderItemById(id: string): Promise<OrderItem | undefined> {
    const [item] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, id));

    return item;
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

  // Enhanced Order operations with items CRUD
  async getOrderWithItems(id: string): Promise<(Order & { items: OrderItem[] }) | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));

    if (!order) {
      return undefined;
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(orderItems.createdAt);

    return { ...order, items };
  }

  async addOrderItem(orderId: string, item: AddOrderItemInput): Promise<OrderItem> {
    // Calculate total price
    const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
    const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : (item.unitPrice || 0);
    const totalPrice = quantity * unitPrice;

    const [newItem] = await db
      .insert(orderItems)
      .values({
        ...item,
        orderId,
        totalPrice: totalPrice.toString(),
      })
      .returning();

    // Recalculate order totals
    await this.recalculateOrderTotals(orderId);

    return newItem;
  }

  async updateOrderItemById(itemId: string, updates: Partial<InsertOrderItem>): Promise<OrderItem> {
    // Get the current item to find the order ID
    const [currentItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, itemId));

    if (!currentItem) {
      throw new Error('Order item not found');
    }

    // Calculate new total price if quantity or unit price changed
    let updateData = { ...updates };
    if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
      const quantity = updates.quantity !== undefined 
        ? (typeof updates.quantity === 'string' ? parseFloat(updates.quantity) : updates.quantity)
        : (typeof currentItem.quantity === 'string' ? parseFloat(currentItem.quantity) : currentItem.quantity);
      
      const unitPrice = updates.unitPrice !== undefined 
        ? (typeof updates.unitPrice === 'string' ? parseFloat(updates.unitPrice) : updates.unitPrice)
        : (typeof currentItem.unitPrice === 'string' ? parseFloat(currentItem.unitPrice) : (currentItem.unitPrice || 0));
      
      updateData.totalPrice = (quantity * unitPrice).toString();
    }

    const [updatedItem] = await db
      .update(orderItems)
      .set(updateData)
      .where(eq(orderItems.id, itemId))
      .returning();

    // Recalculate order totals
    await this.recalculateOrderTotals(currentItem.orderId);

    return updatedItem;
  }

  async deleteOrderItemById(itemId: string): Promise<void> {
    // Get the current item to find the order ID before deletion
    const [currentItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, itemId));

    if (!currentItem) {
      throw new Error('Order item not found');
    }

    await db
      .delete(orderItems)
      .where(eq(orderItems.id, itemId));

    // Recalculate order totals
    await this.recalculateOrderTotals(currentItem.orderId);
  }

  async recalculateOrderTotals(orderId: string): Promise<Order> {
    // Get all order items
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate totals using the helper function
    const itemsForCalculation = items.map(item => ({
      quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity,
      unitPrice: typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : (item.unitPrice || 0),
    }));

    const totals = calculateOrderTotals(itemsForCalculation);

    // Update order with calculated totals
    const [updatedOrder] = await db
      .update(orders)
      .set({
        subtotal: totals.subtotal.toString(),
        discount: totals.discount.toString(),
        taxAmount: totals.taxAmount.toString(),
        total: totals.total.toString(),
        totalAmount: totals.total.toString(), // Legacy field compatibility
      })
      .where(eq(orders.id, orderId))
      .returning();

    return updatedOrder;
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
  }): Promise<any[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    let query = db.select({
      quote: quotes,
      creatorEmail: users.email,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
    })
    .from(quotes)
    .leftJoin(users, eq(quotes.createdBy, users.id));
    
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
    
    // Flatten the result to include creator info directly on quote object
    return result.map(row => ({
      ...row.quote,
      creatorEmail: row.creatorEmail,
      creatorFirstName: row.creatorFirstName,
      creatorLastName: row.creatorLastName,
      creatorName: row.creatorFirstName && row.creatorLastName 
        ? `${row.creatorFirstName} ${row.creatorLastName}`
        : row.creatorEmail || 'Usuario desconocido'
    }));
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

  // Enhanced Quote operations with items CRUD
  async getQuoteWithItems(id: string): Promise<(Quote & { items: QuoteItem[] }) | undefined> {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, id));

    if (!quote) {
      return undefined;
    }

    const items = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(quoteItems.createdAt);

    return { ...quote, items };
  }

  async addQuoteItem(quoteId: string, item: InsertQuoteItemInput): Promise<QuoteItem> {
    // Calculate total price
    const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
    const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : item.unitPrice;
    const totalPrice = quantity * unitPrice;

    const [newItem] = await db
      .insert(quoteItems)
      .values({
        ...item,
        quoteId,
        totalPrice: totalPrice.toString(),
      })
      .returning();

    // Recalculate quote totals
    await this.recalculateQuoteTotals(quoteId);

    return newItem;
  }

  async updateQuoteItemById(itemId: string, updates: Partial<InsertQuoteItemInput>): Promise<QuoteItem> {
    // Get the current item to find the quote ID
    const [currentItem] = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.id, itemId));

    if (!currentItem) {
      throw new Error('Quote item not found');
    }

    // Calculate new total price if quantity or unit price changed
    let updateData = { ...updates };
    if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
      const quantity = updates.quantity !== undefined 
        ? (typeof updates.quantity === 'string' ? parseFloat(updates.quantity) : updates.quantity)
        : (typeof currentItem.quantity === 'string' ? parseFloat(currentItem.quantity) : currentItem.quantity);
      
      const unitPrice = updates.unitPrice !== undefined 
        ? (typeof updates.unitPrice === 'string' ? parseFloat(updates.unitPrice) : updates.unitPrice)
        : (typeof currentItem.unitPrice === 'string' ? parseFloat(currentItem.unitPrice) : currentItem.unitPrice);
      
      updateData.totalPrice = (quantity * unitPrice).toString();
    }

    const [updatedItem] = await db
      .update(quoteItems)
      .set(updateData)
      .where(eq(quoteItems.id, itemId))
      .returning();

    // Recalculate quote totals
    await this.recalculateQuoteTotals(currentItem.quoteId);

    return updatedItem;
  }

  async deleteQuoteItemById(itemId: string): Promise<void> {
    // Get the current item to find the quote ID before deletion
    const [currentItem] = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.id, itemId));

    if (!currentItem) {
      throw new Error('Quote item not found');
    }

    await db
      .delete(quoteItems)
      .where(eq(quoteItems.id, itemId));

    // Recalculate quote totals
    await this.recalculateQuoteTotals(currentItem.quoteId);
  }

  async recalculateQuoteTotals(quoteId: string): Promise<Quote> {
    // Get all quote items
    const items = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId));

    // Calculate totals using the helper function
    const itemsForCalculation = items.map(item => ({
      quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity,
      unitPrice: typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : item.unitPrice,
    }));

    const totals = calculateOrderTotals(itemsForCalculation); // Reuse calculation logic

    // Update quote with calculated totals
    const [updatedQuote] = await db
      .update(quotes)
      .set({
        subtotal: totals.subtotal.toString(),
        discount: totals.discount.toString(),
        taxAmount: totals.taxAmount.toString(),
        total: totals.total.toString(),
      })
      .where(eq(quotes.id, quoteId))
      .returning();

    return updatedQuote;
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

  // Quote duplication for editing (atomic operation)
  async duplicateQuote(originalQuoteId: string, userId: string): Promise<Quote> {
    const newQuote = await db.transaction(async (tx) => {
      // Get the original quote and items within the same transaction for true atomicity
      const [originalQuote] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, originalQuoteId));

      if (!originalQuote) {
        throw new Error('Quote not found');
      }

      const originalItems = await tx
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.quoteId, originalQuoteId));

      // Create new quote with same data but as draft
      const quoteNumber = `Q-${Date.now()}`;
      const [newQuote] = await tx
        .insert(quotes)
        .values({
          clientName: originalQuote.clientName,
          clientRut: originalQuote.clientRut,
          clientEmail: originalQuote.clientEmail,
          clientPhone: originalQuote.clientPhone,
          clientAddress: originalQuote.clientAddress,
          validUntil: originalQuote.validUntil,
          notes: originalQuote.notes 
            ? `Copia de cotización #${originalQuote.quoteNumber} - ${originalQuote.notes}` 
            : `Copia de cotización #${originalQuote.quoteNumber}`,
          subtotal: originalQuote.subtotal,
          total: originalQuote.total,
          taxAmount: originalQuote.taxAmount,
          discount: originalQuote.discount,
          taxRate: originalQuote.taxRate,
          status: 'draft', // Always create as draft
          createdBy: userId,
          quoteNumber,
        })
        .returning();

      // Copy all items from original quote
      if (originalItems.length > 0) {
        const newItemsData = originalItems.map(item => ({
          quoteId: newQuote.id,
          type: item.type,
          productName: item.productName,
          productCode: item.productCode,
          customSku: item.customSku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes,
        }));

        await tx.insert(quoteItems).values(newItemsData);
      }

      return { newQuote, hasItems: originalItems.length > 0 };
    });

    // Return the newly created quote (totals are already copied from original)
    return newQuote.newQuote;
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
      // STEP 1: Clear all existing NVV data before importing new data
      console.log('🗑️ Clearing existing NVV data before new import...');
      const deleteResult = await db.delete(nvvPendingSales);
      const deletedCount = deleteResult.rowCount || 0;
      console.log(`✅ Cleared ${deletedCount} existing NVV records`);

      console.log(`📦 Importing all ${nvvData.length} NVV records from CSV...`);

      const BATCH_SIZE = 100;
      let totalInserted = 0;

      // STEP 2: Process all NVV records in batches
      for (let i = 0; i < nvvData.length; i += BATCH_SIZE) {
        const batch = nvvData.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(nvvData.length / BATCH_SIZE);
        
        // Prepare batch records with calculations
        const recordsToInsert = batch.map(data => {
          // Calculate the new columns as requested
          const caprco2 = parseFloat(data.CAPRCO2?.toString() || '0');
          const caprex2 = parseFloat(data.CAPREX2?.toString() || '0');
          const ppprne = parseFloat(data.PPPRNE?.toString() || '0');
          
          const cantidadPendiente = caprco2 - caprex2;
          const totalPendiente = ppprne * cantidadPendiente;
          
          return {
            ...data,
            importBatch,
            importedAt: new Date(),
            cantidadPendiente: cantidadPendiente.toString(),
            totalPendiente: totalPendiente.toString(),
          };
        });

        try {
          // Insert ALL records directly - allowing duplicates (including NUDO and IDMAEEDO)
          const insertResult = await db
            .insert(nvvPendingSales)
            .values(recordsToInsert);
          
          // Count successful inserts
          const batchInserted = insertResult.rowCount || 0;
          
          totalInserted += batchInserted;
          result.successfulImports += batchInserted;
          
          console.log(`📦 NVV Batch ${batchNumber}/${totalBatches}: Inserted ${batchInserted} records (duplicates allowed)`);
        } catch (error) {
          console.error(`Error importing NVV batch ${batchNumber}:`, error);
          result.errors.push({
            row: i + 1,
            message: `Batch ${batchNumber} error: ` + (error instanceof Error ? error.message : 'Error desconocido'),
          });
        }
      }

      console.log(`✅ NVV Import completed: ${totalInserted} records imported (duplicates allowed)`);
      
      if (result.errors.length > 0) {
        result.success = result.successfulImports > 0;
      }

    } catch (error) {
      console.error('Error during NVV import:', error);
      result.success = false;
      result.errors.push({
        row: 0,
        message: 'Error general durante la importación: ' + (error instanceof Error ? error.message : 'Error desconocido'),
      });
    }

    return result;
  }

  async clearAllNvvData(): Promise<{ success: boolean; deletedCount: number; message: string }> {
    try {
      console.log('🗑️ Starting complete NVV data cleanup...');
      
      // Delete all records from nvv_pending_sales table
      const result = await db.delete(nvvPendingSales);
      const deletedCount = result.rowCount || 0;
      
      console.log(`✅ NVV cleanup completed: ${deletedCount} records deleted`);
      
      return {
        success: true,
        deletedCount,
        message: `Eliminados ${deletedCount} registros NVV exitosamente`
      };
    } catch (error) {
      console.error('❌ Error during NVV cleanup:', error);
      return {
        success: false,
        deletedCount: 0,
        message: 'Error al eliminar registros NVV: ' + (error instanceof Error ? error.message : 'Error desconocido')
      };
    }
  }

  async getNvvTotalSummary(): Promise<{
    totalAmount: number;
    totalRecords: number;
  }> {
    try {
      // Get total amount from totalPendiente column (direct sum)
      const totalResult = await db
        .select({
          totalAmount: sql`COALESCE(SUM(CAST(${nvvPendingSales.totalPendiente} AS NUMERIC)), 0)`,
          totalRecords: sql`COUNT(*)`
        })
        .from(nvvPendingSales);

      const result = totalResult[0];
      return {
        totalAmount: parseFloat(result.totalAmount?.toString() || '0'),
        totalRecords: parseInt(result.totalRecords?.toString() || '0')
      };
    } catch (error) {
      console.error('Error fetching NVV total summary:', error);
      return {
        totalAmount: 0,
        totalRecords: 0
      };
    }
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

      // Note: status field doesn't exist in CSV structure, skip filtering by status
      // if (options.status) {
      //   conditions.push(eq(nvvPendingSales.status, options.status));
      // }

      // Use KOFULIDO for salesperson filtering
      if (options.salesperson) {
        conditions.push(eq(nvvPendingSales.KOFULIDO, options.salesperson));
      }

      // Note: segment field doesn't exist in CSV structure, skip filtering by segment
      // if (options.segment) {
      //   conditions.push(eq(nvvPendingSales.segment, options.segment));
      // }

      // Use FEERLI for date filtering (commitment date)
      if (options.startDate) {
        conditions.push(gte(nvvPendingSales.FEERLI, options.startDate.toISOString().split('T')[0]));
      }

      if (options.endDate) {
        conditions.push(lte(nvvPendingSales.FEERLI, options.endDate.toISOString().split('T')[0]));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Order by FEERLI (commitment date) descending
      query = query.orderBy(desc(nvvPendingSales.FEERLI));

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

      // Use FEERLI for date filtering
      if (options.startDate) {
        conditions.push(gte(nvvPendingSales.FEERLI, options.startDate.toISOString().split('T')[0]));
      }

      if (options.endDate) {
        conditions.push(lte(nvvPendingSales.FEERLI, options.endDate.toISOString().split('T')[0]));
      }

      // Use KOFULIDO for salesperson filtering
      if (options.salesperson) {
        conditions.push(eq(nvvPendingSales.KOFULIDO, options.salesperson));
      }

      // Note: segment field doesn't exist in CSV structure, skip filtering by segment

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select({
          // Use pre-calculated fields from import
          totalAmount: sql<number>`COALESCE(SUM(CAST(${nvvPendingSales.totalPendiente} AS NUMERIC)), 0)`,
          totalQuantity: sql<number>`COALESCE(SUM(CAST(${nvvPendingSales.cantidadPendiente} AS NUMERIC)), 0)`,
          // Note: status columns don't exist in CSV, return basic counts
          pendingCount: sql<number>`COUNT(*)`, // All records are considered "pending" by default
          confirmedCount: sql<number>`0`,
          deliveredCount: sql<number>`0`,
          cancelledCount: sql<number>`0`,
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

  // Note: Status updates removed since CSV data doesn't include status tracking
  // NVV data is imported as-is from external system

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

  async getNvvDashboardMetrics(): Promise<{
    totalRecords: number;
    totalSalespeople: number;
    totalCompanies: number;
    totalPendingAmount: number;
    averageOrderValue: number;
    topSalespeople: Array<{
      salesperson: string;
      totalAmount: number;
      recordCount: number;
    }>;
    topCompanies: Array<{
      company: string;
      totalAmount: number;
      recordCount: number;
    }>;
    statusBreakdown: Array<{
      status: string;
      count: number;
      amount: number;
    }>;
    regionBreakdown: Array<{
      region: string;
      count: number;
      amount: number;
    }>;
  }> {
    try {
      // Basic metrics using direct CSV column names
      const totalRecordsResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(nvvPendingSales);

      const totalSalespeopleResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${nvvPendingSales.KOFULIDO})` })
        .from(nvvPendingSales)
        .where(isNotNull(nvvPendingSales.KOFULIDO));

      const totalCompaniesResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${nvvPendingSales.NOKOEN})` })
        .from(nvvPendingSales)
        .where(isNotNull(nvvPendingSales.NOKOEN));

      // Calculate pending amount using CSV fields directly
      const pendingAmountResult = await db
        .select({
          totalAmount: sql<number>`
            COALESCE(SUM(
              GREATEST(
                CAST(COALESCE(${nvvPendingSales.CAPRCO2}, '0') AS NUMERIC) - 
                CAST(COALESCE(${nvvPendingSales.CAPREX2}, '0') AS NUMERIC),
                0
              ) * CAST(COALESCE(${nvvPendingSales.PPPRNE}, '0') AS NUMERIC)
            ), 0)`,
          avgAmount: sql<number>`
            COALESCE(AVG(
              GREATEST(
                CAST(COALESCE(${nvvPendingSales.CAPRCO2}, '0') AS NUMERIC) - 
                CAST(COALESCE(${nvvPendingSales.CAPREX2}, '0') AS NUMERIC),
                0
              ) * CAST(COALESCE(${nvvPendingSales.PPPRNE}, '0') AS NUMERIC)
            ), 0)`
        })
        .from(nvvPendingSales);

      // Top salespeople using KOFULIDO
      const topSalespeopleResult = await db
        .select({
          salesperson: sql<string>`TRIM(UPPER(COALESCE(${nvvPendingSales.KOFULIDO}, 'Sin vendedor')))`,
          totalAmount: sql<number>`
            COALESCE(SUM(
              GREATEST(
                CAST(COALESCE(${nvvPendingSales.CAPRCO2}, '0') AS NUMERIC) - 
                CAST(COALESCE(${nvvPendingSales.CAPREX2}, '0') AS NUMERIC),
                0
              ) * CAST(COALESCE(${nvvPendingSales.PPPRNE}, '0') AS NUMERIC)
            ), 0)`,
          recordCount: sql<number>`COUNT(*)`
        })
        .from(nvvPendingSales)
        .where(isNotNull(nvvPendingSales.KOFULIDO))
        .groupBy(sql`TRIM(UPPER(COALESCE(${nvvPendingSales.KOFULIDO}, 'Sin vendedor')))`)
        .orderBy(sql`
          SUM(
            GREATEST(
              CAST(COALESCE(${nvvPendingSales.CAPRCO2}, '0') AS NUMERIC) - 
              CAST(COALESCE(${nvvPendingSales.CAPREX2}, '0') AS NUMERIC),
              0
            ) * CAST(COALESCE(${nvvPendingSales.PPPRNE}, '0') AS NUMERIC)
          ) DESC`)
        .limit(10);

      // Top companies using NOKOEN
      const topCompaniesResult = await db
        .select({
          company: sql<string>`TRIM(UPPER(COALESCE(${nvvPendingSales.NOKOEN}, 'Sin nombre')))`,
          totalAmount: sql<number>`
            COALESCE(SUM(
              GREATEST(
                CAST(COALESCE(${nvvPendingSales.CAPRCO2}, '0') AS NUMERIC) - 
                CAST(COALESCE(${nvvPendingSales.CAPREX2}, '0') AS NUMERIC),
                0
              ) * CAST(COALESCE(${nvvPendingSales.PPPRNE}, '0') AS NUMERIC)
            ), 0)`,
          recordCount: sql<number>`COUNT(*)`
        })
        .from(nvvPendingSales)
        .where(isNotNull(nvvPendingSales.NOKOEN))
        .groupBy(sql`TRIM(UPPER(COALESCE(${nvvPendingSales.NOKOEN}, 'Sin nombre')))`)
        .orderBy(sql`
          SUM(
            GREATEST(
              CAST(COALESCE(${nvvPendingSales.CAPRCO2}, '0') AS NUMERIC) - 
              CAST(COALESCE(${nvvPendingSales.CAPREX2}, '0') AS NUMERIC),
              0
            ) * CAST(COALESCE(${nvvPendingSales.PPPRNE}, '0') AS NUMERIC)
          ) DESC`)
        .limit(10);

      return {
        totalRecords: totalRecordsResult[0]?.count || 0,
        totalSalespeople: totalSalespeopleResult[0]?.count || 0,
        totalCompanies: totalCompaniesResult[0]?.count || 0,
        totalPendingAmount: pendingAmountResult[0]?.totalAmount || 0,
        averageOrderValue: pendingAmountResult[0]?.avgAmount || 0,
        topSalespeople: topSalespeopleResult.map(row => ({
          salesperson: row.salesperson || 'Sin vendedor',
          totalAmount: row.totalAmount || 0,
          recordCount: row.recordCount || 0,
        })),
        topCompanies: topCompaniesResult.map(row => ({
          company: row.company || 'Sin nombre',
          totalAmount: row.totalAmount || 0,
          recordCount: row.recordCount || 0,
        })),
        // Note: Status and region breakdowns removed since CSV doesn't include these fields
        statusBreakdown: [{ status: 'pending', count: totalRecordsResult[0]?.count || 0, amount: pendingAmountResult[0]?.totalAmount || 0 }],
        regionBreakdown: [],
      };
    } catch (error) {
      console.error('Error getting NVV dashboard metrics:', error);
      return {
        totalRecords: 0,
        totalSalespeople: 0,
        totalCompanies: 0,
        totalPendingAmount: 0,
        averageOrderValue: 0,
        topSalespeople: [],
        topCompanies: [],
        statusBreakdown: [],
        regionBreakdown: [],
      };
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

  // File Upload Registry operations
  async recordFileUpload(upload: InsertFileUpload): Promise<FileUpload> {
    try {
      const [result] = await db
        .insert(fileUploads)
        .values(upload)
        .returning();
      return result;
    } catch (error) {
      console.error('Error recording file upload:', error);
      throw error;
    }
  }

  async getLastFileUpload(fileType?: string): Promise<FileUpload | undefined> {
    try {
      let query = db.select().from(fileUploads).orderBy(desc(fileUploads.uploadedAt));
      
      if (fileType) {
        query = query.where(eq(fileUploads.fileType, fileType));
      }
      
      const [result] = await query.limit(1);
      return result;
    } catch (error) {
      console.error('Error getting last file upload:', error);
      return undefined;
    }
  }

  async getFileUploadHistory(fileType?: string, limit: number = 10): Promise<FileUpload[]> {
    try {
      let query = db.select().from(fileUploads).orderBy(desc(fileUploads.uploadedAt));
      
      if (fileType) {
        query = query.where(eq(fileUploads.fileType, fileType));
      }
      
      const results = await query.limit(limit);
      return results;
    } catch (error) {
      console.error('Error getting file upload history:', error);
      return [];
    }
  }

  // ==============================================
  // VISITAS TÉCNICAS METHODS
  // ==============================================

  async getEstadisticasVisitasTecnicas(options: { periodo?: string } = {}): Promise<{
    totalVisitas: number;
    visitasCompletadas: number;
    visitasBorrador: number;
    aplicacionesCorrectas: number;
    aplicacionesDeficientes: number;
    reclamosPendientes: number;
    promedioProgreso: number;
  }> {
    try {
      const { periodo = 'current' } = options;
      
      // Calculate date range based on periodo
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
      
      switch (periodo) {
        case 'current':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'last':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart - 3, 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
      
      // Get visitas in date range using SQL CAST for date comparison
      // Set endDate to end of day for inclusive range
      endDate.setHours(23, 59, 59, 999);
      
      const visitas = await db.select().from(visitasTecnicas)
        .where(
          and(
            sql`${visitasTecnicas.createdAt}::date >= ${startDate.toISOString().split('T')[0]}::date`,
            sql`${visitasTecnicas.createdAt}::date <= ${endDate.toISOString().split('T')[0]}::date`
          )
        );
      
      const totalVisitas = visitas.length;
      const visitasCompletadas = visitas.filter(v => v.estado === 'completada').length;
      const visitasBorrador = visitas.filter(v => v.estado === 'borrador').length;
      
      // Get productos evaluados for statistics
      const visitaIds = visitas.map(v => v.id);
      let aplicacionesCorrectas = 0;
      let aplicacionesDeficientes = 0;
      let reclamosPendientes = 0;
      let totalProgreso = 0;
      let productosCount = 0;
      
      if (visitaIds.length > 0) {
        const productos = await db.select().from(productosEvaluados)
          .where(inArray(productosEvaluados.visitaId, visitaIds));
        
        productosCount = productos.length;
        
        productos.forEach(p => {
          if (p.porcentajeAvance) totalProgreso += parseFloat(p.porcentajeAvance.toString());
        });
        
        // Get evaluaciones to count aplicaciones correctas/deficientes
        const evaluaciones = await db.select().from(evaluacionesTecnicas)
          .where(
            inArray(
              evaluacionesTecnicas.productoEvaluadoId,
              productos.map(p => p.id)
            )
          );
        
        evaluaciones.forEach(e => {
          if (e.aplicacion === 'correcta') aplicacionesCorrectas++;
          if (e.aplicacion === 'deficiente') aplicacionesDeficientes++;
        });
        
        // Count reclamos pendientes
        const reclamosResult = await db.select().from(reclamos)
          .where(
            and(
              inArray(reclamos.visitaId, visitaIds),
              eq(reclamos.estado, 'pendiente')
            )
          );
        reclamosPendientes = reclamosResult.length;
      }
      
      const promedioProgreso = productosCount > 0 ? Math.round(totalProgreso / productosCount) : 0;
      
      return {
        totalVisitas,
        visitasCompletadas,
        visitasBorrador,
        aplicacionesCorrectas,
        aplicacionesDeficientes,
        reclamosPendientes,
        promedioProgreso
      };
    } catch (error) {
      console.error('Error getting visitas técnicas statistics:', error);
      return {
        totalVisitas: 0,
        visitasCompletadas: 0,
        visitasBorrador: 0,
        aplicacionesCorrectas: 0,
        aplicacionesDeficientes: 0,
        reclamosPendientes: 0,
        promedioProgreso: 0
      };
    }
  }

  async getListadoVisitasTecnicas(options: {
    search?: string;
    estado?: string;
    tecnico?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Array<{
    id: string;
    nombreObra: string;
    fechaVisita: string;
    tecnico: string;
    cliente: string;
    estado: string;
    productosEvaluados: number;
    reclamosTotal: number;
  }>> {
    try {
      const { search, estado, tecnico, limit = 20, offset = 0 } = options;
      
      console.log('🔍 getListadoVisitasTecnicas - Opciones:', options);
      
      // Build base query
      let query = db
        .select({
          id: visitasTecnicas.id,
          nombreObra: visitasTecnicas.nombreObra,
          createdAt: visitasTecnicas.createdAt,
          estado: visitasTecnicas.estado,
          tecnicoId: visitasTecnicas.tecnicoId,
          clienteId: visitasTecnicas.clienteId,
          tecnicoFirstName: users.firstName,
          tecnicoLastName: users.lastName,
          clienteName: clients.koen,
        })
        .from(visitasTecnicas)
        .leftJoin(users, eq(visitasTecnicas.tecnicoId, users.id))
        .leftJoin(clients, eq(visitasTecnicas.clienteId, clients.id))
        .orderBy(desc(visitasTecnicas.createdAt));
      
      // Apply filters
      const conditions = [];
      if (search) {
        conditions.push(
          or(
            ilike(visitasTecnicas.nombreObra, `%${search}%`),
            ilike(visitasTecnicas.direccionObra, `%${search}%`)
          )
        );
      }
      if (estado) {
        conditions.push(eq(visitasTecnicas.estado, estado));
      }
      if (tecnico) {
        conditions.push(eq(visitasTecnicas.tecnicoId, tecnico));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      // Execute query with pagination
      const results = await query.limit(limit).offset(offset);
      
      console.log('📊 Resultados de query:', results.length, results);
      
      // For each visit, count productos and reclamos
      const visitaIds = results.map(r => r.id);
      const productosCountMap: Record<string, number> = {};
      const reclamosCountMap: Record<string, number> = {};
      
      if (visitaIds.length > 0) {
        const productosCounts = await db
          .select({
            visitaId: productosEvaluados.visitaId,
            count: count()
          })
          .from(productosEvaluados)
          .where(inArray(productosEvaluados.visitaId, visitaIds))
          .groupBy(productosEvaluados.visitaId);
        
        productosCounts.forEach(p => {
          productosCountMap[p.visitaId] = p.count;
        });
        
        const reclamosCounts = await db
          .select({
            visitaId: reclamos.visitaId,
            count: count()
          })
          .from(reclamos)
          .where(inArray(reclamos.visitaId, visitaIds))
          .groupBy(reclamos.visitaId);
        
        reclamosCounts.forEach(r => {
          reclamosCountMap[r.visitaId] = r.count;
        });
      }
      
      // Format results
      const formattedResults = results.map(r => ({
        id: r.id,
        nombreObra: r.nombreObra,
        fechaVisita: r.createdAt,
        tecnico: (r.tecnicoFirstName && r.tecnicoLastName) 
          ? `${r.tecnicoFirstName} ${r.tecnicoLastName}` 
          : r.tecnicoFirstName || r.tecnicoLastName || 'Sin asignar',
        cliente: r.clienteName || 'Sin cliente',
        estado: r.estado,
        productosEvaluados: productosCountMap[r.id] || 0,
        reclamosTotal: reclamosCountMap[r.id] || 0
      }));
      
      console.log('✅ Resultados formateados:', formattedResults);
      
      return formattedResults;
    } catch (error) {
      console.error('Error getting listado visitas técnicas:', error);
      return [];
    }
  }

  async createVisitaTecnica(data: any) {
    try {
      const [visitaCreada] = await db.insert(visitasTecnicas).values(data).returning();
      return visitaCreada;
    } catch (error) {
      console.error('Error creating visita técnica:', error);
      throw error;
    }
  }

  async getVisitaTecnicaById(id: string) {
    try {
      const [visita] = await db.select().from(visitasTecnicas).where(eq(visitasTecnicas.id, id));
      
      if (!visita) return null;

      // Get productos evaluados for this visit
      const productosEval = await db
        .select()
        .from(productosEvaluados)
        .where(eq(productosEvaluados.visitaId, id));

      // For each producto, get its evaluacion tecnica
      const productosConEvaluacion = await Promise.all(
        productosEval.map(async (prod) => {
          const [evaluacion] = await db
            .select()
            .from(evaluacionesTecnicas)
            .where(eq(evaluacionesTecnicas.productoEvaluadoId, prod.id));

          return {
            id: prod.id,
            productId: prod.productoId,
            sku: prod.sku,
            name: prod.nombre,
            formato: prod.formato,
            evaluacion: evaluacion || {}
          };
        })
      );

      return {
        ...visita,
        productos: productosConEvaluacion
      };
    } catch (error) {
      console.error('Error getting visita técnica by id:', error);
      return null;
    }
  }

  async updateVisitaTecnica(id: string, data: any) {
    try {
      const [visitaActualizada] = await db
        .update(visitasTecnicas)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(visitasTecnicas.id, id))
        .returning();
      return visitaActualizada;
    } catch (error) {
      console.error('Error updating visita técnica:', error);
      return null;
    }
  }

  async deleteVisitaTecnica(id: string): Promise<boolean> {
    try {
      // Eliminar registros relacionados primero
      await db.delete(contactosVisita).where(eq(contactosVisita.visitaId, id));
      await db.delete(productosEvaluados).where(eq(productosEvaluados.visitaId, id));
      await db.delete(reclamos).where(eq(reclamos.visitaId, id));
      await db.delete(firmasDigitales).where(eq(firmasDigitales.visitaId, id));
      await db.delete(evidencias).where(eq(evidencias.visitaId, id));
      
      // Eliminar la visita principal
      await db.delete(visitasTecnicas).where(eq(visitasTecnicas.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deleting visita técnica:', error);
      return false;
    }
  }

  async getProductosParaVisitas(options: {
    clienteId?: string;
    search?: string;
    active?: boolean;
  } = {}) {
    try {
      let query = db.select({
        id: products.id,
        kopr: products.kopr,
        name: products.name,
        ud02pr: products.ud02pr,
        priceProduct: products.priceProduct,
        category: products.category
      }).from(products);

      const conditions = [];
      
      if (options.active) {
        conditions.push(eq(products.active, true));
      }

      if (options.search) {
        conditions.push(
          or(
            ilike(products.name, `%${options.search}%`),
            ilike(products.kopr, `%${options.search}%`)
          )
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(products.name).limit(100);

      const productos = await query;
      return productos;
    } catch (error) {
      console.error('Error getting productos para visitas:', error);
      return [];
    }
  }

  async getTecnicosDisponibles() {
    try {
      const tecnicos = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role
        })
        .from(users)
        .where(
          and(
            or(
              eq(users.role, 'admin'),
              eq(users.role, 'supervisor'),
              eq(users.role, 'salesperson') // Los vendedores también pueden ser técnicos
            )
          )
        )
        .orderBy(users.firstName, users.lastName);

      return tecnicos.map(tecnico => ({
        ...tecnico,
        fullName: `${tecnico.firstName || ''} ${tecnico.lastName || ''}`.trim() || tecnico.email
      }));
    } catch (error) {
      console.error('Error getting técnicos disponibles:', error);
      return [];
    }
  }

  async createEvidencia(data: any) {
    try {
      const [evidenciaCreada] = await db.insert(evidencias).values(data).returning();
      return evidenciaCreada;
    } catch (error) {
      console.error('Error creating evidencia:', error);
      throw error;
    }
  }

  async createContactoVisita(data: any) {
    try {
      const [contactoCreado] = await db.insert(contactosVisita).values(data).returning();
      return contactoCreado;
    } catch (error) {
      console.error('Error creating contacto visita:', error);
      throw error;
    }
  }

  async createProductoEvaluado(data: any) {
    try {
      const [productoCreado] = await db.insert(productosEvaluados).values(data).returning();
      return productoCreado;
    } catch (error) {
      console.error('Error creating producto evaluado:', error);
      throw error;
    }
  }

  async createEvaluacionTecnica(data: any) {
    try {
      const [evaluacionCreada] = await db.insert(evaluacionesTecnicas).values(data).returning();
      return evaluacionCreada;
    } catch (error) {
      console.error('Error creating evaluación técnica:', error);
      throw error;
    }
  }

  async createReclamo(data: any) {
    try {
      const [reclamoCreado] = await db.insert(reclamos).values(data).returning();
      return reclamoCreado;
    } catch (error) {
      console.error('Error creating reclamo:', error);
      throw error;
    }
  }

  async createFirmaDigital(data: any) {
    try {
      const [firmaCreada] = await db.insert(firmasDigitales).values(data).returning();
      return firmaCreada;
    } catch (error) {
      console.error('Error creating firma digital:', error);
      throw error;
    }
  }

  // =============================================================================
  // TINTOMETRÍA SYSTEM METHODS
  // =============================================================================

  // PIGMENTS CRUD
  async getAllPigments(): Promise<Pigment[]> {
    try {
      return await db.select().from(pigments).orderBy(pigments.nombre);
    } catch (error) {
      console.error('Error getting all pigments:', error);
      throw error;
    }
  }

  async getPigmentById(id: number): Promise<Pigment | null> {
    try {
      const [pigment] = await db.select().from(pigments).where(eq(pigments.id, id));
      return pigment || null;
    } catch (error) {
      console.error('Error getting pigment by id:', error);
      throw error;
    }
  }

  async createPigment(data: InsertPigment): Promise<Pigment> {
    try {
      const [pigmentCreated] = await db.insert(pigments).values(data).returning();
      return pigmentCreated;
    } catch (error) {
      console.error('Error creating pigment:', error);
      throw error;
    }
  }

  async updatePigment(id: number, data: Partial<InsertPigment>): Promise<Pigment> {
    try {
      const [pigmentUpdated] = await db.update(pigments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(pigments.id, id))
        .returning();
      return pigmentUpdated;
    } catch (error) {
      console.error('Error updating pigment:', error);
      throw error;
    }
  }

  async deletePigment(id: number): Promise<void> {
    try {
      await db.delete(pigments).where(eq(pigments.id, id));
    } catch (error) {
      console.error('Error deleting pigment:', error);
      throw error;
    }
  }

  // BASES CRUD
  async getAllBases(): Promise<Base[]> {
    try {
      return await db.select().from(bases).orderBy(bases.baseId);
    } catch (error) {
      console.error('Error getting all bases:', error);
      throw error;
    }
  }

  async getBaseById(id: number): Promise<Base | null> {
    try {
      const [base] = await db.select().from(bases).where(eq(bases.id, id));
      return base || null;
    } catch (error) {
      console.error('Error getting base by id:', error);
      throw error;
    }
  }

  async createBase(data: InsertBase): Promise<Base> {
    try {
      const [baseCreated] = await db.insert(bases).values(data).returning();
      return baseCreated;
    } catch (error) {
      console.error('Error creating base:', error);
      throw error;
    }
  }

  async updateBase(id: number, data: Partial<InsertBase>): Promise<Base> {
    try {
      const [baseUpdated] = await db.update(bases)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(bases.id, id))
        .returning();
      return baseUpdated;
    } catch (error) {
      console.error('Error updating base:', error);
      throw error;
    }
  }

  async deleteBase(id: number): Promise<void> {
    try {
      await db.delete(bases).where(eq(bases.id, id));
    } catch (error) {
      console.error('Error deleting base:', error);
      throw error;
    }
  }

  // ENVASES CRUD
  async getAllEnvases(): Promise<Envase[]> {
    try {
      return await db.select().from(envases).orderBy(envases.envaseId);
    } catch (error) {
      console.error('Error getting all envases:', error);
      throw error;
    }
  }

  async getEnvaseById(id: number): Promise<Envase | null> {
    try {
      const [envase] = await db.select().from(envases).where(eq(envases.id, id));
      return envase || null;
    } catch (error) {
      console.error('Error getting envase by id:', error);
      throw error;
    }
  }

  async createEnvase(data: InsertEnvase): Promise<Envase> {
    try {
      const [envaseCreated] = await db.insert(envases).values(data).returning();
      return envaseCreated;
    } catch (error) {
      console.error('Error creating envase:', error);
      throw error;
    }
  }

  async updateEnvase(id: number, data: Partial<InsertEnvase>): Promise<Envase> {
    try {
      const [envaseUpdated] = await db.update(envases)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(envases.id, id))
        .returning();
      return envaseUpdated;
    } catch (error) {
      console.error('Error updating envase:', error);
      throw error;
    }
  }

  async deleteEnvase(id: number): Promise<void> {
    try {
      await db.delete(envases).where(eq(envases.id, id));
    } catch (error) {
      console.error('Error deleting envase:', error);
      throw error;
    }
  }

  // COLORES CRUD
  async getAllColores(): Promise<Color[]> {
    try {
      return await db.select().from(colores).orderBy(colores.nombreColor);
    } catch (error) {
      console.error('Error getting all colores:', error);
      throw error;
    }
  }

  async getColorById(id: number): Promise<Color | null> {
    try {
      const [color] = await db.select().from(colores).where(eq(colores.id, id));
      return color || null;
    } catch (error) {
      console.error('Error getting color by id:', error);
      throw error;
    }
  }

  async createColor(data: InsertColor): Promise<Color> {
    try {
      const [colorCreated] = await db.insert(colores).values(data).returning();
      return colorCreated;
    } catch (error) {
      console.error('Error creating color:', error);
      throw error;
    }
  }

  async updateColor(id: number, data: Partial<InsertColor>): Promise<Color> {
    try {
      const [colorUpdated] = await db.update(colores)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(colores.id, id))
        .returning();
      return colorUpdated;
    } catch (error) {
      console.error('Error updating color:', error);
      throw error;
    }
  }

  async deleteColor(id: number): Promise<void> {
    try {
      await db.delete(colores).where(eq(colores.id, id));
    } catch (error) {
      console.error('Error deleting color:', error);
      throw error;
    }
  }

  // RECETAS CRUD
  async getAllRecetas(): Promise<Receta[]> {
    try {
      return await db.select().from(recetas).orderBy(recetas.colorId);
    } catch (error) {
      console.error('Error getting all recetas:', error);
      throw error;
    }
  }

  async getRecetasByColorId(colorId: string): Promise<Receta[]> {
    try {
      return await db.select().from(recetas).where(eq(recetas.colorId, colorId));
    } catch (error) {
      console.error('Error getting recetas by color id:', error);
      throw error;
    }
  }

  async getRecetaById(id: number): Promise<Receta | null> {
    try {
      const [receta] = await db.select().from(recetas).where(eq(recetas.id, id));
      return receta || null;
    } catch (error) {
      console.error('Error getting receta by id:', error);
      throw error;
    }
  }

  async createReceta(data: InsertReceta): Promise<Receta> {
    try {
      const [recetaCreated] = await db.insert(recetas).values(data).returning();
      return recetaCreated;
    } catch (error) {
      console.error('Error creating receta:', error);
      throw error;
    }
  }

  async updateReceta(id: number, data: Partial<InsertReceta>): Promise<Receta> {
    try {
      const [recetaUpdated] = await db.update(recetas)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(recetas.id, id))
        .returning();
      return recetaUpdated;
    } catch (error) {
      console.error('Error updating receta:', error);
      throw error;
    }
  }

  async deleteReceta(id: number): Promise<void> {
    try {
      await db.delete(recetas).where(eq(recetas.id, id));
    } catch (error) {
      console.error('Error deleting receta:', error);
      throw error;
    }
  }

  // PARÁMETROS CRUD
  async getAllParametros(): Promise<Parametro[]> {
    try {
      return await db.select().from(parametros).orderBy(parametros.parametro);
    } catch (error) {
      console.error('Error getting all parametros:', error);
      throw error;
    }
  }

  async getParametroById(id: number): Promise<Parametro | null> {
    try {
      const [parametro] = await db.select().from(parametros).where(eq(parametros.id, id));
      return parametro || null;
    } catch (error) {
      console.error('Error getting parametro by id:', error);
      throw error;
    }
  }

  async getParametroByName(parametro: string): Promise<Parametro | null> {
    try {
      const [param] = await db.select().from(parametros).where(eq(parametros.parametro, parametro));
      return param || null;
    } catch (error) {
      console.error('Error getting parametro by name:', error);
      throw error;
    }
  }

  async createParametro(data: InsertParametro): Promise<Parametro> {
    try {
      const [parametroCreated] = await db.insert(parametros).values(data).returning();
      return parametroCreated;
    } catch (error) {
      console.error('Error creating parametro:', error);
      throw error;
    }
  }

  async updateParametro(id: number, data: Partial<InsertParametro>): Promise<Parametro> {
    try {
      const [parametroUpdated] = await db.update(parametros)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(parametros.id, id))
        .returning();
      return parametroUpdated;
    } catch (error) {
      console.error('Error updating parametro:', error);
      throw error;
    }
  }

  async deleteParametro(id: number): Promise<void> {
    try {
      await db.delete(parametros).where(eq(parametros.id, id));
    } catch (error) {
      console.error('Error deleting parametro:', error);
      throw error;
    }
  }

  // TINTOMETRÍA CALCULATION METHODS
  async calculateColorCost(colorId: string, envaseId: string): Promise<{
    colorId: string;
    envaseId: string;
    baseId: string;
    baseCost: number;
    pigmentsCost: number;
    envaseData: Envase;
    totalPaintCost: number;
    totalCost: number;
    suggestedPrice?: number;
  } | null> {
    try {
      // Get color and verify it exists
      const [color] = await db.select().from(colores).where(eq(colores.colorId, colorId));
      if (!color) return null;

      // Get envase and verify it exists
      const [envase] = await db.select().from(envases).where(eq(envases.envaseId, envaseId));
      if (!envase) return null;

      // Get base cost
      const [base] = await db.select().from(bases).where(eq(bases.baseId, color.baseId));
      if (!base) return null;

      // Get recetas for this color
      const recetasColor = await db.select({
        pigmentoCode: recetas.pigmentoCode,
        fraccionPeso: recetas.fraccionPeso,
        pigmentoCosto: pigments.costoKgClp
      })
      .from(recetas)
      .leftJoin(pigments, eq(recetas.pigmentoCode, pigments.pigmentoCode))
      .where(eq(recetas.colorId, colorId));

      // Calculate paint weight (kg for this container)
      const paintWeightKg = Number(envase.kgPorEnvase);

      // Calculate base cost (usually most of the weight)
      const totalFraccionPigmentos = recetasColor.reduce((sum, receta) => 
        sum + Number(receta.fraccionPeso), 0);
      const fraccionBase = Math.max(0, 1 - totalFraccionPigmentos);
      const baseCost = fraccionBase * paintWeightKg * Number(base.costoKgClp);

      // Calculate pigments cost
      const pigmentsCost = recetasColor.reduce((sum, receta) => {
        const pigmentWeight = Number(receta.fraccionPeso) * paintWeightKg;
        const pigmentCost = pigmentWeight * Number(receta.pigmentoCosto || 0);
        return sum + pigmentCost;
      }, 0);

      // Total paint cost (base + pigments)
      const totalPaintCost = baseCost + pigmentsCost;

      // Total cost including container
      const totalCost = totalPaintCost + Number(envase.costoEnvaseClp);

      // Get suggested price multiplier parameter (if exists)
      const [priceMultiplierParam] = await db.select()
        .from(parametros)
        .where(eq(parametros.parametro, 'precio_multiplicador'));

      const suggestedPrice = priceMultiplierParam 
        ? totalCost * Number(priceMultiplierParam.valor)
        : undefined;

      return {
        colorId,
        envaseId,
        baseId: color.baseId,
        baseCost,
        pigmentsCost,
        envaseData: envase,
        totalPaintCost,
        totalCost,
        suggestedPrice
      };

    } catch (error) {
      console.error('Error calculating color cost:', error);
      throw error;
    }
  }

  // eCommerce Orders operations
  async createEcommerceOrder(orderData: any) {
    const { ecommerceOrders } = await import('@shared/schema');
    
    const [newOrder] = await db
      .insert(ecommerceOrders)
      .values(orderData)
      .returning();
    
    return newOrder;
  }

  async getEcommerceOrders(filters?: {
    clientId?: string;
    salespersonId?: string;
    status?: string;
  }) {
    const { ecommerceOrders } = await import('@shared/schema');
    
    const conditions = [];
    
    if (filters?.clientId) {
      conditions.push(eq(ecommerceOrders.clientId, filters.clientId));
    }
    
    if (filters?.salespersonId) {
      conditions.push(eq(ecommerceOrders.assignedSalespersonId, filters.salespersonId));
    }
    
    if (filters?.status) {
      conditions.push(eq(ecommerceOrders.status, filters.status));
    }
    
    let query = db
      .select()
      .from(ecommerceOrders)
      .orderBy(desc(ecommerceOrders.createdAt));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return await query;
  }

  // Notification operations
  async createNotification(notificationData: any) {
    const { notifications } = await import('@shared/schema');
    
    const [newNotification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    
    return newNotification;
  }

  // Helper operations
  async getAdminUserId(): Promise<string | null> {
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    
    return admin?.id || null;
  }

  // ==================================================================================
  // RECLAMOS GENERALES OPERATIONS
  // ==================================================================================

  async createReclamoGeneral(reclamo: InsertReclamoGeneral): Promise<ReclamoGeneral> {
    const [newReclamo] = await db
      .insert(reclamosGenerales)
      .values(reclamo)
      .returning();
    
    // Create initial historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: newReclamo.id,
      estadoAnterior: null,
      estadoNuevo: newReclamo.estado,
      userId: reclamo.vendedorId,
      userName: reclamo.vendedorName || '',
      notas: 'Reclamo creado',
    });
    
    return newReclamo;
  }

  async getReclamosGenerales(filters?: {
    vendedorId?: string;
    tecnicoId?: string;
    estado?: string;
    gravedad?: string;
    areaResponsable?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReclamoGeneral[]> {
    const conditions = [];
    
    if (filters?.vendedorId) {
      conditions.push(eq(reclamosGenerales.vendedorId, filters.vendedorId));
    }
    
    if (filters?.tecnicoId) {
      conditions.push(eq(reclamosGenerales.tecnicoId, filters.tecnicoId));
    }
    
    if (filters?.estado) {
      conditions.push(eq(reclamosGenerales.estado, filters.estado));
    }
    
    if (filters?.gravedad) {
      conditions.push(eq(reclamosGenerales.gravedad, filters.gravedad));
    }
    
    if (filters?.areaResponsable) {
      conditions.push(eq(reclamosGenerales.areaResponsableActual, filters.areaResponsable));
    }
    
    let query = db
      .select()
      .from(reclamosGenerales)
      .orderBy(desc(reclamosGenerales.fechaRegistro));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async getReclamoGeneralById(id: string): Promise<ReclamoGeneral | undefined> {
    const [reclamo] = await db
      .select()
      .from(reclamosGenerales)
      .where(eq(reclamosGenerales.id, id));
    
    return reclamo;
  }

  async updateReclamoGeneral(id: string, updates: Partial<InsertReclamoGeneral>): Promise<ReclamoGeneral> {
    const [updated] = await db
      .update(reclamosGenerales)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    return updated;
  }

  async deleteReclamoGeneral(id: string): Promise<void> {
    await db.delete(reclamosGenerales).where(eq(reclamosGenerales.id, id));
  }

  // Reclamos Generales Photos operations
  async createReclamoGeneralPhoto(photo: InsertReclamoGeneralPhoto): Promise<ReclamoGeneralPhoto> {
    const [newPhoto] = await db
      .insert(reclamosGeneralesPhotos)
      .values(photo)
      .returning();
    
    return newPhoto;
  }

  async getReclamoGeneralPhotos(reclamoId: string): Promise<ReclamoGeneralPhoto[]> {
    return await db
      .select()
      .from(reclamosGeneralesPhotos)
      .where(eq(reclamosGeneralesPhotos.reclamoId, reclamoId))
      .orderBy(desc(reclamosGeneralesPhotos.uploadedAt));
  }

  async deleteReclamoGeneralPhoto(id: string): Promise<void> {
    await db.delete(reclamosGeneralesPhotos).where(eq(reclamosGeneralesPhotos.id, id));
  }

  // Reclamos Generales Historial operations
  async createReclamoGeneralHistorial(historial: InsertReclamoGeneralHistorial): Promise<ReclamoGeneralHistorial> {
    const [newHistorial] = await db
      .insert(reclamosGeneralesHistorial)
      .values(historial)
      .returning();
    
    return newHistorial;
  }

  async getReclamoGeneralHistorial(reclamoId: string): Promise<ReclamoGeneralHistorial[]> {
    return await db
      .select()
      .from(reclamosGeneralesHistorial)
      .where(eq(reclamosGeneralesHistorial.reclamoId, reclamoId))
      .orderBy(desc(reclamosGeneralesHistorial.createdAt));
  }

  // Combined operations
  async getReclamoGeneralWithDetails(id: string): Promise<(ReclamoGeneral & { 
    photos: ReclamoGeneralPhoto[];
    historial: ReclamoGeneralHistorial[];
  }) | undefined> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      return undefined;
    }
    
    const photos = await this.getReclamoGeneralPhotos(id);
    const historial = await this.getReclamoGeneralHistorial(id);
    
    return {
      ...reclamo,
      photos,
      historial,
    };
  }

  // Asignar técnico y cambiar estado
  async assignTecnicoToReclamo(
    id: string, 
    tecnicoId: string, 
    tecnicoName: string, 
    userId: string, 
    userName: string
  ): Promise<ReclamoGeneral> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        tecnicoId,
        tecnicoName,
        estado: 'en_revision_tecnica',
        fechaAsignacionTecnico: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: 'en_revision_tecnica',
      userId,
      userName,
      notas: `Técnico asignado: ${tecnicoName}`,
    });
    
    return updated;
  }

  // Cambiar estado del reclamo
  async updateReclamoGeneralEstado(
    id: string, 
    nuevoEstado: string, 
    userId: string, 
    userName: string, 
    notas?: string
  ): Promise<ReclamoGeneral> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        estado: nuevoEstado,
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: nuevoEstado,
      userId,
      userName,
      notas: notas || `Estado actualizado a ${nuevoEstado}`,
    });
    
    return updated;
  }

  // Derivar a laboratorio
  async derivarReclamoGeneralLaboratorio(
    id: string, 
    userId: string, 
    userName: string
  ): Promise<ReclamoGeneral> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        derivadoLaboratorio: true,
        estado: 'en_laboratorio',
        fechaEnvioLaboratorio: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: 'en_laboratorio',
      userId,
      userName,
      notas: 'Reclamo derivado a laboratorio',
    });
    
    return updated;
  }

  // Derivar a producción
  async derivarReclamoGeneralProduccion(
    id: string, 
    userId: string, 
    userName: string
  ): Promise<ReclamoGeneral> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        derivadoProduccion: true,
        estado: 'en_produccion',
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: 'en_produccion',
      userId,
      userName,
      notas: 'Reclamo derivado a producción',
    });
    
    return updated;
  }

  // Validación técnica
  async validarReclamoTecnico(
    id: string,
    procede: boolean,
    areaResponsable: string,
    notas: string | undefined,
    userId: string,
    userName: string
  ): Promise<ReclamoGeneral> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    // Determinar nuevo estado según si procede o no
    // Si procede: pasa a en_area_responsable
    // Si no procede: se mantiene en en_revision_tecnica para revisión posterior
    const nuevoEstado = procede ? 'en_area_responsable' : 'en_revision_tecnica';
    
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        procede,
        areaResponsableActual: procede ? areaResponsable : reclamo.areaResponsableActual,
        estado: nuevoEstado,
        updatedAt: new Date(),
        informeTecnico: notas || null,
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: nuevoEstado,
      userId,
      userName,
      notas: notas || (procede 
        ? `Reclamo validado y derivado a ${areaResponsable}` 
        : 'Reclamo marcado como no procedente - pendiente revisión'),
    });
    
    return updated;
  }

  // Update informes
  async updateInformeLaboratorio(
    id: string, 
    informe: string, 
    userId: string, 
    userName: string
  ): Promise<ReclamoGeneral> {
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        informeLaboratorio: informe,
        fechaRespuestaLaboratorio: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: null,
      estadoNuevo: updated.estado,
      userId,
      userName,
      notas: 'Informe de laboratorio agregado',
    });
    
    return updated;
  }

  async updateInformeProduccion(
    id: string, 
    informe: string, 
    userId: string, 
    userName: string
  ): Promise<ReclamoGeneral> {
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        informeProduccion: informe,
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: null,
      estadoNuevo: updated.estado,
      userId,
      userName,
      notas: 'Informe de producción agregado',
    });
    
    return updated;
  }

  async updateInformeTecnico(
    id: string, 
    informe: string, 
    userId: string, 
    userName: string
  ): Promise<ReclamoGeneral> {
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        informeTecnico: informe,
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: null,
      estadoNuevo: updated.estado,
      userId,
      userName,
      notas: 'Informe técnico agregado',
    });
    
    return updated;
  }

  // Update resolución laboratorio con evidencia
  async updateResolucionLaboratorio(
    id: string,
    informe: string,
    categoriaResponsable: string,
    photos: Array<{ photoUrl: string; description?: string }>,
    userId: string,
    userName: string
  ): Promise<ReclamoGeneral | null> {
    // Obtener el reclamo antes de actualizarlo para guardar el estado anterior
    const reclamoAnterior = await this.getReclamoGeneralById(id);
    if (!reclamoAnterior) {
      return null;
    }

    // Actualización condicional para prevenir race conditions
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        informeLaboratorio: informe,
        categoriaResponsable,
        fechaRespuestaLaboratorio: new Date(),
        estado: 'resuelto', // Cambiar estado a resuelto
        updatedAt: new Date(),
      })
      .where(and(
        eq(reclamosGenerales.id, id),
        isNull(reclamosGenerales.informeLaboratorio) // Solo actualizar si no tiene informe previo
      ))
      .returning();
    
    // Si no se actualizó ninguna fila, retornar null
    if (!updated) {
      return null;
    }
    
    // Crear las fotos de evidencia
    for (const photo of photos) {
      await db.insert(reclamosGeneralesResolucionPhotos).values({
        reclamoId: id,
        photoUrl: photo.photoUrl,
        description: photo.description,
      });
    }
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamoAnterior.estado,
      estadoNuevo: 'resuelto',
      userId,
      userName,
      notas: `Resolución de laboratorio agregada con ${photos.length} foto(s) de evidencia. Reclamo finalizado.`,
    });

    // Crear notificaciones para el técnico de obra y el vendedor
    const notificaciones = [];

    // Notificar al técnico de obra si existe
    if (updated.tecnicoId) {
      notificaciones.push(
        this.createNotification({
          userId: updated.tecnicoId,
          type: 'reclamo_resuelto',
          title: 'Reclamo Resuelto',
          message: `El reclamo #${updated.numeroReclamo} del cliente "${updated.clientName}" ha sido resuelto por el laboratorio.`,
          relatedReclamoId: updated.id,
          read: false,
        })
      );
    }

    // Notificar al vendedor que creó el reclamo
    if (updated.vendedorId) {
      notificaciones.push(
        this.createNotification({
          userId: updated.vendedorId,
          type: 'reclamo_resuelto',
          title: 'Reclamo Resuelto',
          message: `El reclamo #${updated.numeroReclamo} del cliente "${updated.clientName}" ha sido resuelto por el laboratorio.`,
          relatedReclamoId: updated.id,
          read: false,
        })
      );
    }

    // Ejecutar las notificaciones en paralelo
    await Promise.all(notificaciones);
    
    return updated;
  }

  async getReclamoGeneralResolucionPhotos(reclamoId: string): Promise<any[]> {
    return db
      .select()
      .from(reclamosGeneralesResolucionPhotos)
      .where(eq(reclamosGeneralesResolucionPhotos.reclamoId, reclamoId))
      .orderBy(desc(reclamosGeneralesResolucionPhotos.uploadedAt));
  }

  // Update resolución genérica para cualquier área responsable
  async updateResolucionArea(
    id: string,
    resolucionDescripcion: string,
    photos: Array<{ photoUrl: string; description?: string }>,
    userId: string,
    userName: string,
    userRole: string
  ): Promise<ReclamoGeneral | null> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    // Verificar que el reclamo está en estado "en_area_responsable"
    if (reclamo.estado !== 'en_area_responsable') {
      throw new Error('El reclamo no está en estado "En Área Responsable"');
    }
    
    // Extraer área del rol (ej: area_materia_prima -> materia_prima, laboratorio -> laboratorio)
    const areaUsuario = userRole.startsWith('area_') ? userRole.replace('area_', '') : userRole;
    
    // Normalizar área para comparación (manejar variaciones como colores_variacion)
    const normalizeArea = (area: string) => {
      // Para colores: tanto "colores" como "colores_variacion" se normalizan a "colores"
      if (area === 'colores_variacion' || area === 'colores') return 'colores';
      return area;
    };
    
    const areaUsuarioNormalizada = normalizeArea(areaUsuario);
    const areaResponsableNormalizada = normalizeArea(reclamo.areaResponsableActual || '');
    
    // Verificar que el área del usuario coincide con el área responsable del reclamo
    if (areaResponsableNormalizada !== areaUsuarioNormalizada) {
      throw new Error('No tiene permisos para resolver este reclamo');
    }
    
    // Actualización condicional para prevenir race conditions
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        resolucionDescripcion,
        resolucionUsuarioId: userId,
        resolucionUsuarioName: userName,
        fechaResolucion: new Date(),
        estado: 'resuelto',
        updatedAt: new Date(),
      })
      .where(and(
        eq(reclamosGenerales.id, id),
        isNull(reclamosGenerales.resolucionDescripcion) // Solo actualizar si no tiene resolución previa
      ))
      .returning();
    
    // Si no se actualizó ninguna fila, retornar null
    if (!updated) {
      return null;
    }
    
    // Crear las fotos de evidencia
    for (const photo of photos) {
      await db.insert(reclamosGeneralesResolucionPhotos).values({
        reclamoId: id,
        photoUrl: photo.photoUrl,
        description: photo.description,
      });
    }
    
    // Create historial entry
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: 'resuelto',
      userId,
      userName,
      notas: `Resolución agregada por ${areaUsuario} con ${photos.length} foto(s) de evidencia. Reclamo finalizado.`,
    });

    // Crear notificaciones para el técnico de obra y el vendedor
    const notificaciones = [];

    // Notificar al técnico de obra si existe
    if (updated.tecnicoId) {
      notificaciones.push(
        this.createNotification({
          userId: updated.tecnicoId,
          type: 'reclamo_resuelto',
          title: 'Reclamo Resuelto',
          message: `El reclamo #${updated.numeroReclamo} del cliente "${updated.clientName}" ha sido resuelto por el área ${areaUsuario}.`,
          relatedReclamoId: updated.id,
          read: false,
        })
      );
    }

    // Notificar al vendedor que creó el reclamo
    if (updated.vendedorId) {
      notificaciones.push(
        this.createNotification({
          userId: updated.vendedorId,
          type: 'reclamo_resuelto',
          title: 'Reclamo Resuelto',
          message: `El reclamo #${updated.numeroReclamo} del cliente "${updated.clientName}" ha sido resuelto por el área ${areaUsuario}.`,
          relatedReclamoId: updated.id,
          read: false,
        })
      );
    }

    // Ejecutar las notificaciones en paralelo
    await Promise.all(notificaciones);
    
    return updated;
  }

  // Cerrar reclamo
  async cerrarReclamoGeneral(
    id: string, 
    userId: string, 
    userName: string, 
    notas?: string,
    photos?: Array<{ photoUrl: string; description?: string }>
  ): Promise<ReclamoGeneral> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        estado: 'cerrado',
        fechaCierre: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Crear las fotos de evidencia si existen
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        await db.insert(reclamosGeneralesResolucionPhotos).values({
          reclamoId: id,
          photoUrl: photo.photoUrl,
          description: photo.description || 'Evidencia de cierre del reclamo',
        });
      }
    }
    
    // Create historial entry
    const notasConFotos = photos && photos.length > 0 
      ? `${notas || 'Reclamo cerrado'} (${photos.length} foto(s) de evidencia)`
      : (notas || 'Reclamo cerrado');
    
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: 'cerrado',
      userId,
      userName,
      notas: notasConFotos,
    });
    
    return updated;
  }

  // ==================================================================================
  // MARKETING MODULE operations
  // ==================================================================================
  
  // Presupuesto Marketing operations
  async createPresupuestoMarketing(presupuesto: InsertPresupuestoMarketing): Promise<PresupuestoMarketing> {
    const [result] = await db
      .insert(presupuestoMarketing)
      .values(presupuesto)
      .returning();
    return result;
  }

  async getPresupuestoMarketing(mes: number, anio: number): Promise<PresupuestoMarketing | undefined> {
    const [result] = await db
      .select()
      .from(presupuestoMarketing)
      .where(and(
        eq(presupuestoMarketing.mes, mes),
        eq(presupuestoMarketing.anio, anio)
      ));
    return result;
  }

  async updatePresupuestoMarketing(id: string, presupuesto: Partial<InsertPresupuestoMarketing>): Promise<PresupuestoMarketing> {
    const [result] = await db
      .update(presupuestoMarketing)
      .set({
        ...presupuesto,
        updatedAt: new Date(),
      })
      .where(eq(presupuestoMarketing.id, id))
      .returning();
    return result;
  }
  
  // Solicitudes Marketing operations
  async createSolicitudMarketing(solicitud: InsertSolicitudMarketing): Promise<SolicitudMarketing> {
    const [result] = await db
      .insert(solicitudesMarketing)
      .values(solicitud)
      .returning();
    return result;
  }

  async getSolicitudesMarketing(filters?: {
    mes?: number;
    anio?: number;
    estado?: string;
    supervisorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SolicitudMarketing[]> {
    const conditions = [];
    
    if (filters?.mes !== undefined) {
      conditions.push(eq(solicitudesMarketing.mes, filters.mes));
    }
    if (filters?.anio !== undefined) {
      conditions.push(eq(solicitudesMarketing.anio, filters.anio));
    }
    if (filters?.estado) {
      conditions.push(eq(solicitudesMarketing.estado, filters.estado));
    }
    if (filters?.supervisorId) {
      conditions.push(eq(solicitudesMarketing.supervisorId, filters.supervisorId));
    }
    
    let query = db
      .select()
      .from(solicitudesMarketing)
      .orderBy(desc(solicitudesMarketing.fechaSolicitud));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return await query;
  }

  async getSolicitudMarketingById(id: string): Promise<SolicitudMarketing | undefined> {
    const [result] = await db
      .select()
      .from(solicitudesMarketing)
      .where(eq(solicitudesMarketing.id, id));
    return result;
  }

  async getSolicitudesMarketingByUrgency(supervisorId: string, urgencia: string): Promise<SolicitudMarketing[]> {
    const results = await db
      .select()
      .from(solicitudesMarketing)
      .where(
        and(
          eq(solicitudesMarketing.supervisorId, supervisorId),
          eq(solicitudesMarketing.urgencia, urgencia)
        )
      );
    return results;
  }

  async updateSolicitudMarketing(id: string, updates: Partial<InsertSolicitudMarketing>): Promise<SolicitudMarketing> {
    const [result] = await db
      .update(solicitudesMarketing)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(solicitudesMarketing.id, id))
      .returning();
    return result;
  }

  async deleteSolicitudMarketing(id: string): Promise<void> {
    await db
      .delete(solicitudesMarketing)
      .where(eq(solicitudesMarketing.id, id));
  }
  
  // Cambiar estado de solicitud
  async updateSolicitudMarketingEstado(id: string, nuevoEstado: string, motivoRechazo?: string, monto?: number, pdfPresupuesto?: string): Promise<SolicitudMarketing> {
    const updateData: any = {
      estado: nuevoEstado,
      updatedAt: new Date(),
    };
    
    if (nuevoEstado === 'completado') {
      updateData.fechaCompletado = new Date();
    }
    
    if (nuevoEstado === 'rechazado' && motivoRechazo) {
      updateData.motivoRechazo = motivoRechazo;
    }
    
    if (monto !== undefined) {
      updateData.monto = monto.toString();
    }
    
    if (pdfPresupuesto !== undefined) {
      updateData.pdfPresupuesto = pdfPresupuesto;
    }
    
    const [result] = await db
      .update(solicitudesMarketing)
      .set(updateData)
      .where(eq(solicitudesMarketing.id, id))
      .returning();
    return result;
  }
  
  // Métricas de marketing
  async getMarketingMetrics(mes: number, anio: number): Promise<{
    presupuestoTotal: number;
    presupuestoUtilizado: number;
    presupuestoDisponible: number;
    totalSolicitudes: number;
    solicitudesPorEstado: {
      solicitado: number;
      en_proceso: number;
      completado: number;
      rechazado: number;
    };
  }> {
    // Get presupuesto
    const presupuesto = await this.getPresupuestoMarketing(mes, anio);
    const presupuestoTotal = presupuesto ? parseFloat(presupuesto.presupuestoTotal as any) : 0;
    
    // Get all solicitudes for this period
    const solicitudes = await this.getSolicitudesMarketing({ mes, anio });
    
    // Calculate presupuesto utilizado (only completado and en_proceso)
    const presupuestoUtilizado = solicitudes
      .filter(s => s.estado === 'completado' || s.estado === 'en_proceso')
      .reduce((sum, s) => sum + parseFloat(s.monto as any), 0);
    
    // Count by estado
    const solicitudesPorEstado = {
      solicitado: solicitudes.filter(s => s.estado === 'solicitado').length,
      en_proceso: solicitudes.filter(s => s.estado === 'en_proceso').length,
      completado: solicitudes.filter(s => s.estado === 'completado').length,
      rechazado: solicitudes.filter(s => s.estado === 'rechazado').length,
    };
    
    return {
      presupuestoTotal,
      presupuestoUtilizado,
      presupuestoDisponible: presupuestoTotal - presupuestoUtilizado,
      totalSolicitudes: solicitudes.length,
      solicitudesPorEstado,
    };
  }

  // Inventario Marketing operations
  async createInventarioMarketing(item: InsertInventarioMarketing): Promise<InventarioMarketing> {
    const [result] = await db
      .insert(inventarioMarketing)
      .values(item)
      .returning();
    return result;
  }

  async getInventarioMarketing(filters?: {
    search?: string;
    estado?: string;
    limit?: number;
    offset?: number;
  }): Promise<InventarioMarketing[]> {
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(inventarioMarketing.nombre, `%${filters.search}%`),
          ilike(inventarioMarketing.descripcion, `%${filters.search}%`),
          ilike(inventarioMarketing.ubicacion, `%${filters.search}%`)
        )
      );
    }
    
    if (filters?.estado) {
      conditions.push(eq(inventarioMarketing.estado, filters.estado));
    }

    let query = db
      .select()
      .from(inventarioMarketing)
      .orderBy(desc(inventarioMarketing.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async getInventarioMarketingById(id: string): Promise<InventarioMarketing | undefined> {
    const [result] = await db
      .select()
      .from(inventarioMarketing)
      .where(eq(inventarioMarketing.id, id));
    return result;
  }

  async updateInventarioMarketing(id: string, updates: Partial<InsertInventarioMarketing>): Promise<InventarioMarketing> {
    const [result] = await db
      .update(inventarioMarketing)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(inventarioMarketing.id, id))
      .returning();
    return result;
  }

  async deleteInventarioMarketing(id: string): Promise<void> {
    await db
      .delete(inventarioMarketing)
      .where(eq(inventarioMarketing.id, id));
  }

  async getInventarioMarketingSummary(): Promise<{
    totalItems: number;
    stockBajo: number;
    valorTotal: number;
  }> {
    const items = await this.getInventarioMarketing({});
    
    const totalItems = items.length;
    const stockBajo = items.filter(item => item.cantidad <= (item.stockMinimo || 0)).length;
    const valorTotal = items.reduce((sum, item) => {
      const costo = parseFloat(item.costoUnitario as any) || 0;
      return sum + (costo * item.cantidad);
    }, 0);

    return {
      totalItems,
      stockBajo,
      valorTotal,
    };
  }

  // ==================== HITOS DE MARKETING ====================

  async getHitosMarketing(filters?: {
    mes?: number;
    anio?: number;
  }): Promise<HitoMarketing[]> {
    const conditions = [];
    
    if (filters?.mes && filters?.anio) {
      // Filter by month and year
      const startDate = new Date(filters.anio, filters.mes - 1, 1);
      const endDate = new Date(filters.anio, filters.mes, 0);
      conditions.push(
        and(
          gte(hitosMarketing.fecha, startDate),
          lte(hitosMarketing.fecha, endDate)
        )
      );
    } else if (filters?.anio) {
      // Filter by year only
      const startDate = new Date(filters.anio, 0, 1);
      const endDate = new Date(filters.anio, 11, 31);
      conditions.push(
        and(
          gte(hitosMarketing.fecha, startDate),
          lte(hitosMarketing.fecha, endDate)
        )
      );
    }

    return await db
      .select()
      .from(hitosMarketing)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(hitosMarketing.fecha));
  }

  async getHitoMarketingById(id: string): Promise<HitoMarketing | undefined> {
    const [result] = await db
      .select()
      .from(hitosMarketing)
      .where(eq(hitosMarketing.id, id));
    return result;
  }

  async createHitoMarketing(data: InsertHitoMarketing): Promise<HitoMarketing> {
    const [result] = await db
      .insert(hitosMarketing)
      .values(data)
      .returning();
    return result;
  }

  async updateHitoMarketing(id: string, updates: Partial<InsertHitoMarketing>): Promise<HitoMarketing> {
    const [result] = await db
      .update(hitosMarketing)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(hitosMarketing.id, id))
      .returning();
    return result;
  }

  async deleteHitoMarketing(id: string): Promise<void> {
    await db
      .delete(hitosMarketing)
      .where(eq(hitosMarketing.id, id));
  }

  // ==================================================================================
  // INVENTORY operations
  // ==================================================================================
  
  async getInventory(filters?: {
    search?: string;
    warehouse?: string;
  }): Promise<any[]> {
    let query = db
      .select({
        id: productStock.id,
        productSku: productStock.productSku,
        productName: products.nokopr,
        warehouseCode: productStock.warehouseCode,
        warehouseName: warehouses.name,
        quantity: productStock.physicalStock1,
        reservedQuantity: productStock.committedStock1,
        availableQuantity: productStock.availableStock1,
        lastUpdated: productStock.lastUpdated,
      })
      .from(productStock)
      .leftJoin(products, eq(productStock.productSku, products.kopr))
      .leftJoin(warehouses, eq(productStock.warehouseCode, warehouses.code));
    
    const conditions = [];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(productStock.productSku, searchTerm),
          ilike(products.nokopr, searchTerm)
        )
      );
    }
    
    if (filters?.warehouse) {
      conditions.push(eq(productStock.warehouseCode, filters.warehouse));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query.orderBy(asc(productStock.productSku));
    
    return results.map(row => ({
      ...row,
      quantity: parseFloat(row.quantity as any) || 0,
      reservedQuantity: parseFloat(row.reservedQuantity as any) || 0,
      availableQuantity: parseFloat(row.availableQuantity as any) || 0,
    }));
  }
  
  async getInventorySummary(filters?: {
    search?: string;
    warehouse?: string;
  }): Promise<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    lowStock: number;
  }> {
    const inventory = await this.getInventory(filters);
    
    const totalProducts = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalAvailable = inventory.reduce((sum, item) => sum + item.availableQuantity, 0);
    const lowStock = inventory.filter(item => item.availableQuantity < 10 && item.availableQuantity > 0).length;
    
    return {
      totalProducts,
      totalQuantity,
      totalAvailable,
      lowStock,
    };
  }
  
  async getWarehouses(): Promise<{ code: string; name: string }[]> {
    const results = await db
      .select({
        code: warehouses.code,
        name: warehouses.name,
      })
      .from(warehouses)
      .orderBy(asc(warehouses.name));
    
    return results;
  }

  // ==================================================================================
  // GASTOS EMPRESARIALES operations
  // ==================================================================================

  async createGastoEmpresarial(gasto: InsertGastoEmpresarial): Promise<GastoEmpresarial> {
    const [result] = await db
      .insert(gastosEmpresariales)
      .values(gasto)
      .returning();
    return result;
  }

  async getGastosEmpresariales(filters?: {
    userId?: string;
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    categoria?: string;
    limit?: number;
    offset?: number;
  }): Promise<GastoEmpresarial[]> {
    let query = db.select().from(gastosEmpresariales);

    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(gastosEmpresariales.userId, filters.userId));
    }

    if (filters?.estado) {
      conditions.push(eq(gastosEmpresariales.estado, filters.estado));
    }

    if (filters?.fechaDesde) {
      conditions.push(gte(gastosEmpresariales.createdAt, new Date(filters.fechaDesde)));
    }

    if (filters?.fechaHasta) {
      conditions.push(lte(gastosEmpresariales.createdAt, new Date(filters.fechaHasta)));
    }

    if (filters?.categoria) {
      conditions.push(eq(gastosEmpresariales.categoria, filters.categoria));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(gastosEmpresariales.createdAt)) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  async getGastoEmpresarialById(id: string): Promise<GastoEmpresarial | undefined> {
    const [result] = await db
      .select()
      .from(gastosEmpresariales)
      .where(eq(gastosEmpresariales.id, id));
    return result;
  }

  async updateGastoEmpresarial(id: string, updates: Partial<InsertGastoEmpresarial>): Promise<GastoEmpresarial> {
    const [result] = await db
      .update(gastosEmpresariales)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(gastosEmpresariales.id, id))
      .returning();
    return result;
  }

  async deleteGastoEmpresarial(id: string): Promise<void> {
    await db
      .delete(gastosEmpresariales)
      .where(eq(gastosEmpresariales.id, id));
  }

  async aprobarGastoEmpresarial(id: string, supervisorId: string): Promise<GastoEmpresarial> {
    const [result] = await db
      .update(gastosEmpresariales)
      .set({
        estado: 'aprobado',
        supervisorId,
        fechaAprobacion: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(gastosEmpresariales.id, id))
      .returning();
    return result;
  }

  async rechazarGastoEmpresarial(id: string, supervisorId: string, comentario: string): Promise<GastoEmpresarial> {
    const [result] = await db
      .update(gastosEmpresariales)
      .set({
        estado: 'rechazado',
        supervisorId,
        comentarioRechazo: comentario,
        fechaAprobacion: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(gastosEmpresariales.id, id))
      .returning();
    return result;
  }

  async getGastosEmpresarialesSummary(filters?: {
    userId?: string;
    mes?: number;
    anio?: number;
  }): Promise<{
    totalGastos: number;
    totalAprobados: number;
    totalPendientes: number;
    totalRechazados: number;
    montoPendiente: number;
    montoAprobado: number;
  }> {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(gastosEmpresariales.userId, filters.userId));
    }

    if (filters?.mes && filters?.anio) {
      const startDate = new Date(filters.anio, filters.mes - 1, 1);
      const endDate = new Date(filters.anio, filters.mes, 0, 23, 59, 59);
      conditions.push(
        and(
          gte(gastosEmpresariales.createdAt, startDate),
          lte(gastosEmpresariales.createdAt, endDate)
        )
      );
    }

    let query = db.select().from(gastosEmpresariales);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const gastos = await query;

    const totalGastos = gastos.length;
    const totalAprobados = gastos.filter(g => g.estado === 'aprobado').length;
    const totalPendientes = gastos.filter(g => g.estado === 'pendiente').length;
    const totalRechazados = gastos.filter(g => g.estado === 'rechazado').length;

    const montoPendiente = gastos
      .filter(g => g.estado === 'pendiente')
      .reduce((sum, g) => sum + parseFloat(g.monto as any || '0'), 0);

    const montoAprobado = gastos
      .filter(g => g.estado === 'aprobado')
      .reduce((sum, g) => sum + parseFloat(g.monto as any || '0'), 0);

    return {
      totalGastos,
      totalAprobados,
      totalPendientes,
      totalRechazados,
      montoPendiente,
      montoAprobado,
    };
  }

  async getGastosEmpresarialesByCategoria(filters?: {
    userId?: string;
    mes?: number;
    anio?: number;
  }): Promise<Array<{
    categoria: string;
    total: number;
    cantidad: number;
  }>> {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(gastosEmpresariales.userId, filters.userId));
    }

    if (filters?.mes && filters?.anio) {
      const startDate = new Date(filters.anio, filters.mes - 1, 1);
      const endDate = new Date(filters.anio, filters.mes, 0, 23, 59, 59);
      conditions.push(
        and(
          gte(gastosEmpresariales.createdAt, startDate),
          lte(gastosEmpresariales.createdAt, endDate)
        )
      );
    }

    // Only count approved expenses for analytics
    conditions.push(eq(gastosEmpresariales.estado, 'aprobado'));

    const results = await db
      .select({
        categoria: gastosEmpresariales.categoria,
        total: sql<number>`SUM(${gastosEmpresariales.monto})`,
        cantidad: sql<number>`COUNT(*)`,
      })
      .from(gastosEmpresariales)
      .where(and(...conditions))
      .groupBy(gastosEmpresariales.categoria);

    return results.map(r => ({
      categoria: r.categoria || 'Sin categoría',
      total: parseFloat(r.total as any) || 0,
      cantidad: parseInt(r.cantidad as any) || 0,
    }));
  }

  async getGastosEmpresarialesByUser(filters?: {
    mes?: number;
    anio?: number;
  }): Promise<Array<{
    userId: string;
    userName: string;
    total: number;
    cantidad: number;
  }>> {
    const conditions = [];

    if (filters?.mes && filters?.anio) {
      const startDate = new Date(filters.anio, filters.mes - 1, 1);
      const endDate = new Date(filters.anio, filters.mes, 0, 23, 59, 59);
      conditions.push(
        and(
          gte(gastosEmpresariales.createdAt, startDate),
          lte(gastosEmpresariales.createdAt, endDate)
        )
      );
    }

    // Only count approved expenses for analytics
    conditions.push(eq(gastosEmpresariales.estado, 'aprobado'));

    const results = await db
      .select({
        userId: gastosEmpresariales.userId,
        userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${salespeopleUsers.salespersonName}, 'Usuario Desconocido')`,
        total: sql<number>`SUM(${gastosEmpresariales.monto})`,
        cantidad: sql<number>`COUNT(*)`,
      })
      .from(gastosEmpresariales)
      .leftJoin(users, eq(gastosEmpresariales.userId, users.id))
      .leftJoin(salespeopleUsers, eq(gastosEmpresariales.userId, salespeopleUsers.id))
      .where(and(...conditions))
      .groupBy(gastosEmpresariales.userId, users.firstName, users.lastName, salespeopleUsers.salespersonName);

    return results.map(r => ({
      userId: r.userId,
      userName: r.userName || 'Usuario Desconocido',
      total: parseFloat(r.total as any) || 0,
      cantidad: parseInt(r.cantidad as any) || 0,
    }));
  }

  // ==================================================================================
  // PROMESAS DE COMPRA operations
  // ==================================================================================
  
  async createPromesaCompra(promesa: InsertPromesaCompra): Promise<PromesaCompra> {
    const [newPromesa] = await db.insert(promesasCompra).values(promesa).returning();
    return newPromesa;
  }

  async getPromesasCompra(filters?: {
    vendedorId?: string;
    clienteId?: string;
    semana?: string;
    anio?: number;
    limit?: number;
    offset?: number;
  }): Promise<PromesaCompra[]> {
    const conditions = [];

    if (filters?.vendedorId) {
      conditions.push(eq(promesasCompra.vendedorId, filters.vendedorId));
    }

    if (filters?.clienteId) {
      conditions.push(eq(promesasCompra.clienteId, filters.clienteId));
    }

    if (filters?.semana) {
      conditions.push(eq(promesasCompra.semana, filters.semana));
    }

    if (filters?.anio) {
      conditions.push(eq(promesasCompra.anio, filters.anio));
    }

    let query = db.select().from(promesasCompra).orderBy(desc(promesasCompra.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  async getPromesaCompraById(id: string): Promise<PromesaCompra | undefined> {
    const [promesa] = await db.select().from(promesasCompra).where(eq(promesasCompra.id, id));
    return promesa;
  }

  async updatePromesaCompra(id: string, updates: Partial<InsertPromesaCompra>): Promise<PromesaCompra> {
    const [updated] = await db
      .update(promesasCompra)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(promesasCompra.id, id))
      .returning();
    return updated;
  }

  async deletePromesaCompra(id: string): Promise<void> {
    await db.delete(promesasCompra).where(eq(promesasCompra.id, id));
  }

  async getPromesasConCumplimiento(filters?: {
    vendedorId?: string;
    semana?: string;
    anio?: number;
  }): Promise<Array<{
    promesa: PromesaCompra;
    ventasReales: number;
    cumplimiento: number;
    estado: 'cumplido' | 'superado' | 'no_cumplido';
  }>> {
    const conditions = [];

    if (filters?.vendedorId) {
      conditions.push(eq(promesasCompra.vendedorId, filters.vendedorId));
    }

    if (filters?.semana) {
      conditions.push(eq(promesasCompra.semana, filters.semana));
    }

    if (filters?.anio) {
      conditions.push(eq(promesasCompra.anio, filters.anio));
    }

    let query = db.select().from(promesasCompra).orderBy(desc(promesasCompra.semana));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const promesas = await query;

    const resultados = await Promise.all(
      promesas.map(async (promesa) => {
        let ventasReales = 0;

        // Si hay ventas reales ingresadas manualmente, usar ese valor
        if (promesa.ventasRealesManual !== null && promesa.ventasRealesManual !== undefined) {
          ventasReales = parseFloat(promesa.ventasRealesManual as any);
        } 
        // Para clientes potenciales (PROSPECTO), no hay ventas reales automáticas
        else if (promesa.clienteTipo === 'potencial' || promesa.clienteId === 'PROSPECTO') {
          ventasReales = 0;
        }
        // Calcular ventas reales (facturas + NVV) para el cliente en la semana
        else {
          // Usar el nombre del cliente (clienteNombre) para buscar en sales_transactions
          const ventasFacturas = await db.execute(sql`
            SELECT COALESCE(SUM(monto), 0) as total
            FROM sales_transactions
            WHERE nokoen = ${promesa.clienteNombre}
              AND feemdo >= ${promesa.fechaInicio}
              AND feemdo <= ${promesa.fechaFin}
              AND tido IN ('FCV', 'FVL')
          `);

          const ventasNvv = await db.execute(sql`
            SELECT COALESCE(SUM(total_pendiente), 0) as total
            FROM nvv_pending_sales
            WHERE "NOKOEN" = ${promesa.clienteNombre}
              AND "FEEMLI" >= ${promesa.fechaInicio}
              AND "FEEMLI" <= ${promesa.fechaFin}
          `);

          const totalFacturas = parseFloat((ventasFacturas.rows[0] as any)?.total || '0');
          const totalNvv = parseFloat((ventasNvv.rows[0] as any)?.total || '0');
          ventasReales = totalFacturas + totalNvv;
        }

        const montoPrometido = parseFloat(promesa.montoPrometido as any);
        const cumplimiento = montoPrometido > 0 ? (ventasReales / montoPrometido) * 100 : 0;

        let estado: 'cumplido' | 'superado' | 'medianamente_cumplido' | 'cumplido_parcialmente' | 'no_cumplido';
        if (cumplimiento >= 100) {
          estado = cumplimiento > 100 ? 'superado' : 'cumplido';
        } else if (cumplimiento >= 70) {
          estado = 'medianamente_cumplido';
        } else if (cumplimiento > 0) {
          estado = 'cumplido_parcialmente';
        } else {
          estado = 'no_cumplido';
        }

        return {
          promesa,
          ventasReales,
          cumplimiento,
          estado,
        };
      })
    );

    return resultados;
  }

  // ==================================================================================
  // ETL operations implementation
  // ==================================================================================

  async getRunningETLExecution(etlName: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT id, etl_name, execution_date, status, period, watermark_date
      FROM ventas.etl_execution_log
      WHERE etl_name = ${etlName}
        AND status = 'running'
      ORDER BY execution_date DESC
      LIMIT 1
    `);
    
    return result.rows[0];
  }

  async cancelETLExecution(executionId: string, cancelledBy: string): Promise<void> {
    const now = new Date();
    const errorMessage = `Proceso cancelado manualmente por ${cancelledBy} el ${now.toLocaleString('es-CL')}`;
    
    await db.execute(sql`
      UPDATE ventas.etl_execution_log
      SET 
        status = 'cancelled',
        error_message = ${errorMessage},
        execution_time_ms = EXTRACT(EPOCH FROM (${now.toISOString()}::timestamp - execution_date)) * 1000
      WHERE id = ${executionId}
    `);
  }

}

export const storage = new DatabaseStorage();
