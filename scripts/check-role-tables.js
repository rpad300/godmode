#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', 'src', '.env');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.+?)"?\s*$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    });
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    console.log('Checking role tables in Supabase...\n');
    
    // Check categories
    const { data: cats, error: catError } = await supabase
        .from('role_categories')
        .select('*');
    
    console.log('=== CATEGORIES ===');
    if (catError) {
        console.log('Error:', catError.message);
    } else {
        console.log(JSON.stringify(cats, null, 2));
    }
    
    // Check templates
    const { data: templates, error: templateError } = await supabase
        .from('role_templates')
        .select('*');
    
    console.log('\n=== TEMPLATES ===');
    if (templateError) {
        console.log('Error:', templateError.message);
    } else {
        console.log(JSON.stringify(templates, null, 2));
    }
}

main().catch(console.error);
