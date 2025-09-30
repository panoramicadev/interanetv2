# Sales Analytics Dashboard

## Overview

This is a comprehensive Spanish language sales analytics dashboard application called "PANORAMICA" (branded as "Pinturas Panoramica") built for the Chilean market. The application provides complete client management, user management with role-based access, comprehensive sales analytics, and mobile-responsive design. Users can import CSV sales data, view KPI metrics, analyze sales trends through charts, and examine detailed transaction records. The system features the Panoramica 30th anniversary logo prominently displayed on the login page and is designed for sales teams and managers to gain insights into their sales performance.

## Recent Changes

### Dashboard Unification (September 2025)
- **Supervisor & Admin Dashboard**: Supervisors now use the identical dashboard as administrators, providing full access to all management capabilities except file upload functionality
- **Goals Management**: Supervisors now see and manage all system goals (identical to administrators) instead of being limited to their assigned area
- **Role-Based Access**: Unified access control where both admin and supervisor roles share the same interface and permissions for better operational consistency
- **Future Customization**: Dashboard differentiation can be restored later when specific supervisor features are developed

### Task Management System (September 2025)
- **New Module**: Implemented comprehensive task management system for admin and supervisor roles
- **Database Schema**: Added `tasks` and `task_assignments` tables with full relational structure
- **API Endpoints**: Complete REST API for task CRUD operations with role-based access control
- **Sidebar Integration**: Added "Panel de Tareas" menu item positioned above "Crear Presupuesto" for admin and supervisor users
- **Assignment Capabilities**: Supports assigning tasks to individual users or entire segments with flexible recipient selection

### NVV Smart Filtering (September 30, 2025)
- **Automatic Completed Order Exclusion**: NVV import now cross-references sales_transactions table to automatically exclude orders that have been completed
- **Business Logic**: If a NUDO exists in sales_transactions, it's considered a completed sale and excluded from pending sales (NVV) import
- **Performance Optimization**: Uses Set-based lookup for efficient filtering of large datasets
- **Import Statistics**: Enhanced logging shows three categories - inserted records, duplicates skipped, and completed orders excluded
- **Data Integrity**: Ensures NVV dashboard only displays truly pending sales, eliminating confusion from already-completed orders

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Charts**: Chart.js with react-chartjs-2 for data visualizations
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety across the stack
- **API Design**: RESTful API endpoints with consistent error handling
- **Session Management**: Express sessions with PostgreSQL storage
- **File Processing**: CSV import functionality for bulk sales data upload
- **Middleware**: Request logging, error handling, and authentication middleware

### Database Design
- **Database**: PostgreSQL with connection pooling via Neon serverless
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: Three main tables - users (authentication), sessions (session storage), and sales_transactions (core business data)
- **Migrations**: Drizzle Kit for database schema management
- **Data Types**: Optimized column types including numeric for currency, date for transactions, and text for flexible content

### Authentication & Authorization
- **Provider**: Local email/password authentication system
- **Strategy**: Passport.js with Local Strategy for email/password verification
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Security**: Bcrypt password hashing, HTTP-only cookies, secure flags, and CSRF protection
- **User Management**: Manual user provisioning and role-based access control (admin, supervisor, salesperson, client)
- **Role Hierarchy**: admin > supervisor > salesperson > client with appropriate permission levels

### Data Processing
- **CSV Import**: Client-side CSV parsing with Papa Parse for sales transaction uploads
- **Validation**: Zod schemas for runtime type checking and data validation
- **Aggregation**: Database-level aggregations for performance-optimized metrics
- **Filtering**: Dynamic query building with date ranges, salesperson, and segment filters

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database for scalable data storage
- **Authentication**: Local email/password authentication with session management
- **Hosting**: Designed for Replit deployment with environment-specific configurations

### Third-Party Libraries
- **UI Framework**: Radix UI primitives for accessible, unstyled components
- **Charts**: Chart.js ecosystem for comprehensive data visualization capabilities
- **Validation**: Zod for schema validation and type inference
- **Date Handling**: date-fns for date manipulation and formatting
- **Styling**: Tailwind CSS with class-variance-authority for component variants

### Development Tools
- **TypeScript**: End-to-end type safety with strict configuration
- **ESBuild**: Fast bundling for production server builds
- **PostCSS**: CSS processing with Tailwind and Autoprefixer
- **Development**: Vite with HMR, TSX for server development, and Replit-specific plugins