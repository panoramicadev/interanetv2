# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market, designed to provide comprehensive sales insights and enhance sales strategies and operational efficiency. It offers KPI monitoring, trend analysis, sales forecasting, CRM, and e-commerce integration. The project includes specialized modules for complaints, maintenance, and technical visits, aiming to provide a competitive advantage through data-driven decision-making and streamlined operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Technical Implementation
- **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for state management, Shadcn/ui (Radix UI) for components, Tailwind CSS for styling, Chart.js for data visualization, Vite as build tool, and PWA capabilities.
- **Backend**: Node.js with Express.js, TypeScript, RESTful API design.
- **Authentication & Authorization**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, CSRF protection, and a 3-layer role-based access control (RBAC) system (Admin, Supervisor, Salesperson, Técnico de Obra, Client, and various departmental roles including CMMS roles). Backend RBAC middleware ensures granular access.
- **Data Processing**: CSV import, Replit Object Storage for file storage.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM. Schemas include Users, sales transactions, e-commerce, CRM, complaints, maintenance, marketing, expenses, and ETL. Drizzle Kit manages schema.
- **Key Features**:
    - **Management**: Client & user management, CRM pipeline, E-commerce, Product grouping, Task management.
    - **Sales & Finance**: Sales analytics (KPIs, trends, projections), Quote management, Goals progress, Finance module (invoices, sales notes).
    - **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine), Maintenance management (CMMS, equipment requests), Inventory module (real-time stock, alerts), Expense management.
    - **Strategic & Data**: Marketing module, Sales forecasting (Holt-Winters), ETL Data Warehouse (automated incremental runs, UPSERT, data mapping, real-time progress, reliability features), Promesas de Compra Semanales, Manual Sales Projection.
    - **Internal Systems**: Internal notification system, ETL monitoring modules with change tracking and state change auditing.
- **Production Deployment**: Replit Autoscale Deployment with automated database migrations, ETL scheduler, preventive maintenance scheduler, and health monitoring. Includes reliability features like circuit breaker, automatic retry, health check endpoint, automated alerting, and data quality validation.

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

### NVV ETL - Full Synchronization Mode (December 1, 2025)
- **Issue**: NVV ETL used incremental watermark-based approach which caused historical accumulation
- **Problem**: NVV (Notas de Venta) are transient - they disappear when converted to GDV/invoices, so historical data was incorrect
- **Solution**: Changed to full synchronization (snapshot) approach
- **Changes Made (server/etl-nvv.ts)**:
  - Removed watermark-based incremental extraction
  - Now extracts ALL current NVV from SQL Server (no FEER date filter)
  - Implements DELETE ALL + INSERT ALL strategy in atomic transaction
  - NVV that no longer exist in source are automatically removed from fact_nvv
- **Metrics Implementation**:
  - `nvv_eliminadas`: Real count of NVV IDs that were removed (compared by ID, not delta)
  - `status_changes`: Actual state transitions detected (open→closed)
  - `records_inserted`: Total records inserted after sync
  - Accurate metrics even when new NVV offset closed ones
- **Dashboard Changes**:
  - Vendor/segment mapping now uses fact_nvv table (kofulido field) instead of fact_ventas
  - Fixed column name bug (total_pendiente vs totalPendiente)
- **Benefits**:
  - ✅ Reflects current pending sales state accurately
  - ✅ Automatically removes NVV converted to invoices
  - ✅ Accurate metrics for monitoring
  - ✅ Proper snapshot behavior for transient data
- **Status**: ✅ Fully implemented and tested

### Unified Tasks System Implementation (December 1, 2025)
- **Feature**: Unified task management system that integrates marketing tasks with general tasks
- **Schema Changes**:
  - Added `tipo` field to `tareas_marketing` table with values 'marketing' | 'general' (default: 'marketing')
  - Created index on `tipo` column for efficient filtering
- **Backend Implementation (server/routes.ts, server/storage.ts)**:
  - New `/api/tareas` endpoint suite with full RBAC:
    - GET `/api/tareas` - List tasks with role-based filtering
    - GET `/api/tareas/usuarios-asignables` - Get assignable users based on role
    - GET `/api/tareas/:id` - Get single task
    - POST `/api/tareas` - Create new task (admin/supervisor only)
    - PATCH `/api/tareas/:id` - Update task
    - POST `/api/tareas/:id/toggle` - Toggle task status
    - DELETE `/api/tareas/:id` - Delete task (admin only)
  - Role-based access control:
    - Admin: Full access, can assign to anyone
    - Supervisor: Can view/assign to team members only (via supervisorId relationship)
    - Salesperson: Can view only assigned tasks, can toggle status
  - Updated existing `/api/marketing/tareas` to filter/create with `tipo='marketing'`
- **Frontend Integration**:
  - Added "Tareas" menu item to sidebar for admin, supervisor, and salesperson roles
  - Marketing tasks appear in both marketing module and general tasks panel when tipo='marketing'
- **Security**: DELETE restricted to admin-only; supervisors cannot access outside-team tasks
- **Status**: ✅ Fully implemented and tested

