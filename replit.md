# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market designed to provide comprehensive sales insights. Its core purpose is to enhance sales strategies and operational efficiency through advanced analytics, client and user management, mobile responsiveness, and robust operational features. Key capabilities include KPI monitoring, trend analysis, sales forecasting, CRM, e-commerce integration, and specialized modules for complaints, maintenance, and technical visits. The project aims to deliver a competitive advantage through data-driven decision-making and streamlined operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Technical Implementation
- **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for state management, Shadcn/ui (Radix UI) for components, Tailwind CSS for styling, Chart.js for data visualization, Vite as build tool, and PWA capabilities via Service Worker.
- **Backend**: Node.js with Express.js, TypeScript, RESTful API design.
- **Authentication & Authorization**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, CSRF protection, and a 3-layer role-based access control (RBAC) system supporting roles like Admin, Supervisor, Salesperson, Técnico de Obra, Client, and various departmental roles including specific CMMS roles (e.g., `jefe_planta`, `mantencion`). Backend RBAC middleware ensures granular access to commercial and plant operations modules.
- **Data Processing**: CSV import, Replit Object Storage for file storage.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM. Key schemas include Users, sales transactions, e-commerce, CRM, complaints, maintenance, marketing, expenses, and ETL. Drizzle Kit and custom migrations manage schema. ETL tables are managed within the "ventas" schema.
- **Key Features**:
    - **Management**: Client & user management, CRM pipeline, E-commerce, Product grouping, Task management.
    - **Sales & Finance**: Sales analytics (KPIs, trends, projections), Quote management, Goals progress, Finance module (invoices, sales notes).
    - **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine), Maintenance management (CMMS, equipment requests), Inventory module (real-time stock, alerts), Expense management.
    - **Strategic & Data**: Marketing module, Sales forecasting (Holt-Winters), ETL Data Warehouse (automated incremental runs, UPSERT, data mapping, real-time progress, reliability features), Promesas de Compra Semanales, Manual Sales Projection.
    - **Internal Systems**: Internal notification system, ETL monitoring modules with change tracking and state change auditing.
- **Production Deployment**: Replit Autoscale Deployment with automated database migrations, ETL scheduler, preventive maintenance scheduler, and health monitoring. Includes reliability features like circuit breaker for SQL Server, automatic retry with exponential backoff, health check endpoint, automated alerting, and data quality validation.

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

## Recent Updates

### Jefe de Planta - Full Dashboard Access (November 20, 2025)
- **Issue**: Jefe_planta could see dashboard but couldn't access detail pages like salesperson details, segment details, or branch details - received 403 errors
- **Root Cause**: Backend middleware `requireOwnDataOrAdmin` only allowed admin, supervisor, and salesperson roles to access vendor-specific data endpoints
- **Fix**:
  - **server/routes.ts**: Updated `requireOwnDataOrAdmin` middleware to include `jefe_planta` role with full access to all salesperson data (line 334)
  - Now jefe_planta has same access level as admin and supervisor for viewing all sales data
- **New Capabilities for jefe_planta**:
  - ✅ View individual salesperson performance details (`/salesperson/:name`)
  - ✅ Access segment analysis and breakdowns (`/segment/:name`)
  - ✅ View branch (sucursal) sales details (`/sucursal/:name`)
  - ✅ Access all dashboard drill-down functionality
  - ✅ View comparative sales tables and charts
  - ✅ Access metrics, transactions, and client data for any salesperson
- **Backend Routes Now Accessible**:
  - `/api/sales/metrics/salesperson/:salespersonName`
  - `/api/salespeople/:salespersonName/transactions/recent`
  - `/api/sales/salesperson/:salespersonName/metrics`
  - All segment and branch analytics endpoints
- **Impact**: Jefe_planta can now fully utilize all dashboard features and derived pages for comprehensive sales oversight
- **Status**: ✅ Implemented and deployed

### CMMS Module - Route Access Fixed for All Plant Roles (November 20, 2025)
- **Issue**: All plant roles (jefe_planta, mantencion, laboratorio, produccion, etc.) could not access CMMS modules - page would restart/redirect
- **Root Cause**: App.tsx routing had hardcoded role checks instead of using granular permission functions
- **Fix**: Updated all CMMS routes to use permission functions from `cmmsPermissions.ts`
- **Impact**: All plant roles can now access their permitted CMMS modules
- **Status**: ✅ Fixed and deployed

