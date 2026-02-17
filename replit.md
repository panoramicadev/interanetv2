# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market, providing comprehensive sales insights to enhance sales strategies and operational efficiency. It focuses on KPI monitoring, trend analysis, sales forecasting, and robust CRM and e-commerce integrations. The project also incorporates specialized modules for complaints, maintenance (CMMS), and technical visits, aiming to enable data-driven decision-making and streamline various business operations for a competitive advantage.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Branding**: Panoramica 30th-anniversary logo on login and professional PDF documents.
- **Responsiveness**: Mobile-first design across all interfaces.
- **Theming**: Custom design tokens and CSS variables for consistent styling.
- **Professional Documents**: Enhanced PDF layouts with multi-column design and branding.

### Technical Implementation
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, Shadcn/ui (Radix UI), Tailwind CSS, Chart.js, Vite (build tool), PWA capabilities.
- **Backend**: Node.js, Express.js, TypeScript, RESTful API design.
- **Authentication & Authorization**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, CSRF protection, and a 3-layer role-based access control (RBAC) system for granular access.
- **Data Processing**: CSV import, Replit Object Storage for files, ETL Data Warehouse with automated incremental runs, UPSERT, data mapping, real-time progress monitoring. Sales forecasting uses Holt-Winters. NVV ETL uses full synchronization.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM and Drizzle Kit for schema management. Includes schemas for users, sales, e-commerce, CRM, complaints, CMMS, marketing, expenses, and ETL data.
- **Key Features**:
    - **Management**: Client/user management, CRM pipeline, E-commerce, Product grouping, Unified Task management, Salesperson data management.
    - **Sales & Finance**: Advanced sales analytics (KPIs, trends, projections), Quote management, Goal tracking, Finance module (invoices, sales notes), Weekly Purchase Promises, Manual Sales Projection.
    - **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine), Maintenance management (CMMS for equipment, preventive plans, work orders, expense tracking), Inventory with real-time stock and alerts.
    - **Internal Systems**: Internal notification system, ETL monitoring with change tracking and state change auditing.
- **Production Deployment**: Replit Autoscale Deployment, automated database migrations, ETL/preventive maintenance schedulers, health monitoring, circuit breakers, automatic retries, and alerting.
- **Database Bootstrap System**: Idempotent `bootstrapDatabase()` function runs on startup to ensure essential schemas and staging tables.

### System Design Choices
- **NVV Module**: Automated ETL from SQL Server for "Notas de Venta Vigentes" with full synchronization. Pending status is determined by `cantidad_pendiente_ud2 > 0` and `ESLIDO` being NULL/empty.
- **GDV Module**: Automated ETL from SQL Server for "Guías de Despacho Vigentes" with full synchronization, extracting only open dispatch guides.
- **Public Salesperson Catalog**: Enables salespeople to have public catalog pages for product browsing and quote requests without authentication.
- **Shopify-Style Product Management**: Supports hierarchical product → options → variants structure.
- **Multi-Level Fund Approval System**: A two-tier approval workflow for fund requests (Salesperson -> Supervisor -> RRHH) with state tracking and notifications. This system was simplified to a single RRHH approval step for expenses.
- **Expense Management Module**: Features an RRHH-only approval workflow, automatic assignment of uploaded photos as payment vouchers, required photo for `reembolso` expenses, and enhanced supervisor permissions. Editable `fechaEmision` for admin/RRHH.
- **Expense Month Assignment**: All expense filtering uses `createdAt` as the authoritative date for month assignment. The `fechaEmision` is the receipt/document date, while `createdAt` determines which reporting month the expense belongs to. Admin/RRHH can edit `createdAt` to reassign expenses to different months.
- **Reusable Filter Component**: Centralized `gastos-filter-bar.tsx` component for filtering expenses across dashboards.
- **PDF Report Generation**: Includes image normalization via a secure backend endpoint to correct EXIF orientation issues in generated PDFs.

## External Dependencies

- **Database**: Neon PostgreSQL serverless
- **Object Storage**: Replit Object Storage
- **Hosting**: Replit deployment environment
- **UI Framework**: Radix UI
- **Charts**: Chart.js
- **Validation**: Zod
- **Date Handling**: date-fns
- **PDF Generation**: @react-pdf/renderer
- **CSV Parsing**: Papa Parse
- **Image Processing**: Sharp (for PDF image orientation normalization)