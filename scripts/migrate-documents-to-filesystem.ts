#!/usr/bin/env tsx

/**
 * Migrate Documents from Database to Filesystem Storage
 * 
 * This script moves file data from the database to the filesystem
 * to reduce database size and improve performance.
 */

import { db } from '../server/db.js';
import { documents } from '../shared/schema.js';
import { eq, isNotNull, desc, sql } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

const STORAGE_PATH = process.env.UPLOAD_PATH || './uploads';

async function ensureDirectoryExists(filePath: string) {
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function formatBytes(bytes: number): Promise<string> {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

async function migrateDocumentsToFilesystem() {
  console.log('🚀 Starting migration from database to filesystem storage...\n');
  
  try {
    // Get documents with file_data, ordered by size (largest first)
    const documentsToMigrate = await db
      .select({
        id: documents.id,
        dealId: documents.dealId,
        fileName: documents.fileName,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        fileData: documents.fileData,
        dataLength: sql<number>`length(file_data)`,
      })
      .from(documents)
      .where(isNotNull(documents.fileData))
      .orderBy(desc(sql`length(file_data)`));
    
    console.log(`📋 Found ${documentsToMigrate.length} documents to migrate\n`);
    
    if (documentsToMigrate.length === 0) {
      console.log('✅ No documents need migration. All documents are already using filesystem storage.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let totalBytesMigrated = 0;
    
    // Process each document
    for (const doc of documentsToMigrate) {
      try {
        console.log(`\n📄 Processing document ${doc.id}: ${doc.fileName}`);
        console.log(`   Size: ${await formatBytes(doc.dataLength || 0)}`);
        
        if (!doc.fileData) {
          console.log('   ⚠️  Skipping - no file data found');
          continue;
        }
        
        // Decode base64 data
        const fileBuffer = Buffer.from(doc.fileData, 'base64');
        
        // Create filesystem path
        const relativePath = join('deals', doc.dealId.toString(), doc.fileName);
        const absolutePath = join(STORAGE_PATH, relativePath);
        
        // Ensure directory exists
        await ensureDirectoryExists(absolutePath);
        
        // Write file to filesystem
        await fs.writeFile(absolutePath, fileBuffer);
        console.log(`   ✅ Written to: ${absolutePath}`);
        
        // Update database record - remove file_data and update file_path
        await db
          .update(documents)
          .set({
            fileData: null,
            filePath: absolutePath
          })
          .where(eq(documents.id, doc.id));
        
        console.log(`   ✅ Database updated - file_data cleared, file_path set`);
        
        successCount++;
        totalBytesMigrated += doc.dataLength || 0;
        
      } catch (error) {
        console.error(`   ❌ Error migrating document ${doc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount} documents`);
    console.log(`   ❌ Errors: ${errorCount} documents`);
    console.log(`   💾 Total data migrated: ${await formatBytes(totalBytesMigrated)}`);
    console.log(`   📁 Files stored in: ${STORAGE_PATH}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('   Your database is now smaller and queries will be faster.');
      console.log('   Documents are now served from the filesystem.');
      
      // Check new database size
      const remainingDocs = await db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(isNotNull(documents.fileData));
      
      if (remainingDocs[0].count === 0) {
        console.log('\n✨ All documents have been migrated to filesystem storage!');
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run with confirmation
console.log('⚠️  WARNING: This script will migrate document storage from database to filesystem.');
console.log('   Make sure you have enough disk space in the uploads directory.');
console.log('   This process is NOT reversible without a backup.\n');

const readline = await import('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to proceed? (yes/no): ', async (answer) => {
  if (answer.toLowerCase() === 'yes') {
    rl.close();
    await migrateDocumentsToFilesystem();
  } else {
    console.log('Migration cancelled.');
    rl.close();
    process.exit(0);
  }
});