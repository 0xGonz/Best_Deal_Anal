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

- **June 30, 2025**: Comprehensive platform fixes and dynamic status solution
  - Major architecture cleanup: Removed 15+ unused service files 
  - Fixed critical 404 error for /api/allocations endpoint by adding missing GET route
  - Implemented scalable dynamic status calculation based on capital calls data
  - Resolved allocation-database disconnect with SQL-based status computation
  - Fixed TypeScript errors and missing getFundAllocations method implementation
  - Created modular solution where status tags automatically change based on capital call lifecycle
  - Status logic: committed → called_unpaid → partially_paid → funded based on actual data
  - Eliminated manual status updates by computing status dynamically in real-time

## Changelog

Changelog:
- June 30, 2025. Initial setup