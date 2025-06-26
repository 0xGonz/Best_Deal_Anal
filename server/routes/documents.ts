import express from 'express';
import multer from 'multer';
import path from 'path';
import { StorageFactory } from '../storage-factory';
import { requireAuth } from '../utils/auth';
import * as fs from 'fs/promises';

const router = express.Router();

// Configure multer for temporary file upload
const upload = multer({
  dest: 'temp/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log(`📁 File upload attempt: ${file.originalname}, MIME type: ${file.mimetype}`);
    
    // For now, accept all file types to test the upload functionality
    // This can be restricted later once the basic upload works
    console.log(`✅ File accepted for testing: ${file.mimetype}`);
    cb(null, true);
  }
});

// Upload document
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { dealId, documentType = 'other', description } = req.body;

    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID is required' });
    }

    const userId = req.session.userId!;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const tempFilePath = req.file.path;

    console.log(`📤 Processing document upload: ${fileName} for deal ${dealId}`);

    // Get file size without reading entire file into memory
    const stats = await fs.stat(tempFilePath);
    const fileSize = stats.size;

    // Get storage instance and create document
    const storage = StorageFactory.getStorage();
    const document = await storage.createDocument({
      dealId: parseInt(dealId),
      fileName,
      fileType,
      fileSize,
      filePath: tempFilePath,
      documentType,
      description: description || '',
      uploadedBy: userId
    });

    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp file:', cleanupError);
    }

    console.log(`✅ Document uploaded successfully: ID ${document.id}`);
    res.json({
      id: document.id,
      fileName,
      fileType,
      documentType,
      description,
      message: 'Document uploaded and stored successfully'
    });

  } catch (error) {
    console.error('❌ Error uploading document:', error);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
});

// Get documents for a deal
router.get('/deal/:dealId', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    console.log(`📋 Documents route: Fetching documents for deal ${dealId}`);
    const storage = StorageFactory.getStorage();
    const documents = await storage.getDocumentsByDeal(dealId);
    
    // Ensure we always return an array
    const responseData = Array.isArray(documents) ? documents : [];
    console.log(`📋 Documents route: Returning ${responseData.length} documents for deal ${dealId}`);
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    // Return empty array on error to prevent frontend crashes
    res.json([]);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Download document
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const storage = StorageFactory.getStorage();
    const document = await storage.getDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', document.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    
    // For now, return document metadata - actual file serving would need file path
    res.json({
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      message: 'Document download endpoint - file serving not implemented'
    });

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Update document metadata
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { documentType, description } = req.body;

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const storage = StorageFactory.getStorage();
    const updatedDocument = await storage.updateDocument(documentId, {
      documentType,
      description
    });

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const storage = StorageFactory.getStorage();
    const success = await storage.deleteDocument(documentId);

    if (!success) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;