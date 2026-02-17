require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://hoidqhdgdgvogehkjsdw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaWRxaGRnZGd2b2dlaGtqc2R3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyMjkyOCwiZXhwIjoyMDg1Mjk4OTI4fQ.DxD5MZ49GQdPEQY2c7GPi-Ej9ZPGM0tfTGwSuOyArrM";

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProject() {
    console.log('Checking project 0c82618c-7e1a-4e41-87cf-22643e148715...');

    // Get raw project data
    const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', '0c82618c-7e1a-4e41-87cf-22643e148715')
        .single();

    if (error) {
        console.error('Error fetching project:', error);
        return;
    }

    console.log('Project found:', project.name);
    console.log('Settings:', JSON.stringify(project.settings, null, 2));

    if (project.settings && project.settings.roles) {
        console.log('Roles count:', project.settings.roles.length);
        project.settings.roles.forEach(r => {
            console.log(`- Role: ${r.name}, Active: ${r.active}`);
        });
    } else {
        console.log('No roles found in settings.');
    }
}

checkProject().catch(console.error);
