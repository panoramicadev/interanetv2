# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a sales analytics dashboard for the Chilean market, providing comprehensive sales insights to enhance strategies and operational efficiency. It features KPI monitoring, trend analysis, sales forecasting, CRM, and e-commerce integration. The project also includes specialized modules for complaints, maintenance (CMMS), and technical visits, aiming to provide a competitive advantage through data-driven decision-making and streamlined operations.

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
- **Authentication & Authorization**: Passport.js Local Strategy with bcrypt, HTTP-only cookies, CSRF protection, and a 3-layer role-based access control (RBAC) system (Admin, Supervisor, Salesperson, Técnico de Obra, Client, Jefe_planta, Mantencion, and various departmental roles). Backend RBAC middleware ensures granular access, including full administrative access for `Jefe_planta` and `Mantencion` roles within the maintenance module.
- **Data Processing**: CSV import, Replit Object Storage for file storage. ETL Data Warehouse for automated incremental runs, UPSERT, data mapping, real-time progress, and reliability features. Sales forecasting uses Holt-Winters method. NVV ETL uses full synchronization for transient data.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM. Schemas include Users, sales transactions, e-commerce, CRM, complaints, maintenance (CMMS), marketing, expenses, and ETL. Drizzle Kit manages schema.
- **Key Features**:
    - **Management**: Client & user management, CRM pipeline, E-commerce, Product grouping, Unified Task management (integrating marketing and general tasks with role-based assignment), Salesperson data management.
    - **Sales & Finance**: Sales analytics (KPIs, trends, projections), Quote management, Goals progress, Finance module (invoices, sales notes), Promesas de Compra Semanales, Manual Sales Projection.
    - **Service & Operations**: Technical visits, Complaints management (workflow, photo uploads, state machine, specific area mapping to operative areas), Maintenance management (CMMS: equipment requests, preventive plans supporting equipment-specific and general tasks, work orders, expense tracking, full lifecycle management), Inventory module (real-time stock, alerts), Expense management.
    - **Internal Systems**: Internal notification system, ETL monitoring modules with change tracking and state change auditing.
- **Production Deployment**: Replit Autoscale Deployment with automated database migrations, ETL scheduler, preventive maintenance scheduler, and health monitoring. Includes reliability features like circuit breaker, automatic retry, health check endpoint, automated alerting, and data quality validation.

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