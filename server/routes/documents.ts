import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { databaseDocumentStorage } from '../services/database-document-storage.js';
import { requireAuth } from '../utils/auth.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '../db-read-replica.js';
import { documents } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = 'temp/uploads/';
fs.mkdir(uploadDir, { recursive: true }).catch((err) => {
  if (err.code !== 'EEXIST') {
    console.error('Failed to create upload directory:', err);
  }
});

// Configure multer with disk storage to avoid memory issues
const upload = multer({
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        console.error('Error creating upload directory:', error);
        cb(error, uploadDir);
      }
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    fieldSize: 50 * 1024 * 1024, // 50MB for fields
    parts: 100, // limit parts
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, XLS, CSV, and images are allowed.'));
    }
  }
});

// Handle multer errors
const handleUpload = (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Upload document with file system storage (simplified middleware stack)
router.post('/upload', requireAuth, handleUpload, async (req, res) => {
  try {
    console.log('📤 Document upload request received', {
      hasFile: !!req.file,
      dealId: req.body.dealId,
      documentType: req.body.documentType,
      userId: req.session?.userId
    });
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { dealId, documentType = 'other', description } = req.body;

    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID is required' });
    }

    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate file
    console.log('🔍 Validating file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    
    const validation = await databaseDocumentStorage.validateFile(
      req.file.originalname,
      req.file.mimetype,
      req.file.size
    );

    console.log('📋 File validation result:', validation);

    if (!validation.valid) {
      console.error('❌ File validation failed:', validation.reason);
      return res.status(400).json({ error: validation.reason });
    }

    // Sanitize filename for security (prevent XSS)
    const sanitizedFileName = DOMPurify.sanitize(req.file.originalname);
    
    console.log(`Processing document upload: ${sanitizedFileName} for deal ${dealId}`);

    // Read the temporary file uploaded by multer
    const tempFilePath = req.file.path;
    const fileBuffer = await fs.readFile(tempFilePath);
    
    console.log(`📁 Reading temporary file: ${tempFilePath} (${fileBuffer.length} bytes)`);
    
    // Use the database storage service to store the document
    const newDocument = await databaseDocumentStorage.createDocument({
      dealId: parseInt(dealId),
      fileName: sanitizedFileName,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileBuffer: fileBuffer,
      uploadedBy: userId,
      description: description || null,
      documentType: documentType || 'other'
    });
    
    // Clean up the temporary file
    try {
      await fs.unlink(tempFilePath);
      console.log(`🧹 Cleaned up temporary file: ${tempFilePath}`);
    } catch (cleanupError) {
      console.warn(`⚠️ Could not clean up temporary file: ${tempFilePath}`, cleanupError);
    }

    console.log(`✓ Document uploaded successfully: ID ${newDocument.id}, stored in database`);
    
    const responseData = {
      id: newDocument.id,
      fileName: newDocument.fileName,
      fileType: newDocument.fileType,
      fileSize: newDocument.fileSize,
      documentType: newDocument.documentType,
      description: newDocument.description,
      uploadedAt: newDocument.uploadedAt,
      message: 'Document uploaded and stored successfully'
    };
    
    console.log('📤 Sending upload response:', responseData);
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Provide more specific error details for debugging
    let errorMessage = 'Internal server error during upload';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download document - handles both database and filesystem storage
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // First try to get document from database
    const document = await databaseDocumentStorage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 1) If there is nonzero fileData in the DB, send it:
    if (document.fileData && document.fileData.length > 0) {
      try {
        // Handle both string and Buffer types for fileData
        let fileBuffer: Buffer;
        
        if (typeof document.fileData === 'string') {
          // If stored as text/string, decode from base64
          console.log(`🔍 Processing string data: length=${document.fileData.length}`);
          fileBuffer = Buffer.from(document.fileData, 'base64');
        } else if (Buffer.isBuffer(document.fileData)) {
          // If stored as bytea/Buffer, it's already binary data
          // The data is base64 encoded within the bytea, so we need to:
          // 1. Convert Buffer to string (which gives us the base64)
          // 2. Then decode the base64 to get actual PDF bytes
          const base64String = document.fileData.toString('utf-8');
          console.log(`🔍 Processing bytea data: buffer length=${document.fileData.length}, base64 length=${base64String.length}, starts with: ${base64String.substring(0, 20)}`);
          fileBuffer = Buffer.from(base64String, 'base64');
        } else {
          console.error(`❌ Unexpected fileData type for document ${documentId}:`, typeof document.fileData);
          return res.status(410).json({ error: 'Document content appears corrupted. Please try re-uploading this document.' });
        }
        if (fileBuffer.length > 0) {
          // Validate PDF structure if it's a PDF file
          if (document.fileType === 'application/pdf') {
            const pdfHeader = fileBuffer.subarray(0, 4).toString();
            if (!pdfHeader.startsWith('%PDF')) {
              console.error(`❌ Invalid PDF structure for document ${documentId}: expected %PDF, got ${pdfHeader}`);
              return res.status(410).json({ error: 'Document appears corrupted or incomplete. Please try re-uploading this document.' });
            } else {
              console.log(`✅ Valid PDF header detected: ${pdfHeader}`);
            }
          }
          
          console.log(`📥 Serving document ${documentId} from database: ${document.fileName} (${fileBuffer.length} bytes)`);
          
          res.removeHeader('ETag');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Content-Type', document.fileType);
          const disposition = document.fileType === 'application/pdf' ? 'inline' : 'attachment';
          res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(document.fileName)}"`);
          res.setHeader('Content-Length', fileBuffer.length.toString());
          return res.send(fileBuffer);
        }
      } catch (base64Error) {
        console.error(`❌ Error decoding base64 data for document ${documentId}:`, base64Error);
        return res.status(410).json({ error: 'Document content appears corrupted. Please try re-uploading this document.' });
      }
      // If fileBuffer.length is actually 0, skip to the filesystem fallback
    } 
    
    // 2) Otherwise, try to stream from the filesystem:
    if (document.filePath) {
      const fs = await import('fs');
      const path = await import('path');
      
      // Make sure filePath is stored as something like "storage/documents/deal-108/foo.pdf"
      const fullPath = path.resolve(document.filePath);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Legacy file not found: ${fullPath}`);
        console.error(`📊 Document ${documentId} metadata: fileSize=${document.fileSize}, hasFileData=${!!document.fileData}`);
        return res.status(410).json({ 
          error: 'Document file no longer available on disk',
          details: {
            documentId,
            fileName: document.fileName,
            expectedPath: fullPath,
            hasDbData: !!document.fileData,
            fileSize: document.fileSize
          }
        });
      }

      console.log(`📂 Serving legacy document ${documentId} from filesystem: ${document.filePath}`);
      
      // Remove any ETag and force 200 + document bytes:
      res.removeHeader('ETag');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Set content type and disposition
      res.setHeader('Content-Type', document.fileType);
      const disposition = document.fileType === 'application/pdf' ? 'inline' : 'attachment';
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(document.fileName)}"`);

      // Stream file off disk:
      const fileStream = fs.createReadStream(fullPath);
      fileStream.on('error', (err) => {
        console.error(`❌ Error streaming file ${fullPath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error reading file from disk' });
        }
      });
      return fileStream.pipe(res);
    }

    // 3) If neither branch worked:
    console.error(`❌ Document ${documentId} has no fileData and no filePath`);
    return res.status(410).json({ 
      error: 'Document content not available',
      details: {
        documentId,
        fileName: document.fileName,
        hasDbData: !!document.fileData,
        hasFilePath: !!document.filePath,
        fileSize: document.fileSize
      }
    });

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Internal server error during download' });
  }
});

// View document in browser (for PDFs and images)
router.get('/:id/view', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // First try to get document from database
    const document = await databaseDocumentStorage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 1) If there is nonzero fileData in the DB, send it:
    if (document.fileData && document.fileData.length > 0) {
      const fileBuffer = Buffer.from(document.fileData, 'base64');
      if (fileBuffer.length > 0) {
        console.log(`📖 Serving document ${documentId} for viewing from database: ${document.fileName} (${fileBuffer.length} bytes)`);
        
        res.removeHeader('ETag');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', document.fileType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
        res.setHeader('Content-Length', fileBuffer.length.toString());
        return res.send(fileBuffer);
      }
      // If fileBuffer.length is actually 0, skip to the filesystem fallback
    } 
    
    // Fallback to filesystem for legacy documents
    if (document.filePath) {
      console.log(`📂 Serving legacy document ${documentId} for viewing from filesystem: ${document.filePath}`);
      
      const fs = await import('fs');
      const path = await import('path');
      
      const fullPath = path.resolve(document.filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Legacy file not found: ${fullPath}`);
        return res.status(410).json({ error: 'Document file no longer available' });
      }

      // Set appropriate headers for inline viewing
      res.setHeader('Content-Type', document.fileType);
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.removeHeader('ETag');
      
      // Stream the file
      const fileStream = fs.createReadStream(fullPath);
      fileStream.on('error', (err) => {
        console.error(`❌ Error reading legacy file ${fullPath}:`, err);
        if (!res.headersSent) {
          res.status(410).json({ error: 'Document file no longer available' });
        }
      });
      
      return fileStream.pipe(res);
    }

    // No file data available
    console.error(`❌ Document ${documentId} has no file data in database or filesystem`);
    return res.status(410).json({ error: 'Document content not available' });

  } catch (error) {
    console.error('Error viewing document:', error);
    res.status(500).json({ error: 'Internal server error during view' });
  }
});

