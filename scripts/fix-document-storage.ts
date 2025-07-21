#!/usr/bin/env tsx

/**
 * Fix Document Storage Migration
 * 
 * This script migrates documents that were incorrectly stored in the filesystem
 * to proper database storage, ensuring all existing documents can be viewed properly.
 */

import { db } from '../server/db.js';
import { documents } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔧 Starting document storage migration...');
  
  try {
    // Find all documents that have fileData as NULL (empty)
    const problemDocuments = await db
      .select()
      .from(documents);
    
    console.log(`📋 Found ${problemDocuments.length} documents to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const doc of problemDocuments) {
      try {
        console.log(`📄 Processing document ${doc.id}: ${doc.fileName}`);
        
        // Check if file exists at the stored path and if we need to migrate
        if (doc.filePath && !doc.fileData) {
          try {
            const fileExists = await fs.access(doc.filePath).then(() => true).catch(() => false);
            
            if (fileExists) {
              console.log(`📁 Reading file from: ${doc.filePath}`);
              const fileBuffer = await fs.readFile(doc.filePath);
              const fileDataBase64 = fileBuffer.toString('base64');
              
              // Update document with base64 data
              await db
                .update(documents)
                .set({
                  fileData: fileDataBase64,
                  filePath: `database://${doc.dealId}/${doc.fileName}` // Virtual path
                })
                .where(eq(documents.id, doc.id));
              
              console.log(`✅ Migrated document ${doc.id} to database storage`);
              migratedCount++;
              
              // Optionally delete the original file after successful migration
              // await fs.unlink(doc.filePath);
              // console.log(`🧹 Cleaned up original file: ${doc.filePath}`);
              
            } else {
              console.log(`❌ File not found at path: ${doc.filePath}`);
              errorCount++;
            }
          } catch (fileError) {
            console.error(`❌ Error processing file ${doc.filePath}:`, fileError);
            errorCount++;
          }
        } else {
          console.log(`❌ Document ${doc.id} has no filePath - cannot migrate`);
          errorCount++;
        }
      } catch (docError) {
        console.error(`❌ Error processing document ${doc.id}:`, docError);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount} documents`);
    console.log(`❌ Errors: ${errorCount} documents`);
    console.log(`📋 Total processed: ${problemDocuments.length} documents`);
    
    if (migratedCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('All migrated documents should now be viewable in the PDF viewer.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);