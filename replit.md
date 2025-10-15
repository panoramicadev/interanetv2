# Sales Analytics Dashboard

## Overview

"PANORAMICA" (Pinturas Panoramica) is a comprehensive Spanish-language sales analytics dashboard tailored for the Chilean market. It offers client and user management (with role-based access), in-depth sales analytics, and a mobile-responsive design. Users can import CSV sales data, monitor KPIs, analyze sales trends via charts, and review detailed transaction records. The application, featuring the Panoramica 30th-anniversary logo, is designed to provide sales teams and managers with critical insights into sales performance. Recent enhancements include foundational e-commerce integration for client credential assignment and order management, a new "Técnico de Obra" role, and significant improvements to the technical visit system and PDF generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS, custom design tokens
- **Charts**: Chart.js with react-chartjs-2
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful API
- **Session Management**: Express sessions with PostgreSQL storage
- **File Processing**: CSV import
- **Middleware**: Logging, error handling, authentication

### Database Design
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Schema**: Users, sessions, sales_transactions, ecommerceOrders, ecommerceProductGroups, notifications, tasks, task_assignments, reclamosGenerales, reclamosGeneralesPhotos, reclamosGeneralesHistorial, presupuestoMarketing, solicitudesMarketing, gastosEmpresariales, stgMaeedo, stgMaeddo, stgMaeen, stgMaepr, stgMaeven, stgTabbo, stgTabpp, factVentas
- **Migrations**: Drizzle Kit

### Authentication & Authorization
- **Provider**: Local email/password
- **Strategy**: Passport.js Local Strategy
- **Session Storage**: PostgreSQL via connect-pg-simple
- **Security**: Bcrypt hashing, HTTP-only cookies, CSRF protection
- **User Management**: Manual provisioning, role-based access control (admin, supervisor, salesperson, tecnico_obra, client, reception)

### Data Processing
- **CSV Import**: Client-side parsing with Papa Parse
- **Validation**: Zod schemas
- **Aggregation**: Database-level
- **Filtering**: Dynamic queries

### UI/UX Decisions
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design across all dashboards and PDF rendering.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design, professional styling, and integrated branding.
- **PWA**: Service Worker with network-first caching, automatic update detection, and notification for seamless user experience.

### Feature Specifications
- **Client Management**: Client credential assignment, user-client linking, salesperson assignment.
- **E-commerce**: Ecommerce orders schema, notification system for order approval.
- **Product Grouping System**: Parent-child model for product variations with unique SKUs and prices per variant. Admin interface for managing product groups with search, filters, and CRUD operations. Backend-compatible (ungrouped products maintain groupId=null).
- **User Roles**: Admin, Supervisor, Salesperson, Técnico de Obra, Client, Reception with distinct dashboards and permissions. Reception role has read-only access to view all sent quotes.
- **Technical Visits**: Four-step creation flow, custom product support, receptionist fields, general observations.
- **Sales Analytics**: KPI metrics with accurate period-to-period comparison (current month truncated to current day for fair comparison), sales trend charts, detailed transaction records, segment analysis.
- **Quote Management**: Role-based column visibility, real-time status updates, cart quantity input, PDF logo integration, email and Web Share API sharing.
- **Invoice Access**: Role-based filtering for invoice/transaction access.
- **Task Management**: Comprehensive task management system for admin/supervisor roles.
- **NVV Import**: Direct import of all NVV records from CSV allowing duplicate NUDO values. Pre-calculates totalPendiente (PPPRNE * cantidadPendiente) and cantidadPendiente (CAPRCO2 - CAPREX2) fields during import for efficient querying.
- **NVV Dashboard Integration**: Notas de Venta card displays total pending amount using pre-calculated totalPendiente field from database.
- **Goals Progress**: Goals measured exclusively using Ventas Totales (excluding GDV transactions) for accurate progress tracking.
- **Dashboard Enhancements**: 
  - 3-card layout: Ventas Totales (with NVV+GDV), Total Acumulado del Año (with best historical year and YTD comparison), and Unidades Vendidas (with client count).
  - Best historical year feature displays the year with highest sales and its amount on the "Total Acumulado del Año" card.
  - YTD comparison: "Total Acumulado del Año" card shows accurate year-to-date comparison for current year (e.g., Oct 13, 2025 vs Oct 13, 2024), and full-year comparison for historical years. Includes leap year handling (Feb 29 adjusts to Feb 28 of prior year).
  - Embedded salesperson detail view: Selecting a salesperson from filters shows their dedicated dashboard with back navigation to return to main dashboard. Dashboard filters displayed as read-only badges with "Cambiar filtros" button. Filters (including date ranges) are inherited from the main dashboard and persist when switching between salespeople. Includes in-panel salesperson selector to switch between vendors without leaving the detail view.