// Get individual document metadata
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const document = await databaseDocumentStorage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Return document metadata (exclude file data)
    res.json({
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      documentType: document.documentType,
      description: document.description,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedBy,
      dealId: document.dealId,
      hasFileData: !!document.fileData,
      downloadUrl: `/api/documents/${document.id}/download`,
      viewUrl: `/api/documents/${document.id}/view`
    });

  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get documents for a deal
router.get('/deal/:dealId', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    const documents = await databaseDocumentStorage.getDocumentsByDeal(dealId);
    
    // Format documents for frontend (exclude file data from list)
    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      documentType: doc.documentType,
      description: doc.description,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      hasFileData: !!doc.fileData, // Indicate if file has data in database
      // Add download/view URLs
      downloadUrl: `/api/documents/${doc.id}/download`,
      viewUrl: `/api/documents/${doc.id}/view`
    }));

    res.json(formattedDocuments);

  } catch (error) {
    console.error('Error getting documents for deal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update document metadata (shared handler for both PATCH and PUT)
const updateDocumentHandler = async (req: any, res: any) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const { fileName, description, documentType } = req.body;

    // Build update object only with provided fields to avoid overwriting with undefined
    const updateData: any = { uploadedAt: new Date() };
    
    if (fileName !== undefined && fileName !== '') {
      updateData.fileName = DOMPurify.sanitize(fileName);
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (documentType !== undefined && documentType !== '') {
      updateData.documentType = documentType;
    }

    // Handle file replacement if a new file is uploaded
    if (req.file) {
      console.log(`📝 Replacing file for document ${documentId}: ${req.file.originalname} (${req.file.size} bytes)`);
      
      // Validate the new file
      const validation = await databaseDocumentStorage.validateFile(
        req.file.originalname,
        req.file.mimetype,
        req.file.size
      );

      if (!validation.valid) {
        return res.status(400).json({ error: validation.reason });
      }

      // Add file data to update
      updateData.fileData = req.file.buffer.toString('base64');
      updateData.fileType = req.file.mimetype;
      updateData.fileSize = req.file.size;
      updateData.filePath = null; // Clear old filesystem path since we're using database storage
      
      // Use the new filename if not provided separately
      if (!updateData.fileName) {
        updateData.fileName = DOMPurify.sanitize(req.file.originalname);
      }
    }

    const updatedDocument = await databaseDocumentStorage.updateDocument(documentId, updateData);

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    console.log(`✓ Document ${documentId} updated successfully`);
    res.json({
      id: updatedDocument.id,
      fileName: updatedDocument.fileName,
      fileType: updatedDocument.fileType,
      fileSize: updatedDocument.fileSize,
      documentType: updatedDocument.documentType,
      description: updatedDocument.description,
      uploadedAt: updatedDocument.uploadedAt,
      message: 'Document updated successfully'
    });

  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Internal server error during update' });
  }
};

// Update document metadata (PATCH)
router.patch('/:id', requireAuth, upload.single('file'), updateDocumentHandler);

// Update document metadata (PUT) - same functionality as PATCH
router.put('/:id', requireAuth, upload.single('file'), updateDocumentHandler);

// Delete document
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const result = await databaseDocumentStorage.deleteDocument(documentId);

    if (!result.success) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document deleted successfully' });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Internal server error during deletion' });
  }
});

export default router;