#!/usr/bin/env tsx
/**
 * Allocation Workflow Diagnostic
 * Quick analysis of why allocations aren't being created
 */

import { DatabaseStorage } from '../server/database-storage.js';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function runDiagnostic() {
  console.log('🔍 ALLOCATION WORKFLOW DIAGNOSTIC');
  console.log('='.repeat(50));

  const storage = new DatabaseStorage();

  // 1. Check current data state
  console.log('\n📊 CURRENT DATA STATE:');
  
  const dealCount = await db.execute(sql`SELECT COUNT(*) as count FROM deals`);
  const fundCount = await db.execute(sql`SELECT COUNT(*) as count FROM funds`);
  const allocationCount = await db.execute(sql`SELECT COUNT(*) as count FROM fund_allocations`);
  
  console.log(`   Deals: ${dealCount.rows[0]?.count || 0}`);
  console.log(`   Funds: ${fundCount.rows[0]?.count || 0}`);
  console.log(`   Allocations: ${allocationCount.rows[0]?.count || 0}`);

  // 2. Check recent timeline events
  console.log('\n📋 RECENT ALLOCATION ACTIVITY:');
  const recentEvents = await db.execute(sql`
    SELECT event_type, content, created_at 
    FROM timeline_events 
    WHERE content ILIKE '%allocation%' OR content ILIKE '%fund%'
    ORDER BY created_at DESC 
    LIMIT 5
  `);

  recentEvents.rows.forEach((event: any, i: number) => {
    console.log(`   ${i + 1}. ${event.event_type}: ${event.content}`);
  });

  // 3. Test allocation creation capability
  console.log('\n🧪 TESTING ALLOCATION CREATION:');
  
  try {
    const deals = await storage.getDeals();
    const funds = await storage.getFunds();
    
    if (deals.length === 0) {
      console.log('   ❌ No deals available for testing');
      return;
    }
    
    if (funds.length === 0) {
      console.log('   ❌ No funds available for testing');
      return;
    }

    console.log(`   ✅ Test data available: ${deals.length} deals, ${funds.length} funds`);
    
    // Attempt to create a test allocation (without actually saving)
    const testData = {
      dealId: deals[0].id,
      fundId: funds[0].id,
      amount: 100000,
      status: 'committed' as const,
      allocationDate: new Date()
    };
    
    console.log(`   🔬 Would create: Deal ${testData.dealId} → Fund ${testData.fundId} ($${testData.amount.toLocaleString()})`);

  } catch (error) {
    console.log(`   ❌ Error during test: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4. Check database constraints
  console.log('\n🔒 DATABASE CONSTRAINTS:');
  const constraints = await db.execute(sql`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'fund_allocations'
  `);

  constraints.rows.forEach((constraint: any) => {
    console.log(`   ${constraint.constraint_type}: ${constraint.constraint_name}`);
  });

  // 5. Check for schema issues
  console.log('\n📋 SCHEMA VALIDATION:');
  const columns = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'fund_allocations'
    ORDER BY ordinal_position
  `);

  console.log('   fund_allocations table structure:');
  columns.rows.forEach((col: any) => {
    console.log(`     ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(required)'}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('💡 ANALYSIS COMPLETE');
}

runDiagnostic().catch(console.error);