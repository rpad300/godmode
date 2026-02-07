-- ============================================================================
-- Migration: 035_additional_role_templates.sql
-- Description: Add additional role question templates for common roles
-- ============================================================================

-- ============================================================================
-- SECTION 1: CUSTOMER SUCCESS / SUPPORT ROLES
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
-- Customer Success
(NULL, 'customer success|customer service|client success|account manager', 'Business', 'What are the key customer expectations and success metrics?', 'high', 'Customer success alignment'),
(NULL, 'customer success|support|helpdesk|service desk', 'Business', 'What are the main customer pain points and how will this address them?', 'high', 'Customer feedback integration'),
(NULL, 'customer success|onboarding|implementation', 'Business', 'What is the customer onboarding process and timeline?', 'medium', 'Onboarding planning'),
(NULL, 'support|helpdesk|service desk|customer service', 'Business', 'What support channels and SLAs are required?', 'high', 'Support operations'),
(NULL, 'support|customer success|feedback', 'Business', 'How will customer feedback be collected and incorporated?', 'medium', 'Voice of customer')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 2: ANALYST ROLES (DATA, BUSINESS, SYSTEMS)
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
-- Business Analyst
(NULL, 'business analyst|ba|requirements analyst|functional analyst', 'Business', 'What are the key functional requirements and user stories?', 'high', 'Requirements elicitation'),
(NULL, 'business analyst|ba|process|workflow', 'Business', 'What are the current business processes that will be impacted?', 'high', 'Process analysis'),
(NULL, 'business analyst|requirements|specification', 'Business', 'Are there any regulatory or compliance requirements to consider?', 'medium', 'Compliance requirements'),
(NULL, 'business analyst|stakeholder|communication', 'Business', 'Who are the key stakeholders and what are their expectations?', 'medium', 'Stakeholder management'),

-- Data Analyst
(NULL, 'data analyst|data scientist|analytics|bi|business intelligence', 'Technical', 'What are the key metrics and KPIs to track?', 'high', 'Analytics requirements'),
(NULL, 'data analyst|data scientist|reporting|dashboard', 'Technical', 'What reports and dashboards are needed?', 'high', 'Reporting needs'),
(NULL, 'data analyst|data scientist|data quality|validation', 'Technical', 'What data sources are available and what is their quality?', 'medium', 'Data quality assessment'),
(NULL, 'data analyst|analytics|insights|ml|machine learning', 'Technical', 'Are there any predictive analytics or ML requirements?', 'medium', 'Advanced analytics'),

-- Systems Analyst
(NULL, 'systems analyst|technical analyst|solution analyst', 'Technical', 'What are the system integration requirements?', 'high', 'Integration analysis'),
(NULL, 'systems analyst|it analyst|infrastructure', 'Technical', 'What are the non-functional requirements (performance, scalability)?', 'high', 'NFR analysis')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 3: MARKETING AND COMMUNICATIONS
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
(NULL, 'marketing|growth|demand gen|campaigns', 'Business', 'What is the go-to-market strategy?', 'high', 'GTM planning'),
(NULL, 'marketing|content|copywriter|communications', 'Business', 'What content and messaging is needed for launch?', 'medium', 'Content strategy'),
(NULL, 'marketing|seo|digital marketing|performance', 'Technical', 'What are the SEO and analytics tracking requirements?', 'medium', 'Digital marketing'),
(NULL, 'marketing|brand|creative|design', 'Business', 'Does this align with brand guidelines and positioning?', 'medium', 'Brand alignment'),
(NULL, 'communications|pr|public relations|media', 'Business', 'Are there any external communication or PR considerations?', 'low', 'PR planning')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 4: SALES AND COMMERCIAL
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
(NULL, 'sales|account executive|commercial|revenue', 'Business', 'How will this impact sales processes and pipelines?', 'high', 'Sales alignment'),
(NULL, 'sales|pre-sales|solution|demo', 'Business', 'What demo or proof-of-concept capabilities are needed?', 'medium', 'Pre-sales support'),
(NULL, 'sales|pricing|monetization|commercial', 'Business', 'What is the pricing and monetization model?', 'high', 'Commercial model'),
(NULL, 'sales|enablement|training|adoption', 'Business', 'What training or enablement is needed for the sales team?', 'medium', 'Sales enablement')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 5: OPERATIONS AND ADMINISTRATION
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
(NULL, 'operations|ops|process|efficiency', 'Business', 'How will this impact operational processes?', 'medium', 'Operations impact'),
(NULL, 'operations|logistics|supply chain|inventory', 'Business', 'Are there supply chain or logistics considerations?', 'medium', 'Logistics planning'),
(NULL, 'admin|office|administration|executive assistant', 'Business', 'What administrative processes need to be updated?', 'low', 'Admin updates'),
(NULL, 'operations|facilities|office management', 'Business', 'Are there any facilities or physical space requirements?', 'low', 'Facilities planning')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 6: TRAINING AND LEARNING
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
(NULL, 'training|learning|l&d|education|instructor', 'Business', 'What training materials and documentation are needed?', 'medium', 'Training development'),
(NULL, 'training|onboarding|adoption|change management', 'Business', 'What is the change management and user adoption strategy?', 'high', 'Change management'),
(NULL, 'training|e-learning|lms|instructional design', 'Business', 'Are there e-learning or LMS requirements?', 'medium', 'E-learning needs')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 7: EXECUTIVE AND LEADERSHIP
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
(NULL, 'ceo|cto|coo|cfo|cio|chief|executive|director|vp|vice president', 'Business', 'What is the strategic alignment and expected business impact?', 'critical', 'Strategic alignment'),
(NULL, 'ceo|cto|executive|leadership|board', 'Business', 'What are the key risks and mitigation strategies?', 'high', 'Risk assessment'),
(NULL, 'cfo|finance|executive|budget', 'Business', 'What is the expected ROI and payback period?', 'high', 'Financial analysis'),
(NULL, 'cto|cio|technology|executive', 'Technical', 'How does this fit into the overall technology roadmap?', 'high', 'Technology strategy')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 8: DEVELOPER AND ENGINEERING ROLES
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
(NULL, 'developer|engineer|programmer|coder|software', 'Technical', 'What is the tech stack and development environment?', 'high', 'Development setup'),
(NULL, 'frontend|ui|react|angular|vue|javascript', 'Technical', 'What are the UI/UX requirements and design specs?', 'high', 'Frontend requirements'),
(NULL, 'backend|api|server|python|node|java|go', 'Technical', 'What are the API and backend architecture requirements?', 'high', 'Backend design'),
(NULL, 'fullstack|full-stack|developer|engineer', 'Technical', 'What is the end-to-end feature scope?', 'high', 'Feature scope'),
(NULL, 'mobile|ios|android|react native|flutter', 'Technical', 'What mobile platforms and features are required?', 'high', 'Mobile requirements'),
(NULL, 'developer|code review|best practices', 'Technical', 'What coding standards and review processes apply?', 'medium', 'Code quality')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 9: SCRUM AND AGILE ROLES
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
(NULL, 'scrum master|agile coach|delivery manager', 'Business', 'What is the sprint/iteration cadence and ceremonies?', 'medium', 'Agile process'),
(NULL, 'scrum master|agile|delivery|velocity', 'Business', 'What are the team capacity and velocity considerations?', 'medium', 'Team capacity'),
(NULL, 'scrum master|agile|impediment|blocker', 'Business', 'What are the known blockers or dependencies?', 'high', 'Dependency management'),
(NULL, 'agile|kanban|lean|continuous improvement', 'Business', 'What metrics will be used to measure delivery health?', 'medium', 'Delivery metrics')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================
