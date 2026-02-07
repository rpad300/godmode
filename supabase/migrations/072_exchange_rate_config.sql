-- ============================================
-- Exchange Rate Configuration
-- Migration 072 - 2026-02-03
-- ============================================

-- Add exchange rate configuration to system_config
-- These control automatic vs manual exchange rate for billing

-- Enable automatic exchange rate by default
INSERT INTO system_config (key, value, description, created_at)
VALUES (
    'exchange_rate_auto',
    'true',
    'Enable automatic USD/EUR exchange rate fetching from API',
    now()
)
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = now();

-- Manual rate fallback (used when auto is disabled)
INSERT INTO system_config (key, value, description, created_at)
VALUES (
    'exchange_rate_manual',
    '0.92',
    'Manual USD/EUR exchange rate (used when auto is disabled)',
    now()
)
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = now();

-- Last fetched rate (populated by the exchange rate service)
INSERT INTO system_config (key, value, description, created_at)
VALUES (
    'exchange_rate_last_value',
    NULL,
    'Last automatically fetched USD/EUR exchange rate',
    now()
)
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = now();

-- Timestamp of last rate update
INSERT INTO system_config (key, value, description, created_at)
VALUES (
    'exchange_rate_last_updated',
    NULL,
    'Timestamp when exchange rate was last fetched',
    now()
)
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = now();

-- Add comment
COMMENT ON TABLE system_config IS 'System-wide configuration settings including exchange rate for billing';
