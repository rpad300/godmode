-- Migration: 057_graph_v3_schema.sql
-- Description: Enforces Schema V3 for Professional Knowledge Graph
-- Includes: FK columns, Indexes, Unique Constraints, and RPC functions

-- 1.1 Add Contact FK Columns to Knowledge Entities
-- These columns store the reliable link to a Contact, separate from the text "owner" field.

ALTER TABLE public.action_items 
ADD COLUMN IF NOT EXISTS owner_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.action_items 
ADD COLUMN IF NOT EXISTS requested_by_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.decisions 
ADD COLUMN IF NOT EXISTS owner_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.decisions 
ADD COLUMN IF NOT EXISTS made_by_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.decisions 
ADD COLUMN IF NOT EXISTS approved_by_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.risks 
ADD COLUMN IF NOT EXISTS owner_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.knowledge_questions 
ADD COLUMN IF NOT EXISTS assigned_to_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.knowledge_questions 
ADD COLUMN IF NOT EXISTS answered_by_contact_id uuid REFERENCES public.contacts(id);

ALTER TABLE public.user_stories 
ADD COLUMN IF NOT EXISTS requested_by_contact_id uuid REFERENCES public.contacts(id);

-- 1.2 Unique Constraint for Sync Status
-- Ensures one status record per project+graph pair

ALTER TABLE public.graph_sync_status
DROP CONSTRAINT IF EXISTS graph_sync_status_project_graph_unique;

ALTER TABLE public.graph_sync_status
ADD CONSTRAINT graph_sync_status_project_graph_unique
UNIQUE (project_id, graph_name);

-- 1.3 Performance Indexes
-- Optimize graph traversals and lookups

CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_graph
ON public.graph_nodes (project_id, graph_name);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_label 
ON public.graph_nodes (label);

CREATE INDEX IF NOT EXISTS idx_graph_rels_project_graph
ON public.graph_relationships (project_id, graph_name);

CREATE INDEX IF NOT EXISTS idx_graph_rels_from
ON public.graph_relationships (from_id);

CREATE INDEX IF NOT EXISTS idx_graph_rels_to
ON public.graph_relationships (to_id);

CREATE INDEX IF NOT EXISTS idx_graph_rels_type
ON public.graph_relationships (type);

-- 1.4 RPC Function for Semantic Neighbors
-- Finds nodes semantically similar to a given entity

CREATE OR REPLACE FUNCTION find_semantic_neighbors(
  p_entity_id uuid,
  p_project_id uuid,
  p_threshold float DEFAULT 0.78,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e2.entity_type,
    e2.entity_id,
    e2.content,
    (1 - (e1.embedding <=> e2.embedding))::float as similarity
  FROM embeddings e1
  JOIN embeddings e2
    ON e1.project_id = e2.project_id
    AND e1.entity_id != e2.entity_id
  WHERE e1.entity_id = p_entity_id
    AND e1.project_id = p_project_id
    AND e2.project_id = p_project_id
    AND (1 - (e1.embedding <=> e2.embedding)) > p_threshold
  ORDER BY similarity DESC
  LIMIT p_limit;
$$;

-- 1.5 Backfill Text Extraction (Optional / Manual Trigger)
-- This is a placeholder. The actual backfill happens via the GraphRAGEngine sync process.

COMMENT ON TABLE public.graph_nodes IS 'Materialized graph nodes for knowledge graph v3';
COMMENT ON TABLE public.graph_relationships IS 'Materialized graph edges for knowledge graph v3';
