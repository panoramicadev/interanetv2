# Sales Analytics Dashboard

## Overview

This is a full-stack sales analytics dashboard built for analyzing sales transaction data. The application provides comprehensive sales metrics, visualizations, and data management capabilities. Users can import CSV sales data, view KPI metrics, analyze sales trends through charts, and examine detailed transaction records. The system is designed for sales teams and managers to gain insights into their sales performance.

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
- **Provider**: Replit OpenID Connect (OIDC) for seamless authentication
- **Strategy**: Passport.js with OpenID Connect strategy
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Security**: HTTP-only cookies, secure flags, and CSRF protection
- **User Management**: Automatic user provisioning and profile synchronization

### Data Processing
- **CSV Import**: Client-side CSV parsing with Papa Parse for sales transaction uploads
- **Validation**: Zod schemas for runtime type checking and data validation
- **Aggregation**: Database-level aggregations for performance-optimized metrics
- **Filtering**: Dynamic query building with date ranges, salesperson, and segment filters

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database for scalable data storage
- **Authentication**: Replit OIDC service for user authentication and authorization
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