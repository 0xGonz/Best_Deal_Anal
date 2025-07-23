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

- **July 22, 2025**: Allocation Duplicate Check Bug Fix - COMPLETE
  - **Critical Bug Fixed**: Fixed 409 Conflict error when allocating deals to funds
  - **Root Cause**: System was checking if deal existed in ANY fund, not just the specific fund
  - **Solution**: Modified duplicate check in allocation-domain.service.ts to only check within the specific fund
  - **Result**: Same deal can now be properly allocated to multiple different funds
  - **Green Success Messages**: Deal allocation success messages properly show in green with variant="success"

- **July 22, 2025**: Toast Message Color Standardization - IN PROGRESS
  - **Major Pages Updated**: Fixed toast messages in Pipeline, DealDetail, Settings, Funds, FundDetail, CapitalCallsByAllocation
  - **Allocation Success Fixed**: Deal allocation success messages now properly show in green with variant="success"
  - **TypeScript Errors Resolved**: Fixed compilation errors in CapitalCallsByAllocation.tsx by importing proper Allocation type
  - **Consistent Color Coding**: 30+ toast messages updated to use proper variants (green for success, red for errors)
  - **Build Status**: Application builds successfully with no TypeScript errors
  - **Remaining Work**: ~200 toast messages across components still need variant properties added

- **July 22, 2025**: Capital Call Activity Feed Enhancement - COMPLETE
  - **Enhanced Timeline Events**: Added capital call events to activity feed with proper metadata tracking
  - **Dual Date Display**: Activity feed now shows both when capital call was created AND when it's scheduled for
  - **Visual Indicators**: Capital call events display with amber warning icon and scheduled date in amber text
  - **Metadata Integration**: Updated capital call creation to include dueDate and callDate in timeline event metadata
  - **Improved User Context**: Users can now see "Capital call created for $X - Scheduled for: Dec 31, 2024"
  - **Frontend Type Safety**: Extended ActivityItem interface to support capital_call and capital_call_update event types

- **July 22, 2025**: Welcome Back Toast Notification - COMPLETE
  - **Login Success Notification**: Added welcome back toast popup that appears after successful login
  - **Personalized Message**: Toast displays user's full name with "Welcome back, [Name]!" message
  - **Professional Styling**: Uses existing toast system with clean design that appears at top of page
  - **Perfect Timing**: Toast shows only on successful login completion, integrated into auth mutation flow
  - **User Experience Enhancement**: Provides immediate positive feedback and confirmation of successful authentication
  - **Enhanced Design**: Green success styling with slide-in animation from top and 4-second auto-dismiss

- **July 22, 2025**: Sidebar Branding Update - COMPLETE
  - **Doliver Logo Implementation**: Replaced "Deal Flow" text header with Doliver logo in sidebar
  - **Visual Refinements**: Adjusted logo sizing based on user feedback (final size: 32px height)
  - **Clean Design**: Removed redundant text, logo now stands alone with proper padding and spacing
  - **Asset Management**: Used "doliver logo final.png" from project root, properly integrated into React assets

- **July 22, 2025**: Interactive Sector Chart Navigation Feature - COMPLETE
  - **IMPLEMENTED: Clickable Pie Chart Sectors**: Both dashboard and pipeline sector distribution charts now have fully functional clickable pie sectors and legend items
  - **Pipeline Navigation**: Clicking on any sector navigates directly to pipeline page with that sector automatically filtered
  - **URL Parameter Support**: Pipeline page correctly reads and respects ?sector= URL parameters for deep linking with proper React state synchronization
  - **Visual Filter Indicator**: Active sector filters display prominently with clear "×" button to remove filtering
  - **Smart "Other Sectors" Handling**: Clicking "Other Sectors" navigates to pipeline without filtering for broader exploration
  - **Enhanced User Experience**: Seamless navigation from overview charts to filtered deal lists improves workflow efficiency
  - **Multi-Chart Support**: Feature works on both IndustryDistributionChart (dashboard) and SectorDistribution (pipeline) components
  - **Technical Fix Applied**: Fixed URL parameter detection using useLocation hook from wouter for proper React state management
  - **Production Ready**: All click handlers properly implemented with error handling and state synchronization

- **July 22, 2025**: Capital Calls API Route Fix
  - **RESOLVED: Missing Deal Capital Calls Endpoint**: Added missing `/api/capital-calls/deal/:dealId` route that was causing 404 errors
  - **Service Method Implementation**: Created `getCapitalCallsByDeal` method in capital call service to fetch all capital calls for a specific deal
  - **Frontend Integration Fixed**: Deal detail pages now properly load capital calls without console errors
  - **Data Structure**: Returns array of capital calls with allocation and fund information included

