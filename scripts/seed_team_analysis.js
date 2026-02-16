require('dotenv').config({ path: 'src/.env' });
const { getAdminClient } = require('../src/supabase/client');
const { logger } = require('../src/logger');

// Usage: node scripts/seed_team_analysis.js [project_id]

async function seedTeamAnalysis() {
    const supabase = getAdminClient();
    // Default to the ID found in logs or arguments
    const projectId = process.argv[2] || '4a46377e-eff7-4206-8ff4-9e2a12e469dc';

    console.log(`Seeding Team Analysis for project: ${projectId}`);

    // VALIDATE PROJECT EXISTS
    const { data: project, error: projError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

    if (projError || !project) {
        console.error('Project not found!', projError);
        return;
    }

    // 1. Create dummy contacts if they don't exist
    const contacts = [
        { name: 'Alice Chen', role: 'Frontend Lead', organization: 'TechCorp' },
        { name: 'Bob Smith', role: 'Backend Engineer', organization: 'TechCorp' },
        { name: 'Carol Danvers', role: 'Product Manager', organization: 'TechCorp' }
    ];

    const contactIds = [];

    for (const c of contacts) {
        // Check for existing contact
        const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('project_id', projectId)
            .ilike('name', c.name)
            .maybeSingle();

        if (existing) {
            contactIds.push(existing.id);
            console.log(`Found existing contact: ${c.name} (${existing.id})`);
        } else {
            console.log(`Creating contact: ${c.name}`);
            const { data: newContact, error } = await supabase
                .from('contacts')
                .insert({
                    project_id: projectId,
                    name: c.name,
                    role: c.role,
                    organization: c.organization,
                    email: `${c.name.toLowerCase().replace(' ', '.')}@example.com`
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating contact:', error);
            } else {
                contactIds.push(newContact.id);
            }
        }
    }

    console.log('Contacts ensured:', contactIds);

    // 2. Create Team Profiles (Mock Analysis)
    console.log('Seeding profiles...');
    for (const contactId of contactIds) {
        const profileData = {
            communication_identity: { dominant_style: 'Analytic', secondary_style: 'Driver' },
            motivations_and_priorities: { values_most: ['Accuracy', 'Efficiency'], avoids: ['Chaos'] },
            behavior_under_pressure: ['Withdraws to think', 'Becomes critical'],
            influence_tactics: ['Logical argument', 'Data-driven presentation'],
            collaboration_style: { preferred_mode: 'Async', strengths: ['Deep work'], areas_for_improvement: ['Real-time brainstorming'] },
            key_new_evidence: []
        };

        const { error } = await supabase
            .from('team_profiles')
            .upsert({
                project_id: projectId,
                contact_id: contactId,
                profile_data: profileData,
                confidence_level: 'high',
                last_analysis_at: new Date().toISOString(),
                transcripts_analyzed: [], // Mocking no source transcripts for now
                transcript_count: 0,
                communication_style: 'Analytic',
                dominant_motivation: 'Accuracy',
                influence_score: 85,
                total_speaking_time_seconds: 1200
            }, { onConflict: 'project_id, contact_id' });

        if (error) console.error('Error seeding profile:', error);
    }

    console.log('Team Profiles seeded.');

    // 3. Create Team Analysis Record
    console.log('Seeding team analysis record...');
    const analysisData = {
        cohesion_score: 85,
        tension_level: 'low',
        dominant_communication_pattern: 'Structured and efficient',
        influence_map: [
            { source: contactIds[0], target: contactIds[1], strength: 'high', type: 'technical_guidance' }
        ],
        alliances: [],
        tensions: []
    };

    const { error: analysisError } = await supabase
        .from('team_analysis')
        .upsert({
            project_id: projectId,
            analysis_data: analysisData,
            team_size: contactIds.length,
            members_included: contactIds,
            last_analysis_at: new Date().toISOString(),
            cohesion_score: 85,
            tension_level: 'low',
            dominant_communication_pattern: 'Structured and efficient'
        }, { onConflict: 'project_id' });

    if (analysisError) {
        console.error('Error seeding team analysis:', analysisError);
    } else {
        console.log('Team Analysis seeded successfully.');
    }
}

seedTeamAnalysis().catch(console.error);
