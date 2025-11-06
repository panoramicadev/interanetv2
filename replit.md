# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard designed for the Chilean market, providing comprehensive sales insights through client and user management (with role-based access), detailed sales analytics, and a mobile-responsive design. Key capabilities include CSV sales data import, KPI monitoring, trend analysis, transaction review, e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse, and an internal notification system. The project aims to enhance sales strategies and operational efficiency.

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
- **CRM Pipeline System**: Kanban-style lead management.
- **E-commerce**: Order management and notifications.
- **Product Grouping System**: Parent-child product variations.
- **Technical Visits**: Multi-step creation flow, custom product support, PDF generation.
- **Sales Analytics**: KPIs, trend charts, transaction records, segment analysis, period-to-period comparisons, and interactive projection visualizations.
- **Quote Management**: Role-based visibility and status updates.
- **Task Management**: For admin/supervisor roles.
- **Goals Progress**: Sales goals tracking.
- **Complaints Management (Reclamos Generales)**: Multi-area resolution with workflow automation, photo uploads, role-based filtering, and state machine.
- **Maintenance Management (Mantención)**: Equipment request system with workflow, technician assignment, and history logging.
- **CMMS (Computerized Maintenance Management System)**: Comprehensive preventive and corrective maintenance management with:
    - **Dashboard**: KPIs (MTTR, backlog, etc.), charts, filters.
    - **Equipos Críticos**: Equipment catalog with hierarchy and technical documentation.
    - **Proveedores Externos**: External maintenance provider management and evaluation.
    - **Presupuesto Anual**: Monthly budget configuration with deviation tracking and integrated planned maintenance projections.
    - **Gastos de Materiales**: Expense recording linked to work orders and suppliers.
    - **Planes Preventivos**: Scheduled preventive maintenance with automatic work order generation.
    - **Calendario de Mantención**: Monthly calendar view of preventive plans and active work orders.
    - **Scheduler Automático**: Automated job for preventive work order generation.
    - **Control de Acceso**: Specialized role-based access.
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, and calendar.
- **Inventory Module (Hybrid System)**: Real-time stock levels with integrated average pricing and low stock alerts, combining PostgreSQL catalog with live SQL Server queries.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking.
- **Internal Notifications System**: Role-based and automatic event notifications.
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table. Automated incremental ETL runs every 15 minutes, with unique index on (idmaeedo, idmaeddo) for UPSERT support. Data mapper validates and preserves precision for 18-20 digit IDs and monetary values using string-based numerics. **Field Mapping (Nov 2025)**: Corrected client, vendor, and segment joins using MAEEDO.ENDO → MAEEN.KOEN (client RUT), MAEEN.KOFUEN → TABFU.KOFU (vendor), MAEEN.RUEN → TABRU.KORU (segment). Added LTRIM/RTRIM for whitespace handling and onConflictDoNothing for duplicate prevention in staging tables. Dashboard fields (nokoen, nokofu, noruen) now populate correctly with ~100%/97%/96% coverage.
- **Manual Sales Projection**: Monthly to yearly calculation and "future clients" management.

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