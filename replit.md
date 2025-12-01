# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market, providing comprehensive sales insights to enhance strategies and operational efficiency. It features KPI monitoring, trend analysis, sales forecasting, CRM, and e-commerce integration. The project also includes specialized modules for complaints, maintenance (CMMS), and technical visits, aiming to provide a competitive advantage through data-driven decision-making and streamlined operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Technical Implementation
- **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for state management, Shadcn/ui (Radix UI) for components, Tailwind CSS for styling, Chart.js for data visualization, Vite as build tool, and PWA capabilities.
- **Backend**: Node.js with Express.js, TypeScript, RESTful API design.
- **Authentication & Authorization**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, CSRF protection, and a 3-layer role-based access control (RBAC) system (Admin, Supervisor, Salesperson, Técnico de Obra, Client, Jefe_planta, Mantencion, and various departmental roles). Backend RBAC middleware ensures granular access, including full administrative access for `Jefe_planta` and `Mantencion` roles within the maintenance module.
- **Data Processing**: CSV import, Replit Object Storage for file storage. ETL Data Warehouse for automated incremental runs, UPSERT, data mapping, real-time progress, and reliability features. Sales forecasting uses Holt-Winters method. NVV ETL uses full synchronization for transient data.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM. Schemas include Users, sales transactions, e-commerce, CRM, complaints, maintenance (CMMS), marketing, expenses, and ETL. Drizzle Kit manages schema.
- **Key Features**:
    - **Management**: Client & user management, CRM pipeline, E-commerce, Product grouping, Unified Task management (integrating marketing and general tasks with role-based assignment), Salesperson data management.
    - **Sales & Finance**: Sales analytics (KPIs, trends, projections), Quote management, Goals progress, Finance module (invoices, sales notes), Promesas de Compra Semanales, Manual Sales Projection.
    - **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine, specific area mapping to operative areas), Maintenance management (CMMS: equipment requests, preventive plans supporting equipment-specific and general tasks, work orders, expense tracking, full lifecycle management), Inventory module (real-time stock, alerts), Expense management.
    - **Internal Systems**: Internal notification system, ETL monitoring modules with change tracking and state change auditing.
- **Production Deployment**: Replit Autoscale Deployment with automated database migrations, ETL scheduler, preventive maintenance scheduler, and health monitoring. Includes reliability features like circuit breaker, automatic retry, health check endpoint, automated alerting, and data quality validation.

## External Dependencies

- **Database**: Neon PostgreSQL serverless
- **Object Storage**: Replit Object Storage
- **Hosting**: Replit deployment environment
- **UI Framework**: Radix UI
- **Charts**: Chart.js
- **Validation**: Zod
- **Date Handling**: date-fns
- **PDF Generation**: @react-pdf/renderer
- **CSV Parsing**: Papa Parse

## NVV Module Architecture (December 2025)

### Current Architecture (ACTIVE)
The NVV (Notas de Venta Vigentes) system uses automated ETL from SQL Server:

**Data Source**: nvv.fact_nvv table (populated by ETL)
- ETL runs every 15 minutes automatically
- Full synchronization strategy (snapshot of current open NVV records)
- Only records where `eslido IS NULL OR eslido = ''` are considered pending
- Source tables from SQL Server: MAEEDDO, MAEDDDO, MAEEDO, MAEPR, MAEVEN, TABBO

**Active Files**:
- `server/etl-nvv.ts` - Main ETL implementation
- `server/storage.ts` - Functions: getNvvDashboardData(), getNvvPendingSales(), getNvvSummaryMetrics(), getNvvBySalesperson(), getNvvTotalSummary()
- `server/routes.ts` - Endpoints: GET /api/nvv/pending, /api/nvv/total, /api/nvv/metrics, /api/nvv/dashboard, /api/nvv/etl/*

**Key Fields**:
- `nombre_vendedor` - Salesperson name from ETL
- `nombre_segmento_cliente` - Segment name from ETL
- `kofulido` - Salesperson code
- `eslido` - Determines if NVV is closed (null/empty = pending)
- `monto` - Amount (calculated from ppprne * quantity)

### Deprecated Architecture (DO NOT USE)
The following were used for manual CSV import and are now deprecated:

**Deprecated Table**: `nvv_pending_sales` (shared/schema.ts)
- Was used for manual CSV uploads
- Data is stale and not synchronized with source system

**Deprecated Functions** (server/storage.ts):
- `importNvvFromCsv()` - ⛔ DEPRECATED
- `clearAllNvvData()` - ⛔ DEPRECATED
- `deleteNvvBatch()` - ⛔ DEPRECATED

**Deprecated Endpoints** (server/routes.ts):
- POST /api/nvv/import - ⛔ DEPRECATED
- DELETE /api/nvv/clear-all - ⛔ DEPRECATED
- DELETE /api/nvv/batch/:batchId - ⛔ DEPRECATED

**Deprecated Schemas** (shared/schema.ts):
- `nvvPendingSales` - ⛔ DEPRECATED
- `insertNvvPendingSalesSchema` - ⛔ DEPRECATED
- `nvvCsvImportSchema` - ⛔ DEPRECATED
- `nvvImportResultSchema` - ⛔ DEPRECATED

### Important Notes for Future Development
1. **Always use nvv.fact_nvv** - Never query nvv_pending_sales
2. **Use ETL fields directly** - nombre_vendedor, nombre_segmento_cliente come from ETL
3. **Pending filter** - Always filter by `(eslido IS NULL OR eslido = '')` for pending NVV
4. **ETL handles cleanup** - Full sync removes closed NVV automatically
5. **Check deprecation warnings** - Functions log warnings when deprecated code is called

## GDV Module Architecture (December 2025)

### Current Architecture (ACTIVE)
The GDV (Guías de Despacho Vigentes) system uses automated ETL from SQL Server with **full synchronization** (snapshot):

**Data Source**: gdv.fact_gdv table (populated by ETL)
- ETL uses full synchronization strategy (DELETE ALL + INSERT ALL)
- Extracts ONLY open dispatch guides (ESDO IS NULL or empty, ESLIDO IS NULL or empty)
- When GDV is invoiced/closed in source system, it automatically disappears from fact_gdv
- Source tables from SQL Server: MAEEDO, MAEDDO, MAEEN, MAEPR, TABFU, TABRU, TABBO

**Synchronization Strategy**:
- **Type**: Full sync (snapshot) - same as NVV
- **Behavior**: TRUNCATE fact_gdv → INSERT only open GDV lines
- **Automatic cleanup**: Closed GDV disappear automatically
- **No watermark filtering**: Extracts all open GDV regardless of date

**Active Files**:
- `server/etl-gdv.ts` - Main ETL implementation (full_sync mode)
- `server/storage.ts` - GDV query functions
- `server/routes.ts` - GDV endpoints

**Key Fields**:
- `esdo` - Document status (null/empty = open, 'C' = closed)
- `eslido` - Line status (null/empty = pending, 'C' = closed)
- `kofulido` - Salesperson code (from MAEDDO detail, not header)
- `monto` - Line amount (vaneli)
- `cantidad_pendiente` - Boolean: has pending quantity AND not closed AND monto >= 1000

### Important Notes for GDV
1. **Uses full sync** - TRUNCATE + INSERT, not incremental UPSERT
2. **Filter by ESLIDO** - Only lines where `eslido IS NULL OR eslido = ''`
3. **Automatic cleanup** - Closed/invoiced GDV disappear on next sync
4. **Transient data** - GDV represents pending dispatches, not historical records