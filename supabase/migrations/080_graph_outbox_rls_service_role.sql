-- Restrict graph_outbox RLS to service_role only
-- Previously "Service manages outbox" used USING (TRUE) for all roles, allowing
-- anon/authenticated to see all projects' outbox rows. Segregation fix.

DROP POLICY IF EXISTS "Service manages outbox" ON graph_outbox;
CREATE POLICY "Service manages outbox" ON graph_outbox
    FOR ALL TO service_role USING (true);
