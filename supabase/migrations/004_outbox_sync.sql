-- ============================================
-- GodMode Phase 5: Outbox Pattern for FalkorDB Sync
-- Reliable, idempotent synchronization between Postgres and FalkorDB
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== OUTBOX TABLE ====================
-- Central table for all pending graph operations
-- Implements the transactional outbox pattern

CREATE TABLE IF NOT EXISTS graph_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event identification
    event_id TEXT NOT NULL UNIQUE,  -- Idempotency key (e.g., "entity:uuid:v1")
    event_type TEXT NOT NULL,       -- Operation type
    
    -- Target
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    graph_name TEXT NOT NULL,       -- Target graph in FalkorDB
    
    -- Payload
    operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE', 'MERGE', 'LINK', 'UNLINK')),
    entity_type TEXT,               -- Node label or relation type
    entity_id TEXT,                 -- Primary identifier
    payload JSONB NOT NULL,         -- Full data for the operation
    
    -- Cypher query (pre-computed for efficiency)
    cypher_query TEXT,
    cypher_params JSONB,
    
    -- Processing status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    
    -- Retry logic
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Ordering
    sequence_number BIGSERIAL,      -- Ensures ordering within a project
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    processed_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    source TEXT DEFAULT 'api'       -- Where this event originated
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON graph_outbox(status, next_retry_at) 
    WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_outbox_project ON graph_outbox(project_id, status);
