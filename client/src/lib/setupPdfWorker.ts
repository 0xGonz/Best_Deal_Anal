import { pdfjs } from 'react-pdf';

/**
 * PDF.js Worker Configuration
 * 
 * This configures PDF.js to use a static worker file served from /public,
 * ensuring correct MIME type and proper file serving in production.
 * The worker file is copied from node_modules during setup.
 */

// Use static worker file from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Export simple status function for debugging
export function getWorkerStatus() {
  return {
    workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
    version: '4.8.69',
    isConfigured: true,
    usingStaticWorker: true
  };
}
