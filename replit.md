# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a Spanish-language sales analytics dashboard designed for the Chilean market. Its purpose is to provide comprehensive sales insights, offering client and user management (with role-based access), detailed sales analytics, and a mobile-responsive design. The application enables users to import CSV sales data, monitor KPIs, analyze trends, and review transaction records. Key capabilities include e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse for data processing, and an internal notification system.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 5, 2025 - Full Historical Editing for FUTURO- Clients
**Enhanced manual projection editing for artificial clients:**
- **All Months Visible**: FUTURO- clients now show ALL 12 months when expanded, regardless of data presence
  - Previous behavior: Only showed months with data or in active filter
  - New behavior: Always displays complete 12-month breakdown for all years
- **Unrestricted Historical Editing**: Confirmed that FUTURO- clients can edit ALL years (2023, 2024, 2025, 2026+)
  - Backend stores with correct "FUTURO-" prefix (e.g., "FUTURO-TEST" for client "test")
  - Frontend detection: `client.clientCode.startsWith('FUTURO-')`
  - All cells editable: `isEditable = isFuture || isFutureClient`
- **Use Case**: Allows adding realistic historical baseline data to fictional clients before projecting future sales
- **Performance**: No impact - filter applied per-client during rendering

### November 5, 2025 - All-Periods Filter in Manual Projections
**Stricter client filtering for multi-year analysis:**
- **New Filter Switch**: "Solo clientes con compras en TODOS los periodos seleccionados"
  - Default behavior: Shows clients with sales in ANY of the selected years (OR logic)
  - When enabled: Shows only clients with sales in ALL selected years (AND logic)
- **Backend Implementation**: Filter applied after initial client aggregation
  - Checks each client's sales years using `Set` for efficient lookup
  - Uses `Array.every()` to verify all selected years are present
  - Only applies when multiple years selected (`years.length > 1`)
- **Performance**: Per-client scan on filtered dataset, not raw transactions
- **Combination**: Works seamlessly with existing search, segment, and salesperson filters
- **Use Case**: Identify consistent customers across all analyzed periods
  - Example: Select [2023, 2024, 2025] → Filter shows only clients who purchased in all three years

### November 5, 2025 - Monthly Sales Breakdown in Manual Projections
**Complete monthly data visualization for expanded client rows:**
- **Backend Monthly Query**: `getHistoricoVentasPorAnio` now returns monthly breakdown with `EXTRACT(MONTH)` grouping
  - Respects month filter when users select specific months
  - Only queries paginated clients for efficiency
  - Includes purchase frequency (`COUNT(DISTINCT nudo)`) per month
- **Frontend Aggregation**: Yearly totals calculated by summing filtered monthly data
  - Prevents duplication by using monthly rows as single source of truth
  - Purchase frequency sums correctly from monthly records only
- **User Experience**: When expanding a client, all 12 months show actual sales data
  - Previously: All months displayed as "-" (empty)
  - Now: Each month shows historical sales amount
- **Filter Accuracy**: Month filters correctly limit displayed data
  - Example: Selecting Jan-Mar shows only those months and recalculates yearly total from that subset

### November 5, 2025 - Projection Filtering & Cell Editing Fixes
**Critical fixes to projection panels (manual and visualization) for accurate filtering and data editing:**
- **Manual Projection Panel**:
  - Frontend Segment Filter: Added segment filtering in frontend to correctly filter processed data
  - Salesperson Filter Verification: Confirmed vendor filtering works correctly
  - Cell Editing Fix: Resolved issue where users couldn't delete or change saved monthly projections to 0
    - Changed from `defaultValue` to controlled `value` inputs
    - Fixed logic to properly detect when cell is being edited vs displaying saved value
    - Users can now clear values, enter 0, and edit existing projections without issues
- **Visualization Panel**:
  - Post-Query Filtering: Both segment and salesperson filters applied after fetching data (not in database query)
  - Flexible Salesperson Matching: Handles name discrepancies between sales transactions and saved projections
    - Example: Filter "BARBARA GUTIERREZ BAHAMONDES" matches saved code "BARBARA GUTIERREZ"
    - Uses three-way match: exact equality, contains, or is contained by
  - Preserves Save Functionality: Filters applied post-query to avoid breaking save flows that need unfiltered data
  - Backend fetches by years/months only, then filters by salesperson and segment in memory before chart aggregation
- **Design Decision**: Segment and salesperson filtering NOT applied in `getProyeccionesVentas` database query to preserve annual row access needed by save operations
- **Aligned with Dashboard**: Filters now work consistently with main dashboard behavior

### November 5, 2025 - Inventory Auto-Sync & Cache System
**Intelligent inventory synchronization and caching to keep data fresh without saturating the database:**
- **Auto-Sync on Entry**: When users access inventory, system checks if last sync was >1 minute ago and triggers background sync automatically
- **Background Processing**: Sync runs asynchronously - users get data immediately without waiting
- **Sync Mutex**: Built-in `syncInProgress` flag prevents duplicate syncs when multiple users enter simultaneously
- **Smart Caching with TTL**: 30-second query cache prevents redundant database queries
- **Per-Filter Mutex**: Concurrent users with identical filters share the same query
- **Isolated Filter Keys**: Users with different filters get separate cache entries
- **Zero Wait Time**: Users never wait for sync - they get cached data instantly while sync happens in background
- **Performance Logging**: Console logs track cache hits (📦), misses (🔄), auto-sync triggers (🔄), and sync completion (✅)
- **Implementation**: 
  - Auto-sync in `/api/inventory-with-prices` and `/api/inventory/summary-with-prices` endpoints
  - Map-based cache system (`Map<cacheKey, {data, timestamp, inFlightPromise}>`) in `server/storage.ts`
  - Existing sync mutex in `syncProductsFromERP` prevents concurrent syncs

