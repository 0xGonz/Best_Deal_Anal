# DealFlowLifecycle - Replit Project Guide

## Overview

DealFlowLifecycle is a full-stack TypeScript application for managing private equity deal pipelines, fund allocations, capital calls, and document workflows. It's built as a monorepo with a React frontend and Express.js backend, designed for deployment on Replit.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom configuration for Replit
- **UI Library**: Radix UI components with Tailwind CSS styling
- **State Management**: TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router for client-side navigation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Session-based with Express sessions
- **File Upload**: Multer middleware for document handling
- **API Design**: RESTful endpoints with middleware layers

### Database Strategy
- **Primary Database**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle with type-safe queries
- **Migrations**: Drizzle Kit for schema management
- **Session Storage**: PostgreSQL-based session store

## Key Components

### Deal Management
- Deal pipeline tracking with status progression
- Stage-based workflow (sourcing → review → invested)
- Document attachment and PDF viewing capabilities
- Deal-to-fund allocation workflows

### Fund Operations
- Multi-fund allocation system
- Capital call generation and tracking
- Payment processing and reconciliation
- Fund metrics calculation (AUM, IRR, MOIC)

### Document System
- PDF upload and storage in PostgreSQL
- Embedded PDF viewer using PDF.js worker
- Document metadata and version tracking
- Deal-specific document organization

### User Management
- Session-based authentication
- Role-based access control
- User avatar generation with initials
- Activity tracking and audit logs

## Data Flow

### Allocation Workflow
1. Deal marked as "invested" triggers allocation creation
2. Fund allocations establish commitment amounts
3. Capital calls generate payment requests
4. Payments update funded amounts and allocation status
5. Metrics recalculation updates fund-level totals

### Document Processing
1. File upload via multipart form data
2. Temporary storage during validation
3. Binary data storage in PostgreSQL
4. PDF.js worker handles client-side rendering
5. Download URLs provide secure file access

### Authentication Flow
1. Login credentials validated against user table
2. Session created and stored in PostgreSQL
3. Session ID cookie maintains authentication state
4. Middleware validates session on protected routes

## External Dependencies

### Core Runtime Dependencies
- **@anthropic-ai/sdk**: AI integration for document analysis
- **@neondatabase/serverless**: PostgreSQL connection driver
- **@tanstack/react-query**: Client-side data fetching
- **drizzle-orm**: Database ORM and query builder
- **express**: Backend web framework
- **multer**: File upload handling

