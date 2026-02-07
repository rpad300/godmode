-- ============================================
-- GodMode Phase 4: Enterprise Features
-- Webhooks, API Keys, Audit Export
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== API KEYS ====================
-- API keys for programmatic access to projects

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Key identification
    name TEXT NOT NULL,
    description TEXT,
    
    -- Key value (hashed for security)
    key_prefix TEXT NOT NULL,  -- First 8 chars for identification (e.g., "gm_live_")
    key_hash TEXT NOT NULL,    -- SHA256 hash of full key
    
    -- Permissions
    permissions JSONB DEFAULT '["read"]'::jsonb,  -- Array of permissions
    
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    total_requests INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,  -- NULL = never expires
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id)
);

-- Indexes for API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(project_id) WHERE is_active = TRUE;

-- ==================== API KEY USAGE LOG ====================
-- Track API key usage for analytics and billing

CREATE TABLE IF NOT EXISTS api_key_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Request details
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    
    -- Client info
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Partitioning hint: In production, partition by created_at month
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage(created_at DESC);

-- ==================== WEBHOOKS ====================
-- Webhooks for event notifications

CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Webhook configuration
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    
    -- Security
    secret TEXT NOT NULL,  -- For HMAC signature verification
    
    -- Events to trigger
    events JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of event types
    
    -- Headers to include
    custom_headers JSONB DEFAULT '{}'::jsonb,
    
    -- Retry configuration
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Health tracking
    last_triggered_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    total_failures INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(project_id) WHERE is_active = TRUE;

-- ==================== WEBHOOK DELIVERIES ====================
-- Log of webhook delivery attempts

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    
    -- Event that triggered this
    event_type TEXT NOT NULL,
    event_id TEXT,  -- Reference to activity_log or other source
    
    -- Request
    request_url TEXT NOT NULL,
    request_headers JSONB,
    request_body JSONB,
    
    -- Response
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Delivery status
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    attempt_number INTEGER DEFAULT 1,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ
);

-- Indexes for webhook deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- ==================== AUDIT EXPORT JOBS ====================
-- Track audit log export requests

CREATE TABLE IF NOT EXISTS audit_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Export parameters
    date_from TIMESTAMPTZ NOT NULL,
    date_to TIMESTAMPTZ NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,  -- action types, actors, etc.
    format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'csv', 'xlsx')),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    
    -- Result
    file_url TEXT,  -- URL to download (pre-signed, expires)
    file_size_bytes BIGINT,
    record_count INTEGER,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ  -- When the download link expires
);

-- Indexes for audit exports
CREATE INDEX IF NOT EXISTS idx_audit_exports_project ON audit_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_exports_user ON audit_exports(requested_by);
CREATE INDEX IF NOT EXISTS idx_audit_exports_status ON audit_exports(status) WHERE status IN ('pending', 'processing');

-- ==================== RLS POLICIES ====================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_exports ENABLE ROW LEVEL SECURITY;

-- API Keys: Admins and owners can manage
DROP POLICY IF EXISTS "Admins manage API keys" ON api_keys;
CREATE POLICY "Admins manage API keys" ON api_keys
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = api_keys.project_id 
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- API Key Usage: Admins can view
DROP POLICY IF EXISTS "Admins view API usage" ON api_key_usage;
CREATE POLICY "Admins view API usage" ON api_key_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM api_keys
            JOIN project_members ON project_members.project_id = api_keys.project_id
            WHERE api_keys.id = api_key_usage.api_key_id
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- Webhooks: Admins and owners can manage
DROP POLICY IF EXISTS "Admins manage webhooks" ON webhooks;
CREATE POLICY "Admins manage webhooks" ON webhooks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = webhooks.project_id 
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- Webhook Deliveries: Admins can view
DROP POLICY IF EXISTS "Admins view deliveries" ON webhook_deliveries;
CREATE POLICY "Admins view deliveries" ON webhook_deliveries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM webhooks
            JOIN project_members ON project_members.project_id = webhooks.project_id
            WHERE webhooks.id = webhook_deliveries.webhook_id
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- Audit Exports: Admins can manage their exports
DROP POLICY IF EXISTS "Admins manage audit exports" ON audit_exports;
CREATE POLICY "Admins manage audit exports" ON audit_exports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = audit_exports.project_id 
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- ==================== TRIGGERS ====================

-- Update updated_at on webhooks
DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
CREATE TRIGGER update_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== WEBHOOK EVENTS ====================
-- Define available webhook events

COMMENT ON TABLE api_keys IS 'API keys for programmatic project access';
COMMENT ON TABLE api_key_usage IS 'Usage log for API key analytics';
COMMENT ON TABLE webhooks IS 'Webhook configurations for event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery attempts and results';
COMMENT ON TABLE audit_exports IS 'Audit log export job tracking';

-- Example webhook events (documented):
-- content.created, content.updated, content.deleted
-- document.uploaded, document.processed
-- member.added, member.removed, member.role_changed
-- comment.created, comment.resolved
-- project.updated
