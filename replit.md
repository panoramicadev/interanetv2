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
- **Schema**: Users, sessions, sales_transactions, ecommerceOrders, ecommerceProductGroups, notifications, tasks, task_assignments
- **Migrations**: Drizzle Kit

### Authentication & Authorization
- **Provider**: Local email/password
- **Strategy**: Passport.js Local Strategy
- **Session Storage**: PostgreSQL via connect-pg-simple
- **Security**: Bcrypt hashing, HTTP-only cookies, CSRF protection
- **User Management**: Manual provisioning, role-based access control (admin, supervisor, salesperson, tecnico_obra, client)

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
- **User Roles**: Admin, Supervisor, Salesperson, Técnico de Obra, Client with distinct dashboards and permissions.
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