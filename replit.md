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
- **Authentication**: Passport.js Local Strategy with bcrypt for hashing, HTTP-only cookies, and CSRF protection. Role-based access control (Admin, Supervisor, Salesperson, Técnico de Obra, Client, Reception, Laboratorio).

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Key Schemas**: Users, sales_transactions, ecommerceOrders, notifications, reclamosGenerales, presupuestoMarketing, solicitudesMarketing, gastosEmpresariales, stgMaeedo, factVentas.
- **Migrations**: Drizzle Kit

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and PDFs.
- **Responsiveness**: Mobile-responsive design.
- **Theming**: Custom design tokens and CSS variables.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Key Features
- **Client & User Management**: Client credential assignment, user-client linking, role-based access.
- **E-commerce**: Order management and notification system.
- **Product Grouping System**: Parent-child product variations with CRUD operations.
- **Technical Visits**: Four-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPI metrics, sales trend charts, detailed transaction records, segment analysis, accurate period-to-period comparisons, and exclusion of GDV transactions.
- **Quote Management**: Role-based visibility, real-time status updates, PDF integration, sharing options.
- **Task Management**: Comprehensive system for admin/supervisor roles.
- **NVV Import & Dashboard Integration**: Direct CSV import of NVV records with pre-calculated fields, displayed on dashboard.
- **Goals Progress**: Sales goals measured exclusively using Ventas Totales (excluding GDV).
- **Dashboard Enhancements**: 3-card layout (Ventas Totales, Total Acumulado del Año, Unidades Vendidas), best historical year, YTD comparison, embedded salesperson detail views.
- **Complaints Management (Reclamos Generales)**: Comprehensive system with optimized photo uploads (client-side compression to max 1920px, JPEG 0.8 quality, reducing file size 70-80%), workflow states, severity levels, SLA tracking, history logging, and automatic rollback on upload failure. Creator can delete own reclamo within 5 minutes for error recovery. Laboratorio role has special permissions: can view all reclamos (regardless of creator), can upload resolution reports with photographic evidence (compressed with same optimization as complaint photos), and has atomic database updates to prevent race conditions in concurrent submissions.
- **Marketing Module**: Budget configuration, request submission, workflow states, reference URLs/PDFs, metrics dashboard, and a customizable checklist system for tasks within requests.
- **Inventory Module**: Real-time stock levels, warehouse filtering, low stock alerts, and summary metrics.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, status tracking, and analytics dashboard.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking, compliance comparison with actual sales, and visual indicators.
- **ETL Data Warehouse**: PostgreSQL schema "ventas" with staging tables and a denormalized `fact_ventas` table. Supports Full Annual ETL and Automatic Incremental ETL (every 15 minutes) with watermark tracking. An "ETL Monitor Panel" provides a visual interface for status, history, and manual triggers.

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Build/Run Commands**: `npm run db:push && npm run build` and `sh scripts/production-start.sh` for migrations and server startup.
- **Automatic Processes**: Database migrations, ETL scheduler (every 15 mins), initial ETL run 30s after startup.
- **Monitoring**: `/etl-monitor` route for real-time status and history.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless
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