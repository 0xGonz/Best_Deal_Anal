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

- **June 30, 2025**: Capital Call = Payment Business Rule Implementation (Final)
  - **CORE FIX**: Enforced fundamental business rule "Capital Call = Payment" (if 20% called, then 20% paid)
  - **Database Solution**: Created PostgreSQL functions and triggers to maintain called = paid relationship
  - **Data Synchronization**: Auto-generated capital calls for allocations with payments but no formal calls
  - **Real-time Enforcement**: Database triggers automatically sync called and paid amounts on any changes
  - **Production Ready**: Scalable solution that works across entire platform without manual intervention
  - **Consistency Verification**: Income Fund II now correctly shows $1.6M called = $1.6M paid (was $0 called before)
  - **AUM Fix**: Fund AUM automatically updated to $1.6M to reflect actual called capital
  - **Future-Proof**: Any new capital calls or payments automatically maintain the called = paid relationship

## Changelog

Changelog:
- June 30, 2025. Initial setup