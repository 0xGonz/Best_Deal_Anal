-- 001_money_numeric.sql
-- Convert money fields to NUMERIC type and add constraints for data integrity

BEGIN;

-- Step 1: Convert fund_allocations money columns to NUMERIC(18,2)
ALTER TABLE fund_allocations 
  ALTER COLUMN amount TYPE NUMERIC(18,2) USING amount::NUMERIC(18,2),
  ALTER COLUMN paid_amount TYPE NUMERIC(18,2) USING paid_amount::NUMERIC(18,2);

-- Step 2: Convert capital_calls money columns to NUMERIC(18,2) 
ALTER TABLE capital_calls
  ALTER COLUMN call_amount TYPE NUMERIC(18,2) USING call_amount::NUMERIC(18,2),
  ALTER COLUMN paid_amount TYPE NUMERIC(18,2) USING paid_amount::NUMERIC(18,2);

-- Step 3: Add CHECK constraints to fund_allocations
ALTER TABLE fund_allocations 
  ADD CONSTRAINT check_paid_amount_not_negative CHECK (paid_amount >= 0),
  ADD CONSTRAINT check_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT check_paid_not_exceed_amount CHECK (paid_amount <= amount);

-- Step 4: Add UNIQUE constraint to prevent duplicate allocations
ALTER TABLE fund_allocations 
  ADD CONSTRAINT unique_fund_deal_allocation UNIQUE (fund_id, deal_id);

-- Step 5: Add CHECK constraint to capital_calls for valid percentage
ALTER TABLE capital_calls
  ADD CONSTRAINT check_call_pct_valid CHECK (call_pct >= 0 AND call_pct <= 100);

-- Step 6: Add unique constraint for capital calls to prevent duplicates on same due date
ALTER TABLE capital_calls
  ADD CONSTRAINT unique_allocation_due_date UNIQUE (allocation_id, due_date);

-- Step 7: Ensure FK constraint exists and is NOT NULL
ALTER TABLE capital_calls
  ALTER COLUMN allocation_id SET NOT NULL;

-- Step 8: Add constraint to ensure payment consistency
ALTER TABLE capital_calls
  ADD CONSTRAINT check_paid_not_exceed_call CHECK (paid_amount <= call_amount);

COMMIT;