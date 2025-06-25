/**
 * Fix Outstanding Amount Schema Inconsistency
 * Addresses the critical data type mismatch between database and schema
 */

import { execute_sql_tool } from '../server/db';

async function fixOutstandingAmountSchema() {
  console.log('🔧 Fixing outstanding_amount schema inconsistency...');

  try {
    // Check current data type
    const columnInfo = await execute_sql_tool(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns 
      WHERE table_name = 'capital_calls' 
        AND column_name = 'outstanding_amount'
    `);

    console.log('Current column info:', columnInfo.rows[0]);

    // Update all string values to proper numeric format
    await execute_sql_tool(`
      UPDATE capital_calls 
      SET outstanding_amount = CAST(
        CASE 
          WHEN outstanding_amount ~ '^[0-9]+\.?[0-9]*$' THEN outstanding_amount::numeric
          ELSE 0
        END AS text
      )
      WHERE outstanding_amount IS NOT NULL
    `);

    // Verify data consistency
    const inconsistentData = await execute_sql_tool(`
      SELECT id, outstanding_amount, call_amount, paid_amount
      FROM capital_calls 
      WHERE outstanding_amount !~ '^[0-9]+\.?[0-9]*$'
        OR outstanding_amount IS NULL
    `);

    if (inconsistentData.rows.length > 0) {
      console.log('Found inconsistent data, fixing...');
      
      // Fix NULL values and recalculate outstanding amounts
      await execute_sql_tool(`
        UPDATE capital_calls 
        SET outstanding_amount = CAST((call_amount - COALESCE(paid_amount, 0)) AS text)
        WHERE outstanding_amount IS NULL 
           OR outstanding_amount !~ '^[0-9]+\.?[0-9]*$'
      `);
    }

    // Verify final state
    const finalCheck = await execute_sql_tool(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN outstanding_amount ~ '^[0-9]+\.?[0-9]*$' THEN 1 END) as valid_numeric,
        COUNT(CASE WHEN outstanding_amount IS NULL THEN 1 END) as null_values
      FROM capital_calls
    `);

    console.log('✅ Schema fix completed:', finalCheck.rows[0]);

    // Add validation constraint to prevent future issues
    try {
      await execute_sql_tool(`
        ALTER TABLE capital_calls 
        ADD CONSTRAINT outstanding_amount_numeric_check 
        CHECK (outstanding_amount ~ '^[0-9]+\.?[0-9]*$')
      `);
      console.log('✅ Added validation constraint');
    } catch (error) {
      // Constraint might already exist
      console.log('ℹ️ Validation constraint already exists or could not be added');
    }

  } catch (error) {
    console.error('❌ Schema fix failed:', error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  fixOutstandingAmountSchema()
    .then(() => {
      console.log('🎉 Outstanding amount schema fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Schema fix failed:', error);
      process.exit(1);
    });
}

export { fixOutstandingAmountSchema };