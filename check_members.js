const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hoidqhdgdgvogehkjsdw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaWRxaGRnZGd2b2dlaGtqc2R3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyMjkyOCwiZXhwIjoyMDg1Mjk4OTI4fQ.DxD5MZ49GQdPEQY2c7GPi-Ej9ZPGM0tfTGwSuOyArrM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProjectMembers() {
    console.log('Checking project CGI_Link...');

    // 1. Get Project ID
    const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, name, owner_id')
        .ilike('name', '%CGI_Link%');

    if (projError) {
        console.error('Error fetching project:', projError);
        return;
    }

    if (!projects || projects.length === 0) {
        console.log('Project CGI_Link not found');
        return;
    }

    const project = projects[0];
    console.log(`Found project: ${project.name} (${project.id})`);
    console.log(`Owner ID: ${project.owner_id}`);

    // 2. Check Project Members
    const { data: members, error: memError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', project.id);

    if (memError) {
        console.error('Error fetching members:', memError);
    } else {
        console.log(`Found ${members.length} members in project_members table.`);
    }

    // 3. Check Contact Projects (the other way contacts are linked)
    const { data: contactProjects, error: cpError } = await supabase
        .from('contact_projects')
        .select('*, contacts(name)')
        .eq('project_id', project.id);

    if (cpError) {
        console.error('Error fetching contact_projects:', cpError);
    } else {
        console.log(`Found ${contactProjects.length} contacts linked in contact_projects table.`);
    }

    // 4. Check Team Profiles (used for analysis)
    const { data: teamProfiles, error: tpError } = await supabase
        .from('team_profiles')
        .select('*')
        .eq('project_id', project.id);

    if (tpError) {
        console.error('Error fetching team_profiles:', tpError);
    } else {
        console.log(`Found ${teamProfiles.length} profiles in team_profiles table.`);
        if (teamProfiles.length > 0) {
            // Log the first one to see structure without valid JSON
            console.log('Use console.dir for first object:');
            // console.dir(teamProfiles[0], { depth: null }); 
            // Just name and id
            console.log(teamProfiles.map(p => ({ id: p.id, contact_id: p.contact_id, role: p.role })).slice(0, 3));
        }
    }
}

checkProjectMembers();
