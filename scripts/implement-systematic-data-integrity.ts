/**
 * Systematic Data Integrity Implementation
 * 
 * Extends the scalable allocation status pattern to all modules in your app:
 * - Capital calls payment validation
 * - Deal financial consistency  
 * - Fund capital calculation accuracy
 * - Cross-module data synchronization
 * 
 * This creates a comprehensive, automated system that prevents data 
 * inconsistencies at the database level across your entire platform.
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const db = neon(DATABASE_URL);

/**
 * Capital Calls Data Integrity Triggers
 */
async function createCapitalCallIntegrityTriggers() {
  console.log('📋 Creating capital call data integrity triggers...');
  
  // Function to validate capital call data
  await db`
    CREATE OR REPLACE FUNCTION validate_capital_call_data()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Ensure call amount is positive
      IF NEW.call_amount <= 0 THEN
        RAISE EXCEPTION 'Capital call amount must be positive, got %', NEW.call_amount;
      END IF;
      
      -- Ensure paid amount doesn't exceed call amount
      IF NEW.paid_amount > NEW.call_amount THEN
        RAISE EXCEPTION 'Paid amount (%) cannot exceed call amount (%)', NEW.paid_amount, NEW.call_amount;
      END IF;
      
      -- Auto-calculate correct call percentage
      IF NEW.allocation_amount > 0 THEN
        NEW.call_pct = ROUND((NEW.call_amount / NEW.allocation_amount) * 100, 2);
      ELSE
        NEW.call_pct = 0;
      END IF;
      
      -- Auto-correct payment status based on amounts
      IF NEW.paid_amount >= NEW.call_amount THEN
        NEW.payment_status = 'paid';
      ELSIF NEW.paid_amount > 0 THEN
        NEW.payment_status = 'partial';
      ELSIF NEW.due_date < CURRENT_DATE THEN
        NEW.payment_status = 'overdue';
      ELSE
        NEW.payment_status = 'pending';
      END IF;
      
      RAISE NOTICE 'Auto-validated capital call %: % (%.1f%% called, status: %)', 
        NEW.id, NEW.call_amount, NEW.call_pct, NEW.payment_status;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  // Trigger for capital calls
  await db`
    DROP TRIGGER IF EXISTS capital_call_validation ON capital_calls;
    CREATE TRIGGER capital_call_validation
      BEFORE INSERT OR UPDATE ON capital_calls
      FOR EACH ROW
      EXECUTE FUNCTION validate_capital_call_data();
  `;
  
  console.log('✅ Capital call integrity triggers created');
}

/**
 * Deal Financial Validation Triggers  
 */
async function createDealIntegrityTriggers() {
  console.log('💼 Creating deal financial integrity triggers...');
  
  // Function to validate deal financial data
  await db`
    CREATE OR REPLACE FUNCTION validate_deal_financials()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Validate target raise vs valuation
      IF NEW.target_raise IS NOT NULL AND NEW.valuation IS NOT NULL THEN
        IF NEW.target_raise > NEW.valuation THEN
          RAISE EXCEPTION 'Target raise (%) cannot exceed post-money valuation (%)', 
            NEW.target_raise, NEW.valuation;
        END IF;
        
        -- Auto-calculate pre-money valuation
        NEW.pre_money_valuation = NEW.valuation - NEW.target_raise;
      END IF;
      
      -- Validate projected returns are reasonable
      IF NEW.projected_irr IS NOT NULL THEN
        IF NEW.projected_irr < 0 OR NEW.projected_irr > 100 THEN
          RAISE WARNING 'Projected IRR of %% seems unusual for deal %', NEW.projected_irr, NEW.name;
        END IF;
      END IF;
      
      -- Auto-calculate implied multiple from IRR (assuming 5-year hold)
      IF NEW.projected_irr IS NOT NULL AND NEW.projected_irr > 0 THEN
        NEW.implied_multiple = POWER(1 + (NEW.projected_irr / 100.0), 5);
      END IF;
      
      RAISE NOTICE 'Auto-validated deal financials for %: valuation %, target raise %', 
        NEW.name, NEW.valuation, NEW.target_raise;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  // Trigger for deals
  await db`
    DROP TRIGGER IF EXISTS deal_financial_validation ON deals;
    CREATE TRIGGER deal_financial_validation
      BEFORE INSERT OR UPDATE ON deals
      FOR EACH ROW
      EXECUTE FUNCTION validate_deal_financials();
  `;
  
  console.log('✅ Deal integrity triggers created');
}

