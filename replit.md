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
- **Sales Analytics**: KPI metrics, sales trend charts, detailed transaction records, segment analysis.
- **Quote Management**: Role-based column visibility, real-time status updates, cart quantity input, PDF logo integration, email and Web Share API sharing.
- **Invoice Access**: Role-based filtering for invoice/transaction access.
- **Task Management**: Comprehensive task management system for admin/supervisor roles.
- **NVV Import**: Direct import of all NVV records from CSV with duplicate detection.

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