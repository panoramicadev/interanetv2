# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market, providing comprehensive sales insights. Its purpose is to enhance sales strategies and operational efficiency through features like client and user management, detailed sales analytics, mobile responsiveness, CSV data import, KPI monitoring, trend analysis, transaction review, e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse, and an internal notification system. The project aims to provide a competitive edge through data-driven decisions and operational excellence.

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

### CMMS Role-Based Access Control (RBAC) - Granular Permissions (November 20, 2025)
- **Feature**: Implemented granular role-based access control for CMMS module
- **New Roles Added**:
  - `jefe_planta` (Plant Manager): Full CMMS access, focused on plant operations
  - `mantencion` (Maintenance Staff): Limited CMMS access - can manage work orders, preventive plans, and planned maintenance
  - Plant departmental roles: `laboratorio`, `produccion`, `logistica_bodega`, `planificacion`, `bodega_materias_primas` (view-only access to work orders and calendar)
- **Permission System**:
  - **Admin & Jefe Planta**: Full CMMS access - Equipos, Proveedores, Presupuesto, Gastos, Planes Preventivos, Mantenciones Planificadas, OT, Calendario
  - **Mantencion**: Limited access - Planes Preventivos, Mantenciones Planificadas, OT (can create, resolve, but cannot delete), Calendario
  - **Plant Staff**: View-only - OT (can create only), Calendario
- **Implementation**:
  - Created module-specific permission helpers in `client/src/lib/cmmsPermissions.ts`
  - Applied granular middleware to ~40 CMMS backend endpoints
  - Updated CMMS Dashboard to show only permitted modules per role
  - Updated sidebar navigation with role-based filtering
- **Status**: ✅ Implemented and architect-reviewed

### Jefe de Planta - Commercial Module Access Removed (November 20, 2025)
- **Change**: Removed commercial module access from `jefe_planta` role to focus strictly on plant operations
- **Modules Removed**:
  - Dashboard Principal, CRM, Gestión de Metas, Facturas, Gestión de Usuarios, Lista de Precios, eCommerce, Gestión de Clientes, Tomador de Pedidos, Marketing, Rendición de Gastos, Monitor ETL, API Keys
- **Modules Retained** (Plant Operations):
  - Notificaciones
  - Visitas Técnicas
  - Reclamos
  - Mantención (full CMMS suite)
  - Inventario
  - Tintometría
- **Rationale**: Jefe de Planta role is now purely operational, focusing on plant maintenance, quality control, and production support. Commercial functions (sales, pricing, customer management) are handled exclusively by admin and supervisor roles.
- **Impact**: Clear separation between commercial and operational responsibilities
- **Status**: ✅ Implemented