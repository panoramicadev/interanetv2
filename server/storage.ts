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
  crmLeads,
  crmComments,
  crmStages,
  clientesInactivos,
  apiKeys,
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
  type CrmLead,
  type InsertCrmLead,
  type CrmComment,
  type InsertCrmComment,
  type CrmStage,
  // Shopify-style products
  shopifyProducts,
  shopifyProductOptions,
  shopifyProductVariants,
  type ShopifyProduct,
  type InsertShopifyProduct,
  type ShopifyProductOption,
  type InsertShopifyProductOption,
  type ShopifyProductVariant,
  type InsertShopifyProductVariant,
  type ShopifyProductWithVariants,
  type InsertShopifyProductInput,
  type UpdateShopifyProductInput,
  type InsertShopifyProductVariantInput,
  type UpdateShopifyProductVariantInput,
  type InsertCrmStage,
  type ClienteInactivo,
  type InsertClienteInactivo,
  type ApiKey,
  type InsertApiKey,
  type InsertApiKeyInput,
  type NvvPendingSales,
  type InsertNvvPendingSales,
  type NvvImportResult,
  loyaltyTiers,
  loyaltyTierBenefits,
  type LoyaltyTier,
  type InsertLoyaltyTier,
  type LoyaltyTierBenefit,
  type InsertLoyaltyTierBenefit,
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
  // Mantención / CMMS module tables
  equiposCriticos,
  proveedoresMantencion,
  presupuestoMantencion,
  gastosMaterialesMantencion,
  mantencionesPlanificadas,
  planesPreventivos,
  solicitudesMantencion,
  mantencionPhotos,
  mantencionResolucionPhotos,
  mantencionHistorial,
  type EquipoCritico,
  type InsertEquipoCritico,
  type ProveedorMantencion,
  type InsertProveedorMantencion,
  type PresupuestoMantencion,
  type InsertPresupuestoMantencion,
  type GastoMaterialMantencion,
  type InsertGastoMaterialMantencion,
  type MantencionPlanificada,
  type InsertMantencionPlanificada,
  type PlanPreventivo,
  type InsertPlanPreventivo,
  type SolicitudMantencion,
  type InsertSolicitudMantencion,
  type MantencionPhoto,
  type InsertMantencionPhoto,
  type MantencionResolucionPhoto,
  type InsertMantencionResolucionPhoto,
  type MantencionHistorial,
  type InsertMantencionHistorial,
  // Marketing module tables
  presupuestoMarketing,
  solicitudesMarketing,
  inventarioMarketing,
  hitosMarketing,
  competidores,
  preciosCompetencia,
  productosMonitoreo,
  type PresupuestoMarketing,
  type InsertPresupuestoMarketing,
  type SolicitudMarketing,
  type InsertSolicitudMarketing,
  type InventarioMarketing,
  type Competidor,
  type InsertCompetidor,
  type PrecioCompetencia,
  type InsertPrecioCompetencia,
  type ProductoMonitoreo,
  type InsertProductoMonitoreo,
  type InsertInventarioMarketing,
  type HitoMarketing,
  type InsertHitoMarketing,
  // Tareas de marketing
  tareasMarketing,
  type TareaMarketing,
  type InsertTareaMarketing,
  // Gastos empresariales
  gastosEmpresariales,
  type GastoEmpresarial,
  type InsertGastoEmpresarial,
  // Gestión de Fondos
  fundAllocations,
  fundMovements,
  type FundAllocation,
  type InsertFundAllocation,
  type FundMovement,
  type InsertFundMovement,
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
  // Inventory hybrid system
  inventoryProducts,
  inventorySyncLog,
  insertInventoryProductSchema,
  insertInventorySyncLogSchema,
  type InsertInventoryProduct,
  type InsertInventorySyncLog,
  // Sales ETL system
  salesEtlSyncLog,
  // GDV ETL system
  factGdv,
  gdvSyncLog,
  type FactGdv,
  type GdvSyncLog,
  // NVV ETL system
  factNvv,
  nvvSyncLog,
  type FactNvv,
  type NvvSyncLog,
  type InsertNvvSyncLog,
  // Notifications system
  notifications,
  notificationReads,
  type Notification,
  type InsertNotification,
  type InsertNotificationInput,
  type NotificationRead,
  type InsertNotificationRead,
  // Proyecciones de ventas
  proyeccionesVentas,
  type ProyeccionVenta,
  type InsertProyeccionVenta,
  seoCampaigns,
  seoKeywords,
  seoPositionHistory,
  type SeoCampaign,
  type InsertSeoCampaign,
  type SeoKeyword,
  type InsertSeoKeyword,
  type SeoPositionHistory,
  type InsertSeoPositionHistory,
  type InsertProyeccionVentaInput,
  whatsappConfig,
  type WhatsAppConfig,
  taskComments,
  type TaskComment,
  type InsertTaskComment,
  integrations,
  type Integration,
  type InsertIntegration,
} from "@shared/schema";
import { mapToOperativeArea, RECLAMOS_AREAS, AREA_ESPECIFICA_TO_OPERATIVA } from "@shared/reclamosAreas";
import { db } from "./db";
import { eq, desc, asc, sql, and, gte, lte, lt, ne, inArray, or, isNull, isNotNull, ilike, count, not, aliasedTable, getTableColumns } from "drizzle-orm";
import { getComunaRegion } from "./chile-regions";
import { comunaRegionService } from "./comunaRegionService";
import mssql from 'mssql';
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

// Shared filter interface for NVV ETL queries
// Estado mapping: 'open' → eslido IS NULL OR eslido = '', 'closed' → eslido = 'C'
export interface NvvFilters {
  startDate?: string;
  endDate?: string;
  sucursales?: string[];
  vendedores?: string[];
  bodegas?: string[];
  estado?: 'open' | 'closed';
  pendingOnly?: boolean; // Solo registros con cantidad_pendiente=true
  minAmount?: number;
  maxAmount?: number;
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
    client?: string;
    product?: string;
  }): Promise<SalesTransaction[]>;
  getSalesMetrics(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
    client?: string;
  }): Promise<{
    totalSales: number;
    totalTransactions: number;
    salesTransactionCount: number;
    totalOrders: number;
    totalUnits: number;
    activeCustomers: number;
    gdvSales: number;
  }>;
  getTopSalespeople(limit?: number, startDate?: string, endDate?: string, segment?: string, client?: string, product?: string): Promise<{
    items: Array<{
      salesperson: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }>;
  searchSalespeople(searchTerm: string, startDate?: string, endDate?: string, segment?: string, client?: string, product?: string): Promise<Array<{
    name: string;
    totalSales: number;
    transactionCount: number;
  }>>;
  getSalespersonDetails(salespersonName: string, startDate?: string, endDate?: string, segment?: string): Promise<{
    totalSales: number;
    transactionCount: number;
    uniqueClients: number;
    averageTicket: number;
    topProducts: Array<{
      productName: string;
      sales: number;
    }>;
  } | null>;
  getTopProducts(limit?: number, startDate?: string, endDate?: string, salesperson?: string, segment?: string, client?: string): Promise<{
    items: Array<{
      productName: string;
      totalSales: number;
      totalUnits: number;
      transactionCount: number;
      averageOrderValue: number;
      percentage: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }>;
  getProductDetails(productName: string, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<{
    totalSales: number;
    totalUnits: number;
    uniqueClients: number;
    averageTicket: number;
    topSalesperson: string | null;
    topSalespersonSales: number;
    topClients: Array<{
      clientName: string;
      sales: number;
    }>;
  } | null>;
  getTopClients(limit?: number, startDate?: string, endDate?: string, salesperson?: string, segment?: string, product?: string): Promise<{
    items: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }>;
  getSegmentAnalysis(startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<Array<{
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
  getSalesChartData(period: 'weekly' | 'monthly' | 'daily', startDate?: string, endDate?: string, salesperson?: string, segment?: string, client?: string): Promise<Array<{
    period: string;
    sales: number;
  }>>;
  
  getAvailablePeriods(): Promise<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>;
  
  getYearlyTotals(year: number, filters?: { segment?: string; salesperson?: string; client?: string }): Promise<{
    currentYearTotal: number;
    previousYearTotal: number;
    comparisonYear: number;
    comparisonDate: string;
    isYTD: boolean;
  }>;
  
  getBestYearHistorical(filters?: { segment?: string; salesperson?: string; client?: string }): Promise<{
    bestYear: number;
    bestYearTotal: number;
  }>;
  
  // Packaging metrics operations
  getPackagingMetrics(filters?: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
    client?: string;
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
  getUniqueSalespeople(filters?: { startDate?: string; endDate?: string }): Promise<string[]>;
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
  
  getSalespersonSmartNotifications(salesperson: string): Promise<{
    inactiveClients: Array<{
      clientName: string;
      daysSinceLastPurchase: number;
      lastPurchaseAmount: number;
      totalHistoricalSales: number;
      lastPurchaseId: string;
    }>;
    seasonalClients: Array<{
      clientName: string;
      expectedPurchaseDate: string;
      averagePurchaseAmount: number;
      purchasePattern: string;
    }>;
    trendingProducts: Array<{
      productName: string;
      recentSales: number;
      growthRate: number;
      recommendation: string;
    }>;
  }>;

  getClientLastPurchaseDetails(salesperson: string, clientName: string): Promise<{
    lastPurchaseId: string;
    lastPurchaseDate: string;
    lastPurchaseAmount: number;
    products: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
    }>;
  } | null>;
  
  // Lead-specific recommendations for CRM
  fetchLeadRecommendations(leadId: string, salesperson: string, clientName: string): Promise<{
    clientActivity: {
      isInactive: boolean;
      daysSinceLastPurchase: number | null;
      lastPurchaseAmount: number | null;
      totalHistoricalSales: number | null;
    };
    isSeasonal: boolean;
    expectedPurchaseDate: string | null;
    averagePurchaseAmount: number | null;
    purchasePattern: string | null;
    trendingProducts: Array<{
      productName: string;
      recentSales: number;
      growthRate: number;
      recommendation: string;
    }>;
  }>;
  
  // Sales data for goals comparison
  getGlobalSalesForPeriod(period: string): Promise<number>;
  getSegmentSalesForPeriod(segment: string, period: string): Promise<number>;
  getSalespersonSalesForPeriod(salesperson: string, period: string): Promise<number>;
  
  // Segment detail operations
  getSegmentClients(segmentName: string, period?: string, filterType?: string): Promise<Array<{
    clientName: string;
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>>;
  getSegmentMonthlyBreakdown(segmentName: string, year: string): Promise<Array<{
    month: number;
    monthName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
  }>>;
  getSegmentSalespeople(segmentName: string, period?: string, filterType?: string): Promise<Array<{
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>>;
  getSegmentClientRecurrence(segmentName: string, period?: string, filterType?: string): Promise<{
    recurringCount: number;
    newCount: number;
  }>;
  
  // Branch detail operations
  getBranchClients(branchName: string, period?: string, filterType?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>>;
  getBranchSalespeople(branchName: string, period?: string, filterType?: string): Promise<Array<{
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>>;
  getBranchSalesForPeriod(branchName: string, period: string): Promise<number>;
  
  // Salesperson detail operations
  getSalespersonDetails(salespersonName: string, period?: string, filterType?: string): Promise<{
    totalSales: number;
    totalClients: number;
    transactionCount: number;
    averageTicket: number;
    newClients: number; // clientes que compraron por primera vez al vendedor en el período
    salesFrequency: number; // days between sales (average)
    daysSinceLastSale: number; // actual days since last sale
    lastSaleDate: string | null; // date of last sale
  }>;
  getSalespersonClients(salespersonName: string, period?: string, filterType?: string, segment?: string, limit?: number): Promise<{
    items: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
      averageTicket: number;
      lastSale: string;
      daysSinceLastSale: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }>;
  searchSalespersonClients(salespersonName: string, searchTerm: string, period?: string, filterType?: string, segment?: string): Promise<Array<{
    name: string;
    totalSales: number;
    transactionCount: number;
  }>>;
  getSalespersonClientDetails(salespersonName: string, clientName: string, period: string, filterType: string): Promise<{
    totalSales: number;
    lastSaleDate: string | null;
    transactionCount: number;
    products: Array<{
      productName: string;
      totalSales: number;
      units: number;
    }>;
  }>;
  getSalespersonProducts(salespersonName: string, period?: string, filterType?: string, segment?: string, limit?: number): Promise<{
    items: Array<{
      productName: string;
      totalSales: number;
      transactionCount: number;
      averagePrice: number;
      lastSale: string;
      totalUnits: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }>;
  searchSalespersonProducts(salespersonName: string, searchTerm: string, period?: string, filterType?: string, segment?: string): Promise<Array<{
    name: string;
    totalSales: number;
    transactionCount: number;
  }>>;
  getSalespersonProductDetails(salespersonName: string, productName: string, period: string, filterType: string): Promise<{
    totalSales: number;
    totalUnits: number;
    topClient: { name: string; amount: number } | null;
    clients: Array<{ name: string; amount: number }>;
    transactionCount: number;
  }>;
  getSalespersonRecentTransactions(salespersonName: string, limit?: number): Promise<Array<{
    date: string;
    client: string;
    product: string;
    quantity: number;
    amount: number;
    docType: string;
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
  initializePublicCatalogs(): Promise<{ updated: number; skipped: number }>;
  
  // Session management
  invalidateUserSessions(userId: string): Promise<void>;
  
  // Supervisor specific methods
  getSalespeopleUnderSupervisor(supervisorId: string): Promise<Array<{
    id: string;
    salespersonName: string;
    email: string;
    assignedSegment?: string | null;
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
    groupId?: string | null;
    variantLabel?: string | null;
    isMainVariant?: boolean;
    productFamily?: string | null;
    color?: string | null;
    variantParentSku?: string | null;
    variantGenericDisplayName?: string | null;
    variantIndex?: number;
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
  bulkAssignProductsToGroup(productIds: string[], groupId: string): Promise<{ count: number }>;
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
  
  // Shopify-style Product operations
  createShopifyProduct(product: InsertShopifyProductInput): Promise<ShopifyProduct>;
  getShopifyProducts(filters?: {
    search?: string;
    category?: string;
    status?: 'draft' | 'active' | 'archived';
    productType?: string;
    limit?: number;
    offset?: number;
  }): Promise<ShopifyProductWithVariants[]>;
  getShopifyProduct(id: string): Promise<ShopifyProductWithVariants | null>;
  getShopifyProductByHandle(handle: string): Promise<ShopifyProductWithVariants | null>;
  updateShopifyProduct(id: string, updates: UpdateShopifyProductInput): Promise<ShopifyProduct>;
  deleteShopifyProduct(id: string): Promise<void>;
  
  // Shopify Product Options
  createShopifyProductOption(option: InsertShopifyProductOption): Promise<ShopifyProductOption>;
  updateShopifyProductOptions(productId: string, options: Array<{ name: string; values: string[] }>): Promise<ShopifyProductOption[]>;
  
  // Shopify Product Variants
  createShopifyProductVariant(variant: InsertShopifyProductVariantInput): Promise<ShopifyProductVariant>;
  updateShopifyProductVariant(id: string, updates: UpdateShopifyProductVariantInput): Promise<ShopifyProductVariant>;
  deleteShopifyProductVariant(id: string): Promise<void>;
  getShopifyVariantBySku(sku: string): Promise<ShopifyProductVariant | null>;
  
  // Import from CSV
  importShopifyProductsFromCsv(csvData: any[]): Promise<{
    productsCreated: number;
    variantsCreated: number;
    errors: string[];
  }>;
  
  // Import ecommerce products from new catalog CSV format
  importEcommerceProductsFromCatalogCsv(csvData: any[]): Promise<{
    productsCreated: number;
    productsUpdated: number;
    errors: string[];
  }>;
  
  // Clear all ecommerce products
  clearAllEcommerceProducts(): Promise<{ deletedCount: number }>;
  
  // eCommerce Orders operations
  createEcommerceOrder(order: any): Promise<any>;
  getEcommerceOrders(filters?: {
    clientId?: string;
    salespersonId?: string;
    status?: string;
  }): Promise<any[]>;
  
  // Public Catalog operations
  getPublicSalespersonBySlug(slug: string): Promise<{
    id: string;
    salespersonName: string;
    publicSlug: string;
    profileImageUrl?: string | null;
    publicPhone?: string | null;
    publicEmail?: string | null;
    bio?: string | null;
    catalogEnabled: boolean;
  } | null>;
  getPublicCatalogProducts(): Promise<Array<{
    id: string;
    codigo: string;
    producto: string;
    unidad?: string | null;
    precio: number;
    categoria?: string | null;
    descripcion?: string | null;
    imagenUrl?: string | null;
    productFamily?: string | null;
    color?: string | null;
  }>>;
  getGroupedCatalogProducts(): Promise<Array<{
    family: string;
    imagenUrl: string | null;
    categoria: string | null;
    descripcion: string | null;
    colors: Array<{
      color: string;
      formats: Array<{
        id: string;
        codigo: string;
        unidad: string;
        precio: number;
        imagenUrl: string | null;
      }>;
    }>;
  }>>;
  createPublicQuoteRequest(salespersonId: string, quoteData: any): Promise<any>;
  
  // Notification operations
  createNotification(notification: any): Promise<any>;
  
  // Helper operations
  getAdminUserId(): Promise<string | null>;
  
  // Notification automation methods
  checkAndNotifyLowStock(): Promise<void>;
  notifyNewSale(saleData: { clientName: string; amount: number; salesperson: string; documentNumber: string }): Promise<void>;
  
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
  getClientByRut(rut: string): Promise<Client | undefined>;
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
  
  // Task comments - sistema de comentarios en hilo
  getTaskComments(assignmentId: string): Promise<TaskComment[]>;
  addTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  deleteTaskComment(commentId: string, authorId: string): Promise<void>;
  
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
  updateResolucionLaboratorio(id: string, informe: string, categoriaResponsable: string, photos: Array<{ photoUrl: string; description?: string }>, userId: string, userName: string, documents?: Array<{ fileName: string; fileData: string; mimeType: string }>): Promise<ReclamoGeneral | null>;
  getReclamoGeneralResolucionPhotos(reclamoId: string): Promise<any[]>;
  
  // Resolución genérica para cualquier área responsable
  updateResolucionArea(id: string, resolucionDescripcion: string, photos: Array<{ photoUrl: string; description?: string }>, userId: string, userName: string, userRole: string, documents?: Array<{ fileName: string; fileData: string; mimeType: string }>): Promise<ReclamoGeneral | null>;
  
  // Cerrar reclamo
  cerrarReclamoGeneral(id: string, userId: string, userName: string, notas?: string, photos?: Array<{ photoUrl: string; description?: string }>): Promise<ReclamoGeneral>;

  // ==================================================================================
  // MANTENCIÓN MODULE operations
  // ==================================================================================
  
  // Solicitudes de Mantención operations
  createSolicitudMantencion(solicitud: InsertSolicitudMantencion): Promise<SolicitudMantencion>;
  getSolicitudesMantencion(filters?: {
    solicitanteId?: string;
    tecnicoAsignadoId?: string;
    estado?: string;
    gravedad?: string;
    area?: string;
    limit?: number;
    offset?: number;
  }): Promise<SolicitudMantencion[]>;
  getSolicitudMantencionById(id: string): Promise<SolicitudMantencion | undefined>;
  updateSolicitudMantencion(id: string, updates: Partial<InsertSolicitudMantencion>): Promise<SolicitudMantencion>;
  deleteSolicitudMantencion(id: string): Promise<void>;

  // Mantención Photos operations
  createMantencionPhoto(photo: InsertMantencionPhoto): Promise<MantencionPhoto>;
  getMantencionPhotos(mantencionId: string): Promise<MantencionPhoto[]>;
  deleteMantencionPhoto(id: string): Promise<void>;

  // Mantención Historial operations
  createMantencionHistorial(historial: InsertMantencionHistorial): Promise<MantencionHistorial>;
  getMantencionHistorial(mantencionId: string): Promise<MantencionHistorial[]>;

  // Combined operations
  getSolicitudMantencionWithDetails(id: string): Promise<(SolicitudMantencion & { 
    photos: MantencionPhoto[];
    historial: MantencionHistorial[];
    resolucionPhotos: MantencionResolucionPhoto[];
  }) | undefined>;
  
  // Asignar técnico
  assignTecnicoToMantencion(id: string, tecnicoId: string, tecnicoName: string, userId: string, userName: string): Promise<SolicitudMantencion>;
  
  // Cambiar estado
  updateMantencionEstado(id: string, nuevoEstado: string, userId: string, userName: string, notas?: string): Promise<SolicitudMantencion>;
  
  // Resolución (solo produccion)
  updateResolucionMantencion(id: string, resolucionDescripcion: string, photos: Array<{ photoUrl: string; description?: string }>, userId: string, userName: string, costoReal?: number, tiempoReal?: number, repuestosUtilizados?: string): Promise<SolicitudMantencion | null>;
  getMantencionResolucionPhotos(mantencionId: string): Promise<MantencionResolucionPhoto[]>;
  
  // Cerrar solicitud de mantención
  cerrarMantencion(id: string, userId: string, userName: string, notas?: string): Promise<SolicitudMantencion>;

  // ==================================================================================
  // CMMS - SISTEMA DE GESTIÓN DE MANTENIMIENTO
  // ==================================================================================
  
  // ===== EQUIPOS CRÍTICOS =====
  createEquipoCritico(equipo: InsertEquipoCritico): Promise<EquipoCritico>;
  getEquiposCriticos(filters?: { 
    area?: string; 
    criticidad?: string;
    estadoActual?: string;
  }): Promise<EquipoCritico[]>;
  getEquipoCriticoById(id: string): Promise<EquipoCritico | undefined>;
  getEquipoCriticoByCodigo(codigo: string): Promise<EquipoCritico | undefined>;
  updateEquipoCritico(id: string, updates: Partial<InsertEquipoCritico>): Promise<EquipoCritico>;
  deleteEquipoCritico(id: string): Promise<void>;
  getComponentesDeEquipo(equipoPadreId: string): Promise<EquipoCritico[]>;
  getEquiposPrincipales(): Promise<EquipoCritico[]>;
  
  // ===== PROVEEDORES EXTERNOS =====
  createProveedorMantencion(proveedor: InsertProveedorMantencion): Promise<ProveedorMantencion>;
  getProveedoresMantencion(filters?: { activo?: boolean }): Promise<ProveedorMantencion[]>;
  getProveedorMantencionById(id: string): Promise<ProveedorMantencion | undefined>;
  updateProveedorMantencion(id: string, updates: Partial<InsertProveedorMantencion>): Promise<ProveedorMantencion>;
  deleteProveedorMantencion(id: string): Promise<void>;
  
  // ===== PRESUPUESTO ANUAL =====
  createPresupuestoMantencion(presupuesto: InsertPresupuestoMantencion): Promise<PresupuestoMantencion>;
  getPresupuestosMantencion(filters?: { anio?: number; area?: string }): Promise<PresupuestoMantencion[]>;
  getPresupuestoMantencionByPeriod(anio: number, mes: number, area?: string): Promise<PresupuestoMantencion | undefined>;
  updatePresupuestoMantencion(id: string, updates: Partial<InsertPresupuestoMantencion>): Promise<PresupuestoMantencion>;
  deletePresupuestoMantencion(id: string): Promise<void>;
  
  // ===== GASTOS DE MATERIALES =====
  createGastoMaterialMantencion(gasto: InsertGastoMaterialMantencion): Promise<GastoMaterialMantencion>;
  getGastosMaterialesMantencion(filters?: {
    otId?: string;
    area?: string;
    anio?: string;
    mes?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: GastoMaterialMantencion[], total: number, costoPeriodo: number, page: number, pageSize: number }>;
  getGastoMaterialMantencionById(id: string): Promise<GastoMaterialMantencion | undefined>;
  updateGastoMaterialMantencion(id: string, updates: Partial<InsertGastoMaterialMantencion>): Promise<GastoMaterialMantencion>;
  deleteGastoMaterialMantencion(id: string): Promise<void>;
  getGastosMaterialesForExport(filters?: {
    area?: string;
    anio?: string;
    mes?: string;
  }): Promise<Array<GastoMaterialMantencion & {
    ot?: {
      id: string;
      equipoNombre: string;
      descripcionProblema: string;
      estado: string;
      gravedad: string;
    } | null;
    proveedor?: {
      id: string;
      nombre: string;
      contacto: string | null;
    } | null;
  }>>;
  
  // ===== PLANES PREVENTIVOS =====
  createPlanPreventivo(plan: InsertPlanPreventivo): Promise<PlanPreventivo>;
  getPlanesPreventivos(filters?: { 
    equipoId?: string;
    activo?: boolean;
  }): Promise<PlanPreventivo[]>;
  getPlanPreventivoById(id: string): Promise<PlanPreventivo | undefined>;
  getPlanesPreventivosVencidos(): Promise<PlanPreventivo[]>;
  updatePlanPreventivo(id: string, updates: Partial<InsertPlanPreventivo>): Promise<PlanPreventivo>;
  deletePlanPreventivo(id: string): Promise<void>;
  
  // ===== MANTENCIONES PLANIFICADAS (Proyectos grandes futuros) =====
  createMantencionPlanificada(mantencion: InsertMantencionPlanificada): Promise<MantencionPlanificada>;
  getMantencionesPlanificadas(filters?: {
    anio?: number;
    estado?: string;
    area?: string;
  }): Promise<MantencionPlanificada[]>;
  getMantencionPlanificadaById(id: string): Promise<MantencionPlanificada | undefined>;
  updateMantencionPlanificada(id: string, updates: Partial<InsertMantencionPlanificada>): Promise<MantencionPlanificada>;
  deleteMantencionPlanificada(id: string): Promise<void>;
  getPresupuestoEjecutadoDelMes(anio: number, mes: number, area?: string): Promise<number>;
  getMantencionesPlanificadasDelMes(anio: number, mes: number, area?: string): Promise<MantencionPlanificada[]>;
  
  // ===== KPIs Y DASHBOARDS CMMS =====
  getCMMSMetrics(filters?: {
    startDate?: string;
    endDate?: string;
    area?: string;
  }): Promise<{
    totalOTs: number;
    // OT por estado real (estados actuales del sistema)
    otsRegistradas: number;
    otsProgramadas: number;
    otsEnReparacion: number;
    otsPausadas: number;
    otsResueltas: number;
    otsCerradas: number;
    // Tipo de mantención
    mttr: number;
    preventivas: number;
    correctivas: number;
    // Costos
    costoTotal: number;
    costoPlanificado: number;
    costoDesviacion: number;
    // Equipos por estado real (usando estadoActual)
    equiposCriticos: number;
    equiposOperativos: number;
    equiposEnMantencion: number;
    equiposDetenidos: number;
    equiposFueraDeServicio: number;
    // Otros contadores
    proveedoresActivos: number;
    planesPreventivosActivos: number;
    planesVencidos: number;
    mantencionesPlanificadasTotal: number;
    mantencionesPlanificadasAprobadas: number;
    mantencionesPlanificadasCosto: number;
  }>;

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
  
  // Solicitantes de marketing (admin, supervisor, vendedor)
  getMarketingSolicitantes(): Promise<Array<{
    id: number;
    name: string;
    role: string;
  }>>;

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
  
  getInventoryWithPrices(filters?: {
    search?: string;
    warehouse?: string;
    branch?: string;
  }): Promise<any[]>;
  
  getInventorySummary(filters?: {
    search?: string;
    warehouse?: string;
    branch?: string;
  }): Promise<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    lowStock: number;
  }>;
  
  getInventorySummaryWithPrices(filters?: {
    search?: string;
    warehouse?: string;
    branch?: string;
    hideNoStock?: boolean;
    hideZZProducts?: boolean;
  }): Promise<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    totalValue: number;
    lowStock: number;
  }>;
  
  getWarehouses(branch?: string): Promise<{ code: string; name: string }[]>;
  getBranches(): Promise<{ code: string; name: string }[]>;

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
  getGastosEmpresarialesByDia(filters?: {
    userId?: string;
    mes?: number;
    anio?: number;
  }): Promise<Array<{
    dia: string;
    total: number;
    cantidad: number;
  }>>;

  // ==================================================================================
  // GESTIÓN DE FONDOS operations
  // ==================================================================================
  
  createFundAllocation(allocation: InsertFundAllocation): Promise<FundAllocation>;
  getFundAllocations(filters?: {
    assignedToId?: string;
    assignedById?: string;
    estado?: string;
    userScope?: string;
    limit?: number;
    offset?: number;
  }): Promise<FundAllocation[]>;
  getFundAllocationById(id: string): Promise<FundAllocation | undefined>;
  updateFundAllocation(id: string, updates: Partial<InsertFundAllocation>): Promise<FundAllocation>;
  closeFundAllocation(id: string): Promise<FundAllocation>;
  approveFundAllocation(id: string, comprobanteUrl: string, aprobadoPorId: string): Promise<FundAllocation>;
  rejectFundAllocation(id: string, motivoRechazo: string, rechazadoPorId: string): Promise<FundAllocation>;
  deleteFundAllocation(id: string): Promise<void>;
  
  createFundMovement(movement: InsertFundMovement): Promise<FundMovement>;
  getFundMovements(allocationId: string): Promise<FundMovement[]>;
  
  getFundAllocationBalance(allocationId: string): Promise<{
    montoInicial: number;
    totalComprometido: number;
    totalAprobado: number;
    saldoDisponible: number;
  }>;
  
  getUserActiveFundAllocations(userId: string): Promise<Array<FundAllocation & {
    saldoDisponible: number;
  }>>;
  
  getFundAllocationSummary(userId?: string): Promise<{
    totalAsignado: number;
    totalComprometido: number;
    totalAprobado: number;
    saldoDisponible: number;
    asignacionesActivas: number;
  }>;

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
    startDate?: string;
    endDate?: string;
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
  cancelETLExecution(executionId: string, cancelledBy: string, etlName?: string): Promise<void>;
  getLastSalesWatermark(): Promise<Date | null>;

  // ==================================================================================
  // NOTIFICATIONS operations - Sistema robusto de notificaciones internas
  // ==================================================================================
  
  createNotification(notification: InsertNotificationInput): Promise<Notification>;
  getNotificationsForUser(
    userId: string, 
    userRole: string, 
    userSegment?: string | null,
    filters?: {
      isArchived?: boolean;
      type?: string;
      priority?: string;
      department?: string;
    }
  ): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string, userRole: string, userSegment?: string | null): Promise<number>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<boolean>;
  archiveNotification(notificationId: string, userId: string): Promise<boolean>;
  getNotificationReads(notificationId: string): Promise<Array<{
    userId: string;
    userName: string;
    readAt: Date;
  }>>;

  // ==================================================================================
  // PROYECCIONES DE VENTAS operations - Sistema de proyección manual
  // ==================================================================================
  
  getHistoricoVentasPorAnio(filters?: {
    years?: number[];
    months?: number[];
    salespersonCode?: string;
  }): Promise<Array<{
    year: number;
    month?: number;
    salespersonCode: string;
    salespersonName: string;
    clientCode: string;
    clientName: string;
    segment: string;
    totalSales: number;
    purchaseFrequency: number;
  }>>;
  
  getYearsWithData(): Promise<number[]>;
  
  getSalespeopleList(): Promise<Array<{
    code: string;
    name: string;
  }>>;
  
  getSalespeopleBySegment(segment: string): Promise<Array<{
    code: string;
    name: string;
  }>>;
  
  getSegmentsList(): Promise<Array<{
    code: string;
    name: string;
  }>>;
  
  upsertProyeccionVenta(proyeccion: InsertProyeccionVentaInput): Promise<ProyeccionVenta>;
  
  getProyeccionesVentas(filters?: {
    years?: number[];
    months?: number[];
    salespersonCode?: string;
    segment?: string;
  }): Promise<ProyeccionVenta[]>;
  
  getProyeccionById(id: string): Promise<ProyeccionVenta | undefined>;
  
  deleteProyeccionVenta(id: string): Promise<void>;

  // GDV ETL operations
  getGdvSyncHistory(limit?: number, offset?: number): Promise<GdvSyncLog[]>;
  getGdvSummary(filters?: {
    startDate?: string;
    endDate?: string;
    sucursales?: string[];
  }): Promise<{
    totalGdv: number;
    totalAbiertas: number;
    totalCerradas: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
  }>;
  getGdvBySucursal(filters?: {
    startDate?: string;
    endDate?: string;
    sucursales?: string[];
  }): Promise<Array<{
    sucursal: string;
    totalGdv: number;
    abiertas: number;
    cerradas: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
  }>>;

  // NVV ETL operations
  getNvvSyncHistory(limit?: number, offset?: number): Promise<NvvSyncLog[]>;
  getNvvStateChanges(params: { executionId?: string; limit?: number; offset?: number }): Promise<{
    changes: Array<{
      id: string;
      executionId: string;
      idmaeedo: string;
      nudo: string | null;
      sudo: string | null;
      changeType: string;
      previousStatus: string | null;
      newStatus: string;
      monto: string | null;
      changedAt: Date;
      executionStartTime: Date | null;
      executionEndTime: Date | null;
      watermarkStart: string | null;
      watermarkEnd: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }>;
  getNvvSummary(filters?: NvvFilters): Promise<{
    totalNvv: number;
    totalAbiertas: number;
    totalCerradas: number;
    totalPendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>;
  getNvvBySucursal(filters?: NvvFilters): Promise<Array<{
    sudo: string;
    nosudo: string;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>>;
  getNvvByVendedor(filters?: NvvFilters): Promise<Array<{
    kofulido: string;
    nombre_vendedor: string;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>>;
  getNvvByBodega(filters?: NvvFilters): Promise<Array<{
    bosulido: string;
    nombre_bodega: string;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>>;
  getNvvBySegmentoCliente(filters?: NvvFilters): Promise<Array<{
    ruen: string | null;
    nombre_segmento_cliente: string | null;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>>;
  getNvvDocuments(filters?: NvvFilters & {
    limit?: number;
    offset?: number;
  }): Promise<{
    documents: Array<{
      nudo: string;
      feemdo: Date | null;
      sudo: string;
      nosudo: string;
      nokoen: string | null;
      kofulido: string | null;
      nombre_vendedor: string | null;
      bosulido: string | null;
      nombre_bodega: string | null;
      eslido: string | null;
      monto: number;
      cantidad_pendiente: boolean;
    }>;
    total: number;
  }>;

  // Loyalty Program (Panoramica Market)
  getLoyaltyTiers(): Promise<LoyaltyTier[]>;
  getLoyaltyTierByCode(code: string): Promise<LoyaltyTier | undefined>;
  createLoyaltyTier(tier: Omit<InsertLoyaltyTier, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoyaltyTier>;
  updateLoyaltyTier(id: string, tier: Partial<InsertLoyaltyTier>): Promise<LoyaltyTier | undefined>;
  deleteLoyaltyTier(id: string): Promise<boolean>;
  getLoyaltyTierBenefits(tierId: string): Promise<LoyaltyTierBenefit[]>;
  createLoyaltyTierBenefit(benefit: Omit<InsertLoyaltyTierBenefit, 'id' | 'createdAt'>): Promise<LoyaltyTierBenefit>;
  updateLoyaltyTierBenefit(id: string, benefit: Partial<InsertLoyaltyTierBenefit>): Promise<LoyaltyTierBenefit | undefined>;
  deleteLoyaltyTierBenefit(id: string): Promise<boolean>;
  getClientsByLoyaltyTier(tierId: string): Promise<Array<{
    clientName: string;
    clientCode: string | null;
    totalSales: number;
    transactionCount: number;
    tierCode: string;
    tierName: string;
  }>>;
  getClientLoyaltyStatus(clientName: string): Promise<{
    currentTier: LoyaltyTier | null;
    totalSalesLast90Days: number;
    transactionsLast90Days: number;
    nextTier: LoyaltyTier | null;
    amountToNextTier: number;
  } | null>;

  // WhatsApp Configuration
  getWhatsAppConfig(): Promise<WhatsAppConfig | undefined>;
  saveWhatsAppConfig(config: { phoneNumberId: string; businessAccountId: string; accessToken: string; webhookVerifyToken: string }): Promise<void>;
  updateWhatsAppConnectionStatus(status: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Inventory cache system with TTL and mutex per filter key
  private inventoryCacheMap = new Map<string, {
    data: any[];
    timestamp: number;
    inFlightPromise: Promise<any[]> | null;
  }>();
  
  private readonly INVENTORY_CACHE_TTL = 30000; // 30 seconds

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
        publicSlug: salespersonUser.publicSlug,
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
        publicSlug: salespersonUser.publicSlug,
      } as User;
    }

    return undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: [users.id],
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
        .select({ idmaeedo: factVentas.idmaeedo })
        .from(factVentas)
        .where(inArray(factVentas.idmaeedo, validBatchIds)) : [];
      
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

  // Note: This method queries fact_ventas (ETL table), not salesTransactions (legacy CSV import table)
  // Returns a subset of fields mapped for frontend consumption in Facturas module
  async getSalesTransactions(filters: {
    startDate?: string;
    endDate?: string;
    salesperson?: string;
    segment?: string;
    limit?: number;
    offset?: number;
    client?: string;
    product?: string;
  } = {}): Promise<SalesTransaction[]> {
    const { startDate, endDate, salesperson, segment, limit = 50, offset = 0, client, product } = filters;
    
    const conditions = [
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    if (client) {
      conditions.push(eq(factVentas.nokoen, client));
    }
    if (product) {
      conditions.push(eq(factVentas.nokoar, product));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Map nokoprct to nokopr for frontend compatibility
    const result = await db.select({
      idmaeedo: factVentas.idmaeedo,
      idmaeddo: factVentas.idmaeddo,
      tido: factVentas.tido,
      nudo: factVentas.nudo,
      feemdo: factVentas.feemdo,
      nokoen: factVentas.nokoen,
      nokofu: factVentas.nokofu,
      noruen: factVentas.noruen,
      nokopr: factVentas.nokoprct, // Map nokoprct to nokopr
      caprco2: factVentas.caprco2,
      monto: factVentas.monto,
      esdo: factVentas.esdo,
    })
      .from(factVentas)
      .where(whereClause)
      .orderBy(desc(factVentas.feemdo))
      .limit(limit)
      .offset(offset);
    
    return result as any;
  }

  // Helper function for date range normalization  
  private normalizeDateForSQL(startDate?: string, endDate?: string): {
    startDateCondition?: any;
    endDateCondition?: any;
  } {
    const conditions: any = {};
    
    if (startDate) {
      conditions.startDateCondition = sql`${factVentas.feemdo} >= ${startDate}::date`;
    }
    
    if (endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.endDateCondition = sql`${factVentas.feemdo} < ${endDateExclusive}::date`;
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
    product?: string;
  } = {}): Promise<{
    totalSales: number;
    totalTransactions: number;
    salesTransactionCount: number;
    totalOrders: number;
    totalUnits: number;
    activeCustomers: number;
    gdvSales: number;
  }> {
    const { startDate, endDate, salesperson, segment, client, supplier, product } = filters;
    const conditions = [];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    if (client) {
      conditions.push(eq(factVentas.nokoen, client));
    }
    if (product) {
      conditions.push(eq(factVentas.nokoprct, product));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Calculate metrics using fact_ventas
    // totalSales EXCLUDES ALL GDV (Guías de Despacho are not sales, tracked separately)
    // salesTransactionCount excludes GDV to align with totalSales for averageTicket calculation
    // gdvSales is calculated separately for TIDO = 'GDV' transactions only (excluding cancelled)
    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} != 'GDV' THEN ${factVentas.monto} ELSE 0 END), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
        salesTransactionCount: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} != 'GDV' THEN 1 ELSE 0 END), 0)`,
        totalOrders: sql<number>`COUNT(DISTINCT ${factVentas.nudo})`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
        activeCustomers: sql<number>`COUNT(DISTINCT ${factVentas.nokoen})`,
        gdvSales: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' AND (${factVentas.esdo} IS NULL OR ${factVentas.esdo} != 'C') THEN ${factVentas.monto} ELSE 0 END), 0)`,
      })
      .from(factVentas)
      .where(whereClause);

    return {
      totalSales: Number(metrics.totalSales),
      totalTransactions: Number(metrics.totalTransactions),
      salesTransactionCount: Number(metrics.salesTransactionCount),
      totalOrders: Number(metrics.totalOrders),
      totalUnits: Number(metrics.totalUnits),
      activeCustomers: Number(metrics.activeCustomers),
      gdvSales: Number(metrics.gdvSales),
    };
  }

  // Get global GDV pending (no date filters) - all GDV where esdo IS NULL or esdo != 'C'
  async getGdvPendingGlobal(filters: {
    salesperson?: string;
    segment?: string;
    client?: string;
  } = {}): Promise<{
    gdvSales: number;
    gdvCount: number;
  }> {
    const { salesperson, segment, client } = filters;
    const conditions = [];
    
    // GDV uses volatile data from fact_gdv (full snapshot like NVV)
    // Filter by eslido (line status) and cantidadPendiente for pending lines
    conditions.push(
      or(
        isNull(factGdv.eslido),
        eq(factGdv.eslido, '')
      )
    );
    conditions.push(eq(factGdv.cantidadPendiente, true));
    
    if (salesperson) {
      conditions.push(eq(factGdv.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factGdv.noruen, segment));
    }
    if (client) {
      conditions.push(eq(factGdv.nokoen, client));
    }

    const whereClause = and(...conditions);

    const [metrics] = await db
      .select({
        gdvSales: sql<number>`COALESCE(SUM(${factGdv.vaneli}), 0)`,
        gdvCount: sql<number>`COUNT(DISTINCT ${factGdv.idmaeedo})`,
      })
      .from(factGdv)
      .where(whereClause);

    return {
      gdvSales: Number(metrics.gdvSales),
      gdvCount: Number(metrics.gdvCount),
    };
  }

  async getYearlyTotals(year: number, filters?: { segment?: string; salesperson?: string; client?: string }): Promise<{
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

    // Build filter conditions
    const baseConditions = [
      sql`${factVentas.tido} != 'GDV'`
    ];
    if (filters?.segment) {
      baseConditions.push(eq(factVentas.noruen, filters.segment));
    }
    if (filters?.salesperson) {
      baseConditions.push(eq(factVentas.nokofu, filters.salesperson));
    }
    if (filters?.client) {
      baseConditions.push(eq(factVentas.nokoen, filters.client));
    }

    // Get requested year total (excluding ALL GDV)
    const [requestedYearMetrics] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(
        and(
          sql`${factVentas.feemdo} >= ${requestedYearStart}::date`,
          sql`${factVentas.feemdo} <= ${requestedYearEnd}::date`,
          ...baseConditions
        )
      );

    // Get previous year total (excluding ALL GDV) - same period
    const [previousYearMetrics] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(
        and(
          sql`${factVentas.feemdo} >= ${previousYearStart}::date`,
          sql`${factVentas.feemdo} <= ${previousYearEnd}::date`,
          ...baseConditions
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

  async getBestYearHistorical(filters?: { segment?: string; salesperson?: string; client?: string }): Promise<{
    bestYear: number;
    bestYearTotal: number;
  }> {
    // Build filter conditions
    const conditions = [
      sql`${factVentas.tido} != 'GDV'`
    ];
    if (filters?.segment) {
      conditions.push(eq(factVentas.noruen, filters.segment));
    }
    if (filters?.salesperson) {
      conditions.push(eq(factVentas.nokofu, filters.salesperson));
    }
    if (filters?.client) {
      conditions.push(eq(factVentas.nokoen, filters.client));
    }

    // Get sales by year (excluding ALL GDV)
    const yearlyTotals = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${factVentas.feemdo})`,
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(YEAR FROM ${factVentas.feemdo})`)
      .orderBy(sql`COALESCE(SUM(${factVentas.monto}), 0) DESC`)
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

  async getTopSalespeople(limit = 10, startDate?: string, endDate?: string, segment?: string, client?: string, product?: string): Promise<{
    items: Array<{
      salesperson: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }> {
    const conditions = [
      sql`${factVentas.nokofu} IS NOT NULL AND ${factVentas.nokofu} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (segment) {
      conditions.push(sql`${factVentas.noruen} = ${segment}`);
    }
    if (client) {
      conditions.push(eq(factVentas.nokoen, client));
    }
    if (product) {
      conditions.push(eq(factVentas.nokoar, product));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause);
    
    // Get total count of unique salespeople
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${factVentas.nokofu})`,
      })
      .from(factVentas)
      .where(whereClause);
    
    const results = await db
      .select({
        salesperson: factVentas.nokofu,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokofu)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(limit);

    return {
      items: results.map(r => ({
        salesperson: r.salesperson || '',
        totalSales: Number(r.totalSales),
        transactionCount: Number(r.transactionCount),
      })),
      periodTotalSales: Number(totalResult.total),
      totalCount: Number(countResult.count),
    };
  }

  async searchSalespeople(searchTerm: string, startDate?: string, endDate?: string, segment?: string, client?: string, product?: string): Promise<Array<{
    name: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    const conditions = [
      sql`LOWER(${factVentas.nokofu}) LIKE ${`%${searchTerm.toLowerCase()}%`}`,
      sql`${factVentas.nokofu} IS NOT NULL AND ${factVentas.nokofu} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    if (client) {
      conditions.push(eq(factVentas.nokoen, client));
    }
    if (product) {
      conditions.push(eq(factVentas.nokoar, product));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const results = await db
      .select({
        name: factVentas.nokofu,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokofu)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(50);

    return results.map(r => ({
      name: r.name || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async getTopProducts(limit = 10, startDate?: string, endDate?: string, salesperson?: string, segment?: string, client?: string): Promise<{
    items: Array<{
      productName: string;
      totalSales: number;
      totalUnits: number;
      transactionCount: number;
      averageOrderValue: number;
      percentage: number;
      uniqueClients: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }> {
    const conditions = [
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    if (client) {
      conditions.push(eq(factVentas.nokoen, client));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause);
    
    const periodTotal = Number(totalResult.total);
    
    // For products, filter only transactions with product name
    const productConditions = [
      ...conditions,
      sql`${factVentas.nokoprct} IS NOT NULL AND ${factVentas.nokoprct} != ''`
    ];
    
    const productWhereClause = productConditions.length > 0 ? and(...productConditions) : undefined;
    
    // Get total count of unique products
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${factVentas.nokoprct})`,
      })
      .from(factVentas)
      .where(productWhereClause);
    
    // Sum by individual product lines using MONTO
    const results = await db
      .select({
        productName: factVentas.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        uniqueOrders: sql<number>`COUNT(DISTINCT ${factVentas.nudo})`,
        uniqueClients: sql<number>`COUNT(DISTINCT ${factVentas.endo})`,
      })
      .from(factVentas)
      .where(productWhereClause)
      .groupBy(factVentas.nokoprct)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
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
          uniqueClients: Number(r.uniqueClients) || 0,
        };
      }),
      periodTotalSales: periodTotal,
      totalCount: Number(countResult.count),
    };
  }

  async getTopClients(limit = 10, startDate?: string, endDate?: string, salesperson?: string, segment?: string, product?: string): Promise<{
    items: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }> {
    const conditions = [
      sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    if (product) {
      conditions.push(eq(factVentas.nokoar, product));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause);
    
    // Get total count of unique clients
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${factVentas.nokoen})`,
      })
      .from(factVentas)
      .where(whereClause);
    
    const results = await db
      .select({
        clientName: factVentas.nokoen,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(limit);

    return {
      items: results.map(r => ({
        clientName: r.clientName || '',
        totalSales: Number(r.totalSales),
        transactionCount: Number(r.transactionCount),
      })),
      periodTotalSales: Number(totalResult.total),
      totalCount: Number(countResult.count),
    };
  }

  async getProductDetails(productName: string, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<{
    totalSales: number;
    totalUnits: number;
    uniqueClients: number;
    averageTicket: number;
    topSalesperson: string | null;
    topSalespersonSales: number;
    topClients: Array<{
      clientName: string;
      sales: number;
    }>;
  } | null> {
    const conditions = [
      eq(factVentas.nokoprct, productName),
      sql`${factVentas.tido} != 'GDV'`,
    ];

    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }

    const whereClause = and(...conditions);

    // Get aggregated metrics
    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
        uniqueClients: sql<number>`COUNT(DISTINCT ${factVentas.nokoen})`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause);

    console.log('[DEBUG getProductDetails] Raw metrics:', JSON.stringify(metrics));
    console.log('[DEBUG getProductDetails] uniqueClients raw:', metrics?.uniqueClients, 'type:', typeof metrics?.uniqueClients);

    if (!metrics || Number(metrics.totalSales) === 0) {
      return null;
    }

    // Get top clients for this product
    const topClients = await db
      .select({
        clientName: factVentas.nokoen,
        sales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(5);

    // Get top salesperson for this product
    const topSalespeople = await db
      .select({
        salespersonName: factVentas.nokofu,
        sales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokofu)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(1);

    const totalSales = Number(metrics.totalSales);
    const transactionCount = Number(metrics.transactionCount) || 1;
    const topSalesperson = topSalespeople[0];

    return {
      totalSales,
      totalUnits: Number(metrics.totalUnits),
      uniqueClients: Number(metrics.uniqueClients),
      averageTicket: totalSales / transactionCount,
      topSalesperson: topSalesperson?.salespersonName || null,
      topSalespersonSales: topSalesperson ? Number(topSalesperson.sales) : 0,
      topClients: topClients.map(c => ({
        clientName: c.clientName || '',
        sales: Number(c.sales),
      })),
    };
  }

  async getSalespersonDetails(salespersonName: string, startDate?: string, endDate?: string, segment?: string): Promise<{
    totalSales: number;
    transactionCount: number;
    uniqueClients: number;
    averageTicket: number;
    topProducts: Array<{
      productName: string;
      sales: number;
    }>;
  } | null> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      sql`${factVentas.tido} != 'GDV'`,
    ];

    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }

    const whereClause = and(...conditions);

    // Get aggregated metrics
    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        uniqueClients: sql<number>`COUNT(DISTINCT ${factVentas.nokoen})`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause);

    if (!metrics || Number(metrics.totalSales) === 0) {
      return null;
    }

    // Get top products for this salesperson
    const topProducts = await db
      .select({
        productName: factVentas.nokoprct,
        sales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoprct)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(5);

    const totalSales = Number(metrics.totalSales);
    const transactionCount = Number(metrics.transactionCount) || 1;

    return {
      totalSales,
      transactionCount,
      uniqueClients: Number(metrics.uniqueClients),
      averageTicket: totalSales / transactionCount,
      topProducts: topProducts.map(p => ({
        productName: p.productName || '',
        sales: Number(p.sales),
      })),
    };
  }

  async searchClients(searchTerm: string, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<Array<{
    name: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    // Search clients by name (case-insensitive) and return aggregated sales data
    const conditions = [
      sql`LOWER(${factVentas.nokoen}) LIKE ${`%${searchTerm.toLowerCase()}%`}`,
      sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const results = await db
      .select({
        name: factVentas.nokoen,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(20);

    return results.map(r => ({
      name: r.name || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async searchSalespersonClients(salespersonName: string, searchTerm: string, period?: string, filterType?: string, segment?: string): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    // Search clients by name for a specific salesperson (case-insensitive)
    const conditions = [
      eq(factVentas.nokofu, salespersonName), // Filter by salesperson
      sql`LOWER(${factVentas.nokoen}) LIKE ${`%${searchTerm.toLowerCase()}%`}`,
      sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    // Apply date filters if period is provided
    if (period && filterType) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(sql`DATE(${factVentas.feemdo}) = ${period}`);
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }
    
    // Filter by segment if provided
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const results = await db
      .select({
        clientName: factVentas.nokoen,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(20);

    return results.map(r => ({
      clientName: r.clientName || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async getSalespersonClientDetails(salespersonName: string, clientName: string, period: string, filterType: string): Promise<{
    totalSales: number;
    lastSaleDate: string | null;
    transactionCount: number;
    products: Array<{
      productName: string;
      totalSales: number;
      units: number;
    }>;
  }> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      eq(factVentas.nokoen, clientName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters based on period
    switch (filterType) {
      case 'day':
        // Period format: YYYY-MM-DD
        conditions.push(
          sql`DATE(${factVentas.feemdo}) = ${period}`
        );
        break;
      case 'month':
        // Period format: YYYY-MM
        if (period === 'current-month') {
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
          );
        } else if (period === 'last-month') {
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
          );
        } else {
          const [year, month] = period.split('-');
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
          );
        }
        break;
      case 'year':
        // Period format: YYYY or YYYY-MM (extract year only)
        const yearForFilter = period.split('-')[0];
        conditions.push(
          sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
        );
        break;
      case 'range':
        if (period.includes('_')) {
          const [startDate, endDate] = period.split('_');
          conditions.push(
            sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
          );
        } else if (period === 'last-30-days') {
          conditions.push(
            sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
          );
        } else if (period === 'last-7-days') {
          conditions.push(
            sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
          );
        }
        break;
    }

    const whereClause = and(...conditions);

    // Get total sales, transaction count, and last sale date
    const [summary] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        lastSaleDate: sql<string>`MAX(${factVentas.feemdo})::text`,
      })
      .from(factVentas)
      .where(whereClause);

    // Get products sold to this client
    const productsData = await db
      .select({
        productName: factVentas.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        units: sql<number>`COALESCE(SUM(${factVentas.caprco1}), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoprct)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`);

    return {
      totalSales: Number(summary.totalSales),
      lastSaleDate: summary.lastSaleDate || null,
      transactionCount: Number(summary.transactionCount),
      products: productsData.map(p => ({
        productName: p.productName || '',
        totalSales: Number(p.totalSales),
        units: Number(p.units),
      })),
    };
  }

  async searchSalespersonProducts(salespersonName: string, searchTerm: string, period?: string, filterType?: string, segment?: string): Promise<Array<{
    productName: string;
    totalSales: number;
    transactionCount: number;
  }>> {
    // Search products by name for a specific salesperson (case-insensitive)
    const conditions = [
      eq(factVentas.nokofu, salespersonName), // Filter by salesperson
      sql`LOWER(${factVentas.nokoprct}) LIKE ${`%${searchTerm.toLowerCase()}%`}`,
      sql`${factVentas.nokoprct} IS NOT NULL AND ${factVentas.nokoprct} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    // Apply date filters if period is provided
    if (period && filterType) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(sql`DATE(${factVentas.feemdo}) = ${period}`);
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }
    
    // Filter by segment if provided
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const results = await db
      .select({
        productName: factVentas.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoprct)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(20);

    return results.map(r => ({
      productName: r.productName || '',
      totalSales: Number(r.totalSales),
      transactionCount: Number(r.transactionCount),
    }));
  }

  async getSalespersonProductDetails(salespersonName: string, productName: string, period: string, filterType: string): Promise<{
    totalSales: number;
    totalUnits: number;
    topClient: { name: string; amount: number } | null;
    clients: Array<{ name: string; amount: number }>;
    transactionCount: number;
  }> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      eq(factVentas.nokoprct, productName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters based on period
    switch (filterType) {
      case 'day':
        // Period format: YYYY-MM-DD
        conditions.push(
          sql`DATE(${factVentas.feemdo}) = ${period}`
        );
        break;
      case 'month':
        // Period format: YYYY-MM
        if (period === 'current-month') {
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
          );
        } else if (period === 'last-month') {
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
          );
        } else {
          const [year, month] = period.split('-');
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
          );
        }
        break;
      case 'year':
        // Period format: YYYY or YYYY-MM (extract year only)
        const yearForFilter = period.split('-')[0];
        conditions.push(
          sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
        );
        break;
      case 'range':
        if (period.includes('_')) {
          const [startDate, endDate] = period.split('_');
          conditions.push(
            sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
          );
        } else if (period === 'last-30-days') {
          conditions.push(
            sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
          );
        } else if (period === 'last-7-days') {
          conditions.push(
            sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
          );
        }
        break;
    }

    const whereClause = and(...conditions);

    // Get total sales, transaction count, and total units
    const [summary] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${factVentas.caprco1}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(whereClause);

    // Get all clients for this product, ordered by total amount descending
    const clientsData = await db
      .select({
        clientName: factVentas.nokoen,
        totalAmount: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`);

    const clients = clientsData.map(client => ({
      name: client.clientName || '',
      amount: Number(client.totalAmount)
    }));

    const topClient = clients.length > 0
      ? clients[0]
      : null;

    return {
      totalSales: Number(summary.totalSales),
      totalUnits: Number(summary.totalUnits),
      topClient,
      clients,
      transactionCount: Number(summary.transactionCount),
    };
  }

  async getSalespersonRecentTransactions(salespersonName: string, limit: number = 10): Promise<Array<{
    date: string;
    client: string;
    product: string;
    quantity: number;
    amount: number;
    docType: string;
  }>> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    const whereClause = and(...conditions);

    const results = await db
      .select({
        date: factVentas.feemdo,
        client: factVentas.nokoen,
        product: factVentas.nokoprct,
        quantity: factVentas.caprco1,
        amount: factVentas.monto,
        docType: factVentas.tido,
      })
      .from(factVentas)
      .where(whereClause)
      .orderBy(desc(factVentas.feemdo))
      .limit(limit);

    return results.map(r => ({
      date: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '',
      client: r.client || '',
      product: r.product || '',
      quantity: Number(r.quantity) || 0,
      amount: Number(r.amount) || 0,
      docType: r.docType || '',
    }));
  }

  async searchProducts(searchTerm: string, startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<Array<{
    name: string;
    totalSales: number;
    totalUnits: number;
  }>> {
    // Search products by name (case-insensitive) and return aggregated sales data
    const conditions = [
      sql`LOWER(${factVentas.nokoprct}) LIKE ${`%${searchTerm.toLowerCase()}%`}`,
      sql`${factVentas.nokoprct} IS NOT NULL AND ${factVentas.nokoprct} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const results = await db
      .select({
        name: factVentas.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoprct)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`)
      .limit(20);

    return results.map(r => ({
      name: r.name || '',
      totalSales: Number(r.totalSales),
      totalUnits: Number(r.totalUnits),
    }));
  }

  async getSegmentAnalysis(startDate?: string, endDate?: string, salesperson?: string, segment?: string): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>> {
    const dateConditions = [
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      dateConditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      dateConditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      dateConditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      dateConditions.push(eq(factVentas.noruen, segment));
    }
    const dateFilter = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const [totalSalesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(dateFilter);

    const totalSales = Number(totalSalesResult.total);

    const conditions = [
      sql`${factVentas.noruen} IS NOT NULL AND ${factVentas.noruen} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }

    const results = await db
      .select({
        segment: factVentas.noruen,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.noruen)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`);

    return results.map(r => ({
      segment: r.segment || '',
      totalSales: Number(r.totalSales),
      percentage: totalSales > 0 ? (Number(r.totalSales) / totalSales) * 100 : 0,
    }));
  }

  async getSalesChartData(period: 'weekly' | 'monthly' | 'daily', startDate?: string, endDate?: string, salesperson?: string, segment?: string, client?: string, product?: string): Promise<Array<{
    period: string;
    sales: number;
  }>> {
    const conditions = [
      sql`${factVentas.feemdo} IS NOT NULL`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${endDate}::date`);
    }
    if (salesperson) {
      conditions.push(eq(factVentas.nokofu, salesperson));
    }
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }
    if (client) {
      conditions.push(eq(factVentas.nokoen, client));
    }
    if (product) {
      conditions.push(eq(factVentas.nokoprct, product));
    }
    
    let query: any;
    
    switch (period) {
      case 'daily':
        query = db
          .select({
            period: sql<string>`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM-DD')`,
            sales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
          })
          .from(factVentas)
          .where(and(...conditions))
          .groupBy(sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM-DD')`)
          .orderBy(sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM-DD')`);
        break;
      case 'weekly':
        query = db
          .select({
            period: sql<string>`'Semana ' || EXTRACT(week FROM ${factVentas.feemdo})`,
            sales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
          })
          .from(factVentas)
          .where(and(...conditions))
          .groupBy(sql`EXTRACT(week FROM ${factVentas.feemdo})`)
          .orderBy(sql`EXTRACT(week FROM ${factVentas.feemdo})`);
        break;
      case 'monthly':
      default:
        query = db
          .select({
            period: sql<string>`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM')`,
            sales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
          })
          .from(factVentas)
          .where(and(...conditions))
          .groupBy(sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM')`);
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
        yearMonth: sql<string>`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM')`,
      })
      .from(factVentas)
      .where(sql`${factVentas.feemdo} IS NOT NULL AND ${factVentas.tido} != 'GDV'`)
      .groupBy(sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM') DESC`);

    // Get unique years with data
    const yearResults = await db
      .select({
        year: sql<string>`EXTRACT(YEAR FROM ${factVentas.feemdo})::text`,
      })
      .from(factVentas)
      .where(sql`${factVentas.feemdo} IS NOT NULL AND ${factVentas.tido} != 'GDV'`)
      .groupBy(sql`EXTRACT(YEAR FROM ${factVentas.feemdo})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) DESC`);

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
    branch?: string;
    client?: string;
  }): Promise<Array<{
    packagingType: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    salesPercentage: number;
    unitPercentage: number;
  }>> {
    const conditions = [
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    if (filters?.startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${filters.startDate}::date`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${factVentas.feemdo} <= ${filters.endDate}::date`);
    }
    if (filters?.salesperson) {
      conditions.push(eq(factVentas.nokofu, filters.salesperson));
    }
    if (filters?.segment) {
      conditions.push(eq(factVentas.noruen, filters.segment));
    }
    if (filters?.branch) {
      conditions.push(eq(factVentas.nosudo, filters.branch));
    }
    if (filters?.client) {
      conditions.push(eq(factVentas.nokoen, filters.client));
    }

    // Get totals for percentage calculations
    const [totalResult] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
      })
      .from(factVentas)
      .where(and(...conditions));

    const grandTotalSales = Number(totalResult.totalSales);
    const grandTotalUnits = Number(totalResult.totalUnits);

    // Query for packaging metrics using CASE for SQL-based packaging type extraction
    const results = await db
      .select({
        packagingType: sql<string>`
          CASE 
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%1/4%' THEN '04'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '% 5 GALON%' OR UPPER(${factVentas.nokoprct}) LIKE '% 5 GL%' OR UPPER(${factVentas.nokoprct}) LIKE '% 5GL%' OR UPPER(${factVentas.nokoprct}) LIKE '% 5GAL%' THEN 'B5'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%BALDE%' OR UPPER(${factVentas.nokoprct}) LIKE '%BALDES%' THEN 'BD'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%4 GALONES%' OR UPPER(${factVentas.nokoprct}) LIKE '%4 GL%' OR UPPER(${factVentas.nokoprct}) LIKE '%4GL%' OR UPPER(${factVentas.nokoprct}) LIKE '%CUARTO%' THEN 'Q4'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%GL.%' OR UPPER(${factVentas.nokoprct}) LIKE '%GL %' OR UPPER(${factVentas.nokoprct}) LIKE '% GL%' OR UPPER(${factVentas.nokoprct}) LIKE '%GALON%' OR UPPER(${factVentas.nokoprct}) LIKE '%GALONES%' THEN 'GL'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%KIT%' OR UPPER(${factVentas.nokoprct}) LIKE '%KT%' THEN 'KT'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%UNIDAD%' OR UPPER(${factVentas.nokoprct}) LIKE '% UN.%' OR UPPER(${factVentas.nokoprct}) LIKE '% UN %' OR UPPER(${factVentas.nokoprct}) LIKE '%UNITARIO%' THEN 'UN'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%KG.%' OR UPPER(${factVentas.nokoprct}) LIKE '%KG %' OR UPPER(${factVentas.nokoprct}) LIKE '% KG%' OR UPPER(${factVentas.nokoprct}) LIKE '%KILO%' OR UPPER(${factVentas.nokoprct}) LIKE '%KILOGRAMO%' THEN 'KG'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%LT.%' OR UPPER(${factVentas.nokoprct}) LIKE '%LT %' OR UPPER(${factVentas.nokoprct}) LIKE '% LT%' OR UPPER(${factVentas.nokoprct}) LIKE '%LITRO%' OR UPPER(${factVentas.nokoprct}) LIKE '%LITROS%' THEN 'LT'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%GARRAFA%' OR UPPER(${factVentas.nokoprct}) LIKE '%BIDÓN%' THEN 'GB'
            WHEN UPPER(${factVentas.nokoprct}) LIKE '%ONZA%' OR UPPER(${factVentas.nokoprct}) LIKE '%OZ%' THEN 'OD'
            ELSE 'OT'
          END`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(sql`
        CASE 
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%1/4%' THEN '04'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '% 5 GALON%' OR UPPER(${factVentas.nokoprct}) LIKE '% 5 GL%' OR UPPER(${factVentas.nokoprct}) LIKE '% 5GL%' OR UPPER(${factVentas.nokoprct}) LIKE '% 5GAL%' THEN 'B5'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%BALDE%' OR UPPER(${factVentas.nokoprct}) LIKE '%BALDES%' THEN 'BD'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%4 GALONES%' OR UPPER(${factVentas.nokoprct}) LIKE '%4 GL%' OR UPPER(${factVentas.nokoprct}) LIKE '%4GL%' OR UPPER(${factVentas.nokoprct}) LIKE '%CUARTO%' THEN 'Q4'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%GL.%' OR UPPER(${factVentas.nokoprct}) LIKE '%GL %' OR UPPER(${factVentas.nokoprct}) LIKE '% GL%' OR UPPER(${factVentas.nokoprct}) LIKE '%GALON%' OR UPPER(${factVentas.nokoprct}) LIKE '%GALONES%' THEN 'GL'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%KIT%' OR UPPER(${factVentas.nokoprct}) LIKE '%KT%' THEN 'KT'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%UNIDAD%' OR UPPER(${factVentas.nokoprct}) LIKE '% UN.%' OR UPPER(${factVentas.nokoprct}) LIKE '% UN %' OR UPPER(${factVentas.nokoprct}) LIKE '%UNITARIO%' THEN 'UN'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%KG.%' OR UPPER(${factVentas.nokoprct}) LIKE '%KG %' OR UPPER(${factVentas.nokoprct}) LIKE '% KG%' OR UPPER(${factVentas.nokoprct}) LIKE '%KILO%' OR UPPER(${factVentas.nokoprct}) LIKE '%KILOGRAMO%' THEN 'KG'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%LT.%' OR UPPER(${factVentas.nokoprct}) LIKE '%LT %' OR UPPER(${factVentas.nokoprct}) LIKE '% LT%' OR UPPER(${factVentas.nokoprct}) LIKE '%LITRO%' OR UPPER(${factVentas.nokoprct}) LIKE '%LITROS%' THEN 'LT'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%GARRAFA%' OR UPPER(${factVentas.nokoprct}) LIKE '%BIDÓN%' THEN 'GB'
          WHEN UPPER(${factVentas.nokoprct}) LIKE '%ONZA%' OR UPPER(${factVentas.nokoprct}) LIKE '%OZ%' THEN 'OD'
          ELSE 'OT'
        END`)
      .orderBy(sql`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0) DESC`);

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
      sql`LOWER(${factVentas.nokoprct}) = LOWER(${productName})`
    ];
    
    if (filters?.startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${filters.startDate}::date`);
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(sql`${factVentas.feemdo} < ${endDateExclusive}::date`);
    }
    
    const whereClause = and(...conditions);

    // Get main product metrics
    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
      })
      .from(factVentas)
      .where(whereClause);

    // Get top client for this product
    const [topClient] = await db
      .select({
        clientName: sql<string>`${factVentas.nokoen}`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS DECIMAL)) DESC`)
      .limit(1);

    // Get top salesperson for this product
    const [topSalesperson] = await db
      .select({
        salesperson: sql<string>`${factVentas.nokofu}`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokofu)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS DECIMAL)) DESC`)
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
      sql`LOWER(${factVentas.nokoprct}) = LOWER(${productName})`
    ];
    
    if (filters?.startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${filters.startDate}::date`);
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(sql`${factVentas.feemdo} < ${endDateExclusive}::date`);
    }
    
    const whereClause = and(...conditions);

    // Get total sales for percentage calculation
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
      })
      .from(factVentas)
      .where(whereClause);
    
    const totalSales = Number(totalResult.total);

    // Extract format from product names using regex patterns for common formats
    const results = await db
      .select({
        productName: factVentas.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoprct);

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
      sql`LOWER(${factVentas.nokoprct}) = LOWER(${productName})`
    ];
    
    if (filters?.startDate) {
      conditions.push(sql`${factVentas.feemdo} >= ${filters.startDate}::date`);
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(sql`${factVentas.feemdo} < ${endDateExclusive}::date`);
    }
    
    const whereClause = and(...conditions);

    // Get total sales for percentage calculation
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
      })
      .from(factVentas)
      .where(whereClause);
    
    const totalSales = Number(totalResult.total);

    // Get all product variations for this product
    const results = await db
      .select({
        productName: factVentas.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -${factVentas.caprco2} ELSE ${factVentas.caprco2} END), 0)`,
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoprct);

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
      .select({
        id: factVentas.id,
        idmaeedo: factVentas.idmaeedo,
        idmaeddo: factVentas.idmaeddo,
        tido: factVentas.tido,
        nudo: factVentas.nudo,
        feemdo: factVentas.feemdo,
        nokoen: factVentas.nokoen,
        nokofu: factVentas.nokofu,
        noruen: factVentas.noruen,
        nokopr: factVentas.nokoprct, // Map nokoprct to nokopr
        koprct: factVentas.koprct,
        caprad2: factVentas.caprad2,
        monto: factVentas.monto,
        vanedo: factVentas.vanedo,
        esdo: factVentas.esdo,
        endo: factVentas.endo,
        modo: factVentas.modo,
        vabrdo: factVentas.vabrdo,
        vaivdo: factVentas.vaivdo,
        ppprne: factVentas.ppprne,
        ppprbr: factVentas.ppprbr,
        udtrpr: factVentas.udtrpr,
      })
      .from(factVentas)
      .where(eq(factVentas.id, transactionId));

    return transaction;
  }

  // Alerts for salesperson
  async getSalespersonAlerts(salesperson: string): Promise<any[]> {
    const alerts: any[] = [];
    
    try {
      // 1. Clientes que no han comprado hace tiempo (más de 60 días)
      const inactiveClients = await db
        .select({
          client: factVentas.nokoen,
          lastPurchase: sql<string>`MAX(${factVentas.feemdo})`,
          daysSince: sql<number>`EXTRACT(DAY FROM NOW() - MAX(${factVentas.feemdo}))`
        })
        .from(factVentas)
        .where(eq(factVentas.nokofu, salesperson))
        .groupBy(factVentas.nokoen)
        .having(sql`EXTRACT(DAY FROM NOW() - MAX(${factVentas.feemdo})) > 60`)
        .orderBy(sql`MAX(${factVentas.feemdo}) DESC`)
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
          client: factVentas.nokoen,
          purchaseMonth: sql<string>`EXTRACT(MONTH FROM ${factVentas.feemdo})`,
          transactionCount: sql<number>`COUNT(*)`
        })
        .from(factVentas)
        .where(eq(factVentas.nokofu, salesperson))
        .groupBy(factVentas.nokoen, sql`EXTRACT(MONTH FROM ${factVentas.feemdo})`)
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
          client: factVentas.nokoen,
          totalSales: sql<number>`SUM(CAST(${factVentas.monto} AS DECIMAL))`,
          transactionCount: sql<number>`COUNT(*)`
        })
        .from(factVentas)
        .where(eq(factVentas.nokofu, salesperson))
        .groupBy(factVentas.nokoen)
        .having(sql`SUM(CAST(${factVentas.monto} AS DECIMAL)) > 1000000`)
        .orderBy(sql`SUM(CAST(${factVentas.monto} AS DECIMAL)) DESC`)
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
          client: factVentas.nokoen,
          uniqueProducts: sql<number>`COUNT(DISTINCT ${factVentas.koprct})`,
          totalTransactions: sql<number>`COUNT(*)`
        })
        .from(factVentas)
        .where(eq(factVentas.nokofu, salesperson))
        .groupBy(factVentas.nokoen)
        .having(sql`COUNT(*) > 3 AND COUNT(DISTINCT ${factVentas.koprct}) <= 2`)
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
      .selectDistinct({ segment: factVentas.noruen })
      .from(factVentas)
      .where(sql`${factVentas.noruen} IS NOT NULL AND ${factVentas.noruen} != ''`)
      .orderBy(factVentas.noruen);
    
    return result.map((r: any) => r.segment).filter((segment: string | null): segment is string => Boolean(segment));
  }

  async getUniqueSalespeople(filters?: { startDate?: string; endDate?: string }): Promise<string[]> {
    let query = db
      .selectDistinct({ salesperson: factVentas.nokofu })
      .from(factVentas)
      .where(
        and(
          ne(factVentas.nokofu, ''),
          isNotNull(factVentas.nokofu),
          filters?.startDate ? gte(factVentas.feemdo, filters.startDate) : undefined,
          filters?.endDate ? lte(factVentas.feemdo, filters.endDate) : undefined
        )
      )
      .orderBy(factVentas.nokofu);

    const result = await query;
    
    return result.map((r: any) => r.salesperson).filter((salesperson: string | null): salesperson is string => Boolean(salesperson));
  }

  async getUniqueClients(): Promise<string[]> {
    const result = await db
      .selectDistinct({ client: factVentas.nokoen })
      .from(factVentas)
      .where(sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`)
      .orderBy(factVentas.nokoen);
    
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
        total: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} != 'GDV' THEN CAST(${factVentas.monto} AS DECIMAL) ELSE 0 END), 0)`
      })
      .from(factVentas)
      .where(sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM') = ${period}`)
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getSegmentSalesForPeriod(segment: string, period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} != 'GDV' THEN CAST(${factVentas.monto} AS DECIMAL) ELSE 0 END), 0)`
      })
      .from(factVentas)
      .where(
        and(
          eq(factVentas.noruen, segment),
          sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM') = ${period}`
        )
      )
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getSalespersonSalesForPeriod(salesperson: string, period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} != 'GDV' THEN CAST(${factVentas.monto} AS DECIMAL) ELSE 0 END), 0)`
      })
      .from(factVentas)
      .where(
        and(
          eq(factVentas.nokofu, salesperson),
          sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM') = ${period}`
        )
      )
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getSegmentClients(segmentName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    clientName: string;
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>> {
    const conditions = [
      eq(factVentas.noruen, segmentName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${factVentas.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }

    const result = await db
      .select({
        clientName: factVentas.nokoen,
        salespersonName: sql<string>`MAX(${factVentas.nokofu})`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`);
    
    // Calculate segment total for percentages - ensure proper number conversion
    const segmentTotal = result.reduce((sum, client) => sum + Number(client.totalSales || 0), 0);
    
    return result.map(client => ({
      clientName: client.clientName || 'Cliente desconocido',
      salespersonName: client.salespersonName || '',
      totalSales: Number(client.totalSales),
      transactionCount: Number(client.transactionCount),
      averageTicket: Number(client.averageTicket),
      percentage: segmentTotal > 0 ? (Number(client.totalSales) / segmentTotal) * 100 : 0
    }));
  }

  async getSegmentMonthlyBreakdown(segmentName: string, year: string): Promise<Array<{
    month: number;
    monthName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
  }>> {
    const conditions = [
      eq(factVentas.noruen, segmentName),
      sql`${factVentas.tido} != 'GDV'`,
      sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year}`
    ];

    const result = await db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${factVentas.feemdo})::int`,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(MONTH FROM ${factVentas.feemdo})`)
      .orderBy(sql`EXTRACT(MONTH FROM ${factVentas.feemdo})`);

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return result.map(row => ({
      month: Number(row.month),
      monthName: monthNames[Number(row.month) - 1],
      totalSales: Number(row.totalSales),
      transactionCount: Number(row.transactionCount),
      averageTicket: Number(row.averageTicket)
    }));
  }

  async getSegmentSalespeople(segmentName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>> {
    const conditions = [
      eq(factVentas.noruen, segmentName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${factVentas.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }

    const result = await db
      .select({
        salespersonName: factVentas.nokofu,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.nokofu)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`);
    
    // Calculate segment total for percentages - ensure proper number conversion
    const segmentTotal = result.reduce((sum, salesperson) => sum + Number(salesperson.totalSales || 0), 0);
    
    return result.map(salesperson => ({
      salespersonName: salesperson.salespersonName || 'Vendedor desconocido',
      totalSales: Number(salesperson.totalSales),
      transactionCount: Number(salesperson.transactionCount),
      averageTicket: Number(salesperson.averageTicket),
      percentage: segmentTotal > 0 ? (Number(salesperson.totalSales) / segmentTotal) * 100 : 0
    }));
  }

  async getSegmentClientRecurrence(segmentName: string, period?: string, filterType: string = 'month'): Promise<{
    recurringCount: number;
    newCount: number;
  }> {
    // Build date filter condition based on period and filterType
    let periodStartDate: string;
    let periodEndDate: string;

    // Calculate period start and end dates based on filter type
    if (period) {
      switch (filterType) {
        case 'day':
          periodStartDate = period;
          periodEndDate = period;
          break;
        case 'month':
          if (period === 'current-month') {
            const now = new Date();
            periodStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            periodEndDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
          } else if (period === 'last-month') {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            periodStartDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate();
            periodEndDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
          } else {
            const [year, month] = period.split('-');
            periodStartDate = `${year}-${month}-01`;
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            periodEndDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
          }
          break;
        case 'year':
          const yearForFilter = period.split('-')[0];
          periodStartDate = `${yearForFilter}-01-01`;
          periodEndDate = `${yearForFilter}-12-31`;
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            periodStartDate = startDate;
            periodEndDate = endDate;
          } else if (period === 'last-30-days') {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            periodStartDate = thirtyDaysAgo.toISOString().split('T')[0];
            periodEndDate = now.toISOString().split('T')[0];
          } else if (period === 'last-7-days') {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            periodStartDate = sevenDaysAgo.toISOString().split('T')[0];
            periodEndDate = now.toISOString().split('T')[0];
          } else {
            const now = new Date();
            periodStartDate = `${now.getFullYear()}-01-01`;
            periodEndDate = now.toISOString().split('T')[0];
          }
          break;
        default:
          const now = new Date();
          periodStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          const lastDayDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          periodEndDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDayDefault}`;
      }
    } else {
      const now = new Date();
      periodStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      periodEndDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    }

    // Query to get all unique clients in the segment for the period,
    // with their first-ever sale date to determine new vs recurring
    const result = await db.execute(sql`
      WITH period_clients AS (
        -- Get all unique clients who purchased in the segment during the period
        SELECT DISTINCT nokoen as client_name
        FROM ventas.fact_ventas
        WHERE noruen = ${segmentName}
          AND tido != 'GDV'
          AND DATE(feemdo) >= ${periodStartDate}::date
          AND DATE(feemdo) <= ${periodEndDate}::date
          AND nokoen IS NOT NULL
      ),
      client_first_sale AS (
        -- Get the first-ever sale date for each client in the segment
        SELECT 
          nokoen as client_name,
          MIN(DATE(feemdo)) as first_sale_date
        FROM ventas.fact_ventas
        WHERE noruen = ${segmentName}
          AND tido != 'GDV'
          AND nokoen IS NOT NULL
        GROUP BY nokoen
      )
      SELECT 
        COUNT(CASE WHEN cfs.first_sale_date >= ${periodStartDate}::date THEN 1 END) as new_count,
        COUNT(CASE WHEN cfs.first_sale_date < ${periodStartDate}::date THEN 1 END) as recurring_count
      FROM period_clients pc
      JOIN client_first_sale cfs ON pc.client_name = cfs.client_name
    `);

    const row = result.rows[0] as { new_count: string | number; recurring_count: string | number } | undefined;
    
    return {
      recurringCount: Number(row?.recurring_count || 0),
      newCount: Number(row?.new_count || 0)
    };
  }

  // Branch detail operations
  async getBranchClients(branchName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    clientName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>> {
    const conditions = [
      eq(factVentas.nosudo, branchName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          conditions.push(sql`DATE(${factVentas.feemdo}) = ${period}`);
          break;
        case 'month':
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          const yearForFilter = period.split('-')[0];
          conditions.push(sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`);
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`);
          } else if (period === 'last-7-days') {
            conditions.push(sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`);
          }
          break;
      }
    }

    const result = await db
      .select({
        clientName: factVentas.nokoen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`);
    
    const branchTotal = result.reduce((sum, client) => sum + Number(client.totalSales || 0), 0);
    
    return result.map(client => ({
      clientName: client.clientName || 'Cliente desconocido',
      totalSales: Number(client.totalSales),
      transactionCount: Number(client.transactionCount),
      averageTicket: Number(client.averageTicket),
      percentage: branchTotal > 0 ? (Number(client.totalSales) / branchTotal) * 100 : 0
    }));
  }

  async getBranchSalespeople(branchName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    salespersonName: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    percentage: number;
  }>> {
    const conditions = [
      eq(factVentas.nosudo, branchName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          conditions.push(sql`DATE(${factVentas.feemdo}) = ${period}`);
          break;
        case 'month':
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          const yearForFilter = period.split('-')[0];
          conditions.push(sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`);
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period.includes('last-')) {
            const days = period.includes('30') ? '30' : '7';
            conditions.push(sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '${sql.raw(days)} days'`);
          }
          break;
      }
    }

    const result = await db
      .select({
        salespersonName: factVentas.nokofu,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.nokofu)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`);
    
    const branchTotal = result.reduce((sum, salesperson) => sum + Number(salesperson.totalSales || 0), 0);
    
    return result.map(salesperson => ({
      salespersonName: salesperson.salespersonName || 'Vendedor desconocido',
      totalSales: Number(salesperson.totalSales),
      transactionCount: Number(salesperson.transactionCount),
      averageTicket: Number(salesperson.averageTicket),
      percentage: branchTotal > 0 ? (Number(salesperson.totalSales) / branchTotal) * 100 : 0
    }));
  }

  async getBranchSalesForPeriod(branchName: string, period: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} != 'GDV' THEN CAST(${factVentas.monto} AS DECIMAL) ELSE 0 END), 0)`
      })
      .from(factVentas)
      .where(
        and(
          eq(factVentas.nosudo, branchName),
          sql`TO_CHAR(${factVentas.feemdo}, 'YYYY-MM') = ${period}`
        )
      )
      .execute();

    return Number(result[0]?.total || 0);
  }

  async getNVVByBranch(branchName: string): Promise<any[]> {
    // Get kofulido to branch mapping from sales_transactions
    const salespersonBranchResults = await db
      .selectDistinct({
        kofulido: factVentas.kofulido,
        nosudo: factVentas.nosudo,
      })
      .from(factVentas)
      .where(
        and(
          isNotNull(factVentas.kofulido),
          isNotNull(factVentas.nosudo),
          ne(factVentas.kofulido, ''),
          ne(factVentas.nosudo, '')
        )
      );

    const kofulidoToBranch: Record<string, string> = {};
    salespersonBranchResults.forEach(result => {
      if (result.kofulido && result.nosudo) {
        kofulidoToBranch[result.kofulido] = result.nosudo;
      }
    });

    // Find all KOFULIDO codes that map to this branch
    const kofulidoCodes = Object.entries(kofulidoToBranch)
      .filter(([_, branch]) => branch.trim().toUpperCase() === branchName.toString().trim().toUpperCase())
      .map(([kofulido, _]) => kofulido.trim().toUpperCase())
      .filter(Boolean);

    if (kofulidoCodes.length === 0) {
      console.log(`No salespeople found mapping to branch: ${branchName}`);
      return [];
    }

    console.log(`Found ${kofulidoCodes.length} salespeople mapping to branch ${branchName}: ${kofulidoCodes.join(', ')}`);

    // Get all NVV for these salespeople (sin filtros de fecha)
    // Using nvv.fact_nvv (ETL data) instead of obsolete nvv_pending_sales
    const queryResult = await db.execute(sql`
      SELECT 
        id,
        nudo as "NUDO",
        tido as "TIDO",
        feemdo as "FEEMDO",
        endo as "ENDO",
        nokoen as "NOKOEN",
        vabrdo as "VABRDO",
        kofulido as "KOFULIDO"
      FROM nvv.fact_nvv
      WHERE (eslido IS NULL OR eslido = '')
        AND kofulido IS NOT NULL
        AND UPPER(TRIM(kofulido)) IN (${sql.raw(kofulidoCodes.map(c => `'${c}'`).join(','))})
      ORDER BY feemdo DESC
    `);

    const nvvData = queryResult.rows as any[];
    console.log(`Found ${nvvData.length} NVV records for branch ${branchName}`);

    return nvvData;
  }

  // Salesperson detail operations
  async getSalespersonDetails(salespersonName: string, period?: string, filterType: string = 'month'): Promise<{
    totalSales: number;
    totalClients: number;
    transactionCount: number;
    averageTicket: number;
    newClients: number;
    salesFrequency: number;
    daysSinceLastSale: number;
    lastSaleDate: string | null;
  }> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${factVentas.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter2 = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter2}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }

    const [result] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        totalClients: sql<number>`COUNT(DISTINCT ${factVentas.nokoen})`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        firstSale: sql<string>`MIN(${factVentas.feemdo})`,
        lastSale: sql<string>`MAX(${factVentas.feemdo})`
      })
      .from(factVentas)
      .where(and(...conditions));

    // Calculate days since ACTUAL last sale (without period filters)
    const [actualLastSale] = await db
      .select({
        lastSale: sql<string>`MAX(${factVentas.feemdo})`
      })
      .from(factVentas)
      .where(and(
        eq(factVentas.nokofu, salespersonName),
        sql`${factVentas.tido} != 'GDV'`
      ));

    // Calculate sales frequency (average days between sales)
    const firstSale = new Date(result.firstSale);
    const lastSale = new Date(result.lastSale);
    const daysBetween = Math.max(1, Math.floor((lastSale.getTime() - firstSale.getTime()) / (1000 * 60 * 60 * 24)));
    const salesFrequency = result.transactionCount > 1 ? daysBetween / result.transactionCount : 0;

    // Calculate days since REAL last sale (from all sales, not filtered)
    // Use date-only comparison to avoid time-of-day issues
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    const realLastSale = actualLastSale.lastSale ? new Date(actualLastSale.lastSale) : null;
    const lastSaleDate = realLastSale ? new Date(realLastSale.getFullYear(), realLastSale.getMonth(), realLastSale.getDate()) : null;
    const daysSinceLastSale = lastSaleDate
      ? Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate new clients: clients who NEVER bought before this period (in the entire company, not just from this salesperson)
    let newClients = 0;
    if (period) {
      // Get all clients who bought in this period
      const clientsInPeriod = await db
        .select({
          nokoen: factVentas.nokoen
        })
        .from(factVentas)
        .where(and(...conditions))
        .groupBy(factVentas.nokoen);

      // For each client, check if they had ANY previous purchases in the ENTIRE company before this period
      const periodStart = this.getPeriodStart(period, filterType);
      
      for (const client of clientsInPeriod) {
        if (!client.nokoen) continue; // Skip null clients
        
        const [previousSale] = await db
          .select({
            count: sql<number>`COUNT(*)`
          })
          .from(factVentas)
          .where(and(
            eq(factVentas.nokoen, client.nokoen),
            sql`${factVentas.tido} != 'GDV'`,
            sql`${factVentas.feemdo} < ${periodStart}`
          ));
        
        // If no previous sales in the ENTIRE company, this is a truly new client
        if (Number(previousSale.count) === 0) {
          newClients++;
        }
      }
    }

    return {
      totalSales: Number(result.totalSales),
      totalClients: Number(result.totalClients),
      transactionCount: Number(result.transactionCount),
      averageTicket: Number(result.averageTicket),
      newClients: newClients,
      salesFrequency: Number(salesFrequency.toFixed(1)),
      daysSinceLastSale: daysSinceLastSale,
      lastSaleDate: actualLastSale.lastSale || null  // Use actual last sale, not filtered
    };
  }

  // Helper method to get period start date
  private getPeriodStart(period: string, filterType: string): string {
    switch (filterType) {
      case 'day':
        return period; // YYYY-MM-DD
      case 'month':
        if (period === 'current-month') {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        } else if (period === 'last-month') {
          const now = new Date();
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
        } else {
          return `${period}-01`; // YYYY-MM-01
        }
      case 'year':
        const year = period.split('-')[0];
        return `${year}-01-01`; // YYYY-01-01
      case 'range':
        if (period.includes('_')) {
          return period.split('_')[0]; // Return start date
        } else if (period === 'last-30-days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return thirtyDaysAgo.toISOString().split('T')[0];
        } else if (period === 'last-7-days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return sevenDaysAgo.toISOString().split('T')[0];
        }
        return period;
      default:
        return period;
    }
  }

  async getSalespersonClients(salespersonName: string, period?: string, filterType: string = 'month', segment?: string, limit: number = 9999): Promise<{
    items: Array<{
      clientName: string;
      totalSales: number;
      transactionCount: number;
      averageTicket: number;
      lastSale: string;
      daysSinceLastSale: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];
    
    // Filter by segment if provided
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${factVentas.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }

    const whereClause = and(...conditions);

    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .where(whereClause);

    // Get total count of unique clients
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${factVentas.nokoen})`,
      })
      .from(factVentas)
      .where(whereClause);

    const result = await db
      .select({
        clientName: factVentas.nokoen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        lastSale: sql<string>`MAX(${factVentas.feemdo})`
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`)
      .limit(limit);

    const today = new Date();
    return {
      items: result.map(client => {
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
      }),
      periodTotalSales: Number(totalResult.total),
      totalCount: Number(countResult.count),
    };
  }

  async getSalespersonProducts(salespersonName: string, period?: string, filterType: string = 'month', segment?: string, limit: number = 10): Promise<{
    items: Array<{
      productName: string;
      totalSales: number;
      transactionCount: number;
      averagePrice: number;
      lastSale: string;
      totalUnits: number;
    }>;
    periodTotalSales: number;
    totalCount: number;
  }> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];
    
    // Filter by segment if provided
    if (segment) {
      conditions.push(eq(factVentas.noruen, segment));
    }

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${factVentas.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }

    const whereClause = and(...conditions);

    // Get period total sales
    const [totalResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
      })
      .from(factVentas)
      .where(whereClause);

    // Get total count of unique products
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${factVentas.nokoprct})`,
      })
      .from(factVentas)
      .where(whereClause);

    const result = await db
      .select({
        productName: factVentas.nokoprct,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averagePrice: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        lastSale: sql<string>`MAX(${factVentas.feemdo})`,
        totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${factVentas.tido} = 'GDV' THEN 0 WHEN ${factVentas.tido} = 'NCV' THEN -CAST(${factVentas.caprco2} AS NUMERIC) ELSE CAST(${factVentas.caprco2} AS NUMERIC) END), 0)`
      })
      .from(factVentas)
      .where(whereClause)
      .groupBy(factVentas.nokoprct)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`)
      .limit(limit);

    return {
      items: result.map(product => ({
        productName: product.productName || 'Producto desconocido',
        totalSales: Number(product.totalSales),
        transactionCount: Number(product.transactionCount),
        averagePrice: Number(product.averagePrice),
        lastSale: product.lastSale,
        totalUnits: Number(product.totalUnits)
      })),
      periodTotalSales: Number(totalResult.total),
      totalCount: Number(countResult.count),
    };
  }

  async getSalespersonSegments(salespersonName: string, period?: string, filterType: string = 'month'): Promise<Array<{
    segment: string;
    totalSales: number;
    percentage: number;
  }>> {
    const conditions = [
      eq(factVentas.nokofu, salespersonName),
      sql`${factVentas.tido} != 'GDV'`, // Exclude GDV - only show invoiced sales
      sql`${factVentas.noruen} IS NOT NULL AND ${factVentas.noruen} != ''`
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          conditions.push(sql`DATE(${factVentas.feemdo}) = ${period}`);
          break;
        case 'month':
          if (period === 'current-month') {
            conditions.push(sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`);
          } else if (period === 'last-month') {
            conditions.push(sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`);
          } else {
            const [year, month] = period.split('-');
            conditions.push(sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`);
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter3 = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter3}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`);
          } else if (period === 'last-30-days') {
            conditions.push(sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`);
          } else if (period === 'last-7-days') {
            conditions.push(sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`);
          }
          break;
      }
    }

    const result = await db
      .select({
        segment: factVentas.noruen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.noruen)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`);

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
    segments: string[];
  }> {
    const conditions = [
      eq(factVentas.nokoen, clientName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${factVentas.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter2 = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter2}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }

    const [result] = await db
      .select({
        totalPurchases: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        totalProducts: sql<number>`COUNT(DISTINCT ${factVentas.nokoprct})`,
        transactionCount: sql<number>`COUNT(*)`,
        averageTicket: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        firstPurchase: sql<string>`MIN(${factVentas.feemdo})`,
        lastPurchase: sql<string>`MAX(${factVentas.feemdo})`
      })
      .from(factVentas)
      .where(and(...conditions));

    // Get unique segments for this client in the period
    const segmentResults = await db
      .selectDistinct({
        segment: factVentas.noruen
      })
      .from(factVentas)
      .where(and(...conditions));
    
    const segments = segmentResults
      .map(r => r.segment)
      .filter((s): s is string => !!s && s.trim() !== '')
      .sort();

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
      purchaseFrequency: Number(purchaseFrequency.toFixed(1)),
      segments
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
    const conditions = [
      eq(factVentas.nokoen, clientName),
      sql`${factVentas.tido} != 'GDV'` // Exclude GDV - only show invoiced sales
    ];

    // Apply date filters if period is provided
    if (period) {
      switch (filterType) {
        case 'day':
          // Period format: YYYY-MM-DD
          conditions.push(
            sql`DATE(${factVentas.feemdo}) = ${period}`
          );
          break;
        case 'month':
          // Period format: YYYY-MM
          if (period === 'current-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE)`
            );
          } else if (period === 'last-month') {
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`
            );
          } else {
            const [year, month] = period.split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${year} AND EXTRACT(MONTH FROM ${factVentas.feemdo}) = ${month}`
            );
          }
          break;
        case 'year':
          // Period format: YYYY or YYYY-MM (extract year only)
          const yearForFilter4 = period.split('-')[0];
          conditions.push(
            sql`EXTRACT(YEAR FROM ${factVentas.feemdo}) = ${yearForFilter4}`
          );
          break;
        case 'range':
          if (period.includes('_')) {
            const [startDate, endDate] = period.split('_');
            conditions.push(
              sql`DATE(${factVentas.feemdo}) >= ${startDate} AND DATE(${factVentas.feemdo}) <= ${endDate}`
            );
          } else if (period === 'last-30-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '30 days'`
            );
          } else if (period === 'last-7-days') {
            conditions.push(
              sql`${factVentas.feemdo} >= CURRENT_DATE - INTERVAL '7 days'`
            );
          }
          break;
      }
    }

    const result = await db
      .select({
        productName: factVentas.nokoprct,
        totalPurchases: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        averagePrice: sql<number>`COALESCE(AVG(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        lastPurchase: sql<string>`MAX(${factVentas.feemdo})`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.nokoprct)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`);

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
    nokopr: string;
    monto: string;
    nokofu: string;
  } | null> {
    const [result] = await db
      .select({
        id: factVentas.id,
        nudo: factVentas.nudo,
        feemdo: factVentas.feemdo,
        nokopr: factVentas.nokoprct, // Map nokoprct to nokopr
        monto: sql<string>`CAST(${factVentas.monto} AS TEXT)`,
        nokofu: factVentas.nokofu
      })
      .from(factVentas)
      .where(eq(factVentas.nokoen, clientName))
      .orderBy(desc(factVentas.feemdo))
      .limit(1);

    if (!result) return null;
    
    return {
      id: result.id,
      nudo: result.nudo,
      feemdo: result.feemdo ? (typeof result.feemdo === 'string' ? result.feemdo : new Date(result.feemdo).toISOString().split('T')[0]) : '',
      nokopr: result.nokopr || '',
      monto: result.monto || '0',
      nokofu: result.nokofu || ''
    };
  }

  async getClientPurchaseHistory(clientName: string, limit: number = 10): Promise<Array<{
    id: string;
    nudo: string;
    feemdo: string;
    nokopr: string;
    monto: string;
    nokofu: string;
  }>> {
    const result = await db
      .select({
        id: factVentas.id,
        nudo: factVentas.nudo,
        feemdo: factVentas.feemdo,
        nokopr: factVentas.nokoprct, // Map nokoprct to nokopr
        monto: sql<string>`CAST(${factVentas.monto} AS TEXT)`,
        nokofu: factVentas.nokofu
      })
      .from(factVentas)
      .where(eq(factVentas.nokoen, clientName))
      .orderBy(desc(factVentas.feemdo))
      .limit(limit);

    return result.map(r => ({
      id: r.id,
      nudo: r.nudo,
      feemdo: r.feemdo ? (typeof r.feemdo === 'string' ? r.feemdo : new Date(r.feemdo).toISOString().split('T')[0]) : '',
      nokopr: r.nokopr || '',
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
    // Get only supervisors from salespeopleUsers table
    // Note: Admins are excluded because they are in a different table (users)
    // and solicitudes_marketing has a foreign key to salespeople_users
    const supervisors = await db.select().from(salespeopleUsers)
      .where(eq(salespeopleUsers.role, 'supervisor'));
    
    return supervisors.sort((a, b) => a.salespersonName.localeCompare(b.salespersonName));
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

  async initializePublicCatalogs(): Promise<{ updated: number; skipped: number }> {
    console.log('🔧 Inicializando catálogos públicos para todos los vendedores...');
    
    const salespeople = await db.select().from(salespeopleUsers);
    
    let updated = 0;
    let skipped = 0;
    
    for (const salesperson of salespeople) {
      if (salesperson.publicSlug && salesperson.catalogEnabled) {
        skipped++;
        continue;
      }
      
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
          .replace(/^-|-$/g, '');
      };
      
      let baseSlug = generateSlug(salesperson.salespersonName);
      if (!baseSlug) {
        baseSlug = `vendedor-${salesperson.id.substring(0, 8)}`;
      }
      
      let slug = baseSlug;
      let counter = 1;
      
      const existingSlugs = await db
        .select({ slug: salespeopleUsers.publicSlug })
        .from(salespeopleUsers)
        .where(sql`${salespeopleUsers.publicSlug} LIKE ${baseSlug + '%'}`);
      
      const slugSet = new Set(existingSlugs.map(s => s.slug).filter(Boolean));
      
      while (slugSet.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      await db
        .update(salespeopleUsers)
        .set({
          publicSlug: slug,
          catalogEnabled: true,
          updatedAt: new Date()
        })
        .where(eq(salespeopleUsers.id, salesperson.id));
      
      console.log(`  ✅ Catálogo activado: ${salesperson.salespersonName} → /catalogo/${slug}`);
      updated++;
    }
    
    console.log(`✅ Catálogos inicializados: ${updated} actualizados, ${skipped} ya configurados`);
    
    return { updated, skipped };
  }

  async getSalespersonUserById(userId: string): Promise<SalespersonUser | undefined> {
    // Look up salespersonUser by their id
    const [salespersonUser] = await db
      .select()
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.id, userId));
    return salespersonUser;
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
        clientName: factVentas.nokoen,
        totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
        lastPurchaseDate: sql<string>`MAX(${factVentas.feemdo})`,
        firstPurchaseDate: sql<string>`MIN(${factVentas.feemdo})`
      })
      .from(factVentas)
      .where(and(
        eq(factVentas.nokofu, salesperson),
        sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`
      ))
      .groupBy(factVentas.nokoen)
      .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`);

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
          productName: factVentas.nokoprct,
          productSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`
        })
        .from(factVentas)
        .where(and(
          eq(factVentas.nokofu, salesperson),
          eq(factVentas.nokoen, client.clientName),
          sql`${factVentas.nokoprct} IS NOT NULL AND ${factVentas.nokoprct} != ''`
        ))
        .groupBy(factVentas.nokoprct)
        .orderBy(sql`SUM(CAST(${factVentas.monto} AS NUMERIC)) DESC`)
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

  // ==================================================================================
  // SHARED ANALYTICS HELPERS - Reusable helpers for smart notifications
  // ==================================================================================

  private async _getTrendingProductsForSalesperson(salesperson: string, limit: number = 10): Promise<Array<{
    productName: string;
    recentSales: number;
    growthRate: number;
    recommendation: string;
  }>> {
    // Get recent product sales (last 30 days)
    const recentProductSales = await db
      .select({
        productName: factVentas.nokoprct,
        recentSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(
        eq(factVentas.nokofu, salesperson),
        sql`${factVentas.nokoprct} IS NOT NULL AND ${factVentas.nokoprct} != ''`,
        sql`${factVentas.feemdo}::date >= CURRENT_DATE - INTERVAL '30 days'`
      ))
      .groupBy(factVentas.nokoprct);

    // Get previous product sales (30-60 days ago)
    const previousProductSales = await db
      .select({
        productName: factVentas.nokoprct,
        previousSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(
        eq(factVentas.nokofu, salesperson),
        sql`${factVentas.nokoprct} IS NOT NULL AND ${factVentas.nokoprct} != ''`,
        sql`${factVentas.feemdo}::date >= CURRENT_DATE - INTERVAL '60 days'`,
        sql`${factVentas.feemdo}::date < CURRENT_DATE - INTERVAL '30 days'`
      ))
      .groupBy(factVentas.nokoprct);

    // Calculate trends and growth rates
    const productTrends = recentProductSales.map(recent => {
      const previous = previousProductSales.find(p => p.productName === recent.productName);
      const previousSalesValue = Number(previous?.previousSales || 0);
      const recentSalesValue = Number(recent.recentSales);
      
      let growthRate = 0;
      if (previousSalesValue > 0) {
        growthRate = ((recentSalesValue - previousSalesValue) / previousSalesValue) * 100;
      } else if (recentSalesValue > 0) {
        growthRate = 100; // New product with sales
      }
      
      return {
        productName: recent.productName || '',
        recentSales: recentSalesValue,
        growthRate,
        previousSales: previousSalesValue
      };
    })
    .filter(p => p.growthRate > 10 && p.recentSales > 0)
    .sort((a, b) => b.growthRate - a.growthRate)
    .slice(0, limit);

    // Map to final format with recommendations
    return productTrends.map(product => {
      let recommendation = '';
      if (product.growthRate > 50) {
        recommendation = 'Alta demanda - Recomendar a clientes activos';
      } else if (product.growthRate > 25) {
        recommendation = 'Tendencia positiva - Considerar promocionar';
      } else {
        recommendation = 'Crecimiento moderado - Mantener en oferta';
      }
      
      return {
        productName: product.productName,
        recentSales: product.recentSales,
        growthRate: Math.round(product.growthRate * 10) / 10,
        recommendation
      };
    });
  }

  private async _getInactiveClientsForSalesperson(salesperson: string, clientName?: string): Promise<Array<{
    clientName: string;
    daysSinceLastPurchase: number;
    lastPurchaseAmount: number;
    totalHistoricalSales: number;
    lastPurchaseId: string;
  }>> {
    const today = new Date();
    
    const conditions = [
      eq(factVentas.nokofu, salesperson),
      sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`,
      sql`${factVentas.tido} != 'GDV'`
    ];
    
    // If specific client requested, filter by name
    if (clientName) {
      conditions.push(eq(factVentas.nokoen, clientName));
    }
    
    // Clientes que requieren seguimiento: al menos 4 compras en los últimos 12 meses
    // y más de 30 días sin comprar
    const inactiveClientsData = await db
      .select({
        clientName: factVentas.nokoen,
        lastPurchaseDate: sql<string>`MAX(${factVentas.feemdo})`,
        lastPurchaseId: sql<string>`(
          SELECT st2.idmaeedo
          FROM ventas.fact_ventas st2
          WHERE st2.nokoen = fact_ventas.nokoen
            AND st2.nokofu = ${salesperson}
            AND st2.tido != 'GDV'
          ORDER BY st2.feemdo DESC
          LIMIT 1
        )`,
        lastPurchaseAmount: sql<number>`(
          SELECT CAST(st2.monto AS NUMERIC)
          FROM ventas.fact_ventas st2
          WHERE st2.nokoen = fact_ventas.nokoen
            AND st2.nokofu = ${salesperson}
            AND st2.tido != 'GDV'
          ORDER BY st2.feemdo DESC
          LIMIT 1
        )`,
        totalHistoricalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.nokoen)
      .having(sql`
        MAX(${factVentas.feemdo})::date < CURRENT_DATE - INTERVAL '30 days'
        AND COUNT(CASE 
          WHEN ${factVentas.feemdo}::date >= CURRENT_DATE - INTERVAL '12 months' 
          THEN 1 
          END) >= 4
      `)
      .orderBy(sql`MAX(${factVentas.feemdo}) DESC`);

    return inactiveClientsData.map(client => {
      const lastPurchaseDate = new Date(client.lastPurchaseDate);
      const daysSinceLastPurchase = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        clientName: client.clientName || '',
        daysSinceLastPurchase,
        lastPurchaseAmount: Number(client.lastPurchaseAmount || 0),
        totalHistoricalSales: Number(client.totalHistoricalSales),
        lastPurchaseId: client.lastPurchaseId || ''
      };
    });
  }

  private async _getSeasonalPatternsForSalesperson(salesperson: string, clientName?: string): Promise<Array<{
    clientName: string;
    expectedPurchaseDate: string;
    averagePurchaseAmount: number;
    purchasePattern: string;
  }>> {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const monthName = format(new Date(2024, currentMonth - 1, 1), 'MMMM', { locale: es });
    
    const conditions = [
      eq(factVentas.nokofu, salesperson),
      sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`,
      sql`EXTRACT(MONTH FROM ${factVentas.feemdo}::date) = ${currentMonth}`
    ];
    
    // If specific client requested, filter by name
    if (clientName) {
      conditions.push(eq(factVentas.nokoen, clientName));
    }
    
    // Find clients who have purchased in this month historically (across multiple years)
    // but are NOT currently active (haven't purchased in last 30 days)
    const seasonalClientsData = await db
      .select({
        clientName: factVentas.nokoen,
        avgAmount: sql<number>`AVG(CAST(${factVentas.monto} AS NUMERIC))`,
        transactionCount: sql<number>`COUNT(*)`,
        yearsCount: sql<number>`COUNT(DISTINCT EXTRACT(YEAR FROM ${factVentas.feemdo}::date))`,
        lastPurchaseDate: sql<string>`MAX(${factVentas.feemdo})`
      })
      .from(factVentas)
      .where(and(...conditions))
      .groupBy(factVentas.nokoen)
      .having(sql`
        COUNT(DISTINCT EXTRACT(YEAR FROM ${factVentas.feemdo}::date)) >= 2 
        AND MAX(${factVentas.feemdo})::date < CURRENT_DATE - INTERVAL '30 days'
      `)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(clientName ? 1 : 10);

    return seasonalClientsData.map(client => {
      const purchasePattern = `Suele comprar en ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
      const yearsCount = Number(client.yearsCount);
      const transactionCount = Number(client.transactionCount);
      
      return {
        clientName: client.clientName || '',
        expectedPurchaseDate: `${currentMonth}/${today.getFullYear()}`,
        averagePurchaseAmount: Number(client.avgAmount),
        purchasePattern: yearsCount > 2 
          ? `${purchasePattern} (${yearsCount} años consecutivos, ${transactionCount} compras)` 
          : `${purchasePattern} (${transactionCount} compras)`
      };
    });
  }

  // ==================================================================================
  // END OF SHARED ANALYTICS HELPERS
  // ==================================================================================

  async getSalespersonSmartNotifications(salesperson: string): Promise<{
    inactiveClients: Array<{
      clientName: string;
      daysSinceLastPurchase: number;
      lastPurchaseAmount: number;
      totalHistoricalSales: number;
      lastPurchaseId: string;
      id?: string;
    }>;
    seasonalClients: Array<{
      clientName: string;
      expectedPurchaseDate: string;
      averagePurchaseAmount: number;
      purchasePattern: string;
    }>;
    trendingProducts: Array<{
      productName: string;
      recentSales: number;
      growthRate: number;
      recommendation: string;
    }>;
  }> {
    // Try to get salesperson user
    const salespersonUser = await db
      .select()
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.salespersonName, salesperson))
      .limit(1);

    let inactiveClientsResult: Array<{
      clientName: string;
      daysSinceLastPurchase: number;
      lastPurchaseAmount: number;
      totalHistoricalSales: number;
      lastPurchaseId: string;
      id?: string;
    }> = [];
    
    let usedFallback = false;

    // FALLBACK: Use on-demand query if salesperson user lookup fails (ETL hasn't run or user not in table)
    if (salespersonUser.length === 0) {
      console.log(`[SMART-NOTIFICATIONS] Using fallback for ${salesperson}: no salespeopleUsers record found`);
      inactiveClientsResult = await this._getInactiveClientsForSalesperson(salesperson);
      usedFallback = true;
    } else {
      // Use clientesInactivos table (same source as CRM)
      try {
        const results = await db
          .select()
          .from(clientesInactivos)
          .where(and(
            eq(clientesInactivos.salespersonId, salespersonUser[0].id),
            eq(clientesInactivos.addedToCrm, false),
            eq(clientesInactivos.dismissed, false)
          ))
          .orderBy(desc(clientesInactivos.daysSinceLastPurchase))
          .limit(20);

        inactiveClientsResult = results.map(client => ({
          id: client.id,
          clientName: client.clientName,
          daysSinceLastPurchase: client.daysSinceLastPurchase,
          lastPurchaseAmount: Number(client.lastPurchaseAmount || 0),
          totalHistoricalSales: Number(client.totalPurchasesLastYear || 0),
          lastPurchaseId: '', // Will be fetched on-demand when needed
        }));
        
        // Empty result is valid - it means all clients are already added or dismissed
      } catch (error) {
        // FALLBACK: Only if the query itself fails
        console.error(`[SMART-NOTIFICATIONS] clientesInactivos query failed for ${salesperson}, using fallback:`, error);
        inactiveClientsResult = await this._getInactiveClientsForSalesperson(salesperson);
        usedFallback = true;
      }
    }

    // Get seasonal and trending products in parallel
    const [seasonalClients, trendingProducts] = await Promise.all([
      this._getSeasonalPatternsForSalesperson(salesperson),
      this._getTrendingProductsForSalesperson(salesperson, 10)
    ]);

    return {
      inactiveClients: inactiveClientsResult,
      seasonalClients,
      trendingProducts
    };
  }

  async getClientLastPurchaseDetails(salesperson: string, clientName: string): Promise<{
    lastPurchaseId: string;
    lastPurchaseDate: string;
    lastPurchaseAmount: number;
    products: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
    }>;
  } | null> {
    // Get last purchase info
    const lastPurchaseInfo = await db
      .select({
        idmaeedo: factVentas.idmaeedo,
        feemdo: factVentas.feemdo,
        monto: factVentas.monto
      })
      .from(factVentas)
      .where(and(
        eq(factVentas.nokofu, salesperson),
        eq(factVentas.nokoen, clientName),
        sql`${factVentas.tido} != 'GDV'`
      ))
      .orderBy(sql`${factVentas.feemdo} DESC`)
      .limit(1);

    if (lastPurchaseInfo.length === 0) {
      return null;
    }

    const lastPurchase = lastPurchaseInfo[0];

    // Get products from last purchase
    const products = await db
      .select({
        productName: factVentas.nokoprct,
        quantity: factVentas.caprco1,
        unitPrice: factVentas.ppprbr,
        totalAmount: factVentas.monto
      })
      .from(factVentas)
      .where(eq(factVentas.idmaeedo, lastPurchase.idmaeedo))
      .orderBy(sql`CAST(${factVentas.monto} AS NUMERIC) DESC`);

    return {
      lastPurchaseId: lastPurchase.idmaeedo,
      lastPurchaseDate: lastPurchase.feemdo,
      lastPurchaseAmount: Number(lastPurchase.monto),
      products: products.map(p => ({
        productName: p.productName || '',
        quantity: Number(p.quantity || 0),
        unitPrice: Number(p.unitPrice || 0),
        totalAmount: Number(p.totalAmount || 0)
      }))
    };
  }

  async fetchLeadRecommendations(leadId: string, salesperson: string, clientName: string): Promise<{
    clientActivity: {
      isInactive: boolean;
      daysSinceLastPurchase: number | null;
      lastPurchaseAmount: number | null;
      totalHistoricalSales: number | null;
    };
    isSeasonal: boolean;
    expectedPurchaseDate: string | null;
    averagePurchaseAmount: number | null;
    purchasePattern: string | null;
    trendingProducts: Array<{
      productName: string;
      recentSales: number;
      growthRate: number;
      recommendation: string;
    }>;
  }> {
    // Use shared helpers to get data for specific client
    const [inactiveClients, seasonalClients, trendingProducts] = await Promise.all([
      this._getInactiveClientsForSalesperson(salesperson, clientName),
      this._getSeasonalPatternsForSalesperson(salesperson, clientName),
      this._getTrendingProductsForSalesperson(salesperson, 5)
    ]);

    // Map inactive client data to clientActivity format
    let clientActivity = {
      isInactive: false,
      daysSinceLastPurchase: null as number | null,
      lastPurchaseAmount: null as number | null,
      totalHistoricalSales: null as number | null,
    };

    if (inactiveClients.length > 0) {
      const inactive = inactiveClients[0];
      clientActivity = {
        isInactive: true,
        daysSinceLastPurchase: inactive.daysSinceLastPurchase,
        lastPurchaseAmount: inactive.lastPurchaseAmount,
        totalHistoricalSales: inactive.totalHistoricalSales,
      };
    }

    // Map seasonal client data to flat format
    let isSeasonal = false;
    let expectedPurchaseDate = null as string | null;
    let averagePurchaseAmount = null as number | null;
    let purchasePattern = null as string | null;

    if (seasonalClients.length > 0) {
      const seasonal = seasonalClients[0];
      isSeasonal = true;
      expectedPurchaseDate = seasonal.expectedPurchaseDate;
      averagePurchaseAmount = seasonal.averagePurchaseAmount;
      purchasePattern = seasonal.purchasePattern;
    }

    return {
      clientActivity,
      isSeasonal,
      expectedPurchaseDate,
      averagePurchaseAmount,
      purchasePattern,
      trendingProducts
    };
  }

  async getSalespeopleUnderSupervisor(supervisorId: string): Promise<Array<{
    id: string;
    salespersonName: string;
    email: string;
    assignedSegment?: string | null;
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
          totalSales: sql<number>`COALESCE(SUM(CAST(${factVentas.monto} AS NUMERIC)), 0)`,
          transactionCount: sql<number>`COUNT(*)`,
          lastSale: sql<string>`MAX(${factVentas.feemdo})`
        })
        .from(factVentas)
        .where(eq(factVentas.nokofu, salesperson.salespersonName));

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
        assignedSegment: salesperson.assignedSegment || null,
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
    productFamily?: string | null;
    color?: string | null;
    variantParentSku?: string | null;
    variantGenericDisplayName?: string | null;
    variantIndex?: number;
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
        productFamily: ecommerceProducts.productFamily,
        color: ecommerceProducts.color,
        variantParentSku: ecommerceProducts.variantParentSku,
        variantGenericDisplayName: ecommerceProducts.variantGenericDisplayName,
        variantIndex: ecommerceProducts.variantIndex,
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
    // Order by: variantParentSku (groups variants together), then variantIndex (order within group)
    const results = await baseQuery
      .orderBy(
        sql`COALESCE(${ecommerceProducts.variantParentSku}, ${priceList.codigo})`,
        sql`COALESCE(${ecommerceProducts.variantIndex}, 0)`,
        priceList.producto
      )
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
      productFamily: row.productFamily || null,
      color: row.color || null,
      variantParentSku: row.variantParentSku || null,
      variantGenericDisplayName: row.variantGenericDisplayName || null,
      variantIndex: row.variantIndex ?? 0,
    }));
  }

  async getProductGroupsWithVariations(): Promise<Array<{
    id: string;
    nombre: string;
    descripcion?: string;
    imagenPrincipal?: string;
    categoria?: string;
    activo: boolean;
    variationCount: number;
    variations: Array<{
      id: string;
      priceListId: string;
      codigo: string;
      producto: string;
      unidad?: string;
      color?: string;
      precio: number;
      imagenUrl?: string;
      activo: boolean;
      isMainVariant: boolean;
    }>;
  }>> {
    const { ecommerceProductGroups, ecommerceProducts, priceList } = await import('@shared/schema');
    
    const groups = await db
      .select()
      .from(ecommerceProductGroups)
      .orderBy(ecommerceProductGroups.nombre);
    
    const variations = await db
      .select({
        id: ecommerceProducts.id,
        priceListId: ecommerceProducts.priceListId,
        groupId: ecommerceProducts.groupId,
        color: ecommerceProducts.color,
        imagenUrl: ecommerceProducts.imagenUrl,
        activo: ecommerceProducts.activo,
        isMainVariant: ecommerceProducts.isMainVariant,
        precioEcommerce: ecommerceProducts.precioEcommerce,
        codigo: priceList.codigo,
        producto: priceList.producto,
        unidad: priceList.unidad,
        precioLista: priceList.canalDigital,
      })
      .from(ecommerceProducts)
      .innerJoin(priceList, eq(ecommerceProducts.priceListId, priceList.id))
      .where(isNotNull(ecommerceProducts.groupId))
      .orderBy(ecommerceProducts.color, priceList.unidad);
    
    const variationsByGroup = new Map<string, typeof variations>();
    for (const v of variations) {
      const groupVariations = variationsByGroup.get(v.groupId!) || [];
      groupVariations.push(v);
      variationsByGroup.set(v.groupId!, groupVariations);
    }
    
    return groups.map(group => ({
      id: group.id,
      nombre: group.nombre,
      descripcion: group.descripcion || undefined,
      imagenPrincipal: group.imagenPrincipal || undefined,
      categoria: group.categoria || undefined,
      activo: group.activo ?? true,
      variationCount: variationsByGroup.get(group.id)?.length || 0,
      variations: (variationsByGroup.get(group.id) || []).map(v => ({
        id: v.id,
        priceListId: v.priceListId,
        codigo: v.codigo || '',
        producto: v.producto || '',
        unidad: v.unidad || undefined,
        color: v.color || undefined,
        precio: Number(v.precioEcommerce) || Number(v.precioLista) || 0,
        imagenUrl: v.imagenUrl || undefined,
        activo: v.activo ?? true,
        isMainVariant: v.isMainVariant ?? false,
      })),
    }));
  }

  async updateProductGroup(id: string, updates: {
    nombre?: string;
    descripcion?: string;
    imagenPrincipal?: string;
    categoria?: string;
    activo?: boolean;
  }): Promise<{ id: string; nombre: string }> {
    const { ecommerceProductGroups } = await import('@shared/schema');
    
    const [updated] = await db
      .update(ecommerceProductGroups)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(ecommerceProductGroups.id, id))
      .returning();
    
    if (!updated) {
      throw new Error('Product group not found');
    }
    
    return { id: updated.id, nombre: updated.nombre };
  }

  async reassignVariationToGroup(variationId: string, newGroupId: string | null): Promise<void> {
    const { ecommerceProducts } = await import('@shared/schema');
    
    await db
      .update(ecommerceProducts)
      .set({
        groupId: newGroupId,
        updatedAt: new Date(),
      })
      .where(eq(ecommerceProducts.id, variationId));
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
    productFamily?: string | null;
    color?: string | null;
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

  async bulkAssignProductsToGroup(productIds: string[], groupId: string): Promise<{ count: number }> {
    const { ecommerceProducts, ecommerceProductGroups } = await import('@shared/schema');
    
    // Verify group exists
    const [group] = await db
      .select()
      .from(ecommerceProductGroups)
      .where(eq(ecommerceProductGroups.id, groupId))
      .limit(1);
    
    if (!group) {
      throw new Error('Group not found');
    }
    
    let count = 0;
    
    for (const priceListId of productIds) {
      // Check if ecommerce record exists
      const [existingProduct] = await db
        .select()
        .from(ecommerceProducts)
        .where(eq(ecommerceProducts.priceListId, priceListId))
        .limit(1);
      
      if (existingProduct) {
        // Update existing record
        await db
          .update(ecommerceProducts)
          .set({
            groupId: groupId,
            updatedAt: new Date()
          })
          .where(eq(ecommerceProducts.id, existingProduct.id));
      } else {
        // Create new ecommerce record with group assignment
        await db
          .insert(ecommerceProducts)
          .values({
            priceListId: priceListId,
            groupId: groupId,
            activo: true,
          });
      }
      count++;
    }
    
    console.log(`✅ Bulk assigned ${count} products to group ${group.nombre}`);
    return { count };
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

  // ================================
  // SHOPIFY-STYLE PRODUCT OPERATIONS
  // ================================

  async createShopifyProduct(product: InsertShopifyProductInput): Promise<ShopifyProduct> {
    const handle = product.handle || this.generateHandle(product.title);
    const [newProduct] = await db
      .insert(shopifyProducts)
      .values({
        ...product,
        handle,
      })
      .returning();
    return newProduct;
  }

  private generateHandle(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async getShopifyProducts(filters?: {
    search?: string;
    category?: string;
    status?: 'draft' | 'active' | 'archived';
    productType?: string;
    limit?: number;
    offset?: number;
  }): Promise<ShopifyProductWithVariants[]> {
    const conditions = [];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(shopifyProducts.title, `%${filters.search}%`),
          ilike(shopifyProducts.description, `%${filters.search}%`)
        )
      );
    }
    if (filters?.category) {
      conditions.push(eq(shopifyProducts.category, filters.category));
    }
    if (filters?.status) {
      conditions.push(eq(shopifyProducts.status, filters.status));
    }
    if (filters?.productType) {
      conditions.push(eq(shopifyProducts.productType, filters.productType));
    }

    let query = db.select().from(shopifyProducts);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const products = await query
      .orderBy(shopifyProducts.sortOrder, shopifyProducts.title)
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    // Fetch options and variants for each product
    const result: ShopifyProductWithVariants[] = [];
    for (const product of products) {
      const options = await db
        .select()
        .from(shopifyProductOptions)
        .where(eq(shopifyProductOptions.productId, product.id))
        .orderBy(shopifyProductOptions.position);

      const variants = await db
        .select()
        .from(shopifyProductVariants)
        .where(eq(shopifyProductVariants.productId, product.id))
        .orderBy(shopifyProductVariants.position);

      result.push({
        ...product,
        options,
        variants,
      });
    }

    return result;
  }

  async getShopifyProduct(id: string): Promise<ShopifyProductWithVariants | null> {
    const [product] = await db
      .select()
      .from(shopifyProducts)
      .where(eq(shopifyProducts.id, id))
      .limit(1);

    if (!product) return null;

    const options = await db
      .select()
      .from(shopifyProductOptions)
      .where(eq(shopifyProductOptions.productId, id))
      .orderBy(shopifyProductOptions.position);

    const variants = await db
      .select()
      .from(shopifyProductVariants)
      .where(eq(shopifyProductVariants.productId, id))
      .orderBy(shopifyProductVariants.position);

    return { ...product, options, variants };
  }

  async getShopifyProductByHandle(handle: string): Promise<ShopifyProductWithVariants | null> {
    const [product] = await db
      .select()
      .from(shopifyProducts)
      .where(eq(shopifyProducts.handle, handle))
      .limit(1);

    if (!product) return null;

    return this.getShopifyProduct(product.id);
  }

  async getShopifyProductByParentSku(parentSku: string): Promise<ShopifyProductWithVariants | null> {
    const [product] = await db
      .select()
      .from(shopifyProducts)
      .where(eq(shopifyProducts.parentSku, parentSku))
      .limit(1);

    if (!product) return null;

    return this.getShopifyProduct(product.id);
  }

  async updateShopifyProduct(id: string, updates: UpdateShopifyProductInput): Promise<ShopifyProduct> {
    const [updated] = await db
      .update(shopifyProducts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(shopifyProducts.id, id))
      .returning();
    return updated;
  }

  async deleteShopifyProduct(id: string): Promise<void> {
    // Cascade delete will handle options and variants
    await db.delete(shopifyProducts).where(eq(shopifyProducts.id, id));
  }

  async createShopifyProductOption(option: InsertShopifyProductOption): Promise<ShopifyProductOption> {
    const [newOption] = await db
      .insert(shopifyProductOptions)
      .values(option)
      .returning();
    return newOption;
  }

  async updateShopifyProductOptions(
    productId: string,
    options: Array<{ name: string; values: string[] }>
  ): Promise<ShopifyProductOption[]> {
    // Delete existing options
    await db.delete(shopifyProductOptions).where(eq(shopifyProductOptions.productId, productId));

    // Insert new options
    const newOptions: ShopifyProductOption[] = [];
    for (let i = 0; i < options.length; i++) {
      const [option] = await db
        .insert(shopifyProductOptions)
        .values({
          productId,
          name: options[i].name,
          values: options[i].values,
          position: i + 1,
        })
        .returning();
      newOptions.push(option);
    }

    return newOptions;
  }

  async createShopifyProductVariant(variant: InsertShopifyProductVariantInput): Promise<ShopifyProductVariant> {
    const [newVariant] = await db
      .insert(shopifyProductVariants)
      .values({
        ...variant,
        price: String(variant.price),
        compareAtPrice: variant.compareAtPrice ? String(variant.compareAtPrice) : null,
        costPrice: variant.costPrice ? String(variant.costPrice) : null,
        weight: variant.weight ? String(variant.weight) : null,
      })
      .returning();
    return newVariant;
  }

  async updateShopifyProductVariant(id: string, updates: UpdateShopifyProductVariantInput): Promise<ShopifyProductVariant> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.price !== undefined) updateData.price = String(updates.price);
    if (updates.compareAtPrice !== undefined) updateData.compareAtPrice = String(updates.compareAtPrice);
    if (updates.costPrice !== undefined) updateData.costPrice = String(updates.costPrice);
    if (updates.weight !== undefined) updateData.weight = String(updates.weight);

    const [updated] = await db
      .update(shopifyProductVariants)
      .set(updateData)
      .where(eq(shopifyProductVariants.id, id))
      .returning();
    return updated;
  }

  async deleteShopifyProductVariant(id: string): Promise<void> {
    await db.delete(shopifyProductVariants).where(eq(shopifyProductVariants.id, id));
  }

  async getShopifyVariantBySku(sku: string): Promise<ShopifyProductVariant | null> {
    const [variant] = await db
      .select()
      .from(shopifyProductVariants)
      .where(eq(shopifyProductVariants.sku, sku))
      .limit(1);
    return variant || null;
  }

  async importShopifyProductsFromCsv(csvData: any[]): Promise<{
    productsCreated: number;
    variantsCreated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let productsCreated = 0;
    let variantsCreated = 0;

    // Group products by variant_parentSku maintaining order of first appearance
    const productGroups = new Map<string, any[]>();
    const groupOrder: string[] = []; // Track order of first appearance
    
    for (const row of csvData) {
      const parentSku = row.variant_parentSku || row.productId;
      if (!productGroups.has(parentSku)) {
        productGroups.set(parentSku, []);
        groupOrder.push(parentSku); // Record order of first appearance
      }
      productGroups.get(parentSku)!.push(row);
    }

    // Process each product group in order of first appearance
    for (let groupIndex = 0; groupIndex < groupOrder.length; groupIndex++) {
      const parentSku = groupOrder[groupIndex];
      const variants = productGroups.get(parentSku)!;
      
      // Sort variants by variant_index to maintain correct order
      variants.sort((a, b) => {
        const indexA = parseInt(a.variant_index || '0', 10);
        const indexB = parseInt(b.variant_index || '0', 10);
        return indexA - indexB;
      });
      
      try {
        // Check if product already exists by parentSku (the correct way to identify products)
        const existingProduct = await this.getShopifyProductByParentSku(parentSku);
        
        if (existingProduct) {
          // Product exists, add/update variants
          for (let i = 0; i < variants.length; i++) {
            const variantRow = variants[i];
            const variantPosition = parseInt(variantRow.variant_index || String(i), 10);
            await this.createVariantFromCsvRow(existingProduct.id, variantRow, variants, variantPosition);
            variantsCreated++;
          }
          continue;
        }
        
        // Find the parent product row (variant_index = 0 or where productId === variant_parentSku)
        const parentRow = variants.find(v => v.variant_index === '0' || v.variant_index === 0) 
                        || variants.find(v => v.productId === parentSku) 
                        || variants[0];
        
        // Extract product title from variant_genericDisplayName or name
        const title = parentRow.variant_genericDisplayName || 
                     parentRow.name?.replace(/\s+(BLANCO|NEGRO|GRIS|ROJO|VERDE|AZUL|CAFE|INCOLORA?|BASE OSCURA|BASE INCOLORA)\s*/gi, '').trim() ||
                     parentRow.name;

        // Generate handle from parentSku (not from name) to ensure uniqueness
        const handle = this.generateHandle(parentSku);
        
        const [product] = await db
          .insert(shopifyProducts)
          .values({
            parentSku, // Store the parentSku for future lookups
            title,
            description: parentRow.description || '',
            vendor: parentRow.brand || 'Pinturas Panoramica',
            productType: parentRow.group_name || parentRow.tags?.split(',')[0]?.trim() || null,
            tags: parentRow.tags?.split(',').map((t: string) => t.trim()) || [],
            status: 'active',
            category: parentRow.tags?.split(',')[0]?.trim() || null,
            handle,
            sortOrder: groupIndex, // Use order of appearance in CSV
          })
          .onConflictDoNothing()
          .returning();

        if (!product) {
          errors.push(`Failed to create product for SKU ${parentSku}`);
          continue;
        }

        productsCreated++;

        // Determine options from variants
        const colors = new Set<string>();
        const formats = new Set<string>();

        for (const v of variants) {
          // Extract color from name
          const colorMatch = v.name?.match(/(BLANCO|NEGRO|GRIS|ROJO|VERDE|AZUL|CAFE|INCOLORA?|BASE OSCURA|BASE INCOLORA)/i);
          if (colorMatch) {
            colors.add(colorMatch[1].toUpperCase());
          }
          // Extract format from packaging
          if (v.packaging_unitName) {
            formats.add(v.packaging_unitName);
          }
        }

        // Create options
        const options: Array<{ name: string; values: string[] }> = [];
        if (colors.size > 0) {
          options.push({ name: 'Color', values: Array.from(colors) });
        }
        if (formats.size > 0) {
          options.push({ name: 'Formato', values: Array.from(formats) });
        }

        if (options.length > 0) {
          await this.updateShopifyProductOptions(product.id, options);
        }

        // Create variants using variant_index from CSV for position
        for (let i = 0; i < variants.length; i++) {
          const variantRow = variants[i];
          const variantPosition = parseInt(variantRow.variant_index || String(i), 10);
          await this.createVariantFromCsvRow(product.id, variantRow, variants, variantPosition);
          variantsCreated++;
        }
      } catch (error: any) {
        errors.push(`Error processing ${parentSku}: ${error.message}`);
      }
    }

    return { productsCreated, variantsCreated, errors };
  }

  private async createVariantFromCsvRow(
    productId: string,
    row: any,
    allVariants: any[],
    position: number = 0
  ): Promise<ShopifyProductVariant | null> {
    try {
      // Use variant_features_0_value for color/option1 (from CSV), fallback to regex extraction from name
      let color = row.variant_features_0_value || null;
      if (!color) {
        const colorMatch = row.name?.match(/(BLANCO|NEGRO|GRIS|ROJO|VERDE|AZUL|CAFE|INCOLORA?|BASE OSCURA|BASE INCOLORA)/i);
        color = colorMatch ? colorMatch[1].toUpperCase() : null;
      }

      const [variant] = await db
        .insert(shopifyProductVariants)
        .values({
          productId,
          sku: row.productId,
          price: String(row.pricePerUnit || 0),
          option1: color,
          option2: row.packaging_unitName || null,
          option3: null,
          weight: row.dimensions_weight ? String(row.dimensions_weight) : null,
          weightUnit: row.dimensions_weightUnit || 'kg',
          packagingUnit: row.packaging_unit || null,
          packagingUnitName: row.packaging_unitName || null,
          amountPerPackage: row.packaging_amountPerPackage ? parseInt(row.packaging_amountPerPackage) : null,
          available: row.isDisabled !== 'TRUE' && row.isDisabled !== true,
          position: position + 1,
        })
        .onConflictDoNothing()
        .returning();

      return variant || null;
    } catch (error) {
      console.error(`Error creating variant ${row.productId}:`, error);
      return null;
    }
  }

  async importEcommerceProductsFromCatalogCsv(csvData: any[]): Promise<{
    productsCreated: number;
    productsUpdated: number;
    errors: string[];
  }> {
    let productsCreated = 0;
    let productsUpdated = 0;
    const errors: string[] = [];

    console.log(`[CATALOG IMPORT] Starting import of ${csvData.length} products`);

    for (const row of csvData) {
      try {
        const productId = row.productId?.trim();
        if (!productId) {
          errors.push('Row missing productId');
          continue;
        }

        const productName = row.name?.trim() || productId;
        const price = parseFloat(row.pricePerUnit) || 0;
        const category = row.tags?.trim() || null;
        const description = row.description?.trim() || null;
        const unitName = row.packaging_unitName?.trim() || row.formats_0_displayName?.trim() || null;
        const variantParentSku = row.variant_parentSku?.trim() || null;
        const variantGenericDisplayName = row.variant_genericDisplayName?.trim() || null;
        const variantIndex = parseInt(row.variant_index) || 0;
        const color = row.variant_features_0_value?.trim() || null;
        const minUnit = parseInt(row.constraints_minUnit) || 1;
        const stepSize = parseInt(row.constraints_stepSize) || 1;
        const formatUnit = row.packaging_unitName?.trim() || null;

        // Check if priceList entry exists
        const existingPriceList = await db
          .select()
          .from(priceList)
          .where(eq(priceList.codigo, productId))
          .limit(1);

        let priceListId: string;

        if (existingPriceList.length > 0) {
          // Update existing priceList entry
          priceListId = existingPriceList[0].id;
          await db
            .update(priceList)
            .set({
              producto: productName,
              unidad: unitName,
              lista: price.toString(),
              canalDigital: price.toString(),
              updatedAt: new Date(),
            })
            .where(eq(priceList.id, priceListId));
        } else {
          // Create new priceList entry
          const [newPriceList] = await db
            .insert(priceList)
            .values({
              codigo: productId,
              producto: productName,
              unidad: unitName,
              lista: price.toString(),
              canalDigital: price.toString(),
            })
            .returning();
          priceListId = newPriceList.id;
        }

        // Check if ecommerceProducts entry exists
        const existingEcomProduct = await db
          .select()
          .from(ecommerceProducts)
          .where(eq(ecommerceProducts.priceListId, priceListId))
          .limit(1);

        if (existingEcomProduct.length > 0) {
          // Update existing ecommerceProducts entry
          await db
            .update(ecommerceProducts)
            .set({
              categoria: category,
              descripcion: description,
              activo: row.isDisabled !== 'TRUE' && row.isDisabled !== true,
              precioEcommerce: price.toString(),
              variantParentSku: variantParentSku,
              variantGenericDisplayName: variantGenericDisplayName,
              variantIndex: variantIndex,
              color: color,
              minUnit: minUnit,
              stepSize: stepSize,
              formatUnit: formatUnit,
              updatedAt: new Date(),
            })
            .where(eq(ecommerceProducts.id, existingEcomProduct[0].id));
          productsUpdated++;
        } else {
          // Create new ecommerceProducts entry
          await db
            .insert(ecommerceProducts)
            .values({
              priceListId: priceListId,
              categoria: category,
              descripcion: description,
              activo: row.isDisabled !== 'TRUE' && row.isDisabled !== true,
              precioEcommerce: price.toString(),
              variantParentSku: variantParentSku,
              variantGenericDisplayName: variantGenericDisplayName,
              variantIndex: variantIndex,
              color: color,
              minUnit: minUnit,
              stepSize: stepSize,
              formatUnit: formatUnit,
            });
          productsCreated++;
        }
      } catch (error: any) {
        const errMsg = `Error processing ${row.productId}: ${error.message}`;
        console.error(`[CATALOG IMPORT] ${errMsg}`);
        errors.push(errMsg);
      }
    }

    console.log(`[CATALOG IMPORT] Completed: ${productsCreated} created, ${productsUpdated} updated, ${errors.length} errors`);
    return { productsCreated, productsUpdated, errors };
  }

  async clearAllEcommerceProducts(): Promise<{ deletedCount: number }> {
    console.log('[CATALOG CLEAR] Clearing all ecommerce products and priceList entries');
    
    // First delete all ecommerceProducts
    const ecomDeleted = await db.delete(ecommerceProducts).returning();
    
    // Then delete all priceList entries
    const priceDeleted = await db.delete(priceList).returning();
    
    console.log(`[CATALOG CLEAR] Deleted ${ecomDeleted.length} ecommerce entries and ${priceDeleted.length} priceList entries`);
    
    return { deletedCount: ecomDeleted.length + priceDeleted.length };
  }

  async getShopifyProductsForPublicCatalog(): Promise<any[]> {
    const products = await db
      .select()
      .from(shopifyProducts)
      .where(eq(shopifyProducts.status, 'active'))
      .orderBy(shopifyProducts.sortOrder, shopifyProducts.title);

    const result: any[] = [];
    
    for (const product of products) {
      const options = await db
        .select()
        .from(shopifyProductOptions)
        .where(eq(shopifyProductOptions.productId, product.id))
        .orderBy(shopifyProductOptions.position);

      const variants = await db
        .select()
        .from(shopifyProductVariants)
        .where(and(
          eq(shopifyProductVariants.productId, product.id),
          eq(shopifyProductVariants.available, true)
        ))
        .orderBy(shopifyProductVariants.position);

      if (variants.length > 0) {
        result.push({
          id: product.id,
          title: product.title,
          description: product.description,
          vendor: product.vendor,
          category: product.category,
          featuredImageUrl: product.featuredImageUrl,
          handle: product.handle,
          options,
          variants: variants.map(v => ({
            id: v.id,
            sku: v.sku,
            price: parseFloat(v.price),
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
            imageUrl: v.imageUrl,
            packagingUnitName: v.packagingUnitName,
            inventoryQuantity: v.inventoryQuantity,
          })),
        });
      }
    }

    return result;
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
        monto: factVentas.monto,
        caprad2: factVentas.caprco2,
        nokoen: factVentas.nokoen,
        feemdo: factVentas.feemdo
      })
      .from(factVentas)
      .where(eq(factVentas.koprct, sku));

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
        productId: factVentas.koprct,
        productName: factVentas.nokoprct,
        totalSales: sql<number>`SUM(${factVentas.monto})::numeric`,
        totalQuantity: sql<number>`SUM(${factVentas.caprco2})::numeric`,
        salesCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(inArray(factVentas.nokofu, salespeopleNames))
      .groupBy(factVentas.koprct, factVentas.nokoprct)
      .orderBy(desc(sql`SUM(${factVentas.monto})`))
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
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)::numeric`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .where(inArray(factVentas.nokofu, salespeopleNames));

    // Mejor performer (vendedor con más ventas)
    const bestPerformerQuery = await db
      .select({
        vendedor: factVentas.nokofu,
        totalSales: sql<number>`SUM(${factVentas.monto})::numeric`,
      })
      .from(factVentas)
      .where(inArray(factVentas.nokofu, salespeopleNames))
      .groupBy(factVentas.nokofu)
      .orderBy(desc(sql`SUM(${factVentas.monto})`))
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
    if (startDate) whereConditions.push(sql`${factVentas.feemdo} >= ${startDate}::date`);
    if (endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      whereConditions.push(sql`${factVentas.feemdo} < ${endDateExclusive}::date`);
    }

    const query = db
      .select({
        segment: factVentas.noruen,
        uniqueClients: sql<number>`COUNT(DISTINCT ${factVentas.nokoen})`,
      })
      .from(factVentas)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(factVentas.noruen);

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
      conditions.push(sql`${factVentas.feemdo} >= ${filters.startDate}::date`);
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(sql`${factVentas.feemdo} < ${endDateExclusive}::date`);
    }

    // Add salesperson filter
    if (filters?.salesperson) {
      conditions.push(eq(factVentas.nokofu, filters.salesperson));
    }

    // Add segment filter
    if (filters?.segment) {
      conditions.push(eq(factVentas.noruen, filters.segment));
    }

    // Get total sales for percentage calculation (includes ALL transactions)
    const [totalSalesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .leftJoin(clients, eq(factVentas.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalSales = Number(totalSalesResult.total);

    // Get sales grouped by normalized comuna using fallback data source
    const results = await db
      .select({
        rawComuna: sql<string>`COALESCE(
          NULLIF(TRIM(${clients.comuna}), ''), 
          NULLIF(TRIM(${factVentas.zona}), ''),
          'Sin comuna'
        )`,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .leftJoin(clients, eq(factVentas.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`COALESCE(
        NULLIF(TRIM(${clients.comuna}), ''), 
        NULLIF(TRIM(${factVentas.zona}), ''),
        'Sin comuna'
      )`)
      .orderBy(sql`SUM(${factVentas.monto}) DESC`);

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
      conditions.push(sql`${factVentas.feemdo} >= ${filters.startDate}::date`);
    }
    if (filters?.endDate) {
      // Create exclusive end date by adding 1 day for proper inclusive range
      const endDateObj = new Date(filters.endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      conditions.push(sql`${factVentas.feemdo} < ${endDateExclusive}::date`);
    }

    // Add salesperson filter
    if (filters?.salesperson) {
      conditions.push(eq(factVentas.nokofu, filters.salesperson));
    }

    // Add segment filter
    if (filters?.segment) {
      conditions.push(eq(factVentas.noruen, filters.segment));
    }

    // Get total sales for percentage calculation (includes ALL transactions)
    const [totalSalesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
      })
      .from(factVentas)
      .leftJoin(clients, eq(factVentas.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalSales = Number(totalSalesResult.total);

    // Get sales grouped by normalized comuna using fallback data source
    const comunaResults = await db
      .select({
        rawComuna: sql<string>`COALESCE(
          NULLIF(TRIM(${clients.comuna}), ''), 
          NULLIF(TRIM(${factVentas.zona}), ''),
          'Sin comuna'
        )`,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(factVentas)
      .leftJoin(clients, eq(factVentas.nokoen, clients.nokoen))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`COALESCE(
        NULLIF(TRIM(${clients.comuna}), ''), 
        NULLIF(TRIM(${factVentas.zona}), ''),
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

  // Helper function to calculate date range from sales period
  private getSalesPeriodDateRange(period: string): { startDate: string; endDate: string } | null {
    const now = new Date();
    // Use Chilean timezone
    const chileanTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
    const today = new Date(chileanTime.getFullYear(), chileanTime.getMonth(), chileanTime.getDate());
    
    let startDate: Date;
    let endDate: Date = today;
    
    switch (period) {
      case 'today':
        startDate = today;
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        endDate = startDate;
        break;
      case 'this_week':
        startDate = new Date(today);
        const dayOfWeek = startDate.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start of week
        startDate.setDate(startDate.getDate() - diff);
        break;
      case 'last_week':
        startDate = new Date(today);
        const currentDayOfWeek = startDate.getDay();
        const daysToLastMonday = currentDayOfWeek === 0 ? 13 : currentDayOfWeek + 6;
        startDate.setDate(startDate.getDate() - daysToLastMonday);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        break;
      case 'this_month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'last_30_days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last_90_days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'this_year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        return null;
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
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
    salesPeriod?: string;
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

    // Sales period filter - requires join with factVentas
    const needsSalesJoin = filters?.salesperson || filters?.salesPeriod;
    const salesPeriodRange = filters?.salesPeriod ? this.getSalesPeriodDateRange(filters.salesPeriod) : null;
    
    if (filters?.salesPeriod) {
      console.log(`[getClients] Sales period filter: ${filters.salesPeriod}, range: ${JSON.stringify(salesPeriodRange)}`);
    }

    // First get all clients with basic info
    let query = db.select().from(clients);

    // If filtering by salesperson or salesPeriod, we need to join with sales transactions
    if (needsSalesJoin) {
      const salesConditions: any[] = [];
      
      if (filters?.salesperson) {
        salesConditions.push(eq(factVentas.nokofu, filters.salesperson));
      }
      
      if (salesPeriodRange) {
        salesConditions.push(sql`${factVentas.feemdo} >= ${salesPeriodRange.startDate}`);
        salesConditions.push(sql`${factVentas.feemdo} <= ${salesPeriodRange.endDate}`);
      }
      
      const allConditions = [...conditions, ...salesConditions];

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
        .innerJoin(factVentas, eq(clients.nokoen, factVentas.nokoen))
        .where(allConditions.length > 0 ? and(...allConditions) : undefined) as any;
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
          .from(factVentas)
          .where(eq(factVentas.nokoen, client.nokoen));

        const [salesData] = await db
          .select({ 
            totalSales: sql<number>`COALESCE(SUM(${factVentas.vabrdo}), 0)`,
            lastTransactionDate: sql<string>`MAX(${factVentas.feemdo})::text`
          })
          .from(factVentas)
          .where(eq(factVentas.nokoen, client.nokoen));

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
    salesPeriod?: string;
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

    // Sales period filter - requires join with factVentas
    const needsSalesJoin = filters?.salesperson || filters?.salesPeriod;
    const salesPeriodRange = filters?.salesPeriod ? this.getSalesPeriodDateRange(filters.salesPeriod) : null;

    // Count query
    let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(clients);

    // If filtering by salesperson or salesPeriod, we need to join with sales transactions
    if (needsSalesJoin) {
      const salesConditions: any[] = [];
      
      if (filters?.salesperson) {
        salesConditions.push(eq(factVentas.nokofu, filters.salesperson));
      }
      
      if (salesPeriodRange) {
        salesConditions.push(sql`${factVentas.feemdo} >= ${salesPeriodRange.startDate}`);
        salesConditions.push(sql`${factVentas.feemdo} <= ${salesPeriodRange.endDate}`);
      }
      
      const allConditions = [...conditions, ...salesConditions];

      const [result] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${clients.id})` })
        .from(clients)
        .innerJoin(factVentas, eq(clients.nokoen, factVentas.nokoen))
        .where(allConditions.length > 0 ? and(...allConditions) : undefined);
      
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

  async getClientByRut(rut: string) {
    // Clean RUT for comparison (remove dots, dashes, spaces)
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').replace(/\s/g, '').toUpperCase();
    
    // Search with LIKE to handle different RUT formats stored in DB
    const result = await db
      .select()
      .from(clients)
      .where(
        sql`REPLACE(REPLACE(REPLACE(UPPER(${clients.rten}), '.', ''), '-', ''), ' ', '') = ${cleanRut}`
      )
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
        case 'tecnico_obra':
          // Tecnico de obra gets tasks they created + tasks assigned to them
          // For now, we'll proceed without additional filtering at this level
          // The getTasksWithAssignmentsOptimized function handles tecnico_obra specifically
          break;
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
          (assignment.assigneeType === "supervisor" || assignment.assigneeType === "salesperson") && assignment.assigneeId === assigneeUserId
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
          taskConditions.push(sql`(
            ${tasks.createdByUserId} = ${userId} OR 
            EXISTS (
              SELECT 1 FROM ${taskAssignments} 
              WHERE ${taskAssignments.taskId} = ${tasks.id} 
              AND (
                (${taskAssignments.assigneeType} = 'supervisor' AND ${taskAssignments.assigneeId} = ${userId}) OR
                (${taskAssignments.assigneeType} = 'salesperson' AND ${taskAssignments.assigneeId} = ${userId}) OR
                (${taskAssignments.assigneeType} = 'user' AND ${taskAssignments.assigneeId} = ${userId})
              )
            )
          )`);
          break;
        case 'salesperson':
          // SECURITY FIX: Salesperson sees only tasks assigned to them - use safe SQL 
          taskConditions.push(sql`
            EXISTS (
              SELECT 1 FROM ${taskAssignments} 
              WHERE ${taskAssignments.taskId} = ${tasks.id} 
              AND (
                (${taskAssignments.assigneeType} = 'supervisor' AND ${taskAssignments.assigneeId} = ${userId}) OR
                (${taskAssignments.assigneeType} = 'salesperson' AND ${taskAssignments.assigneeId} = ${userId}) OR
                (${taskAssignments.assigneeType} = 'user' AND ${taskAssignments.assigneeId} = ${userId})
              )
            )
          `);
          break;
        case 'tecnico_obra':
          // Tecnico de obra sees: tasks they created OR tasks assigned to them
          taskConditions.push(sql`(
            ${tasks.createdByUserId} = ${userId} OR 
            EXISTS (
              SELECT 1 FROM ${taskAssignments} 
              WHERE ${taskAssignments.taskId} = ${tasks.id} 
              AND (
                (${taskAssignments.assigneeType} = 'supervisor' AND ${taskAssignments.assigneeId} = ${userId}) OR
                (${taskAssignments.assigneeType} = 'salesperson' AND ${taskAssignments.assigneeId} = ${userId}) OR
                (${taskAssignments.assigneeType} = 'user' AND ${taskAssignments.assigneeId} = ${userId})
              )
            )
          )`);
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

  // Task Comments - Sistema de comentarios en hilo
  async getTaskComments(assignmentId: string): Promise<TaskComment[]> {
    const comments = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.assignmentId, assignmentId))
      .orderBy(asc(taskComments.createdAt));
    return comments;
  }

  async addTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const [newComment] = await db
      .insert(taskComments)
      .values(comment)
      .returning();
    return newComment;
  }

  async deleteTaskComment(commentId: string, authorId: string): Promise<void> {
    await db
      .delete(taskComments)
      .where(and(
        eq(taskComments.id, commentId),
        eq(taskComments.authorId, authorId)
      ));
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
        case 'logistica_bodega':
          // Admin, supervisor, and logistics can see all orders
          break;
        case 'salesperson':
          // Salesperson can only see orders they created
          conditions.push(eq(orders.createdBy, userId));
          break;
        case 'client':
          // Clients can only see their own orders
          conditions.push(eq(orders.clientId, userId));
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
  }): Promise<any[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    // Build query with subquery to get average precioMedio (PPP) from inventory_products
    let query = db
      .select({
        priceList: priceList,
        precioPromedioPonderado: sql<string>`
          COALESCE(
            (SELECT AVG(CAST(precio_medio AS NUMERIC))::TEXT 
             FROM inventory_products 
             WHERE sku = ${priceList.codigo} 
             AND precio_medio IS NOT NULL 
             AND CAST(precio_medio AS NUMERIC) > 0
            ), 
            NULL
          )
        `.as('precio_promedio_ponderado')
      })
      .from(priceList);
    
    // Build where conditions
    const conditions = [];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        sql`(${priceList.codigo} ILIKE ${searchTerm} OR 
            ${priceList.producto} ILIKE ${searchTerm})`
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
    
    // Flatten the result to include PPP directly on price list object
    return items.map(row => ({
      ...row.priceList,
      precioPromedioPonderado: row.precioPromedioPonderado
    }));
  }

  async getPriceListCount(search?: string, unidad?: string, tipoProducto?: string, color?: string): Promise<number> {
    let query = db.select({ count: sql`count(*)`.as('count') }).from(priceList);
    
    // Build where conditions
    const conditions = [];
    
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        sql`(${priceList.codigo} ILIKE ${searchTerm} OR 
            ${priceList.producto} ILIKE ${searchTerm})`
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
    dateFrom?: string;
    dateTo?: string;
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
    if (filters?.dateFrom) {
      conditions.push(sql`${quotes.createdAt} >= ${filters.dateFrom}::date`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${quotes.createdAt} <= (${filters.dateTo}::date + interval '1 day')`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const result = await query
      .orderBy(desc(quotes.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Flatten the result to include creator info directly on quote object
    return result.map(row => {
      let creatorName = 'Usuario desconocido';
      
      if (row.creatorFirstName && row.creatorLastName) {
        creatorName = `${row.creatorFirstName} ${row.creatorLastName}`;
      } else if (row.creatorFirstName) {
        creatorName = row.creatorFirstName;
      } else if (row.creatorLastName) {
        creatorName = row.creatorLastName;
      } else if (row.creatorEmail) {
        // Use email username part if no name is available
        creatorName = row.creatorEmail.split('@')[0];
      }
      
      return {
        ...row.quote,
        creatorEmail: row.creatorEmail,
        creatorFirstName: row.creatorFirstName,
        creatorLastName: row.creatorLastName,
        creatorName
      };
    });
  }

  async getQuoteCreators(): Promise<Array<{id: string; name: string}>> {
    const result = await db.selectDistinct({
      id: quotes.createdBy,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(quotes)
    .leftJoin(users, eq(quotes.createdBy, users.id))
    .where(isNotNull(quotes.createdBy));

    return result.map(row => ({
      id: row.id || '',
      name: row.firstName && row.lastName 
        ? `${row.firstName} ${row.lastName}` 
        : row.firstName || row.lastName || row.email?.split('@')[0] || 'Usuario'
    })).filter(creator => creator.id);
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
  // 
  // ⚠️ ARCHITECTURE NOTE (December 2025):
  // The NVV system now uses ETL-based data from nvv.fact_nvv.
  // 
  // CURRENT (ACTIVE) functions - use nvv.fact_nvv from ETL:
  //   - getNvvDashboardData()
  //   - getNvvPendingSales() 
  //   - getNvvSummaryMetrics()
  //   - getNvvBySalesperson()
  //   - getNvvTotalSummary()
  //
  // DEPRECATED functions - use nvv_pending_sales table (CSV import):
  //   - importNvvFromCsv() - DEPRECATED
  //   - clearAllNvvData() - DEPRECATED
  //   - deleteNvvBatch() - DEPRECATED
  //
  // See: server/etl-nvv.ts for the current ETL implementation
  // ==============================================

  /**
   * @deprecated This function is DEPRECATED. NVV data is now loaded via automated ETL
   * from SQL Server, not CSV import. See server/etl-nvv.ts for the current implementation.
   * This function operates on the deprecated nvv_pending_sales table.
   */
  async importNvvFromCsv(nvvData: InsertNvvPendingSales[], importBatch: string): Promise<NvvImportResult> {
    console.warn('⚠️ DEPRECATED: importNvvFromCsv() is deprecated. Use ETL from server/etl-nvv.ts instead.');
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

  /**
   * @deprecated This function is DEPRECATED. It operates on the deprecated nvv_pending_sales table.
   * NVV data is now managed via ETL which handles its own cleanup through full synchronization.
   * See server/etl-nvv.ts for the current implementation.
   */
  async clearAllNvvData(): Promise<{ success: boolean; deletedCount: number; message: string }> {
    console.warn('⚠️ DEPRECATED: clearAllNvvData() is deprecated. NVV cleanup is handled by ETL.');
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

  async getNvvTotalSummary(options?: { salesperson?: string; segment?: string }): Promise<{
    totalAmount: number;
    totalRecords: number;
  }> {
    try {
      // If segment filter is provided, we need to find the salespeople (kofulido codes) that belong to that segment
      let vendorCodesForSegment: string[] | null = null;
      
      if (options?.segment) {
        // Get unique vendor codes (kofulido) from nvv.fact_nvv for the segment
        const vendorsBySegment = await db.execute(sql`
          SELECT DISTINCT kofulido 
          FROM nvv.fact_nvv 
          WHERE nombre_segmento_cliente = ${options.segment}
            AND kofulido IS NOT NULL 
            AND kofulido != ''
            AND (eslido IS NULL OR eslido = '')
        `);
        vendorCodesForSegment = vendorsBySegment.rows.map((row: any) => row.kofulido);
        
        // If no vendors found for segment, return zero results
        if (vendorCodesForSegment.length === 0) {
          return { totalAmount: 0, totalRecords: 0 };
        }
      }
      
      // Build conditions - always filter for pending NVV only (eslido IS NULL OR eslido = '')
      const conditions = [sql`(eslido IS NULL OR eslido = '')`];
      
      if (options?.salesperson) {
        conditions.push(sql`kofulido = ${options.salesperson}`);
      }
      
      if (vendorCodesForSegment && vendorCodesForSegment.length > 0) {
        conditions.push(sql`kofulido IN (${sql.join(vendorCodesForSegment.map(v => sql`${v}`), sql`, `)})`);
      }
      
      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
      
      // Get total amount from monto column in nvv.fact_nvv (ETL data)
      const totalResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(monto), 0) as total_amount,
          COUNT(*) as total_records
        FROM nvv.fact_nvv
        ${whereClause}
      `);

      const result = totalResult.rows[0];
      return {
        totalAmount: parseFloat(result?.total_amount?.toString() || '0'),
        totalRecords: parseInt(result?.total_records?.toString() || '0')
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
  } = {}): Promise<any[]> {
    try {
      // Build conditions - always filter for pending NVV only (eslido IS NULL OR eslido = '')
      const conditions = [sql`(eslido IS NULL OR eslido = '')`];
      
      // If segment filter is provided, filter by nombre_segmento_cliente
      if (options.segment) {
        conditions.push(sql`nombre_segmento_cliente = ${options.segment}`);
      }

      // Use kofulido for salesperson filtering
      if (options.salesperson) {
        conditions.push(sql`kofulido = ${options.salesperson}`);
      }

      // Use feerli for date filtering (commitment date)
      if (options.startDate) {
        conditions.push(sql`feerli >= ${options.startDate.toISOString().split('T')[0]}`);
      }

      if (options.endDate) {
        conditions.push(sql`feerli <= ${options.endDate.toISOString().split('T')[0]}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
      const limitClause = options.limit ? sql`LIMIT ${options.limit}` : sql``;
      const offsetClause = options.offset ? sql`OFFSET ${options.offset}` : sql``;

      // Query from nvv.fact_nvv (ETL data)
      const results = await db.execute(sql`
        SELECT 
          id,
          nudo as "NUDO",
          nokoen as "NOKOEN",
          kofulido as "KOFULIDO",
          nombre_vendedor as "nombre_vendedor",
          feemdo as "FEEMDO",
          feerli as "FEERLI",
          feemli as "FEEMLI",
          monto as "totalPendiente",
          koprct as "KOPRCT",
          nokopr as "NOKOPR",
          sudo as "SUDO",
          eslido,
          nombre_segmento_cliente as "nombre_segmento_cliente",
          caprco2 as "CAPRCO2",
          caprex2 as "CAPREX2",
          ppprne as "PPPRNE"
        FROM nvv.fact_nvv
        ${whereClause}
        ORDER BY feerli DESC
        ${limitClause}
        ${offsetClause}
      `);

      return results.rows;
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
    client?: string;
  } = {}): Promise<{
    totalAmount: number;
    totalQuantity: number;
    pendingCount: number;
    confirmedCount: number;
    deliveredCount: number;
    cancelledCount: number;
  }> {
    try {
      // Build conditions - always filter for pending NVV only
      const conditions = [sql`(eslido IS NULL OR eslido = '')`];

      // Use feerli for date filtering
      if (options.startDate) {
        conditions.push(sql`feerli >= ${options.startDate.toISOString().split('T')[0]}`);
      }

      if (options.endDate) {
        conditions.push(sql`feerli <= ${options.endDate.toISOString().split('T')[0]}`);
      }

      // Use kofulido for salesperson filtering
      if (options.salesperson) {
        conditions.push(sql`kofulido = ${options.salesperson}`);
      }

      // Use nombre_segmento_cliente for segment filtering
      if (options.segment) {
        conditions.push(sql`nombre_segmento_cliente = ${options.segment}`);
      }

      // Use nokoen for client filtering
      if (options.client) {
        conditions.push(sql`nokoen = ${options.client}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const results = await db.execute(sql`
        SELECT 
          COALESCE(SUM(monto), 0) as total_amount,
          COUNT(*) as pending_count,
          COUNT(DISTINCT nudo) as document_count
        FROM nvv.fact_nvv
        ${whereClause}
      `);

      const row = results.rows[0] as any;
      return {
        totalAmount: parseFloat(row?.total_amount?.toString() || '0'),
        totalQuantity: parseInt(row?.document_count?.toString() || '0'),
        pendingCount: parseInt(row?.pending_count?.toString() || '0'),
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

  /**
   * @deprecated This function is DEPRECATED. It operates on the deprecated nvv_pending_sales table.
   * NVV batch management is now handled by ETL through full synchronization.
   * See server/etl-nvv.ts for the current implementation.
   */
  async deleteNvvBatch(importBatch: string): Promise<boolean> {
    console.warn('⚠️ DEPRECATED: deleteNvvBatch() is deprecated. NVV management is handled by ETL.');
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

  async getNvvBySalesperson(options: {
    salesperson: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Array<{
    id: string;
    NUDO: string;
    TIDO: string;
    FEEMDO: string;
    ENDO: string;
    NOKOEN: string;
    NOKOPR: string;
    KOPRCT: string;
    CAPREX2: number;
    CAPRCO2: number;
    PPPRNE: number;
    cantidadPendiente: number;
    totalPendiente: number;
  }>> {
    try {
      const searchTerm = options.salesperson.toUpperCase().trim();
      
      // Build conditions - always filter for pending NVV only (eslido IS NULL or empty)
      const conditions: SQL[] = [
        sql`(${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '')`
      ];
      
      // Search by either nombre_vendedor (full name) or kofulido (code)
      conditions.push(sql`(
        UPPER(TRIM(${factNvv.nombre_vendedor})) = ${searchTerm}
        OR UPPER(TRIM(${factNvv.kofulido})) = ${searchTerm}
      )`);

      // Add date filters if provided
      if (options.startDate && options.startDate instanceof Date && !isNaN(options.startDate.getTime())) {
        conditions.push(sql`${factNvv.feemdo} >= ${options.startDate.toISOString().split('T')[0]}`);
      }
      if (options.endDate && options.endDate instanceof Date && !isNaN(options.endDate.getTime())) {
        conditions.push(sql`${factNvv.feemdo} <= ${options.endDate.toISOString().split('T')[0]}`);
      }

      const results = await db
        .select({
          id: factNvv.id,
          NUDO: factNvv.nudo,
          TIDO: factNvv.tido,
          FEEMDO: factNvv.feemdo,
          ENDO: factNvv.endo,
          NOKOEN: factNvv.nokoen,
          NOKOPR: factNvv.nokopr,
          KOPRCT: factNvv.koprct,
          CAPREX2: factNvv.caprex2,
          CAPRCO2: factNvv.caprco2,
          PPPRNE: factNvv.ppprne,
          monto: factNvv.monto
        })
        .from(factNvv)
        .where(and(...conditions))
        .orderBy(desc(factNvv.feemdo));

      console.log(`Found ${results.length} pending NVV records for ${options.salesperson} (searched by name or code)`);

      return results.map(row => ({
        id: row.id || '',
        NUDO: row.NUDO || '',
        TIDO: row.TIDO || '',
        FEEMDO: row.FEEMDO?.toString() || '',
        ENDO: row.ENDO || '',
        NOKOEN: row.NOKOEN || '',
        NOKOPR: row.NOKOPR || '',
        KOPRCT: row.KOPRCT || '',
        CAPREX2: Number(row.CAPREX2) || 0,
        CAPRCO2: Number(row.CAPRCO2) || 0,
        PPPRNE: Number(row.PPPRNE) || 0,
        cantidadPendiente: Number(row.CAPRCO2) - Number(row.CAPREX2) || 0,
        totalPendiente: Number(row.monto) || 0
      }));
    } catch (error) {
      console.error('Error getting NVV by salesperson:', error);
      return [];
    }
  }

  async getAllNvvGroupedBySalespeople(options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<Array<{
    salespersonCode: string;
    salespersonName: string;
    totalAmount: number;
    totalUnits: number;
    totalOrders: number;
    records: Array<{
      id: string;
      NUDO: string;
      TIDO: string;
      FEEMDO: string;
      ENDO: string;
      NOKOEN: string;
      NOKOPR: string;
      KOPRCT: string;
      CAPREX2: number;
      CAPRCO2: number;
      PPPRNE: number;
      cantidadPendiente: number;
      totalPendiente: number;
    }>;
  }>> {
    try {
      // Build conditions - always filter for pending NVV only
      const conditions = [sql`(eslido IS NULL OR eslido = '')`];

      // Add date filters if provided
      if (options?.startDate && options.startDate instanceof Date && !isNaN(options.startDate.getTime())) {
        conditions.push(sql`feemdo >= ${options.startDate.toISOString().split('T')[0]}`);
      }
      if (options?.endDate && options.endDate instanceof Date && !isNaN(options.endDate.getTime())) {
        conditions.push(sql`feemdo <= ${options.endDate.toISOString().split('T')[0]}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
      
      // Query from nvv.fact_nvv (ETL data)
      const queryResults = await db.execute(sql`
        SELECT 
          id,
          nudo as "NUDO",
          tido as "TIDO",
          feemdo as "FEEMDO",
          endo as "ENDO",
          nokoen as "NOKOEN",
          nokopr as "NOKOPR",
          koprct as "KOPRCT",
          kofulido as "KOFULIDO",
          nombre_vendedor,
          caprex2 as "CAPREX2",
          caprco2 as "CAPRCO2",
          ppprne as "PPPRNE",
          monto as total_pendiente
        FROM nvv.fact_nvv
        ${whereClause}
        ORDER BY feemdo DESC
      `);
      
      const results = queryResults.rows as any[];

      // Get salesperson names from SQL Server TABFU table with caching
      const kofulidoToNameMap = await this.getVendorNamesMap();

      // Group by salesperson (KOFULIDO)
      const groupedBySalesperson = new Map<string, {
        salespersonCode: string;
        salespersonName: string;
        totalAmount: number;
        totalUnits: number;
        totalOrders: number;
        records: Array<any>;
      }>();

      results.forEach(row => {
        const kofulido = row.KOFULIDO?.trim().toUpperCase() || 'SIN_VENDEDOR';
        const mappedName = kofulidoToNameMap.get(kofulido);
        const salespersonName = mappedName || row.KOFULIDO?.trim() || 'Sin vendedor';
        
        // Log unmapped codes for debugging
        if (!mappedName && kofulido !== 'SIN_VENDEDOR') {
          console.log(`[NVV MAPPING] No name found for code: "${kofulido}"`);
        }

        if (!groupedBySalesperson.has(kofulido)) {
          groupedBySalesperson.set(kofulido, {
            salespersonCode: kofulido,
            salespersonName,
            totalAmount: 0,
            totalUnits: 0,
            totalOrders: 0,
            records: []
          });
        }

        const group = groupedBySalesperson.get(kofulido)!;
        group.totalAmount += Number(row.total_pendiente) || 0;
        // Calculate units from (CAPRCO2 - CAPREX2) * PPPRNE
        const unitsCalc = ((Number(row.CAPRCO2) || 0) - (Number(row.CAPREX2) || 0)) * (Number(row.PPPRNE) || 1);
        group.totalUnits += unitsCalc;
        group.totalOrders += 1;
        group.records.push({
          id: row.id,
          NUDO: row.NUDO || '',
          TIDO: row.TIDO || '',
          FEEMDO: row.FEEMDO?.toString() || '',
          ENDO: row.ENDO || '',
          NOKOEN: row.NOKOEN || '',
          NOKOPR: row.NOKOPR || '',
          KOPRCT: row.KOPRCT || '',
          CAPREX2: Number(row.CAPREX2) || 0,
          CAPRCO2: Number(row.CAPRCO2) || 0,
          PPPRNE: Number(row.PPPRNE) || 0,
          cantidadPendiente: unitsCalc,
          totalPendiente: Number(row.total_pendiente) || 0
        });
      });

      // Convert to array and sort by total amount descending
      return Array.from(groupedBySalesperson.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);
    } catch (error) {
      console.error('Error getting all NVV grouped by salespeople:', error);
      return [];
    }
  }

  async getSalespersonNvv(salespersonName: string, options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    salespersonCode: string;
    salespersonName: string;
    totalAmount: number;
    totalUnits: number;
    totalOrders: number;
    records: Array<{
      id: string;
      NUDO: string;
      TIDO: string;
      FEEMDO: string;
      ENDO: string;
      NOKOEN: string;
      NOKOPR: string;
      KOPRCT: string;
      CAPREX2: number;
      CAPRCO2: number;
      PPPRNE: number;
      cantidadPendiente: number;
      totalPendiente: number;
    }>;
  } | null> {
    try {
      // Build conditions - always filter for pending NVV only
      const conditions = [sql`(eslido IS NULL OR eslido = '')`];
      
      // Search by salesperson name OR code (nombre_vendedor or kofulido in fact_nvv)
      const searchTerm = salespersonName.toUpperCase().trim();
      conditions.push(sql`(
        UPPER(TRIM(nombre_vendedor)) = ${searchTerm}
        OR UPPER(TRIM(kofulido)) = ${searchTerm}
      )`);

      // Add date filters if provided
      if (options?.startDate && options.startDate instanceof Date && !isNaN(options.startDate.getTime())) {
        conditions.push(sql`feemdo >= ${options.startDate.toISOString().split('T')[0]}`);
      }
      if (options?.endDate && options.endDate instanceof Date && !isNaN(options.endDate.getTime())) {
        conditions.push(sql`feemdo <= ${options.endDate.toISOString().split('T')[0]}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
      
      // Query from nvv.fact_nvv (ETL data)
      const queryResults = await db.execute(sql`
        SELECT 
          id,
          nudo as "NUDO",
          tido as "TIDO",
          feemdo as "FEEMDO",
          endo as "ENDO",
          nokoen as "NOKOEN",
          nokopr as "NOKOPR",
          koprct as "KOPRCT",
          kofulido as "KOFULIDO",
          nombre_vendedor,
          caprex2 as "CAPREX2",
          caprco2 as "CAPRCO2",
          ppprne as "PPPRNE",
          monto as total_pendiente
        FROM nvv.fact_nvv
        ${whereClause}
        ORDER BY feemdo DESC
      `);
      
      const results = queryResults.rows as any[];

      if (results.length === 0) {
        console.log(`[NVV SALESPERSON] No pending NVV found for: "${salespersonName}"`);
        return null;
      }

      // Get salesperson code from first result
      const salespersonCode = results[0]?.KOFULIDO || '';

      // Aggregate totals
      let totalAmount = 0;
      let totalUnits = 0;

      const records = results.map(row => {
        const pendiente = Number(row.total_pendiente) || 0;
        const unitsCalc = ((Number(row.CAPRCO2) || 0) - (Number(row.CAPREX2) || 0)) * (Number(row.PPPRNE) || 1);
        
        totalAmount += pendiente;
        totalUnits += unitsCalc;

        return {
          id: row.id || '',
          NUDO: row.NUDO || '',
          TIDO: row.TIDO || '',
          FEEMDO: row.FEEMDO?.toString() || '',
          ENDO: row.ENDO || '',
          NOKOEN: row.NOKOEN || '',
          NOKOPR: row.NOKOPR || '',
          KOPRCT: row.KOPRCT || '',
          CAPREX2: Number(row.CAPREX2) || 0,
          CAPRCO2: Number(row.CAPRCO2) || 0,
          PPPRNE: Number(row.PPPRNE) || 0,
          cantidadPendiente: unitsCalc,
          totalPendiente: pendiente
        };
      });

      console.log(`[NVV SALESPERSON] Found ${results.length} NVV for: "${salespersonName}"`);

      return {
        salespersonCode,
        salespersonName,
        totalAmount,
        totalUnits,
        totalOrders: results.length,
        records
      };
    } catch (error) {
      console.error('Error getting salesperson NVV:', error);
      return null;
    }
  }

  async getTotalPendingNVV(): Promise<number> {
    try {
      // Query from nvv.fact_nvv (ETL data) - only pending lines
      const result = await db.execute(sql`
        SELECT COALESCE(SUM(monto), 0) as total
        FROM nvv.fact_nvv
        WHERE eslido IS NULL OR eslido = ''
      `);

      return Number(result.rows[0]?.total || 0);
    } catch (error) {
      console.error('Error getting total pending NVV:', error);
      return 0;
    }
  }

  async getNvvBySegment(options: {
    segment: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Array<{
    id: string;
    NUDO: string;
    TIDO: string;
    FEEMDO: string;
    ENDO: string;
    NOKOEN: string;
    NOKOPR: string;
    KOPRCT: string;
    CAPREX2: number;
    CAPRCO2: number;
    PPPRNE: number;
    cantidadPendiente: number;
    totalPendiente: number;
  }>> {
    try {
      // Build conditions - always filter for pending NVV only
      const conditions = [sql`(eslido IS NULL OR eslido = '')`];
      
      // Filter by segment name (nombre_segmento_cliente in fact_nvv)
      conditions.push(sql`nombre_segmento_cliente = ${options.segment}`);

      // Add date filters if provided
      if (options.startDate && options.startDate instanceof Date && !isNaN(options.startDate.getTime())) {
        conditions.push(sql`feemdo >= ${options.startDate.toISOString().split('T')[0]}`);
      }
      if (options.endDate && options.endDate instanceof Date && !isNaN(options.endDate.getTime())) {
        conditions.push(sql`feemdo <= ${options.endDate.toISOString().split('T')[0]}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      // Query from nvv.fact_nvv (ETL data)
      const queryResults = await db.execute(sql`
        SELECT 
          id,
          nudo as "NUDO",
          tido as "TIDO",
          feemdo as "FEEMDO",
          endo as "ENDO",
          nokoen as "NOKOEN",
          nokopr as "NOKOPR",
          koprct as "KOPRCT",
          caprex2 as "CAPREX2",
          caprco2 as "CAPRCO2",
          ppprne as "PPPRNE",
          monto as total_pendiente
        FROM nvv.fact_nvv
        ${whereClause}
        ORDER BY feemdo DESC
      `);

      const results = queryResults.rows as any[];
      console.log(`Found ${results.length} NVV records for segment ${options.segment}`);

      return results.map(row => {
        const unitsCalc = ((Number(row.CAPRCO2) || 0) - (Number(row.CAPREX2) || 0)) * (Number(row.PPPRNE) || 1);
        return {
          id: row.id || '',
          NUDO: row.NUDO || '',
          TIDO: row.TIDO || '',
          FEEMDO: row.FEEMDO?.toString() || '',
          ENDO: row.ENDO || '',
          NOKOEN: row.NOKOEN || '',
          NOKOPR: row.NOKOPR || '',
          KOPRCT: row.KOPRCT || '',
          CAPREX2: Number(row.CAPREX2) || 0,
          CAPRCO2: Number(row.CAPRCO2) || 0,
          PPPRNE: Number(row.PPPRNE) || 0,
          cantidadPendiente: unitsCalc,
          totalPendiente: Number(row.total_pendiente) || 0
        };
      });
    } catch (error) {
      console.error('Error getting NVV by segment:', error);
      return [];
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
      // Query from nvv.fact_nvv (ETL data) - only pending lines
      const metricsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT kofulido) as total_salespeople,
          COUNT(DISTINCT nokoen) as total_companies,
          COALESCE(SUM(monto), 0) as total_pending_amount,
          COALESCE(AVG(monto), 0) as avg_order_value
        FROM nvv.fact_nvv
        WHERE eslido IS NULL OR eslido = ''
      `);

      const metrics = metricsResult.rows[0] as any;

      // Top salespeople by monto
      const topSalespeopleResult = await db.execute(sql`
        SELECT 
          COALESCE(nombre_vendedor, kofulido, 'Sin vendedor') as salesperson,
          SUM(monto) as total_amount,
          COUNT(*) as record_count
        FROM nvv.fact_nvv
        WHERE (eslido IS NULL OR eslido = '') AND kofulido IS NOT NULL
        GROUP BY nombre_vendedor, kofulido
        ORDER BY total_amount DESC
        LIMIT 10
      `);

      // Top companies by monto
      const topCompaniesResult = await db.execute(sql`
        SELECT 
          COALESCE(nokoen, 'Sin nombre') as company,
          SUM(monto) as total_amount,
          COUNT(*) as record_count
        FROM nvv.fact_nvv
        WHERE (eslido IS NULL OR eslido = '') AND nokoen IS NOT NULL
        GROUP BY nokoen
        ORDER BY total_amount DESC
        LIMIT 10
      `);

      return {
        totalRecords: Number(metrics?.total_records) || 0,
        totalSalespeople: Number(metrics?.total_salespeople) || 0,
        totalCompanies: Number(metrics?.total_companies) || 0,
        totalPendingAmount: Number(metrics?.total_pending_amount) || 0,
        averageOrderValue: Number(metrics?.avg_order_value) || 0,
        topSalespeople: (topSalespeopleResult.rows as any[]).map(row => ({
          salesperson: row.salesperson || 'Sin vendedor',
          totalAmount: Number(row.total_amount) || 0,
          recordCount: Number(row.record_count) || 0,
        })),
        topCompanies: (topCompaniesResult.rows as any[]).map(row => ({
          company: row.company || 'Sin nombre',
          totalAmount: Number(row.total_amount) || 0,
          recordCount: Number(row.record_count) || 0,
        })),
        statusBreakdown: [{ status: 'pending', count: Number(metrics?.total_records) || 0, amount: Number(metrics?.total_pending_amount) || 0 }],
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
            NULLIF(TRIM(${factVentas.zona}), ''),
            'Sin comuna'
          )`,
          totalSales: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
          transactionCount: sql<number>`COUNT(*)`,
        })
        .from(factVentas)
        .leftJoin(clients, eq(factVentas.nokoen, clients.nokoen))
        .groupBy(sql`COALESCE(
          NULLIF(TRIM(${clients.comuna}), ''), 
          NULLIF(TRIM(${factVentas.zona}), ''),
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
        case 'all':
          // Get all visitas from all time
          startDate = new Date(2020, 0, 1); // From 2020
          endDate = new Date(now.getFullYear() + 1, 11, 31); // Until end of next year
          break;
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
          startDate = new Date(2020, 0, 1); // Default to all time
          endDate = new Date(now.getFullYear() + 1, 11, 31);
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
        
        // Only count products that have valid porcentaje_avance for the average
        productos.forEach(p => {
          if (p.porcentajeAvance && p.porcentajeAvance.toString().trim() !== '') {
            const avance = parseFloat(p.porcentajeAvance.toString());
            if (!isNaN(avance) && avance > 0) {
              totalProgreso += avance;
              productosCount++;
            }
          }
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

  async getEstadisticasMensualesVisitas(): Promise<{
    visitasPorMes: Array<{ mes: string; completadas: number; pendientes: number; total: number }>;
    obrasActivas: number;
    totalTecnicos: number;
    productosEvaluadosTotal: number;
    reclamosResueltosUltimoMes: number;
    visitasUltimos30Dias: number;
  }> {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      
      // Get visitas from last 6 months
      const visitas = await db.select().from(visitasTecnicas)
        .where(
          sql`${visitasTecnicas.createdAt}::date >= ${sixMonthsAgo.toISOString().split('T')[0]}::date`
        );
      
      // Group by month
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const visitasPorMes: Array<{ mes: string; completadas: number; pendientes: number; total: number }> = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
        
        const monthVisitas = visitas.filter(v => {
          const visitaDate = new Date(v.createdAt!);
          return visitaDate.getFullYear() === monthDate.getFullYear() && 
                 visitaDate.getMonth() === monthDate.getMonth();
        });
        
        visitasPorMes.push({
          mes: monthLabel,
          completadas: monthVisitas.filter(v => v.estado === 'completada').length,
          pendientes: monthVisitas.filter(v => v.estado !== 'completada').length,
          total: monthVisitas.length
        });
      }
      
      // Count active obras (unique obras from visitas in last 3 months)
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const recentVisitas = visitas.filter(v => new Date(v.createdAt!) >= threeMonthsAgo);
      const uniqueObras = new Set(recentVisitas.map(v => v.nombreObra));
      const obrasActivas = uniqueObras.size;
      
      // Count active technicians
      const tecnicos = await db.selectDistinct({ tecnicoId: visitasTecnicas.tecnicoId })
        .from(visitasTecnicas)
        .where(sql`${visitasTecnicas.createdAt}::date >= ${threeMonthsAgo.toISOString().split('T')[0]}::date`);
      const totalTecnicos = tecnicos.length;
      
      // Count total products evaluated
      const visitaIds = visitas.map(v => v.id);
      let productosEvaluadosTotal = 0;
      if (visitaIds.length > 0) {
        const productos = await db.select().from(productosEvaluados)
          .where(inArray(productosEvaluados.visitaId, visitaIds));
        productosEvaluadosTotal = productos.length;
      }
      
      // Count resolved reclamos in last month
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const reclamosResueltos = await db.select().from(reclamos)
        .where(
          and(
            eq(reclamos.estado, 'resuelto'),
            sql`${reclamos.updatedAt}::date >= ${oneMonthAgo.toISOString().split('T')[0]}::date`
          )
        );
      const reclamosResueltosUltimoMes = reclamosResueltos.length;
      
      // Count visitas in last 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const visitasUltimos30Dias = visitas.filter(v => new Date(v.createdAt!) >= thirtyDaysAgo).length;
      
      return {
        visitasPorMes,
        obrasActivas,
        totalTecnicos,
        productosEvaluadosTotal,
        reclamosResueltosUltimoMes,
        visitasUltimos30Dias
      };
    } catch (error) {
      console.error('Error getting monthly visitas statistics:', error);
      return {
        visitasPorMes: [],
        obrasActivas: 0,
        totalTecnicos: 0,
        productosEvaluadosTotal: 0,
        reclamosResueltosUltimoMes: 0,
        visitasUltimos30Dias: 0
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
          clienteRut: clients.koen,
          clienteNombre: clients.nokoen,
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
      const formattedResults = results.map(r => {
        // Combinar RUT y nombre del cliente
        let clienteDisplay = 'Sin cliente';
        if (r.clienteRut && r.clienteNombre) {
          clienteDisplay = `${r.clienteRut} - ${r.clienteNombre}`;
        } else if (r.clienteNombre) {
          clienteDisplay = r.clienteNombre;
        } else if (r.clienteRut) {
          clienteDisplay = r.clienteRut;
        }
        
        return {
          id: r.id,
          nombreObra: r.nombreObra,
          fechaVisita: r.createdAt,
          tecnico: (r.tecnicoFirstName && r.tecnicoLastName) 
            ? `${r.tecnicoFirstName} ${r.tecnicoLastName}` 
            : r.tecnicoFirstName || r.tecnicoLastName || 'Sin asignar',
          cliente: clienteDisplay,
          estado: r.estado,
          productosEvaluados: productosCountMap[r.id] || 0,
          reclamosTotal: reclamosCountMap[r.id] || 0
        };
      });
      
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

      // Get client name if clienteId exists
      let clienteNombre = visita.clienteManual || '';
      if (visita.clienteId) {
        const [cliente] = await db
          .select({ nokoen: clients.nokoen })
          .from(clients)
          .where(eq(clients.id, visita.clienteId));
        if (cliente) {
          clienteNombre = cliente.nokoen || '';
        }
      }

      // Get productos evaluados for this visit
      const productosEval = await db
        .select()
        .from(productosEvaluados)
        .where(eq(productosEvaluados.visitaId, id));

      // For each producto, get its evaluacion tecnica and product info from catalog
      const productosConEvaluacion = await Promise.all(
        productosEval.map(async (prod) => {
          const [evaluacion] = await db
            .select()
            .from(evaluacionesTecnicas)
            .where(eq(evaluacionesTecnicas.productoEvaluadoId, prod.id));

          // Si no tiene productoId (es personalizado), generar un ID custom
          const isCustom = !prod.productoId;
          const productIdForFrontend = isCustom 
            ? `custom-${prod.id}` 
            : prod.productoId;

          // Get SKU and name from products table if it's a catalog product
          let sku = '';
          let name = prod.productoManual || '';
          
          if (prod.productoId) {
            const [catalogProduct] = await db
              .select({ kopr: products.kopr, name: products.name })
              .from(products)
              .where(eq(products.id, prod.productoId));
            if (catalogProduct) {
              sku = catalogProduct.kopr || '';
              name = catalogProduct.name || '';
            }
          }

          return {
            id: prod.id,
            productId: productIdForFrontend,
            sku,
            name,
            formato: prod.formato,
            isCustomProduct: isCustom,
            evaluacion: evaluacion || {}
          };
        })
      );

      return {
        ...visita,
        cliente: clienteNombre,
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

  // Public Catalog Operations
  async getPublicSalespersonBySlug(slug: string) {
    const { salespeopleUsers } = await import('@shared/schema');
    
    const [salesperson] = await db
      .select({
        id: salespeopleUsers.id,
        salespersonName: salespeopleUsers.salespersonName,
        publicSlug: salespeopleUsers.publicSlug,
        profileImageUrl: salespeopleUsers.profileImageUrl,
        publicPhone: salespeopleUsers.publicPhone,
        publicEmail: salespeopleUsers.publicEmail,
        bio: salespeopleUsers.bio,
        catalogEnabled: salespeopleUsers.catalogEnabled,
      })
      .from(salespeopleUsers)
      .where(and(
        eq(salespeopleUsers.publicSlug, slug),
        eq(salespeopleUsers.catalogEnabled, true),
        eq(salespeopleUsers.isActive, true)
      ))
      .limit(1);
    
    if (!salesperson) return null;
    
    return {
      id: salesperson.id,
      salespersonName: salesperson.salespersonName,
      publicSlug: salesperson.publicSlug || '',
      profileImageUrl: salesperson.profileImageUrl,
      publicPhone: salesperson.publicPhone,
      publicEmail: salesperson.publicEmail,
      bio: salesperson.bio,
      catalogEnabled: salesperson.catalogEnabled ?? false,
    };
  }

  async getPublicCatalogProducts() {
    const { priceList, ecommerceProducts } = await import('@shared/schema');
    
    // Get products that are active in ecommerce
    const productsData = await db
      .select({
        id: priceList.id,
        codigo: priceList.codigo,
        producto: priceList.producto,
        unidad: priceList.unidad,
        precio: priceList.canalDigital,
        categoria: ecommerceProducts.categoria,
        descripcion: ecommerceProducts.descripcion,
        imagenUrl: ecommerceProducts.imagenUrl,
        precioEcommerce: ecommerceProducts.precioEcommerce,
        activo: ecommerceProducts.activo,
        productFamily: ecommerceProducts.productFamily,
        color: ecommerceProducts.color,
        minUnit: ecommerceProducts.minUnit,
        stepSize: ecommerceProducts.stepSize,
        formatUnit: ecommerceProducts.formatUnit,
      })
      .from(priceList)
      .innerJoin(ecommerceProducts, eq(priceList.id, ecommerceProducts.priceListId))
      .where(eq(ecommerceProducts.activo, true))
      .orderBy(priceList.producto);
    
    return productsData.map(p => ({
      id: p.id,
      codigo: p.codigo,
      producto: p.producto,
      unidad: p.unidad,
      precio: Number(p.precioEcommerce) || Number(p.precio) || 0,
      categoria: p.categoria,
      descripcion: p.descripcion,
      imagenUrl: p.imagenUrl,
      productFamily: p.productFamily,
      color: p.color,
      minUnit: p.minUnit ?? 1,
      stepSize: p.stepSize ?? 1,
      formatUnit: p.formatUnit,
    }));
  }

  async getGroupedCatalogProducts() {
    const products = await this.getPublicCatalogProducts();
    
    // Group products by family
    const familyMap = new Map<string, {
      family: string;
      colors: Map<string, {
        color: string;
        formats: Array<{
          id: string;
          codigo: string;
          unidad: string;
          precio: number;
          imagenUrl: string | null;
          minUnit: number;
          stepSize: number;
          formatUnit: string | null;
        }>;
      }>;
      imagenUrl: string | null;
      categoria: string | null;
      descripcion: string | null;
    }>();
    
    for (const product of products) {
      const family = product.productFamily || product.producto;
      const color = product.color || 'SIN COLOR';
      
      if (!familyMap.has(family)) {
        familyMap.set(family, {
          family,
          colors: new Map(),
          imagenUrl: product.imagenUrl,
          categoria: product.categoria,
          descripcion: product.descripcion,
        });
      }
      
      const familyData = familyMap.get(family)!;
      
      if (!familyData.colors.has(color)) {
        familyData.colors.set(color, {
          color,
          formats: [],
        });
      }
      
      familyData.colors.get(color)!.formats.push({
        id: product.id,
        codigo: product.codigo,
        unidad: product.unidad,
        precio: product.precio,
        imagenUrl: product.imagenUrl,
        minUnit: product.minUnit,
        stepSize: product.stepSize,
        formatUnit: product.formatUnit,
      });
      
      // Update family image if current product has one
      if (product.imagenUrl && !familyData.imagenUrl) {
        familyData.imagenUrl = product.imagenUrl;
      }
    }
    
    // Convert to array format
    return Array.from(familyMap.values()).map(f => ({
      family: f.family,
      imagenUrl: f.imagenUrl,
      categoria: f.categoria,
      descripcion: f.descripcion,
      colors: Array.from(f.colors.values()).map(c => ({
        color: c.color,
        formats: c.formats.sort((a, b) => a.precio - b.precio), // Sort by price
      })),
    })).sort((a, b) => a.family.localeCompare(b.family));
  }

  async createPublicQuoteRequest(salespersonId: string, quoteData: any) {
    const { ecommerceOrders, salespeopleUsers } = await import('@shared/schema');
    
    // Get salesperson info
    const [salesperson] = await db
      .select({
        id: salespeopleUsers.id,
        salespersonName: salespeopleUsers.salespersonName,
      })
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.id, salespersonId))
      .limit(1);
    
    if (!salesperson) {
      throw new Error('Vendedor no encontrado');
    }
    
    // Calculate totals
    const subtotal = quoteData.items.reduce((sum: number, item: any) => 
      sum + (item.quantity * item.unitPrice), 0
    );
    
    // Create the order with "pendiente" status
    const [newOrder] = await db
      .insert(ecommerceOrders)
      .values({
        clientId: 'VISITANTE_PUBLICO', // Placeholder for public visitors
        clientName: quoteData.visitorName,
        clientEmail: quoteData.visitorEmail,
        clientPhone: quoteData.visitorPhone,
        assignedSalespersonId: salesperson.id,
        assignedSalespersonName: salesperson.salespersonName,
        status: 'pendiente',
        items: quoteData.items,
        subtotal: subtotal.toString(),
        tax: '0', // Sin impuesto para cotizaciones públicas
        total: subtotal.toString(),
        notes: quoteData.message 
          ? `[CATÁLOGO PÚBLICO]\nEmpresa: ${quoteData.visitorCompany || 'N/A'}\nMensaje: ${quoteData.message}` 
          : `[CATÁLOGO PÚBLICO]\nEmpresa: ${quoteData.visitorCompany || 'N/A'}`,
      })
      .returning();
    
    return newOrder;
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
    
    // Crear notificación para admins y supervisors
    const adminsAndSupervisors = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'supervisor')));
    
    const notificationPromises = adminsAndSupervisors.map(user =>
      this.createNotification({
        userId: user.id,
        type: 'reclamo_nuevo',
        title: 'Nuevo Reclamo Registrado',
        message: `Nuevo reclamo #${newReclamo.numeroReclamo} del cliente "${newReclamo.clientName}" (${newReclamo.gravedad})`,
        relatedReclamoId: newReclamo.id,
        read: false,
      })
    );
    
    await Promise.all(notificationPromises);
    
    return newReclamo;
  }

  async getReclamosGenerales(filters?: {
    vendedorId?: string;
    tecnicoId?: string;
    responsableAreaId?: string;
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
    
    if (filters?.responsableAreaId) {
      conditions.push(eq(reclamosGenerales.responsableAreaId, filters.responsableAreaId));
    }
    
    if (filters?.estado) {
      conditions.push(eq(reclamosGenerales.estado, filters.estado));
    }
    
    if (filters?.gravedad) {
      conditions.push(eq(reclamosGenerales.gravedad, filters.gravedad));
    }
    
    if (filters?.areaResponsable) {
      // Apply area mapping: if filtering by operative area, include specific areas that map to it
      // Example: filtering by 'produccion' should include 'produccion', 'etiqueta', 'colores'
      const areasToInclude = [filters.areaResponsable];
      
      // Find all specific areas that map to this operative area
      for (const [specificArea, operativeArea] of Object.entries(AREA_ESPECIFICA_TO_OPERATIVA)) {
        if (operativeArea === filters.areaResponsable) {
          areasToInclude.push(specificArea);
        }
      }
      
      // Use IN clause if multiple areas, otherwise use eq
      if (areasToInclude.length > 1) {
        conditions.push(inArray(reclamosGenerales.areaResponsableActual, areasToInclude));
      } else {
        conditions.push(eq(reclamosGenerales.areaResponsableActual, filters.areaResponsable));
      }
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

  async getReclamosNotificaciones(): Promise<{
    nuevosReclamos: number;
    nuevasResoluciones: number;
    reclamosMasRecientes: { id: string; numeroReclamo: string; clientName: string; createdAt: Date }[];
    resolucionesMasRecientes: { id: string; numeroReclamo: string; clientName: string; resolvedAt: Date }[];
  }> {
    const hace24Horas = new Date();
    hace24Horas.setHours(hace24Horas.getHours() - 24);

    const nuevosReclamos = await db
      .select({ count: sql<number>`count(*)` })
      .from(reclamosGenerales)
      .where(sql`${reclamosGenerales.createdAt} >= ${hace24Horas}`);

    const nuevasResoluciones = await db
      .select({ count: sql<number>`count(*)` })
      .from(reclamosGenerales)
      .where(
        and(
          eq(reclamosGenerales.estado, 'resuelto'),
          sql`${reclamosGenerales.updatedAt} >= ${hace24Horas}`
        )
      );

    const reclamosMasRecientes = await db
      .select({
        id: reclamosGenerales.id,
        numeroReclamo: reclamosGenerales.numeroReclamo,
        clientName: reclamosGenerales.clientName,
        createdAt: reclamosGenerales.createdAt,
      })
      .from(reclamosGenerales)
      .where(sql`${reclamosGenerales.createdAt} >= ${hace24Horas}`)
      .orderBy(desc(reclamosGenerales.createdAt))
      .limit(5);

    const resolucionesMasRecientes = await db
      .select({
        id: reclamosGenerales.id,
        numeroReclamo: reclamosGenerales.numeroReclamo,
        clientName: reclamosGenerales.clientName,
        resolvedAt: reclamosGenerales.updatedAt,
      })
      .from(reclamosGenerales)
      .where(
        and(
          eq(reclamosGenerales.estado, 'resuelto'),
          sql`${reclamosGenerales.updatedAt} >= ${hace24Horas}`
        )
      )
      .orderBy(desc(reclamosGenerales.updatedAt))
      .limit(5);

    return {
      nuevosReclamos: Number(nuevosReclamos[0]?.count) || 0,
      nuevasResoluciones: Number(nuevasResoluciones[0]?.count) || 0,
      reclamosMasRecientes,
      resolucionesMasRecientes,
    };
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
    
    // Notificar cambio de estado al vendedor y técnico
    const notificationPromises = [];
    
    if (updated.vendedorId && updated.vendedorId !== userId) {
      notificationPromises.push(
        this.createNotification({
          userId: updated.vendedorId,
          type: 'reclamo_estado_cambiado',
          title: 'Cambio de Estado en Reclamo',
          message: `El reclamo #${updated.numeroReclamo} cambió de "${reclamo.estado}" a "${nuevoEstado}"`,
          relatedReclamoId: updated.id,
          read: false,
        })
      );
    }
    
    if (updated.tecnicoId && updated.tecnicoId !== userId) {
      notificationPromises.push(
        this.createNotification({
          userId: updated.tecnicoId,
          type: 'reclamo_estado_cambiado',
          title: 'Cambio de Estado en Reclamo',
          message: `El reclamo #${updated.numeroReclamo} cambió de "${reclamo.estado}" a "${nuevoEstado}"`,
          relatedReclamoId: updated.id,
          read: false,
        })
      );
    }
    
    await Promise.all(notificationPromises);
    
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
    
    // Determinar nuevo estado según si procede o no y el área responsable
    // Si procede y es laboratorio: pasa a en_laboratorio
    // Si procede y es otra área: pasa a en_area_responsable
    // Si no procede: se mantiene en en_revision_tecnica para revisión posterior
    let nuevoEstado: string;
    if (procede) {
      nuevoEstado = areaResponsable === 'laboratorio' ? 'en_laboratorio' : 'en_area_responsable';
    } else {
      nuevoEstado = 'en_revision_tecnica';
    }
    
    // Si procede, buscar un usuario activo del área responsable para asignación automática
    let responsableArea = null;
    if (procede && areaResponsable) {
      // Buscar usuarios con rol que coincida con el área (ej: "laboratorio", "area_laboratorio", "produccion", etc.)
      const usuariosArea = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.role, areaResponsable),
            eq(users.role, `area_${areaResponsable}`)
          )
        )
        .limit(1);
      
      if (usuariosArea.length > 0) {
        responsableArea = usuariosArea[0];
      }
    }
    
    const [updated] = await db
      .update(reclamosGenerales)
      .set({
        procede,
        areaResponsableActual: procede ? areaResponsable : reclamo.areaResponsableActual,
        estado: nuevoEstado,
        updatedAt: new Date(),
        informeTecnico: notas || null,
        responsableAreaId: responsableArea ? responsableArea.id : null,
        responsableAreaName: responsableArea ? responsableArea.fullName : null,
      })
      .where(eq(reclamosGenerales.id, id))
      .returning();
    
    // Create historial entry
    const notasHistorial = notas || (procede 
      ? `Reclamo validado y derivado a ${areaResponsable}${responsableArea ? ` - Asignado a ${responsableArea.fullName}` : ''}` 
      : 'Reclamo marcado como no procedente - pendiente revisión');
    
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: nuevoEstado,
      userId,
      userName,
      notas: notasHistorial,
    });
    
    // Crear notificación para el responsable del área si fue asignado
    if (procede && responsableArea) {
      await this.createNotification({
        userId: responsableArea.id,
        type: 'reclamo_asignado',
        title: 'Reclamo Asignado',
        message: `Se te asignó el reclamo del cliente "${updated.clientName}" del área ${areaResponsable}`,
        relatedReclamoId: updated.id,
        read: false,
      });
    }
    
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
    userName: string,
    documents?: Array<{ fileName: string; fileData: string; mimeType: string }>
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
    
    // Crear los documentos de evidencia
    const documentCount = documents?.length || 0;
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        await db.insert(reclamosGeneralesResolucionPhotos).values({
          reclamoId: id,
          photoUrl: doc.fileData,
          description: `Documento: ${doc.fileName}`,
        });
      }
    }
    
    // Create historial entry
    const evidenceNotes = [];
    if (photos.length > 0) evidenceNotes.push(`${photos.length} foto(s)`);
    if (documentCount > 0) evidenceNotes.push(`${documentCount} documento(s)`);
    const evidenceText = evidenceNotes.length > 0 ? ` con ${evidenceNotes.join(' y ')} de evidencia` : '';
    
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamoAnterior.estado,
      estadoNuevo: 'resuelto',
      userId,
      userName,
      notas: `Resolución de laboratorio agregada${evidenceText}. Reclamo finalizado.`,
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
    userRole: string,
    documents?: Array<{ fileName: string; fileData: string; mimeType: string }>
  ): Promise<ReclamoGeneral | null> {
    const reclamo = await this.getReclamoGeneralById(id);
    
    if (!reclamo) {
      throw new Error('Reclamo not found');
    }
    
    // Verificar que el reclamo está en estado "en_area_responsable"
    if (reclamo.estado !== 'en_area_responsable') {
      throw new Error('El reclamo no está en estado "En Área Responsable"');
    }
    
    // Use centralized area mapping from shared/reclamosAreas
    // Get the operative area for the user's role
    const areaUsuarioOperativa = mapToOperativeArea(
      userRole.startsWith('area_') ? userRole.replace('area_', '') : userRole
    );
    
    // Map the complaint's assigned area to its operative area
    // Example: 'envase' → 'logistica', 'etiqueta' → 'produccion'
    const areaReclamoOperativa = mapToOperativeArea(reclamo.areaResponsableActual || '');
    
    if (!areaUsuarioOperativa || !areaReclamoOperativa) {
      throw new Error('No se pudo determinar el área responsable');
    }
    
    // Verify that the user's operative area matches the complaint's operative area
    // This allows logistica users to resolve 'envase' complaints, produccion users to resolve 'etiqueta'/'colores'
    if (areaReclamoOperativa !== areaUsuarioOperativa) {
      throw new Error('No tiene permisos para resolver este reclamo');
    }
    
    // Use the original area for display purposes
    const areaUsuario = userRole.startsWith('area_') ? userRole.replace('area_', '') : userRole;
    
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
    
    // Crear los documentos de evidencia
    const documentCount = documents?.length || 0;
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        await db.insert(reclamosGeneralesResolucionPhotos).values({
          reclamoId: id,
          photoUrl: doc.fileData,
          description: `Documento: ${doc.fileName}`,
        });
      }
    }
    
    // Create historial entry
    const evidenceNotes = [];
    if (photos.length > 0) evidenceNotes.push(`${photos.length} foto(s)`);
    if (documentCount > 0) evidenceNotes.push(`${documentCount} documento(s)`);
    const evidenceText = evidenceNotes.length > 0 ? ` con ${evidenceNotes.join(' y ')} de evidencia` : '';
    
    await this.createReclamoGeneralHistorial({
      reclamoId: id,
      estadoAnterior: reclamo.estado,
      estadoNuevo: 'resuelto',
      userId,
      userName,
      notas: `Resolución agregada por ${areaUsuario}${evidenceText}. Reclamo finalizado.`,
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
  // MANTENCIÓN OPERATIONS
  // ==================================================================================

  async createSolicitudMantencion(solicitud: InsertSolicitudMantencion): Promise<SolicitudMantencion> {
    const [newSolicitud] = await db
      .insert(solicitudesMantencion)
      .values(solicitud)
      .returning();
    
    // Create initial historial entry
    await this.createMantencionHistorial({
      mantencionId: newSolicitud.id,
      estadoAnterior: null,
      estadoNuevo: 'pendiente',
      userId: newSolicitud.solicitanteId,
      userName: newSolicitud.solicitanteName || 'Usuario',
      notas: 'Solicitud de mantención creada',
    });

    return newSolicitud;
  }

  async getSolicitudesMantencion(filters?: {
    solicitanteId?: string;
    tecnicoAsignadoId?: string;
    estado?: string;
    gravedad?: string;
    area?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const conditions = [];
    
    if (filters?.solicitanteId) {
      conditions.push(eq(solicitudesMantencion.solicitanteId, filters.solicitanteId));
    }
    if (filters?.tecnicoAsignadoId) {
      conditions.push(eq(solicitudesMantencion.tecnicoAsignadoId, filters.tecnicoAsignadoId));
    }
    if (filters?.estado) {
      conditions.push(eq(solicitudesMantencion.estado, filters.estado));
    }
    if (filters?.gravedad) {
      conditions.push(eq(solicitudesMantencion.gravedad, filters.gravedad));
    }
    if (filters?.area) {
      conditions.push(eq(solicitudesMantencion.area, filters.area));
    }

    let query = db
      .select()
      .from(solicitudesMantencion)
      .orderBy(desc(solicitudesMantencion.fechaSolicitud));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const solicitudes = await query;
    
    // Add photos, historial, and resolucion photos to each solicitud
    const solicitudesWithDetails = await Promise.all(
      solicitudes.map(async (solicitud) => {
        const [photos, historial, resolucionPhotos] = await Promise.all([
          this.getMantencionPhotos(solicitud.id),
          this.getMantencionHistorial(solicitud.id),
          this.getMantencionResolucionPhotos(solicitud.id),
        ]);
        
        return {
          ...solicitud,
          photos,
          historial,
          resolucionPhotos,
        };
      })
    );
    
    return solicitudesWithDetails;
  }

  async getSolicitudMantencionById(id: string): Promise<SolicitudMantencion | undefined> {
    const [solicitud] = await db
      .select()
      .from(solicitudesMantencion)
      .where(eq(solicitudesMantencion.id, id));
    return solicitud;
  }

  async updateSolicitudMantencion(id: string, updates: Partial<InsertSolicitudMantencion>): Promise<SolicitudMantencion> {
    const [updated] = await db
      .update(solicitudesMantencion)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(solicitudesMantencion.id, id))
      .returning();
    return updated;
  }

  async deleteSolicitudMantencion(id: string): Promise<void> {
    // Delete all related records first
    await Promise.all([
      // Delete photos
      db.delete(mantencionPhotos).where(eq(mantencionPhotos.mantencionId, id)),
      // Delete resolution photos
      db.delete(mantencionResolucionPhotos).where(eq(mantencionResolucionPhotos.mantencionId, id)),
      // Delete historial
      db.delete(mantencionHistorial).where(eq(mantencionHistorial.mantencionId, id)),
      // Delete gastos de materiales asociados
      db.delete(gastosMaterialesMantencion).where(eq(gastosMaterialesMantencion.otId, id)),
    ]);
    
    // Finally delete the main record
    await db.delete(solicitudesMantencion).where(eq(solicitudesMantencion.id, id));
  }

  // Mantención Photos operations
  async createMantencionPhoto(photo: InsertMantencionPhoto): Promise<MantencionPhoto> {
    const [newPhoto] = await db
      .insert(mantencionPhotos)
      .values(photo)
      .returning();
    return newPhoto;
  }

  async getMantencionPhotos(mantencionId: string): Promise<MantencionPhoto[]> {
    return db
      .select()
      .from(mantencionPhotos)
      .where(eq(mantencionPhotos.mantencionId, mantencionId))
      .orderBy(desc(mantencionPhotos.uploadedAt));
  }

  async deleteMantencionPhoto(id: string): Promise<void> {
    await db.delete(mantencionPhotos).where(eq(mantencionPhotos.id, id));
  }

  // Mantención Resolución Photos operations
  async getMantencionResolucionPhotos(mantencionId: string): Promise<MantencionResolucionPhoto[]> {
    return db
      .select()
      .from(mantencionResolucionPhotos)
      .where(eq(mantencionResolucionPhotos.mantencionId, mantencionId))
      .orderBy(desc(mantencionResolucionPhotos.uploadedAt));
  }

  // Mantención Historial operations
  async createMantencionHistorial(historial: InsertMantencionHistorial): Promise<MantencionHistorial> {
    const [newHistorial] = await db
      .insert(mantencionHistorial)
      .values(historial)
      .returning();
    return newHistorial;
  }

  async getMantencionHistorial(mantencionId: string): Promise<MantencionHistorial[]> {
    return db
      .select()
      .from(mantencionHistorial)
      .where(eq(mantencionHistorial.mantencionId, mantencionId))
      .orderBy(desc(mantencionHistorial.createdAt));
  }

  // ===== FUNCIONES AVANZADAS DE ÓRDENES DE TRABAJO =====
  
  /**
   * Pausa una orden de trabajo activa
   * Registra el motivo de la pausa y crea entrada en el historial
   */
  async pausarMantencion(
    id: string, 
    motivo: string,
    fechaProgramada: string | null | undefined,
    userId: string, 
    userName: string
  ): Promise<SolicitudMantencion> {
    // Verificar que la OT existe y está en estado válido para pausar
    const mantencion = await this.getSolicitudMantencionById(id);
    if (!mantencion) {
      throw new Error('Orden de trabajo no encontrada');
    }
    
    if (mantencion.estado !== 'en_reparacion') {
      throw new Error('Solo se pueden pausar órdenes en reparación');
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado: 'pausada',
      motivoPausa: motivo,
      fechaPausa: new Date(),
      updatedAt: new Date(),
    };

    // Si se proporciona nueva fecha programada, actualizarla
    if (fechaProgramada) {
      updateData.fechaProgramada = new Date(fechaProgramada);
    }

    // Actualizar la OT a estado pausado
    const [updated] = await db
      .update(solicitudesMantencion)
      .set(updateData)
      .where(eq(solicitudesMantencion.id, id))
      .returning();

    // Preparar notas para el historial
    let notas = `OT pausada. Motivo: ${motivo}`;
    if (fechaProgramada) {
      const fechaFormateada = new Date(fechaProgramada).toLocaleString('es-CL');
      notas += `. Nueva fecha programada: ${fechaFormateada}`;
    }

    // Registrar en historial
    await this.createMantencionHistorial({
      mantencionId: id,
      estadoAnterior: 'en_reparacion',
      estadoNuevo: 'pausada',
      userId,
      userName,
      notas,
    });

    return updated;
  }

  /**
   * Reanuda una orden de trabajo pausada
   */
  async reanudarMantencion(
    id: string,
    notas: string | null,
    userId: string,
    userName: string
  ): Promise<SolicitudMantencion> {
    // Verificar que la OT existe y está pausada
    const mantencion = await this.getSolicitudMantencionById(id);
    if (!mantencion) {
      throw new Error('Orden de trabajo no encontrada');
    }
    
    if (mantencion.estado !== 'pausada') {
      throw new Error('Solo se pueden reanudar órdenes pausadas');
    }

    // Actualizar la OT a estado en reparacion
    const [updated] = await db
      .update(solicitudesMantencion)
      .set({
        estado: 'en_reparacion',
        updatedAt: new Date(),
      })
      .where(eq(solicitudesMantencion.id, id))
      .returning();

    // Registrar en historial
    await this.createMantencionHistorial({
      mantencionId: id,
      estadoAnterior: 'pausada',
      estadoNuevo: 'en_reparacion',
      userId,
      userName,
      notas: notas || 'OT reanudada',
    });

    return updated;
  }

  /**
   * Inicia el trabajo en una orden pendiente, programada o registrada
   */
  async iniciarTrabajoMantencion(
    id: string,
    userId: string,
    userName: string,
    userRole: string
  ): Promise<SolicitudMantencion> {
    // Verificar que la OT existe
    const mantencion = await this.getSolicitudMantencionById(id);
    if (!mantencion) {
      throw new Error('Orden de trabajo no encontrada');
    }
    
    // Validar que el estado actual permite iniciar trabajo
    const estadosValidos = ['pendiente', 'registrado', 'programada'];
    if (!estadosValidos.includes(mantencion.estado)) {
      throw new Error(`Solo se puede iniciar trabajo desde estado pendiente, registrado o programada. Estado actual: ${mantencion.estado}`);
    }

    // Validar permisos - incluir jefe_planta y mantencion que tienen acceso completo al módulo CMMS
    const rolesAutorizados = ['admin', 'supervisor', 'produccion', 'jefe_planta', 'mantencion'];
    const esTecnicoAsignado = mantencion.tecnicoAsignadoId === userId;
    
    if (!rolesAutorizados.includes(userRole) && !esTecnicoAsignado) {
      throw new Error('No autorizado para iniciar trabajo en esta orden');
    }

    // Actualizar la OT a estado en reparación
    const [updated] = await db
      .update(solicitudesMantencion)
      .set({
        estado: 'en_reparacion',
        fechaInicioTrabajo: new Date(),
        motivoPausa: null, // Limpiar motivo de pausa si existe
        fechaPausa: null,  // Limpiar fecha de pausa si existe
        updatedAt: new Date(),
      })
      .where(eq(solicitudesMantencion.id, id))
      .returning();

    // Registrar en historial
    await this.createMantencionHistorial({
      mantencionId: id,
      estadoAnterior: mantencion.estado,
      estadoNuevo: 'en_reparacion',
      userId,
      userName,
      notas: 'Trabajo iniciado',
    });

    return updated;
  }

  /**
   * Agrega un gasto de material vinculado a una OT
   */
  async agregarGastoAMantencion(
    mantencionId: string,
    gastoData: InsertGastoMaterialMantencion
  ): Promise<GastoMaterialMantencion> {
    // Verificar que la OT existe
    const mantencion = await this.getSolicitudMantencionById(mantencionId);
    if (!mantencion) {
      throw new Error('Orden de trabajo no encontrada');
    }

    // Crear el gasto
    const [gasto] = await db
      .insert(gastosMaterialesMantencion)
      .values({
        ...gastoData,
        otId: mantencionId,
      })
      .returning();

    // Actualizar el costo real de la OT sumando todos los gastos
    const todosLosGastos = await db
      .select()
      .from(gastosMaterialesMantencion)
      .where(eq(gastosMaterialesMantencion.otId, mantencionId));

    const costoTotal = todosLosGastos.reduce((sum, g) => {
      const total = typeof g.costoTotal === 'string' ? parseFloat(g.costoTotal) : Number(g.costoTotal);
      return sum + (isNaN(total) ? 0 : total);
    }, 0);

    await db
      .update(solicitudesMantencion)
      .set({
        costoReal: costoTotal.toString(),
        updatedAt: new Date(),
      })
      .where(eq(solicitudesMantencion.id, mantencionId));

    return gasto;
  }

  /**
   * Actualiza la asignación de técnico o proveedor de una OT
   */
  async actualizarAsignacionMantencion(
    id: string,
    asignacion: {
      tipoEjecucion?: 'inmediata' | 'programada' | null;
      fechaProgramada?: string | null;
      tipoAsignacion?: 'tecnico_interno' | 'proveedor_externo' | null;
      tecnicoAsignadoId?: string | null;
      tecnicoAsignadoName?: string | null;
      proveedorAsignadoId?: string | null;
      proveedorAsignadoName?: string | null;
    },
    userId: string,
    userName: string
  ): Promise<SolicitudMantencion> {
    // Verificar que la OT existe
    const mantencion = await this.getSolicitudMantencionById(id);
    if (!mantencion) {
      throw new Error('Orden de trabajo no encontrada');
    }

    // Preparar datos para actualizar
    const updateData: any = {};
    
    // Actualizar tipo de ejecución
    if (asignacion.tipoEjecucion !== undefined) {
      updateData.tipoEjecucion = asignacion.tipoEjecucion;
      
      // Si el tipo de ejecución es 'inmediata' y el estado es 'pendiente', cambiar a 'registrado'
      if (asignacion.tipoEjecucion === 'inmediata' && mantencion.estado === 'pendiente') {
        updateData.estado = 'registrado';
      }
    }
    
    // Actualizar fecha programada (CRÍTICO: siempre guardar si viene en el payload)
    if (asignacion.fechaProgramada !== undefined) {
      if (asignacion.fechaProgramada) {
        const fechaProg = new Date(asignacion.fechaProgramada);
        updateData.fechaProgramada = fechaProg;
        
        // Cambio automático de estado: cualquier fecha asignada → "programada"
        const estadosQuePuedenProgramarse = ['pendiente', 'registrado', 'pausada'];
        if (estadosQuePuedenProgramarse.includes(mantencion.estado)) {
          updateData.estado = 'programada';
        }
      } else {
        // Si se borra la fecha, volver a pendiente o registrado según el estado original
        updateData.fechaProgramada = null;
        if (mantencion.estado === 'programada') {
          updateData.estado = 'registrado';
        }
      }
    }

    // Actualizar asignación
    if (asignacion.tipoAsignacion !== undefined) {
      updateData.tipoAsignacion = asignacion.tipoAsignacion;
    }
    if (asignacion.tecnicoAsignadoId !== undefined) {
      updateData.tecnicoAsignadoId = asignacion.tecnicoAsignadoId;
    }
    if (asignacion.tecnicoAsignadoName !== undefined) {
      updateData.tecnicoAsignadoName = asignacion.tecnicoAsignadoName;
    }
    if (asignacion.proveedorAsignadoId !== undefined) {
      updateData.proveedorAsignadoId = asignacion.proveedorAsignadoId;
    }
    if (asignacion.proveedorAsignadoName !== undefined) {
      updateData.proveedorAsignadoName = asignacion.proveedorAsignadoName;
    }

    // Solo actualizar fechaAsignacion si se está asignando técnico o proveedor
    if (asignacion.tecnicoAsignadoId || asignacion.proveedorAsignadoId) {
      updateData.fechaAsignacion = new Date();
    }

    updateData.updatedAt = new Date();

    // Actualizar la asignación
    const [updated] = await db
      .update(solicitudesMantencion)
      .set(updateData)
      .where(eq(solicitudesMantencion.id, id))
      .returning();

    // Registrar en historial
    const notas: string[] = [];
    
    // Registrar tipo de ejecución si cambió
    if (asignacion.tipoEjecucion !== undefined) {
      if (asignacion.tipoEjecucion === 'inmediata') {
        notas.push('Tipo de ejecución: Inmediata');
      } else if (asignacion.tipoEjecucion === 'programada') {
        notas.push('Tipo de ejecución: Programada');
      }
    }
    
    // Registrar fecha programada si cambió
    if (asignacion.fechaProgramada !== undefined) {
      if (asignacion.fechaProgramada) {
        const fechaFormateada = new Date(asignacion.fechaProgramada).toLocaleString('es-CL');
        notas.push(`Fecha programada: ${fechaFormateada}`);
      } else {
        notas.push('Fecha programada removida');
      }
    }
    
    if (asignacion.tipoAsignacion === 'tecnico_interno') {
      notas.push(`Asignado a técnico: ${asignacion.tecnicoAsignadoName}`);
    } else if (asignacion.tipoAsignacion === 'proveedor_externo') {
      notas.push(`Asignado a proveedor: ${asignacion.proveedorAsignadoName}`);
    } else if (asignacion.tipoAsignacion === null) {
      notas.push('Asignación removida');
    }

    // Determinar el nuevo estado para el historial
    const nuevoEstado = updateData.estado || mantencion.estado;
    const cambioEstado = updateData.estado && updateData.estado !== mantencion.estado;

    if (notas.length > 0 || cambioEstado) {
      await this.createMantencionHistorial({
        mantencionId: id,
        estadoAnterior: mantencion.estado,
        estadoNuevo: nuevoEstado,
        userId,
        userName,
        notas: notas.length > 0 ? notas.join('; ') : null,
      });
    }

    return updated;
  }

  // Combined operations
  async getSolicitudMantencionWithDetails(id: string): Promise<(SolicitudMantencion & { 
    photos: MantencionPhoto[];
    historial: MantencionHistorial[];
    resolucionPhotos: MantencionResolucionPhoto[];
  }) | undefined> {
    const solicitud = await this.getSolicitudMantencionById(id);
    if (!solicitud) return undefined;

    const [photos, historial, resolucionPhotos] = await Promise.all([
      this.getMantencionPhotos(id),
      this.getMantencionHistorial(id),
      this.getMantencionResolucionPhotos(id),
    ]);

    return {
      ...solicitud,
      photos,
      historial,
      resolucionPhotos,
    };
  }

  // Asignar técnico
  async assignTecnicoToMantencion(
    id: string,
    tecnicoId: string,
    tecnicoName: string,
    userId: string,
    userName: string
  ): Promise<SolicitudMantencion> {
    const solicitud = await this.getSolicitudMantencionById(id);
    
    if (!solicitud) {
      throw new Error('Solicitud de mantención not found');
    }

    const [updated] = await db
      .update(solicitudesMantencion)
      .set({
        tecnicoAsignadoId: tecnicoId,
        tecnicoAsignadoName: tecnicoName,
        fechaAsignacion: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(solicitudesMantencion.id, id))
      .returning();

    // Create historial entry
    await this.createMantencionHistorial({
      mantencionId: id,
      estadoAnterior: solicitud.estado,
      estadoNuevo: solicitud.estado,
      userId,
      userName,
      notas: `Técnico asignado: ${tecnicoName}`,
    });

    return updated;
  }

  // Cambiar estado
  async updateMantencionEstado(
    id: string,
    nuevoEstado: string,
    userId: string,
    userName: string,
    notas?: string
  ): Promise<SolicitudMantencion> {
    const solicitud = await this.getSolicitudMantencionById(id);
    
    if (!solicitud) {
      throw new Error('Solicitud de mantención not found');
    }

    const updateData: any = {
      estado: nuevoEstado,
      updatedAt: new Date(),
    };

    // Si se marca como en_reparacion, registrar la fecha de asignación si no existe
    if (nuevoEstado === 'en_reparacion' && !solicitud.fechaAsignacion) {
      updateData.fechaAsignacion = new Date();
    }

    const [updated] = await db
      .update(solicitudesMantencion)
      .set(updateData)
      .where(eq(solicitudesMantencion.id, id))
      .returning();

    // Create historial entry
    await this.createMantencionHistorial({
      mantencionId: id,
      estadoAnterior: solicitud.estado,
      estadoNuevo: nuevoEstado,
      userId,
      userName,
      notas: notas || `Estado cambiado de ${solicitud.estado} a ${nuevoEstado}`,
    });

    return updated;
  }

  // Resolución (solo produccion)
  async updateResolucionMantencion(
    id: string,
    resolucionDescripcion: string,
    photos: Array<{ photoUrl: string; description?: string }>,
    userId: string,
    userName: string,
    costoReal?: number,
    tiempoReal?: number,
    repuestosUtilizados?: string
  ): Promise<SolicitudMantencion | null> {
    const solicitud = await this.getSolicitudMantencionById(id);
    
    if (!solicitud) {
      throw new Error('Solicitud de mantención not found');
    }
    
    // Actualización condicional para prevenir race conditions
    const updateData: any = {
      resolucionDescripcion,
      resolucionUsuarioId: userId,
      resolucionUsuarioName: userName,
      fechaResolucion: new Date(),
      estado: 'resuelto',
      updatedAt: new Date(),
    };

    if (costoReal !== undefined) updateData.costoReal = costoReal;
    if (tiempoReal !== undefined) updateData.tiempoReal = tiempoReal;
    if (repuestosUtilizados !== undefined) updateData.repuestosUtilizados = repuestosUtilizados;

    const [updated] = await db
      .update(solicitudesMantencion)
      .set(updateData)
      .where(and(
        eq(solicitudesMantencion.id, id),
        isNull(solicitudesMantencion.resolucionDescripcion)
      ))
      .returning();
    
    // Si no se actualizó ninguna fila, retornar null
    if (!updated) {
      return null;
    }
    
    // Crear las fotos de evidencia de resolución
    for (const photo of photos) {
      await db.insert(mantencionResolucionPhotos).values({
        mantencionId: id,
        photoUrl: photo.photoUrl,
        description: photo.description,
      });
    }
    
    // Create historial entry
    await this.createMantencionHistorial({
      mantencionId: id,
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'resuelto',
      userId,
      userName,
      notas: `Resolución agregada con ${photos.length} foto(s) de evidencia. Mantención finalizada.`,
    });

    // Crear notificación para el solicitante
    if (updated.solicitanteId) {
      await this.createNotification({
        userId: updated.solicitanteId,
        type: 'mantencion_resuelta',
        title: 'Mantención Resuelta',
        message: `La solicitud de mantención para "${updated.equipoNombre}" ha sido resuelta.`,
        relatedReclamoId: null,
        read: false,
      });
    }
    
    return updated;
  }

  // Cerrar solicitud de mantención
  async cerrarMantencion(
    id: string, 
    userId: string, 
    userName: string, 
    notas?: string
  ): Promise<SolicitudMantencion> {
    const solicitud = await this.getSolicitudMantencionById(id);
    
    if (!solicitud) {
      throw new Error('Solicitud de mantención not found');
    }
    
    const [updated] = await db
      .update(solicitudesMantencion)
      .set({
        estado: 'cerrado',
        fechaCierre: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(solicitudesMantencion.id, id))
      .returning();
    
    // Create historial entry
    await this.createMantencionHistorial({
      mantencionId: id,
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'cerrado',
      userId,
      userName,
      notas: notas || 'Solicitud de mantención cerrada',
    });
    
    return updated;
  }

  // ==================================================================================
  // CMMS - SISTEMA DE GESTIÓN DE MANTENIMIENTO
  // ==================================================================================
  
  // ===== EQUIPOS CRÍTICOS =====
  async createEquipoCritico(equipo: InsertEquipoCritico): Promise<EquipoCritico> {
    // Auto-generate codigo if not provided
    if (!equipo.codigo || equipo.codigo.trim() === '') {
      const timestamp = Date.now().toString(36).toUpperCase();
      const namePrefix = equipo.nombre.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
      equipo.codigo = `${namePrefix}-${timestamp}`;
    }
    
    const [result] = await db
      .insert(equiposCriticos)
      .values(equipo)
      .returning();
    return result;
  }

  async getEquiposCriticos(filters?: { 
    area?: string; 
    criticidad?: string;
    estadoActual?: string;
  }): Promise<EquipoCritico[]> {
    let query = db.select().from(equiposCriticos);
    
    const conditions = [];
    if (filters?.area) {
      conditions.push(eq(equiposCriticos.area, filters.area));
    }
    if (filters?.criticidad) {
      conditions.push(eq(equiposCriticos.criticidad, filters.criticidad));
    }
    if (filters?.estadoActual) {
      conditions.push(eq(equiposCriticos.estadoActual, filters.estadoActual));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(equiposCriticos.createdAt));
  }

  async getEquipoCriticoById(id: string): Promise<EquipoCritico | undefined> {
    const [result] = await db
      .select()
      .from(equiposCriticos)
      .where(eq(equiposCriticos.id, id));
    return result;
  }

  async getEquipoCriticoByCodigo(codigo: string): Promise<EquipoCritico | undefined> {
    const [result] = await db
      .select()
      .from(equiposCriticos)
      .where(eq(equiposCriticos.codigo, codigo));
    return result;
  }

  async updateEquipoCritico(id: string, updates: Partial<InsertEquipoCritico>): Promise<EquipoCritico> {
    const [result] = await db
      .update(equiposCriticos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(equiposCriticos.id, id))
      .returning();
    return result;
  }

  async deleteEquipoCritico(id: string): Promise<void> {
    await db.delete(equiposCriticos).where(eq(equiposCriticos.id, id));
  }

  async getComponentesDeEquipo(equipoPadreId: string): Promise<EquipoCritico[]> {
    return db
      .select()
      .from(equiposCriticos)
      .where(eq(equiposCriticos.equipoPadreId, equipoPadreId))
      .orderBy(equiposCriticos.nombre);
  }

  async getEquiposPrincipales(): Promise<EquipoCritico[]> {
    return db
      .select()
      .from(equiposCriticos)
      .where(isNull(equiposCriticos.equipoPadreId))
      .orderBy(equiposCriticos.nombre);
  }

  // ===== PROVEEDORES EXTERNOS =====
  async createProveedorMantencion(proveedor: InsertProveedorMantencion): Promise<ProveedorMantencion> {
    const [result] = await db
      .insert(proveedoresMantencion)
      .values(proveedor)
      .returning();
    return result;
  }

  async getProveedoresMantencion(filters?: { activo?: boolean }): Promise<ProveedorMantencion[]> {
    let query = db.select().from(proveedoresMantencion);
    
    if (filters?.activo !== undefined) {
      query = query.where(eq(proveedoresMantencion.activo, filters.activo)) as any;
    }
    
    return query.orderBy(proveedoresMantencion.nombre);
  }

  async getProveedorMantencionById(id: string): Promise<ProveedorMantencion | undefined> {
    const [result] = await db
      .select()
      .from(proveedoresMantencion)
      .where(eq(proveedoresMantencion.id, id));
    return result;
  }

  async updateProveedorMantencion(id: string, updates: Partial<InsertProveedorMantencion>): Promise<ProveedorMantencion> {
    const [result] = await db
      .update(proveedoresMantencion)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(proveedoresMantencion.id, id))
      .returning();
    return result;
  }

  async deleteProveedorMantencion(id: string): Promise<void> {
    await db.delete(proveedoresMantencion).where(eq(proveedoresMantencion.id, id));
  }

  // ===== PRESUPUESTO ANUAL =====
  async createPresupuestoMantencion(presupuesto: InsertPresupuestoMantencion): Promise<PresupuestoMantencion> {
    const [result] = await db
      .insert(presupuestoMantencion)
      .values(presupuesto)
      .returning();
    return result;
  }

  async getPresupuestosMantencion(filters?: { anio?: number; area?: string }): Promise<PresupuestoMantencion[]> {
    let query = db.select().from(presupuestoMantencion);
    
    const conditions = [];
    if (filters?.anio) {
      conditions.push(eq(presupuestoMantencion.anio, filters.anio));
    }
    if (filters?.area) {
      conditions.push(eq(presupuestoMantencion.area, filters.area));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(presupuestoMantencion.anio, presupuestoMantencion.mes, presupuestoMantencion.area);
  }

  async getPresupuestoMantencionByPeriod(anio: number, mes: number, area?: string): Promise<PresupuestoMantencion | undefined> {
    const conditions = [
      eq(presupuestoMantencion.anio, anio),
      eq(presupuestoMantencion.mes, mes)
    ];
    
    if (area) {
      conditions.push(eq(presupuestoMantencion.area, area));
    } else {
      conditions.push(isNull(presupuestoMantencion.area));
    }
    
    const [result] = await db
      .select()
      .from(presupuestoMantencion)
      .where(and(...conditions));
    return result;
  }

  async updatePresupuestoMantencion(id: string, updates: Partial<InsertPresupuestoMantencion>): Promise<PresupuestoMantencion> {
    const [result] = await db
      .update(presupuestoMantencion)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(presupuestoMantencion.id, id))
      .returning();
    return result;
  }

  async deletePresupuestoMantencion(id: string): Promise<void> {
    await db.delete(presupuestoMantencion).where(eq(presupuestoMantencion.id, id));
  }

  // ===== GASTOS DE MATERIALES =====
  async createGastoMaterialMantencion(gasto: InsertGastoMaterialMantencion): Promise<GastoMaterialMantencion> {
    const [result] = await db
      .insert(gastosMaterialesMantencion)
      .values(gasto)
      .returning();
    return result;
  }

  async getGastosMaterialesMantencion(filters?: {
    otId?: string;
    area?: string;
    anio?: string;
    mes?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: GastoMaterialMantencion[], total: number, costoPeriodo: number, page: number, pageSize: number }> {
    const conditions = [];
    if (filters?.otId) {
      conditions.push(eq(gastosMaterialesMantencion.otId, filters.otId));
    }
    if (filters?.area) {
      conditions.push(eq(gastosMaterialesMantencion.area, filters.area));
    }
    // Filter by year and month if provided
    if (filters?.anio && filters?.mes) {
      // Specific month in a year
      const startDate = new Date(`${filters.anio}-${filters.mes.padStart(2, '0')}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Last day of the month
      
      conditions.push(gte(gastosMaterialesMantencion.fecha, startDate));
      conditions.push(lte(gastosMaterialesMantencion.fecha, endDate));
    } else if (filters?.anio && !filters?.mes) {
      // Entire year
      const startDate = new Date(`${filters.anio}-01-01`);
      const endDate = new Date(`${filters.anio}-12-31`);
      
      conditions.push(gte(gastosMaterialesMantencion.fecha, startDate));
      conditions.push(lte(gastosMaterialesMantencion.fecha, endDate));
    } else {
      // Use explicit startDate and endDate if provided
      if (filters?.startDate) {
        conditions.push(gte(gastosMaterialesMantencion.fecha, new Date(filters.startDate)));
      }
      if (filters?.endDate) {
        conditions.push(lte(gastosMaterialesMantencion.fecha, new Date(filters.endDate)));
      }
    }
    
    // Get total count and sum of costs
    let aggregateQuery = db.select({ 
      count: sql<number>`count(*)`,
      costoTotal: sql<number>`COALESCE(SUM(CAST(${gastosMaterialesMantencion.costoTotal} AS DECIMAL)), 0)`
    }).from(gastosMaterialesMantencion);
    if (conditions.length > 0) {
      aggregateQuery = aggregateQuery.where(and(...conditions)) as any;
    }
    const [{ count: total, costoTotal: costoPeriodo }] = await aggregateQuery;
    
    // Get paginated data
    let dataQuery = db.select().from(gastosMaterialesMantencion);
    if (conditions.length > 0) {
      dataQuery = dataQuery.where(and(...conditions)) as any;
    }
    
    dataQuery = dataQuery.orderBy(desc(gastosMaterialesMantencion.fecha)) as any;
    
    // Apply pagination if provided
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 15;
    const offset = (page - 1) * pageSize;
    
    dataQuery = (dataQuery as any).limit(pageSize).offset(offset);
    
    const data = await dataQuery;
    
    return {
      data,
      total,
      costoPeriodo: Number(costoPeriodo),
      page,
      pageSize
    };
  }

  async getGastoMaterialMantencionById(id: string): Promise<GastoMaterialMantencion | undefined> {
    const [result] = await db
      .select()
      .from(gastosMaterialesMantencion)
      .where(eq(gastosMaterialesMantencion.id, id));
    return result;
  }

  async updateGastoMaterialMantencion(id: string, updates: Partial<InsertGastoMaterialMantencion>): Promise<GastoMaterialMantencion> {
    const [result] = await db
      .update(gastosMaterialesMantencion)
      .set(updates)
      .where(eq(gastosMaterialesMantencion.id, id))
      .returning();
    return result;
  }

  async deleteGastoMaterialMantencion(id: string): Promise<void> {
    await db.delete(gastosMaterialesMantencion).where(eq(gastosMaterialesMantencion.id, id));
  }

  async getGastosMaterialesForExport(filters?: {
    area?: string;
    anio?: string;
    mes?: string;
  }): Promise<Array<GastoMaterialMantencion & {
    ot?: {
      id: string;
      equipoNombre: string;
      descripcionProblema: string;
      estado: string;
      gravedad: string;
    } | null;
    proveedor?: {
      id: string;
      nombre: string;
      contacto: string | null;
    } | null;
  }>> {
    const conditions = [];
    
    if (filters?.area) {
      conditions.push(eq(gastosMaterialesMantencion.area, filters.area));
    }
    
    if (filters?.anio && filters?.mes) {
      const startDate = new Date(`${filters.anio}-${filters.mes.padStart(2, '0')}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      conditions.push(gte(gastosMaterialesMantencion.fecha, startDate));
      conditions.push(lt(gastosMaterialesMantencion.fecha, endDate));
    } else if (filters?.anio && !filters?.mes) {
      const startDate = new Date(`${filters.anio}-01-01`);
      const endDate = new Date(`${parseInt(filters.anio, 10) + 1}-01-01`);
      
      conditions.push(gte(gastosMaterialesMantencion.fecha, startDate));
      conditions.push(lt(gastosMaterialesMantencion.fecha, endDate));
    }
    
    let query = db
      .select({
        gasto: gastosMaterialesMantencion,
        ot: {
          id: solicitudesMantencion.id,
          equipoNombre: solicitudesMantencion.equipoNombre,
          descripcionProblema: solicitudesMantencion.descripcionProblema,
          estado: solicitudesMantencion.estado,
          gravedad: solicitudesMantencion.gravedad,
        },
        proveedor: {
          id: proveedoresMantencion.id,
          nombre: proveedoresMantencion.nombre,
          contacto: proveedoresMantencion.contacto,
        },
      })
      .from(gastosMaterialesMantencion)
      .leftJoin(solicitudesMantencion, eq(gastosMaterialesMantencion.otId, solicitudesMantencion.id))
      .leftJoin(proveedoresMantencion, eq(gastosMaterialesMantencion.proveedorId, proveedoresMantencion.id));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(gastosMaterialesMantencion.fecha)) as any;
    
    const results = await query;
    
    return results.map((r: any) => ({
      ...r.gasto,
      ot: r.ot?.id ? r.ot : null,
      proveedor: r.proveedor?.id ? r.proveedor : null,
    }));
  }

  // ===== PLANES PREVENTIVOS =====
  async createPlanPreventivo(plan: InsertPlanPreventivo): Promise<PlanPreventivo> {
    const [result] = await db
      .insert(planesPreventivos)
      .values(plan)
      .returning();
    return result;
  }

  async getPlanesPreventivos(filters?: { 
    equipoId?: string;
    activo?: boolean;
  }): Promise<PlanPreventivo[]> {
    let query = db.select().from(planesPreventivos);
    
    const conditions = [];
    if (filters?.equipoId) {
      conditions.push(eq(planesPreventivos.equipoId, filters.equipoId));
    }
    if (filters?.activo !== undefined) {
      conditions.push(eq(planesPreventivos.activo, filters.activo));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(planesPreventivos.proximaEjecucion);
  }

  async getPlanPreventivoById(id: string): Promise<PlanPreventivo | undefined> {
    const [result] = await db
      .select()
      .from(planesPreventivos)
      .where(eq(planesPreventivos.id, id));
    return result;
  }

  async getPlanesPreventivosVencidos(): Promise<PlanPreventivo[]> {
    const now = new Date();
    return db
      .select()
      .from(planesPreventivos)
      .where(
        and(
          eq(planesPreventivos.activo, true),
          lte(planesPreventivos.proximaEjecucion, now)
        )
      )
      .orderBy(planesPreventivos.proximaEjecucion);
  }

  async updatePlanPreventivo(id: string, updates: Partial<InsertPlanPreventivo>): Promise<PlanPreventivo> {
    const [result] = await db
      .update(planesPreventivos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(planesPreventivos.id, id))
      .returning();
    return result;
  }

  async deletePlanPreventivo(id: string): Promise<void> {
    await db.delete(planesPreventivos).where(eq(planesPreventivos.id, id));
  }

  // ===== MANTENCIONES PLANIFICADAS =====
  async createMantencionPlanificada(mantencion: InsertMantencionPlanificada): Promise<MantencionPlanificada> {
    const [result] = await db
      .insert(mantencionesPlanificadas)
      .values(mantencion)
      .returning();
    return result;
  }

  async getMantencionesPlanificadas(filters?: {
    anio?: number;
    estado?: string;
    area?: string;
  }): Promise<MantencionPlanificada[]> {
    let query = db.select().from(mantencionesPlanificadas);
    
    const conditions = [];
    if (filters?.anio) {
      conditions.push(eq(mantencionesPlanificadas.anio, filters.anio));
    }
    if (filters?.estado) {
      conditions.push(eq(mantencionesPlanificadas.estado, filters.estado));
    }
    if (filters?.area) {
      conditions.push(eq(mantencionesPlanificadas.area, filters.area));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(mantencionesPlanificadas.anio, mantencionesPlanificadas.mes);
  }

  async getMantencionPlanificadaById(id: string): Promise<MantencionPlanificada | undefined> {
    const [result] = await db
      .select()
      .from(mantencionesPlanificadas)
      .where(eq(mantencionesPlanificadas.id, id));
    return result;
  }

  async updateMantencionPlanificada(id: string, updates: Partial<InsertMantencionPlanificada>): Promise<MantencionPlanificada> {
    const [result] = await db
      .update(mantencionesPlanificadas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mantencionesPlanificadas.id, id))
      .returning();
    return result;
  }

  async deleteMantencionPlanificada(id: string): Promise<void> {
    await db.delete(mantencionesPlanificadas).where(eq(mantencionesPlanificadas.id, id));
  }

  /**
   * Calcula el presupuesto ejecutado real del mes sumando todos los gastos de materiales
   * asociados a OTs del período
   */
  async getPresupuestoEjecutadoDelMes(anio: number, mes: number, area?: string): Promise<number> {
    // Calcular rango de fechas del mes
    const startDate = new Date(anio, mes - 1, 1);
    const endDate = new Date(anio, mes, 0, 23, 59, 59); // Último día del mes
    
    const conditions = [
      gte(gastosMaterialesMantencion.fecha, startDate),
      lte(gastosMaterialesMantencion.fecha, endDate)
    ];
    
    if (area) {
      conditions.push(eq(gastosMaterialesMantencion.area, area));
    }
    
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${gastosMaterialesMantencion.costoTotal}), 0)` })
      .from(gastosMaterialesMantencion)
      .where(and(...conditions));
    
    return Number(result[0]?.total || 0);
  }

  /**
   * Obtiene mantenciones planificadas para un mes específico
   */
  async getMantencionesPlanificadasDelMes(anio: number, mes: number, area?: string): Promise<MantencionPlanificada[]> {
    const conditions = [
      eq(mantencionesPlanificadas.anio, anio),
      eq(mantencionesPlanificadas.mes, mes)
    ];
    
    if (area) {
      conditions.push(eq(mantencionesPlanificadas.area, area));
    }
    
    return db
      .select()
      .from(mantencionesPlanificadas)
      .where(and(...conditions))
      .orderBy(mantencionesPlanificadas.costoEstimado);
  }

  // ===== SCHEDULER AUTOMATICO PLANES PREVENTIVOS =====
  /**
   * Encuentra planes preventivos activos que necesitan generar una OT
   * (cuya próxima ejecución está vencida o dentro de las próximas 2 horas)
   */
  async findPlansNeedingOT(): Promise<PlanPreventivo[]> {
    const now = new Date();
    const lookAheadTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 horas

    const plans = await db
      .select()
      .from(planesPreventivos)
      .where(
        and(
          eq(planesPreventivos.activo, true),
          lte(planesPreventivos.proximaEjecucion, lookAheadTime)
        )
      );

    return plans;
  }

  /**
   * Calcula la próxima fecha de ejecución según la frecuencia del plan
   */
  calculateNextExecution(currentDate: Date, frecuencia: string): Date {
    const nextDate = new Date(currentDate);

    switch (frecuencia) {
      case 'diaria':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'semanal':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'quincenal':
        nextDate.setDate(nextDate.getDate() + 15);
        break;
      case 'mensual':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'trimestral':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'semestral':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'anual':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        // Por defecto, agregar 30 días
        nextDate.setDate(nextDate.getDate() + 30);
    }

    return nextDate;
  }

  /**
   * Genera una solicitud de mantención (OT) automática a partir de un plan preventivo
   */
  async generateOTFromPlan(plan: PlanPreventivo): Promise<SolicitudMantencion> {
    try {
      // Obtener usuario sistema para crear la OT
      const systemUser = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
      const systemUserId = systemUser[0]?.id || 'system';
      
      let equipoData = null;
      let equipoNombre = plan.equipoNombre || 'Tarea General';
      let equipoCodigo: string | undefined = undefined;
      let equipoId: string | undefined = undefined;
      let area = 'produccion'; // Default área
      let ubicacion: string | undefined = undefined;

      // Si el plan tiene equipo asociado, obtener su información
      if (plan.equipoId) {
        const equipo = await db
          .select()
          .from(equiposCriticos)
          .where(eq(equiposCriticos.id, plan.equipoId))
          .limit(1);

        equipoData = equipo[0];
        if (equipoData) {
          equipoNombre = equipoData.nombre;
          equipoCodigo = equipoData.codigo || undefined;
          equipoId = equipoData.id;
          area = equipoData.area;
          ubicacion = equipoData.ubicacion || undefined;
        }
      }
      
      // Preparar descripción
      const descripcionText = plan.descripcion 
        ? `\n\nDescripción: ${plan.descripcion}`
        : '';
      
      const tipoTarea = plan.equipoId ? 'EQUIPO' : 'TAREA GENERAL';
      
      const nuevaMantencion: InsertSolicitudMantencion = {
        equipoNombre: equipoNombre,
        equipoCodigo: equipoCodigo,
        equipoId: equipoId,
        area: area,
        ubicacion: ubicacion,
        descripcionProblema: `🔧 MANTENCIÓN PREVENTIVA PROGRAMADA (${tipoTarea})\n\nPlan: ${plan.nombrePlan}${descripcionText}`,
        checklistTareas: plan.tareasPreventivas || undefined, // Copiar checklist al campo específico
        tipoMantencion: 'preventivo',
        gravedad: 'media',
        prioridad: 'media',
        estado: 'registrado', // Estado inicial correcto
        solicitanteId: systemUserId,
        solicitanteName: 'SISTEMA AUTOMÁTICO',
        planPreventivoId: plan.id, // Vincular con el plan
      };

      const [result] = await db
        .insert(solicitudesMantencion)
        .values(nuevaMantencion)
        .returning();

      return result;
    } catch (error: any) {
      console.error(`Error generando OT para plan ${plan.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Procesa el scheduler de mantenimiento preventivo:
   * - Encuentra planes que necesitan generar OT
   * - Genera las OTs automáticas
   * - Actualiza la próxima ejecución
   * - Retorna el número de OTs generadas
   */
  async processPreventiveMaintenanceSchedule(): Promise<number> {
    try {
      // Encontrar planes que necesitan generar OT
      const plansNeedingOT = await this.findPlansNeedingOT();

      if (plansNeedingOT.length === 0) {
        return 0;
      }

      let otsGenerated = 0;

      for (const plan of plansNeedingOT) {
        try {
          // Generar la OT
          const ot = await this.generateOTFromPlan(plan);
          
          // Calcular próxima ejecución
          const nextExecution = this.calculateNextExecution(
            new Date(plan.proximaEjecucion),
            plan.frecuencia
          );

          // Actualizar el plan con la nueva próxima ejecución
          await db
            .update(planesPreventivos)
            .set({
              proximaEjecucion: nextExecution,
              updatedAt: new Date(),
            })
            .where(eq(planesPreventivos.id, plan.id));

          otsGenerated++;

          console.log(`✅ OT generada automáticamente: ${ot.id} para plan ${plan.nombrePlan}`);
        } catch (error: any) {
          console.error(`❌ Error procesando plan ${plan.id}:`, error.message);
          // Continuar con el siguiente plan aunque este falle
        }
      }

      return otsGenerated;
    } catch (error: any) {
      console.error('Error en processPreventiveMaintenanceSchedule:', error.message);
      throw error;
    }
  }

  // ===== KPIs Y DASHBOARDS CMMS =====
  async getCMMSMetrics(filters?: {
    startDate?: string;
    endDate?: string;
    area?: string;
  }): Promise<{
    totalOTs: number;
    // OT por estado real (estados actuales del sistema)
    otsRegistradas: number;
    otsProgramadas: number;
    otsEnReparacion: number;
    otsPausadas: number;
    otsResueltas: number;
    otsCerradas: number;
    // Tipo de mantención
    mttr: number;
    preventivas: number;
    correctivas: number;
    // Costos
    costoTotal: number;
    costoPlanificado: number;
    costoDesviacion: number;
    // Equipos por estado real (usando estadoActual)
    equiposCriticos: number;
    equiposOperativos: number;
    equiposEnMantencion: number;
    equiposDetenidos: number;
    equiposFueraDeServicio: number;
    // Otros contadores
    proveedoresActivos: number;
    planesPreventivosActivos: number;
    planesVencidos: number;
    mantencionesPlanificadasTotal: number;
    mantencionesPlanificadasAprobadas: number;
    mantencionesPlanificadasCosto: number;
  }> {
    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(gte(solicitudesMantencion.fechaSolicitud, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(solicitudesMantencion.fechaSolicitud, new Date(filters.endDate)));
    }
    // Global = todas las áreas (sin filtro), de lo contrario filtrar por área específica
    if (filters?.area && filters.area !== 'global') {
      conditions.push(eq(solicitudesMantencion.area, filters.area));
    }

    let query = db.select().from(solicitudesMantencion);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const ots = await query;

    const totalOTs = ots.length;
    
    // Contar OTs por estado real (cada estado tiene su propia métrica)
    const otsRegistradas = ots.filter(ot => ot.estado === 'registrado').length;
    const otsProgramadas = ots.filter(ot => ot.estado === 'programada').length;
    const otsEnReparacion = ots.filter(ot => ot.estado === 'en_reparacion').length;
    const otsPausadas = ots.filter(ot => ot.estado === 'pausada').length;
    const otsResueltas = ots.filter(ot => ot.estado === 'resuelto').length;
    const otsCerradas = ots.filter(ot => ot.estado === 'cerrado').length;
    
    // Tipo de mantención
    const preventivas = ots.filter(ot => ot.tipoMantencion === 'preventivo').length;
    const correctivas = ots.filter(ot => ot.tipoMantencion === 'correctivo').length;

    // Calcular MTTR (Mean Time To Repair) en horas usando fechaInicioTrabajo y fechaResolucion
    const otsConTiempo = ots.filter(ot => 
      ot.fechaInicioTrabajo && ot.fechaResolucion && 
      ot.fechaInicioTrabajo instanceof Date && ot.fechaResolucion instanceof Date
    );
    
    let mttr = 0;
    if (otsConTiempo.length > 0) {
      const tiemposTotales = otsConTiempo.map(ot => {
        const inicio = new Date(ot.fechaInicioTrabajo!).getTime();
        const termino = new Date(ot.fechaResolucion!).getTime();
        return (termino - inicio) / (1000 * 60 * 60); // Convertir a horas
      });
      mttr = tiemposTotales.reduce((sum, t) => sum + t, 0) / otsConTiempo.length;
    }

    // Extraer año y rango de meses desde filtros
    const startDateObj = filters?.startDate ? new Date(filters.startDate) : new Date();
    const endDateObj = filters?.endDate ? new Date(filters.endDate) : new Date();
    const yearFromFilter = startDateObj.getFullYear();
    const startMonth = startDateObj.getMonth() + 1; // 1-12
    const endMonth = endDateObj.getMonth() + 1; // 1-12
    
    // Obtener presupuestos del año con filtro de área (solo primer registro por mes)
    const presupuestoConditions: any[] = [eq(presupuestoMantencion.anio, yearFromFilter)];
    if (filters?.area === 'global') {
      // Global = solo presupuestos sin área asignada (area = null), estrictamente
      presupuestoConditions.push(isNull(presupuestoMantencion.area));
    } else if (filters?.area) {
      // Área específica
      presupuestoConditions.push(eq(presupuestoMantencion.area, filters.area));
    }
    
    const presupuestos = await db.select()
      .from(presupuestoMantencion)
      .where(and(...presupuestoConditions));
    
    // Filtrar por meses dentro del rango y agrupar por mes (solo primer registro por mes)
    const presupuestosPorMes = new Map<number, typeof presupuestos[0]>();
    for (const p of presupuestos) {
      if (p.mes >= startMonth && p.mes <= endMonth && !presupuestosPorMes.has(p.mes)) {
        presupuestosPorMes.set(p.mes, p);
      }
    }
    const presupuestosPeriodo = Array.from(presupuestosPorMes.values());
    
    // Base de presupuesto asignado
    const baseAsignado = presupuestosPeriodo.reduce((sum, p) => sum + Number(p.presupuestoAsignado), 0);
    
    // Calcular Costo Ejecutado (igual que en módulo de presupuesto)
    // = presupuestoEjecutado (base) + gastos de materiales + mantenciones planificadas completadas
    
    // 1. Base de presupuesto ejecutado
    const baseEjecutado = presupuestosPeriodo.reduce((sum, p) => sum + Number(p.presupuestoEjecutado), 0);
    
    // 2. Gastos de materiales del periodo
    const gastosConditions: any[] = [];
    if (filters?.startDate) {
      gastosConditions.push(gte(gastosMaterialesMantencion.fecha, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      gastosConditions.push(lte(gastosMaterialesMantencion.fecha, new Date(filters.endDate)));
    }
    // Global = todas las áreas (sin filtro), de lo contrario filtrar por área específica
    if (filters?.area && filters.area !== 'global') {
      gastosConditions.push(eq(gastosMaterialesMantencion.area, filters.area));
    }
    
    let gastosQuery = db.select().from(gastosMaterialesMantencion);
    if (gastosConditions.length > 0) {
      gastosQuery = gastosQuery.where(and(...gastosConditions)) as any;
    }
    const gastosMateriales = await gastosQuery;
    const totalGastosMateriales = gastosMateriales.reduce((sum, g) => sum + Number(g.costoTotal), 0);
    
    // 3. Obtener TODAS las mantenciones planificadas del año (para calcular aprobadas y completadas)
    const mantConditionsAll: any[] = [eq(mantencionesPlanificadas.anio, yearFromFilter)];
    // Global = todas las áreas (sin filtro), de lo contrario filtrar por área específica
    if (filters?.area && filters.area !== 'global') {
      mantConditionsAll.push(eq(mantencionesPlanificadas.area, filters.area));
    }
    
    const todasMantPlanificadas = await db.select()
      .from(mantencionesPlanificadas)
      .where(and(...mantConditionsAll));
    
    // Filtrar mantenciones asignadas del periodo (planificado + aprobado + completado)
    const totalMantAsignadas = todasMantPlanificadas
      .filter(m => 
        m.mes >= startMonth && 
        m.mes <= endMonth && 
        ['planificado', 'aprobado', 'completado'].includes(m.estado)
      )
      .reduce((sum, m) => sum + Number(m.costoEstimado), 0);
    
    // Filtrar mantenciones completadas del periodo (para Costo Ejecutado)
    const totalMantCompletadas = todasMantPlanificadas
      .filter(m => m.mes >= startMonth && m.mes <= endMonth && m.estado === 'completado')
      .reduce((sum, m) => sum + Number(m.costoEstimado), 0);
    
    // Costo Asignado = base + mantenciones (planificada + aprobado + completado)
    const costoPlanificado = baseAsignado + totalMantAsignadas;
    
    // Costo Total Ejecutado = base + gastos + mantenciones completadas
    const costoTotal = baseEjecutado + totalGastosMateriales + totalMantCompletadas;

    // Obtener contadores adicionales
    const proveedores = await db.select().from(proveedoresMantencion).where(eq(proveedoresMantencion.activo, true));
    const planes = await db.select().from(planesPreventivos).where(eq(planesPreventivos.activo, true));
    const todosPlanes = await db.select().from(planesPreventivos);
    
    // Obtener solo equipos PADRES (sin equipoPadreId = componentes)
    const equipos = await db.select().from(equiposCriticos).where(isNull(equiposCriticos.equipoPadreId));
    
    // Contar planes vencidos (proximaEjecucion < hoy)
    const now = new Date();
    const planesVencidos = todosPlanes.filter(p => 
      p.activo && p.proximaEjecucion && new Date(p.proximaEjecucion) < now
    ).length;
    
    // Clasificar equipos usando el campo estadoActual directamente
    let equiposOperativos = 0;
    let equiposEnMantencion = 0;
    let equiposDetenidos = 0;
    let equiposFueraDeServicio = 0;
    
    for (const equipo of equipos) {
      const estado = equipo.estadoActual || 'operativo'; // Default a operativo si no tiene estado
      
      switch (estado) {
        case 'operativo':
          equiposOperativos++;
          break;
        case 'en_mantencion':
          equiposEnMantencion++;
          break;
        case 'detenido':
          equiposDetenidos++;
          break;
        case 'fuera_de_servicio':
          equiposFueraDeServicio++;
          break;
        default:
          equiposOperativos++; // Fallback a operativo para estados no reconocidos
      }
    }

    // Obtener métricas de mantenciones planificadas del año actual
    const currentYear = new Date().getFullYear();
    const mantencionesConditions: any[] = [eq(mantencionesPlanificadas.anio, currentYear)];
    if (filters?.area) {
      mantencionesConditions.push(eq(mantencionesPlanificadas.area, filters.area));
    }
    
    const mantencionesPlan = await db.select()
      .from(mantencionesPlanificadas)
      .where(and(...mantencionesConditions));
    
    const mantPlanTotal = mantencionesPlan.length;
    const mantPlanAprobadas = mantencionesPlan.filter(m => m.estado === 'aprobado').length;
    const mantPlanCosto = mantencionesPlan.reduce((sum, m) => sum + Number(m.costoEstimado), 0);

    return {
      totalOTs,
      // OTs por estado real
      otsRegistradas,
      otsProgramadas,
      otsEnReparacion,
      otsPausadas,
      otsResueltas,
      otsCerradas,
      // Tipo de mantención
      mttr: Math.round(mttr * 10) / 10, // Redondear a 1 decimal
      preventivas,
      correctivas,
      // Costos
      costoTotal: Math.round(costoTotal),
      costoPlanificado: Math.round(costoPlanificado),
      costoDesviacion: Math.round(costoTotal - costoPlanificado),
      // Equipos por estado real
      equiposCriticos: equipos.length,
      equiposOperativos,
      equiposEnMantencion,
      equiposDetenidos,
      equiposFueraDeServicio,
      // Otros contadores
      proveedoresActivos: proveedores.length,
      planesPreventivosActivos: planes.length,
      planesVencidos,
      mantencionesPlanificadasTotal: mantPlanTotal,
      mantencionesPlanificadasAprobadas: mantPlanAprobadas,
      mantencionesPlanificadasCosto: Math.round(mantPlanCosto),
    };
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
  
  // Solicitantes de marketing (admin, supervisor, vendedor)
  async getMarketingSolicitantes(): Promise<Array<{
    id: number;
    name: string;
    role: string;
  }>> {
    // Get users with roles: admin, supervisor, salesperson
    const allowedRoles = ['admin', 'supervisor', 'salesperson'];
    
    const results = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(users)
      .where(inArray(users.role, allowedRoles))
      .orderBy(users.firstName, users.lastName);
    
    return results.map(u => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
    }));
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

  // ==================== PRECIOS DE COMPETENCIA ====================

  async getCompetidores(): Promise<Competidor[]> {
    return await db
      .select()
      .from(competidores)
      .where(eq(competidores.activo, true))
      .orderBy(asc(competidores.nombre));
  }

  async getCompetidorById(id: string): Promise<Competidor | undefined> {
    const [result] = await db
      .select()
      .from(competidores)
      .where(eq(competidores.id, id));
    return result;
  }

  async createCompetidor(data: InsertCompetidor): Promise<Competidor> {
    const [result] = await db
      .insert(competidores)
      .values(data)
      .returning();
    return result;
  }

  async updateCompetidor(id: string, updates: Partial<InsertCompetidor>): Promise<Competidor> {
    const [result] = await db
      .update(competidores)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(competidores.id, id))
      .returning();
    return result;
  }

  async deleteCompetidor(id: string): Promise<void> {
    await db
      .update(competidores)
      .set({ activo: false, updatedAt: new Date() })
      .where(eq(competidores.id, id));
  }

  // ==================== PRODUCTOS MONITOREO ====================

  async getProductosMonitoreo(filters?: {
    activo?: boolean;
    search?: string;
  }): Promise<ProductoMonitoreo[]> {
    const conditions = [];
    
    if (filters?.activo !== undefined) {
      conditions.push(eq(productosMonitoreo.activo, filters.activo));
    }
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(productosMonitoreo.nombreProducto, searchTerm),
          ilike(productosMonitoreo.formato, searchTerm)
        )
      );
    }

    return await db
      .select()
      .from(productosMonitoreo)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(productosMonitoreo.nombreProducto));
  }

  async getProductoMonitoreoById(id: string): Promise<ProductoMonitoreo | undefined> {
    const [result] = await db
      .select()
      .from(productosMonitoreo)
      .where(eq(productosMonitoreo.id, id));
    return result;
  }

  async createProductoMonitoreo(data: InsertProductoMonitoreo): Promise<ProductoMonitoreo> {
    const [result] = await db
      .insert(productosMonitoreo)
      .values(data)
      .returning();
    return result;
  }

  async updateProductoMonitoreo(id: string, updates: Partial<InsertProductoMonitoreo>): Promise<ProductoMonitoreo> {
    const [result] = await db
      .update(productosMonitoreo)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(productosMonitoreo.id, id))
      .returning();
    return result;
  }

  async deleteProductoMonitoreo(id: string): Promise<void> {
    await db
      .update(productosMonitoreo)
      .set({ activo: false, updatedAt: new Date() })
      .where(eq(productosMonitoreo.id, id));
  }

  async getPreciosByProductoMonitoreoId(productoMonitoreoId: string): Promise<(PrecioCompetencia & { competidorNombre: string })[]> {
    const results = await db
      .select({
        id: preciosCompetencia.id,
        productoMonitoreoId: preciosCompetencia.productoMonitoreoId,
        competidorId: preciosCompetencia.competidorId,
        precioWeb: preciosCompetencia.precioWeb,
        precioFerreteria: preciosCompetencia.precioFerreteria,
        precioConstruccion: preciosCompetencia.precioConstruccion,
        fechaRegistro: preciosCompetencia.fechaRegistro,
        notas: preciosCompetencia.notas,
        urlReferencia: preciosCompetencia.urlReferencia,
        createdBy: preciosCompetencia.createdBy,
        createdAt: preciosCompetencia.createdAt,
        updatedAt: preciosCompetencia.updatedAt,
        competidorNombre: competidores.nombre,
      })
      .from(preciosCompetencia)
      .leftJoin(competidores, eq(preciosCompetencia.competidorId, competidores.id))
      .where(eq(preciosCompetencia.productoMonitoreoId, productoMonitoreoId))
      .orderBy(desc(preciosCompetencia.fechaRegistro));

    return results.map(r => ({
      ...r,
      competidorNombre: r.competidorNombre || 'Desconocido',
    }));
  }

  async getPreciosCompetencia(filters?: {
    productoMonitoreoId?: string;
    competidorId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    search?: string;
  }): Promise<(PrecioCompetencia & { competidorNombre: string; productoNombre: string; productoFormato: string | null })[]> {
    const conditions = [];
    
    if (filters?.productoMonitoreoId) {
      conditions.push(eq(preciosCompetencia.productoMonitoreoId, filters.productoMonitoreoId));
    }
    if (filters?.competidorId) {
      conditions.push(eq(preciosCompetencia.competidorId, filters.competidorId));
    }
    if (filters?.fechaDesde) {
      conditions.push(gte(preciosCompetencia.fechaRegistro, filters.fechaDesde));
    }
    if (filters?.fechaHasta) {
      conditions.push(lte(preciosCompetencia.fechaRegistro, filters.fechaHasta));
    }
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        ilike(productosMonitoreo.nombreProducto, searchTerm)
      );
    }

    const results = await db
      .select({
        id: preciosCompetencia.id,
        productoMonitoreoId: preciosCompetencia.productoMonitoreoId,
        competidorId: preciosCompetencia.competidorId,
        precioWeb: preciosCompetencia.precioWeb,
        precioFerreteria: preciosCompetencia.precioFerreteria,
        precioConstruccion: preciosCompetencia.precioConstruccion,
        fechaRegistro: preciosCompetencia.fechaRegistro,
        notas: preciosCompetencia.notas,
        urlReferencia: preciosCompetencia.urlReferencia,
        createdBy: preciosCompetencia.createdBy,
        createdAt: preciosCompetencia.createdAt,
        updatedAt: preciosCompetencia.updatedAt,
        competidorNombre: competidores.nombre,
        productoNombre: productosMonitoreo.nombreProducto,
        productoFormato: productosMonitoreo.formato,
      })
      .from(preciosCompetencia)
      .leftJoin(competidores, eq(preciosCompetencia.competidorId, competidores.id))
      .leftJoin(productosMonitoreo, eq(preciosCompetencia.productoMonitoreoId, productosMonitoreo.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(preciosCompetencia.fechaRegistro), asc(productosMonitoreo.nombreProducto));

    return results.map(r => ({
      ...r,
      competidorNombre: r.competidorNombre || 'Desconocido',
      productoNombre: r.productoNombre || 'Producto no encontrado',
      productoFormato: r.productoFormato || null,
    }));
  }

  async getPrecioCompetenciaById(id: string): Promise<PrecioCompetencia | undefined> {
    const [result] = await db
      .select()
      .from(preciosCompetencia)
      .where(eq(preciosCompetencia.id, id));
    return result;
  }

  async createPrecioCompetencia(data: InsertPrecioCompetencia): Promise<PrecioCompetencia> {
    const [result] = await db
      .insert(preciosCompetencia)
      .values(data)
      .returning();
    return result;
  }

  async updatePrecioCompetencia(id: string, updates: Partial<InsertPrecioCompetencia>): Promise<PrecioCompetencia> {
    const [result] = await db
      .update(preciosCompetencia)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(preciosCompetencia.id, id))
      .returning();
    return result;
  }

  async deletePrecioCompetencia(id: string): Promise<void> {
    await db
      .delete(preciosCompetencia)
      .where(eq(preciosCompetencia.id, id));
  }

  // ==================== TAREAS (UNIFICADAS) ====================

  async getTareasMarketing(filters?: {
    mes?: number;
    anio?: number;
    estado?: string;
    asignadoAId?: string;
    incluirPorFechaLimite?: boolean;
    tipo?: string;
    asignadoAIds?: string[];
  }): Promise<TareaMarketing[]> {
    const conditions = [];
    
    if (filters?.mes && filters?.anio) {
      if (filters.incluirPorFechaLimite) {
        const startOfMonth = new Date(filters.anio, filters.mes - 1, 1);
        const endOfMonth = new Date(filters.anio, filters.mes, 0);
        const startStr = startOfMonth.toISOString().split('T')[0];
        const endStr = endOfMonth.toISOString().split('T')[0];
        
        conditions.push(
          or(
            and(eq(tareasMarketing.mes, filters.mes), eq(tareasMarketing.anio, filters.anio)),
            and(
              gte(tareasMarketing.fechaLimite, startStr),
              lte(tareasMarketing.fechaLimite, endStr)
            )
          )
        );
      } else {
        conditions.push(eq(tareasMarketing.mes, filters.mes));
        conditions.push(eq(tareasMarketing.anio, filters.anio));
      }
    } else {
      if (filters?.mes) {
        conditions.push(eq(tareasMarketing.mes, filters.mes));
      }
      if (filters?.anio) {
        conditions.push(eq(tareasMarketing.anio, filters.anio));
      }
    }
    
    if (filters?.estado) {
      conditions.push(eq(tareasMarketing.estado, filters.estado));
    }
    if (filters?.asignadoAId) {
      conditions.push(eq(tareasMarketing.asignadoAId, filters.asignadoAId));
    }
    if (filters?.asignadoAIds && filters.asignadoAIds.length > 0) {
      conditions.push(inArray(tareasMarketing.asignadoAId, filters.asignadoAIds));
    }
    if (filters?.tipo) {
      conditions.push(eq(tareasMarketing.tipo, filters.tipo));
    }

    return await db
      .select()
      .from(tareasMarketing)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tareasMarketing.createdAt));
  }

  async getVendedoresBySupervisor(supervisorId: string): Promise<SalespersonUser[]> {
    return await db
      .select()
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.supervisorId, supervisorId));
  }

  async getTareaMarketingById(id: string): Promise<TareaMarketing | undefined> {
    const [result] = await db
      .select()
      .from(tareasMarketing)
      .where(eq(tareasMarketing.id, id));
    return result;
  }

  async createTareaMarketing(data: InsertTareaMarketing): Promise<TareaMarketing> {
    const [result] = await db
      .insert(tareasMarketing)
      .values(data)
      .returning();
    return result;
  }

  async updateTareaMarketing(id: string, updates: Partial<InsertTareaMarketing>): Promise<TareaMarketing> {
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };
    
    // Si se está marcando como completado, registrar la fecha
    if (updates.estado === 'completado') {
      updateData.completadoEn = new Date();
    }
    
    const [result] = await db
      .update(tareasMarketing)
      .set(updateData)
      .where(eq(tareasMarketing.id, id))
      .returning();
    return result;
  }

  async deleteTareaMarketing(id: string): Promise<void> {
    await db
      .delete(tareasMarketing)
      .where(eq(tareasMarketing.id, id));
  }

  async toggleTareaMarketingEstado(id: string): Promise<TareaMarketing> {
    const tarea = await this.getTareaMarketingById(id);
    if (!tarea) {
      throw new Error('Tarea no encontrada');
    }
    
    // Ciclo de estados: pendiente -> en_proceso -> completado
    let nuevoEstado = 'pendiente';
    if (tarea.estado === 'pendiente') {
      nuevoEstado = 'en_proceso';
    } else if (tarea.estado === 'en_proceso') {
      nuevoEstado = 'completado';
    }
    
    return this.updateTareaMarketing(id, { estado: nuevoEstado });
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
  
  async getWarehouses(branch?: string): Promise<{ code: string; name: string }[]> {
    try {
      // If branch is specified, filter warehouses from PostgreSQL inventory
      if (branch && branch !== 'all') {
        const warehouses = await db
          .selectDistinct({
            code: inventoryProducts.bodega,
            name: inventoryProducts.nombreBodega,
          })
          .from(inventoryProducts)
          .where(
            and(
              eq(inventoryProducts.sucursal, branch),
              isNotNull(inventoryProducts.bodega),
              sql`${inventoryProducts.bodega} != ''`
            )
          )
          .orderBy(inventoryProducts.bodega);

        return warehouses.map((w) => ({
          code: w.code || '',
          name: w.name || w.code || '',
        }));
      }

      // Otherwise, fetch all warehouses from SQL Server
      const pool = await mssql.connect({
        server: process.env.SQL_SERVER_HOST || '',
        port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
        user: process.env.SQL_SERVER_USER || '',
        password: process.env.SQL_SERVER_PASSWORD || '',
        database: process.env.SQL_SERVER_DATABASE || '',
        options: {
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        connectionTimeout: 30000,
        requestTimeout: 30000,
      });

      const result = await pool.request().query(`
        SELECT DISTINCT
          KOBO as code,
          NOKOBO as name
        FROM TABBO
        WHERE KOBO IS NOT NULL AND KOBO != ''
        ORDER BY NOKOBO
      `);

      await pool.close();

      return result.recordset.map((row: any) => ({
        code: row.code || '',
        name: row.name || row.code || '',
      }));
    } catch (error: any) {
      console.error('Error fetching warehouses:', error.message);
      return [];
    }
  }

  async getBranches(): Promise<{ code: string; name: string }[]> {
    try {
      // Query unique branches from PostgreSQL inventory_products table
      const branches = await db
        .selectDistinct({
          code: inventoryProducts.sucursal,
        })
        .from(inventoryProducts)
        .where(
          and(
            isNotNull(inventoryProducts.sucursal),
            sql`${inventoryProducts.sucursal} != ''`
          )
        )
        .orderBy(inventoryProducts.sucursal);

      return branches.map((b) => ({
        code: b.code || '',
        name: b.code || '', // Using code as name since we don't have branch names
      }));
    } catch (error: any) {
      console.error('Error fetching branches from PostgreSQL:', error.message);
      return [];
    }
  }

  async getInventoryWithPrices(filters?: {
    search?: string;
    warehouse?: string;
    branch?: string;
  }): Promise<any[]> {
    // Create cache key from filters (sorted to ensure consistency)
    const cacheKey = JSON.stringify(filters || {}, Object.keys(filters || {}).sort());
    const now = Date.now();
    
    // Get or create cache entry for this filter key
    let cacheEntry = this.inventoryCacheMap.get(cacheKey);
    
    // Check if cache is valid (fresh data)
    if (cacheEntry && cacheEntry.data) {
      const cacheAge = now - cacheEntry.timestamp;
      if (cacheAge < this.INVENTORY_CACHE_TTL) {
        console.log(`📦 Inventory cache HIT for filters ${cacheKey.substring(0, 50)}... (age: ${Math.round(cacheAge / 1000)}s)`);
        return cacheEntry.data;
      } else {
        console.log(`⏰ Cache expired for filters ${cacheKey.substring(0, 50)}... (age: ${Math.round(cacheAge / 1000)}s)`);
      }
    }
    
    // If a query with these exact filters is already in progress, wait for it
    if (cacheEntry?.inFlightPromise) {
      console.log(`⏳ Inventory query with filters ${cacheKey.substring(0, 50)}... already in progress, waiting...`);
      return await cacheEntry.inFlightPromise;
    }
    
    // Start new query with mutex for this specific filter key
    console.log(`🔄 Inventory cache MISS for filters ${cacheKey.substring(0, 50)}..., fetching fresh data`);
    
    const queryPromise = (async () => {
      try {
        // Build where conditions
        const conditions = [eq(inventoryProducts.activo, true)];
        
        if (filters?.search) {
          conditions.push(
            or(
              sql`${inventoryProducts.sku} ILIKE ${`%${filters.search}%`}`,
              sql`${inventoryProducts.nombre} ILIKE ${`%${filters.search}%`}`
            )!
          );
        }

        if (filters?.warehouse && filters.warehouse !== 'all') {
          conditions.push(eq(inventoryProducts.bodega, filters.warehouse));
        }

        if (filters?.branch && filters.branch !== 'all') {
          conditions.push(eq(inventoryProducts.sucursal, filters.branch));
        }

        // Query inventory from PostgreSQL
        const inventory = await db
          .select()
          .from(inventoryProducts)
          .where(and(...conditions));

        // Map to frontend format
        const result = inventory.map((item) => ({
          branchCode: item.sucursal || '',
          productSku: item.sku,
          productName: item.nombre,
          warehouseCode: item.bodega || '',
          warehouseName: item.nombreBodega || item.bodega || '',
          stock1: parseFloat(item.stock1?.toString() || '0'),
          stock2: parseFloat(item.stock2?.toString() || '0'),
          quantity: parseFloat(item.stock2?.toString() || '0'),
          unit1: item.unidad1 || '',
          unit2: item.unidad2 || '',
          unit: item.unidad2 || '',
          reservedQuantity: 0,
          availableQuantity: parseFloat(item.stock2?.toString() || '0'),
          averagePrice: parseFloat(item.precioMedio?.toString() || '0'),
          totalValue: parseFloat(item.valorInventario?.toString() || '0'),
          lastUpdated: item.ultimaSincronizacion || new Date(),
        }));
        
        // Update cache for this filter key
        this.inventoryCacheMap.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          inFlightPromise: null,
        });
        
        console.log(`✅ Inventory fetched successfully (${result.length} items), cache updated for filters ${cacheKey.substring(0, 50)}...`);
        
        return result;
      } catch (error: any) {
        console.error('Error fetching inventory from PostgreSQL:', error.message);
        return [];
      } finally {
        // Release mutex for this filter key
        const entry = this.inventoryCacheMap.get(cacheKey);
        if (entry) {
          entry.inFlightPromise = null;
        }
      }
    })();
    
    // Store the in-flight promise for this filter key
    if (!cacheEntry) {
      this.inventoryCacheMap.set(cacheKey, {
        data: [],
        timestamp: 0,
        inFlightPromise: queryPromise,
      });
    } else {
      cacheEntry.inFlightPromise = queryPromise;
    }
    
    return await queryPromise;
  }

  // Legacy method for fallback
  private async getInventoryWithPricesLegacy(filters?: {
    search?: string;
    warehouse?: string;
    branch?: string;
  }): Promise<any[]> {
    try {
      const pool = await mssql.connect({
        server: process.env.SQL_SERVER_HOST || '',
        port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
        user: process.env.SQL_SERVER_USER || '',
        password: process.env.SQL_SERVER_PASSWORD || '',
        database: process.env.SQL_SERVER_DATABASE || '',
        options: {
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        connectionTimeout: 30000,
        requestTimeout: 30000,
      });

      let query = `
        SELECT 
          m.KOSU as branchCode,
          m.KOBO as warehouseCode,
          b.NOKOBO as warehouseName,
          m.KOPR as productSku,
          p.NOKOPR as productName,
          m.STFI1 as stock1,
          m.STFI2 as stock2,
          p.UD01PR as unit1,
          p.UD02PR as unit2,
          p.PM as averagePrice
        FROM MAEST m
        LEFT JOIN TABBO b ON m.KOBO = b.KOBO
        LEFT JOIN MAEPR p ON m.KOPR = p.KOPR
        WHERE (m.STFI1 > 0 OR m.STFI2 > 0)
      `;

      const params: any = [];

      if (filters?.search) {
        query += ` AND (m.KOPR LIKE @search OR p.NOKOPR LIKE @search)`;
        params.push({ name: 'search', value: `%${filters.search}%` });
      }

      if (filters?.warehouse && filters.warehouse !== 'all') {
        query += ` AND m.KOBO = @warehouse`;
        params.push({ name: 'warehouse', value: filters.warehouse });
      }

      if (filters?.branch && filters.branch !== 'all') {
        query += ` AND m.KOSU = @branch`;
        params.push({ name: 'branch', value: filters.branch });
      }

      query += ` ORDER BY m.KOSU, m.KOBO, m.KOPR`;

      const request = pool.request();
      params.forEach((param: any) => {
        request.input(param.name, mssql.NVarChar, param.value);
      });

      const result = await request.query(query);
      await pool.close();

      return result.recordset.map((row: any) => ({
        branchCode: row.branchCode || '',
        productSku: row.productSku || '',
        productName: row.productName || '',
        warehouseCode: row.warehouseCode || '',
        warehouseName: row.warehouseName || row.warehouseCode || '',
        stock1: parseFloat(row.stock1) || 0,
        stock2: parseFloat(row.stock2) || 0,
        quantity: parseFloat(row.stock2) || 0,
        unit1: row.unit1 || '',
        unit2: row.unit2 || '',
        unit: row.unit2 || '',
        reservedQuantity: 0,
        availableQuantity: parseFloat(row.stock2) || 0,
        averagePrice: parseFloat(row.averagePrice) || 0,
        totalValue: (parseFloat(row.stock1) || 0) * (parseFloat(row.averagePrice) || 0),
        lastUpdated: new Date(),
      }));
    } catch (error: any) {
      console.error('Error fetching inventory (legacy fallback):', error.message);
      return [];
    }
  }

  async getInventorySummaryWithPrices(filters?: {
    search?: string;
    warehouse?: string;
    branch?: string;
    hideNoStock?: boolean;
    hideZZProducts?: boolean;
  }): Promise<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    totalValue: number;
    lowStock: number;
  }> {
    let inventory = await this.getInventoryWithPrices(filters);
    
    // Apply client-side filters
    if (filters?.hideNoStock) {
      inventory = inventory.filter(item => item.availableQuantity > 0);
    }
    
    if (filters?.hideZZProducts) {
      inventory = inventory.filter(item => !item.productSku?.toUpperCase().startsWith('ZZ'));
    }
    
    const totalProducts = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalAvailable = inventory.reduce((sum, item) => sum + item.availableQuantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const lowStock = inventory.filter(item => item.availableQuantity < 10 && item.availableQuantity > 0).length;
    
    return {
      totalProducts,
      totalQuantity,
      totalAvailable,
      totalValue,
      lowStock,
    };
  }

  // ==================================================================================
  // INVENTORY SYNC operations
  // ==================================================================================

  private syncInProgress = false;

  async syncProductsFromERP(userId: string, userEmail: string): Promise<{
    status: 'success' | 'error' | 'partial';
    productsNew: number;
    productsUpdated: number;
    productsDeactivated: number;
    totalProcessed: number;
    duration: number;
    errorMessage?: string;
    summary: any;
  }> {
    // Check if sync is already in progress
    if (this.syncInProgress) {
      return {
        status: 'error',
        productsNew: 0,
        productsUpdated: 0,
        productsDeactivated: 0,
        totalProcessed: 0,
        duration: 0,
        errorMessage: 'Sincronización ya en progreso. Por favor espera a que termine.',
        summary: { error: 'Sync already in progress' },
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const startedAt = new Date();
    let pool: any = null;
    let connectionTimedOut = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      // Connect to SQL Server with proper timeout handling
      console.log('🔄 Conectando a SQL Server...');
      const connectionPromise = mssql.connect({
        server: process.env.SQL_SERVER_HOST || '',
        port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
        user: process.env.SQL_SERVER_USER || '',
        password: process.env.SQL_SERVER_PASSWORD || '',
        database: process.env.SQL_SERVER_DATABASE || '',
        options: {
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        connectionTimeout: 30000,
        requestTimeout: 120000, // 2 minutes for large queries
      });

      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          connectionTimedOut = true;
          reject(new Error('SQL Server connection timeout'));
        }, 35000);
      });

      pool = await Promise.race([connectionPromise, timeoutPromise]);

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      if (connectionTimedOut && pool) {
        try {
          await pool.close();
          pool = null;
        } catch (closeError) {
          console.error('Error closing pool after timeout:', closeError);
        }
        throw new Error('SQL Server connection timeout');
      }

      if (!pool) {
        throw new Error('SQL Server connection failed - pool is null');
      }

      console.log('✅ Conectado a SQL Server');

      // Fetch complete inventory from ERP (product × sucursal × bodega with stocks)
      console.log('📦 Extrayendo inventario completo desde ERP...');
      const result = await pool.request().query(`
        SELECT 
          m.KOPR as sku,
          m.KOSU as sucursal,
          m.KOBO as bodega,
          p.NOKOPR as nombre,
          b.NOKOBO as nombreBodega,
          p.UD01PR as unidad1,
          p.UD02PR as unidad2,
          p.FMPR as categoria,
          m.STFI1 as stock1,
          m.STFI2 as stock2,
          p.PM as precioMedio
        FROM MAEST m
        LEFT JOIN MAEPR p ON m.KOPR = p.KOPR
        LEFT JOIN TABBO b ON m.KOBO = b.KOBO
        WHERE m.KOPR IS NOT NULL 
          AND m.KOPR != ''
          AND (m.STFI1 > 0 OR m.STFI2 > 0)
        ORDER BY m.KOSU, m.KOBO, m.KOPR
      `);

      await pool.close();
      pool = null;

      const erpInventory = result.recordset;
      console.log(`📦 Extraídos ${erpInventory.length} registros de inventario desde ERP`);

      // Clear existing inventory data (full refresh approach)
      console.log('🗑️  Limpiando inventario anterior...');
      await db.delete(inventoryProducts);

      let recordsInserted = 0;
      const validationErrors: any[] = [];
      const BATCH_SIZE = 500;

      // Process in batches
      console.log(`📝 Procesando inventario en lotes de ${BATCH_SIZE}...`);
      for (let i = 0; i < erpInventory.length; i += BATCH_SIZE) {
        const batch = erpInventory.slice(i, i + BATCH_SIZE);
        const batchData: any[] = [];

        for (const row of batch) {
          const sku = row.sku?.toString()?.trim();
          const sucursal = row.sucursal?.toString()?.trim();
          const bodega = row.bodega?.toString()?.trim();

          if (!sku || !sucursal || !bodega) {
            validationErrors.push({
              sku: sku || 'N/A',
              sucursal: sucursal || 'N/A',
              bodega: bodega || 'N/A',
              error: 'Missing required fields (sku, sucursal, or bodega)',
            });
            continue;
          }

          const nombre = row.nombre?.toString()?.trim() || '';
          const nombreBodega = row.nombreBodega?.toString()?.trim() || null;
          const unidad1 = row.unidad1?.toString()?.trim() || null;
          const unidad2 = row.unidad2?.toString()?.trim() || null;
          const categoria = row.categoria?.toString()?.trim() || null;
          const stock1 = parseFloat(row.stock1) || 0;
          const stock2 = parseFloat(row.stock2) || 0;
          const precioMedio = row.precioMedio ? parseFloat(row.precioMedio) : null;

          // Calculate inventory value using UD1 (stock1)
          const valorInventario = precioMedio && stock1 
            ? parseFloat((stock1 * precioMedio).toFixed(2))
            : null;

          const inventoryRecord = {
            sku,
            sucursal,
            bodega,
            nombre,
            nombreBodega,
            unidad1,
            unidad2,
            categoria,
            stock1: stock1.toString(),
            stock2: stock2.toString(),
            precioMedio: precioMedio?.toString() || null,
            valorInventario: valorInventario?.toString() || null,
            activo: true,
            ultimaSincronizacion: new Date(),
            sincronizadoPor: userId,
          };

          // Validate data
          try {
            const validatedData = insertInventoryProductSchema.parse(inventoryRecord);
            batchData.push(validatedData);
          } catch (validationError: any) {
            validationErrors.push({
              sku,
              sucursal,
              bodega,
              error: validationError.message || 'Validation failed',
              details: validationError.errors || validationError,
            });
          }
        }

        // Insert batch
        if (batchData.length > 0) {
          await db.insert(inventoryProducts).values(batchData);
          recordsInserted += batchData.length;
          console.log(`  ✓ Insertados ${recordsInserted}/${erpInventory.length} registros...`);
        }
      }

      const duration = Date.now() - startTime;
      const syncStatus: 'success' | 'partial' = validationErrors.length > 0 ? 'partial' : 'success';

      // Log sync to audit table
      await db.insert(inventorySyncLog).values({
        userId,
        userEmail,
        status: syncStatus,
        productsNew: recordsInserted,
        productsUpdated: 0,
        productsDeactivated: 0,
        totalProcessed: recordsInserted,
        duration,
        summary: { 
          erpRecordCount: erpInventory.length,
          recordsInserted,
          validationErrors: validationErrors.slice(0, 50),
          validationErrorCount: validationErrors.length,
        },
        startedAt,
        completedAt: new Date(),
      });

      if (validationErrors.length > 0) {
        console.log(`⚠️ Sincronización completada con ${validationErrors.length} errores de validación: ${recordsInserted} registros insertados en ${duration}ms`);
      } else {
        console.log(`✅ Sincronización completada: ${recordsInserted} registros de inventario insertados en ${duration}ms`);
      }

      return {
        status: syncStatus,
        productsNew: recordsInserted,
        productsUpdated: 0,
        productsDeactivated: 0,
        totalProcessed: recordsInserted,
        duration,
        summary: {
          erpRecordCount: erpInventory.length,
          recordsInserted,
          validationErrors: validationErrors.slice(0, 50),
          validationErrorCount: validationErrors.length,
        },
      };
    } catch (error: any) {
      // Clear timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error('Error closing SQL Server connection:', closeError);
        }
      }

      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';

      console.error('❌ Sincronización fallida:', errorMessage);

      // Log failed sync
      try {
        await db.insert(inventorySyncLog).values({
          userId,
          userEmail,
          status: 'error',
          productsNew: 0,
          productsUpdated: 0,
          productsDeactivated: 0,
          totalProcessed: 0,
          duration,
          errorMessage,
          summary: { error: errorMessage },
          startedAt,
          completedAt: new Date(),
        });
      } catch (logError) {
        console.error('Failed to log sync error:', logError);
      }

      return {
        status: 'error',
        productsNew: 0,
        productsUpdated: 0,
        productsDeactivated: 0,
        totalProcessed: 0,
        duration,
        errorMessage,
        summary: { error: errorMessage },
      };
    } finally {
      // CRITICAL: Clear timeout for absolute guarantee (defense-in-depth)
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      
      // Always release the sync lock, regardless of success or failure
      this.syncInProgress = false;
    }
  }

  async getLastSync(): Promise<InventorySyncLog | null> {
    const [lastSync] = await db
      .select()
      .from(inventorySyncLog)
      .orderBy(desc(inventorySyncLog.createdAt))
      .limit(1);
    
    return lastSync || null;
  }

  async getSyncHistory(limit: number = 20): Promise<InventorySyncLog[]> {
    return db
      .select()
      .from(inventorySyncLog)
      .orderBy(desc(inventorySyncLog.createdAt))
      .limit(limit);
  }

  // ==================================================================================
  // SALES ETL SYNCHRONIZATION - SQL Server to PostgreSQL
  // ==================================================================================
  
  private salesSyncInProgress = false;

  async syncSalesFromERP(
    userId: string,
    userEmail: string,
    startDate: string,
    endDate: string,
    mode: 'incremental' | 'full' = 'incremental'
  ): Promise<{
    status: 'success' | 'error' | 'partial';
    recordsNew: number;
    recordsUpdated: number;
    totalProcessed: number;
    duration: number;
    errorMessage?: string;
    summary: any;
  }> {
    // Check if sync is already in progress
    if (this.salesSyncInProgress) {
      return {
        status: 'error',
        recordsNew: 0,
        recordsUpdated: 0,
        totalProcessed: 0,
        duration: 0,
        errorMessage: 'Sincronización ya en progreso. Por favor espera a que termine.',
        summary: { error: 'Sync already in progress' },
      };
    }

    this.salesSyncInProgress = true;
    const startTime = Date.now();
    const startedAt = new Date();
    let pool: any = null;

    try {
      console.log(`🔄 Iniciando sincronización ETL de ventas (${mode})`);
      console.log(`📅 Período: ${startDate} a ${endDate}`);

      // Connect to SQL Server
      console.log('🔄 Conectando a SQL Server ERP...');
      pool = await mssql.connect({
        server: process.env.SQL_SERVER_HOST || '',
        port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
        user: process.env.SQL_SERVER_USER || '',
        password: process.env.SQL_SERVER_PASSWORD || '',
        database: process.env.SQL_SERVER_DATABASE || '',
        options: {
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        connectionTimeout: 30000,
        requestTimeout: 180000, // 3 minutes for large queries
      });

      console.log('✅ Conectado a SQL Server');

      // Execute complete SQL query with all verified JOINs
      console.log('📦 Extrayendo transacciones de ventas desde ERP...');
      const result = await pool.request()
        .input('startDate', mssql.Date, new Date(startDate))
        .input('endDate', mssql.Date, new Date(endDate))
        .query(`
          SELECT 
            -- ENCABEZADO (MAEEDO - 17 campos)
            e.IDMAEEDO,
            e.TIDO,
            e.NUDO,
            e.ENDO,
            e.SUENDO,
            e.SUDO,
            e.FEEMDO,
            e.FEULVEDO,
            e.KOFUDO,
            e.MODO,
            e.TIMODO,
            e.TAMODO,
            e.CAPRAD,
            e.CAPREX,
            e.VANEDO,
            e.VAIVDO,
            e.VABRDO,
            
            -- DETALLE (MAEDDO - 40 campos)
            d.IDMAEDDO,
            d.LILG,
            d.NULIDO,
            d.SULIDO,
            d.LUVTLIDO,
            d.BOSULIDO,
            d.KOFULIDO,
            d.PRCT,
            d.TICT,
            d.TIPR,
            d.NUSEPR,
            d.KOPRCT,
            d.UDTRPR,
            d.RLUDPR,
            d.CAPRCO1,
            d.CAPRAD1,
            d.CAPREX1,
            d.CAPRNC1,
            d.UD01PR,
            d.CAPRCO2,
            d.CAPRAD2,
            d.CAPREX2,
            d.CAPRNC2,
            d.UD02PR,
            d.PPPRNE,
            d.PPPRBR,
            d.VANELI,
            d.VABRLI,
            d.FEEMLI,
            d.FEERLI,
            d.PPPRPM,
            d.PPPRPMIFRS,
            d.ESLIDO,
            d.PPPRNERE1,
            d.PPPRNERE2,
            
            -- CLASIFICACIÓN DE PRODUCTO (MAEPR - 5 campos)
            pr.FMPR,
            pr.MRPR,
            pr.PFPR,
            pr.HFPR,
            pr.RUPR as RUEN,
            pr.ZONAPR as ZONA,
            
            -- NOMBRES DESCRIPTIVOS (10 JOINs verificados)
            pr.NOKOPR as NOKOPRCT,
            cl.NOKOEN,
            ru.NOKORU as NORUEN,
            fu.NOKOFU,
            fu2.NOKOFU as NOKOFUDO,
            su.NOKOSU as NOSUDO,
            bo.NOKOBO as NOBOSULI,
            ISNULL(zo.NOKOZO, '') as NOKOZO,
            ISNULL(mr.NOKOMR, '') as NOMRPR,
            fm.NOKOFM as NOFMPR,
            pf.NOKOPF as NOPFPR,
            hf.NOKOHF as NOHFPR,
            
            -- CAMPOS CALCULADOS
            d.VANELI as MONTO,
            0 as LOGISTICA,
            0 as DEVOL1,
            0 as DEVOL2,
            0 as STOCKFIS,
            '' as LISTACOST,
            0 as LISCOSMOD,
            '' as OCDO,
            '' as RECAPRRE

          FROM MAEEDO e
          INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
          LEFT JOIN MAEPR pr ON d.KOPRCT = pr.KOPR
          LEFT JOIN MAEEN cl ON e.ENDO = cl.KOEN
          LEFT JOIN TABRU ru ON pr.RUPR = ru.KORU
          LEFT JOIN TABFU fu ON e.KOFUDO = fu.KOFU
          LEFT JOIN TABFU fu2 ON d.KOFULIDO = fu2.KOFU
          LEFT JOIN TABSU su ON e.SUDO = su.KOSU
          LEFT JOIN TABBO bo ON d.BOSULIDO = bo.KOBO
          LEFT JOIN TABZO zo ON pr.ZONAPR = zo.KOZO
          LEFT JOIN TABMR mr ON pr.MRPR = mr.KOMR
          LEFT JOIN TABFM fm ON pr.FMPR = fm.KOFM
          LEFT JOIN TABPF pf ON pr.PFPR = pf.KOPF
          LEFT JOIN TABHF hf ON pr.HFPR = hf.KOHF

          WHERE e.FEEMDO >= @startDate 
            AND e.FEEMDO <= @endDate
          ORDER BY e.IDMAEEDO, d.LILG
        `);

      await pool.close();
      pool = null;

      const erpSales = result.recordset;
      console.log(`📦 Extraídos ${erpSales.length} registros de ventas desde ERP`);

      let recordsNew = 0;
      let recordsUpdated = 0;
      const validationErrors: any[] = [];
      const BATCH_SIZE = 1000; // Reduced batch size to avoid stack overflow

      // Process in batches with UPSERT
      console.log(`📝 Procesando ventas en lotes de ${BATCH_SIZE}...`);
      for (let i = 0; i < erpSales.length; i += BATCH_SIZE) {
        const batch = erpSales.slice(i, i + BATCH_SIZE);
        const batchData: any[] = [];

        for (const row of batch) {
          try {
            // Helper function to safely convert to numeric string or null (preserves precision)
            const toNumeric = (val: any): string | null => {
              if (val === null || val === undefined || val === '') return null;
              // If already a number, convert to string
              if (typeof val === 'number') {
                if (isNaN(val) || !isFinite(val)) return null;
                return String(val);
              }
              // Validate string is numeric
              const str = String(val).trim();
              // Check if it's a valid number (integers or decimals, with optional negative sign)
              if (/^-?\d+(\.\d+)?$/.test(str)) {
                // Further validate it's parseable (not too large, etc)
                const num = parseFloat(str);
                if (isNaN(num) || !isFinite(num)) return null;
                return str; // Return original string to preserve precision
              }
              return null; // Invalid numeric values become null
            };

            // Helper function to safely convert to boolean
            const toBool = (val: any): boolean | null => {
              if (val === null || val === undefined || val === '') return null;
              if (typeof val === 'boolean') return val;
              const str = String(val).toLowerCase().trim();
              if (str === 'true' || str === '1') return true;
              if (str === 'false' || str === '0') return false;
              return null;
            };

            // Map SQL Server data to PostgreSQL schema with correct types
            const salesRecord = {
              // Primary keys - numeric
              idmaeedo: toNumeric(row.IDMAEEDO),
              idmaeddo: toNumeric(row.IDMAEDDO),
              // Text fields
              tido: row.TIDO?.toString()?.trim() || null,
              endo: row.ENDO?.toString()?.trim() || null,
              suendo: row.SUENDO?.toString()?.trim() || null,
              kofudo: row.KOFUDO?.toString()?.trim() || null,
              modo: row.MODO?.toString()?.trim() || null,
              timodo: row.TIMODO?.toString()?.trim() || null,
              lilg: row.LILG?.toString()?.trim() || null,
              kofulido: row.KOFULIDO?.toString()?.trim() || null,
              tipr: row.TIPR?.toString()?.trim() || null,
              koprct: row.KOPRCT?.toString()?.trim() || null,
              ud01pr: row.UD01PR?.toString()?.trim() || null,
              ud02pr: row.UD02PR?.toString()?.trim() || null,
              eslido: row.ESLIDO?.toString()?.trim() || null,
              ocdo: row.OCDO?.toString()?.trim() || null,
              // NO fields - text from JOINs
              nokoprct: row.NOKOPRCT?.toString()?.trim() || null,
              nokoen: row.NOKOEN?.toString()?.trim() || null,
              noruen: row.NORUEN?.toString()?.trim() || null,
              nokofu: row.NOKOFU?.toString()?.trim() || null,
              nokofudo: row.NOKOFUDO?.toString()?.trim() || null,
              nosudo: row.NOSUDO?.toString()?.trim() || null,
              nobosuli: row.NOBOSULI?.toString()?.trim() || null,
              nofmpr: row.NOFMPR?.toString()?.trim() || null,
              nopfpr: row.NOPFPR?.toString()?.trim() || null,
              nohfpr: row.NOHFPR?.toString()?.trim() || null,
              esdo: row.ESDO?.toString()?.trim() || null,
              espgdo: row.ESPGDO?.toString()?.trim() || null,
              // Numeric fields
              nudo: toNumeric(row.NUDO),
              sudo: toNumeric(row.SUDO),
              tamodo: toNumeric(row.TAMODO),
              caprad: toNumeric(row.CAPRAD),
              caprex: toNumeric(row.CAPREX),
              vanedo: toNumeric(row.VANEDO),
              vaivdo: toNumeric(row.VAIVDO),
              vabrdo: toNumeric(row.VABRDO),
              nulido: toNumeric(row.NULIDO),
              sulido: toNumeric(row.SULIDO),
              luvtlido: toNumeric(row.LUVTLIDO),
              bosulido: toNumeric(row.BOSULIDO),
              tict: toNumeric(row.TICT),
              nusepr: toNumeric(row.NUSEPR),
              udtrpr: toNumeric(row.UDTRPR),
              rludpr: toNumeric(row.RLUDPR),
              caprco1: toNumeric(row.CAPRCO1),
              caprad1: toNumeric(row.CAPRAD1),
              caprex1: toNumeric(row.CAPREX1),
              caprnc1: toNumeric(row.CAPRNC1),
              caprco2: toNumeric(row.CAPRCO2),
              caprad2: toNumeric(row.CAPRAD2),
              caprex2: toNumeric(row.CAPREX2),
              caprnc2: toNumeric(row.CAPRNC2),
              ppprne: toNumeric(row.PPPRNE),
              ppprbr: toNumeric(row.PPPRBR),
              vaneli: toNumeric(row.VANELI),
              vabrli: toNumeric(row.VABRLI),
              ppprpm: toNumeric(row.PPPRPM),
              ppprpmifrs: toNumeric(row.PPPRPMIFRS),
              logistica: toNumeric(row.LOGISTICA),
              ppprnere1: toNumeric(row.PPPRNERE1),
              ppprnere2: toNumeric(row.PPPRNERE2),
              fmpr: toNumeric(row.FMPR),
              mrpr: toNumeric(row.MRPR),
              zona: toNumeric(row.ZONA),
              ruen: toNumeric(row.RUEN),
              pfpr: toNumeric(row.PFPR),
              hfpr: toNumeric(row.HFPR),
              monto: toNumeric(row.MONTO),
              nokozo: toNumeric(row.NOKOZO),
              nomrpr: toNumeric(row.NOMRPR),
              devol1: toNumeric(row.DEVOL1),
              devol2: toNumeric(row.DEVOL2),
              stockfis: toNumeric(row.STOCKFIS),
              listacost: toNumeric(row.LISTACOST),
              liscosmod: toNumeric(row.LISCOSMOD),
              // Boolean fields
              prct: toBool(row.PRCT),
              recaprre: toBool(row.RECAPRRE),
              // Date fields
              feemdo: row.FEEMDO || null,
              feulvedo: row.FEULVEDO || null,
              feemli: row.FEEMLI || null,
              feerli: row.FEERLI || null,
              // Metadata
              dataSource: 'etl_sql_server',
              lastEtlSync: new Date(),
            };

            batchData.push(salesRecord);
          } catch (validationError: any) {
            validationErrors.push({
              idmaeedo: row.IDMAEEDO,
              idmaeddo: row.IDMAEDDO,
              error: validationError.message || 'Validation failed',
            });
          }
        }

        // UPSERT batch - process each record individually for reliability
        if (batchData.length > 0) {
          try {
            for (const record of batchData) {
              await db
                .insert(factVentas)
                .values(record as any)
                .onConflictDoUpdate({
                  target: [factVentas.idmaeedo, factVentas.idmaeddo],
                  set: record as any,
                });
            }

            recordsNew += batchData.length;
            if ((i + batchData.length) % 5000 === 0 || i + batchData.length === erpSales.length) {
              console.log(`  ✓ Procesados ${i + batchData.length}/${erpSales.length} registros...`);
            }
          } catch (batchError: any) {
            console.error(`Error en lote ${i}-${i + BATCH_SIZE}:`, batchError.message);
            validationErrors.push({
              batch: `${i}-${i + BATCH_SIZE}`,
              error: batchError.message,
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      const syncStatus: 'success' | 'partial' = validationErrors.length > 0 ? 'partial' : 'success';

      // Log sync to audit table
      await db.insert(salesEtlSyncLog).values({
        userId,
        userEmail,
        status: syncStatus,
        syncMode: mode,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        recordsNew,
        recordsUpdated: 0, // TODO: Implement actual count
        totalProcessed: erpSales.length,
        duration,
        summary: {
          erpRecordCount: erpSales.length,
          recordsNew,
          validationErrors: validationErrors.slice(0, 50),
          validationErrorCount: validationErrors.length,
        },
        startedAt,
        completedAt: new Date(),
      });

      console.log(`✅ Sincronización ETL completada: ${recordsNew} registros procesados en ${duration}ms`);

      return {
        status: syncStatus,
        recordsNew,
        recordsUpdated: 0,
        totalProcessed: erpSales.length,
        duration,
        summary: {
          erpRecordCount: erpSales.length,
          recordsNew,
          validationErrors: validationErrors.slice(0, 50),
          validationErrorCount: validationErrors.length,
        },
      };
    } catch (error: any) {
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error('Error closing SQL Server connection:', closeError);
        }
      }

      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';

      console.error('❌ Sincronización ETL fallida:', errorMessage);

      // Log failed sync
      try {
        await db.insert(salesEtlSyncLog).values({
          userId,
          userEmail,
          status: 'error',
          syncMode: mode,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          recordsNew: 0,
          recordsUpdated: 0,
          totalProcessed: 0,
          duration,
          errorMessage,
          summary: { error: errorMessage },
          startedAt,
          completedAt: new Date(),
        });
      } catch (logError) {
        console.error('Failed to log sync error:', logError);
      }

      return {
        status: 'error',
        recordsNew: 0,
        recordsUpdated: 0,
        totalProcessed: 0,
        duration,
        errorMessage,
        summary: { error: errorMessage },
      };
    } finally {
      this.salesSyncInProgress = false;
    }
  }

  async getLastSalesSync(): Promise<any> {
    const [lastSync] = await db
      .select()
      .from(salesEtlSyncLog)
      .orderBy(desc(salesEtlSyncLog.createdAt))
      .limit(1);
    
    return lastSync || null;
  }

  async getSalesSyncHistory(limit: number = 20): Promise<any[]> {
    return db
      .select()
      .from(salesEtlSyncLog)
      .orderBy(desc(salesEtlSyncLog.createdAt))
      .limit(limit);
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

    const count = gastos.length;
    
    const totalPendiente = gastos
      .filter(g => g.estado === 'pendiente')
      .reduce((sum, g) => sum + parseFloat(g.monto as any || '0'), 0);

    const totalAprobado = gastos
      .filter(g => g.estado === 'aprobado')
      .reduce((sum, g) => sum + parseFloat(g.monto as any || '0'), 0);

    const totalRechazado = gastos
      .filter(g => g.estado === 'rechazado')
      .reduce((sum, g) => sum + parseFloat(g.monto as any || '0'), 0);

    const total = gastos.reduce((sum, g) => sum + parseFloat(g.monto as any || '0'), 0);

    return {
      total,
      count,
      totalPendiente,
      totalAprobado,
      totalRechazado,
      totalGastos: count,
      totalAprobados: gastos.filter(g => g.estado === 'aprobado').length,
      totalPendientes: gastos.filter(g => g.estado === 'pendiente').length,
      totalRechazados: gastos.filter(g => g.estado === 'rechazado').length,
      montoPendiente: totalPendiente,
      montoAprobado: totalAprobado,
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

    const results = await db
      .select({
        categoria: gastosEmpresariales.categoria,
        total: sql<number>`SUM(${gastosEmpresariales.monto})`,
        cantidad: sql<number>`COUNT(*)`,
      })
      .from(gastosEmpresariales)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
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

  async getGastosEmpresarialesByDia(filters?: {
    userId?: string;
    mes?: number;
    anio?: number;
  }): Promise<Array<{
    dia: string;
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
        dia: sql<string>`TO_CHAR(${gastosEmpresariales.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`SUM(${gastosEmpresariales.monto})`,
        cantidad: sql<number>`COUNT(*)`,
      })
      .from(gastosEmpresariales)
      .where(and(...conditions))
      .groupBy(sql`TO_CHAR(${gastosEmpresariales.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`SUM(${gastosEmpresariales.monto}) DESC`)
      .limit(10); // Top 10 días más gastados

    return results.map(r => ({
      dia: r.dia,
      total: parseFloat(r.total as any) || 0,
      cantidad: parseInt(r.cantidad as any) || 0,
    }));
  }

  // ==================================================================================
  // GESTIÓN DE FONDOS operations
  // ==================================================================================

  async createFundAllocation(allocation: InsertFundAllocation): Promise<FundAllocation> {
    const [newAllocation] = await db.insert(fundAllocations).values(allocation).returning();
    
    // Crear movimiento inicial de asignación
    await db.insert(fundMovements).values({
      allocationId: newAllocation.id,
      tipoMovimiento: 'asignacion',
      monto: allocation.montoInicial.toString(),
      descripcion: `Asignación inicial de fondo: ${allocation.nombre}`,
      creadoPorId: allocation.assignedById,
    });
    
    return newAllocation;
  }

  async getFundAllocations(filters?: {
    assignedToId?: string;
    assignedById?: string;
    estado?: string;
    userScope?: string; // Shows: assignedTo=user OR (estado='solicitud' AND assignedById=user)
    limit?: number;
    offset?: number;
  }): Promise<(FundAllocation & { assignedByName?: string; assignedToName?: string })[]> {
    const conditions = [];

    // userScope: user sees funds assigned TO them + their own solicitudes
    if (filters?.userScope) {
      conditions.push(
        or(
          eq(fundAllocations.assignedToId, filters.userScope),
          and(
            eq(fundAllocations.estado, 'solicitud'),
            eq(fundAllocations.assignedById, filters.userScope)
          )
        )
      );
    } else {
      if (filters?.assignedToId) {
        conditions.push(eq(fundAllocations.assignedToId, filters.assignedToId));
      }

      if (filters?.assignedById) {
        conditions.push(eq(fundAllocations.assignedById, filters.assignedById));
      }
    }

    if (filters?.estado && !filters?.userScope) {
      conditions.push(eq(fundAllocations.estado, filters.estado));
    }

    const assignedByUser = aliasedTable(users, 'assigned_by_user');
    const assignedToUser = aliasedTable(users, 'assigned_to_user');

    let query = db
      .select({
        ...getTableColumns(fundAllocations),
        assignedByFirstName: assignedByUser.firstName,
        assignedByLastName: assignedByUser.lastName,
        assignedByEmail: assignedByUser.email,
        assignedToFirstName: assignedToUser.firstName,
        assignedToLastName: assignedToUser.lastName,
        assignedToEmail: assignedToUser.email,
      })
      .from(fundAllocations)
      .leftJoin(assignedByUser, eq(fundAllocations.assignedById, assignedByUser.id))
      .leftJoin(assignedToUser, eq(fundAllocations.assignedToId, assignedToUser.id))
      .orderBy(desc(fundAllocations.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const results = await query;
    
    return results.map(r => {
      const assignedByName = r.assignedByFirstName && r.assignedByLastName
        ? `${r.assignedByFirstName} ${r.assignedByLastName}`
        : r.assignedByFirstName || r.assignedByLastName || (r.assignedByEmail ? r.assignedByEmail.split('@')[0] : undefined);
      
      const assignedToName = r.assignedToFirstName && r.assignedToLastName
        ? `${r.assignedToFirstName} ${r.assignedToLastName}`
        : r.assignedToFirstName || r.assignedToLastName || (r.assignedToEmail ? r.assignedToEmail.split('@')[0] : undefined);

      const { assignedByFirstName, assignedByLastName, assignedByEmail, assignedToFirstName, assignedToLastName, assignedToEmail, ...fundData } = r;
      
      return {
        ...fundData,
        assignedByName,
        assignedToName,
      };
    });
  }

  async getFundAllocationById(id: string): Promise<FundAllocation | undefined> {
    const [allocation] = await db.select().from(fundAllocations).where(eq(fundAllocations.id, id));
    return allocation;
  }

  async updateFundAllocation(id: string, updates: Partial<InsertFundAllocation>): Promise<FundAllocation> {
    const [updated] = await db
      .update(fundAllocations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fundAllocations.id, id))
      .returning();
    return updated;
  }

  async closeFundAllocation(id: string): Promise<FundAllocation> {
    const [closed] = await db
      .update(fundAllocations)
      .set({ estado: 'cerrado', updatedAt: new Date() })
      .where(eq(fundAllocations.id, id))
      .returning();
    return closed;
  }

  async approveFundAllocation(id: string, comprobanteUrl: string, aprobadoPorId: string): Promise<FundAllocation> {
    const [approved] = await db
      .update(fundAllocations)
      .set({ 
        estado: 'activo', 
        comprobanteUrl,
        aprobadoPorId,
        fechaAprobacion: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(fundAllocations.id, id))
      .returning();
    return approved;
  }

  async rejectFundAllocation(id: string, motivoRechazo: string, rechazadoPorId: string): Promise<FundAllocation> {
    const [rejected] = await db
      .update(fundAllocations)
      .set({ 
        estado: 'rechazado', 
        motivoRechazo,
        aprobadoPorId: rechazadoPorId,
        fechaAprobacion: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(fundAllocations.id, id))
      .returning();
    return rejected;
  }

  async deleteFundAllocation(id: string): Promise<void> {
    await db.delete(fundMovements).where(eq(fundMovements.allocationId, id));
    await db.delete(fundAllocations).where(eq(fundAllocations.id, id));
  }

  async createFundMovement(movement: InsertFundMovement): Promise<FundMovement> {
    const [newMovement] = await db.insert(fundMovements).values(movement).returning();
    return newMovement;
  }

  async getFundMovements(allocationId: string): Promise<FundMovement[]> {
    return await db
      .select()
      .from(fundMovements)
      .where(eq(fundMovements.allocationId, allocationId))
      .orderBy(desc(fundMovements.createdAt));
  }

  async getFundAllocationBalance(allocationId: string): Promise<{
    montoInicial: number;
    totalComprometido: number;
    totalAprobado: number;
    saldoDisponible: number;
  }> {
    const allocation = await this.getFundAllocationById(allocationId);
    if (!allocation) {
      return { montoInicial: 0, totalComprometido: 0, totalAprobado: 0, saldoDisponible: 0 };
    }

    const montoInicial = parseFloat(allocation.montoInicial?.toString() || '0');

    // Obtener movimientos y calcular saldos
    const movements = await db
      .select({
        tipoMovimiento: fundMovements.tipoMovimiento,
        total: sql<number>`SUM(${fundMovements.monto})`,
      })
      .from(fundMovements)
      .where(eq(fundMovements.allocationId, allocationId))
      .groupBy(fundMovements.tipoMovimiento);

    let totalComprometido = 0;
    let totalAprobado = 0;
    let ajustes = 0;

    movements.forEach(m => {
      const monto = Math.abs(parseFloat(m.total?.toString() || '0'));
      switch (m.tipoMovimiento) {
        case 'gasto_pendiente':
          totalComprometido += monto;
          break;
        case 'gasto_aprobado':
          totalAprobado += monto;
          break;
        case 'ajuste':
          ajustes += parseFloat(m.total?.toString() || '0');
          break;
        case 'gasto_rechazado':
        case 'reintegro':
          // Estos liberan saldo
          break;
      }
    });

    const saldoDisponible = montoInicial + ajustes - totalComprometido - totalAprobado;

    return {
      montoInicial,
      totalComprometido,
      totalAprobado,
      saldoDisponible: Math.max(0, saldoDisponible),
    };
  }

  async getUserActiveFundAllocations(userId: string): Promise<Array<FundAllocation & { saldoDisponible: number }>> {
    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(
        and(
          eq(fundAllocations.assignedToId, userId),
          eq(fundAllocations.estado, 'activo')
        )
      )
      .orderBy(desc(fundAllocations.createdAt));

    const result = await Promise.all(
      allocations.map(async (allocation) => {
        const balance = await this.getFundAllocationBalance(allocation.id);
        return {
          ...allocation,
          saldoDisponible: balance.saldoDisponible,
        };
      })
    );

    return result;
  }

  async getFundAllocationSummary(userId?: string): Promise<{
    totalAsignado: number;
    totalComprometido: number;
    totalAprobado: number;
    saldoDisponible: number;
    asignacionesActivas: number;
  }> {
    const conditions = [eq(fundAllocations.estado, 'activo')];
    if (userId) {
      conditions.push(eq(fundAllocations.assignedToId, userId));
    }

    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(and(...conditions));

    let totalAsignado = 0;
    let totalComprometido = 0;
    let totalAprobado = 0;
    let saldoDisponible = 0;

    for (const allocation of allocations) {
      const balance = await this.getFundAllocationBalance(allocation.id);
      totalAsignado += balance.montoInicial;
      totalComprometido += balance.totalComprometido;
      totalAprobado += balance.totalAprobado;
      saldoDisponible += balance.saldoDisponible;
    }

    return {
      totalAsignado,
      totalComprometido,
      totalAprobado,
      saldoDisponible,
      asignacionesActivas: allocations.length,
    };
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
    vendedorIds?: string[]; // Array of vendor IDs for supervisor segment filtering
    semana?: string;
    anio?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    promesa: PromesaCompra;
    ventasReales: number;
    cumplimiento: number;
    estado: 'cumplido' | 'superado' | 'no_cumplido';
  }>> {
    const conditions = [];

    // Single vendedorId filter
    if (filters?.vendedorId) {
      conditions.push(eq(promesasCompra.vendedorId, filters.vendedorId));
    }
    
    // Multiple vendedorIds filter (for supervisor segment filtering)
    if (filters?.vendedorIds && filters.vendedorIds.length > 0 && !filters?.vendedorId) {
      conditions.push(inArray(promesasCompra.vendedorId, filters.vendedorIds));
    }

    // Use date range if provided, otherwise use semana/anio
    if (filters?.startDate && filters?.endDate) {
      // Filter promesas where the week overlaps with the provided date range
      conditions.push(
        and(
          lte(promesasCompra.fechaInicio, filters.endDate),
          gte(promesasCompra.fechaFin, filters.startDate)
        )
      );
    } else {
      if (filters?.semana) {
        conditions.push(eq(promesasCompra.semana, filters.semana));
      }

      if (filters?.anio) {
        conditions.push(eq(promesasCompra.anio, filters.anio));
      }
    }

    // Build WHERE conditions for raw SQL
    const whereParts = [];
    if (filters?.vendedorId) {
      whereParts.push(sql`p.vendedor_id = ${filters.vendedorId}`);
    }
    // Multiple vendedorIds filter for raw SQL
    if (filters?.vendedorIds && filters.vendedorIds.length > 0 && !filters?.vendedorId) {
      whereParts.push(sql`p.vendedor_id IN (${sql.join(filters.vendedorIds.map(id => sql`${id}`), sql`, `)})`);
    }
    if (filters?.startDate && filters?.endDate) {
      whereParts.push(sql`p.fecha_inicio <= ${filters.endDate}`);
      whereParts.push(sql`p.fecha_fin >= ${filters.startDate}`);
    } else {
      if (filters?.semana) {
        whereParts.push(sql`p.semana = ${filters.semana}`);
      }
      if (filters?.anio) {
        whereParts.push(sql`p.anio = ${filters.anio}`);
      }
    }

    // OPTIMIZED: Use LEFT JOIN with weekly_ventas_cliente to get pre-aggregated sales
    // NOTE: w.cliente_id and w.vendedor_id are actually client/vendor NAMES (nokoen/nokofu from fact_ventas)
    // We need to join with users table to get the vendor's firstName+lastName to match with weekly_ventas_cliente.vendedor_id
    const promesasConVentas = await db.execute(sql`
      SELECT 
        p.*,
        COALESCE(w.total_ventas, 0) as ventas_facturas_agregadas,
        w.cantidad_transacciones,
        COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Usuario') as vendedor_nombre_calculado
      FROM promesas_compra p
      LEFT JOIN users u ON p.vendedor_id = u.id
      LEFT JOIN ventas.weekly_ventas_cliente w 
        ON p.cliente_nombre = w.cliente_id
        AND UPPER(COALESCE(u.first_name || ' ' || u.last_name, u.email, '')) = UPPER(w.vendedor_id)
        AND p.semana = w.semana
      ${whereParts.length > 0 ? sql`WHERE ${sql.join(whereParts, sql` AND `)}` : sql``}
      ORDER BY p.semana DESC
    `);

    // Get all unique cliente+semana pairs for NVV lookup (only for non-potential clients)
    const clienteSemanas = (promesasConVentas.rows as any[])
      .filter(p => p.cliente_tipo !== 'potencial' && p.cliente_id !== 'PROSPECTO')
      .map(p => ({ nombre: p.cliente_nombre, fechaInicio: p.fecha_inicio, fechaFin: p.fecha_fin }));

    // OPTIMIZED: Batch fetch ALL NVV with a single query, then group in memory
    // Using nvv.fact_nvv (ETL data) instead of obsolete nvv_pending_sales
    const nvvMap = new Map<string, number>();
    if (clienteSemanas.length > 0) {
      // Build a single query with all cliente/fecha combinations
      const nvvConditions = clienteSemanas.map(cs => 
        sql`(nokoen = ${cs.nombre} AND feemli >= ${cs.fechaInicio} AND feemli <= ${cs.fechaFin})`
      );

      const ventasNvvBatch = await db.execute(sql`
        SELECT 
          nokoen as cliente,
          feemli as fecha,
          monto as total_pendiente
        FROM nvv.fact_nvv
        WHERE (eslido IS NULL OR eslido = '') 
          AND (${sql.join(nvvConditions, sql` OR `)})
      `);

      // Group results by cliente+fechaInicio+fechaFin in memory
      for (const row of ventasNvvBatch.rows as any[]) {
        const fecha = row.fecha;
        // Find which cliente+semana this row belongs to
        for (const cs of clienteSemanas) {
          if (row.cliente === cs.nombre && fecha >= cs.fechaInicio && fecha <= cs.fechaFin) {
            const key = `${cs.nombre}|${cs.fechaInicio}|${cs.fechaFin}`;
            const current = nvvMap.get(key) || 0;
            nvvMap.set(key, current + parseFloat(row.total_pendiente || '0'));
          }
        }
      }
    }

    const resultados = (promesasConVentas.rows as any[]).map((row) => {
      const promesa: PromesaCompra = {
        id: row.id,
        vendedorId: row.vendedor_id,
        clienteId: row.cliente_id,
        clienteNombre: row.cliente_nombre,
        clienteTipo: row.cliente_tipo,
        semana: row.semana,
        anio: row.anio,
        numeroSemana: row.numero_semana,
        fechaInicio: row.fecha_inicio,
        fechaFin: row.fecha_fin,
        montoPrometido: row.monto_prometido,
        ventasRealesManual: row.ventas_reales_manual,
        observaciones: row.observaciones,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      let ventasReales = 0;

      // Si hay ventas reales ingresadas manualmente, usar ese valor
      if (promesa.ventasRealesManual !== null && promesa.ventasRealesManual !== undefined) {
        ventasReales = parseFloat(promesa.ventasRealesManual as any);
      } 
      // Para clientes potenciales (PROSPECTO), no hay ventas reales automáticas
      else if (promesa.clienteTipo === 'potencial' || promesa.clienteId === 'PROSPECTO') {
        ventasReales = 0;
      }
      // Calcular ventas reales (facturas agregadas + NVV)
      else {
        const ventasFacturas = parseFloat(row.ventas_facturas_agregadas || '0');
        const key = `${promesa.clienteNombre}|${promesa.fechaInicio}|${promesa.fechaFin}`;
        const ventasNvv = nvvMap.get(key) || 0;
        ventasReales = ventasFacturas + ventasNvv;
      }

      const montoPrometido = parseFloat(promesa.montoPrometido as any);
      const cumplimiento = montoPrometido > 0 ? (ventasReales / montoPrometido) * 100 : 0;

      let estado: 'cumplido' | 'superado' | 'cumplido_parcialmente' | 'insuficiente' | 'no_cumplido';
      if (cumplimiento >= 100) {
        estado = cumplimiento > 100 ? 'superado' : 'cumplido';
      } else if (cumplimiento >= 80) {
        estado = 'cumplido_parcialmente';
      } else if (cumplimiento > 0) {
        estado = 'insuficiente';
      } else {
        estado = 'no_cumplido';
      }

      return {
        promesa,
        ventasReales,
        cumplimiento,
        estado,
      };
    });

    return resultados;
  }

  // ==================================================================================
  // ETL operations implementation
  // ==================================================================================

  async getRunningETLExecution(etlName: string): Promise<any | undefined> {
    if (etlName === 'nvv') {
      const result = await db.execute(sql`
        SELECT id, 'nvv' as etl_name, start_time, status, period, watermark_date
        FROM nvv.nvv_sync_log
        WHERE status = 'running'
        ORDER BY start_time DESC
        LIMIT 1
      `);
      return result.rows[0];
    }
    
    const result = await db.execute(sql`
      SELECT id, etl_name, start_time, status, period, watermark_date
      FROM ventas.etl_execution_log
      WHERE etl_name = ${etlName}
        AND status = 'running'
      ORDER BY start_time DESC
      LIMIT 1
    `);
    
    return result.rows[0];
  }

  async cancelETLExecution(executionId: string, cancelledBy: string, etlName?: string): Promise<void> {
    const now = new Date();
    const errorMessage = `Proceso cancelado manualmente por ${cancelledBy} el ${now.toLocaleString('es-CL')}`;
    
    if (etlName === 'nvv') {
      await db.execute(sql`
        UPDATE nvv.nvv_sync_log
        SET 
          status = 'cancelled',
          error_message = ${errorMessage},
          execution_time_ms = EXTRACT(EPOCH FROM (${now.toISOString()}::timestamp - start_time)) * 1000,
          end_time = ${now.toISOString()}::timestamp
        WHERE id = ${executionId}
      `);
      return;
    }
    
    await db.execute(sql`
      UPDATE ventas.etl_execution_log
      SET 
        status = 'cancelled',
        error_message = ${errorMessage},
        execution_time_ms = EXTRACT(EPOCH FROM (${now.toISOString()}::timestamp - start_time)) * 1000
      WHERE id = ${executionId}
    `);
  }

  async getLastSalesWatermark(): Promise<Date | null> {
    const result = await db
      .select({ endDate: salesEtlSyncLog.endDate })
      .from(salesEtlSyncLog)
      .where(eq(salesEtlSyncLog.status, 'success'))
      .orderBy(desc(salesEtlSyncLog.completedAt))
      .limit(1);
    
    return result[0]?.endDate || null;
  }

  // ==================================================================================
  // CRM Pipeline operations
  // ==================================================================================

  async getAllLeads(filters?: {
    salespersonId?: string;
    supervisorId?: string;
    segment?: string;
    stage?: string;
  }): Promise<CrmLead[]> {
    let query = db.select().from(crmLeads);
    const conditions = [];
    
    if (filters?.salespersonId) {
      conditions.push(eq(crmLeads.salespersonId, filters.salespersonId));
    }
    if (filters?.supervisorId) {
      conditions.push(eq(crmLeads.supervisorId, filters.supervisorId));
    }
    if (filters?.segment) {
      conditions.push(eq(crmLeads.segment, filters.segment));
    }
    if (filters?.stage) {
      conditions.push(eq(crmLeads.stage, filters.stage));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query.orderBy(desc(crmLeads.createdAt));
    return results;
  }

  async getLeadById(id: string): Promise<CrmLead | undefined> {
    const result = await db.select().from(crmLeads).where(eq(crmLeads.id, id)).limit(1);
    return result[0];
  }

  async createLead(lead: InsertCrmLead): Promise<CrmLead> {
    const [newLead] = await db.insert(crmLeads).values(lead).returning();
    
    // Notificar a admins y supervisors sobre nuevo lead
    const adminsAndSupervisors = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'supervisor')));
    
    const notificationPromises = adminsAndSupervisors.map(user =>
      this.createNotification({
        userId: user.id,
        type: 'crm_nuevo_lead',
        title: 'Nuevo Lead en CRM',
        message: `Nuevo lead creado: "${newLead.clientName}" - ${newLead.contactPerson}`,
        relatedReclamoId: null,
        read: false,
      })
    );
    
    await Promise.all(notificationPromises);
    
    return newLead;
  }

  async updateLead(id: string, updates: Partial<InsertCrmLead>): Promise<CrmLead | undefined> {
    const oldLead = await db.select().from(crmLeads).where(eq(crmLeads.id, id)).limit(1);
    
    const [updatedLead] = await db
      .update(crmLeads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmLeads.id, id))
      .returning();
    
    // Notificar si cambió la etapa o el assignee
    if (oldLead[0] && (updates.stageId !== undefined || updates.assignedTo !== undefined)) {
      const notificationPromises = [];
      
      // Notificar al asignado si cambió
      if (updates.assignedTo && updates.assignedTo !== oldLead[0].assignedTo) {
        notificationPromises.push(
          this.createNotification({
            userId: updates.assignedTo,
            type: 'crm_lead_asignado',
            title: 'Lead Asignado',
            message: `Se te asignó el lead: "${updatedLead.clientName}"`,
            relatedReclamoId: null,
            read: false,
          })
        );
      }
      
      // Notificar al asignado actual si cambió la etapa
      if (updates.stageId && updates.stageId !== oldLead[0].stageId && updatedLead.assignedTo) {
        notificationPromises.push(
          this.createNotification({
            userId: updatedLead.assignedTo,
            type: 'crm_lead_cambio_etapa',
            title: 'Cambio de Etapa en Lead',
            message: `El lead "${updatedLead.clientName}" cambió de etapa`,
            relatedReclamoId: null,
            read: false,
          })
        );
      }
      
      await Promise.all(notificationPromises);
    }
    
    return updatedLead;
  }

  async deleteLead(id: string): Promise<void> {
    // First delete all comments
    await db.delete(crmComments).where(eq(crmComments.leadId, id));
    // Then delete the lead
    await db.delete(crmLeads).where(eq(crmLeads.id, id));
  }

  async getCrmDashboardMetrics(filters?: { salespersonId?: string; supervisorId?: string; segment?: string }): Promise<{
    kpis: { totalLeads: number; closedLeads: number; conversionRate: number; avgDaysToClose: number };
    stageCounts: { stage: string; count: number }[];
    closuresBySalesperson: { salespersonName: string; closures: number; totalLeads: number }[];
    leadsTimeline: { month: string; newLeads: number; closures: number }[];
    agingBuckets: { bucket: string; count: number }[];
  }> {
    const conditions: any[] = [];
    
    if (filters?.salespersonId) {
      conditions.push(eq(crmLeads.salespersonId, filters.salespersonId));
    }
    if (filters?.supervisorId) {
      conditions.push(eq(crmLeads.supervisorId, filters.supervisorId));
    }
    if (filters?.segment) {
      conditions.push(eq(crmLeads.segment, filters.segment));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all leads with filters
    const allLeads = await db
      .select()
      .from(crmLeads)
      .where(whereClause);

    // KPIs - Consider both 'venta' and 'cerrado' as successful closures
    const closedStages = ['venta', 'cerrado'];
    const totalLeads = allLeads.length;
    const closedLeads = allLeads.filter(l => closedStages.includes(l.stage || '')).length;
    const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;
    
    // Average days to close (for closed leads)
    const closedLeadsWithDates = allLeads.filter(l => closedStages.includes(l.stage || '') && l.createdAt && l.updatedAt);
    let avgDaysToClose = 0;
    if (closedLeadsWithDates.length > 0) {
      const totalDays = closedLeadsWithDates.reduce((sum, lead) => {
        const created = new Date(lead.createdAt!);
        const updated = new Date(lead.updatedAt!);
        return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDaysToClose = Math.round(totalDays / closedLeadsWithDates.length);
    }

    // Stage counts
    const stageMap = new Map<string, number>();
    allLeads.forEach(lead => {
      const stage = lead.stage || 'lead';
      stageMap.set(stage, (stageMap.get(stage) || 0) + 1);
    });
    const stageCounts = Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count }));

    // Closures by salesperson
    const salespersonMap = new Map<string, { name: string; closures: number; total: number }>();
    allLeads.forEach(lead => {
      const name = lead.salespersonName || 'Sin asignar';
      if (!salespersonMap.has(name)) {
        salespersonMap.set(name, { name, closures: 0, total: 0 });
      }
      const entry = salespersonMap.get(name)!;
      entry.total++;
      if (closedStages.includes(lead.stage || '')) {
        entry.closures++;
      }
    });
    const closuresBySalesperson = Array.from(salespersonMap.values())
      .map(e => ({ salespersonName: e.name, closures: e.closures, totalLeads: e.total }))
      .sort((a, b) => b.closures - a.closures);

    // Leads timeline (last 6 months)
    const now = new Date();
    const leadsTimeline: { month: string; newLeads: number; closures: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthLabel = monthDate.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
      
      const newLeads = allLeads.filter(l => {
        if (!l.createdAt) return false;
        const created = new Date(l.createdAt);
        return created >= monthDate && created <= monthEnd;
      }).length;
      
      const closures = allLeads.filter(l => {
        if (!l.updatedAt || !closedStages.includes(l.stage || '')) return false;
        const updated = new Date(l.updatedAt);
        return updated >= monthDate && updated <= monthEnd;
      }).length;
      
      leadsTimeline.push({ month: monthLabel, newLeads, closures });
    }

    // Aging buckets (days since creation for non-closed leads)
    const agingBuckets = [
      { bucket: '0-7 días', count: 0 },
      { bucket: '8-14 días', count: 0 },
      { bucket: '15-30 días', count: 0 },
      { bucket: '31-60 días', count: 0 },
      { bucket: '+60 días', count: 0 },
    ];
    
    allLeads.filter(l => !closedStages.includes(l.stage || '') && l.stage !== 'perdido').forEach(lead => {
      if (!lead.createdAt) return;
      const days = Math.ceil((now.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 7) agingBuckets[0].count++;
      else if (days <= 14) agingBuckets[1].count++;
      else if (days <= 30) agingBuckets[2].count++;
      else if (days <= 60) agingBuckets[3].count++;
      else agingBuckets[4].count++;
    });

    return {
      kpis: { totalLeads, closedLeads, conversionRate, avgDaysToClose },
      stageCounts,
      closuresBySalesperson,
      leadsTimeline,
      agingBuckets,
    };
  }

  async getLeadComments(leadId: string): Promise<CrmComment[]> {
    const results = await db
      .select()
      .from(crmComments)
      .where(eq(crmComments.leadId, leadId))
      .orderBy(desc(crmComments.createdAt));
    return results;
  }

  async createLeadComment(comment: InsertCrmComment): Promise<CrmComment> {
    const [newComment] = await db.insert(crmComments).values(comment).returning();
    return newComment;
  }

  // CRM Stages Management
  async getAllStages(): Promise<CrmStage[]> {
    const results = await db
      .select()
      .from(crmStages)
      .where(eq(crmStages.isActive, true))
      .orderBy(asc(crmStages.order));
    return results;
  }

  async getAllStagesIncludingInactive(): Promise<CrmStage[]> {
    const results = await db
      .select()
      .from(crmStages)
      .orderBy(asc(crmStages.order));
    return results;
  }

  async getStageById(id: string): Promise<CrmStage | undefined> {
    const [result] = await db
      .select()
      .from(crmStages)
      .where(eq(crmStages.id, id));
    return result;
  }

  async createStage(stage: InsertCrmStage): Promise<CrmStage> {
    const [newStage] = await db.insert(crmStages).values(stage).returning();
    return newStage;
  }

  async updateStage(id: string, stage: Partial<InsertCrmStage>): Promise<CrmStage | undefined> {
    const [updated] = await db
      .update(crmStages)
      .set({ ...stage, updatedAt: new Date() })
      .where(eq(crmStages.id, id))
      .returning();
    return updated;
  }

  async deleteStage(id: string): Promise<void> {
    await db
      .update(crmStages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(crmStages.id, id));
  }

  async reorderStages(stageOrders: { id: string; order: number }[]): Promise<void> {
    for (const { id, order } of stageOrders) {
      await db
        .update(crmStages)
        .set({ order, updatedAt: new Date() })
        .where(eq(crmStages.id, id));
    }
  }

  async getCrmStats(filters?: {
    salespersonId?: string;
    supervisorId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalLeads: number;
    newLeads: number;
    callsCount: number;
    whatsappCount: number;
    byStage: Array<{ stage: string; count: number }>;
  }> {
    const conditions = [];
    
    if (filters?.salespersonId) {
      conditions.push(eq(crmLeads.salespersonId, filters.salespersonId));
    }
    if (filters?.supervisorId) {
      conditions.push(eq(crmLeads.supervisorId, filters.supervisorId));
    }
    if (filters?.startDate) {
      conditions.push(gte(crmLeads.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(crmLeads.createdAt, filters.endDate));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total leads
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmLeads)
      .where(whereClause);
    
    // Get new leads (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newLeadsConditions = [...(conditions || [])];
    newLeadsConditions.push(gte(crmLeads.createdAt, thirtyDaysAgo.toISOString()));
    
    const newLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmLeads)
      .where(and(...newLeadsConditions));
    
    // Get calls count
    const callsConditions = [...(conditions || [])];
    callsConditions.push(eq(crmLeads.hasCall, true));
    
    const callsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmLeads)
      .where(and(...callsConditions));
    
    // Get whatsapp count
    const whatsappConditions = [...(conditions || [])];
    whatsappConditions.push(eq(crmLeads.hasWhatsapp, true));
    
    const whatsappResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmLeads)
      .where(and(...whatsappConditions));
    
    // Get by stage
    const byStageResult = await db
      .select({
        stage: crmLeads.stage,
        count: sql<number>`count(*)`,
      })
      .from(crmLeads)
      .where(whereClause)
      .groupBy(crmLeads.stage);

    return {
      totalLeads: Number(totalResult[0]?.count || 0),
      newLeads: Number(newLeadsResult[0]?.count || 0),
      callsCount: Number(callsResult[0]?.count || 0),
      whatsappCount: Number(whatsappResult[0]?.count || 0),
      byStage: byStageResult.map(r => ({
        stage: r.stage || '',
        count: Number(r.count),
      })),
    };
  }

  // ============================================
  // CLIENTES INACTIVOS - INACTIVE CLIENTS ALERTS
  // ============================================

  async updateInactiveClients(): Promise<number> {
    try {
      // Detectar clientes con última compra >45 días pero <354 días
      const fortyFiveDaysAgo = new Date();
      fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
      
      // Cambiar de 365 a 354 días según requerimiento
      const threeHundredFiftyFourDaysAgo = new Date();
      threeHundredFiftyFourDaysAgo.setDate(threeHundredFiftyFourDaysAgo.getDate() - 354);

      // Consulta SQL para detectar clientes inactivos desde fact_ventas
      // NUEVO: Solo incluir clientes con más de 4 ventas en los últimos 354 días
      // Agrupar solo por cliente (nokoen) para contar todas sus ventas, no por vendedor/segmento
      const threeHundredFiftyFourDaysAgoStr = threeHundredFiftyFourDaysAgo.toISOString().split('T')[0];
      const fortyFiveDaysAgoStr = fortyFiveDaysAgo.toISOString().split('T')[0];
      
      const inactiveClientsQuery = await db.execute(sql`
        WITH client_stats AS (
          SELECT 
            fv.nokoen as client_name,
            fv.nokoen as client_koen,
            MAX(fv.feemdo) as last_purchase_date,
            CURRENT_DATE - MAX(fv.feemdo)::date as days_since_last_purchase,
            SUM(fv.vabrdo) as total_purchases_last_year,
            COUNT(*) as transaction_count
          FROM ventas.fact_ventas fv
          WHERE fv.feemdo >= ${sql.raw(`'${threeHundredFiftyFourDaysAgoStr}'::date`)}
          GROUP BY fv.nokoen
          HAVING MAX(fv.feemdo) < ${sql.raw(`'${fortyFiveDaysAgoStr}'::date`)}
            AND MAX(fv.feemdo) >= ${sql.raw(`'${threeHundredFiftyFourDaysAgoStr}'::date`)}
            AND COUNT(*) >= 4
        ),
        client_details AS (
          SELECT DISTINCT ON (cs.client_koen)
            cs.client_name,
            cs.client_koen,
            cs.last_purchase_date,
            cs.days_since_last_purchase,
            cs.total_purchases_last_year,
            fv.vabrdo as last_purchase_amount,
            fv.noruen as segment,
            fv.nokofu as salesperson_name
          FROM client_stats cs
          JOIN ventas.fact_ventas fv ON fv.nokoen = cs.client_koen AND fv.feemdo = cs.last_purchase_date
          ORDER BY cs.client_koen, fv.idmaeedo DESC
        )
        SELECT * FROM client_details
        ORDER BY days_since_last_purchase DESC
      `);

      const inactiveClients = inactiveClientsQuery.rows as any[];

      // UPSERT con ON CONFLICT para idempotencia
      // Primero, eliminar alertas de clientes que ya no están inactivos (pasaron más de 365 días o compraron recientemente)
      const currentKoens = inactiveClients.map(c => c.client_koen).filter(Boolean);
      
      if (currentKoens.length > 0) {
        await db
          .delete(clientesInactivos)
          .where(not(inArray(clientesInactivos.clientKoen, currentKoens)));
      } else {
        // Si no hay clientes inactivos, limpiar toda la tabla
        await db.delete(clientesInactivos);
      }

      // UPSERT de clientes inactivos actuales
      for (const client of inactiveClients) {
        // Buscar vendedor y supervisor asociado
        let salespersonId = null;
        let supervisorId = null;
        let supervisorName = null;

        // Buscar vendedor por nombre
        const salesperson = await db
          .select()
          .from(salespeopleUsers)
          .where(eq(salespeopleUsers.salespersonName, client.salesperson_name))
          .limit(1);

        if (salesperson.length > 0) {
          salespersonId = salesperson[0].id;
          
          // Si tiene vendedor, buscar su supervisor
          if (salesperson[0].supervisorId) {
            const supervisor = await db
              .select()
              .from(salespeopleUsers)
              .where(eq(salespeopleUsers.id, salesperson[0].supervisorId))
              .limit(1);
            
            if (supervisor.length > 0) {
              supervisorId = supervisor[0].id;
              supervisorName = supervisor[0].salespersonName;
            }
          }
        } else {
          // Si no se encontró vendedor por nombre, buscar por segmento
          if (client.segment) {
            const supervisorBySegment = await db
              .select()
              .from(salespeopleUsers)
              .where(
                and(
                  eq(salespeopleUsers.role, 'supervisor'),
                  eq(salespeopleUsers.assignedSegment, client.segment)
                )
              )
              .limit(1);

            if (supervisorBySegment.length > 0) {
              supervisorId = supervisorBySegment[0].id;
              supervisorName = supervisorBySegment[0].salespersonName;
            }
          }
        }

        // UPSERT manual: Primero intenta actualizar, luego inserta si no existe
        const existingClient = await db
          .select()
          .from(clientesInactivos)
          .where(eq(clientesInactivos.clientKoen, client.client_koen))
          .limit(1);

        if (existingClient.length > 0) {
          // Cliente ya existe, actualizarlo
          await db
            .update(clientesInactivos)
            .set({
              clientName: client.client_name,
              lastPurchaseDate: client.last_purchase_date ? new Date(client.last_purchase_date) : new Date(),
              lastPurchaseAmount: client.last_purchase_amount?.toString() || '0',
              daysSinceLastPurchase: parseInt(client.days_since_last_purchase) || 0,
              totalPurchasesLastYear: client.total_purchases_last_year?.toString() || '0',
              segment: client.segment,
              salespersonId,
              salespersonName: client.salesperson_name,
              supervisorId,
              supervisorName,
              updatedAt: new Date(),
            })
            .where(eq(clientesInactivos.clientKoen, client.client_koen));
        } else {
          // Cliente no existe, insertarlo
          await db.insert(clientesInactivos).values({
            clientName: client.client_name,
            clientKoen: client.client_koen,
            lastPurchaseDate: client.last_purchase_date ? new Date(client.last_purchase_date) : new Date(),
            lastPurchaseAmount: client.last_purchase_amount?.toString() || '0',
            daysSinceLastPurchase: parseInt(client.days_since_last_purchase) || 0,
            totalPurchasesLastYear: client.total_purchases_last_year?.toString() || '0',
            segment: client.segment,
            salespersonId,
            salespersonName: client.salesperson_name,
            supervisorId,
            supervisorName,
            addedToCrm: false,
            dismissed: false,
          });
        }
      }

      return inactiveClients.length;
    } catch (error: any) {
      console.error('Error updating inactive clients:', error.message);
      return 0;
    }
  }

  async getInactiveClients(filters?: {
    userId?: string;
    role?: string;
    includeDismissed?: boolean;
  }): Promise<ClienteInactivo[]> {
    try {
      const conditions = [];
      
      // No mostrar clientes ya añadidos al CRM
      conditions.push(eq(clientesInactivos.addedToCrm, false));

      // Filtrar por dismissed
      if (!filters?.includeDismissed) {
        conditions.push(eq(clientesInactivos.dismissed, false));
      }

      // FILTRADO POR ROL APLICADO DESDE EL SERVIDOR - NO CONFIAR EN QUERY PARAMS
      if (filters?.role && filters?.userId) {
        if (filters.role === 'salesperson') {
          // Vendedor solo ve sus clientes
          conditions.push(eq(clientesInactivos.salespersonId, filters.userId));
        } else if (filters.role === 'supervisor') {
          // Supervisor ve clientes de su segmento
          conditions.push(eq(clientesInactivos.supervisorId, filters.userId));
        }
        // Admin ve todos - no se añade condición adicional
      }

      // Obtener los nombres de clientes que ya existen en el CRM (crmLeads)
      const crmClientNames = await db
        .selectDistinct({ clientName: crmLeads.clientName })
        .from(crmLeads);
      
      const crmClientNameSet = new Set(crmClientNames.map(c => c.clientName.toLowerCase().trim()));
      
      // Solo buscar si hay clientes en el CRM
      if (crmClientNameSet.size === 0) {
        return [];
      }

      const results = await db
        .select()
        .from(clientesInactivos)
        .where(and(...conditions))
        .orderBy(desc(clientesInactivos.daysSinceLastPurchase));

      // Filtrar solo los clientes cuyo nombre existe en el CRM
      const filteredResults = results.filter(client => 
        crmClientNameSet.has(client.clientName.toLowerCase().trim())
      );

      return filteredResults;
    } catch (error: any) {
      console.error('Error getting inactive clients:', error.message);
      return [];
    }
  }

  async getInactiveClientById(id: string): Promise<ClienteInactivo | null> {
    try {
      const results = await db
        .select()
        .from(clientesInactivos)
        .where(eq(clientesInactivos.id, id))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      console.error('Error getting inactive client by id:', error.message);
      return null;
    }
  }

  async createLeadFromInactiveClient(
    inactiveClientId: string,
    leadData: InsertCrmLeadInput
  ): Promise<{ success: boolean; lead?: CrmLead; error?: string }> {
    try {
      // TRANSACTION: Create lead and mark inactive client as added atomically
      const result = await db.transaction(async (tx) => {
        // 1. Create the CRM lead
        const [newLead] = await tx
          .insert(crmLeads)
          .values(leadData)
          .returning();

        if (!newLead) {
          throw new Error("Failed to create lead");
        }

        // 2. Mark inactive client as added to CRM
        const updateResult = await tx
          .update(clientesInactivos)
          .set({ 
            addedToCrm: true,
            crmLeadId: newLead.id,
            updatedAt: new Date().toISOString()
          })
          .where(eq(clientesInactivos.id, inactiveClientId))
          .returning();

        if (updateResult.length === 0) {
          throw new Error("Failed to update inactive client record");
        }

        return newLead;
      });

      console.log(`[CRM] Successfully created lead from inactive client ${inactiveClientId}`);
      return { success: true, lead: result };
    } catch (error: any) {
      console.error(`[CRM] Transaction failed for inactive client ${inactiveClientId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async markInactiveClientAddedToCrm(id: string, leadId: string): Promise<boolean> {
    try {
      await db
        .update(clientesInactivos)
        .set({
          addedToCrm: true,
          crmLeadId: leadId,
          updatedAt: new Date(),
        })
        .where(eq(clientesInactivos.id, id));

      return true;
    } catch (error: any) {
      console.error('Error marking inactive client as added to CRM:', error.message);
      return false;
    }
  }

  async dismissInactiveClient(id: string): Promise<boolean> {
    try {
      await db
        .update(clientesInactivos)
        .set({
          dismissed: true,
          updatedAt: new Date(),
        })
        .where(eq(clientesInactivos.id, id));

      return true;
    } catch (error: any) {
      console.error('Error dismissing inactive client:', error.message);
      return false;
    }
  }

  // ==================================================================================
  // CLIENTES RECURRENTES (Seguimiento de Clientes)
  // ==================================================================================

  async getClientesRecurrentes(userId: string, role: string): Promise<any[]> {
    try {
      const conditions = [];
      
      // Filtrar por clientType = 'recurrente' (clientes que ya compraron)
      conditions.push(eq(crmLeads.clientType, 'recurrente'));
      
      // Filtrado por rol
      if (role === 'salesperson') {
        conditions.push(eq(crmLeads.salespersonId, userId));
      } else if (role === 'supervisor') {
        conditions.push(eq(crmLeads.supervisorId, userId));
      }
      // Admin ve todos
      
      const results = await db
        .select()
        .from(crmLeads)
        .where(and(...conditions))
        .orderBy(desc(crmLeads.updatedAt));
      
      // Parsear notas del campo notes (formato: [fecha] Usuario: contenido\n\n[fecha] Usuario: contenido)
      const parseNotes = (notesText: string | null): any[] => {
        if (!notesText) return [];
        
        // Dividir por doble salto de línea (separador entre notas)
        const noteEntries = notesText.split('\n\n').filter(entry => entry.trim());
        
        return noteEntries.map((entry, index) => {
          // Intentar parsear formato [fecha] Usuario: contenido
          const match = entry.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/s);
          if (match) {
            return {
              content: match[3].trim(),
              userName: match[2].trim(),
              createdAt: match[1].trim()
            };
          }
          // Si no coincide el formato, devolver como nota sin parsear
          return {
            content: entry.trim(),
            userName: 'Sistema',
            createdAt: new Date().toISOString()
          };
        });
      };

      // Calculate date ranges for purchase metrics
      const now = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(now.getMonth() - 12);
      const startDate12m = twelveMonthsAgo.toISOString().split('T')[0];
      
      // Fetch purchase metrics for all client names in results
      const clientNames = results.map(r => r.clientName).filter(Boolean);
      
      let purchaseMetrics: Record<string, any> = {};
      
      if (clientNames.length > 0) {
        // Get purchase stats from fact_ventas for last 12 months
        const metricsResults = await db
          .select({
            clientName: factVentas.nokoen,
            purchaseCount: sql<number>`COUNT(DISTINCT ${factVentas.idmaeedo})`,
            totalAmount: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
            lastPurchaseDate: sql<string>`MAX(${factVentas.feemdo})`,
            avgTicket: sql<number>`COALESCE(AVG(${factVentas.monto}), 0)`,
          })
          .from(factVentas)
          .where(and(
            sql`${factVentas.nokoen} IN (${sql.join(clientNames.map(n => sql`${n}`), sql`, `)})`,
            sql`${factVentas.feemdo} >= ${startDate12m}::date`,
            sql`${factVentas.tido} != 'GDV'`
          ))
          .groupBy(factVentas.nokoen);
        
        // Build metrics lookup
        for (const m of metricsResults) {
          const lastPurchase = m.lastPurchaseDate ? new Date(m.lastPurchaseDate) : null;
          const daysSinceLastPurchase = lastPurchase 
            ? Math.floor((now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          
          purchaseMetrics[m.clientName || ''] = {
            purchaseCount: Number(m.purchaseCount) || 0,
            totalAmount: Number(m.totalAmount) || 0,
            lastPurchaseDate: m.lastPurchaseDate,
            daysSinceLastPurchase,
            avgTicket: Number(m.avgTicket) || 0,
          };
        }
      }
      
      const clientesConNotas = results.map(lead => {
        const metrics = purchaseMetrics[lead.clientName] || {};
        return {
          id: lead.id,
          clientName: lead.clientName,
          company: lead.clientCompany,
          segment: lead.segment,
          salespersonId: lead.salespersonId,
          salespersonName: lead.salespersonName,
          lastPurchaseDate: metrics.lastPurchaseDate || lead.updatedAt,
          notes: parseNotes(lead.notes),
          // Purchase behavior metrics
          purchaseCount: metrics.purchaseCount || 0,
          totalAmount: metrics.totalAmount || 0,
          daysSinceLastPurchase: metrics.daysSinceLastPurchase,
          avgTicket: metrics.avgTicket || 0,
        };
      });
      
      // Sort by purchase count descending (most active first)
      clientesConNotas.sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0));
      
      return clientesConNotas;
    } catch (error: any) {
      console.error('Error getting clientes recurrentes:', error.message);
      return [];
    }
  }

  async addClienteRecurrenteNote(clientId: string, note: string, userId: string, userName: string): Promise<any> {
    try {
      // Obtener el lead actual
      const [lead] = await db
        .select()
        .from(crmLeads)
        .where(eq(crmLeads.id, clientId))
        .limit(1);
      
      if (!lead) {
        throw new Error('Cliente no encontrado');
      }
      
      // Agregar la nueva nota al campo notes (formato: [fecha] Usuario: nota)
      const timestamp = new Date().toISOString();
      const formattedNote = `[${new Date().toLocaleDateString('es-CL', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}] ${userName}: ${note}`;
      
      const updatedNotes = lead.notes 
        ? `${formattedNote}\n\n${lead.notes}`
        : formattedNote;
      
      await db
        .update(crmLeads)
        .set({ 
          notes: updatedNotes,
          updatedAt: new Date()
        })
        .where(eq(crmLeads.id, clientId));
      
      return { success: true, note: formattedNote };
    } catch (error: any) {
      console.error('Error adding cliente recurrente note:', error.message);
      throw error;
    }
  }

  async getSuggestedClientsForSeguimiento(userId: string, role: string, userSegment?: string | null, salespersonName?: string | null): Promise<any[]> {
    try {
      // Calculate 12 months ago
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const startDate = twelveMonthsAgo.toISOString().split('T')[0];

      // Build conditions based on role
      const conditions = [
        sql`${factVentas.nokoen} IS NOT NULL AND ${factVentas.nokoen} != ''`,
        sql`${factVentas.tido} != 'GDV'`,
        sql`${factVentas.feemdo} >= ${startDate}::date`
      ];

      // Role-based filtering
      if (role === 'salesperson' && salespersonName) {
        // Salespeople only see clients from their sales (using case-insensitive match)
        conditions.push(sql`UPPER(${factVentas.nokofu}) = UPPER(${salespersonName})`);
      } else if (role === 'supervisor') {
        // Supervisors see clients from their salespeople + their own if applicable
        const supervisedSalespeople = await db
          .select({ salespersonName: salespeopleUsers.salespersonName })
          .from(salespeopleUsers)
          .where(and(
            eq(salespeopleUsers.supervisorId, userId),
            eq(salespeopleUsers.role, 'salesperson'),
            eq(salespeopleUsers.isActive, true)
          ));
        
        const salespersonNames = supervisedSalespeople.map(sp => sp.salespersonName);
        if (salespersonName) {
          salespersonNames.push(salespersonName);
        }
        
        if (salespersonNames.length > 0) {
          conditions.push(sql`UPPER(${factVentas.nokofu}) IN (${sql.join(salespersonNames.map(n => sql`UPPER(${n})`), sql`, `)})`);
        }
      }
      // Admin sees all

      const whereClause = and(...conditions);

      // Get clients with purchase count, sorted by purchases descending
      const results = await db
        .select({
          clientName: factVentas.nokoen,
          segment: factVentas.noruen,
          salespersonName: factVentas.nokofu,
          purchaseCount: sql<number>`COUNT(DISTINCT ${factVentas.idmaeedo})`,
          lastPurchaseDate: sql<string>`MAX(${factVentas.feemdo})`,
          totalAmount: sql<number>`COALESCE(SUM(${factVentas.monto}), 0)`,
        })
        .from(factVentas)
        .where(whereClause)
        .groupBy(factVentas.nokoen, factVentas.noruen, factVentas.nokofu)
        .orderBy(sql`COUNT(DISTINCT ${factVentas.idmaeedo}) DESC`)
        .limit(100);

      return results.map(r => ({
        clientName: r.clientName || '',
        segment: r.segment || '',
        salespersonName: r.salespersonName || '',
        purchaseCount: Number(r.purchaseCount) || 0,
        lastPurchaseDate: r.lastPurchaseDate,
        totalAmount: Number(r.totalAmount) || 0,
      }));
    } catch (error: any) {
      console.error('Error getting suggested clients for seguimiento:', error.message);
      return [];
    }
  }

  // ==================================================================================
  // NOTIFICATIONS operations - Sistema robusto de notificaciones internas
  // ==================================================================================

  async createNotification(notification: InsertNotificationInput): Promise<Notification> {
    try {
      const [newNotification] = await db
        .insert(notifications)
        .values(notification)
        .returning();

      return newNotification;
    } catch (error: any) {
      console.error('Error creating notification:', error.message);
      throw error;
    }
  }

  async getNotificationsForUser(
    userId: string,
    userRole: string,
    userSegment?: string | null,
    filters?: {
      isArchived?: boolean;
      type?: string;
      priority?: string;
      department?: string;
    }
  ): Promise<Notification[]> {
    try {
      const conditions = [];

      // Filter by archived status
      if (filters?.isArchived !== undefined) {
        conditions.push(eq(notifications.isArchived, filters.isArchived));
      }

      // Filter by type
      if (filters?.type) {
        conditions.push(eq(notifications.type, filters.type));
      }

      // Filter by priority
      if (filters?.priority) {
        conditions.push(eq(notifications.priority, filters.priority));
      }

      // Filter by department
      if (filters?.department) {
        conditions.push(eq(notifications.department, filters.department));
      }

      // Filter based on targetType and user role/department
      // User sees:
      // 1. Personal notifications targeted to them
      // 2. General notifications (for everyone)
      // 3. Department notifications matching their department/role
      const targetConditions = [
        // Personal notifications for this user
        and(
          eq(notifications.targetType, 'personal'),
          eq(notifications.userId, userId)
        ),
        // General notifications for everyone
        eq(notifications.targetType, 'general'),
      ];

      // Map user role to departments they should see
      const userDepartments = this.getUserDepartments(userRole);
      if (userDepartments.length > 0) {
        userDepartments.forEach(dept => {
          targetConditions.push(
            and(
              eq(notifications.targetType, 'departamento'),
              eq(notifications.department, dept)
            )
          );
        });
      }

      conditions.push(or(...targetConditions));

      const results = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt));

      // For each notification, check if current user has read it
      const notificationsWithReadStatus = await Promise.all(
        results.map(async (notification) => {
          const [readRecord] = await db
            .select()
            .from(notificationReads)
            .where(
              and(
                eq(notificationReads.notificationId, notification.id),
                eq(notificationReads.userId, userId)
              )
            )
            .limit(1);

          return {
            ...notification,
            hasRead: !!readRecord,
          };
        })
      );

      return notificationsWithReadStatus as any;
    } catch (error: any) {
      console.error('Error fetching notifications for user:', error.message);
      return [];
    }
  }

  async getUnreadNotificationCount(userId: string, userRole: string, userSegment?: string | null): Promise<number> {
    try {
      // Get all notifications for user (non-archived)
      const userNotifications = await this.getNotificationsForUser(userId, userRole, userSegment, {
        isArchived: false,
      });

      // Count unread notifications
      const unreadCount = userNotifications.filter((n: any) => !n.hasRead).length;

      return unreadCount;
    } catch (error: any) {
      console.error('Error getting unread notification count:', error.message);
      return 0;
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      // Insert into notification_reads (upsert - ignore if already exists)
      await db
        .insert(notificationReads)
        .values({
          notificationId,
          userId,
        })
        .onConflictDoNothing();

      return true;
    } catch (error: any) {
      console.error('Error marking notification as read:', error.message);
      return false;
    }
  }

  async archiveNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      // Only allow archiving if user has permission (creator or admin)
      // For now, mark as read and update isArchived
      await this.markNotificationAsRead(notificationId, userId);

      await db
        .update(notifications)
        .set({
          isArchived: true,
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notifications.id, notificationId));

      return true;
    } catch (error: any) {
      console.error('Error archiving notification:', error.message);
      return false;
    }
  }

  async getNotificationReads(notificationId: string): Promise<Array<{
    userId: string;
    userName: string;
    readAt: Date;
  }>> {
    try {
      const reads = await db
        .select({
          userId: notificationReads.userId,
          readAt: notificationReads.readAt,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(notificationReads)
        .leftJoin(users, eq(notificationReads.userId, users.id))
        .where(eq(notificationReads.notificationId, notificationId))
        .orderBy(desc(notificationReads.readAt));

      return reads.map(read => ({
        userId: read.userId,
        userName: `${read.userFirstName || ''} ${read.userLastName || ''}`.trim() || read.userEmail || 'Usuario',
        readAt: read.readAt || new Date(),
      }));
    } catch (error: any) {
      console.error('Error fetching notification reads:', error.message);
      return [];
    }
  }

  // Helper method to map user roles to departments
  private getUserDepartments(userRole: string): string[] {
    const roleMapping: Record<string, string[]> = {
      'admin': ['laboratorio', 'logistica', 'finanzas', 'ventas', 'produccion', 'planificacion', 'bodega_materias_primas', 'area_produccion', 'area_logistica', 'area_aplicacion', 'area_materia_prima', 'area_colores', 'area_envase', 'area_etiqueta', 'reception'],
      'supervisor': ['ventas', 'logistica'],
      'logistica_bodega': ['logistica', 'bodega_materias_primas', 'area_logistica'],
      'bodega_materias_primas': ['bodega_materias_primas', 'area_materia_prima'],
      'salesperson': ['ventas'],
      'tecnico_obra': ['area_aplicacion'],
      'reception': ['reception'],
      'laboratorio': ['laboratorio'],
      'area_produccion': ['area_produccion', 'produccion'],
      'area_logistica': ['area_logistica', 'logistica'],
      'area_aplicacion': ['area_aplicacion'],
      'area_materia_prima': ['area_materia_prima'],
      'area_colores': ['area_colores'],
      'area_envase': ['area_envase'],
      'area_etiqueta': ['area_etiqueta'],
      'produccion': ['produccion', 'area_produccion'],
      'planificacion': ['planificacion'],
    };

    return roleMapping[userRole] || [];
  }

  // ============================================
  // API Keys Management
  // ============================================

  async createApiKey(data: InsertApiKeyInput & { keyHash: string; keyPrefix: string }): Promise<ApiKey> {
    const [apiKey] = await db
      .insert(apiKeys)
      .values(data)
      .returning();

    return apiKey;
  }

  async getApiKeys(createdBy?: string): Promise<ApiKey[]> {
    const conditions = [];
    
    if (createdBy) {
      conditions.push(eq(apiKeys.createdBy, createdBy));
    }

    const result = await db
      .select()
      .from(apiKeys)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(apiKeys.createdAt));

    return result;
  }

  async getApiKeyById(id: string): Promise<ApiKey | null> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id));

    return apiKey || null;
  }

  async updateApiKey(id: string, data: Partial<InsertApiKey>): Promise<ApiKey | null> {
    const [updated] = await db
      .update(apiKeys)
      .set({
        ...data,
      })
      .where(eq(apiKeys.id, id))
      .returning();

    return updated || null;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, id));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  async toggleApiKeyStatus(id: string, isActive: boolean): Promise<ApiKey | null> {
    const [updated] = await db
      .update(apiKeys)
      .set({ isActive })
      .where(eq(apiKeys.id, id))
      .returning();

    return updated || null;
  }

  // ============================================
  // Integrations (Meta Ads, Google Ads, etc.)
  // ============================================

  async getIntegrations(): Promise<Integration[]> {
    return await db
      .select()
      .from(integrations)
      .orderBy(desc(integrations.createdAt));
  }

  async getIntegrationById(id: string): Promise<Integration | null> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id));
    return integration || null;
  }

  async getActiveIntegration(platform: string): Promise<Integration | null> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(
        eq(integrations.platform, platform),
        eq(integrations.status, 'active')
      ))
      .orderBy(desc(integrations.createdAt))
      .limit(1);
    return integration || null;
  }

  async createIntegration(data: Omit<InsertIntegration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Integration> {
    // First, deactivate any existing integrations for the same platform
    await db
      .update(integrations)
      .set({ status: 'disconnected' })
      .where(and(
        eq(integrations.platform, data.platform),
        eq(integrations.status, 'active')
      ));

    const [integration] = await db
      .insert(integrations)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return integration;
  }

  async updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | null> {
    const [updated] = await db
      .update(integrations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id))
      .returning();
    return updated || null;
  }

  async deleteIntegration(id: string): Promise<boolean> {
    const result = await db
      .delete(integrations)
      .where(eq(integrations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ============================================
  // Proyecciones de Ventas - Manual Forecasting
  // ============================================

  async getHistoricoVentasPorAnio(filters?: {
    years?: number[];
    months?: number[];
    salespersonCode?: string;
    segment?: string;
    search?: string;
    limit?: number;
    offset?: number;
    onlyWithAllPeriods?: boolean;
    sortOrder?: string; // desc, asc, az, za
  }): Promise<{
    data: Array<{
      year: number;
      month?: number;
      salespersonCode: string;
      salespersonName: string;
      clientCode: string;
      clientName: string;
      segment: string;
      totalSales: number;
      purchaseFrequency: number;
    }>;
    total: number;
    totalClients: number;
  }> {
    try {
      // USE EXACTLY THE SAME FILTERING LOGIC AS DASHBOARD
      // Build conditions for sales_transactions query
      const salesConditions = [
        isNotNull(factVentas.nokofu),
        isNotNull(factVentas.nokoen),
        ne(factVentas.nokofu, '.'),
        sql`${factVentas.tido} != 'GDV'`
      ];

      // Add year filter if provided
      if (filters?.years && filters.years.length > 0) {
        const yearConditions = filters.years.map(year => 
          sql`EXTRACT(YEAR FROM ${factVentas.feemdo})::int = ${year}`
        );
        salesConditions.push(or(...yearConditions)!);
      }

      // SAME AS DASHBOARD: Filter by salesperson (line 2199)
      if (filters?.salespersonCode) {
        salesConditions.push(sql`${factVentas.nokofu} = ${filters.salespersonCode}`);
      }

      // SAME AS DASHBOARD: Filter by segment (line 2202)
      if (filters?.segment && filters.segment !== 'all') {
        salesConditions.push(sql`${factVentas.noruen} = ${filters.segment}`);
      }

      // Get sales data with filters applied
      const salesData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${factVentas.feemdo})::int`,
          clientName: factVentas.nokoen,
          salespersonCode: factVentas.nokofu,
          segment: factVentas.noruen,
          totalSales: sql<number>`SUM(${factVentas.monto})`,
          purchaseFrequency: sql<number>`COUNT(DISTINCT ${factVentas.nudo})`,
        })
        .from(factVentas)
        .where(and(...salesConditions))
        .groupBy(
          sql`EXTRACT(YEAR FROM ${factVentas.feemdo})`,
          factVentas.nokoen,
          factVentas.nokofu,
          factVentas.noruen
        );

      // Get unique clients with total sales
      const clientSalesMap = new Map<string, number>();
      salesData.forEach(s => {
        const currentTotal = clientSalesMap.get(s.clientName!) || 0;
        clientSalesMap.set(s.clientName!, currentTotal + Number(s.totalSales));
      });

      let uniqueClients = Array.from(clientSalesMap.keys());

      // Apply filter: only clients with sales in ALL selected years
      if (filters?.onlyWithAllPeriods && filters.years && filters.years.length > 1) {
        uniqueClients = uniqueClients.filter((clientName) => {
          // Get years where this client has sales
          const clientYears = new Set(
            salesData
              .filter(s => s.clientName === clientName)
              .map(s => s.year)
          );
          
          // Check if client has sales in ALL selected years
          return filters.years!.every(year => clientYears.has(year));
        });
      }

      // Apply search filter to client names
      let filteredClients = uniqueClients;
      if (filters?.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.trim().toLowerCase();
        filteredClients = uniqueClients.filter((clientName) =>
          clientName!.toLowerCase().includes(searchTerm)
        );
      }

      // Apply sorting
      const sortOrder = filters?.sortOrder || 'desc';
      filteredClients.sort((a, b) => {
        if (sortOrder === 'desc') {
          // Ventas: Mayor a Menor
          return (clientSalesMap.get(b) || 0) - (clientSalesMap.get(a) || 0);
        } else if (sortOrder === 'asc') {
          // Ventas: Menor a Mayor
          return (clientSalesMap.get(a) || 0) - (clientSalesMap.get(b) || 0);
        } else if (sortOrder === 'az') {
          // Nombre: A-Z
          return a.localeCompare(b);
        } else if (sortOrder === 'za') {
          // Nombre: Z-A
          return b.localeCompare(a);
        }
        // Default: desc
        return (clientSalesMap.get(b) || 0) - (clientSalesMap.get(a) || 0);
      });

      const totalClients = filteredClients.length;

      // Apply pagination to clients
      const limit = filters?.limit || 15;
      const offset = filters?.offset || 0;
      const paginatedClients = filteredClients.slice(offset, offset + limit);

      // Get monthly sales data for paginated clients
      const monthlySalesConditions = [
        isNotNull(factVentas.nokofu),
        isNotNull(factVentas.nokoen),
        ne(factVentas.nokofu, '.'),
        sql`${factVentas.tido} != 'GDV'`
      ];

      // Filter by paginated clients
      if (paginatedClients.length > 0) {
        const clientConditions = paginatedClients.map(client => 
          sql`${factVentas.nokoen} = ${client}`
        );
        monthlySalesConditions.push(or(...clientConditions)!);
      }

      // Add year filter
      if (filters?.years && filters.years.length > 0) {
        const yearConditions = filters.years.map(year => 
          sql`EXTRACT(YEAR FROM ${factVentas.feemdo})::int = ${year}`
        );
        monthlySalesConditions.push(or(...yearConditions)!);
      }

      // Add month filter if provided
      if (filters?.months && filters.months.length > 0) {
        const monthConditions = filters.months.map(month => 
          sql`EXTRACT(MONTH FROM ${factVentas.feemdo})::int = ${month}`
        );
        monthlySalesConditions.push(or(...monthConditions)!);
      }

      // Filter by salesperson if provided
      if (filters?.salespersonCode) {
        monthlySalesConditions.push(sql`${factVentas.nokofu} = ${filters.salespersonCode}`);
      }

      // Filter by segment if provided
      if (filters?.segment && filters.segment !== 'all') {
        monthlySalesConditions.push(sql`${factVentas.noruen} = ${filters.segment}`);
      }

      // Query for monthly breakdown (with month filter applied)
      const monthlySalesData = paginatedClients.length > 0 ? await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${factVentas.feemdo})::int`,
          month: sql<number>`EXTRACT(MONTH FROM ${factVentas.feemdo})::int`,
          clientName: factVentas.nokoen,
          salespersonCode: factVentas.nokofu,
          segment: factVentas.noruen,
          totalSales: sql<number>`SUM(${factVentas.monto})`,
          purchaseFrequency: sql<number>`COUNT(DISTINCT ${factVentas.nudo})`,
        })
        .from(factVentas)
        .where(and(...monthlySalesConditions))
        .groupBy(
          sql`EXTRACT(YEAR FROM ${factVentas.feemdo})`,
          sql`EXTRACT(MONTH FROM ${factVentas.feemdo})`,
          factVentas.nokoen,
          factVentas.nokofu,
          factVentas.noruen
        ) : [];

      // Generate results: ONLY monthly breakdown (frontend will calculate yearly totals)
      const allResults: any[] = [];

      // Add monthly breakdown rows (respecting month filter)
      monthlySalesData.forEach(monthlyData => {
        allResults.push({
          year: monthlyData.year,
          month: monthlyData.month,
          salespersonCode: monthlyData.salespersonCode || '',
          salespersonName: monthlyData.salespersonCode || '',
          clientCode: monthlyData.clientName!,
          clientName: monthlyData.clientName!,
          segment: monthlyData.segment || '',
          totalSales: Number(monthlyData.totalSales),
          purchaseFrequency: Number(monthlyData.purchaseFrequency),
        });
      });

      // Sort by year desc, then by total sales desc
      const results = allResults.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.totalSales - a.totalSales;
      });

      console.log(`📊 getHistoricoVentasPorAnio: Returning ${results.length} monthly records for ${paginatedClients.length} clients`);
      console.log(`   Pagination: totalClients=${totalClients}, limit=${limit}, offset=${offset}, filteredClients=${filteredClients.length}`);
      if (results.length > 0) {
        console.log(`   Sample: ${results[0].clientName} - ${results[0].year}/${results[0].month} = ${results[0].totalSales}`);
      }

      return {
        data: results,
        total: results.length,
        totalClients: totalClients
      };
    } catch (error: any) {
      console.error('Error fetching historical sales by year:', error.message);
      return { data: [], total: 0, totalClients: 0 };
    }
  }

  async getYearsWithData(): Promise<number[]> {
    try {
      // Get years from historical sales
      const salesYears = await db
        .selectDistinct({
          year: sql<number>`EXTRACT(YEAR FROM ${factVentas.feemdo})::int`,
        })
        .from(factVentas)
        .where(isNotNull(factVentas.feemdo))
        .orderBy(desc(sql<number>`EXTRACT(YEAR FROM ${factVentas.feemdo})::int`));

      // Get years from manual projections
      const projectionYears = await db
        .selectDistinct({
          year: proyeccionesVentas.year,
        })
        .from(proyeccionesVentas)
        .orderBy(desc(proyeccionesVentas.year));

      // Combine and deduplicate years
      const allYears = new Set([
        ...salesYears.map(r => r.year),
        ...projectionYears.map(r => r.year)
      ]);

      // Return sorted array (descending)
      return Array.from(allYears).sort((a, b) => b - a);
    } catch (error: any) {
      console.error('Error fetching years with data:', error.message);
      return [];
    }
  }

  async getSalespeopleList(): Promise<Array<{ code: string; name: string }>> {
    try {
      const results = await db
        .selectDistinct({
          name: factVentas.nokofu,
        })
        .from(factVentas)
        .where(
          and(
            isNotNull(factVentas.nokofu),
            sql`${factVentas.nokofu} != ''`,
            sql`${factVentas.nokofu} != '.'`
          )
        )
        .orderBy(factVentas.nokofu);

      return results.map(r => ({
        code: r.name!,
        name: r.name!,
      }));
    } catch (error: any) {
      console.error('Error fetching salespeople list:', error.message);
      return [];
    }
  }

  async getSalespeopleBySegment(segment: string): Promise<Array<{ id: string; code: string; name: string }>> {
    try {
      // First get salespeople names from ventas for this segment
      const salespeopleNames = await db
        .selectDistinct({
          name: factVentas.nokofu,
        })
        .from(factVentas)
        .where(
          and(
            isNotNull(factVentas.nokofu),
            sql`${factVentas.nokofu} != ''`,
            sql`${factVentas.nokofu} != '.'`,
            eq(factVentas.noruen, segment)
          )
        )
        .orderBy(factVentas.nokofu);

      const names = salespeopleNames.map(r => r.name!).filter(Boolean);
      
      if (names.length === 0) {
        return [];
      }

      // Now find the user IDs for these salespeople
      const usersResult = await db
        .select({
          id: salespeopleUsers.id,
          salespersonName: salespeopleUsers.salespersonName,
        })
        .from(salespeopleUsers)
        .where(
          and(
            inArray(salespeopleUsers.salespersonName, names),
            eq(salespeopleUsers.isActive, true)
          )
        );

      return usersResult.map(r => ({
        id: r.id,
        code: r.salespersonName,
        name: r.salespersonName,
      }));
    } catch (error: any) {
      console.error('Error fetching salespeople by segment:', error.message);
      return [];
    }
  }

  async getSegmentsList(): Promise<Array<{ code: string; name: string }>> {
    try {
      const results = await db
        .selectDistinct({
          segment: factVentas.noruen,
        })
        .from(factVentas)
        .where(
          and(
            isNotNull(factVentas.noruen),
            sql`TRIM(${factVentas.noruen}) != ''`
          )
        )
        .orderBy(factVentas.noruen);

      return results.map(r => ({
        code: r.segment!,
        name: r.segment!,
      }));
    } catch (error: any) {
      console.error('Error fetching segments list:', error.message);
      return [];
    }
  }

  async upsertProyeccionVenta(proyeccion: InsertProyeccionVentaInput): Promise<ProyeccionVenta> {
    // Check if a projection already exists
    const conditions = [
      eq(proyeccionesVentas.year, proyeccion.year),
      eq(proyeccionesVentas.salespersonCode, proyeccion.salespersonCode),
      eq(proyeccionesVentas.clientCode, proyeccion.clientCode),
    ];
    
    if (proyeccion.month) {
      conditions.push(eq(proyeccionesVentas.month, proyeccion.month));
    } else {
      conditions.push(isNull(proyeccionesVentas.month));
    }
    
    const existing = await db
      .select()
      .from(proyeccionesVentas)
      .where(and(...conditions))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing projection
      const [result] = await db
        .update(proyeccionesVentas)
        .set({
          projectedAmount: proyeccion.projectedAmount,
          salespersonName: proyeccion.salespersonName,
          clientName: proyeccion.clientName,
          segment: proyeccion.segment,
          updatedAt: new Date(),
        })
        .where(eq(proyeccionesVentas.id, existing[0].id))
        .returning();
      
      return result;
    } else {
      // Insert new projection
      const [result] = await db
        .insert(proyeccionesVentas)
        .values({
          ...proyeccion,
          updatedAt: new Date(),
        })
        .returning();
      
      return result;
    }
  }

  async getProyeccionesVentas(filters?: {
    years?: number[];
    months?: number[];
    salespersonCode?: string;
    segment?: string;
  }): Promise<ProyeccionVenta[]> {
    // Build conditions for the query
    const conditions = [];
    
    if (filters?.years && filters.years.length > 0) {
      conditions.push(inArray(proyeccionesVentas.year, filters.years));
    }
    
    // When filtering by months, include BOTH monthly projections AND annual projections (month=null)
    if (filters?.months && filters.months.length > 0) {
      conditions.push(
        or(
          inArray(proyeccionesVentas.month, filters.months),
          isNull(proyeccionesVentas.month)
        )!
      );
    }

    // Filter by salesperson if specified
    if (filters?.salespersonCode) {
      conditions.push(eq(proyeccionesVentas.salespersonCode, filters.salespersonCode));
    }

    // NOTE: Segment filtering is NOT applied in backend to avoid breaking save functionality
    // Segment filtering is done in frontend only

    const result = await db
      .select()
      .from(proyeccionesVentas)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(proyeccionesVentas.year), proyeccionesVentas.salespersonCode);

    return result;
  }

  async getProyeccionById(id: string): Promise<ProyeccionVenta | undefined> {
    const [result] = await db
      .select()
      .from(proyeccionesVentas)
      .where(eq(proyeccionesVentas.id, id))
      .limit(1);
    
    return result;
  }

  async deleteProyeccionVenta(id: string): Promise<void> {
    await db
      .delete(proyeccionesVentas)
      .where(eq(proyeccionesVentas.id, id));
  }

  // ==================================================================================
  // NOTIFICATION AUTOMATION METHODS
  // ==================================================================================

  async checkAndNotifyLowStock(): Promise<void> {
    try {
      console.log('[NOTIF] Iniciando verificación de stock bajo...');
      
      // Verificar si la tabla productStock existe consultando primero
      console.log('[NOTIF] Verificando existencia de tabla productStock...');
      
      let lowStockProducts;
      try {
        // Obtener todos los productos con stock bajo (stock < minStock)
        console.log('[NOTIF] Consultando productos con stock bajo...');
        lowStockProducts = await db
          .select({
            productSku: productStock.productSku,
            productName: productStock.productName,
            warehouseCode: productStock.warehouseCode,
            warehouseName: productStock.warehouseName,
            currentStock: productStock.currentStock,
            minStock: productStock.minStock,
          })
          .from(productStock)
          .where(
            and(
              isNotNull(productStock.minStock),
              sql`${productStock.currentStock} < ${productStock.minStock}`
            )
          );
        
        console.log(`[NOTIF] Query completada. Tipo: ${typeof lowStockProducts}, Array: ${Array.isArray(lowStockProducts)}, Length: ${lowStockProducts?.length}`);
      } catch (queryError: any) {
        console.error('[NOTIF] Error en query de stock bajo:', queryError.message);
        console.log('[NOTIF] La tabla productStock probablemente no existe o tiene un problema de esquema. Saltando verificación de stock bajo.');
        return;
      }

      // Validar que lowStockProducts sea un array válido
      if (!lowStockProducts || !Array.isArray(lowStockProducts) || lowStockProducts.length === 0) {
        console.log('[NOTIF] No hay productos con stock bajo o query devolvió datos inválidos');
        return;
      }

      console.log(`[NOTIF] Se encontraron ${lowStockProducts.length} productos con stock bajo`);

      // Agrupar por bodega para enviar una notificación consolidada por bodega
      const stockByWarehouse = lowStockProducts.reduce((acc, product) => {
        if (!product || !product.warehouseCode || !product.productSku) {
          return acc; // Skip invalid products
        }
        const key = product.warehouseCode;
        if (!acc[key]) {
          acc[key] = {
            warehouseName: product.warehouseName || product.warehouseCode || 'Sin nombre',
            products: []
          };
        }
        acc[key].products.push(product);
        return acc;
      }, {} as Record<string, { warehouseName: string; products: typeof lowStockProducts }>);

      // Validar que stockByWarehouse sea un objeto válido
      if (!stockByWarehouse || typeof stockByWarehouse !== 'object') {
        console.log('[NOTIF] Error agrupando productos por bodega');
        return;
      }

      // Obtener usuarios admin y de bodega
      const usersToNotify = await db
        .select({ id: users.id })
        .from(users)
        .where(or(
          eq(users.role, 'admin'),
          eq(users.role, 'bodega')
        ));

      // Validar que usersToNotify sea un array válido
      if (!usersToNotify || !Array.isArray(usersToNotify) || usersToNotify.length === 0) {
        console.log('[NOTIF] No hay usuarios admin o bodega para notificar');
        return;
      }

      const notificationPromises = [];

      // Crear notificaciones para cada bodega con stock bajo
      const warehouseEntries = Object.entries(stockByWarehouse);
      for (const [warehouseCode, data] of warehouseEntries) {
        if (!data || !data.products || data.products.length === 0) {
          continue; // Skip empty warehouses
        }
        const productCount = data.products.length;
        const productList = data.products
          .slice(0, 3)
          .filter(p => p && p.productName)
          .map(p => `${p.productName || 'Sin nombre'} (${p.currentStock || 0}/${p.minStock || 0})`)
          .join(', ');
        const moreText = productCount > 3 ? ` y ${productCount - 3} más` : '';

        for (const user of usersToNotify) {
          notificationPromises.push(
            this.createNotification({
              userId: user.id,
              type: 'stock_bajo',
              title: `Stock Bajo en ${data.warehouseName}`,
              message: `${productCount} producto(s) con stock bajo: ${productList}${moreText}`,
              relatedReclamoId: null,
              read: false,
            })
          );
        }
      }

      await Promise.all(notificationPromises);
      
      console.log(`[NOTIF] Stock bajo: ${lowStockProducts.length} productos, ${Object.keys(stockByWarehouse).length} bodegas notificadas`);
    } catch (error: any) {
      console.error('[NOTIF] Error checking low stock:', error.message);
    }
  }

  async notifyNewSale(saleData: { 
    clientName: string; 
    amount: number; 
    salesperson: string; 
    documentNumber: string;
  }): Promise<void> {
    try {
      // Notificar a admins y supervisors sobre venta nueva
      const adminsAndSupervisors = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.role, 'admin'), eq(users.role, 'supervisor')));

      const formattedAmount = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP'
      }).format(saleData.amount);

      const notificationPromises = adminsAndSupervisors.map(user =>
        this.createNotification({
          userId: user.id,
          type: 'venta_nueva',
          title: 'Nueva Venta Registrada',
          message: `${saleData.salesperson} vendió ${formattedAmount} a ${saleData.clientName} (Doc: ${saleData.documentNumber})`,
          relatedReclamoId: null,
          read: false,
        })
      );

      await Promise.all(notificationPromises);
    } catch (error: any) {
      console.error('[NOTIF] Error notifying new sale:', error.message);
    }
  }

  // Cache for vendor names mapping (TABFU SQL Server)
  private vendorNamesCache: Map<string, string> | null = null;
  private vendorNamesCacheTime: number = 0;
  private readonly VENDOR_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  async getVendorNamesMap(): Promise<Map<string, string>> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.vendorNamesCache && (now - this.vendorNamesCacheTime < this.VENDOR_CACHE_TTL)) {
      console.log(`[NVV MAPPING] Using cached TABFU mappings (${this.vendorNamesCache.size} entries)`);
      return this.vendorNamesCache;
    }

    // Fetch fresh data from SQL Server
    const kofulidoToNameMap = new Map<string, string>();
    let pool: mssql.ConnectionPool | undefined;
    
    try {
      pool = await mssql.connect({
        server: process.env.SQL_SERVER_HOST || '',
        port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
        user: process.env.SQL_SERVER_USER || '',
        password: process.env.SQL_SERVER_PASSWORD || '',
        database: process.env.SQL_SERVER_DATABASE || '',
        options: {
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
      });

      const result = await pool.request().query(`
        SELECT KOFU, NOKOFU 
        FROM dbo.TABFU 
        WHERE NOKOFU IS NOT NULL AND NOKOFU != ''
      `);
      
      result.recordset.forEach(row => {
        if (row.KOFU && row.NOKOFU) {
          kofulidoToNameMap.set(row.KOFU.trim(), row.NOKOFU.trim());
        }
      });
      
      // Update cache
      this.vendorNamesCache = kofulidoToNameMap;
      this.vendorNamesCacheTime = now;
      
      console.log(`[NVV MAPPING] Fetched and cached ${kofulidoToNameMap.size} salesperson mappings from SQL Server TABFU`);
    } catch (error) {
      console.error('[NVV MAPPING] Error fetching from SQL Server TABFU:', error);
      
      // If cache exists, use it as fallback
      if (this.vendorNamesCache) {
        const cacheAge = Math.round((now - this.vendorNamesCacheTime) / 1000 / 60);
        console.log(`[NVV MAPPING] Using stale cache as fallback (${this.vendorNamesCache.size} entries, ${cacheAge} minutes old)`);
        return this.vendorNamesCache;
      }
      
      console.warn('[NVV MAPPING] No cache available - using empty mapping (vendor codes will be displayed as-is)');
    } finally {
      // Always close the pool to prevent connection leaks
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error('[NVV MAPPING] Error closing SQL Server pool:', closeError);
        }
      }
    }
    
    return kofulidoToNameMap;
  }

  // GDV ETL operations
  async getGdvSyncHistory(limit: number = 20, offset: number = 0): Promise<GdvSyncLog[]> {
    const history = await db
      .select()
      .from(gdvSyncLog)
      .orderBy(desc(gdvSyncLog.startTime))
      .limit(limit)
      .offset(offset);
    
    return history;
  }

  async getGdvSummary(filters?: {
    startDate?: string;
    endDate?: string;
    sucursales?: string[];
  }): Promise<{
    totalGdvPendientes: number;
    montoPendiente: number;
    lineasPendientes: number;
  }> {
    try {
      // Solo mostrar GDV del mes actual (datos volátiles)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const dateFilter = firstDayOfMonth.toISOString().split('T')[0];
      
      const conditions: string[] = [];
      
      // Solo mostrar GDV pendientes (líneas abiertas con cantidad pendiente)
      conditions.push(`(eslido IS NULL OR eslido = '')`);
      conditions.push(`cantidad_pendiente = true`);
      conditions.push(`feemdo >= '${dateFilter}'`); // Solo mes actual
      
      if (filters?.startDate) {
        conditions.push(`feemdo >= '${filters.startDate}'`);
      }
      if (filters?.endDate) {
        conditions.push(`feemdo <= '${filters.endDate}'`);
      }
      if (filters?.sucursales && filters.sucursales.length > 0) {
        conditions.push(`sudo IN (${filters.sucursales.join(',')})`);
      }
      
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = sql.raw(`
        SELECT 
          COUNT(DISTINCT idmaeedo) as total_documentos,
          COUNT(*) as total_lineas,
          COALESCE(SUM(vaneli::numeric), 0) as monto_pendiente
        FROM gdv.fact_gdv
        ${whereClause}
      `);

      const result = await db.execute(query);
      const row = result.rows[0] as any;
      
      return {
        totalGdvPendientes: Number(row?.total_documentos || 0),
        montoPendiente: Number(row?.monto_pendiente || 0),
        lineasPendientes: Number(row?.total_lineas || 0),
      };
    } catch (error) {
      console.error('[getGdvSummary] Error:', error);
      throw error;
    }
  }

  async getGdvByVendedor(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    codigoVendedor: string;
    nombreVendedor: string;
    totalGdvPendientes: number;
    lineasPendientes: number;
    montoPendiente: number;
  }>> {
    try {
      // Solo mostrar GDV del mes actual (datos volátiles)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const dateFilter = firstDayOfMonth.toISOString().split('T')[0];
      
      const conditions: string[] = [];
      
      // Solo mostrar GDV pendientes (líneas abiertas con cantidad pendiente)
      conditions.push(`(eslido IS NULL OR eslido = '')`);
      conditions.push(`cantidad_pendiente = true`);
      conditions.push(`feemdo >= '${dateFilter}'`); // Solo mes actual
      
      if (filters?.startDate) {
        conditions.push(`feemdo >= '${filters.startDate}'`);
      }
      if (filters?.endDate) {
        conditions.push(`feemdo <= '${filters.endDate}'`);
      }
      
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = sql.raw(`
        SELECT 
          COALESCE(kofulido, 'SIN VENDEDOR') as codigo_vendedor,
          COALESCE(nokofu, 'Sin vendedor asignado') as nombre_vendedor,
          COUNT(DISTINCT idmaeedo) as total_documentos,
          COUNT(*) as total_lineas,
          COALESCE(SUM(vaneli::numeric), 0) as monto_pendiente
        FROM gdv.fact_gdv
        ${whereClause}
        GROUP BY kofulido, nokofu
        ORDER BY monto_pendiente DESC
      `);

      const result = await db.execute(query);

      return result.rows.map((row: any) => ({
        codigoVendedor: String(row?.codigo_vendedor || 'SIN VENDEDOR'),
        nombreVendedor: String(row?.nombre_vendedor || 'Sin vendedor asignado'),
        totalGdvPendientes: Number(row?.total_documentos || 0),
        lineasPendientes: Number(row?.total_lineas || 0),
        montoPendiente: Number(row?.monto_pendiente || 0),
      }));
    } catch (error) {
      console.error('[getGdvByVendedor] Error:', error);
      throw error;
    }
  }

  async getGdvBySalesperson(salesperson: string): Promise<Array<{
    numeroGuia: string;
    fecha: string;
    cliente: string;
    codigoCliente: string;
    producto: string;
    cantidad: number;
    monto: number;
  }>> {
    try {
      // Solo mostrar GDV del mes actual (datos volátiles)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const dateFilter = firstDayOfMonth.toISOString().split('T')[0];
      
      const query = sql.raw(`
        SELECT 
          COALESCE(nudo::text, '') as numero_guia,
          COALESCE(feemdo::text, '') as fecha,
          COALESCE(nokoen, 'Sin cliente') as cliente,
          COALESCE(endo, '') as codigo_cliente,
          COALESCE(nokoprct, 'Sin producto') as producto,
          COALESCE(caprco2::numeric, 0) as cantidad,
          COALESCE(vaneli::numeric, 0) as monto
        FROM gdv.fact_gdv
        WHERE (eslido IS NULL OR eslido = '')
          AND cantidad_pendiente = true
          AND feemdo >= '${dateFilter}'
          AND UPPER(TRIM(nokofu)) = UPPER(TRIM('${salesperson.replace(/'/g, "''")}'))
        ORDER BY feemdo DESC, vaneli DESC
      `);

      const result = await db.execute(query);

      return result.rows.map((row: any) => ({
        numeroGuia: String(row?.numero_guia || ''),
        fecha: String(row?.fecha || ''),
        cliente: String(row?.cliente || 'Sin cliente'),
        codigoCliente: String(row?.codigo_cliente || ''),
        producto: String(row?.producto || 'Sin producto'),
        cantidad: Number(row?.cantidad || 0),
        monto: Number(row?.monto || 0),
      }));
    } catch (error) {
      console.error('[getGdvBySalesperson] Error:', error);
      throw error;
    }
  }

  async getGdvPendingRecords(limit: number = 500): Promise<Array<{
    numeroGuia: string;
    fecha: string;
    cliente: string;
    vendedor: string;
    sucursal: string;
    producto: string;
    cantidad: number;
    monto: number;
  }>> {
    try {
      // Solo mostrar GDV del mes actual (datos volátiles)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const dateFilter = firstDayOfMonth.toISOString().split('T')[0];
      
      const query = sql.raw(`
        SELECT 
          COALESCE(nudo::text, '') as numero_guia,
          COALESCE(feemdo::text, '') as fecha,
          COALESCE(nokoen, 'Sin cliente') as cliente,
          COALESCE(nokofu, 'Sin vendedor') as vendedor,
          COALESCE(nosudo, '') as sucursal,
          COALESCE(nokoprct, 'Sin producto') as producto,
          COALESCE(caprco2::numeric, 0) as cantidad,
          COALESCE(vaneli::numeric, 0) as monto
        FROM gdv.fact_gdv
        WHERE (eslido IS NULL OR eslido = '')
          AND cantidad_pendiente = true
          AND feemdo >= '${dateFilter}'
        ORDER BY feemdo DESC, vaneli DESC
        LIMIT ${limit}
      `);

      const result = await db.execute(query);

      return result.rows.map((row: any) => ({
        numeroGuia: String(row?.numero_guia || ''),
        fecha: String(row?.fecha || ''),
        cliente: String(row?.cliente || 'Sin cliente'),
        vendedor: String(row?.vendedor || 'Sin vendedor'),
        sucursal: String(row?.sucursal || ''),
        producto: String(row?.producto || 'Sin producto'),
        cantidad: Number(row?.cantidad || 0),
        monto: Number(row?.monto || 0),
      }));
    } catch (error) {
      console.error('[getGdvPendingRecords] Error:', error);
      throw error;
    }
  }

  // NVV ETL operations
  async getNvvSyncHistory(limit: number = 20, offset: number = 0): Promise<NvvSyncLog[]> {
    const history = await db
      .select()
      .from(nvvSyncLog)
      .orderBy(desc(nvvSyncLog.startTime))
      .limit(limit)
      .offset(offset);
    
    return history;
  }

  async getNvvStateChanges(params: { executionId?: string; limit?: number; offset?: number }) {
    const { executionId, limit = 50, offset = 0 } = params;

    // Build SQL query with CTE for filtering + join
    const query = sql`
      WITH changes_filtered AS (
        SELECT 
          c.id,
          c.execution_id,
          c.idmaeedo,
          c.nudo,
          c.sudo,
          c.change_type,
          c.previous_status,
          c.new_status,
          c.monto,
          c.changed_at,
          l.start_time as execution_start_time,
          l.end_time as execution_end_time,
          l.watermark_start,
          l.watermark_end
        FROM nvv.nvv_sync_changes c
        INNER JOIN nvv.nvv_sync_log l ON c.execution_id = l.id
        WHERE (${executionId}::uuid IS NULL OR c.execution_id = ${executionId}::uuid)
      )
      SELECT * FROM changes_filtered
      ORDER BY changed_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countQuery = sql`
      WITH changes_filtered AS (
        SELECT c.id
        FROM nvv.nvv_sync_changes c
        WHERE (${executionId}::uuid IS NULL OR c.execution_id = ${executionId}::uuid)
      )
      SELECT COUNT(*) as count FROM changes_filtered
    `;

    const [changes, countResult] = await Promise.all([
      db.execute(query),
      db.execute(countQuery)
    ]);

    const total = Number(countResult.rows[0]?.count || 0);

    return {
      changes: changes.rows.map((row: any) => ({
        id: row.id,
        executionId: row.execution_id,
        idmaeedo: row.idmaeedo,
        nudo: row.nudo,
        sudo: row.sudo,
        changeType: row.change_type,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        monto: row.monto,
        changedAt: new Date(row.changed_at),
        executionStartTime: row.execution_start_time ? new Date(row.execution_start_time) : null,
        executionEndTime: row.execution_end_time ? new Date(row.execution_end_time) : null,
        watermarkStart: row.watermark_start,
        watermarkEnd: row.watermark_end
      })),
      total,
      limit,
      offset
    };
  }

  async getNvvSummary(filters?: NvvFilters): Promise<{
    totalNvv: number;
    totalAbiertas: number;
    totalCerradas: number;
    totalPendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }> {
    let query = db.select({
      total: countDistinct(factNvv.idmaeedo),
      abiertas: sql<number>`COUNT(DISTINCT CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.idmaeedo} END)`,
      cerradas: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.idmaeedo} END)`,
      pendientes: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.idmaeedo} END)`,
      montoTotal: sum(factNvv.monto),
      montoAbiertas: sql<number>`SUM(CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.monto} ELSE 0 END)`,
      montoCerradas: sql<number>`SUM(CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.monto} ELSE 0 END)`,
      montoPendientes: sql<number>`SUM(CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.monto} ELSE 0 END)`,
    }).from(factNvv);

    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`${factNvv.feemdo} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${factNvv.feemdo} <= ${filters.endDate}`);
    }
    if (filters?.sucursales && filters.sucursales.length > 0) {
      conditions.push(inArray(factNvv.sudo, filters.sucursales));
    }
    if (filters?.vendedores && filters.vendedores.length > 0) {
      conditions.push(inArray(factNvv.kofulido, filters.vendedores));
    }
    if (filters?.bodegas && filters.bodegas.length > 0) {
      conditions.push(inArray(factNvv.bosulido, filters.bodegas));
    }
    if (filters?.estado === 'open') {
      conditions.push(sql`(${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '')`);
    } else if (filters?.estado === 'closed') {
      conditions.push(sql`${factNvv.eslido} = 'C'`);
    }
    if (filters?.pendingOnly) {
      conditions.push(eq(factNvv.cantidad_pendiente, true));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} >= ${filters.minAmount}`);
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} <= ${filters.maxAmount}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    
    return {
      totalNvv: Number(result[0]?.total || 0),
      totalAbiertas: Number(result[0]?.abiertas || 0),
      totalCerradas: Number(result[0]?.cerradas || 0),
      totalPendientes: Number(result[0]?.pendientes || 0),
      montoTotal: Number(result[0]?.montoTotal || 0),
      montoAbiertas: Number(result[0]?.montoAbiertas || 0),
      montoCerradas: Number(result[0]?.montoCerradas || 0),
      montoPendientes: Number(result[0]?.montoPendientes || 0),
    };
  }

  async getNvvBySucursal(filters?: NvvFilters): Promise<Array<{
    sudo: string;
    nosudo: string;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>> {
    let query = db.select({
      sudo: factNvv.sudo,
      nosudo: factNvv.nosudo,
      total: countDistinct(factNvv.idmaeedo),
      abiertas: sql<number>`COUNT(DISTINCT CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.idmaeedo} END)`,
      cerradas: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.idmaeedo} END)`,
      pendientes: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.idmaeedo} END)`,
      montoTotal: sum(factNvv.monto),
      montoAbiertas: sql<number>`SUM(CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.monto} ELSE 0 END)`,
      montoCerradas: sql<number>`SUM(CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.monto} ELSE 0 END)`,
      montoPendientes: sql<number>`SUM(CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.monto} ELSE 0 END)`,
    }).from(factNvv);

    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`${factNvv.feemdo} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${factNvv.feemdo} <= ${filters.endDate}`);
    }
    if (filters?.sucursales && filters.sucursales.length > 0) {
      conditions.push(inArray(factNvv.sudo, filters.sucursales));
    }
    if (filters?.vendedores && filters.vendedores.length > 0) {
      conditions.push(inArray(factNvv.kofulido, filters.vendedores));
    }
    if (filters?.bodegas && filters.bodegas.length > 0) {
      conditions.push(inArray(factNvv.bosulido, filters.bodegas));
    }
    if (filters?.estado === 'open') {
      conditions.push(sql`(${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '')`);
    } else if (filters?.estado === 'closed') {
      conditions.push(sql`${factNvv.eslido} = 'C'`);
    }
    if (filters?.pendingOnly) {
      conditions.push(eq(factNvv.cantidad_pendiente, true));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} >= ${filters.minAmount}`);
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} <= ${filters.maxAmount}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.groupBy(factNvv.sudo, factNvv.nosudo);

    return result.map(row => ({
      sudo: String(row.sudo || ''),
      nosudo: String(row.nosudo || ''),
      totalNvv: Number(row.total || 0),
      abiertas: Number(row.abiertas || 0),
      cerradas: Number(row.cerradas || 0),
      pendientes: Number(row.pendientes || 0),
      montoTotal: Number(row.montoTotal || 0),
      montoAbiertas: Number(row.montoAbiertas || 0),
      montoCerradas: Number(row.montoCerradas || 0),
      montoPendientes: Number(row.montoPendientes || 0),
    }));
  }

  async getNvvByVendedor(filters?: NvvFilters): Promise<Array<{
    kofulido: string;
    nombre_vendedor: string;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>> {
    let query = db.select({
      kofulido: factNvv.kofulido,
      nombre_vendedor: factNvv.nombre_vendedor,
      total: countDistinct(factNvv.idmaeedo),
      abiertas: sql<number>`COUNT(DISTINCT CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.idmaeedo} END)`,
      cerradas: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.idmaeedo} END)`,
      pendientes: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.idmaeedo} END)`,
      montoTotal: sum(factNvv.monto),
      montoAbiertas: sql<number>`SUM(CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.monto} ELSE 0 END)`,
      montoCerradas: sql<number>`SUM(CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.monto} ELSE 0 END)`,
      montoPendientes: sql<number>`SUM(CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.monto} ELSE 0 END)`,
    }).from(factNvv);

    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`${factNvv.feemdo} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${factNvv.feemdo} <= ${filters.endDate}`);
    }
    if (filters?.sucursales && filters.sucursales.length > 0) {
      conditions.push(inArray(factNvv.sudo, filters.sucursales));
    }
    if (filters?.vendedores && filters.vendedores.length > 0) {
      conditions.push(inArray(factNvv.kofulido, filters.vendedores));
    }
    if (filters?.bodegas && filters.bodegas.length > 0) {
      conditions.push(inArray(factNvv.bosulido, filters.bodegas));
    }
    if (filters?.estado === 'open') {
      conditions.push(sql`(${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '')`);
    } else if (filters?.estado === 'closed') {
      conditions.push(sql`${factNvv.eslido} = 'C'`);
    }
    if (filters?.pendingOnly) {
      conditions.push(eq(factNvv.cantidad_pendiente, true));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} >= ${filters.minAmount}`);
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} <= ${filters.maxAmount}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.groupBy(factNvv.kofulido, factNvv.nombre_vendedor);

    return result.map(row => ({
      kofulido: String(row.kofulido || ''),
      nombre_vendedor: String(row.nombre_vendedor || ''),
      totalNvv: Number(row.total || 0),
      abiertas: Number(row.abiertas || 0),
      cerradas: Number(row.cerradas || 0),
      pendientes: Number(row.pendientes || 0),
      montoTotal: Number(row.montoTotal || 0),
      montoAbiertas: Number(row.montoAbiertas || 0),
      montoCerradas: Number(row.montoCerradas || 0),
      montoPendientes: Number(row.montoPendientes || 0),
    }));
  }

  async getNvvByBodega(filters?: NvvFilters): Promise<Array<{
    bosulido: string;
    nombre_bodega: string;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>> {
    let query = db.select({
      bosulido: factNvv.bosulido,
      nombre_bodega: factNvv.nombre_bodega,
      total: countDistinct(factNvv.idmaeedo),
      abiertas: sql<number>`COUNT(DISTINCT CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.idmaeedo} END)`,
      cerradas: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.idmaeedo} END)`,
      pendientes: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.idmaeedo} END)`,
      montoTotal: sum(factNvv.monto),
      montoAbiertas: sql<number>`SUM(CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.monto} ELSE 0 END)`,
      montoCerradas: sql<number>`SUM(CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.monto} ELSE 0 END)`,
      montoPendientes: sql<number>`SUM(CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.monto} ELSE 0 END)`,
    }).from(factNvv);

    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`${factNvv.feemdo} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${factNvv.feemdo} <= ${filters.endDate}`);
    }
    if (filters?.sucursales && filters.sucursales.length > 0) {
      conditions.push(inArray(factNvv.sudo, filters.sucursales));
    }
    if (filters?.vendedores && filters.vendedores.length > 0) {
      conditions.push(inArray(factNvv.kofulido, filters.vendedores));
    }
    if (filters?.bodegas && filters.bodegas.length > 0) {
      conditions.push(inArray(factNvv.bosulido, filters.bodegas));
    }
    if (filters?.estado === 'open') {
      conditions.push(sql`(${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '')`);
    } else if (filters?.estado === 'closed') {
      conditions.push(sql`${factNvv.eslido} = 'C'`);
    }
    if (filters?.pendingOnly) {
      conditions.push(eq(factNvv.cantidad_pendiente, true));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} >= ${filters.minAmount}`);
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} <= ${filters.maxAmount}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.groupBy(factNvv.bosulido, factNvv.nombre_bodega);

    return result.map(row => ({
      bosulido: String(row.bosulido || ''),
      nombre_bodega: String(row.nombre_bodega || ''),
      totalNvv: Number(row.total || 0),
      abiertas: Number(row.abiertas || 0),
      cerradas: Number(row.cerradas || 0),
      pendientes: Number(row.pendientes || 0),
      montoTotal: Number(row.montoTotal || 0),
      montoAbiertas: Number(row.montoAbiertas || 0),
      montoCerradas: Number(row.montoCerradas || 0),
      montoPendientes: Number(row.montoPendientes || 0),
    }));
  }

  async getNvvBySegmentoCliente(filters?: NvvFilters): Promise<Array<{
    ruen: string | null;
    nombre_segmento_cliente: string | null;
    totalNvv: number;
    abiertas: number;
    cerradas: number;
    pendientes: number;
    montoTotal: number;
    montoAbiertas: number;
    montoCerradas: number;
    montoPendientes: number;
  }>> {
    let query = db.select({
      ruen: factNvv.ruen,
      nombre_segmento_cliente: factNvv.nombre_segmento_cliente,
      total: countDistinct(factNvv.idmaeedo),
      abiertas: sql<number>`COUNT(DISTINCT CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.idmaeedo} END)`,
      cerradas: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.idmaeedo} END)`,
      pendientes: sql<number>`COUNT(DISTINCT CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.idmaeedo} END)`,
      montoTotal: sum(factNvv.monto),
      montoAbiertas: sql<number>`SUM(CASE WHEN (${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '') THEN ${factNvv.monto} ELSE 0 END)`,
      montoCerradas: sql<number>`SUM(CASE WHEN ${factNvv.eslido} = 'C' THEN ${factNvv.monto} ELSE 0 END)`,
      montoPendientes: sql<number>`SUM(CASE WHEN ${factNvv.cantidad_pendiente} = true THEN ${factNvv.monto} ELSE 0 END)`,
    }).from(factNvv);

    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`${factNvv.feemdo} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${factNvv.feemdo} <= ${filters.endDate}`);
    }
    if (filters?.sucursales && filters.sucursales.length > 0) {
      conditions.push(inArray(factNvv.sudo, filters.sucursales));
    }
    if (filters?.vendedores && filters.vendedores.length > 0) {
      conditions.push(inArray(factNvv.kofulido, filters.vendedores));
    }
    if (filters?.bodegas && filters.bodegas.length > 0) {
      conditions.push(inArray(factNvv.bosulido, filters.bodegas));
    }
    if (filters?.estado === 'open') {
      conditions.push(sql`(${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '')`);
    } else if (filters?.estado === 'closed') {
      conditions.push(sql`${factNvv.eslido} = 'C'`);
    }
    if (filters?.pendingOnly) {
      conditions.push(eq(factNvv.cantidad_pendiente, true));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} >= ${filters.minAmount}`);
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} <= ${filters.maxAmount}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.groupBy(factNvv.ruen, factNvv.nombre_segmento_cliente);

    return result.map(row => ({
      ruen: row.ruen,
      nombre_segmento_cliente: String(row.nombre_segmento_cliente || 'Sin Segmento'),
      totalNvv: Number(row.total || 0),
      abiertas: Number(row.abiertas || 0),
      cerradas: Number(row.cerradas || 0),
      pendientes: Number(row.pendientes || 0),
      montoTotal: Number(row.montoTotal || 0),
      montoAbiertas: Number(row.montoAbiertas || 0),
      montoCerradas: Number(row.montoCerradas || 0),
      montoPendientes: Number(row.montoPendientes || 0),
    }));
  }

  async getNvvDocuments(filters?: NvvFilters & {
    limit?: number;
    offset?: number;
  }): Promise<{
    documents: Array<{
      nudo: string;
      feemdo: Date | null;
      sudo: string;
      nosudo: string;
      nokoen: string | null;
      kofulido: string | null;
      nombre_vendedor: string | null;
      bosulido: string | null;
      nombre_bodega: string | null;
      eslido: string | null;
      monto: number;
      cantidad_pendiente: boolean;
    }>;
    total: number;
  }> {
    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`${factNvv.feemdo} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${factNvv.feemdo} <= ${filters.endDate}`);
    }
    if (filters?.sucursales && filters.sucursales.length > 0) {
      conditions.push(inArray(factNvv.sudo, filters.sucursales));
    }
    if (filters?.vendedores && filters.vendedores.length > 0) {
      conditions.push(inArray(factNvv.kofulido, filters.vendedores));
    }
    if (filters?.bodegas && filters.bodegas.length > 0) {
      conditions.push(inArray(factNvv.bosulido, filters.bodegas));
    }
    if (filters?.estado === 'open') {
      conditions.push(sql`(${factNvv.eslido} IS NULL OR ${factNvv.eslido} = '')`);
    } else if (filters?.estado === 'closed') {
      conditions.push(sql`${factNvv.eslido} = 'C'`);
    }
    if (filters?.pendingOnly) {
      conditions.push(eq(factNvv.cantidad_pendiente, true));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} >= ${filters.minAmount}`);
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(sql`${factNvv.monto} <= ${filters.maxAmount}`);
    }

    // Count total
    let countQuery = db.select({ count: sql<number>`COUNT(DISTINCT ${factNvv.idmaeedo})` }).from(factNvv);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);

    // Get documents
    let docsQuery = db.select({
      nudo: factNvv.nudo,
      feemdo: factNvv.feemdo,
      sudo: factNvv.sudo,
      nosudo: factNvv.nosudo,
      nokoen: factNvv.nokoen,
      kofulido: factNvv.kofulido,
      nombre_vendedor: factNvv.nombre_vendedor,
      bosulido: factNvv.bosulido,
      nombre_bodega: factNvv.nombre_bodega,
      eslido: factNvv.eslido,
      monto: factNvv.monto,
      cantidad_pendiente: factNvv.cantidad_pendiente,
    }).from(factNvv);

    if (conditions.length > 0) {
      docsQuery = docsQuery.where(and(...conditions));
    }

    docsQuery = docsQuery.orderBy(desc(factNvv.feemdo), desc(factNvv.nudo));

    if (filters?.limit) {
      docsQuery = docsQuery.limit(filters.limit);
    }
    if (filters?.offset) {
      docsQuery = docsQuery.offset(filters.offset);
    }

    const documents = await docsQuery;

    return {
      documents: documents.map(doc => ({
        nudo: String(doc.nudo || ''),
        feemdo: doc.feemdo,
        sudo: String(doc.sudo || ''),
        nosudo: String(doc.nosudo || ''),
        nokoen: doc.nokoen,
        kofulido: doc.kofulido,
        nombre_vendedor: doc.nombre_vendedor,
        bosulido: doc.bosulido,
        nombre_bodega: doc.nombre_bodega,
        eslido: doc.eslido,
        monto: Number(doc.monto || 0),
        cantidad_pendiente: doc.cantidad_pendiente || false,
      })),
      total,
    };
  }

  // ==================== SEO TRACKING ====================

  async getSeoCampaigns(): Promise<SeoCampaign[]> {
    return await db
      .select()
      .from(seoCampaigns)
      .orderBy(desc(seoCampaigns.createdAt));
  }

  async getSeoCampaign(id: string): Promise<SeoCampaign | null> {
    const result = await db
      .select()
      .from(seoCampaigns)
      .where(eq(seoCampaigns.id, id))
      .limit(1);
    return result[0] || null;
  }

  async createSeoCampaign(data: InsertSeoCampaign): Promise<SeoCampaign> {
    const result = await db
      .insert(seoCampaigns)
      .values(data)
      .returning();
    return result[0];
  }

  async updateSeoCampaign(id: string, data: Partial<InsertSeoCampaign>): Promise<SeoCampaign | null> {
    const result = await db
      .update(seoCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(seoCampaigns.id, id))
      .returning();
    return result[0] || null;
  }

  async deleteSeoCampaign(id: string): Promise<void> {
    await db.delete(seoCampaigns).where(eq(seoCampaigns.id, id));
  }

  async getSeoKeywords(campaignId?: string): Promise<SeoKeyword[]> {
    let query = db.select().from(seoKeywords);
    if (campaignId) {
      query = query.where(eq(seoKeywords.campaignId, campaignId)) as typeof query;
    }
    return await query.orderBy(desc(seoKeywords.createdAt));
  }

  async getSeoKeyword(id: string): Promise<SeoKeyword | null> {
    const result = await db
      .select()
      .from(seoKeywords)
      .where(eq(seoKeywords.id, id))
      .limit(1);
    return result[0] || null;
  }

  async createSeoKeyword(data: InsertSeoKeyword): Promise<SeoKeyword> {
    const result = await db
      .insert(seoKeywords)
      .values(data)
      .returning();
    return result[0];
  }

  async updateSeoKeyword(id: string, data: Partial<InsertSeoKeyword>): Promise<SeoKeyword | null> {
    const result = await db
      .update(seoKeywords)
      .set(data)
      .where(eq(seoKeywords.id, id))
      .returning();
    return result[0] || null;
  }

  async deleteSeoKeyword(id: string): Promise<void> {
    await db.delete(seoKeywords).where(eq(seoKeywords.id, id));
  }

  async getSeoPositionHistory(keywordId: string, limit?: number): Promise<SeoPositionHistory[]> {
    let query = db
      .select()
      .from(seoPositionHistory)
      .where(eq(seoPositionHistory.keywordId, keywordId))
      .orderBy(desc(seoPositionHistory.fechaConsulta));
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return await query;
  }

  async createSeoPositionHistory(data: InsertSeoPositionHistory): Promise<SeoPositionHistory> {
    const result = await db
      .insert(seoPositionHistory)
      .values(data)
      .returning();
    
    // Update keyword with last position
    await db
      .update(seoKeywords)
      .set({
        ultimaPosicion: data.posicion,
        ultimaConsulta: new Date(),
      })
      .where(eq(seoKeywords.id, data.keywordId));
    
    return result[0];
  }

  async getSeoKeywordsWithHistory(campaignId: string): Promise<(SeoKeyword & { historial: SeoPositionHistory[] })[]> {
    const keywords = await this.getSeoKeywords(campaignId);
    const result = await Promise.all(
      keywords.map(async (keyword) => {
        const historial = await this.getSeoPositionHistory(keyword.id, 30); // últimos 30 registros
        return { ...keyword, historial };
      })
    );
    return result;
  }

  // ==================================================================================
  // LOYALTY PROGRAM (PANORAMICA MARKET)
  // ==================================================================================

  async getLoyaltyTiers(): Promise<LoyaltyTier[]> {
    return await db
      .select()
      .from(loyaltyTiers)
      .where(eq(loyaltyTiers.activo, true))
      .orderBy(loyaltyTiers.orden);
  }

  async getLoyaltyTierByCode(code: string): Promise<LoyaltyTier | undefined> {
    const [tier] = await db
      .select()
      .from(loyaltyTiers)
      .where(eq(loyaltyTiers.codigo, code));
    return tier;
  }

  async createLoyaltyTier(tier: Omit<InsertLoyaltyTier, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoyaltyTier> {
    const [result] = await db
      .insert(loyaltyTiers)
      .values(tier)
      .returning();
    return result;
  }

  async updateLoyaltyTier(id: string, tier: Partial<InsertLoyaltyTier>): Promise<LoyaltyTier | undefined> {
    const [result] = await db
      .update(loyaltyTiers)
      .set({ ...tier, updatedAt: new Date() })
      .where(eq(loyaltyTiers.id, id))
      .returning();
    return result;
  }

  async deleteLoyaltyTier(id: string): Promise<boolean> {
    const result = await db
      .delete(loyaltyTiers)
      .where(eq(loyaltyTiers.id, id))
      .returning();
    return result.length > 0;
  }

  async getLoyaltyTierBenefits(tierId: string): Promise<LoyaltyTierBenefit[]> {
    return await db
      .select()
      .from(loyaltyTierBenefits)
      .where(and(
        eq(loyaltyTierBenefits.tierId, tierId),
        eq(loyaltyTierBenefits.activo, true)
      ))
      .orderBy(loyaltyTierBenefits.orden);
  }

  async createLoyaltyTierBenefit(benefit: Omit<InsertLoyaltyTierBenefit, 'id' | 'createdAt'>): Promise<LoyaltyTierBenefit> {
    const [result] = await db
      .insert(loyaltyTierBenefits)
      .values(benefit)
      .returning();
    return result;
  }

  async updateLoyaltyTierBenefit(id: string, benefit: Partial<InsertLoyaltyTierBenefit>): Promise<LoyaltyTierBenefit | undefined> {
    const [result] = await db
      .update(loyaltyTierBenefits)
      .set(benefit)
      .where(eq(loyaltyTierBenefits.id, id))
      .returning();
    return result;
  }

  async deleteLoyaltyTierBenefit(id: string): Promise<boolean> {
    const result = await db
      .delete(loyaltyTierBenefits)
      .where(eq(loyaltyTierBenefits.id, id))
      .returning();
    return result.length > 0;
  }

  async getClientsByLoyaltyTier(tierId: string): Promise<Array<{
    clientName: string;
    clientCode: string | null;
    totalSales: number;
    transactionCount: number;
    tierCode: string;
    tierName: string;
  }>> {
    // Get the tier first
    const [tier] = await db
      .select()
      .from(loyaltyTiers)
      .where(eq(loyaltyTiers.id, tierId));
    
    if (!tier) return [];

    // Calculate date 90 days ago (or tier's period)
    const daysAgo = tier.periodoEvaluacionDias || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get all tiers to determine ranges
    const allTiers = await db
      .select()
      .from(loyaltyTiers)
      .where(eq(loyaltyTiers.activo, true))
      .orderBy(loyaltyTiers.montoMinimo);

    // Find the tier's range (min and max)
    const tierIndex = allTiers.findIndex(t => t.id === tierId);
    const minAmount = Number(tier.montoMinimo);
    const maxAmount = tierIndex < allTiers.length - 1 
      ? Number(allTiers[tierIndex + 1].montoMinimo) 
      : null; // No max for highest tier

    // Get clients with their sales in the period - using factVentas (ETL data)
    // Group only by client NAME (nokoen) since sales are tracked by name, not individual codes
    const clientSales = await db
      .select({
        clientName: factVentas.nokoen,
        totalSales: sql<number>`COALESCE(SUM(${factVentas.vaneli}), 0)`,
        transactionCount: sql<number>`COUNT(DISTINCT ${factVentas.nudo})`,
      })
      .from(factVentas)
      .where(
        and(
          sql`${factVentas.feemdo} >= ${startDateStr}`,
          isNotNull(factVentas.nokoen)
        )
      )
      .groupBy(factVentas.nokoen)
      .having(
        maxAmount
          ? and(
              sql`COALESCE(SUM(${factVentas.vaneli}), 0) >= ${minAmount}`,
              sql`COALESCE(SUM(${factVentas.vaneli}), 0) < ${maxAmount}`
            )
          : sql`COALESCE(SUM(${factVentas.vaneli}), 0) >= ${minAmount}`
      )
      .orderBy(sql`COALESCE(SUM(${factVentas.vaneli}), 0) DESC`);

    // Get first client code for each unique client name (for display purposes)
    const clientCodes = await db
      .select({
        nokoen: clients.nokoen,
        koen: sql<string>`MIN(${clients.koen})`,
      })
      .from(clients)
      .where(inArray(clients.nokoen, clientSales.map(c => c.clientName).filter(Boolean) as string[]))
      .groupBy(clients.nokoen);

    const codeMap = new Map(clientCodes.map(c => [c.nokoen, c.koen]));

    return clientSales.map(c => ({
      clientName: c.clientName || 'Sin nombre',
      clientCode: codeMap.get(c.clientName || '') || null,
      totalSales: Number(c.totalSales) || 0,
      transactionCount: Number(c.transactionCount) || 0,
      tierCode: tier.codigo,
      tierName: tier.nombre,
    }));
  }

  async getClientLoyaltyStatus(clientName: string): Promise<{
    currentTier: LoyaltyTier | null;
    totalSalesLast90Days: number;
    transactionsLast90Days: number;
    nextTier: LoyaltyTier | null;
    amountToNextTier: number;
  } | null> {
    // Get all active tiers ordered by monto_minimo
    const allTiers = await db
      .select()
      .from(loyaltyTiers)
      .where(eq(loyaltyTiers.activo, true))
      .orderBy(loyaltyTiers.montoMinimo);

    if (allTiers.length === 0) return null;

    // Calculate date 90 days ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get client's sales in the period - using factVentas (ETL data)
    const [clientStats] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${factVentas.vaneli}), 0)`,
        transactionCount: sql<number>`COUNT(DISTINCT ${factVentas.nudo})`,
      })
      .from(factVentas)
      .where(
        and(
          eq(factVentas.nokoen, clientName),
          sql`${factVentas.feemdo} >= ${startDateStr}`
        )
      );

    const totalSales = Number(clientStats?.totalSales) || 0;
    const transactionCount = Number(clientStats?.transactionCount) || 0;

    // Determine current tier (highest tier where client meets minimum)
    let currentTier: LoyaltyTier | null = null;
    for (const tier of allTiers) {
      if (totalSales >= Number(tier.montoMinimo)) {
        currentTier = tier;
      }
    }

    // Determine next tier
    let nextTier: LoyaltyTier | null = null;
    let amountToNextTier = 0;

    if (currentTier) {
      const currentIndex = allTiers.findIndex(t => t.id === currentTier!.id);
      if (currentIndex < allTiers.length - 1) {
        nextTier = allTiers[currentIndex + 1];
        amountToNextTier = Number(nextTier.montoMinimo) - totalSales;
      }
    } else {
      // No tier yet, next tier is the first one
      nextTier = allTiers[0];
      amountToNextTier = Number(nextTier.montoMinimo) - totalSales;
    }

    return {
      currentTier,
      totalSalesLast90Days: totalSales,
      transactionsLast90Days: transactionCount,
      nextTier,
      amountToNextTier: Math.max(0, amountToNextTier),
    };
  }

  // WhatsApp Configuration
  async getWhatsAppConfig(): Promise<WhatsAppConfig | undefined> {
    const [config] = await db.select().from(whatsappConfig).where(eq(whatsappConfig.id, 'default'));
    return config;
  }

  async saveWhatsAppConfig(config: { phoneNumberId: string; businessAccountId: string; accessToken: string; webhookVerifyToken: string }): Promise<void> {
    const existing = await this.getWhatsAppConfig();
    
    if (existing) {
      await db.update(whatsappConfig)
        .set({
          phoneNumberId: config.phoneNumberId,
          businessAccountId: config.businessAccountId,
          accessToken: config.accessToken,
          webhookVerifyToken: config.webhookVerifyToken,
          updatedAt: new Date(),
        })
        .where(eq(whatsappConfig.id, 'default'));
    } else {
      await db.insert(whatsappConfig).values({
        id: 'default',
        phoneNumberId: config.phoneNumberId,
        businessAccountId: config.businessAccountId,
        accessToken: config.accessToken,
        webhookVerifyToken: config.webhookVerifyToken,
      });
    }
  }

  async updateWhatsAppConnectionStatus(status: string): Promise<void> {
    await db.update(whatsappConfig)
      .set({
        connectionStatus: status,
        lastConnectionTest: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(whatsappConfig.id, 'default'));
  }

}

export const storage = new DatabaseStorage();
