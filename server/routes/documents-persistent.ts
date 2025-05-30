import express from 'express';
import multer from 'multer';
import path from 'path';
import { DocumentBlobStorage } from '../services/document-blob-storage.js';
import { requireAuth } from '../utils/auth';

const router = express.Router();

// Configure multer for temporary file upload
const upload = multer({
  dest: 'temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, CSV, and images are allowed.'), false);
    }
  }
});

// Upload document with persistent storage
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { dealId, documentType = 'other', description } = req.body;

    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID is required' });
    }

    const userId = req.session.userId;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const tempFilePath = req.file.path;

    console.log(`Processing document upload: ${fileName} for deal ${dealId}`);

    // Store document in database
    const result = await DocumentBlobStorage.storeDocument(
      parseInt(dealId),
      fileName,
      fileType,
      tempFilePath,
      userId,
      documentType,
      description
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to store document' });
    }

    console.log(`✓ Document uploaded successfully: ID ${result.id}`);
    res.json({
      id: result.id,
      fileName,
      fileType,
      documentType,
      description,
      message: 'Document uploaded and stored in database successfully'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
});

// Download document from database
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const result = await DocumentBlobStorage.retrieveDocument(documentId);

    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Document not found' });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', result.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Content-Length', result.fileSize?.toString() || '0');

    // Send the file data
    res.send(result.data);

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Internal server error during download' });
  }
});

// View document in browser (for PDFs)
router.get('/:id/view', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const result = await DocumentBlobStorage.retrieveDocument(documentId);

    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Document not found' });
    }

    // Set appropriate headers for inline viewing
    res.setHeader('Content-Type', result.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    res.setHeader('Content-Length', result.fileSize?.toString() || '0');

    // Send the file data
    res.send(result.data);

  } catch (error) {
    console.error('Error viewing document:', error);
    res.status(500).json({ error: 'Internal server error during view' });
  }
});

// Get documents for a deal
router.get('/deal/:dealId', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    const result = await DocumentBlobStorage.getDocumentsForDeal(dealId);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to retrieve documents' });
    }

    res.json(result.documents || []);

  } catch (error) {
    console.error('Error getting documents for deal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete document
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const result = await DocumentBlobStorage.deleteDocument(documentId);

    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Document not found' });
    }

    res.json({ message: 'Document deleted successfully' });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Internal server error during deletion' });
  }
});

// Migrate existing filesystem documents to database
router.post('/migrate', requireAuth, async (req, res) => {
  try {
    // Only allow admin users to run migration
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for migration' });
    }

    console.log('Starting document migration from filesystem to database...');
    const result = await DocumentBlobStorage.migrateFilesystemDocuments();

    res.json({
      success: result.success,
      migratedCount: result.migratedCount,
      errors: result.errors,
      message: `Migration completed. ${result.migratedCount} documents migrated, ${result.errors.length} errors.`
    });

  } catch (error) {
    console.error('Error during migration:', error);
    res.status(500).json({ error: 'Internal server error during migration' });
  }
});

export default router;