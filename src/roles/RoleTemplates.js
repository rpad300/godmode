/**
 * Role Templates
 * Pre-defined role prompts for common roles
 * Now supports loading from Supabase with local fallback
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'role-templates' });

// Supabase client (lazy loaded)
let supabaseClient = null;

function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    
    try {
        const { createClient } = require('@supabase/supabase-js');
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;
        
        if (SUPABASE_URL && SUPABASE_KEY) {
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false }
            });
        }
    } catch (e) {
        log.warn({ event: 'role_templates_supabase_unavailable', reason: e.message }, 'Supabase not available');
    }
    
    return supabaseClient;
}

// Default templates (fallback)
const ROLE_TEMPLATES = {
    // Technical Roles
    'tech_lead': {
        title: 'Tech Lead / Architect',
        category: 'technical',
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
        keywords: ['architecture', 'technical', 'code', 'security', 'performance', 'api']
    },
    
    'developer': {
        title: 'Software Developer',
        category: 'technical',
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
        keywords: ['code', 'implementation', 'features', 'bugs', 'testing']
    },
    
    'devops': {
        title: 'DevOps / Platform Engineer',
        category: 'technical',
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
        keywords: ['infrastructure', 'deployment', 'monitoring', 'security', 'automation']
    },
    
    'qa_engineer': {
        title: 'QA Engineer',
        category: 'technical',
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
        keywords: ['testing', 'quality', 'bugs', 'automation', 'regression']
    },
    
    // Management Roles
    'project_manager': {
        title: 'Project Manager',
        category: 'management',
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
        keywords: ['timeline', 'resources', 'risks', 'budget', 'milestones', 'stakeholders']
    },
    
    'product_owner': {
        title: 'Product Owner / Product Manager',
        category: 'management',
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
        keywords: ['product', 'features', 'users', 'roadmap', 'backlog', 'priorities']
    },
    
    'scrum_master': {
        title: 'Scrum Master / Agile Coach',
        category: 'management',
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
        keywords: ['sprint', 'agile', 'velocity', 'retrospective', 'impediments', 'team']
    },
    
    // Business Roles
    'business_analyst': {
        title: 'Business Analyst',
        category: 'business',
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
        keywords: ['requirements', 'process', 'analysis', 'data', 'stakeholders']
    },
    
    'stakeholder': {
        title: 'Business Stakeholder',
        category: 'business',
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
        keywords: ['business', 'value', 'roi', 'status', 'decisions']
    },
    
    // Design Roles
    'ux_designer': {
        title: 'UX/UI Designer',
        category: 'design',
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
        keywords: ['design', 'ux', 'ui', 'users', 'prototypes', 'usability']
    },
    
    // Data Roles
    'data_analyst': {
        title: 'Data Analyst / Scientist',
        category: 'data',
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
        keywords: ['data', 'analytics', 'metrics', 'insights', 'reports']
    },
    
    // Support Roles
    'customer_success': {
        title: 'Customer Success / Support',
        category: 'support',
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
        keywords: ['customers', 'support', 'feedback', 'issues', 'satisfaction']
    },
    
    // Custom/Generic
    'consultant': {
        title: 'Consultant / Advisor',
        category: 'external',
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
        keywords: ['consulting', 'strategy', 'recommendations', 'expertise']
    },
    
    'executive': {
        title: 'Executive / C-Level',
        category: 'leadership',
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
        keywords: ['strategy', 'executive', 'kpis', 'budget', 'decisions']
    }
};

// Categories for grouping
const ROLE_CATEGORIES = {
    technical: { name: 'Technical', icon: '💻', color: '#3498db' },
    management: { name: 'Management', icon: '📋', color: '#9b59b6' },
    business: { name: 'Business', icon: '💼', color: '#27ae60' },
    design: { name: 'Design', icon: '🎨', color: '#e74c3c' },
    data: { name: 'Data', icon: '📊', color: '#f39c12' },
    support: { name: 'Support', icon: '🤝', color: '#1abc9c' },
    external: { name: 'External', icon: '🌐', color: '#95a5a6' },
    leadership: { name: 'Leadership', icon: '👑', color: '#e67e22' }
};

class RoleTemplates {
    constructor() {
        this.templates = ROLE_TEMPLATES;
        this.categories = ROLE_CATEGORIES;
        this._supabaseTemplates = null;
        this._supabaseCategories = null;
        this._loaded = false;
    }

    /**
     * Load templates from Supabase
     */
    async loadFromSupabase() {
        if (this._loaded) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            this._loaded = true;
            return;
        }

        try {
            // Load templates from Supabase (existing schema)
            // Schema: id, name, display_name, description, prompt_template, focus_areas, category, is_builtin, is_active
            const { data: templates, error: templateError } = await supabase
                .from('role_templates')
                .select('*')
                .eq('is_active', true);
            
            if (!templateError && templates?.length > 0) {
                this._supabaseTemplates = {};
                templates.forEach(t => {
                    // Map Supabase schema to our expected format
                    this._supabaseTemplates[t.name || t.id] = {
                        title: t.display_name || t.name,
                        category: t.category || 'technical',
                        icon: t.icon || this._getCategoryIcon(t.category),
                        prompt: t.prompt_template || t.description || '',
                        keywords: t.focus_areas || [],
                        description: t.description
                    };
                });
                log.debug({ event: 'role_templates_loaded', count: templates.length }, 'Loaded templates from Supabase');
            }
            
            // Try to load categories if they exist
            try {
                const { data: cats, error: catError } = await supabase
                    .from('role_categories')
                    .select('*');
                
                if (!catError && cats?.length > 0) {
                    this._supabaseCategories = {};
                    cats.forEach(cat => {
                        this._supabaseCategories[cat.id] = {
                            name: cat.name,
                            icon: cat.icon,
                            color: cat.color
                        };
                    });
                }
            } catch (e) {
                // Categories table might not exist, use defaults
            }
        } catch (e) {
            log.warn({ event: 'role_templates_load_error', reason: e.message }, 'Error loading from Supabase');
        }
        
        this._loaded = true;
    }

    /**
     * Get default icon for a category
     */
    _getCategoryIcon(category) {
        const icons = {
            'technical': '💻',
            'management': '📋',
            'business': '💼',
            'executive': '👑',
            'operations': '⚙️',
            'design': '🎨',
            'data': '📊',
            'support': '🤝'
        };
        return icons[category] || '👤';
    }

    /**
     * Get effective templates (Supabase or fallback)
     */
    _getTemplates() {
        return this._supabaseTemplates || this.templates;
    }

    /**
     * Get effective categories (Supabase or fallback)
     */
    _getCategories() {
        return this._supabaseCategories || this.categories;
    }

    /**
     * Get all templates
     */
    getAll() {
        const templates = this._getTemplates();
        const categories = this._getCategories();
        
        return Object.entries(templates).map(([id, template]) => ({
            id,
            ...template,
            categoryInfo: categories[template.category]
        }));
    }

    /**
     * Get templates by category
     */
    getByCategory(category) {
        return this.getAll().filter(t => t.category === category);
    }

    /**
     * Get a specific template
     */
    get(id) {
        const templates = this._getTemplates();
        const categories = this._getCategories();
        const template = templates[id];
        if (!template) return null;
        return {
            id,
            ...template,
            categoryInfo: categories[template.category]
        };
    }

    /**
     * Get all categories
     */
    getCategories() {
        const categories = this._getCategories();
        return Object.entries(categories).map(([id, cat]) => ({
            id,
            ...cat,
            templateCount: this.getByCategory(id).length
        }));
    }

    /**
     * Search templates by keyword
     */
    search(query) {
        const q = query.toLowerCase();
        return this.getAll().filter(t => 
            t.title.toLowerCase().includes(q) ||
            t.prompt.toLowerCase().includes(q) ||
            (t.keywords || []).some(k => k.includes(q))
        );
    }

    /**
     * Suggest templates based on existing role title
     */
    suggestFromTitle(roleTitle) {
        if (!roleTitle) return this.getAll().slice(0, 5);
        
        const title = roleTitle.toLowerCase();
        const scores = this.getAll().map(t => {
            let score = 0;
            
            // Title match
            if (t.title.toLowerCase().includes(title)) score += 10;
            if (title.includes(t.title.toLowerCase())) score += 8;
            
            // Keyword match
            (t.keywords || []).forEach(k => {
                if (title.includes(k)) score += 3;
            });
            
            return { template: t, score };
        });
        
        return scores
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(s => s.template);
    }
}

// Singleton
let instance = null;
function getRoleTemplates() {
    if (!instance) {
        instance = new RoleTemplates();
    }
    return instance;
}

module.exports = { RoleTemplates, getRoleTemplates, ROLE_TEMPLATES, ROLE_CATEGORIES };