### Sidebar Configuration - Notificaciones Position (November 20, 2025)
- **Change**: Moved "Notificaciones" menu item to top position (above Dashboard) for jefe_planta role
- **File**: `client/src/config/sidebar-config.ts`
- **Impact**: Improved UX by prioritizing notifications visibility
- **Status**: ✅ Implemented

### Reclamos Module - Full Access for Jefe de Planta (November 20, 2025)
- **Issue**: Jefe_planta could only see reclamos assigned to "producción" area, not all areas
- **Root Cause**: Backend automatically filtered reclamos by user's mapped area (jefe_planta → producción)
- **Fix**:
  - **shared/reclamosAreas.ts**: Added `canViewAllReclamos()` function that returns true for admin, supervisor, and jefe_planta
  - **server/routes.ts**: Updated `/api/reclamos-generales` endpoint to skip area filtering for users who can view all reclamos (lines 9086-9095)
  - Now jefe_planta can access the "Todos" tab and see ALL reclamos from ALL areas (producción, laboratorio, logística, aplicación, envase, etiqueta, materia_prima, colores)
- **New Capabilities for jefe_planta**:
  - ✅ View all reclamos from all areas in "Todos" tab
  - ✅ View reclamos assigned to producción in "Asignados a Producción" tab
  - ✅ Complete oversight of all complaints across the organization
  - ✅ Same access level as admin and supervisor for reclamos management
- **Frontend Tabs Available**:
  - "Asignados a Producción" - Reclamos specifically assigned to production area
  - "Todos" - ALL reclamos from ALL areas (production, lab, logistics, application, packaging, labels, raw materials, colors)
  - "Resueltos" - Resolved complaints
  - "Cerrados" - Closed complaints
- **Impact**: Jefe_planta now has comprehensive visibility into all organizational complaints for complete operational oversight
- **Status**: ✅ Implemented and deployed

### Inventory Module - Sync Button Access for Jefe de Planta (November 20, 2025)
- **Issue**: Jefe_planta couldn't see the "Sincronizar Catálogo" button in the Inventory module
- **Root Cause**: Frontend role check for sync button didn't include jefe_planta role (line 116)
- **Fix**:
  - **client/src/pages/inventario.tsx**: Added `jefe_planta` to the list of roles allowed to see the sync button
  - Now jefe_planta can synchronize inventory catalog from SQL Server
- **New Capabilities for jefe_planta**:
  - ✅ Access to "Sincronizar Catálogo" button in Inventory page
  - ✅ Ability to trigger manual inventory synchronization from SQL Server
  - ✅ Same sync capabilities as admin, supervisor, salesperson, produccion, laboratorio, and logistica_bodega
- **Impact**: Jefe_planta can now manage inventory synchronization as part of plant operations oversight
- **Status**: ✅ Implemented and deployed

### CMMS Dashboard - Limited Access for Plant Roles (November 20, 2025)
- **Issue**: All plant roles could see Dashboard CMMS with metrics and statistics, but limited roles should only create OT and view calendar
- **Root Cause**: Dashboard CMMS was visible to all roles with CMMS access
- **Fix**:
  - **client/src/lib/cmmsPermissions.ts**: Created `canViewCMMSDashboard()` function that only allows admin, jefe_planta, mantencion, supervisor to view dashboard
  - **client/src/App.tsx**: Updated routing for `/cmms` and `/cmms/dashboard` to use `canViewCMMSDashboard()` instead of `canViewCMMS()`
  - **client/src/config/sidebar-config.ts**: Removed "Dashboard CMMS" menu item from roles: produccion, logistica_bodega, planificacion, bodega_materias_primas
- **Access Matrix**:
  - **Full Dashboard Access** (admin, jefe_planta, mantencion, supervisor):
    - ✅ Dashboard CMMS with metrics and statistics
    - ✅ Create work orders (OT)
    - ✅ View calendar
  - **Limited Access** (produccion, logistica_bodega, planificacion, bodega_materias_primas, laboratorio):
    - ❌ Dashboard CMMS (hidden)
    - ✅ Create work orders (OT)
    - ✅ View calendar
- **Impact**: Limited plant roles now have a simplified CMMS menu focused on operational tasks (creating OT and viewing schedules) without access to management metrics
- **Status**: ✅ Implemented and deployed