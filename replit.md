# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a Spanish-language sales analytics dashboard designed for the Chilean market. It provides client and user management (with role-based access), detailed sales analytics, and a mobile-responsive design. The application enables users to import CSV sales data, monitor KPIs, analyze trends, and review transaction records, offering critical insights into sales performance for sales teams and managers. Key features include e-commerce integration, a CRM pipeline, a product grouping system, technical visit management, and robust complaints and maintenance management systems. It also incorporates a sales forecasting system, an ETL data warehouse for robust data processing, and a comprehensive internal notification system.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 4, 2025 - CRM Smart Inactivity Alerts
**Added intelligent inactivity alerts in CRM lead cards:**
- Automatic calculation of days since last update for each lead
- Visual alerts displayed directly on lead cards (both column and list views)
- Three-tier alert system based on inactivity duration:
  - **7-13 days**: Yellow warning badge
  - **14-20 days**: Orange danger badge
  - **21+ days**: Red critical badge
- Alert shows "Sin movimiento por X días" with clock and alert icons
- Helps sales teams identify stagnant leads that need attention
- Alerts automatically update based on lead's `updatedAt` timestamp
- Works seamlessly with existing CRM functionality and drag-and-drop features

### November 4, 2025 - Manual Sales Projection System Enhancements
**Enhanced manual sales projection functionality:**
- **Monthly to Yearly Calculation**: Monthly amounts automatically sum to calculate yearly totals - users enter monthly projections and the system computes annual values
- **Future Client Creation**: New "Agregar Cliente Futuro" button enables adding fictitious/future clients for projection purposes
- **Client Code Normalization**: Automatic normalization of client codes (removes accents, special characters) for database compatibility
- **Robust Validations**: Input validation for client name, segment, and salesperson selection before creating future clients
- **UX Improvements**: Tooltip on disabled button explaining vendor selection requirement, clear error messages
- **Monthly Breakdown View**: Expandable rows show month-by-month projections with automatic annual totals
- Future clients use `FUTURO-{NORMALIZED-NAME}` format for unique identification
- Initial $0 projection created for January to make future clients appear in the table
- Full integration with existing projection system - no disruption to historical data or calculations
- **Security Enhancements**: Role-based access control implemented with strict permission validation
  - Salespeople can only view/create/edit/delete their own projections (supports both `salespeople_users` and regular `users` with `salespersonName`)
  - Supervisors can only manage projections within their assigned segment, with filtered salesperson dropdown showing only their segment vendors
  - Admins have full access to all projections
  - Critical authorization bypass vulnerability fixed - users without required metadata (salespersonName/assignedSegment) are properly rejected
  - All endpoints validate user permissions before allowing data access or modifications
  - New `getSalespeopleBySegment()` method filters salespeople by segment for supervisor role
  - All projection endpoints (GET historic, GET projections, POST create, DELETE) use consistent dual-source salesperson code lookup

### November 4, 2025 - Smart Sales Notifications & Period Display for Salesperson Dashboard
**Added intelligent sales notifications and period display:**
- Dashboard now displays the currently selected period (day, month, year, or date range) prominently in the header
- Implemented smart sales notifications system with three categories:
  - **Clientes Inactivos**: Shows clients who haven't purchased in 30+ days with their last purchase amount and historical sales
  - **Clientes Estacionales**: Identifies clients who frequently purchase during the current month based on historical patterns
  - **Productos en Tendencia**: Highlights products with significant growth (10%+) in the last 30 days compared to the previous 30 days, with actionable recommendations
- New backend endpoint `/api/sales/salesperson/:salespersonName/smart-notifications` provides real-time sales insights
- Smart notifications displayed in dedicated card with modern UI showing top 3 items per category
- All notifications are sales-focused and provide actionable insights to increase sales performance
- Notifications refresh automatically when period or salesperson changes

### November 4, 2025 - Notifications Access for Salesperson Role
**Added notifications menu item for salespeople:**
- Added "Notificaciones" menu item to salesperson navigation sidebar (first item in menu)
- Notifications page (`/notificaciones`) now accessible to salespeople with unread count badge
- Salespeople can view and manage all general system notifications from dedicated page
- Dashboard remains clean without notifications sidebar - access via menu only