/**
 * Fund Capital Calculation Triggers
 */
async function createFundIntegrityTriggers() {
  console.log('🏦 Creating fund capital integrity triggers...');
  
  // Function to validate fund capital calculations
  await db`
    CREATE OR REPLACE FUNCTION validate_fund_capitals()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Ensure called capital doesn't exceed committed capital
      IF NEW.called_capital > NEW.committed_capital THEN
        RAISE EXCEPTION 'Called capital (%) cannot exceed committed capital (%)', 
          NEW.called_capital, NEW.committed_capital;
      END IF;
      
      -- Auto-calculate uncalled capital
      NEW.uncalled_capital = NEW.committed_capital - NEW.called_capital;
      
      -- Auto-calculate deployment rate
      IF NEW.committed_capital > 0 THEN
        NEW.deployment_rate = ROUND((NEW.called_capital / NEW.committed_capital) * 100, 2);
      ELSE
        NEW.deployment_rate = 0;
      END IF;
      
      -- Auto-calculate utilization rate (AUM vs called capital)
      IF NEW.called_capital > 0 THEN
        NEW.utilization_rate = ROUND((NEW.aum / NEW.called_capital) * 100, 2);
      ELSE
        NEW.utilization_rate = 0;
      END IF;
      
      -- Warn if AUM significantly exceeds called capital (may indicate gains or error)
      IF NEW.aum > NEW.called_capital * 2 THEN
        RAISE WARNING 'Fund % AUM (%) significantly exceeds called capital (%) - verify valuations', 
          NEW.name, NEW.aum, NEW.called_capital;
      END IF;
      
      RAISE NOTICE 'Auto-calculated fund metrics for %: deployment %.1f%%, utilization %.1f%%', 
        NEW.name, NEW.deployment_rate, NEW.utilization_rate;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  // Trigger for funds
  await db`
    DROP TRIGGER IF EXISTS fund_capital_validation ON funds;
    CREATE TRIGGER fund_capital_validation
      BEFORE INSERT OR UPDATE ON funds
      FOR EACH ROW
      EXECUTE FUNCTION validate_fund_capitals();
  `;
  
  console.log('✅ Fund integrity triggers created');
}

/**
 * Cross-Module Data Synchronization Triggers
 */
async function createCrossModuleSyncTriggers() {
  console.log('🔗 Creating cross-module synchronization triggers...');
  
  // Function to sync allocation status when capital calls change
  await db`
    CREATE OR REPLACE FUNCTION sync_allocation_from_capital_call()
    RETURNS TRIGGER AS $$
    DECLARE
      allocation_record RECORD;
      total_called NUMERIC;
      total_paid NUMERIC;
      call_percentage NUMERIC;
      payment_percentage NUMERIC;
      new_status TEXT;
    BEGIN
      -- Get the related allocation
      SELECT * INTO allocation_record 
      FROM fund_allocations 
      WHERE investment_id = NEW.investment_id;
      
      IF FOUND THEN
        -- Calculate total called and paid amounts for this allocation
        SELECT 
          COALESCE(SUM(call_amount), 0),
          COALESCE(SUM(paid_amount), 0)
        INTO total_called, total_paid
        FROM capital_calls 
        WHERE investment_id = NEW.investment_id;
        
        -- Calculate percentages
        call_percentage = CASE 
          WHEN allocation_record.amount > 0 THEN (total_called / allocation_record.amount) * 100
          ELSE 0 
        END;
        
        payment_percentage = CASE 
          WHEN allocation_record.amount > 0 THEN (total_paid / allocation_record.amount) * 100
          ELSE 0 
        END;
        
        -- Determine correct status using business logic
        IF payment_percentage >= 100 THEN
          new_status = 'funded';
        ELSIF payment_percentage > 0 THEN
          new_status = 'partially_paid';
        ELSIF call_percentage > 0 THEN
          new_status = 'committed';
        ELSE
          new_status = 'committed';
        END IF;
        
        -- Update allocation with synchronized data
        UPDATE fund_allocations 
        SET 
          called_amount = total_called,
          paid_amount = total_paid,
          status = new_status,
          updated_at = CURRENT_TIMESTAMP
        WHERE investment_id = NEW.investment_id;
        
        RAISE NOTICE 'Synced allocation % status to % (%.1f%% paid)', 
          allocation_record.id, new_status, payment_percentage;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  // Trigger to sync allocations when capital calls change
  await db`
    DROP TRIGGER IF EXISTS sync_allocation_on_capital_call_change ON capital_calls;
    CREATE TRIGGER sync_allocation_on_capital_call_change
      AFTER INSERT OR UPDATE ON capital_calls
      FOR EACH ROW
      EXECUTE FUNCTION sync_allocation_from_capital_call();
  `;
  
  console.log('✅ Cross-module sync triggers created');
}

