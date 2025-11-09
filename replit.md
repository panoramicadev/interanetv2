# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard designed for the Chilean market, providing comprehensive sales insights through client and user management (with role-based access), detailed sales analytics, and a mobile-responsive design. Key capabilities include CSV sales data import, KPI monitoring, trend analysis, transaction review, e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse, and an internal notification system. The project aims to enhance sales strategies and operational efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

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
- **Migrations**: Drizzle Kit + Custom production migrations via POST /api/etl/run-migrations (admin-only endpoint)
- **Schema Management**: ETL tables in "ventas" schema with ALTER TABLE-based migrations to preserve production data

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Navigation**: Clickable logo in sidebar for quick return to dashboard home.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.
- **Calendar Selector (Nov 2025)**: Enhanced year-month-day selector with range selection capabilities:
  - Two-click day range selection (click start → click end → auto-fills intermediate days)
  - Visual highlighting: start/end days with border emphasis, intermediate days fully highlighted in orange
  - "Limpiar todo" button to reset all selections (years, months, days)
  - Display format: "3-9 Noviembre 2025 (7 días)" for ranges
  - Preserves selection state when reopening calendar
  - Period selection preserved when switching between filter views (all/segment/salesperson/branch)

### Key Features
- **Client & User Management**: Role-based access and client linking.
- **CRM Pipeline System**: Kanban-style lead management.
- **E-commerce**: Order management and notifications.
- **Product Grouping System**: Parent-child product variations.
- **Technical Visits**: Multi-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPIs, trend charts, transaction records, segment analysis, period-to-period comparisons, and interactive projection visualizations.
- **Quote Management**: Role-based visibility and status updates.
- **Task Management**: For admin/supervisor roles.
- **Goals Progress**: Sales goals tracking.
- **Complaints Management (Reclamos Generales)**: Multi-area resolution with workflow automation, photo uploads, role-based filtering, and state machine.
- **Maintenance Management (Mantención)**: Equipment request system with workflow, technician assignment, and history logging.
- **CMMS (Computerized Maintenance Management System)**: Comprehensive preventive and corrective maintenance management with:
    - **Dashboard**: KPIs (MTTR, backlog, etc.), charts, filters.
    - **Equipos Críticos**: Equipment catalog with hierarchy and technical documentation.
    - **Proveedores Externos**: External maintenance provider management and evaluation.
    - **Presupuesto Anual**: Monthly budget configuration with deviation tracking and integrated planned maintenance projections.
    - **Gastos de Materiales**: Expense recording linked to work orders and suppliers.
    - **Planes Preventivos**: Scheduled preventive maintenance with automatic work order generation.
    - **Calendario de Mantención**: Monthly calendar view of preventive plans and active work orders.
    - **Scheduler Automático**: Automated job for preventive work order generation.
    - **Control de Acceso**: Specialized role-based access.
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, and calendar.
- **Inventory Module (Hybrid System)**: Real-time stock levels with integrated average pricing and low stock alerts, combining PostgreSQL catalog with live SQL Server queries.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking.
- **Internal Notifications System**: Role-based and automatic event notifications.
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table. Automated incremental ETL runs every 30 minutes, with unique index on (idmaeedo, idmaeddo) for UPSERT support. Data mapper validates and preserves precision for 18-20 digit IDs and monetary values using string-based numerics. **Field Mapping (Nov 2025)**: Corrected client, vendor, and segment joins using MAEEDO.ENDO → MAEEN.KOEN (client RUT), MAEEN.KOFUEN → TABFU.KOFU (vendor), MAEEN.RUEN → TABRU.KORU (segment). Added LTRIM/RTRIM for whitespace handling and onConflictDoNothing for duplicate prevention in staging tables. Dashboard fields (nokoen, nokofu, noruen) now populate correctly with ~100%/97%/96% coverage. **Execution Metrics (Nov 2025)**: `recordsProcessed` in execution log now tracks only NET NEW records inserted into fact_ventas (count after - count before), not total staging records processed. **Real-Time Progress (Nov 2025)**: Server-Sent Events (SSE) system for live ETL progress tracking with 10-step visualization (initialization, extraction, staging, UPSERT, validation, completion). Batch insert optimization (100-500 rows per query) improves performance for large datasets. Asynchronous execution allows immediate UI feedback while ETL runs in background.
  - **Production Reliability (Nov 2025)**: 
    - **Circuit Breaker Pattern**: SQL Server connection protection with automatic state management (CLOSED → OPEN → HALF_OPEN)
    - **Retry with Exponential Backoff**: 3 retry attempts with 2s base delay for idempotent operations
    - **Health Check Endpoint** (/api/health): Comprehensive system monitoring (PostgreSQL, ETL status, SQL Server circuit breaker, data quality metrics)
    - **Automated Health Monitoring**: Background service polls health endpoint every 10 minutes, generates admin notifications on degradation
    - **Data Quality Validation**: Automatic threshold validation for NULL values in critical fields (nokoen, nokofu, noruen) with 10% tolerance
    - **Atomic Transactions**: DELETE+INSERT in fact_ventas wrapped in transaction to guarantee consistency
    - **Timeout Controls**: 120s timeout per SQL Server request to prevent hung connections
    - **Production Logging System** (Nov 2025): Structured logging with ProductionLogger class for comprehensive error tracking:
      - **Log Levels**: DEBUG, INFO, WARN, ERROR, CRITICAL with context metadata
      - **Automatic Sanitization**: Sensitive data (passwords, tokens, API keys) automatically redacted
      - **ETL Integration**: All batch inserts log sample records, error stacks, and field lists for debugging
      - **Admin Endpoints**: GET /api/logs (with filters), GET /api/logs/stats, DELETE /api/logs (admin-only)
      - **Buffer**: 2000 logs in-memory with queryable history by level, category, and date range
      - **Schema Fix (Nov 2025)**: Corrected stg_maeddo migration with ALTER TABLE to add caprco1/caprco2 columns, resolving production batch insert errors
