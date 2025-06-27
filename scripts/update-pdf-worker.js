#!/usr/bin/env node

/**
 * Updates the PDF worker file to match the installed pdfjs-dist version
 * This ensures version consistency between the library and worker
 */

const fs = require('fs');
const path = require('path');

function updatePdfWorker() {
  try {
    const workerSource = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
    const workerDestination = path.join(__dirname, '../public/pdf.worker.min.js');
    
    if (!fs.existsSync(workerSource)) {
      console.error('❌ PDF worker source file not found:', workerSource);
      process.exit(1);
    }
    
    // Copy the worker file
    fs.copyFileSync(workerSource, workerDestination);
    console.log('✅ PDF worker updated successfully');
    console.log(`   Source: ${workerSource}`);
    console.log(`   Destination: ${workerDestination}`);
    
    // Verify the file was copied
    if (fs.existsSync(workerDestination)) {
      const stats = fs.statSync(workerDestination);
      console.log(`   File size: ${Math.round(stats.size / 1024)}KB`);
    }
    
  } catch (error) {
    console.error('❌ Error updating PDF worker:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  updatePdfWorker();
}

module.exports = updatePdfWorker;