import express from 'express';
import multer from 'multer';
import { StorageFactory } from '../storage-factory';
import { requireAuth } from '../utils/auth';

const router = express.Router();

// Simple in-memory upload with larger limits for PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for PDFs
  }
});

// Simple upload endpoint that works reliably
router.post('/simple-upload', requireAuth, upload.single('file'), async (req, res) => {
  console.log('🚀 Simple upload endpoint hit');
  
  try {
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { dealId, documentType = 'other', description = '' } = req.body;
    
    if (!dealId) {
      console.log('❌ No dealId provided');
      return res.status(400).json({ error: 'Deal ID is required' });
    }

    const userId = req.session.userId!;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const fileData = req.file.buffer;
    const fileSize = fileData.length;

    console.log(`📤 Processing: ${fileName} (${fileSize} bytes) for deal ${dealId}`);

    // Get storage and validate deal exists
    const storage = StorageFactory.getStorage();
    
    // Validate that the deal exists before attempting upload
    const dealExists = await storage.getDeal(parseInt(dealId));
    if (!dealExists) {
      console.log(`❌ Deal ${dealId} does not exist`);
      return res.status(400).json({ error: `Deal with ID ${dealId} not found. Please select a valid deal.` });
    }
    
    const documentData = {
      dealId: parseInt(dealId),
      fileName,
      fileType,
      fileSize,
      filePath: '', // Empty since we're using in-memory storage
      uploadedBy: userId,
      documentType,
      description: description || 'Document upload',
      fileData: fileData.toString('base64')
    };

    const document = await storage.createDocument(documentData);
    
    console.log(`✅ Document created with ID: ${document.id}`);
    
    res.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt
      }
    });
    
  } catch (error) {
    console.error('💥 Simple upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;