-- TimescaleDB Setup for Transactions table
-- This script converts the transactions table to a hypertable for time-series optimization

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert transactions table to hypertable
-- This enables automatic partitioning by time and optimizes time-series queries
SELECT create_hypertable('transactions', 'timestamp', 
  chunk_time_interval => INTERVAL '1 month',
  if_not_exists => TRUE
);

-- Create continuous aggregate for daily transaction summaries (optional, for performance)
-- This pre-aggregates daily totals for faster report generation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_transaction_summary
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 day', timestamp) AS day,
  type,
  SUM(amount) AS total_amount,
  COUNT(*) AS transaction_count
FROM transactions
GROUP BY day, type;

-- Add refresh policy for continuous aggregate (refresh every hour)
SELECT add_continuous_aggregate_policy('daily_transaction_summary',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Add compression policy for old data (>1 year)
SELECT add_compression_policy('transactions',
  INTERVAL '1 year',
  if_not_exists => TRUE
);

