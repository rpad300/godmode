import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Plus, Eye, Edit2, FileText, Zap, Trash2, ArrowLeft,
  Globe, ExternalLink, RefreshCw, ChevronRight, Check, Code2, Palette
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Company {
  id: string;
  name: string;
  logoUrl: string;
  website: string;
  linkedin: string;
  description: string;
  status: 'analyzed' | 'not_analyzed';
  colors: string[];
}

const mockCompanies: Company[] = [
  {
    id: '1', name: 'CGI', logoUrl: '', website: 'https://www.cgi.com/',
    linkedin: 'https://www.linkedin.com/company/cgi/', description: '',
    status: 'analyzed', colors: ['#e11d48', '#1e293b'],
  },
  {
    id: '2', name: 'Empresa de RPAD', logoUrl: '', website: '',
    linkedin: '', description: '', status: 'not_analyzed', colors: [],
  },
  {
    id: '3', name: 'MN8 ENERGY', logoUrl: '', website: 'https://mn8.com/',
    linkedin: '', description: '', status: 'analyzed', colors: ['#1d4ed8', '#3b82f6'],
  },
];

const reportSections = [
  'Ficha de Identidade', 'Visão Geral e Posicionamento', 'Produtos e Serviços',
  'Público-Alvo e Clientes', 'Equipa e Liderança', 'Presença Digital e Marketing',
  'Análise Competitiva', 'Indicadores de Crescimento', 'Análise SWOT', 'Conclusões e Insights',
];

const sectionContent: Record<string, string> = {
  'Ficha de Identidade': `Nome: CGI (CGI Inc.)
Slogan/assinatura: "Insights you can act on" (observado no site e LinkedIn)
Sede: Informação não disponível publicamente (nas fontes fornecidas)
Ano de fundação: 1976 (site)
Dimensão: "Entre as maiores empresas de serviços de consultoria de IT e negócio do mundo" (site); presença em 400 localizações e atuação em 21 setores (LinkedIn)
Setor: Consultoria de IT e negócio; integração de sistemas; managed services; serviços aplicacionais e de infraestrutura (site)
Website/redes: https://www.cgi.com/ | LinkedIn: https://www.linkedin.com/company/cgi/
Contactos: Informação não disponível publicamente (nas fontes fornecidas; existe página "Contact" no site, mas sem detalhe no excerto)`,
  'Visão Geral e Posicionamento': 'A CGI demonstra um forte posicionamento no mercado global de consultoria IT, com presença em 400+ localizações...',
  'Análise SWOT': 'Forças: Tecnologia proprietária, Equipa experiente\nFraquezas: Baixa presença internacional em alguns mercados emergentes',
};

type CompanyPageView = 'list' | 'view' | 'edit' | 'templates';

const CompaniesPage = () => {
  const [pageView, setPageView] = useState<CompanyPageView>('list');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const openView = (company: Company, view: CompanyPageView) => {
    setSelectedCompany(company);
    setPageView(view);
  };
  const backToList = () => { setPageView('list'); setSelectedCompany(null); };

  return (
    <div className="p-6 space-y-4">
      {pageView === 'list' && <CompanyList onView={c => openView(c, 'view')} onEdit={c => openView(c, 'edit')} onTemplates={c => openView(c, 'templates')} />}
      {pageView === 'view' && selectedCompany && <CompanyView company={selectedCompany} onBack={backToList} onEdit={() => setPageView('edit')} />}
      {pageView === 'edit' && selectedCompany && <CompanyEdit company={selectedCompany} onBack={backToList} onTemplates={() => setPageView('templates')} />}
      {pageView === 'templates' && selectedCompany && <CompanyTemplates company={selectedCompany} onBack={() => setPageView('edit')} />}
    </div>
  );
};

// ==================== LIST ====================

