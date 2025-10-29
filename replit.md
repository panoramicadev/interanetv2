# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a Spanish-language sales analytics dashboard for the Chilean market, providing client and user management (with role-based access), detailed sales analytics, and a mobile-responsive design. It enables users to import CSV sales data, monitor KPIs, analyze trends through charts, and review transaction records. The application aims to provide sales teams and managers with critical insights into sales performance, incorporating recent enhancements like e-commerce integration, a new "Técnico de Obra" role, and improved technical visit and PDF generation systems.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with react-chartjs-2
- **Build Tool**: Vite
- **PWA**: Service Worker with network-first caching and automatic update detection.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful API
- **Session Management**: Express sessions with PostgreSQL storage
- **File Processing**: CSV import
- **File Storage**: Replit Object Storage (Google Cloud Storage) for permanent storage of product images, group photos, complaint photos, maintenance evidence, and expense receipts. All image uploads use Object Storage to ensure persistence across server restarts and deployments.
- **Authentication**: Passport.js Local Strategy with bcrypt for hashing, HTTP-only cookies, and CSRF protection. Role-based access control (Admin, Supervisor, Logística y Bodega, Salesperson, Técnico de Obra, Client, Reception, Laboratorio, Area Producción, Area Logística, Area Aplicación, Area Materia Prima, Area Colores, Area Envase, Area Etiqueta). Dashboard access: Admin, Supervisor, Logística y Bodega (full analytics); Salesperson (personal metrics). Module permissions: NVV (Admin, Supervisor, Logística y Bodega), Inventario (Admin, Supervisor, Salesperson, Logística y Bodega).

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Key Schemas**: Users, sales_transactions, ecommerceOrders, notifications, crmLeads, crmStages, reclamosGenerales, solicitudesMantencion, mantencionPhotos, mantencionResolucionPhotos, mantencionHistorial, presupuestoMarketing, solicitudesMarketing, gastosEmpresariales, hitosMarketing, stgMaeedo, factVentas, etlConfig, etlExecutionLog.
- **Migrations**: Drizzle Kit

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Key Features
- **Client & User Management**: Client credential assignment, user-client linking, role-based access.
- **CRM Pipeline System**: Comprehensive lead management with Kanban-style board featuring 8 customizable pipeline stages (Nuevo, Contacto, Visita, Lista Precio, Campaña, Primera Venta, Promesa, Venta). Visual drag-free column layout where leads are organized by stage with real-time counters. Interactive stage selector dropdown in each lead card for quick stage transitions. Role-based access control: admins see all leads and can delete, supervisors see leads from their assigned segment, salespeople see only their own leads. Integration with Promesas de Compra system for seamless purchase promise tracking. Admin-only stage management interface for adding/removing/reordering pipeline stages with custom colors. Chilean peso formatting throughout with activity tracking (calls, WhatsApp). Full CRUD operations with search functionality across client names, emails, and phone numbers.
- **E-commerce**: Order management and notification system.
- **Product Grouping System**: Parent-child product variations with CRUD operations.
- **Technical Visits**: Four-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPI metrics, sales trend charts, detailed transaction records, segment analysis, accurate period-to-period comparisons, and exclusion of GDV transactions.
- **Quote Management**: Role-based visibility, real-time status updates, PDF integration, sharing options.
- **Task Management**: Comprehensive system for admin/supervisor roles.
- **NVV Import & Dashboard Integration**: Direct CSV import of NVV records with pre-calculated fields, displayed on dashboard.
- **Goals Progress**: Sales goals measured exclusively using Ventas Totales (excluding GDV).
- **Dashboard Enhancements**: 3-card layout (Ventas Totales, Total Acumulado del Año, Unidades Vendidas), best historical year, YTD comparison, embedded salesperson detail views with modern design (rounded-3xl cards, border-0, pastel gradient backgrounds, circular colored icon backgrounds), goal metrics display showing percentage achieved and current sales vs target in separate boxes.
- **Complaints Management (Reclamos Generales)**: Multi-area complaint resolution system with complete workflow automation. Vendors/admins/supervisors/técnicos create complaints selecting from 12 predefined motivos (Etiquetado, Sellado, Llenado del envase, Formato de envase, Calidad de producto, Diferencia de color, Pedido incompleto, Producto expirado, Estado del envase no adecuado, Producto cambiado, Mal aplicación, Otro) that automatically suggest responsible areas (Producción, Laboratorio, Logística, Aplicación/Cliente). Technical validation by tecnico_obra role determines if claim proceeds and assigns final area. Area-specific teams (area_produccion, area_logistica, area_aplicacion, laboratorio, area_materia_prima, area_colores, area_envase, area_etiqueta) resolve claims with photographic evidence. Features: optimized photo uploads (client-side compression to max 1920px, JPEG 0.8 quality, reducing file size 70-80%), role-based filtering, severity levels, state machine (registrado → en_revision_tecnica → en_area_responsable → resuelto → cerrado), tabbed views (Todos, Mis Reclamos, Pendientes Validación, Asignados a Mi Área, Resueltos, Cerrados), history logging, atomic database updates to prevent race conditions, and automatic rollback on upload failure. Creator can delete own reclamo within 5 minutes for error recovery.
- **Maintenance Management (Mantención)**: Equipment maintenance request system for tracking repairs and maintenance activities. Authorized roles (admin, supervisor, produccion, planificacion, logistica_bodega, bodega_materias_primas) can create maintenance requests for equipment failures or preventive maintenance. Features include: Equipment identification (name, code, area, location), problem description with photo uploads, severity levels (baja, media, alta, critica), maintenance types (correctivo, preventivo, predictivo), state machine workflow (registrado → en_reparacion → resuelto → cerrado), technician assignment, resolution submission (restricted to produccion role with description and photo evidence), cost and time tracking (estimated vs. actual), and complete history logging. Tab-based filtering by status, detailed equipment information display, and Zod validation on all critical API endpoints ensure data integrity and proper role-based access control throughout the maintenance workflow.
- **Marketing Module**: Budget configuration, request submission, workflow states, reference URLs/PDFs, metrics dashboard, customizable checklist system for tasks within requests, and interactive calendar system for managing project milestones and deadlines. Calendar features: monthly view with date navigation, color-coded milestone types (general, campaña, evento, deadline), click-to-create milestones, completion tracking, and role-based access (admin/supervisor only).
- **Inventory Module**: Real-time stock levels, warehouse filtering, low stock alerts, and summary metrics.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, status tracking, and analytics dashboard.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking, compliance comparison with actual sales, and visual indicators.
- **ETL Data Warehouse**: PostgreSQL schema "ventas" with staging tables and a denormalized `fact_ventas` table. Supports Full Annual ETL and Automatic Incremental ETL (every 15 minutes) with watermark tracking. An "ETL Monitor Panel" provides a visual interface for status, history, manual triggers, and configuration. Features include: configurable watermark (custom starting date for data extraction with persistent mode via keepCustomWatermark checkbox), automatic timeout protection (10-minute default, configurable), and date-filtered execution history. ETL processes include automatic cancellation for stuck processes and proper cleanup on completion or error. **Phase 1** (5 critical fields) and **Phase 2** (8 business fields) completed with 97% data completeness across 16,980 records. Phase 2 fields include: lilg (liquidation indicator), modo/timodo/tamodo (transaction modality), ocdo (purchase order), zona/ruen (optional geographic/entity fields), and udtrpr (product unit). Advanced data handling includes regex validation for mixed-type fields and precise type conversion between SQL Server and PostgreSQL.

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Build/Run Commands**: `npm run db:push && npm run build` and `sh scripts/production-start.sh` for migrations and server startup.
- **Automatic Processes**: Database migrations, ETL scheduler (every 15 mins), initial ETL run 30s after startup.
- **Monitoring**: `/etl-monitor` route for real-time status and history.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless
- **Object Storage**: Replit Object Storage (Google Cloud Storage backend) for persistent file storage
- **Hosting**: Replit deployment environment

### Third-Party Libraries
- **UI Framework**: Radix UI
- **Charts**: Chart.js
- **Validation**: Zod
- **Date Handling**: date-fns
- **PDF Generation**: @react-pdf/renderer
- **CSV Parsing**: Papa Parse

### Development Tools
- **TypeScript**
- **ESBuild**
- **PostCSS**
- **Vite**