### CMMS Mantenciones - Complete Access for Jefe Planta and Mantencion (November 23, 2025)
- **Issue**: Jefe_planta and mantencion roles needed full access to ALL maintenance module functionalities (create OT, assign technicians, change status, submit resolutions, close OT, pause/resume, manage expenses, update, delete)
- **Root Cause**: Backend endpoints had hardcoded `allowedRoles` lists that were incomplete for maintenance operations
- **Complete Fix Applied**:
  - **server/routes.ts**: Updated ALL `/api/mantenciones/*` endpoints to include `jefe_planta` and `mantencion`:
    - GET `/api/mantenciones` - View all maintenance requests (with filters)
    - GET `/api/mantenciones/:id` - View specific maintenance request
    - GET `/api/mantenciones/:id/details` - View detailed maintenance request with photos/historial
    - POST `/api/mantenciones` - Create new maintenance request (OT) with photo upload
    - PATCH `/api/mantenciones/:id` - Update maintenance request ✅ NEW
    - DELETE `/api/mantenciones/:id` - Delete maintenance request (anytime for jefe_planta/mantencion) ✅ NEW
    - POST `/api/mantenciones/:id/photos` - Upload photos to OT
    - POST `/api/mantenciones/:id/assign-tecnico` - Assign technician to OT
    - POST `/api/mantenciones/:id/cambiar-estado` - Change OT status
    - POST `/api/mantenciones/:id/resolucion` - Submit resolution with photos
    - POST `/api/mantenciones/:id/cerrar` - Close OT
    - POST `/api/mantenciones/:id/pausar` - Pause OT
    - POST `/api/mantenciones/:id/reanudar` - Resume OT
    - POST `/api/mantenciones/:id/iniciar-trabajo` - Start work on OT
    - GET `/api/mantenciones/:id/gastos` - View OT expenses
    - POST `/api/mantenciones/:id/gastos` - Add material expenses to OT
    - PATCH `/api/mantenciones/:id/asignacion` - Update OT assignment (técnico/proveedor) ✅ NEW
  - **server/auth.ts**: Verified CMMS middleware already configured correctly:
    - `requireCMMSFullAccess` = ['admin', 'jefe_planta'] - Full access to equipment, metrics, budgets
    - `requireCMMSMaintenance` = ['admin', 'jefe_planta', 'mantencion'] - Access to maintenance plans, preventive plans
    - `requireCMMSPlantStaff` = all plant roles - Access to view OT and calendar
- **New Capabilities**:
  - ✅ Jefe_planta has COMPLETE administrative access to entire maintenance module
  - ✅ Jefe_planta can create, view, edit, delete, assign, schedule, resolve, close, pause, resume ALL OTs
  - ✅ Jefe_planta can manage expenses, equipment, preventive plans, maintenance plans
  - ✅ Mantencion role has full operational access to OT management (create, assign, resolve, manage)
  - ✅ Both roles can delete OT anytime (no time restrictions)
  - ✅ Both roles can update OT assignments and details
  - ✅ Consistent permissions across all 15+ maintenance endpoints
- **Access Matrix**: Jefe_planta and mantencion now have same access as admin for ALL maintenance operations
- **Impact**: Complete CMMS functionality unlocked for plant manager and maintenance team - full control over equipment lifecycle, preventive maintenance, work orders, and materials management
- **Status**: ✅ Fully implemented and tested

### CMMS Preventive Plans - Enhanced Features (November 21, 2025)
- **Feature Enhancement**: Preventive maintenance plans now support both equipment-specific and general maintenance tasks
- **Changes Made**:
  - **Database**: Added `checklistTareas` column to `solicitudesMantencion` table for proper task tracking in work orders
  - **Backend (server/storage.ts)**: Updated `generateOTFromPlan()` function to handle both equipment-specific and general tasks
  - **Frontend (client/src/pages/cmms-planes-preventivos.tsx)**: Added view dialog with full plan visualization
- **New Capabilities**:
  - ✅ Create preventive plans without selecting equipment (for general maintenance tasks)
  - ✅ View complete plan details including task checklist
  - ✅ Automatic OT generation properly copies task checklist
- **Status**: ✅ Implemented and tested

### Complaints Area Mapping - Specific Areas to Operative Areas (November 24, 2025)
- **Requirement**: Specific complaint areas (Envase, Etiqueta, Colores) must automatically route to corresponding operative areas (Logística, Producción)
- **Implementation**:
  - **shared/reclamosAreas.ts**: Created centralized area mapping system
    - `AREA_ESPECIFICA_TO_OPERATIVA`: Mapping object for Envase→Logística, Etiqueta→Producción, Colores→Producción
    - `mapToOperativeArea()`: Function to convert specific area to operative area
    - `getRoleArea()`: Function to extract operative area from user role
    - Updated `ROLE_TO_AREA_MAP` for area-specific roles (area_envase, area_etiqueta, area_colores)
  - **server/storage.ts**: Updated filtering and permissions
    - `getAllReclamosGenerales()`: When filtering by operative area, includes all specific areas that map to it
      - Example: filtering by 'produccion' includes 'produccion', 'etiqueta', 'colores'
      - Example: filtering by 'logistica' includes 'logistica', 'envase'
    - `updateResolucionArea()`: Permission validation uses centralized mapping
      - Logística users can resolve Envase complaints
      - Producción users can resolve Etiqueta/Colores complaints
- **Capabilities**:
  - ✅ When Técnico de Obra assigns complaint to 'Envase', it arrives to Logística users
  - ✅ When Técnico de Obra assigns complaint to 'Etiqueta' or 'Colores', it arrives to Producción users
  - ✅ Area filtering respects mappings (filtering by 'produccion' shows etiqueta/colores complaints)
  - ✅ Resolution permissions validate against operative areas (cross-area access prevented)
  - ✅ Centralized mapping ensures consistency across all complaint operations
- **Status**: ✅ Fully implemented and tested

### Jefe de Planta - Full Dashboard Access (November 20, 2025)
- **Issue**: Jefe_planta could see dashboard but couldn't access detail pages - received 403 errors
- **Root Cause**: Backend middleware `requireOwnDataOrAdmin` excluded jefe_planta role
- **Fix**: Updated middleware to include `jefe_planta` with full access to all salesperson data
- **Status**: ✅ Resolved
