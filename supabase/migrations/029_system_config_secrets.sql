-- ============================================
-- Migration 029: System Config, Secrets & Graph Config
-- Enterprise configuration management with encryption
-- ============================================

-- Ensure pgcrypto is available for encrypt_secret/decrypt_secret (required for pgp_sym_encrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- SYSTEM CONFIG
-- Global system-level configuration (superadmin only)
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    
    -- Audit
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- ============================================
-- SECRETS
-- Encrypted storage for API keys and sensitive data
-- Uses pgcrypto for encryption (already enabled in 003)
-- ============================================
CREATE TABLE IF NOT EXISTS secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scope: system (global) or project (per-project)
    scope TEXT NOT NULL CHECK (scope IN ('system', 'project')),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Secret identification
    name TEXT NOT NULL,
    provider TEXT,  -- e.g., 'openai', 'anthropic', 'google', 'grok', 'graph'
    
    -- Encrypted value using pgcrypto
    -- Store: pgp_sym_encrypt(value, encryption_key)
    -- Read: pgp_sym_decrypt(encrypted_value::bytea, encryption_key)
    encrypted_value TEXT NOT NULL,
    
    -- Metadata (non-sensitive)
    masked_value TEXT,  -- e.g., 'sk-****1234'
    last_used_at TIMESTAMPTZ,
    is_valid BOOLEAN DEFAULT true,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique indexes for secrets (separate for system and project scopes)
-- System secrets: unique by name (project_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_system_unique 
    ON secrets(name) WHERE scope = 'system' AND project_id IS NULL;

-- Project secrets: unique by project_id + name
CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_project_unique 
    ON secrets(project_id, name) WHERE scope = 'project' AND project_id IS NOT NULL;

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_secrets_scope ON secrets(scope);
CREATE INDEX IF NOT EXISTS idx_secrets_project ON secrets(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_secrets_provider ON secrets(provider);
CREATE INDEX IF NOT EXISTS idx_secrets_name ON secrets(name);

-- ============================================
-- ADD GRAPH_CONFIG TO PROJECT_CONFIG
-- Graph database settings
-- ============================================
ALTER TABLE project_config 
ADD COLUMN IF NOT EXISTS graph_config JSONB DEFAULT '{
    "enabled": false,
    "provider": "json",
    "graphName": "",
    "falkordb": {
        "host": "",
        "port": 6379,
        "tls": true
    }
}'::jsonb;

-- ============================================
-- ADD LLM_PERTASK TO PROJECT_CONFIG
-- Per-task LLM configuration (text, vision, embeddings)
-- ============================================
ALTER TABLE project_config 
ADD COLUMN IF NOT EXISTS llm_pertask JSONB DEFAULT '{
    "text": null,
    "vision": null,
    "embeddings": null,
    "useSystemDefaults": {
        "text": true,
        "vision": true,
        "embeddings": true
    }
}'::jsonb;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

-- System Config: Only superadmin can write, all authenticated can read
CREATE POLICY "Superadmin can manage system_config" ON system_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

CREATE POLICY "Authenticated can read system_config" ON system_config
    FOR SELECT USING (auth.role() = 'authenticated');

-- Secrets: Scope-based access
-- System secrets: only superadmin
CREATE POLICY "Superadmin manages system secrets" ON secrets
    FOR ALL USING (
        scope = 'system' AND 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- Project secrets: project owner/admin can manage
CREATE POLICY "Project admin manages project secrets" ON secrets
    FOR ALL USING (
        scope = 'project' AND 
        project_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = secrets.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Project members can read (masked) project secrets
CREATE POLICY "Project members read project secrets" ON secrets
    FOR SELECT USING (
        scope = 'project' AND 
        project_id IS NOT NULL AND
        is_project_member(project_id)
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to encrypt a secret
-- Usage: SELECT encrypt_secret('my-api-key', 'encryption-key')
CREATE OR REPLACE FUNCTION encrypt_secret(
    p_value TEXT,
    p_key TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN encode(pgp_sym_encrypt(p_value, p_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt a secret
-- Usage: SELECT decrypt_secret(encrypted_value, 'encryption-key')
CREATE OR REPLACE FUNCTION decrypt_secret(
    p_encrypted TEXT,
    p_key TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64'), p_key);
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mask an API key
-- Usage: SELECT mask_api_key('sk-1234567890abcdef')
CREATE OR REPLACE FUNCTION mask_api_key(p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_key IS NULL OR length(p_key) < 8 THEN
        RETURN '••••••••';
    END IF;
    RETURN substring(p_key, 1, 4) || '••••' || substring(p_key, length(p_key) - 3);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- INSERT DEFAULT SYSTEM CONFIGS
-- ============================================

INSERT INTO system_config (key, value, description) VALUES
    ('llm_pertask', '{
        "text": {"provider": "ollama", "model": null},
        "vision": {"provider": "ollama", "model": null},
        "embeddings": {"provider": "ollama", "model": null}
    }'::jsonb, 'Default LLM configuration per task type (text, vision, embeddings)'),
    
    ('prompts', '{
        "document": "",
        "vision": "",
        "transcript": "",
        "email": ""
    }'::jsonb, 'Default extraction prompts for different content types'),
    
    ('processing', '{
        "chunkSize": 4000,
        "chunkOverlap": 200,
        "similarityThreshold": 0.90,
        "pdfToImages": true
    }'::jsonb, 'Default document processing settings'),
    
    ('graph', '{
        "enabled": false,
        "provider": "json",
        "graphName": "",
        "falkordb": {
            "host": "",
            "port": 6379,
            "tls": true
        }
    }'::jsonb, 'Default graph database configuration'),
    
    ('routing', '{
        "mode": "single",
        "perTask": {
            "chat": {"priorities": ["ollama"], "maxAttempts": 3, "timeoutMs": 45000},
            "processing": {"priorities": ["ollama"], "maxAttempts": 3, "timeoutMs": 120000}
        }
    }'::jsonb, 'LLM routing and failover configuration'),
    
    ('tokenPolicy', '{
        "enforce": true,
        "defaultMaxOutputTokens": 4096,
        "defaultReservedForSystem": 500,
        "defaultReservedForRag": 2000,
        "perTask": {
            "chat": {"reservedForRag": 3000, "maxOutputTokens": 2048},
            "processing": {"maxOutputTokens": 4096, "reservedForRag": 1000}
        },
        "perModel": {}
    }'::jsonb, 'Token limits and reservation policy'),
    
    ('presets', '{
        "economy": {
            "text": {"provider": "ollama", "model": "llama3"},
            "vision": {"provider": "ollama", "model": "llava"},
            "embeddings": {"provider": "ollama", "model": "nomic-embed-text"}
        },
        "balanced": {
            "text": {"provider": "openai", "model": "gpt-4o-mini"},
            "vision": {"provider": "google", "model": "gemini-1.5-flash"},
            "embeddings": {"provider": "ollama", "model": "nomic-embed-text"}
        },
        "quality": {
            "text": {"provider": "openai", "model": "gpt-4o"},
            "vision": {"provider": "google", "model": "gemini-1.5-pro"},
            "embeddings": {"provider": "openai", "model": "text-embedding-3-large"}
        }
    }'::jsonb, 'Pre-defined configuration presets')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE system_config IS 'Global system-level configuration, managed by superadmin';
COMMENT ON TABLE secrets IS 'Encrypted storage for API keys and sensitive credentials';
COMMENT ON COLUMN secrets.encrypted_value IS 'Value encrypted with pgp_sym_encrypt using SECRETS_ENCRYPTION_KEY';
COMMENT ON COLUMN secrets.masked_value IS 'Partially masked value for display (e.g., sk-****1234)';
COMMENT ON COLUMN project_config.graph_config IS 'Graph database configuration (Supabase graph provider)';
COMMENT ON COLUMN project_config.llm_pertask IS 'Per-task LLM override (text, vision, embeddings)';
COMMENT ON FUNCTION encrypt_secret IS 'Encrypt a secret value using pgcrypto';
COMMENT ON FUNCTION decrypt_secret IS 'Decrypt a secret value using pgcrypto';
COMMENT ON FUNCTION mask_api_key IS 'Mask an API key for display (show first 4 and last 4 chars)';