/**
 * Data Integrity Constraints
 */
async function addDataIntegrityConstraints() {
  console.log('🛡️ Adding data integrity constraints...');
  
  try {
    // Capital call constraints
    await db`
      ALTER TABLE capital_calls 
      ADD CONSTRAINT IF NOT EXISTS check_call_amount_positive 
      CHECK (call_amount >= 0);
    `;
    
    await db`
      ALTER TABLE capital_calls 
      ADD CONSTRAINT IF NOT EXISTS check_paid_within_call_amount 
      CHECK (paid_amount <= call_amount);
    `;
    
    await db`
      ALTER TABLE capital_calls 
      ADD CONSTRAINT IF NOT EXISTS check_call_pct_valid 
      CHECK (call_pct >= 0 AND call_pct <= 100);
    `;
    
    // Deal constraints
    await db`
      ALTER TABLE deals 
      ADD CONSTRAINT IF NOT EXISTS check_target_raise_positive 
      CHECK (target_raise IS NULL OR target_raise >= 0);
    `;
    
    await db`
      ALTER TABLE deals 
      ADD CONSTRAINT IF NOT EXISTS check_valuation_positive 
      CHECK (valuation IS NULL OR valuation >= 0);
    `;
    
    // Fund constraints
    await db`
      ALTER TABLE funds 
      ADD CONSTRAINT IF NOT EXISTS check_committed_capital_positive 
      CHECK (committed_capital >= 0);
    `;
    
    await db`
      ALTER TABLE funds 
      ADD CONSTRAINT IF NOT EXISTS check_called_within_committed 
      CHECK (called_capital <= committed_capital);
    `;
    
    await db`
      ALTER TABLE funds 
      ADD CONSTRAINT IF NOT EXISTS check_aum_positive 
      CHECK (aum >= 0);
    `;
    
    console.log('✅ Data integrity constraints added');
    
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️ Some constraints already exist - skipping');
    } else {
      throw error;
    }
  }
}

/**
 * Create Comprehensive Data Quality Views
 */
