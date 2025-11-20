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

### Jefe de Planta - Dashboard Access Restored (November 20, 2025)
- **Change**: Restored dashboard access for `jefe_planta` role for operational oversight
- **Modules Accessible**:
  - **Dashboard Principal** (read-only sales metrics for operational planning)
  - Notificaciones
  - Visitas Técnicas
  - Reclamos
  - Mantención (full CMMS suite)
  - Inventario (with prices - simplified access)
  - Tintometría
- **Modules Restricted**:
  - CRM, Gestión de Metas, Facturas, Gestión de Usuarios, Lista de Precios, eCommerce, Gestión de Clientes, Tomador de Pedidos, Marketing, Rendición de Gastos, Monitor ETL, API Keys
- **Rationale**: Jefe de Planta needs dashboard visibility for production planning and coordination while maintaining restricted access to commercial management functions
- **Impact**: Better operational oversight while preserving security boundaries
- **Status**: ✅ Implemented

### Backend RBAC Middleware Enhancement (November 20, 2025)
- **Feature**: Implemented comprehensive role-based access control at the backend API level
- **New Middleware**:
  - `requireCommercialAccess`: Restricts commercial modules to admin, supervisor, salesperson, tecnico_obra, **jefe_planta** (updated to include dashboard viewing)
  - `requirePlantOperationsAccess`: Restricts plant operations to admin, supervisor, jefe_planta, mantencion, and plant departmental roles (excludes salesperson, tecnico_obra, client)
- **Endpoints Protected**:
  - **Commercial** (requireCommercialAccess): CRM (/api/crm/*), Goals (/api/goals/*), Users (/api/users/*), API Keys (/api/api-keys/*), Marketing (/api/marketing/*), Sales Dashboard (/api/sales/metrics, /api/sales/transactions, etc.)
  - **Plant Operations** (requirePlantOperationsAccess): Inventory Sync (/api/inventory/sync, /api/inventory/sync-history)
  - **Operational** (requireAuth - available to all authenticated users): Visitas Técnicas, Reclamos, Tintometría, Inventory (/api/inventory, /api/inventory-with-prices - all roles can see prices), Notifications
- **Inventory Access**:
  - Simplified inventory access - all plant and commercial roles can view inventory with prices
  - Frontend access: admin, supervisor, salesperson, jefe_planta, mantencion, produccion, laboratorio, logistica_bodega, planificacion, bodega_materias_primas, prevencion_riesgos
- **Security Impact**: Enforces least-privilege access while providing operational visibility where needed
- **Status**: ✅ Implemented and architect-reviewed

### User Management - All Roles Available (November 20, 2025)
- **Feature**: Complete role support in user creation and editing
- **Roles Available**:
  - Commercial: Admin, Supervisor, Vendedor, Técnico de Obra
  - Plant Management: Jefe de Planta, Mantención
  - Plant Operations: Laboratorio, Producción, Logística y Bodega, Planificación, Bodega Materias Primas, Prevención de Riesgos
  - Other: Cliente, Recepción
- **Implementation**: Updated dropdown selects in user creation/edit dialogs (desktop and mobile views) and role display labels in user tables
- **Status**: ✅ Implemented

### Inventory Access - Full Plant Roles Support (November 20, 2025)
- **Issue**: Plant roles (laboratorio, produccion, etc.) could not access inventory with prices due to backend and frontend permission mismatches
- **Root Cause**: 
  - Backend inventory endpoints (`/api/inventory-with-prices`, `/api/inventory/summary-with-prices`) used `requireCommercialAccess` which excluded plant roles
  - Frontend function `hasCommercialAccess` only checked for commercial roles, causing plant roles to call endpoints without prices
- **Fix**:
  - **Backend**: Changed inventory endpoints from `requireCommercialAccess` to `requireAuth` - all authenticated users can now access inventory with prices
  - **Frontend**: Renamed `hasCommercialAccess` to `hasInventoryAccess` and included all plant roles (laboratorio, produccion, logistica_bodega, planificacion, bodega_materias_primas, prevencion_riesgos)
  - **Sidebar**: Verified inventory link exists for jefe_planta and laboratorio roles
- **Impact**: All plant roles can now view complete inventory data with prices as intended
- **Status**: ✅ Fixed and tested