CREATE INDEX IF NOT EXISTS idx_outbox_sequence ON graph_outbox(project_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_outbox_event_id ON graph_outbox(event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON graph_outbox(created_at DESC);

-- ==================== SYNC STATUS TABLE ====================
-- Track sync status per project/graph

CREATE TABLE IF NOT EXISTS graph_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    graph_name TEXT NOT NULL,
    
    -- Connection status
    is_connected BOOLEAN DEFAULT FALSE,
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Sync progress
    last_processed_sequence BIGINT DEFAULT 0,
    pending_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Statistics
    total_synced INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    avg_sync_time_ms INTEGER,
    
    -- Health
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    last_health_check TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(project_id, graph_name)
);

CREATE INDEX IF NOT EXISTS idx_sync_status_project ON graph_sync_status(project_id);

-- ==================== DEAD LETTER QUEUE ====================
-- Failed events that need manual intervention

CREATE TABLE IF NOT EXISTS graph_dead_letter (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outbox_id UUID NOT NULL REFERENCES graph_outbox(id) ON DELETE CASCADE,
    
    -- Original event info
    event_id TEXT NOT NULL,
    project_id UUID NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    
    -- Failure details
    attempts INTEGER NOT NULL,
    errors JSONB NOT NULL,           -- Array of all error messages
    last_error TEXT NOT NULL,
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_project ON graph_dead_letter(project_id);
CREATE INDEX IF NOT EXISTS idx_dead_letter_unresolved ON graph_dead_letter(project_id) WHERE resolved = FALSE;

-- ==================== RLS POLICIES ====================

ALTER TABLE graph_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_dead_letter ENABLE ROW LEVEL SECURITY;

-- Outbox: Service role only (background processing)
DROP POLICY IF EXISTS "Service manages outbox" ON graph_outbox;
CREATE POLICY "Service manages outbox" ON graph_outbox
    FOR ALL USING (TRUE);  -- Service role bypasses RLS

-- Sync Status: Admins can view
DROP POLICY IF EXISTS "Admins view sync status" ON graph_sync_status;
CREATE POLICY "Admins view sync status" ON graph_sync_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = graph_sync_status.project_id 
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- Dead Letter: Admins can view and resolve
DROP POLICY IF EXISTS "Admins manage dead letters" ON graph_dead_letter;
CREATE POLICY "Admins manage dead letters" ON graph_dead_letter
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = graph_dead_letter.project_id 
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- ==================== FUNCTIONS ====================

-- Function to add event to outbox
CREATE OR REPLACE FUNCTION add_to_outbox(
    p_project_id UUID,
    p_graph_name TEXT,
    p_event_type TEXT,
    p_operation TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_payload JSONB,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id TEXT;
    v_outbox_id UUID;
BEGIN
    -- Generate idempotency key
    v_event_id := p_entity_type || ':' || p_entity_id || ':' || extract(epoch from now())::text;
    
    INSERT INTO graph_outbox (
        event_id, event_type, project_id, graph_name,
        operation, entity_type, entity_id, payload, created_by
    ) VALUES (
        v_event_id, p_event_type, p_project_id, p_graph_name,
        p_operation, p_entity_type, p_entity_id, p_payload, p_created_by
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id INTO v_outbox_id;
    
    -- Update pending count
    UPDATE graph_sync_status 
    SET pending_count = pending_count + 1,
        updated_at = now()
    WHERE project_id = p_project_id AND graph_name = p_graph_name;
    
    RETURN COALESCE(v_outbox_id, (SELECT id FROM graph_outbox WHERE event_id = v_event_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to claim next batch of events for processing
CREATE OR REPLACE FUNCTION claim_outbox_batch(
    p_batch_size INTEGER DEFAULT 100,
    p_worker_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    event_id TEXT,
    project_id UUID,
    graph_name TEXT,
    operation TEXT,
    entity_type TEXT,
    entity_id TEXT,
    payload JSONB,
    cypher_query TEXT,
    cypher_params JSONB,
    attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE graph_outbox o
    SET 
        status = 'processing',
        attempts = o.attempts + 1
    WHERE o.id IN (
        SELECT o2.id
        FROM graph_outbox o2
        WHERE o2.status IN ('pending', 'failed')
        AND (o2.next_retry_at IS NULL OR o2.next_retry_at <= now())
        ORDER BY o2.sequence_number
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    RETURNING 
        o.id, o.event_id, o.project_id, o.graph_name,
        o.operation, o.entity_type, o.entity_id, o.payload,
        o.cypher_query, o.cypher_params, o.attempts;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as completed
CREATE OR REPLACE FUNCTION complete_outbox_event(p_id UUID)
RETURNS VOID AS $$
DECLARE
    v_project_id UUID;
    v_graph_name TEXT;
BEGIN
    UPDATE graph_outbox 
    SET status = 'completed', processed_at = now()
    WHERE id = p_id
    RETURNING project_id, graph_name INTO v_project_id, v_graph_name;
    
    -- Update sync status
    UPDATE graph_sync_status 
    SET 
        pending_count = GREATEST(0, pending_count - 1),
        total_synced = total_synced + 1,
        updated_at = now()
    WHERE project_id = v_project_id AND graph_name = v_graph_name;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as failed
CREATE OR REPLACE FUNCTION fail_outbox_event(
    p_id UUID,
    p_error TEXT
)
RETURNS VOID AS $$
DECLARE
    v_attempts INTEGER;
    v_max_attempts INTEGER;
    v_project_id UUID;
    v_graph_name TEXT;
BEGIN
    SELECT attempts, max_attempts, project_id, graph_name 
    INTO v_attempts, v_max_attempts, v_project_id, v_graph_name
    FROM graph_outbox WHERE id = p_id;
    
    IF v_attempts >= v_max_attempts THEN
        -- Move to dead letter queue
        INSERT INTO graph_dead_letter (
            outbox_id, event_id, project_id, operation, payload,
            attempts, errors, last_error
        )
        SELECT 
            id, event_id, project_id, operation, payload,
            attempts, jsonb_build_array(p_error), p_error
        FROM graph_outbox WHERE id = p_id;
        
        UPDATE graph_outbox 
        SET status = 'dead_letter', last_error = p_error, processed_at = now()
        WHERE id = p_id;
        
        UPDATE graph_sync_status 
        SET 
            pending_count = GREATEST(0, pending_count - 1),
            failed_count = failed_count + 1,
            total_failed = total_failed + 1,
            updated_at = now()
        WHERE project_id = v_project_id AND graph_name = v_graph_name;
    ELSE
        -- Schedule retry with exponential backoff
        UPDATE graph_outbox 
        SET 
            status = 'failed',
            last_error = p_error,
            next_retry_at = now() + (power(2, v_attempts) * interval '1 second')
        WHERE id = p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

-- Update updated_at on sync_status
DROP TRIGGER IF EXISTS update_sync_status_updated_at ON graph_sync_status;
CREATE TRIGGER update_sync_status_updated_at
    BEFORE UPDATE ON graph_sync_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== COMMENTS ====================

COMMENT ON TABLE graph_outbox IS 'Transactional outbox for reliable graph sync';
COMMENT ON TABLE graph_sync_status IS 'Per-project graph synchronization status';
COMMENT ON TABLE graph_dead_letter IS 'Failed events requiring manual intervention';
COMMENT ON FUNCTION add_to_outbox IS 'Add an event to the outbox for graph sync';
COMMENT ON FUNCTION claim_outbox_batch IS 'Claim a batch of events for processing';
COMMENT ON FUNCTION complete_outbox_event IS 'Mark an outbox event as successfully processed';
COMMENT ON FUNCTION fail_outbox_event IS 'Mark an outbox event as failed with retry logic';
