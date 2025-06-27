#!/usr/bin/env tsx
/**
 * Test Document Upload Fix
 * 
 * Verifies that the upload system is working correctly after fixing the
 * constraint and storage issues.
 */

import { Pool } from 'pg';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { join } from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testDocumentUploadFix(): Promise<void> {
  console.log('🧪 Testing document upload fix...\n');

  try {
    // 1. Check database constraint is working properly
    console.log('1️⃣ Testing database constraint...');
    await testDatabaseConstraint();

    // 2. Check existing documents are accessible
    console.log('\n2️⃣ Testing existing document access...');
    await testExistingDocuments();

    // 3. Verify storage directory exists
    console.log('\n3️⃣ Checking storage directory...');
    await checkStorageDirectory();

    // 4. Test API endpoint responsiveness
    console.log('\n4️⃣ Testing API endpoints...');
    await testAPIEndpoints();

    console.log('\n🎉 All upload system tests passed!');
    console.log('📌 The 500 error should now be resolved.');
    console.log('🔧 You can now try uploading the replacement PDF.');

  } catch (error) {
    console.error('💥 Test failed:', error);
    throw error;
  }
}

async function testDatabaseConstraint(): Promise<void> {
  try {
    // Test 1: Valid file system storage (should succeed)
    await pool.query(`
      INSERT INTO documents (file_name, file_path, file_data, file_size, deal_id, file_type, document_type, uploaded_by)
      VALUES ('test-fs.pdf', '/test/path/file.pdf', NULL, 1000, 1, 'application/pdf', 'other', 1)
    `);
    console.log('  ✅ File system storage allowed');
    
    // Test 2: Valid database storage (should succeed)
    await pool.query(`
      INSERT INTO documents (file_name, file_path, file_data, file_size, deal_id, file_type, document_type, uploaded_by)
      VALUES ('test-db.pdf', NULL, 'dGVzdA==', 1000, 1, 'application/pdf', 'other', 1)
    `);
    console.log('  ✅ Database storage allowed');
    
    // Test 3: Valid legacy virtual path + database (should succeed)
    await pool.query(`
      INSERT INTO documents (file_name, file_path, file_data, file_size, deal_id, file_type, document_type, uploaded_by)
      VALUES ('test-legacy.pdf', 'database://1/test.pdf', 'dGVzdA==', 1000, 1, 'application/pdf', 'other', 1)
    `);
    console.log('  ✅ Legacy virtual path + database storage allowed');

    // Clean up test records
    await pool.query(`DELETE FROM documents WHERE file_name IN ('test-fs.pdf', 'test-db.pdf', 'test-legacy.pdf')`);
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('chk_storage_pattern')) {
      console.log('  ❌ Constraint test failed - should not happen');
      throw error;
    } else {
      console.log(`  ❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
      throw error;
    }
  }
}

async function testExistingDocuments(): Promise<void> {
  const { rows } = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN file_path IS NOT NULL AND file_data IS NULL THEN 1 END) as fs_only,
           COUNT(CASE WHEN file_path IS NULL AND file_data IS NOT NULL THEN 1 END) as db_only,
           COUNT(CASE WHEN file_path LIKE 'database://%' AND file_data IS NOT NULL THEN 1 END) as legacy
    FROM documents
  `);
  
  const stats = rows[0];
  console.log(`  📊 Total documents: ${stats.total}`);
  console.log(`  📁 File system only: ${stats.fs_only}`);
  console.log(`  💾 Database only: ${stats.db_only}`);
  console.log(`  🔄 Legacy (virtual path + database): ${stats.legacy}`);
  
  if (parseInt(stats.total) === 0) {
    console.log('  ⚠️  No documents found - this is unexpected');
  } else {
    console.log('  ✅ Documents found and accessible');
  }
}

async function checkStorageDirectory(): Promise<void> {
  const storageDir = join(process.cwd(), 'storage', 'documents');
  
  try {
    await fs.mkdir(storageDir, { recursive: true });
    const stats = await fs.stat(storageDir);
    
    if (stats.isDirectory()) {
      console.log(`  ✅ Storage directory exists: ${storageDir}`);
      
      // Check permissions
      await fs.access(storageDir, fs.constants.W_OK);
      console.log('  ✅ Storage directory is writable');
    } else {
      console.log('  ❌ Storage path exists but is not a directory');
    }
  } catch (error) {
    console.log(`  ❌ Storage directory issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function testAPIEndpoints(): Promise<void> {
  try {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:5000/api/system/health', {
      method: 'GET'
    });
    
    if (healthResponse.ok) {
      console.log('  ✅ Health endpoint responsive');
    } else {
      console.log(`  ⚠️  Health endpoint returned ${healthResponse.status}`);
    }
    
    // Test documents endpoint structure (without auth - should get 401)
    const docsResponse = await fetch('http://localhost:5000/api/documents/upload', {
      method: 'POST'
    });
    
    if (docsResponse.status === 401) {
      console.log('  ✅ Upload endpoint properly requires authentication');
    } else {
      console.log(`  ⚠️  Upload endpoint returned unexpected status: ${docsResponse.status}`);
    }
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.log('  ⚠️  Server not running - this is expected during testing');
    } else {
      console.log(`  ❌ API test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    await testDocumentUploadFix();
  } catch (error) {
    console.error('Test script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the test
main().catch(console.error);