### November 4, 2025 - Search, Pagination & Segment Filtering
**Enhanced client browsing with efficient data loading:**
- **Search Functionality**: Client name search with case-insensitive LIKE matching
- **Pagination**: 10 clients per page with First/Previous/Next/Last navigation
- **Backend Segment Filtering**: Segment filter now applied in backend for accurate pagination
  - Shows correct client count per segment
  - Pagination works correctly with filtered results
  - Resets to page 1 when filters change
- **Historical Segment Assignment**: Clients assigned segment from their most recent transaction (any year)
  - Fallback to historical segment if no sales in selected years
  - Enables accurate segment filtering even for inactive clients
- **Performance**: Efficient loading of 13,424+ clients with server-side filtering and pagination

### November 4, 2025 - Manual Projections UX Improvements
**Enhanced usability and data accuracy:**
- **Auto-select Last 3 Years**: System now preselects the three most recent years by default (can be deselected)
- **Removed Purchase Frequency Column**: Eliminated unreliable purchase frequency data from table display
- **Segment Accuracy**: Backend correctly assigns client segments based on `noruen` field from transactions
- **Cleaner Interface**: Streamlined table layout for better readability

### November 4, 2025 - Manual Salesperson Name Input in User Creation
**Enhanced user creation form to support new salespeople:**
- **Manual Input Field**: Text input allows direct entry of salesperson names
- **Dual Entry Method**: Users can either type directly or select from existing salespeople
- **Fixed Form Control**: Corrected React Hook Form integration to ensure input functionality
- **Solves Bootstrap Problem**: Administrators can create user accounts before salespeople have sales transactions

### November 4, 2025 - Editable Historical Years for Future Clients
**Enhanced manual projection system to support baseline data entry for fictitious clients:**
- **Future Client Detection**: System identifies fictitious clients by "FUTURO-" prefix
- **Unrestricted Editing**: Future clients can edit ALL years (historical and future)
  - Real clients: Read-only on historical data, editable on future years
  - Future clients: Editable on both historical (2024, 2025) and future years (2026+)
- **Baseline Data Population**: Allows realistic historical baseline data before making projections
- **Filter Improvements**: Added placeholders to Segment and Salesperson filters

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Build Tool**: Vite
- **PWA**: Service Worker v2.0.0 (Network-First for HTML, Stale-While-Revalidate for static assets)

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful API
- **Session Management**: Express sessions with PostgreSQL storage
- **File Processing**: CSV import
- **File Storage**: Replit Object Storage
- **Authentication**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, and CSRF protection
- **Authorization**: Role-based access control (Admin, Supervisor, Salesperson, Técnico de Obra, Client, departmental roles)

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Key Schemas**: Users, sales transactions, e-commerce, CRM, complaints, maintenance, marketing, expenses, ETL
- **Migrations**: Drizzle Kit

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Key Features
- **Client & User Management**: Role-based access and client linking.
- **CRM Pipeline System**: Kanban-style lead management with customizable stages and activity tracking.
- **E-commerce**: Order management and notifications.
- **Product Grouping System**: Parent-child product variations.
- **Technical Visits**: Multi-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPIs, trend charts, detailed transaction records, segment analysis, period-to-period comparisons, and interactive projection visualizations.
- **Quote Management**: Role-based visibility, status updates, PDF integration.
- **Task Management**: For admin/supervisor roles.
- **NVV Import & Dashboard Integration**: CSV import and dashboard display.
- **Goals Progress**: Sales goals tracking.
- **Dashboard Enhancements**: Modern 3-card layout, YTD comparison, salesperson detail views, and goal metrics.
- **Complaints Management (Reclamos Generales)**: Multi-area resolution with workflow automation, photo uploads, role-based filtering, and state machine.
- **Maintenance Management (Mantención)**: Equipment request system with workflow, technician assignment, photo evidence, and history logging.
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, customizable checklists, and interactive calendar.
- **Inventory Module (Hybrid System)**: Real-time stock levels with integrated average pricing, combining PostgreSQL catalog with live SQL Server stock queries. Includes low stock alerts.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking.
- **Internal Notifications System**: Role-based notifications, archiving, and automatic event notifications. Includes smart sales notifications (inactive clients, seasonal clients, trending products).
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table, supporting Full Annual and Automatic Incremental ETL with monitoring.
- **Manual Sales Projection**: Monthly to yearly calculation, creation of "future clients", and robust role-based access control.

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Automation**: Database migrations, ETL scheduler.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless
- **Object Storage**: Replit Object Storage
- **Hosting**: Replit deployment environment

### Third-Party Libraries
- **UI Framework**: Radix UI
- **Charts**: Chart.js
- **Validation**: Zod
- **Date Handling**: date-fns
- **PDF Generation**: @react-pdf/renderer
- **CSV Parsing**: Papa Parse