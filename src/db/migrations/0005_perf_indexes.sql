-- Performance indexes for stats and daily chart queries
CREATE INDEX IF NOT EXISTS idx_ab_visits_exp_variant ON ab_visits (experiment_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_ab_visits_exp_date ON ab_visits (experiment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ab_conv_exp_date ON ab_conversions (experiment_id, created_at);