### November 3, 2025 - React Hooks Order Fix in Salesperson Dashboard
**Fixed "Rendered more hooks than during the previous render" error:**
- Root cause: Hooks (`useMemo`, `useQuery`) were executing AFTER conditional returns, causing inconsistent hook count between renders
- Solution: Moved ALL hooks (notifications query, groupedClients memo, salesData memo) BEFORE all conditional returns
- Added clear sentinel comment "ALL HOOKS MUST BE ABOVE THIS LINE" to prevent future regressions
- Removed conditional rendering of `NotificationsPanel` - now always renders with empty string fallbacks
- Fixed backend column names in `getSalespersonProducts`: `nokopr` → `nokoprct`, `cant` → `caprco1`
- All queries remain protected by `enabled` flags for optimal performance

### November 3, 2025 - Salesperson Dashboard Data Parity Fix
**Fixed critical data inconsistency between salesperson dashboard and admin panel:**
- Dashboard now uses identical endpoints to salesperson-detail view: `/api/sales/salesperson/{name}/details`, `/clients`, `/products`, and `/api/sales/transactions`
- Implemented robust fallback for users without `salespersonName`: automatically fetches from `/api/users/salespeople` by user ID
- All queries properly gated with `enabled: !!salespersonName && !isLoadingSalespeopleFallback` to prevent race conditions
- Transactions data now correctly extracts `items` array from paginated response
- Loading states improved to prevent premature configuration errors during fallback lookup

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Build Tool**: Vite
- **PWA**: Service Worker v2.0.0 with Network-First strategy for HTML and Stale-While-Revalidate for static assets. Minimal precaching (only favicon and manifest) to prevent users getting stuck with old versions.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful API
- **Session Management**: Express sessions with PostgreSQL storage
- **File Processing**: CSV import
- **File Storage**: Replit Object Storage (Google Cloud Storage) for persistent file storage (images, documents).
- **Authentication**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, and CSRF protection.
- **Authorization**: Role-based access control (e.g., Admin, Supervisor, Salesperson, Técnico de Obra, Client, and various departmental roles).

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Key Schemas**: Covers users, sales transactions, e-commerce, CRM, complaints, maintenance, marketing, expenses, and ETL.
- **Migrations**: Drizzle Kit

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Key Features
- **Client & User Management**: Role-based access and client linking.
- **CRM Pipeline System**: Kanban-style lead management with customizable stages, role-based access, and activity tracking.
- **E-commerce**: Order management and notifications.
- **Product Grouping System**: Parent-child product variations.
- **Technical Visits**: Multi-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPIs, trend charts, detailed transaction records, segment analysis, and period-to-period comparisons.
- **Quote Management**: Role-based visibility, status updates, PDF integration.
- **Task Management**: Comprehensive system for admin/supervisor roles.
- **NVV Import & Dashboard Integration**: CSV import and dashboard display of NVV records.
- **Goals Progress**: Sales goals tracking based on Ventas Totales.
- **Dashboard Enhancements**: Modern 3-card layout, YTD comparison, salesperson detail views, and goal metrics display.
- **Complaints Management (Reclamos Generales)**: Multi-area complaint resolution with workflow automation, photo uploads, role-based filtering, severity levels, and state machine.
- **Maintenance Management (Mantención)**: Equipment maintenance request system with workflow, technician assignment, photo evidence, cost/time tracking, and history logging.
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, customizable checklists, and interactive calendar with milestone tracking.
- **Inventory Module (Hybrid System)**: Real-time stock levels with integrated average pricing, combining PostgreSQL product catalog with live SQL Server stock queries. Includes manual catalog sync and low stock alerts.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking and compliance comparison.
- **Internal Notifications System**: Role-based notification creation, archiving, and automatic event notifications for key system activities (e.g., new complaints, maintenance requests, inactive clients).
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections, integrated into the Facturas interface with historical data analysis and interactive charts.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table. Supports Full Annual ETL and Automatic Incremental ETL with a monitor panel for status and control.

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Automation**: Database migrations, ETL scheduler (every 15 mins), initial ETL run after startup.
- **Monitoring**: `/etl-monitor` route for real-time status and history.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless
- **Object Storage**: Replit Object Storage (Google Cloud Storage backend)
- **Hosting**: Replit deployment environment

### Third-Party Libraries
- **UI Framework**: Radix UI
- **Charts**: Chart.js
- **Validation**: Zod
- **Date Handling**: date-fns
- **PDF Generation**: @react-pdf/renderer
- **CSV Parsing**: Papa Parse