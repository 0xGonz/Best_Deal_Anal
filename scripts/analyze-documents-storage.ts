#!/usr/bin/env tsx

/**
 * Document Storage Analysis and Fix Script
 * 
 * This script analyzes the documents table to identify:
 * 1. Total size of file_data stored in the database
 * 2. Documents with large file_data that could be moved to filesystem
 * 3. Provides options to optimize storage
 */

import { db } from '../server/db.js';
import { documents } from '../shared/schema.js';
import { eq, sql, isNotNull, desc } from 'drizzle-orm';

async function formatBytes(bytes: number): Promise<string> {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

async function analyzeDocumentStorage() {
  console.log('🔍 Analyzing Document Storage...\n');
  
  try {
    // Get total count of documents
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents);
    
    console.log(`📊 Total documents in database: ${count}`);
    
    // Get documents with file_data
    const documentsWithData = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        dealId: documents.dealId,
        uploadedAt: documents.uploadedAt,
        dataLength: sql<number>`length(file_data)`,
      })
      .from(documents)
      .where(isNotNull(documents.fileData))
      .orderBy(desc(sql`length(file_data)`));
    
    console.log(`📁 Documents with file_data stored: ${documentsWithData.length}`);
    
    if (documentsWithData.length > 0) {
      // Calculate total size
      let totalDataSize = 0;
      const largeDocuments = [];
      
      console.log('\n📈 Top 10 Largest Documents:');
      console.log('═══════════════════════════════════════════════════════════════════');
      
      for (let i = 0; i < Math.min(10, documentsWithData.length); i++) {
        const doc = documentsWithData[i];
        totalDataSize += doc.dataLength || 0;
        
        // Base64 encoding increases size by ~33%, so estimate actual file size
        const estimatedFileSize = (doc.dataLength || 0) * 0.75;
        
        console.log(`${i + 1}. ID: ${doc.id} | ${doc.fileName}`);
        console.log(`   Deal ID: ${doc.dealId} | Uploaded: ${doc.uploadedAt}`);
        console.log(`   Base64 Size: ${await formatBytes(doc.dataLength || 0)} | Est. File Size: ${await formatBytes(estimatedFileSize)}`);
        console.log('─────────────────────────────────────────────────────────────────');
        
        if (estimatedFileSize > 5 * 1024 * 1024) { // > 5MB
          largeDocuments.push(doc);
        }
      }
      
      // Calculate total for all documents
      let allDocsTotal = 0;
      for (const doc of documentsWithData) {
        allDocsTotal += doc.dataLength || 0;
      }
      
      console.log(`\n💾 Total Storage Analysis:`);
      console.log(`   Total base64 data stored: ${await formatBytes(allDocsTotal)}`);
      console.log(`   Estimated actual file size: ${await formatBytes(allDocsTotal * 0.75)}`);
      console.log(`   Documents larger than 5MB: ${largeDocuments.length}`);
      
      // Check for documents without file_data (filesystem storage)
      const [{ fsCount }] = await db
        .select({ fsCount: sql<number>`count(*)` })
        .from(documents)
        .where(sql`file_data IS NULL OR length(file_data) = 0`);
      
      console.log(`\n📂 Documents using filesystem storage: ${fsCount}`);
      
      // Provide recommendations
      console.log('\n💡 Recommendations:');
      if (allDocsTotal > 100 * 1024 * 1024) { // > 100MB
        console.log('   ⚠️  Your database contains over 100MB of file data!');
        console.log('   Consider moving large files to filesystem storage.');
      }
      if (largeDocuments.length > 0) {
        console.log(`   ⚠️  You have ${largeDocuments.length} documents larger than 5MB.`);
        console.log('   These should ideally be stored in the filesystem.');
      }
      
      // SQL query to check without file_data
      console.log('\n📝 To query documents without file_data, use this SQL:');
      console.log(`
SELECT 
  id, deal_id, file_name, file_type, file_size, 
  file_path, uploaded_by, uploaded_at, description, 
  document_type, metadata, version
FROM documents
ORDER BY id
LIMIT 50;
`);
      
    } else {
      console.log('✅ No documents with file_data found in database.');
      console.log('All documents are using filesystem storage.');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing document storage:', error);
    process.exit(1);
  }
}

// Run the analysis
analyzeDocumentStorage().catch(console.error);