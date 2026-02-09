# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market designed to provide comprehensive sales insights. Its primary purpose is to enhance sales strategies and operational efficiency through KPI monitoring, trend analysis, sales forecasting, and robust CRM and e-commerce integrations. The project also integrates specialized modules for complaints, maintenance (CMMS), and technical visits, aiming to provide a competitive advantage by enabling data-driven decision-making and streamlining various business operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Branding**: Features a Panoramica 30th-anniversary logo on login and professional PDF documents.
- **Responsiveness**: Designed for mobile responsiveness across all interfaces.
- **Theming**: Utilizes custom design tokens and CSS variables for a consistent look.
- **Professional Documents**: PDFs feature enhanced layouts with multi-column design and branding elements.

### Technical Implementation
- **Frontend**: Built with React 18, TypeScript, Wouter for routing, TanStack Query for state management, Shadcn/ui (Radix UI) components, Tailwind CSS for styling, Chart.js for data visualization, and Vite as the build tool, with PWA capabilities.
- **Backend**: Implemented using Node.js with Express.js and TypeScript, following a RESTful API design.
- **Authentication & Authorization**: Employs Passport.js Local Strategy with bcrypt, HTTP-only cookies, CSRF protection, and a 3-layer role-based access control (RBAC) system. RBAC middleware ensures granular access for various roles including Admin, Supervisor, Salesperson, and specialized departmental roles.
- **Data Processing**: Supports CSV import, utilizes Replit Object Storage for file storage, and features an ETL Data Warehouse for automated incremental runs, UPSERT operations, data mapping, and real-time progress monitoring. Sales forecasting is powered by the Holt-Winters method. NVV ETL uses full synchronization for transient data.
- **Database**: PostgreSQL (Neon serverless) managed with Drizzle ORM. The schema includes users, sales transactions, e-commerce, CRM, complaints, maintenance (CMMS), marketing, expenses, and ETL data. Drizzle Kit is used for schema management.
- **Key Features**:
    - **Management**: Client and user management, CRM pipeline, E-commerce, Product grouping, Unified Task management, and Salesperson data management.
    - **Sales & Finance**: Advanced sales analytics (KPIs, trends, projections), Quote management, Goal progress tracking, Finance module (invoices, sales notes), Weekly Purchase Promises, and Manual Sales Projection.
    - **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine), Maintenance management (CMMS for equipment requests, preventive plans, work orders, expense tracking), and Inventory module with real-time stock and alerts.
    - **Internal Systems**: Internal notification system and ETL monitoring modules with change tracking and state change auditing.
- **Production Deployment**: Leverages Replit Autoscale Deployment, including automated database migrations, ETL and preventive maintenance schedulers, and health monitoring. Incorporates reliability features like circuit breakers, automatic retries, and automated alerting.
- **Database Bootstrap System**: An idempotent `bootstrapDatabase()` function runs before migrations on application startup to ensure essential schemas and staging tables are present.

### System Design Choices
- **NVV Module (Updated January 2026)**: Utilizes an automated ETL process from SQL Server for "Notas de Venta Vigentes" with a full synchronization strategy. **The pending status is determined by TWO conditions**:
  - `cantidad_pendiente_ud2` = CAPRCO2 - CAPREX2 (quantity ordered minus delivered in UD2)
  - `monto_pendiente` = cantidad_pendiente_ud2 × PPPRNE (pending monetary value)
  - A line is considered "OPEN/PENDING" when:
    1. `monto_pendiente > 0` (has pending quantity to deliver)
    2. AND `ESLIDO` is NULL or empty (vigente/open status)
  - Uses `nvv.fact_nvv` as the primary data source.
