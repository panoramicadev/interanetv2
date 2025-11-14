# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard designed for the Chilean market, providing comprehensive sales insights. It includes client and user management with role-based access, detailed sales analytics, and a mobile-responsive design. The platform supports CSV sales data import, KPI monitoring, trend analysis, transaction review, e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse, and an internal notification system. The primary goal is to enhance sales strategies and operational efficiency.

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
- **PWA**: Service Worker for offline capabilities

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful API
- **Session Management**: Express sessions with PostgreSQL storage
- **File Processing**: CSV import
- **File Storage**: Replit Object Storage
- **Authentication**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, and CSRF protection
- **Authorization**: Role-based access control (Admin, Supervisor, Salesperson, Técnico de Obra, Client, departmental roles) with a 3-layer security model.

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Key Schemas**: Users, sales transactions, e-commerce, CRM, complaints, maintenance, marketing, expenses, ETL
- **Migrations**: Drizzle Kit + Custom production migrations
- **Schema Management**: ETL tables in "ventas" schema.

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
- **Sales Analytics**: KPIs, trend charts, transaction records, segment analysis, period-to-period comparisons, interactive projection visualizations, and an interactive period comparison chart.
- **Quote Management (Tomador de Pedidos)**: Role-based visibility and real-time stock display.
- **Task Management**: For admin/supervisor roles.
- **Goals Progress**: Sales goals tracking.
- **Finance Module (Gestión de Facturas)**: Unified financial management interface with tabbed navigation for invoices, sales notes, and sales projections, with role-based access. Includes NVV segment mapping for accurate attribution.
- **Complaints Management (Reclamos Generales)**: Multi-area resolution with workflow automation, photo uploads, role-based filtering, and a state machine.
- **Maintenance Management (Mantención)**: Equipment request system with workflow, technician assignment, and history logging. Includes a CMMS for comprehensive preventive and corrective maintenance.
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, and calendar.
- **Inventory Module**: Real-time stock levels with integrated average pricing and low stock alerts, combining PostgreSQL catalog with live SQL Server queries.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking.
- **Internal Notifications System**: Role-based and automatic event notifications.
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table. Features automated incremental runs, UPSERT indexing, robust data mapping, enhanced field mapping, refined execution metrics, real-time progress tracking via SSE, and production reliability features (Circuit Breaker, retry with exponential backoff, health checks, automated monitoring, data quality validation, atomic transactions, timeout controls, structured logging).
    - **GDV ETL Monitoring Module**: Dedicated PostgreSQL schema for tracking delivery status changes with FEER-based watermark and quantity tracking.
    - **NVV ETL Monitoring Module**: Dedicated PostgreSQL schema for tracking pending Notas de Venta across all branches, featuring vendor/warehouse metadata fallback, shared segment master, and accurate pending amount calculation.
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

### NVV ETL Incremental Optimization (November 14, 2025)
- **Issue Resolved**: NVV ETL was processing ALL 15,621 records every execution instead of being truly incremental
- **Root Causes**: 
  1. SQL query used fixed filter `FEEMDO >= '2025-01-01'` instead of watermark-based incremental filtering
  2. Watermarks were truncated to date (YYYY-MM-DD) instead of full timestamps, causing re-ingestion of all documents modified on the same day
- **Solution**: Changed to true incremental watermark using FEER (fecha de referencia) with full ISO timestamps
- **Changes Made**:
  - Modified MAEEDO query to use `FEER >= watermark_start AND FEER < watermark_end` with full ISO timestamps (not truncated dates)
  - Persist `watermarkDate` as complete timestamp instead of date-only string
  - Use `>=` for lower bound (inclusive) and `<` for upper bound (exclusive) - UPSERT in fact_nvv handles any duplicates at boundaries
  - Kept `FEEMDO >= '2025-01-01'` as minimum year filter to exclude pre-2025 documents
  - Changed ORDER BY from FEEMDO to FEER for consistency with watermark logic
  - Updated console logs to show full timestamps
- **Expected Result**: ETL now processes only records modified since last execution timestamp (typically 10-50 records), even when running multiple times per day. No data gaps.
- **Watermark Contract**: 
  - Upper bound watermark captured IMMEDIATELY before SQL queries
  - Filter uses: `FEER >= lastWatermark AND FEER < currentWatermark`
  - Same `currentWatermark` is persisted to database
  - Next run's lower bound equals previous run's upper bound - guarantees NO GAPS
  - UPSERT in fact_nvv handles duplicates at boundary
- **UI Fix**: Changed "Cancelar ETL Bloqueado" button text to "Cancelar ETL" for clarity
- **Schema Fix (Migration 009)**: Changed nvv.nvv_sync_log.watermark_date from DATE to TIMESTAMP type to preserve full ISO timestamp precision instead of truncating to YYYY-MM-DD. This was the root cause of watermark truncation.