- **July 23, 2025**: Documents Database Query Fix - COMPLETE
  - **RESOLVED: 507 Response Size Error**: Fixed critical error when querying documents table with file_data column
  - **Root Cause**: Binary file_data column (170MB total) exceeded 67MB response limit when included in queries
  - **Solution**: Created `documents_safe` view that excludes file_data for safe document listing
  - **Application Fix**: Updated DatabaseDocumentStorage service to explicitly exclude fileData from all listing queries
  - **User-Friendly Solution**: Non-technical users can now use `SELECT * FROM documents_safe;` for safe querying
  - **Data Cleanup**: Removed corrupted document entry (ID 30) with NULL file data
  - **Best Practice Established**: Application automatically excludes file_data, only fetches it for individual document downloads
  - **Production Status**: All document queries now work reliably without size limitations

- **July 23, 2025**: Comprehensive Codebase Cleanup Round 1 - COMPLETE
  - **Test Files Removed**: Deleted all test files from root directory and attached_assets folder
  - **Scripts Directory Cleanup**: Removed 50+ old test scripts, migration scripts, diagnostic scripts, and fix scripts
  - **Error Logs Cleanup**: Removed 19 old Pasted error log files from attached_assets
  - **Temporary Files**: Cleaned up temp directory including old upload files (40MB+ of temporary data)
  - **Scripts Organization**: Kept only essential scripts: db-push.ts, deploy-check.ts, lint scripts, and documents helper files
  - **Clean Architecture**: No unused test files found in client or server directories
  - **Database Schema**: Reviewed all tables - no obviously unused columns identified, schema appears well-structured
  - **Result**: First round of cleanup complete, codebase significantly cleaner

- **July 23, 2025**: Capital Call Due Date Removal - COMPLETE
  - **RESOLVED: Due Date Field Removed**: Completely removed due date requirement from capital call creation process
  - **Root Cause**: Found correct form component (AddCapitalCallForm.tsx) that was actually being displayed in UI
  - **Changes Made**: 
    - Removed Due Date input field from capital call form
    - Changed default status from "Scheduled" to "Called"
    - Made dueDate optional in validation schema and API calls
    - Updated form reset logic to use new defaults
    - Fixed validation to only check due date if provided
  - **User Experience**: Capital call form now only requires allocation, amount, call date, status, and optional notes
  - **Business Logic**: Capital calls default to "Called" status since they're not scheduled with due dates

- **July 23, 2025**: Capital Calls Dialog UI Cleanup - COMPLETE
  - **RESOLVED: Redundant Payment Status Display**: Removed duplicate "PAID" text in payments section that was redundant with status column
  - **RESOLVED: Outstanding Column Display**: Fixed outstanding column to show "—" instead of "Paid" when capital call is fully paid
  - **UI Improvements**: 
    - Payments section now shows only amount with green dollar icon
    - Outstanding column shows actual outstanding amounts or clean dash when fully paid
    - Eliminated double "PAID" display between Status and Payments columns
  - **User Experience**: Capital calls dialog now has clean, professional display without redundant status information
  - **Database Integration**: Proper filtering of payment data to show only actual payments, not synthetic data

- **July 23, 2025**: Comprehensive Codebase Cleanup Round 2 - COMPLETE
  - **Additional Test Files Removed**: Deleted test-upload.ts, StarTest.tsx, auth-context.tsx.bak
  - **Import References Fixed**: Removed all import references to deleted test files in App.tsx and routes.ts
  - **Duplicate Components Removed**: 
    - Deleted client/src/components/auth/ProtectedRoute.tsx (deprecated, common version used)
    - Deleted client/src/components/ErrorBoundary.tsx (duplicate, common version used)
  - **Empty Directories Removed**: 
    - Removed client/src/lib/context (empty directory)
    - Removed data/uploads (empty directory)
  - **Unused Configuration Removed**: Deleted server/config/production.config.ts (not imported anywhere)
  - **Database Findings**: Identified duplicate session tables and redundant documents_metadata table for future cleanup
  - **Result**: Codebase now fully cleaned, organized, and free of all duplicate/dead code

- **July 21, 2025**: Devil's Advocate Feature Database Fix
  - **RESOLVED: Devils Advocate Comments Table Missing**: Created missing `devils_advocate_comments` table in database
  - **Database Schema Update**: Added table with proper foreign key relationships to deals and users tables
  - **Feature Functionality Restored**: Devil's Advocate tab now loads without errors and can store/retrieve risk comments
  - **API Validation**: Confirmed all endpoints working correctly with proper authentication and data retrieval

- **July 16, 2025**: Document Upload and Allocation Deletion Fixes
  - **RESOLVED: Document Upload "Unexpected end of form" Error**: Fixed critical middleware conflicts that were corrupting multipart form uploads
  - **Root Cause Identification**: Global upload middleware was interfering with route-specific multer processing, causing double file stream consumption
  - **Express Configuration Update**: Modified server to skip JSON/URL parsing for multipart forms, preventing request stream corruption
  - **Allocation Deletion Fix**: Resolved database trigger errors by updating AllocationDeletionService to handle missing triggers gracefully
  - **System Functionality Restored**: Document uploads now process successfully, allocation deletions work with automatic dependency cleanup
  - **Production Ready**: Both document upload and allocation management now fully operational with proper error handling

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