### UI Dependencies
- **@radix-ui/***: Comprehensive UI component library
- **tailwindcss**: Utility-first CSS framework
- **react-hook-form**: Form state management
- **zod**: Schema validation library

### Development Tools
- **vite**: Frontend build tool and dev server
- **typescript**: Static type checking
- **eslint**: Code linting with React/TypeScript rules
- **prettier**: Code formatting

## Deployment Strategy

### Replit Environment
- **Build Command**: `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
- **Start Command**: `NODE_ENV=production node dist/index.js`
- **Development**: `NODE_ENV=development tsx server/index.ts`

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `ANTHROPIC_API_KEY`: AI service authentication (optional)

### File Structure
- `client/`: React frontend application
- `server/`: Express backend application  
- `shared/`: Common types and schemas
- `migrations/`: Database schema migrations
- `dist/`: Production build output

### Performance Considerations
- Session storage in PostgreSQL for persistence
- File uploads limited to prevent memory issues
- Database connection pooling via Neon serverless
- Static assets served via Vite in development

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **June 30, 2025**: Complete Distributions Management System Implementation
  - **Distributions API Integration COMPLETE**: Fixed database query in distributions routes to properly join deals table for dealName resolution
  - **Frontend Data Mapping**: Corrected DistributionsManagementHub to use `distribution.dealName` instead of `distribution.allocation?.dealName`
  - **Comprehensive Error Handling**: Added robust loading states, error display, and debug capabilities to distributions components
  - **API Endpoint Architecture**: Unified distribution endpoints with proper URL structure (`/api/distributions/fund/${fundId}`)
  - **Data Flow Verification**: Confirmed $100k historical distribution properly displays with "Urban Genesis" deal name
  - **Multi-Level Integration**: Distributions management works across fund-level, allocation-level, and deal-level contexts
  - **Form Integration**: Add Distribution dialog correctly populates allocation dropdown with deal names and amounts
  - **Real-time Updates**: Distribution CRUD operations properly invalidate caches and update UI immediately
  - **Production Ready**: All distribution functionality tested and working with actual data integration

- **June 30, 2025**: Complete Deal Data Integration and Whole Number Formatting System
  - **Deal Data Integration COMPLETE**: All allocations now include dealName and dealSector fields directly from API
  - **Comprehensive Validation Service**: Created dataIntegration.ts with validateDataIntegration, validateSectorDataCompleteness, and validateFinancialDataIntegrity functions
  - **Real-time Integration Monitoring**: Added data integrity validation to FundDetail component with live status checking
  - **Visual Data Status Indicators**: Fund overview shows "Data Integration" status with green checkmark when all deal data is properly connected
  - **Intelligent Error Detection**: Alert system detects orphaned allocations, missing deal fields, and data consistency issues
  - **Unified Metrics Integration**: Both sector distribution and capital ratio charts use fully integrated deal data with real-time updates
  - **Whole Number Formatting**: All currency amounts and percentages now display as whole numbers throughout the app (no decimals)
  - **Consistent Number Display**: Math.round() applied to all percentage calculations, formatCurrency defaults to showCents: false
  - **Production Verified**: All 4 allocations in Doliver Private Opportunity Fund III show complete deal integration with clean whole number formatting
  - **Future-Proof Architecture**: Data integration validation runs automatically and scales with fund growth

- **June 30, 2025**: Complete Single Source of Truth Architecture Implementation
  - **Status Inconsistency RESOLVED**: Created vw_fund_allocations_with_status view that derives status from capital call data, eliminating stored vs actual status mismatches
  - **Comprehensive Database Views**: Implemented vw_fund_overview as single source of truth for all fund metrics (committed, called, uncalled, weight percentages, MOIC)
  - **New API Endpoint**: Created /api/fund-overview endpoint serving database-calculated metrics instead of multiple application layers
  - **Frontend Architecture**: Built useFundOverview hook and useCapitalCallMutations with automatic cache invalidation
  - **Real-time Updates**: Set staleTime: 0 on critical queries and automatic React Query invalidation after mutations
  - **Eliminated Multiple Calculation Layers**: Moved all aggregation to database level, removing inconsistencies between SQL, Node, and React layers
  - **Production Ready Solution**: Balerion Space Fund II now correctly shows "partially_paid" status (40% called: $1M of $2.5M)
  - **Future-Proof**: All fund metrics now calculated once at database level and served consistently across all UI components
  - **Architecture Pattern**: Established pattern of database views as single source of truth for complex calculations

- **June 30, 2025**: NaN Value Prevention and Data Type Safety Implementation  
  - **Weight Column NaN FIXED**: Enhanced calculateDynamicWeight function with safe numeric conversion and division guards
  - **Frontend Protection**: Added useMemo-wrapped weight calculation with NaN protection in FundDetail component
  - **Table Formatter Safety**: Updated portfolioWeight formatter in tableConfig to handle null, undefined, and NaN values gracefully
  - **Multiple Layer Guards**: Applied consistent numeric validation across InvestmentAllocationsTable and ModularTable components
  - **Sector Chart Protection**: Verified FundSectorDistribution component has proper empty data handling and loading states
  - **Type Safety**: Enforced Number() casting and isNaN() checks throughout weight calculation pipeline
  - **User Experience**: Eliminated "NaN%" display in Weight columns, showing "0.00%" for invalid values instead

## Changelog

Changelog:
- June 30, 2025. Initial setup