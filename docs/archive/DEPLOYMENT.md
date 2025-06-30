# Deployment Guide

## Pre-deployment Checklist

### Required Environment Variables
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/dealflow
SESSION_SECRET=your-secure-session-secret-here
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

### Optional Configuration
```bash
OPENAI_API_KEY=your-openai-api-key-here  # For AI features
CORS_ORIGIN=https://yourdomain.com       # For production CORS
```

## Database Setup

1. Ensure PostgreSQL is running and accessible
2. Run database migrations:
   ```bash
   npm run db:push
   ```

## Production Deployment

### Using Replit Deployments
1. Set environment variables in Replit Secrets
2. Click "Deploy" button in Replit interface
3. Application will be available at your `.replit.app` domain

### Manual Deployment
```bash
npm install
npm run build
npm start
```

## Health Check
Access `/api/system/health` to verify deployment status.

## Security Considerations
- Session secrets should be cryptographically secure
- Database credentials should be rotated regularly
- CORS origins should be explicitly configured for production

## Collaborative Features
- Multi-user authentication system
- Role-based access control (admin, partner, analyst, observer, intern)
- Real-time activity feeds
- Document sharing and collaboration
- Deal assignment and tracking
- Notification system

## Performance Monitoring
- Application uptime: Available at health endpoint
- Error rate monitoring: Built-in metrics tracking
- Database connection monitoring: Automatic failover to hybrid storage