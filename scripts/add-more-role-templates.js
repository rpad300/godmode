#!/usr/bin/env node
/**
 * Add more role templates to Supabase (using existing schema)
 */

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

// Additional templates to add (matching existing schema)
const NEW_TEMPLATES = [
    {
        name: 'developer',
        display_name: 'Software Developer',
        description: 'Implementation, code quality, and delivery',
        prompt_template: 'You are a Software Developer focused on implementation details, code quality, testing, and delivery timelines.',
        focus_areas: ['code', 'implementation', 'features', 'bugs', 'testing'],
        category: 'technical',
        is_builtin: true,
        is_active: true
    },
    {
        name: 'devops',
        display_name: 'DevOps / Platform Engineer',
        description: 'Infrastructure, CI/CD, and reliability',
        prompt_template: 'You are a DevOps Engineer focused on infrastructure, CI/CD pipelines, monitoring, and system reliability.',
        focus_areas: ['infrastructure', 'deployment', 'monitoring', 'security', 'automation'],
        category: 'technical',
        is_builtin: true,
        is_active: true
    },
    {
        name: 'qa_engineer',
        display_name: 'QA Engineer',
        description: 'Testing, quality assurance, and bug tracking',
        prompt_template: 'You are a QA Engineer focused on test planning, quality metrics, bug tracking, and regression testing.',
        focus_areas: ['testing', 'quality', 'bugs', 'automation', 'regression'],
        category: 'technical',
        is_builtin: true,
        is_active: true
    },
    {
        name: 'product_owner',
        display_name: 'Product Owner / Product Manager',
        description: 'Product vision, roadmap, and backlog',
        prompt_template: 'You are a Product Owner focused on product vision, feature prioritization, user feedback, and backlog management.',
        focus_areas: ['product', 'features', 'users', 'roadmap', 'backlog', 'priorities'],
        category: 'management',
        is_builtin: true,
        is_active: true
    },
    {
        name: 'scrum_master',
        display_name: 'Scrum Master / Agile Coach',
        description: 'Agile processes, sprint management, and team health',
        prompt_template: 'You are a Scrum Master focused on sprint planning, retrospectives, team velocity, and removing impediments.',
        focus_areas: ['sprint', 'agile', 'velocity', 'retrospective', 'impediments', 'team'],
        category: 'management',
        is_builtin: true,
        is_active: true
    },
    {
        name: 'ux_designer',
        display_name: 'UX/UI Designer',
        description: 'User experience, interface design, and usability',
        prompt_template: 'You are a UX/UI Designer focused on user research, wireframing, prototyping, and usability testing.',
        focus_areas: ['design', 'ux', 'ui', 'users', 'prototypes', 'usability'],
        category: 'technical',  // Using 'technical' as 'design' is not in allowed categories
        is_builtin: true,
        is_active: true
    },
    {
        name: 'data_analyst',
        display_name: 'Data Analyst / Scientist',
        description: 'Data analysis, metrics, and insights',
        prompt_template: 'You are a Data Analyst focused on data analysis, metrics tracking, visualization, and predictive modeling.',
        focus_areas: ['data', 'analytics', 'metrics', 'insights', 'reports'],
        category: 'operations',  // Using 'operations' as 'data' is not in allowed categories
        is_builtin: true,
        is_active: true
    },
    {
        name: 'customer_success',
        display_name: 'Customer Success / Support',
        description: 'Customer satisfaction, support, and retention',
        prompt_template: 'You are a Customer Success Manager focused on customer onboarding, issue resolution, and retention.',
        focus_areas: ['customers', 'support', 'feedback', 'issues', 'satisfaction'],
        category: 'operations',
        is_builtin: true,
        is_active: true
    },
    {
        name: 'consultant',
        display_name: 'Consultant / Advisor',
        description: 'Strategic guidance and best practices',
        prompt_template: 'You are a Consultant focused on strategic recommendations, best practices, and knowledge transfer.',
        focus_areas: ['consulting', 'strategy', 'recommendations', 'expertise'],
        category: 'management',  // Using 'management' as 'business' is not in allowed categories
        is_builtin: true,
        is_active: true
    },
    {
        name: 'stakeholder',
        display_name: 'Business Stakeholder',
        description: 'Business outcomes, ROI, and high-level status',
        prompt_template: 'You are a Business Stakeholder focused on business value, ROI, project status, and key decisions.',
        focus_areas: ['business', 'value', 'roi', 'status', 'decisions'],
        category: 'executive',  // Using 'executive' as 'business' is not in allowed categories
        is_builtin: true,
        is_active: true
    }
];

async function main() {
    console.log('='.repeat(60));
    console.log('Adding More Role Templates');
    console.log('='.repeat(60));

    for (const template of NEW_TEMPLATES) {
        // Check if exists
        const { data: existing } = await supabase
            .from('role_templates')
            .select('id')
            .eq('name', template.name)
            .single();

        if (existing) {
            console.log(`  - ${template.display_name}: Already exists, skipping`);
            continue;
        }

        const { error } = await supabase
            .from('role_templates')
            .insert(template);
        
        if (error) {
            console.log(`  ✗ ${template.display_name}: ${error.message}`);
        } else {
            console.log(`  ✓ ${template.display_name}`);
        }
    }

    // Verify
    const { data: all } = await supabase
        .from('role_templates')
        .select('display_name, category')
        .eq('is_active', true)
        .order('category');

    console.log('\n' + '='.repeat(60));
    console.log(`Total templates: ${all?.length || 0}`);
    console.log('='.repeat(60));
    
    if (all) {
        const grouped = {};
        all.forEach(t => {
            if (!grouped[t.category]) grouped[t.category] = [];
            grouped[t.category].push(t.display_name);
        });
        
        Object.entries(grouped).forEach(([cat, templates]) => {
            console.log(`\n${cat.toUpperCase()}:`);
            templates.forEach(t => console.log(`  - ${t}`));
        });
    }
}

main().catch(console.error);
