-- ============================================
-- Migration 020: Add missing user profile fields
-- ============================================
-- Adds bio, timezone, and locale fields to user_profiles table
-- to support the Profile Settings modal

-- Add bio field for user biography
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add timezone field (e.g., 'Europe/Lisbon', 'UTC')
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add locale field for user language preference (e.g., 'en', 'pt', 'es')
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';

-- Comment on new columns
COMMENT ON COLUMN user_profiles.bio IS 'User biography or description';
COMMENT ON COLUMN user_profiles.timezone IS 'User timezone (IANA format, e.g., Europe/Lisbon)';
COMMENT ON COLUMN user_profiles.locale IS 'User locale/language preference (ISO 639-1, e.g., en, pt, es)';
