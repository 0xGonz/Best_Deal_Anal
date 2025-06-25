-- 001_money_numeric.sql
-- Convert money fields to NUMERIC type and add constraints for data integrity

BEGIN;

-- Step 1: Convert fund_allocations money columns to NUMERIC(18,2) (if not already)
DO $$
BEGIN
  -- Convert amount column if it's not already NUMERIC
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_allocations' AND column_name = 'amount' AND data_type != 'numeric') THEN
    ALTER TABLE fund_allocations ALTER COLUMN amount TYPE NUMERIC(18,2) USING amount::NUMERIC(18,2);
  END IF;
  
  -- Convert paid_amount column if it's not already NUMERIC
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_allocations' AND column_name = 'paid_amount' AND data_type != 'numeric') THEN
    ALTER TABLE fund_allocations ALTER COLUMN paid_amount TYPE NUMERIC(18,2) USING paid_amount::NUMERIC(18,2);
  END IF;
END $$;

-- Step 2: Convert capital_calls money columns to NUMERIC(18,2) (if not already)
DO $$
BEGIN
  -- Convert call_amount column if it's not already NUMERIC
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'capital_calls' AND column_name = 'call_amount' AND data_type != 'numeric') THEN
    ALTER TABLE capital_calls ALTER COLUMN call_amount TYPE NUMERIC(18,2) USING call_amount::NUMERIC(18,2);
  END IF;
  
  -- Convert paid_amount column if it's not already NUMERIC
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'capital_calls' AND column_name = 'paid_amount' AND data_type != 'numeric') THEN
    ALTER TABLE capital_calls ALTER COLUMN paid_amount TYPE NUMERIC(18,2) USING paid_amount::NUMERIC(18,2);
  END IF;
END $$;

-- Step 3: Add CHECK constraints to fund_allocations (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_paid_amount_not_negative' AND table_name = 'fund_allocations') THEN
    ALTER TABLE fund_allocations ADD CONSTRAINT check_paid_amount_not_negative CHECK (paid_amount >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_amount_positive' AND table_name = 'fund_allocations') THEN
    ALTER TABLE fund_allocations ADD CONSTRAINT check_amount_positive CHECK (amount > 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_paid_not_exceed_amount' AND table_name = 'fund_allocations') THEN
    ALTER TABLE fund_allocations ADD CONSTRAINT check_paid_not_exceed_amount CHECK (paid_amount <= amount);
  END IF;
END $$;

-- Step 4: Add UNIQUE constraint to prevent duplicate allocations (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_fund_deal_allocation' AND table_name = 'fund_allocations') THEN
    ALTER TABLE fund_allocations ADD CONSTRAINT unique_fund_deal_allocation UNIQUE (fund_id, deal_id);
  END IF;
END $$;

-- Step 5: Add constraints to capital_calls (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_call_pct_valid' AND table_name = 'capital_calls') THEN
    ALTER TABLE capital_calls ADD CONSTRAINT check_call_pct_valid CHECK (call_pct >= 0 AND call_pct <= 100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_allocation_due_date' AND table_name = 'capital_calls') THEN
    ALTER TABLE capital_calls ADD CONSTRAINT unique_allocation_due_date UNIQUE (allocation_id, due_date);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_paid_not_exceed_call' AND table_name = 'capital_calls') THEN
    ALTER TABLE capital_calls ADD CONSTRAINT check_paid_not_exceed_call CHECK (paid_amount <= call_amount);
  END IF;
END $$;

-- Step 6: Ensure FK constraint exists and is NOT NULL
ALTER TABLE capital_calls ALTER COLUMN allocation_id SET NOT NULL;

COMMIT;