# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market, offering comprehensive sales insights. It includes client and user management with role-based access, detailed sales analytics, and a mobile-responsive design. Key capabilities encompass CSV sales data import, KPI monitoring, trend analysis, transaction review, e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse, and an internal notification system. The project aims to enhance sales strategies and operational efficiency.

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
- **PWA**: Service Worker (Network-First for HTML, Stale-While-Revalidate for static assets)

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful API
- **Session Management**: Express sessions with PostgreSQL storage
- **File Processing**: CSV import
- **File Storage**: Replit Object Storage
- **Authentication**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, and CSRF protection
- **Authorization**: Role-based access control (Admin, Supervisor, Salesperson, Técnico de Obra, Client, departmental roles) with a 3-layer security model for salesperson data (Frontend Guard, Frontend UI restrictions, Backend Middleware enforcement).
- **Salesperson Dashboard**: Features reusable accordion components and a custom hook for state management, with URL encoding for dynamic path segments.

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Key Schemas**: Users, sales transactions, e-commerce, CRM, complaints, maintenance, marketing, expenses, ETL
- **Migrations**: Drizzle Kit + Custom production migrations
- **Schema Management**: ETL tables in "ventas" schema with ALTER TABLE-based migrations.

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Key Features
- **Client & User Management**: Role-based access and client linking.
- **CRM Pipeline System**: Kanban-style lead management.
- **E-commerce**: Order management and notifications.
- **Product Grouping System**: Parent-child product variations.
- **Technical Visits**: Multi-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPIs, trend charts, transaction records, segment analysis, period-to-period comparisons, and interactive projection visualizations. **Period Comparison Chart**: Interactive visualization tool in salesperson dashboard for comparing sales performance across multiple time periods simultaneously (years, months, days) with flexible selection, bar/line chart views, percentage change calculations, and detailed comparison tables. **Dashboard Period Selector**: Enhanced year-month-day selector with true multi-month selection, deselection support for full-year view, and stable state persistence across popover reopenings.
- **Quote Management (Tomador de Pedidos)**: Role-based visibility and status updates with real-time stock display.
- **Task Management**: For admin/supervisor roles.
- **Goals Progress**: Sales goals tracking.
- **Finance Module (Gestión de Facturas)**: Unified financial management interface with tabbed navigation for invoices (fact_ventas), sales notes (NVV), and sales projections, with role-based access and automatic salesperson filtering. **NVV Segment Mapping**: Uses line-level vendor code (`kofulido`) from ETL fact_ventas to correctly map pending sales notes to segments, ensuring accurate attribution when document-level and line-level vendor codes differ.
- **Complaints Management (Reclamos Generales)**: Multi-area resolution with workflow automation, photo uploads, role-based filtering, and a state machine including a technical validation flow.
- **Maintenance Management (Mantención)**: Equipment request system with workflow, technician assignment, and history logging.
- **CMMS**: Comprehensive preventive and corrective maintenance management with a dashboard, critical equipment catalog, external provider management, annual budget tracking, material expense recording, preventive plans, and a maintenance calendar.
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, and calendar.
- **Inventory Module**: Real-time stock levels with integrated average pricing and low stock alerts, combining PostgreSQL catalog with live SQL Server queries.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking.
- **Internal Notifications System**: Role-based and automatic event notifications.
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table. Features automated incremental runs, unique indexing for UPSERT, and robust data mapping for IDs and monetary values. Includes enhanced field mapping, refined execution metrics, real-time progress tracking via SSE, and production reliability features such as a Circuit Breaker Pattern for SQL Server, retry with exponential backoff, health checks, automated monitoring, data quality validation, atomic transactions, timeout controls, and a structured production logging system.
- **GDV ETL Monitoring Module**: Dedicated PostgreSQL schema (`gdv`) with isolated staging/master tables for tracking delivery status changes for branches 004, 006, 007. Features FEER-based watermark for detecting state changes, quantity tracking fields (caprco1/2, caprad1/2, caprnc1/2), and **ESLIDO field** (line-level status: NULL/'' = open, 'C' = closed) for accurate detection of truly open GDVs based on pending quantities, line status, and minimum amount threshold. Formula: `cantidad_pendiente = ((quantities pending > 0) AND (ESLIDO IS NULL OR ESLIDO = '') AND (monto >= 1000))`. The minimum amount filter excludes symbolic low-value entries ($1-$10), resulting in 60 active documents with $9.17M pending vs 175 total documents with open lines. Prevents concurrency with sales ETL through isolated tables.
- **NVV ETL Monitoring Module**: Dedicated PostgreSQL schema (`nvv`) with staging tables (stg_maeedo_nvv, stg_maeddo_nvv, stg_maeen_nvv, stg_maeven_nvv, stg_tabbo_nvv) and fact table (fact_nvv) for tracking pending Notas de Venta (Sales Notes) across all branches (004, 005, 006, 007). Features **vendor/warehouse metadata fallback system** with COALESCE(detail, header) logic ensuring all lines populate kofulido (vendor code), nombre_vendedor (vendor name), bosulido (warehouse code), and nombre_bodega (warehouse name) even when detail records inherit from MAEEDO headers. **Migration 003** adds header fallback fields (empresa, kofudo, suli, bosulido) to stg_maeedo_nvv for complete metadata resolution. **Shared Segment Master**: Uses **ventas.stg_tabru** as single source of truth for both product segments (via pr.rupr) and client segments (via en.ruen), eliminating duplicate segment tables. fact_nvv includes rupr, nombre_segmento (product segment), ruen, and nombre_segmento_cliente (client segment) with 96% coverage showing human-readable names (MCT, FERRETERIAS, CONSTRUCCION, FABRICACION MODULAR, PANORAMICA STORE). Frontend displays segment breakdown via dedicated "Por Segmento Cliente" tab with pending amounts by segment. Uses **normalizeStatus helper** to consistently handle ESLIDO field (null/'' = open, 'C' = closed). **Date Filter**: Uses FEEMDO >= '2025-01-01' (emission date) to capture all 2025 NVV documents, replacing prior FEER-based incremental approach. **Pending Amount Formula**: `cantidad_pendiente = ((ESLIDO IS NULL OR ESLIDO = '') AND ((CAPRCO2 - CAPREX2) × PPPRNE >= $1,000))` - uses **UD2 only** (secondary unit) as validated by user's Excel data. **Validation**: ETL processes 3,496 documents (15,420 lines) with 136 pending lines totaling $44,638,607 CLP, achieving **100% match** with user's validation Excel file. TABBO extraction includes warehouse pairs from both MAEEDO headers and MAEDDO details. Prevents supervisor dashboard/rollup gaps by ensuring all NVV lines resolve to vendors and warehouses. Isolated schema prevents concurrency issues with sales ETL.
- **Manual Sales Projection**: Monthly to yearly calculation and "future clients" management.

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Automation**: Database migrations, ETL scheduler, preventive maintenance scheduler, health monitoring.
- **Reliability Features**: Circuit breaker for SQL Server, automatic retry with exponential backoff, health check endpoint, automated alerting system, data quality validation and alerts.

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