- **Complaints Management (Reclamos Generales)**: Comprehensive complaints management system completely separate from technical visits. Includes client complaint registration by salespeople with photo upload requirements, workflow states (registrado → en_revision_tecnica → en_laboratorio → en_produccion → cerrado), severity levels (baja, media, alta, crítica), technician assignment, laboratory/production derivation workflow, SLA tracking with 3-day alert for lab reports, and complete history logging.
- **Marketing Module**: Complete marketing budget and request management system. Features include monthly budget configuration (admin only), marketing request submission (supervisors only), workflow states (solicitado, en_proceso, completado, rechazado), reference URL and PDF attachment support, metrics dashboard showing budget utilization and request status breakdown, supervisor-specific request visibility, admin approval/rejection workflow with reason tracking, and delivery date tracking. Real-time budget monitoring with visual indicators and automatic spend calculation from approved/in-progress requests. Separate buttons for "Presupuesto" and "Solicitudes" in the page header. Workflow: Supervisors create requests (titulo, descripcion, urlReferencia, fechaEntrega) without monto → Admin approves and enters monto + pdfPresupuesto → Budget automatically calculated.
- **Inventory Module**: Comprehensive inventory management system for tracking product stock across warehouses. Features include real-time stock levels (physical, reserved, available), warehouse filtering, product search functionality, low stock alerts, and summary metrics dashboard. Admin and supervisor roles have full access to view inventory status and warehouse details. Integrates with existing productStock table for accurate stock management.
- **Expense Management (Gastos Empresariales)**: Complete business expense management system with role-based workflows. Features include expense creation with detailed fields (amount, description, cost center, category, expense type, document details, provider info), approval workflow with supervisor/admin approval/rejection capabilities, expense status tracking (pendiente, aprobado, rechazado), rejection comments for transparency, expense analytics dashboard with monthly/yearly filtering, category and user-based expense analysis, visual charts for expense breakdown, role-based permissions (salespeople create/view own, supervisors approve/reject, admins have full access), and mobile-responsive interface. Visible in sidebar for admin, supervisor, and salesperson roles.
- **ETL Data Warehouse Tables**: Database schema for ETL processes in the PostgreSQL schema "ventas" with 8 staging tables (stg_maeedo, stg_maeddo, stg_maeen, stg_maepr, stg_maeven, stg_tabbo, stg_tabpp) for importing data from SQL Server and a fact_ventas table with 79 columns for the final denormalized data. Tables include optimized indexes for query performance (ix_fact_ventas_feemli_id, ix_fact_ventas_cliente, ix_fact_ventas_producto, ix_fact_ventas_vendedor, ix_fact_ventas_bodega). ETL execution log (watermark) table tracks all ETL runs with execution status, period, document types, branches processed, records count, execution time, detailed statistics in JSON format, and watermark timestamp for last processed date. Functional ETL process (server/etl-process.ts) extracts from SQL Server (PANORAMICA database), loads to staging tables, processes into fact_ventas with calculated monto column (CAPRCO2 * PPPRNE), supports multiple branches (004, 006, 007), and automatically logs all executions for audit and monitoring.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless
- **Hosting**: Replit deployment environment

### Third-Party Libraries
- **UI Framework**: Radix UI
- **Charts**: Chart.js
- **Validation**: Zod
- **Date Handling**: date-fns
- **Styling**: Tailwind CSS, class-variance-authority
- **PDF Generation**: @react-pdf/renderer
- **CSV Parsing**: Papa Parse

### Development Tools
- **TypeScript**
- **ESBuild**
- **PostCSS**
- **Vite**