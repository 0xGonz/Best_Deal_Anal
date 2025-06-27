#!/usr/bin/env tsx
/**
 * Migrate Old Document Blobs to File System
 * 
 * This script addresses the hybrid storage issue where documents have both
 * file_data (base64 blob) and file_path. It moves all blob data to disk
 * and cleans up the database for consistent storage.
 * 
 * Based on analysis: Newly-uploaded PDFs work (file_path only)
 * but older PDFs fail due to truncated/empty blobs in hybrid storage.
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface DocumentRow {
  id: number;
  file_name: string;
  file_data: string;
  file_path: string | null;
  file_size: number;
}

interface MigrationStats {
  totalDocuments: number;
  migrated: number;
  alreadyMigrated: number;
  failed: number;
  emptyBlobs: number;
  truncatedBlobs: number;
}

async function migrateBlobsToFileSystem(): Promise<void> {
  console.log('🔄 Starting document blob migration...');
  
  const stats: MigrationStats = {
    totalDocuments: 0,
    migrated: 0,
    alreadyMigrated: 0,
    failed: 0,
    emptyBlobs: 0,
    truncatedBlobs: 0,
  };

  try {
    // Get all documents that have blob data
    const { rows } = await pool.query<DocumentRow>(`
      SELECT id, file_name, file_data, file_path, file_size
      FROM documents
      WHERE file_data IS NOT NULL
      ORDER BY id
    `);

    stats.totalDocuments = rows.length;
    console.log(`📊 Found ${rows.length} documents with blob data`);

    // Create migration directory
    const migrationDir = 'storage/documents/legacy';
    await fs.mkdir(migrationDir, { recursive: true });

    for (const row of rows) {
      try {
        console.log(`\n📄 Processing document ${row.id}: ${row.file_name}`);

        // Check if already has file_path and blob looks good
        if (row.file_path && row.file_data) {
          const blobSize = row.file_data.length;
          console.log(`  📏 Blob size: ${blobSize} characters`);

          // Check if blob is empty or suspiciously small
          if (blobSize === 0) {
            console.log(`  ⚠️  Empty blob detected - marking as missing`);
            await markDocumentAsMissing(row.id, 'Empty blob data');
            stats.emptyBlobs++;
            continue;
          }

          if (blobSize < 1000 && row.file_name.toLowerCase().endsWith('.pdf')) {
            console.log(`  ⚠️  Suspiciously small PDF blob (${blobSize} chars) - likely truncated`);
            await markDocumentAsMissing(row.id, 'Truncated blob data');
            stats.truncatedBlobs++;
            continue;
          }

          // Try to validate the blob starts with PDF header
          try {
            const buffer = Buffer.from(row.file_data, 'base64');
            const header = buffer.subarray(0, 5).toString();
            
            if (row.file_name.toLowerCase().endsWith('.pdf') && !header.startsWith('%PDF-')) {
              console.log(`  ❌ Invalid PDF header: "${header}" - blob corrupted`);
              await markDocumentAsMissing(row.id, 'Invalid PDF header');
              stats.truncatedBlobs++;
              continue;
            }
          } catch (err) {
            console.log(`  ❌ Failed to decode base64 blob - corrupted data`);
            await markDocumentAsMissing(row.id, 'Corrupted base64 data');
            stats.failed++;
            continue;
          }
        }

        // Generate clean file path for migration
        const sanitizedFileName = row.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const diskPath = path.join(migrationDir, `${row.id}_${sanitizedFileName}`);
        const relativePath = `storage/documents/legacy/${row.id}_${sanitizedFileName}`;

        // Write blob to disk
        console.log(`  💾 Writing to: ${diskPath}`);
        const buffer = Buffer.from(row.file_data, 'base64');
        await fs.writeFile(diskPath, buffer);

        // Verify file was written correctly
        const stats_file = await fs.stat(diskPath);
        console.log(`  ✅ File written: ${stats_file.size} bytes`);

        // Update database to use file_path and clear file_data
        await pool.query(
          `UPDATE documents 
           SET file_path = $1, 
               file_data = NULL,
               file_size = $2
           WHERE id = $3`,
          [relativePath, stats_file.size, row.id]
        );

        console.log(`  🗃️  Database updated - blob cleared, file_path set`);
        stats.migrated++;

      } catch (err) {
        console.error(`  ❌ Failed to migrate document ${row.id}:`, err);
        stats.failed++;
      }
    }

    // Generate final report
    console.log('\n📋 Migration Summary:');
    console.log(`  Total documents processed: ${stats.totalDocuments}`);
    console.log(`  Successfully migrated: ${stats.migrated}`);
    console.log(`  Already migrated: ${stats.alreadyMigrated}`);
    console.log(`  Empty blobs found: ${stats.emptyBlobs}`);
    console.log(`  Truncated blobs found: ${stats.truncatedBlobs}`);
    console.log(`  Failed migrations: ${stats.failed}`);

    if (stats.migrated > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('📌 Next steps:');
      console.log('  1. Test document viewing to ensure all PDFs load correctly');
      console.log('  2. Consider adding database constraint to prevent future hybrid storage');
      console.log('  3. Monitor for any remaining "Invalid PDF structure" errors');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

async function markDocumentAsMissing(documentId: number, reason: string): Promise<void> {
  await pool.query(
    `UPDATE documents 
     SET file_data = NULL,
         file_path = NULL
     WHERE id = $1`,
    [documentId]
  );
  console.log(`  🏷️  Marked document ${documentId} as missing: ${reason}`);
}

async function addStorageConstraint(): Promise<void> {
  try {
    console.log('\n🔒 Adding storage constraint to prevent future hybrid storage...');
    
    await pool.query(`
      ALTER TABLE documents
      ADD CONSTRAINT chk_single_storage
      CHECK ( 
        (file_path IS NOT NULL AND file_data IS NULL) OR
        (file_path IS NULL AND file_data IS NULL)
      );
    `);
    
    console.log('✅ Constraint added - future documents must use file_path only');
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      console.log('ℹ️  Storage constraint already exists');
    } else {
      console.error('❌ Failed to add storage constraint:', err);
    }
  }
}

async function main(): Promise<void> {
  try {
    await migrateBlobsToFileSystem();
    await addStorageConstraint();
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
main().catch(console.error);

export { migrateBlobsToFileSystem };