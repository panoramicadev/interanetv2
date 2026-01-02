# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market designed to provide comprehensive sales insights. Its primary purpose is to enhance sales strategies and operational efficiency through KPI monitoring, trend analysis, sales forecasting, and robust CRM and e-commerce integrations. The project also integrates specialized modules for complaints, maintenance (CMMS), and technical visits, aiming to provide a competitive advantage by enabling data-driven decision-making and streamlining various business operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Branding**: Features a Panoramica 30th-anniversary logo on login and professional PDF documents.
- **Responsiveness**: Designed for mobile responsiveness across all interfaces.
- **Theming**: Utilizes custom design tokens and CSS variables for a consistent look.
- **Professional Documents**: PDFs feature enhanced layouts with multi-column design and branding elements.

### Technical Implementation
- **Frontend**: Built with React 18, TypeScript, Wouter for routing, TanStack Query for state management, Shadcn/ui (Radix UI) components, Tailwind CSS for styling, Chart.js for data visualization, and Vite as the build tool, with PWA capabilities.
- **Backend**: Implemented using Node.js with Express.js and TypeScript, following a RESTful API design.
- **Authentication & Authorization**: Employs Passport.js Local Strategy with bcrypt, HTTP-only cookies, CSRF protection, and a 3-layer role-based access control (RBAC) system. RBAC middleware ensures granular access for various roles including Admin, Supervisor, Salesperson, and specialized departmental roles.
- **Data Processing**: Supports CSV import, utilizes Replit Object Storage for file storage, and features an ETL Data Warehouse for automated incremental runs, UPSERT operations, data mapping, and real-time progress monitoring. Sales forecasting is powered by the Holt-Winters method. NVV ETL uses full synchronization for transient data.
- **Database**: PostgreSQL (Neon serverless) managed with Drizzle ORM. The schema includes users, sales transactions, e-commerce, CRM, complaints, maintenance (CMMS), marketing, expenses, and ETL data. Drizzle Kit is used for schema management.
- **Key Features**:
    - **Management**: Client and user management, CRM pipeline, E-commerce, Product grouping, Unified Task management, and Salesperson data management.
    - **Sales & Finance**: Advanced sales analytics (KPIs, trends, projections), Quote management, Goal progress tracking, Finance module (invoices, sales notes), Weekly Purchase Promises, and Manual Sales Projection.
    - **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine), Maintenance management (CMMS for equipment requests, preventive plans, work orders, expense tracking), and Inventory module with real-time stock and alerts.
    - **Internal Systems**: Internal notification system and ETL monitoring modules with change tracking and state change auditing.
- **Production Deployment**: Leverages Replit Autoscale Deployment, including automated database migrations, ETL and preventive maintenance schedulers, and health monitoring. Incorporates reliability features like circuit breakers, automatic retries, and automated alerting.
- **Database Bootstrap System**: An idempotent `bootstrapDatabase()` function runs before migrations on application startup to ensure essential schemas and staging tables are present.

### System Design Choices
- **NVV Module**: Utilizes an automated ETL process from SQL Server for "Notas de Venta Vigentes" with a full synchronization strategy, exclusively considering records where `eslido` is null or empty as pending. It uses `nvv.fact_nvv` as the primary data source.
- **GDV Module**: Employs an automated ETL process from SQL Server for "Guías de Despacho Vigentes" with a full synchronization strategy, extracting only open dispatch guides and ensuring closed items are automatically removed. It relies on `gdv.fact_gdv` as the primary data source.
- **Public Salesperson Catalog**: Enables salespeople to have public catalog pages (`/catalogo/:slug`) where visitors can browse products and submit quote requests without authentication.
- **Shopify-Style Product Management**: The e-commerce system supports a hierarchical product → options → variants structure using `shopify_products`, `shopify_product_options`, and `shopify_product_variants` tables.

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