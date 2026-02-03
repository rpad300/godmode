-- ============================================
-- Migration 028: Fix documents status constraint
-- Add 'processed' as valid status value
-- ============================================

-- Drop existing constraint and add new one with 'processed'
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check 
  CHECK (status IN ('pending', 'processing', 'processed', 'completed', 'failed'));

-- Update storage.js logic: set processed_at when status is 'processed' OR 'completed'
-- This is handled in application code, but we ensure existing data is correct

-- Update any documents with 'completed' status to also have processed_at set
UPDATE documents 
SET processed_at = updated_at 
WHERE status = 'completed' AND processed_at IS NULL;

-- Update any documents with 'processed' status to also have processed_at set
UPDATE documents 
SET processed_at = updated_at 
WHERE status = 'processed' AND processed_at IS NULL;

-- Add comment
COMMENT ON COLUMN documents.status IS 'Document processing status: pending, processing, processed, completed, failed';
