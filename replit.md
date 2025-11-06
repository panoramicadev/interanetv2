# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a Spanish-language sales analytics dashboard tailored for the Chilean market. It provides comprehensive sales insights through client and user management (with role-based access), detailed sales analytics, and a mobile-responsive design. The application supports CSV sales data import, KPI monitoring, trend analysis, and transaction review. Key features include e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse, and an internal notification system. The project aims to enhance sales strategies and operational efficiency.

## Recent Changes (Nov 6, 2025)
- **Integrated Mantenciones Planificadas into Budget Module**: Added comprehensive projection of planned maintenance costs in the annual budget module. Features include: (1) New query fetching planned maintenances filtered by year and area; (2) Additional "Mant. Planificadas" column in monthly table showing estimated costs per month in green; (3) New "Total Planificado" summary card displaying annual sum of future maintenances; (4) Third green bar in annual chart visualizing planned maintenance costs alongside assigned and executed budgets; (5) Equipment catalog integration allowing users to select critical equipment directly when creating planned maintenances, with automatic area population. This integration enables proactive budget planning based on scheduled future maintenance work.
- **Enhanced Mantenciones Planificadas Form**: Added equipment catalog selector with checkbox toggle between catalog dropdown and custom equipment input. When selecting from catalog, equipment ID and area fields auto-populate, improving data consistency and reducing manual entry errors.
- **Fixed Missing Imports in Storage**: Added mantencionesPlanificadas table and type imports to server/storage.ts, resolving ReferenceError that prevented CMMS operations.

## Previous Changes (Nov 5, 2025)
- **Fixed Comparative Analytics Discrepancy**: Corrected `getSegmentAnalysis()` to consistently exclude Guías de Despacho (GDV) across all views (was causing ~$128K differences).
- **Added Total Acumulado Card**: Implemented green summary card showing sum of all compared periods in both segment and salesperson comparatives.
- **Fixed Year Label Bug**: Corrected tooltip display when comparing full years (2024 vs 2025) - was showing "Ene" instead of year label.
- **Sorted Year Display**: Years now display in ascending order (2023, 2024, 2025) in all comparative charts for better chronological readability.
- **Fixed Segment Detail View Year Filter**: Added missing 'year' filter case in `getSegmentSalespeople()` to ensure vendor amounts match exactly when selecting a full year period. Now both clients and vendors filter consistently.
- **Fixed Maintenance Orders Database Schema**: Added missing `plan_preventivo_id` column to `solicitudes_mantencion` table, resolving errors preventing creation and viewing of work orders.
- **Enabled Inventory Module for Production Role**: Added Inventario module to produccion role navigation menu for stock management access.
- **Reorganized Maintenance Request Workflow**: Simplified request creation by removing execution type and assignment fields from initial form. Admin/supervisor/produccion users now configure execution (immediate/scheduled) and assignment (internal technician/external provider) post-creation through a dedicated section in the details dialog. Updated PATCH endpoint and storage function to handle combined execution and assignment updates with proper role validation.
- **Implemented Work State Management for Maintenance Orders**: Added complete work lifecycle tracking with state machine transitions (registrado → programada → en_reparacion → pausada → resuelto → cerrado). Features include: (1) New database fields `motivoPausa` and `fechaInicioTrabajo` to track pause reasons and work start times; (2) POST `/api/mantenciones/:id/iniciar-trabajo` endpoint to start work and transition to en_reparacion; (3) Enhanced PATCH `/api/mantenciones/:id/pausar` endpoint to capture pause motive (minimum 10 characters) with optional date reassignment, auto-transitioning to programada if future date provided; (4) Frontend "Iniciar Trabajo" and "Pausar Trabajo" buttons with conditional visibility based on current state; (5) Pause dialog for capturing motive and optional rescheduling; (6) UI display of work start time and pause motive with highlighted styling. Role permissions restricted to admin, supervisor, and produccion for state management operations.

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
- **Migrations**: Drizzle Kit

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Key Features
- **Client & User Management**: Role-based access and client linking.
- **CRM Pipeline System**: Kanban-style lead management with customizable stages and activity tracking.
- **E-commerce**: Order management and notifications.
- **Product Grouping System**: Parent-child product variations.
- **Technical Visits**: Multi-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPIs, trend charts, detailed transaction records, segment analysis, period-to-period comparisons, and interactive projection visualizations.
- **Quote Management**: Role-based visibility, status updates, PDF integration.
- **Task Management**: For admin/supervisor roles.
- **NVV Import & Dashboard Integration**: CSV import and dashboard display.
- **Goals Progress**: Sales goals tracking.
- **Dashboard Enhancements**: Modern 3-card layout, YTD comparison, salesperson detail views, and goal metrics.
- **Complaints Management (Reclamos Generales)**: Multi-area resolution with workflow automation, photo uploads, role-based filtering, and state machine.
- **Maintenance Management (Mantención)**: Equipment request system with workflow, technician assignment, photo evidence, and history logging. Drawer lateral (Sheet) para creación de solicitudes con formulario multi-sección.
- **CMMS (Computerized Maintenance Management System)**: Complete preventive and corrective maintenance management with:
  - **Dashboard**: 8 KPIs (MTTR, backlog, preventivas vs correctivas, costos mensuales), 3 gráficos, filtros por período/área
  - **Equipos Críticos**: Catálogo de equipos con área, criticidad, estado operativo, documentación técnica, y jerarquía padre-componente (ej: dispersor → motor) con vista expandible/colapsable. Las OTs vinculan equipos por ID para reflejar cambios del catálogo automáticamente
  - **Proveedores Externos**: Gestión de proveedores de mantención con especialidades, evaluación (5 estrellas), y tiempos de respuesta
  - **Presupuesto Anual**: Configuración mensual con semáforo de desvíos (verde/amarillo/rojo), ejecución vs planificado, proyección de mantenciones planificadas integrada (columna y gráfico en verde mostrando costos futuros estimados por mes)
  - **Gastos de Materiales**: Registro de gastos vinculados a OTs y proveedores con cálculo automático de totales
  - **Planes Preventivos**: Programación por frecuencia (diaria-anual), generación automática de OTs, KPIs de cumplimiento
  - **Calendario de Mantención**: Vista mensual con eventos de planes preventivos y OTs activas, navegación y filtros
  - **Scheduler Automático**: Job que genera OTs preventivas cada hora según planes activos, con ventana de anticipación de 2 horas
  - **Control de Acceso**: Roles especializados (admin, supervisor, produccion) con validación en frontend y backend
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, customizable checklists, and interactive calendar.
- **Inventory Module (Hybrid System)**: Real-time stock levels with integrated average pricing, combining PostgreSQL catalog with live SQL Server stock queries. Includes low stock alerts.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking.
- **Internal Notifications System**: Role-based notifications, archiving, and automatic event notifications, including smart sales notifications.
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table, supporting Full Annual and Automatic Incremental ETL with monitoring.
- **Manual Sales Projection**: Monthly to yearly calculation, creation of "future clients," and robust role-based access control.

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Automation**: Database migrations, ETL scheduler.

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