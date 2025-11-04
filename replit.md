# Sales Analytics Dashboard

## Overview
"PANORAMICA" is a Spanish-language sales analytics dashboard designed for the Chilean market. Its purpose is to provide comprehensive sales insights, offering client and user management (with role-based access), detailed sales analytics, and a mobile-responsive design. The application enables users to import CSV sales data, monitor KPIs, analyze trends, and review transaction records. Key capabilities include e-commerce integration, a CRM pipeline, product grouping, technical visit management, robust complaints and maintenance management, sales forecasting, an ETL data warehouse for data processing, and an internal notification system.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 4, 2025 - Manual Projections UX Improvements
**Enhanced usability and data accuracy:**
- **Auto-select Last 3 Years**: System now preselects the three most recent years by default (can be deselected)
- **Removed Purchase Frequency Column**: Eliminated unreliable purchase frequency data from table display
- **Segment Accuracy**: Confirmed backend correctly assigns client segments based on segment with highest sales (using `noruen` field)
- **Cleaner Interface**: Streamlined table layout for better readability

### November 4, 2025 - Segment Filter Fixed for Manual Projections
**Fixed segment filter behavior to be display-only without breaking save functionality:**
- **Frontend-Only Filtering**: Segment filter now applies only in the frontend for visualization
  - Backend queries no longer receive segment parameter
  - All client data is loaded regardless of segment selection
  - Filtering happens client-side using `filteredData` computed from `processedData`
- **Preserved Save Functionality**: Users can now save projections regardless of selected segment filter
- **Consistent User Experience**: Filter updates are immediate and don't affect data availability
- **Performance**: Maintains efficient data loading while allowing flexible filtering

### November 4, 2025 - Manual Salesperson Name Input in User Creation
**Enhanced user creation form to support new salespeople:**
- **Manual Input Field**: Text input allows direct entry of salesperson names
- **Dual Entry Method**: Users can either type directly or select from existing salespeople
- **Fixed Form Control**: Corrected React Hook Form integration to ensure input functionality
- **Solves Bootstrap Problem**: Administrators can create user accounts before salespeople have sales transactions

### November 4, 2025 - Editable Historical Years for Future Clients
**Enhanced manual projection system to support baseline data entry for fictitious clients:**
- **Future Client Detection**: System identifies fictitious clients by "FUTURO-" prefix
- **Unrestricted Editing**: Future clients can edit ALL years (historical and future)
  - Real clients: Read-only on historical data, editable on future years
  - Future clients: Editable on both historical (2024, 2025) and future years (2026+)
- **Baseline Data Population**: Allows realistic historical baseline data before making projections
- **Filter Improvements**: Added placeholders to Segment and Salesperson filters

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
- **Maintenance Management (Mantención)**: Equipment request system with workflow, technician assignment, photo evidence, and history logging.
- **Marketing Module**: Budget configuration, request workflow, metrics dashboard, customizable checklists, and interactive calendar.
- **Inventory Module (Hybrid System)**: Real-time stock levels with integrated average pricing, combining PostgreSQL catalog with live SQL Server stock queries. Includes low stock alerts.
- **Expense Management (Gastos Empresariales)**: Expense creation, approval workflow, and analytics.
- **Promesas de Compra Semanales**: Weekly purchase promise tracking.
- **Internal Notifications System**: Role-based notifications, archiving, and automatic event notifications. Includes smart sales notifications (inactive clients, seasonal clients, trending products).
- **Sales Forecasting System**: Holt-Winters triple exponential smoothing for monthly sales projections.
- **ETL Data Warehouse**: PostgreSQL schema with staging tables and a denormalized `fact_ventas` table, supporting Full Annual and Automatic Incremental ETL with monitoring.
- **Manual Sales Projection**: Monthly to yearly calculation, creation of "future clients", and robust role-based access control.

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