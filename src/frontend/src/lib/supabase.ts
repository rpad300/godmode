/**
 * Purpose:
 *   Creates and exports the singleton Supabase client used for authentication
 *   and direct database access throughout the frontend.
 *
 * Responsibilities:
 *   - Read Supabase URL and anon key from Vite env variables
 *   - Warn (rather than crash) when env vars are missing so the app can
 *     still render a login/error screen
 *
 * Key dependencies:
 *   - @supabase/supabase-js: createClient
 *
 * Side effects:
 *   - Logs a console warning if URL or anon key is not configured
 *
 * Notes:
 *   - Two env variable naming patterns are supported (VITE_SUPABASE_URL and
 *     VITE_SUPABASE_PROJECT_URL) for deployment flexibility.
 *   - The anon key only grants access scoped by Supabase RLS policies.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PROJECT_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Authentication will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