- **GDV Module**: Employs an automated ETL process from SQL Server for "Guías de Despacho Vigentes" with a full synchronization strategy, extracting only open dispatch guides and ensuring closed items are automatically removed. It relies on `gdv.fact_gdv` as the primary data source.
- **Public Salesperson Catalog**: Enables salespeople to have public catalog pages (`/catalogo/:slug`) where visitors can browse products and submit quote requests without authentication.
- **Shopify-Style Product Management**: The e-commerce system supports a hierarchical product → options → variants structure using `shopify_products`, `shopify_product_options`, and `shopify_product_variants` tables.
- **Multi-Level Fund Approval System (January 2026)**: Implements a two-tier approval workflow for fund requests:
  1. Salespeople request funds specifying a segment
  2. Supervisors (assigned to specific segments via `segment_supervisors` table) approve/reject first
  3. RRHH gives final approval with payment voucher upload
  - States: `pendiente_supervisor` → `pendiente_rrhh` → `aprobado` (or `rechazado`)
  - Full approval history tracked in `fund_approval_history` table
  - Automatic notifications sent to supervisors and RRHH users at each step

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

## External API Integration (January 2026)

### Overview
The system provides a REST API for external system integration, authenticated via API Keys.

### Authentication
All external API calls require the `X-API-Key` header:
```bash
curl -H "X-API-Key: mk_readonly_xxxxxxxxxxxxxxxxxx" https://your-domain.replit.app/external-api/dashboard
```

### API Roles
- `readonly` - Can only read data (GET endpoints)
- `read_write` - Can read and write data (GET, POST, PATCH, DELETE)
- `admin` - Full access including API key management

### Dashboard Endpoint (Aggregated Sales Data)
**Endpoint**: `GET /external-api/dashboard`

**Query Parameters**:
- `period` - Supports multiple formats (auto-detects filterType if not provided):
  - `YYYY` for year (e.g., `2025` for full year 2025)
  - `YYYY-MM` for month (e.g., `2025-06` for June 2025)
  - `YYYY-MM-DD` for day (e.g., `2025-06-15`)
- `filterType` - "month", "year", or "day" (optional, auto-detected from period format)
- `segment` - Filter by segment name (optional)
- `salesperson` - Filter by salesperson name (optional)
- `client` - Filter by client code (optional)

**Response Fields**:
- `period` - The requested period
- `year` - Target year as integer
- `filterType` - Applied filter type
- `dateRange` - Object with startDate and endDate
- `salesTotal` - Total sales for the period
- `unitsSold` - Total units sold
- `transactionCount` - Number of transactions
- `averageTicket` - Average transaction value
- `yearTotal` - Full year accumulated sales
- `globalGoal` - Monthly goal (targetAmount, currentSales, percentage) - only for month filter
- `nvvPending` - Pending sales notes (totalAmount, count)
- `gdvPending` - Pending dispatch guides (totalAmount, count)
- `combinedTotal` - salesTotal + nvvPending + gdvPending
- `salesBySegment` - Array of segment data (segment, totalSales, percentage)
- `salesTrend` - For year: 12 months (Ene-Dic) with date, month, sales. For month: daily data

**Examples**:
```bash
# Full year 2025 data
curl -X GET "https://your-domain.replit.app/external-api/dashboard?period=2025" \
  -H "X-API-Key: mk_readonly_xxxxxxxxxxxxxxxxxx"

# Specific month with segment filter
curl -X GET "https://your-domain.replit.app/external-api/dashboard?period=2025-06&segment=PINTOR" \
  -H "X-API-Key: mk_readonly_xxxxxxxxxxxxxxxxxx"
```

### Other Available Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/external-api/ventas` | GET | Sales transactions |
| `/external-api/clientes` | GET | Client list |
| `/external-api/usuarios` | GET | User list |
| `/external-api/crm/leads` | GET/POST | CRM leads |
| `/external-api/notificaciones` | GET/POST | Notifications |
| `/external-api/reclamos` | GET/POST | Complaints |
| `/external-api/mantencion` | GET/POST | Maintenance requests |
| `/external-api/tareas` | GET/POST/PATCH/DELETE | Tasks |
| `/external-api/inventario` | GET | Inventory products |
| `/external-api/ecommerce/orders` | GET/PATCH | E-commerce orders |

### Active Files
- `server/routes-external.ts` - All external API endpoints
- `server/middleware/api-auth.ts` - API key validation middleware
- `shared/schema.ts` - apiKeys table schema

## Expense Management Module (Updated February 2026)

