-- Phase 3 Database Index Optimizations
-- Optimizes query performance for high-traffic patterns

-- Composite indexes for allocation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fund_allocations_fund_deal 
ON fund_allocations (fund_id, deal_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fund_allocations_status_amount 
ON fund_allocations (status, amount DESC);

-- Capital calls performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capital_calls_allocation_date 
ON capital_calls (allocation_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capital_calls_due_date 
ON capital_calls (due_date) WHERE paid_date IS NULL;

-- Deal query optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_stage_sector 
ON deals (stage, sector);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_created_stage 
ON deals (created_at DESC, stage) WHERE stage != 'archived';

-- Fund performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funds_vintage_aum 
ON funds (vintage DESC, aum DESC);

-- Timeline events for activity feeds
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_deal_date 
ON timeline_events (deal_id, created_at DESC);

-- User activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_active 
ON users (last_active DESC) WHERE last_active IS NOT NULL;

-- Document search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_deal_type 
ON documents (deal_id, document_type, created_at DESC);

-- Analyze tables for query planner optimization
ANALYZE fund_allocations;
ANALYZE capital_calls;
ANALYZE deals;
ANALYZE funds;
ANALYZE timeline_events;
ANALYZE documents;

-- Update table statistics
UPDATE pg_stat_user_tables SET n_tup_ins = 0, n_tup_upd = 0, n_tup_del = 0;