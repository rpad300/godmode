-- Migration: Add timezone and linkedin fields to contacts table

-- Add timezone column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'timezone') THEN
        ALTER TABLE contacts ADD COLUMN timezone VARCHAR(100);
    END IF;
END $$;

-- Add linkedin column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'linkedin') THEN
        ALTER TABLE contacts ADD COLUMN linkedin VARCHAR(500);
    END IF;
END $$;

-- Add photo_url column if not exists (alias for avatar_url for compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'photo_url') THEN
        ALTER TABLE contacts ADD COLUMN photo_url VARCHAR(500);
    END IF;
END $$;

-- Add role_context column for AI prompts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'role_context') THEN
        ALTER TABLE contacts ADD COLUMN role_context TEXT;
    END IF;
END $$;

COMMENT ON COLUMN contacts.timezone IS 'IANA timezone identifier (e.g., Europe/Lisbon)';
COMMENT ON COLUMN contacts.linkedin IS 'LinkedIn profile URL';
COMMENT ON COLUMN contacts.role_context IS 'AI prompt context describing the contact role and expertise';
