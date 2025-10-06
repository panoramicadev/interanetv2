# Sales Analytics Dashboard

## Overview

This is a comprehensive Spanish language sales analytics dashboard application called "PANORAMICA" (branded as "Pinturas Panoramica") built for the Chilean market. The application provides complete client management, user management with role-based access, comprehensive sales analytics, and mobile-responsive design. Users can import CSV sales data, view KPI metrics, analyze sales trends through charts, and examine detailed transaction records. The system features the Panoramica 30th anniversary logo prominently displayed on the login page and is designed for sales teams and managers to gain insights into their sales performance.

## Recent Changes

### Technical Visits System Updates (October 6, 2025)
- **Schema Modernization**: Removed `fechaVisita` field in favor of timestamp-based tracking, added receptionist fields (`recepcionistaNombre`, `recepcionistaCargo`)
- **Custom Products Support**: Step 2 now allows adding personalized products not in the catalog alongside catalog selection with visual differentiation (✨ badge)
- **Simplified Product Evaluation**: Removed "M² Aplicados" field from product evaluation form for streamlined data entry
- **Four-Step Visit Creation**: Restructured visit creation flow into clear steps - Basic Info (Step 1), Product Selection (Step 2), Product Evaluation (Step 3), and General Observations (Step 4)
- **Dedicated Observations Step**: General observations now have their own dedicated final step (Step 4) to avoid cluttering the product evaluation interface
- **Enhanced Visit Detail**: Visit detail view now displays receptionist information and general observations when available
- **Backend Improvements**: Custom products (ID starting with "custom-") are properly detected and saved as `productoManual` instead of `productoId`
- **Data Integrity**: All new fields (`recepcionistaNombre`, `recepcionistaCargo`, `observacionesGenerales`) properly saved to database and displayed in visit details

### Sales Calculation Fix (October 2, 2025)
- **Critical Bug Fix**: Resolved discrepancy where total sales didn't match sum of sales by salesperson/client
- **Root Cause**: `getTopSalespeople` and `getTopClients` methods used `SELECT DISTINCT` with `GROUP BY nudo, nokofu, tido, monto` which was collapsing legitimate transactions when multiple products in same order had identical prices
- **Solution**: Removed unnecessary DISTINCT and GROUP BY, now directly aggregating from sales_transactions table
- **Impact**: Fixed ~$22-33M discrepancy in September sales ($288M total vs $255M by salespeople) - now totals match correctly
- **Methods Fixed**: `getTopSalespeople()` and `getTopClients()` now accurately count all transactions without collapsing

### Salesperson Segment Analysis (October 2, 2025)
- **Segment Visualization**: Added pie chart showing sales distribution across segments in salesperson detail page
- **Dual Layout**: Chart displayed alongside detailed segment breakdown showing total sales and percentages
- **Data Integration**: New backend endpoint `/api/sales/salesperson/:name/segments` provides segment-level sales data
- **Color-Coded Display**: Each segment assigned distinct color for easy visual identification across chart and list
- **Responsive Design**: Chart and segment list adapt seamlessly to mobile and desktop layouts

### Quote Management UX Improvements (October 2, 2025)
- **Role-Based Column Visibility**: "Creado por" column now hidden for salespeople, visible only for admins and supervisors since salespeople only see their own quotes
- **Real-Time Status Updates**: Quote status changes (enviado, aceptado, rechazado, convertido a pedido) now update UI immediately without page reload through TanStack Query cache invalidation
- **Cart Quantity Input**: Mobile cart now allows manual quantity editing with Input field (1-999 validation) matching product selection behavior
- **PDF Logo Integration**: Replaced text header with Panorámica 30th anniversary logo in PDF documents for professional branding

### PWA Update System (October 2, 2025)
- **Service Worker Implementation**: Created service worker with network-first caching strategy for reliable offline access
- **Automatic Update Detection**: System checks for updates every 60 seconds and notifies users when new version is available
- **Update Notification Banner**: Orange banner appears at bottom of screen with "Actualizar ahora" button when update is ready
- **Seamless Updates**: Clicking update button triggers immediate reload with new version without losing user session
- **Cache Management**: Versioned cache system automatically cleans up old cached assets on update
- **Offline Support**: App continues to work offline using cached assets for core navigation and features

### Professional PDF Redesign (October 2, 2025)
- **Enhanced Header**: Two-column layout with company branding on left and cotización info (date, number) on right
- **Client Information Grid**: Reorganized in 2-column responsive grid for cleaner presentation
- **5-Column Product Table**: Producto, Unidad, Cant., Precio, Total with professional styling and borders
- **Product Details**: SKU displayed as subtitle below product name for better readability
- **Highlighted Totals**: Orange-themed total section with background highlighting for final amount
- **Terms & Conditions**: Grey box with 4 standard terms (validity, IVA, stock, payment conditions)
- **Payment Information**: Orange-highlighted box with Getnet payment link and complete bank transfer details (Banco Santander, RUT, account number)
- **Professional Formatting**: Consistent spacing, typography, and color scheme matching brand identity

### PDF Generation Migration (October 1, 2025)
- **React-PDF Integration**: Migrated from html2pdf.js to @react-pdf/renderer for reliable PDF generation
- **Native PDF Generation**: PDFs are now generated programmatically without HTML-to-canvas conversion, eliminating layout collapse issues
- **Consistent Rendering**: All PDFs render correctly across mobile and desktop with proper content height
- **Component-Based Approach**: PDF documents defined as React components with StyleSheet for professional formatting
- **Performance Improvement**: Faster PDF generation without DOM manipulation or temporary containers
- **File Size Optimization**: PDFs now have proper content instead of empty 3KB files

### Quote Sharing Enhancement (October 1, 2025)
- **Email Integration**: "Enviar por Correo" button now opens the device's email client with PDF automatically attached
- **Web Share API**: Uses native Web Share API on mobile devices for seamless sharing via email, WhatsApp, etc.
- **Fallback Support**: Desktop browsers automatically download PDF and open mailto: link for manual attachment
- **Mobile PDF Optimization**: Responsive CSS media queries ensure PDFs render perfectly on mobile screens with reduced font sizes and compact spacing
- **UX Improvement**: "Nuevo Presupuesto" button hides during client search on mobile to prevent screen clutter

### Invoice Access Control (October 2025)
- **Role-Based Filtering**: Implemented server-side and client-side filtering for invoice/transaction access
- **Salesperson Restrictions**: Salespeople can only view their own invoices/transactions in both Facturas and Órdenes pages
- **Security Enhancement**: Backend enforces filtering based on authenticated user role, preventing unauthorized access
- **Admin/Supervisor Access**: Administrators and supervisors maintain full access to all invoices across the system

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

### NVV Import System (September 30, 2025)
- **Direct Import**: All NVV (Notas de Ventas Pendientes) records from CSV are imported directly without any filtering
- **Complete Data Capture**: System imports every row from the CSV file to ensure complete visibility of all sales notes
- **Batch Processing**: Efficient batch processing with duplicate detection via database unique constraints
- **Import Statistics**: Enhanced logging shows inserted records and duplicates skipped during import
- **Date Tracking**: Table includes both FEEMDO (original document date) and system timestamps for complete audit trail

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