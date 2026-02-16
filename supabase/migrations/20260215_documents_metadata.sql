-- Add metadata column to documents table for Google Drive sync tracking
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster lookups by drive_file_id
CREATE INDEX IF NOT EXISTS idx_documents_metadata_drive_id ON documents((metadata->>'drive_file_id'));
