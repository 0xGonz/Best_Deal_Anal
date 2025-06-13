
# Investment Platform Documentation

## API Endpoints

### Authentication
- GET /api/auth/me - Get current user
- POST /api/auth/login - Login user
- POST /api/auth/logout - Logout user

### Funds
- GET /api/funds - Get all funds
- GET /api/funds/:id - Get fund by ID
- POST /api/funds - Create new fund

### Allocations
- GET /api/allocations/fund/:id - Get allocations for fund
- POST /api/allocations - Create new allocation

## Error Handling
All API endpoints return standardized error responses with:
- code: Error code identifier
- message: Human-readable error message
- timestamp: ISO timestamp of error

## Security
- All endpoints require authentication
- File uploads are validated and sanitized
- CORS configured for production domains