### Approval Workflow (February 2026 - Simplified)
- **RRHH-Only Approval**: Supervisor approval step has been removed. All expenses (both reembolsos and fund-backed) go directly to `pendiente_rrhh`
- **Auto Comprobante**: On RRHH approval, the expense's `archivoUrl` (photo uploaded at creation) is automatically assigned as `comprobanteUrl`. No manual URL input needed.
- **Required Photo for Reembolso**: Creating a reembolso expense requires uploading a photo/receipt. The form will not submit without one.
- **Fund-Backed Expenses**: No longer auto-approved. Require RRHH approval like reembolsos, but without requiring `comprobanteUrl`
- **Backward Compatibility**: Legacy `pendiente_supervisor` records can still be approved by RRHH
- **State Machine**: `pendiente_rrhh` → `aprobado` or `rechazado` (single step)
- **Fund Management**: Exclusively managed by RRHH (`recursos_humanos` role) and admin. Supervisors cannot manage funds.
- **Role Reference**: Always use `recursos_humanos` (never `rrhh`) when checking HR role in code
- **Supervisor Endpoints**: `/api/gastos-empresariales/:id/supervisor-approve` and `supervisor-reject` are deprecated but kept for compatibility
- **Fund Balance Source**: The Card "Fondos Asignados" in Rendición de Gastos uses backend-provided `saldoDisponible` from enriched `/api/fund-allocations` response. Never calculate saldo locally from filtered expenses.
- **Form Validation Feedback**: The expense form uses `onFormError` (react-hook-form's `onInvalid` callback) to show a toast listing missing required fields when the form fails validation.

### Reusable Filter Component (February 2026)
- **Component**: `client/src/components/gastos-filter-bar.tsx` - shared across Dashboard, Rendición de Gastos, and Gestión de Fondos tabs
- **Filters**: Month, Year, User/Colaborador (admin/supervisor/RRHH only), optional Estado and Categoría
- **Rendición tab** now filters by date range (fechaDesde/fechaHasta) server-side, matching Dashboard behavior

### Supervisor Permissions
- Supervisors now have the same data visibility as admin/RRHH roles across expense endpoints
- Only `salesperson` role is restricted to their own data
- Affected endpoints: `/api/gastos-empresariales`, analytics endpoints (`/summary`, `/por-categoria`, `/por-usuario`, `/por-dia`)

### PDF Report Generation
- **Image Handling**: Images are loaded as-is without any automatic rotation; users can manually rotate in the viewer
- **Attachment Types**: Both `archivoUrl` (invoice/receipt) and `comprobanteUrl` (transfer receipt) are included with appropriate labels
- **Fund Dates**: Funds table uses `fecha_inicio` and `fecha_termino` columns; Fund vouchers show date range format
- **Expense Notes**: Notes are fully expanded using splitTextToSize (up to 4 lines) instead of being truncated

### User Filtering
- **NEW Endpoint**: `/api/gastos-empresariales/analytics/usuarios` returns ALL unique users with ANY expense (any status, any date) OR with assigned funds
- Dashboard user dropdown uses this endpoint to always show complete list of users with expenses or funds
- Users are sorted alphabetically by name
- Cache invalidation is properly configured across all mutations (create, approve, reject, delete)

### Date Filtering (February 2026)
- All expense filtering uses `COALESCE(fechaEmision, createdAt)` to prioritize emission date
- Dashboard tables and analytics filter by emission date, not creation date
- Expenses registered in a different month than they occurred will appear under the correct emission month

### Image Viewer in Detail Dialog
- Mouse wheel zoom disabled; zoom only via buttons
- Manual rotation button added (90° clockwise)
- Reset button (Home icon) restores zoom, position, AND rotation to defaults

### PDF Image Orientation (February 2026)
- **Problem**: Images appeared correctly in web browsers (which interpret EXIF metadata) but rotated in PDFs (which ignore EXIF)
- **Solution**: Backend endpoint `/api/image-normalized` uses Sharp library to normalize EXIF orientation before PDF embedding
- **Security**: Endpoint requires authentication and validates URLs against allowed domains (Object Storage, CDN) to prevent SSRF attacks
- **Process**: Sharp's `.rotate()` reads EXIF orientation and applies it, then `.withMetadata()` removes the orientation tag