async function createDataQualityViews() {
  console.log('📊 Creating data quality monitoring views...');
  
  // View for allocation status consistency
  await db`
    CREATE OR REPLACE VIEW v_allocation_status_audit AS
    SELECT 
      fa.id,
      fa.fund_id,
      fa.deal_id,
      d.name as deal_name,
      fa.amount,
      fa.paid_amount,
      fa.status as current_status,
      CASE 
        WHEN COALESCE(fa.paid_amount, 0) >= fa.amount THEN 'funded'
        WHEN COALESCE(fa.paid_amount, 0) > 0 THEN 'partially_paid'
        ELSE 'committed'
      END as correct_status,
      CASE 
        WHEN fa.amount > 0 THEN ROUND((COALESCE(fa.paid_amount, 0) / fa.amount) * 100, 1)
        ELSE 0 
      END as payment_percentage,
      CASE 
        WHEN fa.status != CASE 
          WHEN COALESCE(fa.paid_amount, 0) >= fa.amount THEN 'funded'
          WHEN COALESCE(fa.paid_amount, 0) > 0 THEN 'partially_paid'
          ELSE 'committed'
        END THEN true
        ELSE false
      END as has_inconsistency
    FROM fund_allocations fa
    LEFT JOIN deals d ON fa.deal_id = d.id;
  `;
  
  // View for capital call metrics
  await db`
    CREATE OR REPLACE VIEW v_capital_call_metrics AS
    SELECT 
      cc.id,
      cc.investment_id,
      cc.call_amount,
      cc.paid_amount,
      cc.call_pct,
      cc.payment_status,
      cc.due_date,
      CASE 
        WHEN cc.paid_amount >= cc.call_amount THEN 'paid'
        WHEN cc.paid_amount > 0 THEN 'partial'
        WHEN cc.due_date < CURRENT_DATE THEN 'overdue'
        ELSE 'pending'
      END as correct_status,
      CASE 
        WHEN cc.call_amount > 0 THEN ROUND((cc.paid_amount / cc.call_amount) * 100, 1)
        ELSE 0
      END as payment_percentage
    FROM capital_calls cc;
  `;
  
  // View for fund performance metrics
  await db`
    CREATE OR REPLACE VIEW v_fund_performance_audit AS
    SELECT 
      f.id,
      f.name,
      f.committed_capital,
      f.called_capital,
      f.aum,
      f.committed_capital - f.called_capital as calculated_uncalled,
      CASE 
        WHEN f.committed_capital > 0 THEN ROUND((f.called_capital / f.committed_capital) * 100, 2)
        ELSE 0 
      END as calculated_deployment_rate,
      CASE 
        WHEN f.called_capital > 0 THEN ROUND((f.aum / f.called_capital) * 100, 2)
        ELSE 0 
      END as calculated_utilization_rate
    FROM funds f;
  `;
  
  console.log('✅ Data quality monitoring views created');
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Implementing systematic data integrity across entire platform...\n');
  
  try {
    // Create integrity triggers for all modules
    await createCapitalCallIntegrityTriggers();
    await createDealIntegrityTriggers(); 
    await createFundIntegrityTriggers();
    await createCrossModuleSyncTriggers();
    
    // Add database-level constraints
    await addDataIntegrityConstraints();
    
    // Create monitoring views
    await createDataQualityViews();
    
    console.log('\n✅ SYSTEMATIC DATA INTEGRITY IMPLEMENTATION COMPLETE!');
    console.log('\n📋 What this provides:');
    console.log('• Capital call payment validation and auto-status correction');
    console.log('• Deal financial consistency enforcement');
    console.log('• Fund capital calculation accuracy');
    console.log('• Real-time cross-module data synchronization');
    console.log('• Database-level constraints preventing invalid data');
    console.log('• Monitoring views for ongoing quality checks');
    
    console.log('\n🎯 Your app now has:');
    console.log('• Automatic data validation for all financial modules');
    console.log('• Real-time error detection and correction');
    console.log('• Consistent business logic enforcement');
    console.log('• Scalable pattern for future modules');
    console.log('• Zero manual intervention required');
    
  } catch (error) {
    console.error('❌ Error implementing data integrity:', error);
    throw error;
  }
}

// Run the script
main().catch(console.error);

export { main };