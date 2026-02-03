-- Migration: 019_emails.sql
-- Description: Store emails for processing, entity extraction, and response generation
-- Date: 2026-01-30

-- ============================================
-- EMAILS TABLE
-- Stores inbound/outbound emails with extracted entities
-- ============================================
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Email Headers
    subject TEXT,
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[],           -- Array of recipient emails
    to_names TEXT[],            -- Array of recipient names (parallel to to_emails)
    cc_emails TEXT[],
    cc_names TEXT[],
    bcc_emails TEXT[],
    date_sent TIMESTAMPTZ,
    
    -- Threading
    message_id TEXT,            -- RFC Message-ID for threading
    in_reply_to TEXT,           -- Parent email message_id
    thread_id TEXT,             -- Computed thread identifier
    
    -- Content
    body_text TEXT,             -- Plain text body
    body_html TEXT,             -- HTML body (if available)
    
    -- Direction and Status
    direction TEXT DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound', 'internal')),
    requires_response BOOLEAN DEFAULT false,
    response_drafted BOOLEAN DEFAULT false,
    response_sent BOOLEAN DEFAULT false,
    
    -- Extracted Data (AI-generated)
    extracted_entities JSONB,   -- { facts: [], questions: [], action_items: [], etc. }
    ai_summary TEXT,            -- AI-generated summary of the email
    detected_intent TEXT,       -- request, information, question, action_needed, etc.
    sentiment TEXT,             -- positive, neutral, negative, urgent
    
    -- Linked Contacts
    sender_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Source tracking
    source_type TEXT DEFAULT 'paste' CHECK (source_type IN ('paste', 'eml_upload', 'api', 'imap')),
    original_filename TEXT,     -- For .eml uploads
    
    -- Response
    draft_response TEXT,        -- AI-generated draft response
    draft_generated_at TIMESTAMPTZ,
    
    -- Attachments (stored as documents)
    attachment_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ      -- Soft delete
);

-- ============================================
-- EMAIL ATTACHMENTS JUNCTION TABLE
-- Links emails to their attachments (stored as documents)
-- ============================================
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    filename TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(email_id, document_id)
);

-- ============================================
-- EMAIL RECIPIENTS JUNCTION TABLE
-- Links emails to contacts (recipients)
-- ============================================
CREATE TABLE IF NOT EXISTS email_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('to', 'cc', 'bcc')),
    email_address TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(email_id, email_address, recipient_type)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_emails_project ON emails(project_id);
CREATE INDEX IF NOT EXISTS idx_emails_project_date ON emails(project_id, date_sent DESC);
CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_requires_response ON emails(project_id, requires_response) WHERE requires_response = true;
CREATE INDEX IF NOT EXISTS idx_emails_sender_contact ON emails(sender_contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_deleted ON emails(project_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_attachments_email ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_document ON email_attachments(document_id);

CREATE INDEX IF NOT EXISTS idx_email_recipients_email ON email_recipients(email_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_contact ON email_recipients(contact_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;

-- Emails policies
CREATE POLICY "Users can manage emails in their projects" ON emails
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM project_members WHERE project_id = emails.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Service role full access to emails" ON emails
    FOR ALL USING (auth.role() = 'service_role');

-- Email attachments policies
CREATE POLICY "Users can manage email attachments in their projects" ON email_attachments
    FOR ALL USING (
        email_id IN (
            SELECT id FROM emails WHERE 
            project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM project_members WHERE project_id = emails.project_id AND user_id = auth.uid())
        )
    );

CREATE POLICY "Service role full access to email_attachments" ON email_attachments
    FOR ALL USING (auth.role() = 'service_role');

-- Email recipients policies
CREATE POLICY "Users can manage email recipients in their projects" ON email_recipients
    FOR ALL USING (
        email_id IN (
            SELECT id FROM emails WHERE 
            project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM project_members WHERE project_id = emails.project_id AND user_id = auth.uid())
        )
    );

CREATE POLICY "Service role full access to email_recipients" ON email_recipients
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS emails_updated_at ON emails;
CREATE TRIGGER emails_updated_at
    BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE emails IS 'Stores emails for processing, entity extraction, and AI-powered response generation';
COMMENT ON TABLE email_attachments IS 'Links emails to their attachments stored as documents';
COMMENT ON TABLE email_recipients IS 'Links emails to recipient contacts with recipient type (to/cc/bcc)';
COMMENT ON COLUMN emails.extracted_entities IS 'AI-extracted entities: facts, questions, action_items, decisions, risks';
COMMENT ON COLUMN emails.detected_intent IS 'AI-detected intent: request, information, question, action_needed, follow_up';
