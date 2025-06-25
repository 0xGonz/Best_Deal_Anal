-- 002_generated_totals.sql  
-- Add generated columns for called_amount and funded_amount based on child tables

BEGIN;

-- Step 1: Add computed columns to fund_allocations for accurate totals
ALTER TABLE fund_allocations 
  ADD COLUMN called_amount NUMERIC(18,2) GENERATED ALWAYS AS (
    COALESCE((
      SELECT SUM(call_amount) 
      FROM capital_calls 
      WHERE allocation_id = fund_allocations.id
    ), 0)
  ) STORED,
  ADD COLUMN funded_amount NUMERIC(18,2) GENERATED ALWAYS AS (
    COALESCE((
      SELECT SUM(paid_amount) 
      FROM capital_calls 
      WHERE allocation_id = fund_allocations.id
    ), 0)
  ) STORED;

-- Step 2: Create trigger function to ensure payment records are linked to capital calls
CREATE OR REPLACE FUNCTION enforce_payment_via_capital_call()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to enforce payment workflow
CREATE TRIGGER trigger_enforce_payment_workflow
  BEFORE UPDATE ON fund_allocations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_payment_via_capital_call();

-- Step 4: Create function to sync capital call totals back to allocation
CREATE OR REPLACE FUNCTION sync_allocation_totals()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to maintain data consistency
CREATE TRIGGER trigger_sync_allocation_totals
  AFTER INSERT OR UPDATE OR DELETE ON capital_calls
  FOR EACH ROW
  EXECUTE FUNCTION sync_allocation_totals();

COMMIT;