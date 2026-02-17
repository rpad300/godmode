/**
 * Purpose:
 *   Full company management page with list, view (report), edit, and template
 *   sub-views. Allows creating companies, triggering AI analysis, editing
 *   metadata, and managing A4/PPT document templates.
 *
 * Responsibilities:
 *   - List all companies with quick-create, analyze, edit, view, delete actions
 *   - Display a multi-section analysis report (Portuguese section titles) per company
 *   - Provide an edit form for company metadata (name, description, logo, website, linkedin)
 *   - Manage A4 and PPT templates: load, generate with AI, save, and preview
 *
 * Key dependencies:
 *   - apiClient: direct REST calls to /api/companies endpoints
 *   - framer-motion: animated transitions between views
 *   - AlertDialog (shadcn): confirmation dialog for destructive actions
 *
 * Side effects:
 *   - Network: CRUD operations on companies, template loading/saving, AI analysis trigger
 *
 * Notes:
 *   - Uses imperative `fetchCompanies()` rather than react-query; state is managed locally.
 *   - Report section names (reportSections) are in Portuguese, matching the backend analysis output.
 *   - The page uses a single-page navigation pattern via `pageView` state rather than routes.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Plus, Eye, Edit2, FileText, Zap, Trash2, ArrowLeft,
  Globe, ExternalLink, RefreshCw, ChevronRight, Check, Code2, Palette, Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
  linkedin?: string;
  description?: string;
  status?: 'analyzed' | 'not_analyzed';
  colors?: string[];
  report?: Record<string, string>;
}

const reportSections = [
  'Ficha de Identidade', 'Visão Geral e Posicionamento', 'Produtos e Serviços',
  'Público-Alvo e Clientes', 'Equipa e Liderança', 'Presença Digital e Marketing',
  'Análise Competitiva', 'Indicadores de Crescimento', 'Análise SWOT', 'Conclusões e Insights',
];

type CompanyPageView = 'list' | 'view' | 'edit' | 'templates';

const CompaniesPage = () => {
  const [pageView, setPageView] = useState<CompanyPageView>('list');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ companies: Company[] }>('/api/companies');
      setCompanies(data.companies || []);
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const openView = (company: Company, view: CompanyPageView) => {
    setSelectedCompany(company);
    setPageView(view);
  };

  const backToList = () => {
    setPageView('list');
    setSelectedCompany(null);
    fetchCompanies();
  };

  return (
    <div className="p-6 space-y-4">
      {pageView === 'list' && <CompanyList companies={companies} loading={loading} onView={c => openView(c, 'view')} onEdit={c => openView(c, 'edit')} onTemplates={c => openView(c, 'templates')} onRefresh={fetchCompanies} />}
      {pageView === 'view' && selectedCompany && <CompanyView company={selectedCompany} onBack={backToList} onEdit={() => setPageView('edit')} />}
      {pageView === 'edit' && selectedCompany && <CompanyEdit company={selectedCompany} onBack={backToList} onTemplates={() => setPageView('templates')} />}
      {pageView === 'templates' && selectedCompany && <CompanyTemplates company={selectedCompany} onBack={() => setPageView('edit')} />}
    </div>
  );
};

// ==================== LIST ====================

function CompanyList({ companies, loading, onView, onEdit, onTemplates, onRefresh }: {
  companies: Company[]; loading: boolean;
  onView: (c: Company) => void; onEdit: (c: Company) => void; onTemplates: (c: Company) => void; onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Company name is required'); return; }
    setCreating(true);
    try {
      await apiClient.post('/api/companies', { name: newName.trim() });
      toast.success('Company created');
      setNewName('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const handleAnalyze = async (company: Company) => {
    toast.info(`Analyzing ${company.name}...`);
    try {
      await apiClient.post(`/api/companies/${company.id}/analyze`, {});
      toast.success(`${company.name} analysis started`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/api/companies/${deleteTarget.id}`);
      toast.success('Company deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The company and all its data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground">Manage company profiles and assets</p>
        </div>
      </div>

      {/* Quick create */}
      <div className="flex gap-2">
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New company name..." className="bg-background border-border text-sm max-w-xs"
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
        <button onClick={handleCreate} disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} New company
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No companies yet. Create one above.</div>
      ) : (
        <div className="space-y-3">
          {companies.map((company, i) => (
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
                    {(company.colors || []).length > 0 && (
                      <div className="flex gap-0.5">
                        {(company.colors || []).map((c, i) => (
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
                    <FileText className="w-3.5 h-3.5" /> Templates
                  </button>
                  <button onClick={() => handleAnalyze(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
                    <Zap className="w-3.5 h-3.5" /> {company.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                  </button>
                  <button onClick={() => setDeleteTarget(company)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ==================== VIEW ====================

function CompanyView({ company, onBack, onEdit }: { company: Company; onBack: () => void; onEdit: () => void }) {
  const [activeSection, setActiveSection] = useState(reportSections[0]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      await apiClient.post(`/api/companies/${company.id}/analyze`, {});
      toast.success('Analysis started');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

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
          </div>
          <div className="flex items-center gap-3 mt-1">
            {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><Globe className="w-3 h-3" /> {company.website}</a>}
            {company.linkedin && <a href={company.linkedin} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" /> LinkedIn</a>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleReanalyze} disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-analyze
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
            {company.report?.[activeSection] || `Content for "${activeSection}" — run analysis to populate.`}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== EDIT ====================

function CompanyEdit({ company, onBack, onTemplates }: { company: Company; onBack: () => void; onTemplates: () => void }) {
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description || '');
  const [logoUrl, setLogoUrl] = useState(company.logo_url || '');
  const [website, setWebsite] = useState(company.website || '');
  const [linkedin, setLinkedin] = useState(company.linkedin || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await apiClient.put(`/api/companies/${company.id}`, {
        name, description, logo_url: logoUrl, website, linkedin,
      });
      toast.success('Company updated');
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

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
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
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
  const [templateCode, setTemplateCode] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const data = await apiClient.get<{ template: { content: string } }>(`/api/companies/${company.id}/templates/${templateType}`);
      setTemplateCode(data.template?.content || `<!-- No ${templateType} template yet -->`);
      toast.success('Template loaded');
    } catch {
      setTemplateCode(`<!-- No ${templateType} template found -->`);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await apiClient.post<{ template: { content: string } }>(`/api/companies/${company.id}/templates/generate`, { type: templateType });
      setTemplateCode(data.template?.content || templateCode);
      toast.success('Template generated');
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/api/companies/${company.id}/templates/${templateType}`, { content: templateCode });
      toast.success('Template saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { loadTemplate(); }, [templateType]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Edit
      </button>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">{company.name} – Templates</h1>
        <p className="text-sm text-muted-foreground">Manage document templates for this company.</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(['a4', 'ppt'] as const).map(t => (
            <button key={t} onClick={() => setTemplateType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                templateType === t ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t === 'a4' ? 'A4 document' : 'Presentation'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={loadTemplate} disabled={loadingTemplate}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
            {loadingTemplate ? 'Loading...' : 'Load current'}
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate with AI'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save template'}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="flex border-b border-border mb-2">
            {(['code', 'theme'] as const).map(tab => (
              <button key={tab} onClick={() => setCodeTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                  codeTab === tab ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
                }`}>
                {tab === 'code' ? <Code2 className="w-3.5 h-3.5" /> : <Palette className="w-3.5 h-3.5" />}
                {tab === 'code' ? 'Code' : 'Theme'}
              </button>
            ))}
          </div>
          <textarea
            value={templateCode}
            onChange={e => setTemplateCode(e.target.value)}
            className="w-full bg-background border border-border rounded-lg p-4 font-mono text-xs text-muted-foreground h-[500px] scrollbar-thin resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="w-[320px] flex-shrink-0">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Preview</p>
          <div className="bg-white border border-border rounded-lg overflow-hidden h-[500px]">
            <div className="h-1.5 bg-destructive" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                  <span className="text-[8px] font-bold text-muted-foreground">{company.name.substring(0, 3)}</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-foreground">{company.name}</p>
                  <p className="text-[8px] text-muted-foreground">{templateType === 'a4' ? 'Document' : 'Presentation'} Template</p>
                </div>
              </div>
              <div className="text-[9px] text-muted-foreground whitespace-pre-wrap font-mono max-h-[400px] overflow-auto">
                {templateCode.substring(0, 500)}
                {templateCode.length > 500 && '...'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default CompaniesPage;
