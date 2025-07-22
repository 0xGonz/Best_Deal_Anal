-- Fund Integration Verification Script
-- This script verifies that capital calls and AUM are properly integrated

-- Check Fund Financial Integration
WITH fund_metrics AS (
  SELECT 
    f.id as fund_id,
    f.name as fund_name,
    f.aum as current_aum,
    -- Calculate total commitments
    COALESCE((
      SELECT SUM(fa.amount) 
      FROM fund_allocations fa 
      WHERE fa.fund_id = f.id AND fa.status != 'written_off'
    ), 0) as total_committed,
    -- Calculate called capital from capital calls
    COALESCE((
      SELECT SUM(cc.call_amount) 
      FROM capital_calls cc 
      JOIN fund_allocations fa ON cc.allocation_id = fa.id 
      WHERE fa.fund_id = f.id
    ), 0) as total_called,
    -- Count allocations
    (SELECT COUNT(*) FROM fund_allocations fa WHERE fa.fund_id = f.id) as allocation_count
  FROM funds f
)
SELECT 
  fund_id,
  fund_name,
  current_aum,
  total_committed,
  total_called,
  total_committed - total_called as uncalled_capital,
  allocation_count,
  CASE 
    WHEN current_aum = total_called THEN '✓ AUM matches called capital'
    ELSE '✗ AUM mismatch - needs update'
  END as integration_status
FROM fund_metrics
ORDER BY fund_id;

-- Check Individual Capital Calls
SELECT 
  cc.id as call_id,
  f.name as fund_name,
  d.name as deal_name,
  cc.call_amount,
  cc.status as call_status,
  fa.amount as allocation_amount,
  fa.status as allocation_status,
  cc.created_at::date as call_date
FROM capital_calls cc
JOIN fund_allocations fa ON cc.allocation_id = fa.id
JOIN funds f ON fa.fund_id = f.id
JOIN deals d ON fa.deal_id = d.id
ORDER BY cc.created_at DESC;