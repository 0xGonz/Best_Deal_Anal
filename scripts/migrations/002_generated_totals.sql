-- 002_generated_totals.sql  
-- Add generated columns for called_amount and funded_amount based on child tables

BEGIN;

-- Step 1: Add computed columns to fund_allocations for accurate totals (if not exists)
DO $$ 
BEGIN
  -- Add called_amount if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_allocations' AND column_name = 'called_amount') THEN
    ALTER TABLE fund_allocations 
      ADD COLUMN called_amount NUMERIC(18,2) GENERATED ALWAYS AS (
        COALESCE((
          SELECT SUM(call_amount) 
          FROM capital_calls 
          WHERE allocation_id = fund_allocations.id
        ), 0)
      ) STORED;
  END IF;

  -- Add funded_amount if it doesn't exist  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_allocations' AND column_name = 'funded_amount') THEN
    ALTER TABLE fund_allocations 
      ADD COLUMN funded_amount NUMERIC(18,2) GENERATED ALWAYS AS (
        COALESCE((
          SELECT SUM(paid_amount) 
          FROM capital_calls 
          WHERE allocation_id = fund_allocations.id
        ), 0)
      ) STORED;
  END IF;
END $$;

-- Step 2: Create trigger function to ensure payment records are linked to capital calls (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'enforce_payment_via_capital_call') THEN
    CREATE OR REPLACE FUNCTION enforce_payment_via_capital_call()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Block direct updates to paid_amount without corresponding capital call
      IF NEW.paid_amount != OLD.paid_amount THEN
        -- Allow updates only if there's a matching capital call payment
        IF NOT EXISTS (
          SELECT 1 FROM capital_calls 
          WHERE allocation_id = NEW.id 
          AND paid_amount > 0
        ) THEN
          RAISE EXCEPTION 'Payments must be recorded through capital calls, not direct allocation updates';
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Step 3: Create trigger to enforce payment workflow (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_enforce_payment_workflow') THEN
    CREATE TRIGGER trigger_enforce_payment_workflow
      BEFORE UPDATE ON fund_allocations
      FOR EACH ROW
      EXECUTE FUNCTION enforce_payment_via_capital_call();
  END IF;
END $$;

-- Step 4: Create function to sync capital call totals back to allocation (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'sync_allocation_totals') THEN
    CREATE OR REPLACE FUNCTION sync_allocation_totals()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Update allocation paid_amount to match capital calls total
      UPDATE fund_allocations 
      SET paid_amount = (
        SELECT COALESCE(SUM(paid_amount), 0)
        FROM capital_calls 
        WHERE allocation_id = COALESCE(NEW.allocation_id, OLD.allocation_id)
      )
      WHERE id = COALESCE(NEW.allocation_id, OLD.allocation_id);
      
      RETURN COALESCE(NEW, OLD);
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Step 5: Create trigger to maintain data consistency (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_sync_allocation_totals') THEN
    CREATE TRIGGER trigger_sync_allocation_totals
      AFTER INSERT OR UPDATE OR DELETE ON capital_calls
      FOR EACH ROW
      EXECUTE FUNCTION sync_allocation_totals();
  END IF;
END $$;

COMMIT;