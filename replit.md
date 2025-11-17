# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market, providing comprehensive sales insights. Its purpose is to enhance sales strategies and operational efficiency through features like client and user management, detailed sales analytics, mobile responsiveness, CSV data import, KPI monitoring, trend analysis, transaction review, e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse, and an internal notification system.

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
- **Core Management**: Client & user management, CRM pipeline, E-commerce, Product grouping, Task management.
- **Sales & Finance**: Sales analytics (KPIs, trends, projections, comparisons), Quote management, Goals progress, Finance module (invoices, sales notes, projections).
- **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine), Maintenance management (CMMS, equipment requests), Inventory module (real-time stock, alerts), Expense management.
- **Strategic & Data**: Marketing module, Sales forecasting (Holt-Winters), ETL Data Warehouse (automated incremental runs, UPSERT, data mapping, real-time progress, reliability features), Promesas de Compra Semanales, Manual Sales Projection.
- **Internal Systems**: Internal notification system.
- **ETL Monitoring**: Dedicated modules for GDV and NVV ETL monitoring, including change tracking and state change auditing.

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

## Recent Changes

### NVV Fact Table Missing Columns Fix (Migration 013) (November 14, 2025)
- **Issue Resolved**: Production deployment error "column 'rupr' does not exist" when accessing NVV analytics by segment
- **Root Cause**: Migration 002 created fact_nvv table but omitted segment-related columns that were defined in Drizzle schema
- **Missing Columns**: rupr, ruen, nombre_segmento, nombre_segmento_cliente
- **Solution**: ALTER TABLE to add all 4 missing TEXT columns with indexes for query performance
- **Impact**: Enables NVV "Segmento" tab analytics by customer and product segments
- **Status**: ✅ Applied successfully in development, ready for production

### GDV Staging Tables Update (Migration 014) (November 14, 2025)
- **Issue Resolved**: GDV staging tables had missing columns causing ETL failures
- **Root Cause**: Staging tables had outdated schema - stg_maepr_gdv lacked rupr, nokopr, ud01pr, ud02pr, tipr
- **Solution**: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS for all 7 staging tables
- **Tables Updated**: stg_maeedo_gdv, stg_maeddo_gdv, stg_maeen_gdv, stg_maepr_gdv, stg_maeven_gdv, stg_tabbo_gdv, stg_tabru_gdv
- **Impact**: Enables GDV ETL to run successfully with correct product segment data
- **Status**: ✅ Applied successfully in development, ready for production

### NVV Staging Tables Structure Fix (Migration 015) (November 14, 2025)
- **Issue Resolved**: CRITICAL production blocker - NVV ETL fails at MERGE step with "column bo.suli does not exist"
- **Root Cause**: Migration 002 created nvv.stg_tabbo_nvv with wrong columns (kobo, nokobo) but ETL expects (suli, bosuli, nobosuli)
  - Schema mismatch between Drizzle definition and original SQL migration
  - Development worked because db:push recreated table correctly
  - Production has old schema causing 100% failure rate on NVV ETL
- **Solution (Safe ALTER TABLE approach)**:
  - Checks if table has correct structure before modifying (idempotent)
  - Adds new columns (suli, bosuli, nobosuli) if missing
  - Migrates existing data: kobo → bosuli, nokobo → nobosuli
  - Recreates PRIMARY KEY as composite (suli, bosuli)
  - Keeps old columns for backward compatibility
  - Also adds missing columns to stg_maeen_nvv (ruen, kofuen) and stg_maepr_nvv (pfpr, fmpr, rupr, mrpr)
  - Uses DO $$ block to avoid race conditions with ETL scheduler
- **Impact**: **UNBLOCKS PRODUCTION** - NVV ETL can now complete successfully
- **Status**: ✅ Applied successfully in development, CRITICAL for production deployment

### Timezone Display Fix - Monitor ETL (November 17, 2025)
- **Issue Resolved**: Monitor ETL mostraba timestamps en UTC (12:01) en lugar de hora Chile (9:01), generando confusión de 3 horas
- **Root Cause**: Frontend usaba `new Date().toLocaleString()` que muestra hora local del browser, pero los timestamps del backend son UTC
- **Solution**:
  - Instalado `date-fns-tz` para conversiones de zona horaria
  - Creado helper `formatChileTime(utcTimestamp, format)` que convierte UTC → America/Santiago usando `formatInTimeZone()`
  - Creado helper `formatChileDistance(utcTimestamp)` que calcula tiempo relativo ("hace X tiempo") usando fecha UTC original
  - Actualizado TODAS las visualizaciones de timestamp en Monitor ETL (NVV, GDV, ventas_incremental)
- **Impact**: Todos los timestamps ahora se muestran correctamente en hora local de Chile (GMT-3 en verano, GMT-4 en invierno)
- **Status**: ✅ Implementado y testeado en development

### GDV Module - Full Functionality (November 17, 2025)
- **Issue Resolved**: Módulo GDV no tenía funcionalidades de configuración de watermark, ejecución manual, cancelación
- **Root Cause**: GDV usaba componentes custom en lugar de componentes genéricos de ETL
- **Solution**:
  - Backend: Agregado soporte para `etlName==='gdv'` en `/api/etl/execute` que ejecuta `executeGDVETL()`
  - Backend: Normalización de resultados para soportar diferentes contratos (NVVETLResult usa snake_case, GDVETLResult/ETLResult usan camelCase)
  - Frontend: Migrado GDVTabContent para usar componentes genéricos `ETLStatusSection` y `ETLHistorySection`
- **New Features for GDV**:
  - ✅ Configurar watermark custom (fecha de inicio personalizada)
  - ✅ Ejecutar ETL manualmente con un click
  - ✅ Cancelar ETL en progreso
  - ✅ Ver progreso en tiempo real vía Server-Sent Events (SSE)
  - ✅ Diagnóstico de sistema (solo admin)
  - ✅ Gestión de timeouts e intervalos
- **Impact**: Módulo GDV tiene paridad completa con NVV y ventas_incremental
- **Status**: ✅ Implementado y testeado en development