- **Manual Sales Projection**: Monthly to yearly calculation and "future clients" management.

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Automation**: Database migrations, ETL scheduler (30-minute intervals), preventive maintenance scheduler (daily), health monitoring (10-minute intervals)
- **Reliability Features**:
  - Circuit breaker for SQL Server connectivity
  - Automatic retry with exponential backoff
  - Health check endpoint for monitoring
  - Automated alerting system for degradations
  - Data quality validation and alerts

## 🚨 Production ETL Issue Resolved (Nov 2025)

### **Root Cause Identified**
Production ETL was failing with error: `relation "ventas.stg_tabsu" does not exist`

**What Happened**:
- Commit `48854e2` added experimental code that referenced 6 new staging tables (stg_tabsu, stg_tabzo, stg_tabfu, stg_tabfm, stg_tabpf, stg_tabhf)
- These tables were never created in the database
- Code was accidentally deployed to production
- ETL failed every 30 minutes attempting to TRUNCATE non-existent tables

**Solution Applied (Nov 9, 2025)**:
1. Identified problematic commit (`48854e2 - Add more fields to sales staging tables`)
2. Restored files from previous stable commit (`f661ff0`)
3. Removed all references to the 6 non-existent staging tables
4. Verified ETL runs successfully in development (8809 records processed without errors)

**Files Restored**:
- `server/etl-incremental.ts` - Reverted to stable version without experimental tables
- `shared/schema.ts` - Reverted to stable version without experimental schema

**Current Status**:
- ✅ Development: ETL running successfully
- ⚠️ Production: Still has broken version, needs deployment
- 📋 Action Required: Publish current stable version to production

**Deployment Instructions**:
1. Click "Publish" button in Replit
2. Wait for deployment to complete (2-3 minutes)
3. Verify ETL runs successfully in production
4. No migrations needed - code fix only

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