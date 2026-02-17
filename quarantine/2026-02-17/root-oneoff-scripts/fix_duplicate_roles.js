const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://hoidqhdgdgvogehkjsdw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaWRxaGRnZGd2b2dlaGtqc2R3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyMjkyOCwiZXhwIjoyMDg1Mjk4OTI4fQ.DxD5MZ49GQdPEQY2c7GPi-Ej9ZPGM0tfTGwSuOyArrM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanRoles() {
    const projectId = '0c82618c-7e1a-4e41-87cf-22643e148715';
    console.log(`Cleaning roles for project ${projectId}...`);

    // Get project
    const { data: project, error } = await supabase
        .from('projects')
        .select('settings')
        .eq('id', projectId)
        .single();

    if (error) {
        console.error('Error fetching project:', error);
        return;
    }

    if (!project.settings || !project.settings.roles) {
        console.log('No roles to clean.');
        return;
    }

    const roles = project.settings.roles;
    console.log(`Found ${roles.length} roles.`);

    // Deduplicate by name
    const uniqueRolesMap = new Map();
    const uniqueRoles = [];

    roles.forEach(role => {
        if (!uniqueRolesMap.has(role.name)) {
            uniqueRolesMap.set(role.name, true);
            uniqueRoles.push(role);
        } else {
            // If duplicate, prefer the one that is active?
            // Actually, just keeping the first one found (chronological usually) is enough,
            // but we might want to ensure we keep an ACTIVE one if possible.
            const existing = uniqueRoles.find(r => r.name === role.name);
            if (!existing.active && role.active) {
                existing.active = true; // Upgrade to active
            }
        }
    });

    console.log(`Reduced to ${uniqueRoles.length} unique roles.`);

    // Update DB
    const { error: updateError } = await supabase
        .from('projects')
        .update({
            settings: {
                ...project.settings,
                roles: uniqueRoles
            }
        })
        .eq('id', projectId);

    if (updateError) {
        console.error('Error updating roles:', updateError);
    } else {
        console.log('Successfully cleaned duplicate roles.');
    }
}

cleanRoles().catch(console.error);
