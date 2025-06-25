# Investment Lifecycle Management Platform

## Overview

This repository contains a full-stack investment lifecycle management platform built for funds, family offices, and venture firms. The application provides comprehensive deal tracking, document management, capital call processing, and portfolio analytics through a modern web interface.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: TailwindCSS with Radix UI components for a consistent design system
- **State Management**: TanStack React Query for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Routing**: Client-side routing with React Router

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety across the entire stack
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL store for production
- **Authentication**: Session-based authentication with role-based access control
- **File Storage**: Hybrid file system and database BLOB storage for documents

## Key Components

### Database Layer
- **ORM**: Drizzle ORM providing type-safe database queries
- **Schema**: Centralized schema definitions in `shared/schema.ts`
- **Storage Pattern**: Factory pattern with multiple storage implementations (DatabaseStorage, MemStorage, HybridStorage)
- **Connection Management**: Optimized PostgreSQL connection pooling with error recovery

### Service Layer
- **Modular Services**: Each business domain has dedicated services (DealService, UserService, AllocationService)
- **Base Service**: Common functionality shared across all services
- **Enterprise Services**: Audit logging, metrics collection, and caching services
- **Workflow Orchestration**: Investment workflow service for complex business processes

### API Structure
- **RESTful Endpoints**: Organized by resource type (deals, funds, users, allocations)
- **Middleware**: Authentication, error handling, and metrics collection
- **Validation**: Zod schemas for request/response validation
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Investment Management Features
- **Deal Pipeline**: Kanban-style deal tracking with stage management
- **Fund Administration**: Fund creation, allocation tracking, and performance metrics
- **Capital Calls**: Automated capital call generation with payment tracking
- **Document Management**: Secure file upload, storage, and retrieval with PDF rendering
- **Calendar Integration**: Unified calendar for meetings, closings, and capital calls

## Data Flow

### Request Flow
1. Frontend React components make API calls using React Query
2. Express routes handle requests with authentication middleware
3. Controllers delegate to service layer for business logic
4. Services interact with storage layer (database or memory)
5. Responses flow back through the same layers with proper error handling

### Data Persistence
- Primary data stored in PostgreSQL via Drizzle ORM
- Session data persisted in PostgreSQL for production environments
- File storage uses hybrid approach (filesystem + database BLOBs)
- Caching layer for frequently accessed data

### Real-time Updates
- Server-sent events for notifications
- WebSocket support for real-time collaboration features
- Event-driven architecture for cross-service communication

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL (required)
- **Node.js**: Version 18+ required
- **Redis**: Optional, for job queues and advanced caching

### Third-party Integrations
- **OpenAI API**: Optional, for AI-powered document analysis
- **Email Services**: Configurable for notifications
- **File Storage**: Local filesystem with database fallback

### Development Tools
- **ESLint + Prettier**: Code formatting and linting
- **TypeScript**: Static type checking
- **Drizzle Kit**: Database migrations and introspection

## Deployment Strategy

### Production Deployment
- **Platform**: Optimized for Replit deployments with autoscale support
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Environment**: Configuration through environment variables
- **Database**: PostgreSQL connection required

### Development Environment
- **Hot Reload**: Vite HMR for frontend, tsx for backend development
- **Database**: Local PostgreSQL or development database
- **Session Storage**: Memory sessions for development (configurable)

### Configuration Management
- **Environment Variables**: Comprehensive .env.example provided
- **Security**: Session secrets, database credentials, API keys
- **Feature Flags**: Optional features can be enabled/disabled

## Recent Changes
```
- June 25, 2025: MAJOR ARCHITECTURE OVERHAUL - Implemented rock-solid AllocationCoreService with complete separation of concerns
- June 25, 2025: Fixed critical data corruption issue where portfolio weight calculations were overwriting allocation statuses
- June 25, 2025: Implemented atomic transactions with proper isolation to prevent race conditions
- June 25, 2025: Created immutable weight calculation system that never modifies unrelated allocation fields
- June 25, 2025: Fixed duplicate detection logic to precisely check fund-deal combinations only
- June 25, 2025: Restored APP SPV allocation status to 'funded' and prevented future status corruption
- June 25, 2025: Built modular, scalable allocation architecture with proper error boundaries
- June 25, 2025: Fixed total row alignment in fund allocation table with proper column structure
- June 25, 2025: Enhanced portfolio weight display with consistent decimal formatting (1 decimal place)
- June 25, 2025: Initial setup
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```