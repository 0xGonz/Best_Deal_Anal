# Investment Lifecycle Management Platform

A modern, scalable investment platform for funds, family offices, and venture firms. Built with TypeScript, React, and PostgreSQL.

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and production builds
- **TailwindCSS** + **Radix UI** for consistent design
- **TanStack React Query** for server state management
- **React Hook Form** with Zod validation

### Backend
- **Node.js** + **Express.js** with TypeScript
- **PostgreSQL** with **Drizzle ORM**
- **Session-based authentication** with role-based access control
- **Modular service architecture** with domain separation

### Database
- **PostgreSQL** with optimized indexes and triggers
- **Drizzle ORM** for type-safe database operations
- **Database views** for complex reporting and analytics

## 📁 Project Structure

```
├── client/          # React frontend application
├── server/          # Node.js backend services
│   ├── routes/      # API endpoint definitions
│   ├── services/    # Business logic layer
│   ├── middleware/  # Request processing middleware
│   └── config/      # Configuration files
├── shared/          # Shared types and schemas
├── docs/            # Documentation and guides
└── migrations/      # Database migration files
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Environment variables (see `.env.example`)

### Development
```bash
npm install
npm run dev
```

### Database Setup
```bash
npm run db:push    # Push schema changes
npm run db:studio  # Open database browser
```

## 💼 Core Features

### Deal Management
- **Pipeline tracking** with Kanban-style interface
- **Stage management** (screening → IC review → closing → invested)
- **Document upload** and PDF viewing
- **Activity timeline** and collaboration tools

### Fund Administration
- **Fund creation** and portfolio management
- **Capital call processing** with payment tracking
- **Allocation management** with real-time status updates
- **Performance analytics** and reporting

### Capital Call Lifecycle
- **Multi-capital call** support per allocation
- **Automatic status updates** (committed → partially_paid → funded)
- **Called vs uncalled** capital tracking
- **Payment workflow** with validation

### Document Management
- **Secure file upload** with size limits and validation
- **PDF rendering** with worker-based processing
- **Document categorization** and metadata management
- **Full-text search** capabilities

## 🔧 Key Integrations

### Capital Call System
- **Database integration** with `v_allocation_capital_call_summary` view
- **Real-time calculations** for called/uncalled capital percentages
- **Status synchronization** between allocations and capital calls
- **Fund-level aggregation** for portfolio insights

### Authentication & Security
- **Role-based access control** (Admin, Fund Manager, Analyst, Viewer)
- **Session management** with PostgreSQL store
- **Input validation** and sanitization
- **Security headers** and CSRF protection

## 📊 Performance

### Database Optimization
- **Strategic indexes** on high-traffic tables
- **Database views** for complex aggregations
- **Connection pooling** with health monitoring
- **Query optimization** for sub-200ms response times

### Caching Strategy
- **Query result caching** with TTL expiration
- **Session data optimization**
- **Static asset caching**

## 🏭 Production Deployment

### Environment Setup
```bash
# Required environment variables
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret-key
NODE_ENV=production
```

### Deployment
```bash
npm run build     # Build production assets
npm start         # Start production server
```

### Health Monitoring
- **Health check endpoint**: `/api/system/health`
- **Performance metrics** collection
- **Error tracking** and logging

## 🔐 Security Features

- **Input sanitization** and validation
- **File upload security** with MIME type validation
- **Rate limiting** on API endpoints
- **Security headers** (CSP, HSTS, etc.)
- **SQL injection protection** via parameterized queries

## 📈 Scalability

### Modular Architecture
- **Domain-driven services** for business logic separation
- **Middleware pipeline** for request processing
- **Factory pattern** for storage implementations
- **Event-driven updates** for real-time synchronization

### Performance Monitoring
- **Request timing** and slow query detection
- **Database performance** analytics
- **Resource usage** monitoring
- **Error rate** tracking

## 🧪 Development

### Code Quality
- **TypeScript** for type safety
- **ESLint + Prettier** for code formatting
- **Zod schemas** for runtime validation
- **Error handling** with proper HTTP status codes

### Development Tools
- **Hot reload** with Vite HMR
- **Database browser** with Drizzle Studio
- **API documentation** with endpoint discovery
- **Development logging** with structured output

## 📚 Documentation

- **API Reference**: See `/docs/API.md`
- **Database Schema**: See Drizzle schema definitions
- **Deployment Guide**: See `/docs/DEPLOYMENT.md`
- **Architecture Overview**: See `replit.md`

## 🤝 Contributing

1. Follow TypeScript and ESLint configurations
2. Use proper error handling and validation
3. Maintain database consistency with proper transactions
4. Write meaningful commit messages
5. Update documentation for significant changes

## 📄 License

Private investment management platform. All rights reserved.