function CompanyList({ onView, onEdit, onTemplates }: { onView: (c: Company) => void; onEdit: (c: Company) => void; onTemplates: (c: Company) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground">Manage company profiles and assets</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New company
        </button>
      </div>

      <div className="space-y-3">
        {mockCompanies.map((company, i) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-foreground">{company.name.substring(0, 3).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{company.name}</h3>
                  {company.colors.length > 0 && (
                    <div className="flex gap-0.5">
                      {company.colors.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    company.status === 'analyzed' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                  }`}>
                    {company.status === 'analyzed' ? 'Analyzed' : 'Not analyzed'}
                  </span>
                </div>
                {company.website && <p className="text-[10px] text-muted-foreground">{company.website}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                <button onClick={() => onView(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                <button onClick={() => onEdit(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => onTemplates(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
                  <FileText className="w-3.5 h-3.5" /> Templates (A4 / PPT)
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
                  <Zap className="w-3.5 h-3.5" /> {company.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                </button>
                <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ==================== VIEW ====================

function CompanyView({ company, onBack, onEdit }: { company: Company; onBack: () => void; onEdit: () => void }) {
  const [activeSection, setActiveSection] = useState(reportSections[0]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </button>

      <div className="flex items-center gap-4 mb-2">
        <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{company.name.substring(0, 3).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
            {company.colors.length > 0 && (
              <div className="flex gap-0.5">
                {company.colors.map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><Globe className="w-3 h-3" /> {company.website}</a>}
            {company.linkedin && <a href={company.linkedin} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" /> LinkedIn</a>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <RefreshCw className="w-4 h-4" /> Re-analyze
          </button>
          <button onClick={onEdit} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Edit</button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0">
          <h4 className="text-xs font-semibold text-foreground mb-2">Report Sections</h4>
          <div className="space-y-0.5">
            {reportSections.map(section => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  activeSection === section ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {section}
                {activeSection === section && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">{activeSection}</h3>
          <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {sectionContent[activeSection] || `Conteúdo da secção "${activeSection}" — conecte ao backend para carregar dados reais.`}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== EDIT ====================

function CompanyEdit({ company, onBack, onTemplates }: { company: Company; onBack: () => void; onTemplates: () => void }) {
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description);
  const [logoUrl, setLogoUrl] = useState(company.logoUrl);
  const [website, setWebsite] = useState(company.website);
  const [linkedin, setLinkedin] = useState(company.linkedin);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </button>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-bold text-foreground mb-5">Edit {company.name}</h2>

        <div className="max-w-lg space-y-5">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-background border-border text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Logo URL</label>
            <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." className="bg-background border-border text-sm font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Website</label>
              <Input value={website} onChange={e => setWebsite(e.target.value)} className="bg-background border-border text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">LinkedIn</label>
              <Input value={linkedin} onChange={e => setLinkedin(e.target.value)} className="bg-background border-border text-sm" />
            </div>
          </div>

          <div className="border-t border-border pt-4 flex justify-center gap-2">
            <button className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Save</button>
            <button onClick={onBack} className="px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Documents</h3>
          <button onClick={onTemplates} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
            <FileText className="w-4 h-4" /> Templates (A4 / PPT)
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== TEMPLATES ====================

function CompanyTemplates({ company, onBack }: { company: Company; onBack: () => void }) {
  const [templateType, setTemplateType] = useState<'a4' | 'ppt'>('a4');
  const [codeTab, setCodeTab] = useState<'code' | 'theme'>('code');
  const templateCode = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${company.name} Report</title>
</head>
<body>
  <header>
    <h1>${company.name}</h1>
  </header>
  <main>
    <section class="content">
      <!-- Report content here -->
    </section>
  </main>
</body>
</html>`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Edit
      </button>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">{company.name} – Templates (A4 / PPT)</h1>
        <p className="text-sm text-muted-foreground">Manage the document templates for this company.</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <button
            onClick={() => setTemplateType('a4')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              templateType === 'a4' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            A4 document
          </button>
          <button
            onClick={() => setTemplateType('ppt')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              templateType === 'ppt' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Presentation
          </button>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Load current</button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Zap className="w-4 h-4" /> Generate base with AI
          </button>
          <button className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">Save template</button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Code Editor */}
        <div className="flex-1">
          <div className="flex border-b border-border mb-2">
            <button
              onClick={() => setCodeTab('code')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                codeTab === 'code' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" /> Code
            </button>
            <button
              onClick={() => setCodeTab('theme')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                codeTab === 'theme' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
              }`}
            >
              <Palette className="w-3.5 h-3.5" /> Theme
            </button>
          </div>
          <div className="bg-background border border-border rounded-lg p-4 font-mono text-xs text-muted-foreground whitespace-pre overflow-auto h-[500px] scrollbar-thin">
            {templateCode}
          </div>
        </div>

        {/* Preview */}
        <div className="w-[320px] flex-shrink-0">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Preview</p>

          {templateType === 'ppt' ? (
            /* PPT / Presentation Preview - slides stacked */
            <div className="space-y-3 overflow-y-auto h-[500px] scrollbar-thin pr-1">
              {/* Slide 1 - Cover */}
              <div className="bg-white border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="border-l-4 border-destructive p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-muted rounded flex items-center justify-center">
                        <span className="text-[7px] font-bold text-muted-foreground">{company.name.substring(0, 3)}</span>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-foreground">{company.name}</p>
                        <p className="text-[7px] text-muted-foreground">Presentation Template</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <span className="text-[7px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">Primary #D71920</span>
                      <span className="text-[7px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">Secondary #111827</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1">— REPORT / DECK</p>
                  <div className="bg-muted/30 border border-border rounded-lg p-3 mt-1">
                    <h3 className="text-sm font-bold text-foreground">{company.name}</h3>
                    <h3 className="text-sm font-bold text-foreground">Executive Summary</h3>
                    <p className="text-[9px] text-muted-foreground mt-1">Replace placeholders with your content. Use this slide for the report title, date, audience, and context.</p>
                  </div>
                </div>
              </div>

              {/* Slide 2 - Overview */}
              <div className="bg-white border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="border-l-4 border-destructive p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-muted rounded flex items-center justify-center">
                        <span className="text-[6px] font-bold text-muted-foreground">{company.name.substring(0, 3)}</span>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-foreground">{company.name}</p>
                        <p className="text-[7px] text-muted-foreground">Overview</p>
                      </div>
                    </div>
                    <span className="text-[8px] text-muted-foreground">Section 01</span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1">Overview</h4>
                  <p className="text-[9px] text-muted-foreground mb-2">Use this slide for key messages, objectives, scope, and high-level context.</p>
                  <div className="border border-border rounded p-2 flex items-center justify-between">
                    <span className="text-[8px] font-bold text-foreground">REPORT DATA</span>
                    <div className="w-2 h-2 rounded-sm bg-destructive" />
                  </div>
                </div>
              </div>

              {/* Slide 3 - Findings */}
              <div className="bg-white border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="border-l-4 border-destructive p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-muted rounded flex items-center justify-center">
                        <span className="text-[6px] font-bold text-muted-foreground">{company.name.substring(0, 3)}</span>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-foreground">{company.name}</p>
                        <p className="text-[7px] text-muted-foreground">Findings</p>
                      </div>
                    </div>
                    <span className="text-[8px] text-muted-foreground">Section 02</span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1">Findings</h4>
                  <p className="text-[9px] text-muted-foreground mb-2">Summarize insights, trends, and supporting evidence. Keep each slide to one main idea.</p>
                  <div className="border border-border rounded p-2 flex items-center justify-between">
                    <span className="text-[8px] font-bold text-foreground">REPORT DATA</span>
                    <div className="w-2 h-2 rounded-sm bg-destructive" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* A4 Document Preview */
            <div className="bg-white border border-border rounded-lg overflow-hidden h-[500px]">
              <div className="h-1.5 bg-destructive" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                      <span className="text-[8px] font-bold text-muted-foreground">{company.name.substring(0, 3)}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-foreground">{company.name}</p>
                      <p className="text-[8px] text-muted-foreground">Professional Report Template</p>
                    </div>
                  </div>
                  <span className="text-[8px] px-2 py-0.5 rounded border border-destructive text-destructive font-medium">CONFIDENTIAL</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">1. Ficha de Identidade</h4>
                    <p className="text-[10px] text-muted-foreground"><strong>Nome:</strong> {company.name}</p>
                    <p className="text-[10px] text-muted-foreground"><strong>Setor:</strong> Consultoria Tecnológica</p>
                    <p className="text-[10px] text-muted-foreground"><strong>Descrição:</strong> Empresa líder em inovação...</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">2. Visão Geral</h4>
                    <p className="text-[10px] text-muted-foreground">A {company.name} demonstra um forte posicionamento no mercado...</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">3. Análise SWOT</h4>
                    <ul className="text-[10px] text-muted-foreground list-disc pl-3 space-y-0.5">
                      <li><strong>Forças:</strong> Tecnologia proprietária, Equipa experiente</li>
                      <li><strong>Fraquezas:</strong> Baixa presença internacional</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default CompaniesPage;