## Recent Changes (November 2025)

### Unified ETL Execution Log Schema (Migrations 006 & 007)
- **Issue Resolved**: Standardized ALL ETL execution logs to use `start_time`/`end_time` instead of inconsistent `execution_date` field
- **Scope**: Unified schema across ventas.etl_execution_log, nvv.nvv_sync_log, and gdv.gdv_sync_log
- **Changes Made**:
  - **Migration 006**: Migrated ventas.etl_execution_log and nvv.nvv_sync_log to use `start_time`/`end_time` with backfill
  - **Migration 007**: Migrated gdv.gdv_sync_log to use `start_time`/`end_time` with conditional DO blocks for idempotency
  - **TypeScript Schema**: Updated shared/schema.ts for all three ETL log tables (startTime NOT NULL, endTime nullable)
  - **Code Updates**: Updated 200+ references across server/etl-incremental.ts, server/etl-nvv.ts, server/etl-gdv.ts, server/routes.ts, and server/storage.ts
- **Benefits**:
  - Consistent execution telemetry across all ETL modules
  - Richer timestamp data (start + end) instead of single execution_date
  - Prevents future schema mismatch regressions
  - Production-ready with automatic migration system
- **Validation**: All ETL modules boot cleanly, 0 LSP errors, schema verified in development and production

### SSE Progress Tracking for NVV ETL
- **Feature**: Real-time progress updates with replay buffer
- **Implementation**: Server stores last execution's events in memory and replays them to new clients for instant progress bar display
- **Benefit**: Users see progress bar immediately on page load, even if ETL started before they opened the page

### Bug Fixes (November 14, 2025)
- **ETL Monitor Frontend Fix**: Updated all TypeScript interfaces and references in `client/src/pages/etl-monitor.tsx` to use `startTime` instead of deprecated `executionDate` field, aligning with unified backend schema (ETLExecution, GdvSyncLog, NvvSyncLog). All date formatting functions now correctly reference `startTime`.
- **Client Search Endpoint Route Order Fix**: Resolved 404 error on `/api/clients/search` by moving the route definition before `/api/clients/:koen` in `server/routes.ts`. Express routes are matched in declaration order, so the parameterized route was incorrectly capturing "search" as a client koen value. Client dropdown in technical visits module now works correctly, returning search results with status 200.