import express from 'express';
import multer from 'multer';

const router = express.Router();

// Simple test upload with minimal configuration
const simpleUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'temp/uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Test upload endpoint with minimal middleware
router.post('/test-upload', (req, res, next) => {
  console.log('🧪 Test upload hit!');
  console.log('🧪 Headers:', req.headers);
  console.log('🧪 URL:', req.url);
  console.log('🧪 Method:', req.method);
  simpleUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('🧪 Test upload multer error:', err);
      return res.status(500).json({ error: 'Multer error', details: err.message });
    }
    next();
  });
}, (req, res) => {
  try {
    console.log('Test upload - File:', req.file);
    console.log('Test upload - Body:', req.body);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({
      success: true,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });
  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;