
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err: any, req: any, res: any, next: any) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val: any) => val.message);
    error = new AppError(message.join(', '), 400);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

export const notFoundHandler = (req: any, res: any, next: any) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

export class GlobalErrorHandler {
  static setup() {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Log to external service in production
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  static wrapAsync<T>(fn: (...args: any[]) => Promise<T>) {
    return (...args: any[]) => {
      const result = fn(...args);
      if (result && typeof result.catch === 'function') {
        result.catch((error: Error) => {
          console.error('Async error caught:', error);
        });
      }
      return result;
    };
  }
}