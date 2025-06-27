import { pdfjs } from 'react-pdf';

/**
 * PDF.js Worker Configuration
 * 
 * This configures PDF.js to use the correct worker version that matches
 * the installed pdfjs-dist package, eliminating version mismatch errors.
 */

// Point to the worker that lives inside node_modules/pdfjs-dist
// This ensures the worker version always matches the library version
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

console.log('✅ PDF.js worker configured with matching version:', pdfjs.GlobalWorkerOptions.workerSrc);

// Export simple status function for debugging
export function getWorkerStatus() {
  return {
    workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
    version: '4.8.69',
    isConfigured: true,
    usingNodeModulesWorker: true
  };
}
