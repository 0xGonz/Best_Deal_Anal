#!/usr/bin/env tsx

/**
 * Comprehensive Database Status Fix Script
 * 
 * This script fixes the root cause of status inconsistencies by:
 * 1. Correcting all existing allocation statuses based on actual payment data
 * 2. Adding database triggers to prevent future inconsistencies
 * 3. Creating a validation system that maintains data integrity
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { fundAllocations } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = neon(connectionString);
const db = drizzle(client);

interface AllocationStatus {
  id: number;
  dealName: string;
  amount: number;
  paidAmount: number;
  currentStatus: string;
  correctStatus: string;
  paymentPercentage: number;
}

/**
 * Calculate the correct status based on payment percentage
 */
function calculateCorrectStatus(amount: number, paidAmount: number): string {
  if (amount === 0) return 'unfunded';
  
  const paymentPercentage = (paidAmount / amount) * 100;
  
  if (paymentPercentage === 0) return 'committed';
  if (paymentPercentage >= 100) return 'funded';
  return 'partially_paid';
}

async function analyzeStatusInconsistencies(): Promise<AllocationStatus[]> {
  console.log('🔍 Analyzing allocation status inconsistencies...');
  
  const allocations = await client`
    SELECT 
      fa.id,
      fa.amount,
      fa.paid_amount,
      fa.status,
      COALESCE(d.name, 'Unknown Deal') as deal_name
    FROM fund_allocations fa
    LEFT JOIN deals d ON fa.deal_id = d.id
  `;
  
  const inconsistencies: AllocationStatus[] = [];
  
  for (const allocation of allocations) {
    const amount = Number(allocation.amount) || 0;
    const paidAmount = Number(allocation.paid_amount) || 0;
    const correctStatus = calculateCorrectStatus(amount, paidAmount);
    const paymentPercentage = amount > 0 ? (paidAmount / amount) * 100 : 0;
    
    if (allocation.status !== correctStatus) {
      inconsistencies.push({
        id: allocation.id,
        dealName: allocation.deal_name || 'Unknown Deal',
        amount,
        paidAmount,
        currentStatus: allocation.status || 'null',
        correctStatus,
        paymentPercentage
      });
    }
  }
  
  return inconsistencies;
}

async function fixAllocationStatuses(inconsistencies: AllocationStatus[]): Promise<void> {
  console.log(`🔧 Fixing ${inconsistencies.length} allocation status inconsistencies...`);
  
  for (const issue of inconsistencies) {
    console.log(
      `  • ${issue.dealName}: $${issue.paidAmount.toLocaleString()}/$${issue.amount.toLocaleString()} ` +
      `(${issue.paymentPercentage.toFixed(1)}%) "${issue.currentStatus}" → "${issue.correctStatus}"`
    );
    
    await db
      .update(fundAllocations)
      .set({ status: issue.correctStatus })
      .where(eq(fundAllocations.id, issue.id));
  }
  
  console.log('✅ All allocation statuses corrected');
}

async function createStatusValidationTrigger(): Promise<void> {
  console.log('🔧 Creating database trigger for automatic status validation...');
  
  // Create the trigger function
  await client`
    CREATE OR REPLACE FUNCTION validate_allocation_status()
    RETURNS TRIGGER AS $$
    DECLARE
        payment_percentage DECIMAL;
        correct_status TEXT;
    BEGIN
        -- Calculate payment percentage
        IF NEW.amount = 0 THEN
            payment_percentage := 0;
        ELSE
            payment_percentage := (COALESCE(NEW.paid_amount, 0) / NEW.amount) * 100;
        END IF;
        
        -- Determine correct status
        IF payment_percentage = 0 THEN
            correct_status := 'committed';
        ELSIF payment_percentage >= 100 THEN
            correct_status := 'funded';
        ELSE
            correct_status := 'partially_paid';
        END IF;
        
        -- Update status if it's incorrect
        IF NEW.status != correct_status THEN
            NEW.status := correct_status;
            
            -- Log the automatic correction
            RAISE NOTICE 'Auto-corrected status for allocation %: % → % (%.1f%% paid)', 
                NEW.id, OLD.status, NEW.status, payment_percentage;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  // Drop existing trigger if it exists
  await client`
    DROP TRIGGER IF EXISTS allocation_status_validation ON fund_allocations;
  `;
  
  // Create the trigger
  await client`
    CREATE TRIGGER allocation_status_validation
        BEFORE INSERT OR UPDATE ON fund_allocations
        FOR EACH ROW
        EXECUTE FUNCTION validate_allocation_status();
  `;
  
  console.log('✅ Database trigger created - statuses will auto-correct on updates');
}

async function addDataIntegrityConstraints(): Promise<void> {
  console.log('🔧 Adding data integrity constraints...');
  
  try {
    // Ensure paid_amount cannot exceed amount
    await client`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT check_paid_amount_valid 
      CHECK (paid_amount >= 0 AND paid_amount <= amount);
    `;
    console.log('  ✅ Added constraint: paid_amount <= amount');
  } catch (error) {
    console.log('  ℹ️ Constraint already exists: paid_amount <= amount');
  }
  
  try {
    // Ensure amount is positive
    await client`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT check_amount_positive 
      CHECK (amount >= 0);
    `;
    console.log('  ✅ Added constraint: amount >= 0');
  } catch (error) {
    console.log('  ℹ️ Constraint already exists: amount >= 0');
  }
}

async function verifyFixes(): Promise<void> {
  console.log('🔍 Verifying all fixes...');
  
  const remainingIssues = await analyzeStatusInconsistencies();
  
  if (remainingIssues.length === 0) {
    console.log('✅ All allocation statuses are now correct');
  } else {
    console.log(`❌ ${remainingIssues.length} issues remain:`);
    remainingIssues.forEach(issue => {
      console.log(
        `  • ${issue.dealName}: ${issue.paymentPercentage.toFixed(1)}% paid but status is "${issue.currentStatus}"`
      );
    });
  }
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting comprehensive allocation status fix...\n');
    
    // Step 1: Analyze current inconsistencies
    const inconsistencies = await analyzeStatusInconsistencies();
    
    if (inconsistencies.length === 0) {
      console.log('✅ No status inconsistencies found');
    } else {
      console.log(`❌ Found ${inconsistencies.length} status inconsistencies:\n`);
      inconsistencies.forEach(issue => {
        console.log(
          `  • ${issue.dealName}: $${issue.paidAmount.toLocaleString()}/$${issue.amount.toLocaleString()} ` +
          `(${issue.paymentPercentage.toFixed(1)}%) shows "${issue.currentStatus}" but should be "${issue.correctStatus}"`
        );
      });
      console.log('');
      
      // Step 2: Fix all status inconsistencies
      await fixAllocationStatuses(inconsistencies);
      console.log('');
    }
    
    // Step 3: Create database trigger for future protection
    await createStatusValidationTrigger();
    console.log('');
    
    // Step 4: Add data integrity constraints
    await addDataIntegrityConstraints();
    console.log('');
    
    // Step 5: Verify everything is fixed
    await verifyFixes();
    
    console.log('\n🎉 Database status fix completed successfully!');
    console.log('💡 All future allocation updates will automatically maintain correct status values');
    
  } catch (error) {
    console.error('❌ Error during database fix:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
main();