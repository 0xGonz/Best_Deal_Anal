/**
 * Upload Limits Middleware
 * 
 * Implements back-pressure controls to prevent memory saturation from large uploads.
 * Addresses Issue #2 from performance audit - Missing back-pressure on uploads.
 */

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure upload limits - Max 50MB per file, max 5 files per request
const UPLOAD_LIMITS = {
  fileSize: 50 * 1024 * 1024, // 50MB
  files: 5,
  fields: 20,
  parts: 100
};

// Create temp directory if it doesn't exist
const tempDir = path.join(process.cwd(), 'temp', 'uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for efficient file handling
export const uploadLimiter = multer({
  dest: tempDir,
  limits: UPLOAD_LIMITS,
  fileFilter: (req, file, cb) => {
    // Allow common business file types
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Rate limiting for upload endpoints
export const uploadRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  
  // Simple in-memory rate limiting - allows 10 uploads per minute per IP
  if (!global.uploadLimits) {
    global.uploadLimits = new Map();
  }
  
  const uploads = global.uploadLimits.get(clientId) || [];
  const recentUploads = uploads.filter((time: number) => now - time < 60000); // Last minute
  
  if (recentUploads.length >= 10) {
    return res.status(429).json({
      error: 'Too many uploads. Please wait before uploading more files.',
      retryAfter: 60
    });
  }
  
  recentUploads.push(now);
  global.uploadLimits.set(clientId, recentUploads);
  
  next();
};

// Content-Length validation middleware
export const validateContentLength = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  if (contentLength > UPLOAD_LIMITS.fileSize) {
    return res.status(413).json({
      error: `File size too large. Maximum allowed: ${UPLOAD_LIMITS.fileSize / (1024 * 1024)}MB`,
      maxSize: UPLOAD_LIMITS.fileSize
    });
  }
  
  next();
};

// Error handler for multer errors
export const handleUploadErrors = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `File too large. Maximum size: ${UPLOAD_LIMITS.fileSize / (1024 * 1024)}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({
        error: `Too many files. Maximum: ${UPLOAD_LIMITS.files} files per request`
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field'
      });
    }
  }
  
  if (error.message.includes('File type')) {
    return res.status(400).json({
      error: error.message
    });
  }
  
  next(error);
};

// Cleanup middleware to remove temp files after processing
export const cleanupTempFiles = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    // Clean up any uploaded files
    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      files.forEach((file: any) => {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Failed to cleanup temp file:', file.path, err);
          });
        }
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

declare global {
  var uploadLimits: Map<string, number[]>;
}