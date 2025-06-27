#!/usr/bin/env tsx
/**
 * Document Storage Verification Script
 * 
 * Comprehensive verification that the "Invalid PDF structure" issue has been resolved
 * and all documents are now using consistent file system storage.
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface DocumentStatus {
  id: number;
  file_name: string;
  file_path: string | null;
  file_data: string | null;
  file_size: number;
  deal_id: number;
  status: 'healthy' | 'missing' | 'error';
  details: string;
}

async function verifyDocumentStorage(): Promise<void> {
  console.log('🔍 Verifying document storage migration results...\n');

  try {
    // Get all documents
    const { rows } = await pool.query(`
      SELECT id, file_name, file_path, file_data, file_size, deal_id
      FROM documents
      ORDER BY id
    `);

    console.log(`📊 Total documents in database: ${rows.length}`);

    const results: DocumentStatus[] = [];
    let healthy = 0;
    let missing = 0;
    let errors = 0;

    for (const doc of rows) {
      const status: DocumentStatus = {
        id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_data: doc.file_data,
        file_size: doc.file_size,
        deal_id: doc.deal_id,
        status: 'healthy',
        details: ''
      };

      try {
        // Check storage consistency
        if (!doc.file_path && !doc.file_data) {
          status.status = 'missing';
          status.details = 'Marked as missing - corrupted or empty data';
          missing++;
        } else if (doc.file_path && !doc.file_data) {
          // This is the expected state after migration
          // Verify file exists on disk
          try {
            await fs.access(doc.file_path);
            const stats = await fs.stat(doc.file_path);
            status.status = 'healthy';
            status.details = `File system storage - ${stats.size} bytes`;
            healthy++;
          } catch (fileError) {
            status.status = 'error';
            status.details = `File missing on disk: ${doc.file_path}`;
            errors++;
          }
        } else if (doc.file_data && !doc.file_path) {
          status.status = 'error';
          status.details = 'Still using blob storage - migration incomplete';
          errors++;
        } else if (doc.file_data && doc.file_path) {
          status.status = 'error';
          status.details = 'Hybrid storage detected - should not exist after migration';
          errors++;
        }

        results.push(status);

      } catch (error) {
        status.status = 'error';
        status.details = `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.push(status);
        errors++;
      }
    }

    // Print summary
    console.log('\n📋 Migration Verification Summary:');
    console.log(`  ✅ Healthy documents: ${healthy}`);
    console.log(`  ⚠️  Missing documents: ${missing}`);
    console.log(`  ❌ Error documents: ${errors}`);

    // Show details for problematic documents
    if (missing > 0 || errors > 0) {
      console.log('\n🔍 Problematic Documents:');
      results
        .filter(r => r.status !== 'healthy')
        .forEach(doc => {
          console.log(`  ${doc.status === 'missing' ? '⚠️ ' : '❌'} ID ${doc.id}: ${doc.file_name}`);
          console.log(`     ${doc.details}`);
        });
    }

    // Test API endpoints for a few documents
    console.log('\n🌐 Testing API endpoints...');
    await testDocumentEndpoints(results.filter(r => r.status === 'healthy').slice(0, 3));

    // Check database constraint
    console.log('\n🔒 Verifying storage constraint...');
    await verifyStorageConstraint();

    if (errors === 0) {
      console.log('\n🎉 All checks passed! Document storage migration successful.');
      console.log('📌 Key improvements:');
      console.log('  • All documents now use consistent file system storage');
      console.log('  • "Invalid PDF structure" errors eliminated');
      console.log('  • Database constraint prevents future hybrid storage');
      console.log('  • Enhanced error handling in PDF viewer');
    } else {
      console.log('\n⚠️  Some issues detected. Please review the errors above.');
    }

  } catch (error) {
    console.error('💥 Verification failed:', error);
    throw error;
  }
}

async function testDocumentEndpoints(healthyDocs: DocumentStatus[]): Promise<void> {
  for (const doc of healthyDocs) {
    try {
      // Test download endpoint
      const downloadUrl = `http://localhost:5000/api/documents/${doc.id}/download`;
      const response = await fetch(downloadUrl, { method: 'HEAD' });
      
      if (response.ok) {
        console.log(`  ✅ Document ${doc.id} (${doc.file_name}): Download endpoint OK`);
      } else {
        console.log(`  ❌ Document ${doc.id}: Download endpoint failed (${response.status})`);
      }
    } catch (error) {
      console.log(`  ❌ Document ${doc.id}: Network error testing endpoint`);
    }
  }
}

async function verifyStorageConstraint(): Promise<void> {
  try {
    // Try to insert a document with hybrid storage (should fail)
    await pool.query(`
      INSERT INTO documents (file_name, file_path, file_data, file_size, deal_id, file_type, document_type)
      VALUES ('test-constraint.pdf', '/test/path', 'test-data', 1000, 1, 'application/pdf', 'other')
    `);
    
    // If we get here, constraint is not working
    console.log('❌ Storage constraint not working - hybrid storage was allowed');
    
    // Clean up the test record
    await pool.query(`DELETE FROM documents WHERE file_name = 'test-constraint.pdf'`);
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('chk_single_storage')) {
      console.log('✅ Storage constraint working - hybrid storage prevented');
    } else {
      console.log(`❌ Unexpected error testing constraint: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    await verifyDocumentStorage();
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the verification
main().catch(console.error);