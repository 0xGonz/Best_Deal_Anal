import { Router } from 'express';
import multer from 'multer';
import { UnifiedDocumentStorage } from '../services/unified-document-storage.js';
import { requireAuth } from '../utils/auth.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();
const documentStorage = new UnifiedDocumentStorage();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { dealId, documentType = 'other', description } = req.body;
    
    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID is required' });
    }

    // Validate file
    const validation = await documentStorage.validateFile(req.file.originalname, req.file.mimetype, req.file.size);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    // Additional size check (already covered in validateFile but keeping for clarity)
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    // Create deal-specific directory
    const dealDir = `storage/documents/deal-${dealId}`;
    await documentStorage.ensureDirectoryExists(dealDir);

    // Generate unique filename to prevent conflicts
    const timestamp = Date.now();
    const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}-${sanitizedName}`;
    const filePath = `${dealDir}/${uniqueFileName}`;

    // Save file to disk
    await fs.writeFile(filePath, req.file.buffer);

    // Use unified document storage to create document record
    const document = await documentStorage.createDocument({
      dealId: parseInt(dealId),
      fileName: req.file.originalname, // Keep original name for display
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      documentType,
      filePath: `storage/documents/deal-${dealId}/${uniqueFileName}`,
      uploadedBy: 1, // TODO: Get from authenticated user session
      description: description || null
    });

    res.json({
      success: true,
      id: document.id,
      documentId: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      documentType: document.documentType,
      description: document.description,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/documents/deal/:dealId - Get documents for a deal
router.get('/deal/:dealId', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    const documents = await documentStorage.getDocumentsByDeal(dealId);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/documents/:documentId/download - Download a document
router.get('/:documentId/download', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    console.log(`📥 Download request for document ID: ${documentId}`);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const result = await documentStorage.downloadDocument(documentId);
    console.log(`📥 Download result:`, result ? 'Found' : 'Not found');
    
    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    res.send(result.buffer);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// PUT /api/documents/:documentId - Update document metadata
router.put('/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const { fileName, description, documentType } = req.body;

    const updatedDocument = await documentStorage.updateDocument(documentId, {
      fileName,
      description,
      documentType
    });

    res.json({
      success: true,
      document: updatedDocument,
      message: 'Document updated successfully'
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:documentId - Delete a document
router.delete('/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const result = await documentStorage.deleteDocument(documentId);

    res.json({
      success: true,
      message: 'Document deleted successfully',
      deletedDocument: result.deletedDocument
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;