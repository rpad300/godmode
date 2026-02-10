-- Role Templates Table
-- Stores predefined and custom role templates

-- Role categories
CREATE TABLE IF NOT EXISTS role_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role templates
CREATE TABLE IF NOT EXISTS role_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category_id TEXT REFERENCES role_categories(id),
    icon TEXT,
    prompt TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,  -- System templates can't be deleted
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_templates_category ON role_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_role_templates_active ON role_templates(is_active);

-- RLS Policies
ALTER TABLE role_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories and templates
CREATE POLICY "Anyone can read role_categories" ON role_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read active role_templates" ON role_templates FOR SELECT USING (is_active = true);

-- Only admins can modify (for now, allow service key)
CREATE POLICY "Service can manage role_categories" ON role_categories FOR ALL USING (true);
CREATE POLICY "Service can manage role_templates" ON role_templates FOR ALL USING (true);

-- Insert default categories
INSERT INTO role_categories (id, name, icon, color, sort_order) VALUES
    ('technical', 'Technical', '💻', '#3498db', 1),
    ('management', 'Management', '📋', '#9b59b6', 2),
    ('business', 'Business', '💼', '#27ae60', 3),
    ('design', 'Design', '🎨', '#e74c3c', 4),
    ('data', 'Data', '📊', '#f39c12', 5),
    ('support', 'Support', '🤝', '#1abc9c', 6),
    ('external', 'External', '🌐', '#95a5a6', 7),
    ('leadership', 'Leadership', '👑', '#e67e22', 8)
ON CONFLICT (id) DO NOTHING;

-- Insert default templates
INSERT INTO role_templates (id, title, category_id, icon, prompt, keywords, is_system) VALUES
    ('tech_lead', 'Tech Lead / Architect', 'technical', '🏗️', 
     'Responsible for technical architecture and system design decisions.
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
- New technology proposals',
     ARRAY['architecture', 'technical', 'code', 'security', 'performance', 'api'], true),

    ('developer', 'Software Developer', 'technical', '👨‍💻',
     'Software developer focused on implementation and delivery.
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
- API changes and breaking changes',
     ARRAY['code', 'implementation', 'features', 'bugs', 'testing'], true),

    ('devops', 'DevOps / Platform Engineer', 'technical', '⚙️',
     'Responsible for infrastructure, CI/CD, and platform reliability.
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
- Cost anomalies',
     ARRAY['infrastructure', 'deployment', 'monitoring', 'security', 'automation'], true),

    ('qa_engineer', 'QA Engineer', 'technical', '🧪',
     'Quality assurance specialist ensuring product quality.
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
- Quality metrics trends',
     ARRAY['testing', 'quality', 'bugs', 'automation', 'regression'], true),

    ('project_manager', 'Project Manager', 'management', '📊',
     'Project manager responsible for delivery and coordination.
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
- Key decisions requiring escalation',
     ARRAY['timeline', 'resources', 'risks', 'budget', 'milestones', 'stakeholders'], true),

    ('product_owner', 'Product Owner / Product Manager', 'management', '🎯',
     'Product owner responsible for product vision and backlog.
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
- Key metrics and KPIs',
     ARRAY['product', 'features', 'users', 'roadmap', 'backlog', 'priorities'], true),

    ('scrum_master', 'Scrum Master / Agile Coach', 'management', '🔄',
     'Scrum master facilitating agile processes and team health.
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
- Velocity trends',
     ARRAY['sprint', 'agile', 'velocity', 'retrospective', 'impediments', 'team'], true),

    ('business_analyst', 'Business Analyst', 'business', '📈',
     'Business analyst bridging business and technical teams.
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
- Implementation constraints',
     ARRAY['requirements', 'process', 'analysis', 'data', 'stakeholders'], true),

    ('stakeholder', 'Business Stakeholder', 'business', '👔',
     'Business stakeholder interested in project outcomes.
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
- Timeline changes',
     ARRAY['business', 'value', 'roi', 'status', 'decisions'], true),

    ('ux_designer', 'UX/UI Designer', 'design', '🎨',
     'UX/UI designer focused on user experience and interface design.
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
- Implementation constraints',
     ARRAY['design', 'ux', 'ui', 'users', 'prototypes', 'usability'], true),

    ('data_analyst', 'Data Analyst / Scientist', 'data', '📊',
     'Data professional focused on insights and analytics.
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
- Model performance',
     ARRAY['data', 'analytics', 'metrics', 'insights', 'reports'], true),

    ('customer_success', 'Customer Success / Support', 'support', '🤝',
     'Customer success focused on client satisfaction and retention.
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
- Documentation updates',
     ARRAY['customers', 'support', 'feedback', 'issues', 'satisfaction'], true),

    ('consultant', 'Consultant / Advisor', 'external', '💼',
     'External consultant providing expertise and guidance.
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
- Success criteria',
     ARRAY['consulting', 'strategy', 'recommendations', 'expertise'], true),

    ('executive', 'Executive / C-Level', 'leadership', '👑',
     'Executive requiring high-level strategic overview.
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
- Strategic opportunities and threats',
     ARRAY['strategy', 'executive', 'kpis', 'budget', 'decisions'], true)
ON CONFLICT (id) DO NOTHING;

-- Comments
COMMENT ON TABLE role_categories IS 'Categories for grouping role templates';
COMMENT ON TABLE role_templates IS 'Predefined and custom role templates with prompts';
