-- ============================================
-- GodMode Phase 3: Comments, Mentions & Notifications
-- ============================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create update_updated_at function (if not exists from migration 001)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== COMMENTS ====================
-- Comments can be attached to any entity (facts, questions, documents)

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Target entity (polymorphic reference)
    target_type TEXT NOT NULL CHECK (target_type IN ('fact', 'question', 'document', 'entity', 'relation')),
    target_id TEXT NOT NULL,  -- Can be UUID or legacy ID
    
    -- Comment content
    content TEXT NOT NULL,
    content_html TEXT,  -- Rendered HTML with mentions
    
    -- Threading
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    thread_depth INTEGER DEFAULT 0,
    
    -- Metadata
    is_edited BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(project_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- ==================== MENTIONS ====================
-- Track @mentions in comments

CREATE TABLE IF NOT EXISTS mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id);

-- ==================== NOTIFICATIONS ====================
-- User notifications for mentions, replies, etc.

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Notification type
    type TEXT NOT NULL CHECK (type IN (
        'mention',           -- Someone mentioned you
        'reply',             -- Reply to your comment
        'comment',           -- New comment on item you follow
        'invite',            -- Project invite
        'invite_accepted',   -- Someone accepted your invite
        'role_changed',      -- Your role was changed
        'content_updated',   -- Content you're watching was updated
        'system'             -- System notification
    )),
    
    -- Content
    title TEXT NOT NULL,
    body TEXT,
    
    -- Reference
    reference_type TEXT,  -- 'comment', 'invite', 'content', etc.
    reference_id TEXT,    -- ID of the referenced item
    
    -- Actor (who triggered this notification)
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- State
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Email
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ==================== WATCHED ITEMS ====================
-- Users can watch/follow specific items to get notifications

CREATE TABLE IF NOT EXISTS watched_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- What to watch
    target_type TEXT NOT NULL CHECK (target_type IN ('fact', 'question', 'document', 'entity', 'project')),
    target_id TEXT NOT NULL,
    
    -- Notification preferences
    notify_comments BOOLEAN DEFAULT TRUE,
    notify_updates BOOLEAN DEFAULT TRUE,
    notify_mentions BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(user_id, project_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_watched_user ON watched_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_target ON watched_items(project_id, target_type, target_id);

-- ==================== RLS POLICIES ====================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_items ENABLE ROW LEVEL SECURITY;

-- Comments: Members can view, authors can edit their own
DROP POLICY IF EXISTS "Members view comments" ON comments;
CREATE POLICY "Members view comments" ON comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = comments.project_id 
            AND project_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members create comments" ON comments;
CREATE POLICY "Members create comments" ON comments
    FOR INSERT WITH CHECK (
        auth.uid() = author_id AND
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = comments.project_id 
            AND project_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authors edit own comments" ON comments;
CREATE POLICY "Authors edit own comments" ON comments
    FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete own comments" ON comments;
CREATE POLICY "Authors delete own comments" ON comments
    FOR DELETE USING (auth.uid() = author_id);

-- Admins can manage all comments
DROP POLICY IF EXISTS "Admins manage comments" ON comments;
CREATE POLICY "Admins manage comments" ON comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = comments.project_id 
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('owner', 'admin')
        )
    );

-- Mentions: Viewable by mentioned user or comment viewers
DROP POLICY IF EXISTS "View mentions" ON mentions;
CREATE POLICY "View mentions" ON mentions
    FOR SELECT USING (
        mentioned_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM comments 
            JOIN project_members ON project_members.project_id = comments.project_id
            WHERE comments.id = mentions.comment_id 
            AND project_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Create mentions" ON mentions;
CREATE POLICY "Create mentions" ON mentions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM comments 
            WHERE comments.id = mentions.comment_id 
            AND comments.author_id = auth.uid()
        )
    );

-- Notifications: Users see only their own
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System creates notifications" ON notifications;
CREATE POLICY "System creates notifications" ON notifications
    FOR INSERT WITH CHECK (TRUE);  -- Service role only in practice

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Watched items: Users manage their own
DROP POLICY IF EXISTS "Users manage watched items" ON watched_items;
CREATE POLICY "Users manage watched items" ON watched_items
    FOR ALL USING (user_id = auth.uid());

-- ==================== TRIGGERS ====================

-- Update updated_at on comments
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== FUNCTIONS ====================

-- Function to extract mentions from comment content
CREATE OR REPLACE FUNCTION extract_mentions(content TEXT)
RETURNS TEXT[] AS $$
DECLARE
    mentions TEXT[];
BEGIN
    -- Extract @username patterns
    SELECT ARRAY(
        SELECT DISTINCT lower(m[1])
        FROM regexp_matches(content, '@([a-zA-Z0-9_]+)', 'g') AS m
    ) INTO mentions;
    
    RETURN COALESCE(mentions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_project_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (
        user_id, project_id, type, title, body,
        reference_type, reference_id, actor_id
    ) VALUES (
        p_user_id, p_project_id, p_type, p_title, p_body,
        p_reference_type, p_reference_id, p_actor_id
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== COMMENTS ====================

COMMENT ON TABLE comments IS 'Comments on facts, questions, documents, etc.';
COMMENT ON TABLE mentions IS 'User mentions within comments';
COMMENT ON TABLE notifications IS 'User notifications for various events';
COMMENT ON TABLE watched_items IS 'Items users are watching for updates';
