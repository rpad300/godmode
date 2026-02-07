#!/usr/bin/env node
/**
 * Apply role templates migration to Supabase
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Role categories
const ROLE_CATEGORIES = [
    { id: 'technical', name: 'Technical', icon: '💻', color: '#3498db', sort_order: 1 },
    { id: 'management', name: 'Management', icon: '📋', color: '#9b59b6', sort_order: 2 },
    { id: 'business', name: 'Business', icon: '💼', color: '#27ae60', sort_order: 3 },
    { id: 'design', name: 'Design', icon: '🎨', color: '#e74c3c', sort_order: 4 },
    { id: 'data', name: 'Data', icon: '📊', color: '#f39c12', sort_order: 5 },
    { id: 'support', name: 'Support', icon: '🤝', color: '#1abc9c', sort_order: 6 },
    { id: 'external', name: 'External', icon: '🌐', color: '#95a5a6', sort_order: 7 },
    { id: 'leadership', name: 'Leadership', icon: '👑', color: '#e67e22', sort_order: 8 }
];

// Role templates (from RoleTemplates.js)
const ROLE_TEMPLATES = [
    {
        id: 'tech_lead',
        title: 'Tech Lead / Architect',
        category_id: 'technical',
        icon: '🏗️',
        prompt: `Responsible for technical architecture and system design decisions.
Key focus areas:
- Code quality and technical debt management
- Technology stack decisions and evaluations
- Security and performance considerations
- Technical mentoring and code reviews
- Integration patterns and API design

I need to be informed about:
- All architectural changes and their implications
- Security vulnerabilities and fixes
- Performance bottlenecks and optimizations
- Technical risks and blockers
- New technology proposals`,
        keywords: ['architecture', 'technical', 'code', 'security', 'performance', 'api'],
        is_system: true
    },
    {
        id: 'developer',
        title: 'Software Developer',
        category_id: 'technical',
        icon: '👨‍💻',
        prompt: `Software developer focused on implementation and delivery.
Key focus areas:
- Feature implementation and bug fixes
- Code quality and testing
- Technical documentation
- Collaboration with team members

I need to be informed about:
- Task assignments and priorities
- Technical decisions that affect my work
- Code review feedback
- Deployment schedules
- API changes and breaking changes`,
        keywords: ['code', 'implementation', 'features', 'bugs', 'testing'],
        is_system: true
    },
    {
        id: 'devops',
        title: 'DevOps / Platform Engineer',
        category_id: 'technical',
        icon: '⚙️',
        prompt: `Responsible for infrastructure, CI/CD, and platform reliability.
Key focus areas:
- Infrastructure management and automation
- CI/CD pipelines and deployment processes
- Monitoring, logging, and alerting
- Security and compliance
- Cost optimization

I need to be informed about:
- Infrastructure changes and requirements
- Deployment failures and rollbacks
- Security incidents
- Performance issues and scaling needs
- Cost anomalies`,
        keywords: ['infrastructure', 'deployment', 'monitoring', 'security', 'automation'],
        is_system: true
    },
    {
        id: 'qa_engineer',
        title: 'QA Engineer',
        category_id: 'technical',
        icon: '🧪',
        prompt: `Quality assurance specialist ensuring product quality.
Key focus areas:
- Test planning and execution
- Bug tracking and regression testing
- Automation testing strategies
- Quality metrics and reporting

I need to be informed about:
- New features and their acceptance criteria
- Bug priorities and severity
- Release schedules and testing windows
- Known issues and workarounds
- Quality metrics trends`,
        keywords: ['testing', 'quality', 'bugs', 'automation', 'regression'],
        is_system: true
    },
    {
        id: 'project_manager',
        title: 'Project Manager',
        category_id: 'management',
        icon: '📊',
        prompt: `Project manager responsible for delivery and coordination.
Key focus areas:
- Project timeline and milestones
- Resource allocation and capacity
- Risk management and mitigation
- Stakeholder communication
- Budget tracking

I need to be informed about:
- Timeline risks and blockers
- Resource conflicts and availability
- Budget variances
- Scope changes and their impact
- Key decisions requiring escalation`,
        keywords: ['timeline', 'resources', 'risks', 'budget', 'milestones', 'stakeholders'],
        is_system: true
    },
    {
        id: 'product_owner',
        title: 'Product Owner / Product Manager',
        category_id: 'management',
        icon: '🎯',
        prompt: `Product owner responsible for product vision and backlog.
Key focus areas:
- Product roadmap and vision
- Feature prioritization and backlog management
- User feedback and requirements
- Market analysis and competition
- Stakeholder alignment

I need to be informed about:
- User feedback and pain points
- Feature delivery status
- Technical constraints affecting features
- Market trends and competitor moves
- Key metrics and KPIs`,
        keywords: ['product', 'features', 'users', 'roadmap', 'backlog', 'priorities'],
        is_system: true
    },
    {
        id: 'scrum_master',
        title: 'Scrum Master / Agile Coach',
        category_id: 'management',
        icon: '🔄',
        prompt: `Scrum master facilitating agile processes and team health.
Key focus areas:
- Sprint planning and retrospectives
- Team velocity and capacity
- Impediment removal
- Process improvement
- Team collaboration and communication

I need to be informed about:
- Sprint blockers and impediments
- Team morale and concerns
- Process deviations
- Meeting outcomes and action items
- Velocity trends`,
        keywords: ['sprint', 'agile', 'velocity', 'retrospective', 'impediments', 'team'],
        is_system: true
    },
    {
        id: 'business_analyst',
        title: 'Business Analyst',
        category_id: 'business',
        icon: '📈',
        prompt: `Business analyst bridging business and technical teams.
Key focus areas:
- Requirements gathering and documentation
- Process analysis and optimization
- Data analysis and reporting
- Stakeholder interviews
- Solution design

I need to be informed about:
- Business requirements and changes
- Process bottlenecks
- Data quality issues
- Stakeholder feedback
- Implementation constraints`,
        keywords: ['requirements', 'process', 'analysis', 'data', 'stakeholders'],
        is_system: true
    },
    {
        id: 'stakeholder',
        title: 'Business Stakeholder',
        category_id: 'business',
        icon: '👔',
        prompt: `Business stakeholder interested in project outcomes.
Key focus areas:
- Business value and ROI
- Project status and timeline
- Key decisions and approvals
- Risk exposure
- Budget and resources

I need to be informed about:
- High-level progress and milestones
- Decisions requiring my input
- Major risks and issues
- Budget status
- Timeline changes`,
        keywords: ['business', 'value', 'roi', 'status', 'decisions'],
        is_system: true
    },
    {
        id: 'ux_designer',
        title: 'UX/UI Designer',
        category_id: 'design',
        icon: '🎨',
        prompt: `UX/UI designer focused on user experience and interface design.
Key focus areas:
- User research and personas
- Wireframing and prototyping
- Visual design and branding
- Usability testing
- Design system maintenance

I need to be informed about:
- User feedback and usability issues
- New feature requirements
- Brand guideline changes
- Design review feedback
- Implementation constraints`,
        keywords: ['design', 'ux', 'ui', 'users', 'prototypes', 'usability'],
        is_system: true
    },
    {
        id: 'data_analyst',
        title: 'Data Analyst / Scientist',
        category_id: 'data',
        icon: '📊',
        prompt: `Data professional focused on insights and analytics.
Key focus areas:
- Data analysis and visualization
- Metrics definition and tracking
- Data quality and governance
- Reporting and dashboards
- Predictive modeling

I need to be informed about:
- Data requirements and sources
- Metric definitions and changes
- Data quality issues
- Analysis requests
- Model performance`,
        keywords: ['data', 'analytics', 'metrics', 'insights', 'reports'],
        is_system: true
    },
    {
        id: 'customer_success',
        title: 'Customer Success / Support',
        category_id: 'support',
        icon: '🤝',
        prompt: `Customer success focused on client satisfaction and retention.
Key focus areas:
- Customer onboarding and training
- Issue resolution and escalation
- Feature requests and feedback
- Customer health metrics
- Relationship management

I need to be informed about:
- Known issues affecting customers
- New features and releases
- Customer complaints and escalations
- Support ticket trends
- Documentation updates`,
        keywords: ['customers', 'support', 'feedback', 'issues', 'satisfaction'],
        is_system: true
    },
    {
        id: 'consultant',
        title: 'Consultant / Advisor',
        category_id: 'external',
        icon: '💼',
        prompt: `External consultant providing expertise and guidance.
Key focus areas:
- Strategic recommendations
- Best practices and industry standards
- Risk assessment
- Knowledge transfer
- Process improvement

I need to be informed about:
- Project context and history
- Current challenges and pain points
- Decisions requiring input
- Available resources and constraints
- Success criteria`,
        keywords: ['consulting', 'strategy', 'recommendations', 'expertise'],
        is_system: true
    },
    {
        id: 'executive',
        title: 'Executive / C-Level',
        category_id: 'leadership',
        icon: '👑',
        prompt: `Executive requiring high-level strategic overview.
Key focus areas:
- Strategic alignment and business impact
- Key metrics and KPIs
- Major risks and mitigation
- Resource and budget decisions
- Stakeholder communication

I need to be informed about:
- Executive summary of progress
- Critical risks and escalations
- Budget variances
- Key decisions requiring approval
- Strategic opportunities and threats`,
        keywords: ['strategy', 'executive', 'kpis', 'budget', 'decisions'],
        is_system: true
    }
];

async function main() {
    console.log('='.repeat(60));
    console.log('Role Templates Migration');
    console.log('='.repeat(60));

    // Step 1: Check if tables exist, create if not
    console.log('\nStep 1: Checking tables...');
    
    // Try to select from role_categories to see if it exists
    const { error: catCheckError } = await supabase
        .from('role_categories')
        .select('id')
        .limit(1);
    
    if (catCheckError && catCheckError.message.includes('does not exist')) {
        console.log('  Tables do not exist. Please run the SQL migration first:');
        console.log('  supabase/migrations/008_role_templates.sql');
        console.log('\n  Or create the tables via the Supabase dashboard.');
        process.exit(1);
    }

    // Step 2: Insert categories
    console.log('\nStep 2: Inserting categories...');
    for (const cat of ROLE_CATEGORIES) {
        const { error } = await supabase
            .from('role_categories')
            .upsert(cat, { onConflict: 'id' });
        
        if (error) {
            console.log(`  ⚠ ${cat.name}: ${error.message}`);
        } else {
            console.log(`  ✓ ${cat.name}`);
        }
    }

    // Step 3: Insert templates
    console.log('\nStep 3: Inserting templates...');
    for (const template of ROLE_TEMPLATES) {
        const { error } = await supabase
            .from('role_templates')
            .upsert(template, { onConflict: 'id' });
        
        if (error) {
            console.log(`  ⚠ ${template.title}: ${error.message}`);
        } else {
            console.log(`  ✓ ${template.title}`);
        }
    }

    // Step 4: Verify
    console.log('\nStep 4: Verifying...');
    const { data: cats, error: catError } = await supabase
        .from('role_categories')
        .select('*')
        .order('sort_order');
    
    if (catError) {
        console.log(`  ✗ Error reading categories: ${catError.message}`);
    } else {
        console.log(`  ✓ ${cats.length} categories in database`);
    }

    const { data: templates, error: templateError } = await supabase
        .from('role_templates')
        .select('*');
    
    if (templateError) {
        console.log(`  ✗ Error reading templates: ${templateError.message}`);
    } else {
        console.log(`  ✓ ${templates.length} templates in database`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration complete!');
    console.log('='.repeat(60));
}

main().catch(console.error);
