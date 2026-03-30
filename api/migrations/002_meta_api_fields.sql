-- Meta API integration fields
-- Adds Meta Ad Account ID to clients and Meta campaign tracking to campaigns

-- Add Meta Ad Account ID to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_ad_account_id text DEFAULT NULL;

-- Add Meta campaign ID to campaigns (to link BudgetFlow campaign to Meta campaign)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta_campaign_id text DEFAULT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS actual_spend numeric DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT NULL;

-- Index for efficient lookup by meta_campaign_id
CREATE INDEX IF NOT EXISTS idx_campaigns_meta_campaign_id ON campaigns(meta_campaign_id);
