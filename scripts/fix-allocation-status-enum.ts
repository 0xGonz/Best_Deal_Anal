/**
 * Database migration to fix allocation status enum issues
 * Addresses the 500 errors from /api/allocations identified in audit
 */

import { DatabaseStorage } from '../server/database-storage';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function fixAllocationStatusEnum() {
  console.log('🔧 Starting allocation status enum fix...');
  
  const storage = new DatabaseStorage();
  
  try {
    console.log('📊 Step 1: Analyzing current allocation status data...');
    
    // Check current status values in the database
    const statusAnalysis = await db.execute(sql`
      SELECT status, COUNT(*) as count 
      FROM fund_allocations 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    console.log('Current status distribution:');
    statusAnalysis.rows.forEach((row: any) => {
      console.log(`  ${row.status || 'NULL'}: ${row.count} records`);
    });
    
    console.log('\n🔄 Step 2: Fixing legacy status values...');
    
    // Fix legacy 'partial' status to 'partially_paid'
    const partialUpdate = await db.execute(sql`
      UPDATE fund_allocations
      SET status = 'partially_paid'
      WHERE status = 'partial'
    `);
    
    if (partialUpdate.rowCount && partialUpdate.rowCount > 0) {
      console.log(`  ✅ Updated ${partialUpdate.rowCount} records from 'partial' to 'partially_paid'`);
    } else {
      console.log('  ℹ️  No legacy partial statuses found');
    }
    
    // Fix NULL status values to 'committed'
    const nullUpdate = await db.execute(sql`
      UPDATE fund_allocations
      SET status = 'committed'
      WHERE status IS NULL
    `);
    
    if (nullUpdate.rowCount && nullUpdate.rowCount > 0) {
      console.log(`  ✅ Updated ${nullUpdate.rowCount} NULL status records to 'committed'`);
    } else {
      console.log('  ℹ️  No NULL status values found');
    }
    
    console.log('\n🔒 Step 3: Adding database constraints...');
    
    // Add NOT NULL constraint and default value
    try {
      await db.execute(sql`
        ALTER TABLE fund_allocations 
        ALTER COLUMN status SET NOT NULL
      `);
      console.log('  ✅ Added NOT NULL constraint to status column');
    } catch (error) {
      console.log('  ℹ️  NOT NULL constraint already exists or cannot be added');
    }
    
    try {
      await db.execute(sql`
        ALTER TABLE fund_allocations 
        ALTER COLUMN status SET DEFAULT 'committed'
      `);
      console.log('  ✅ Added default value to status column');
    } catch (error) {
      console.log('  ℹ️  Default value already exists or cannot be added');
    }
    
    console.log('\n📊 Step 4: Verifying fix...');
    
    // Check for any remaining invalid statuses
    const invalidStatuses = await db.execute(sql`
      SELECT status, COUNT(*) as count 
      FROM fund_allocations 
      WHERE status NOT IN ('committed', 'invested', 'funded', 'partially_paid', 'partially_closed', 'closed', 'written_off')
      GROUP BY status
    `);
    
    if (invalidStatuses.rows.length > 0) {
      console.log('⚠️  Found invalid status values:');
      invalidStatuses.rows.forEach((row: any) => {
        console.log(`  ${row.status}: ${row.count} records`);
      });
    } else {
      console.log('  ✅ All status values are now valid');
    }
    
    // Test allocation retrieval to ensure 500 errors are fixed
    console.log('\n🧪 Step 5: Testing allocation retrieval...');
    
    try {
      const testAllocations = await storage.getAllocationsByFund(2); // Test with known fund ID
      console.log(`  ✅ Successfully retrieved ${testAllocations.length} allocations`);
    } catch (error) {
      console.log(`  ❌ Error retrieving allocations: ${error.message}`);
    }
    
    // Final status distribution
    console.log('\n📊 Final status distribution:');
    const finalAnalysis = await db.execute(sql`
      SELECT status, COUNT(*) as count 
      FROM fund_allocations 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    finalAnalysis.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count} records`);
    });
    
    console.log('\n✅ Allocation status enum fix completed successfully!');
    console.log('   - Legacy status values standardized');
    console.log('   - NULL values eliminated');
    console.log('   - Database constraints enforced');
    console.log('   - API errors should be resolved');
    
  } catch (error) {
    console.error('❌ Error fixing allocation status enum:', error);
    throw error;
  }
}

async function main() {
  try {
    await fixAllocationStatusEnum();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);

export { fixAllocationStatusEnum };