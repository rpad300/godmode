import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Plus, Eye, Edit2, FileText, Zap, Trash2, ArrowLeft,
  Globe, ExternalLink, RefreshCw, ChevronRight, Check, Code2, Palette, Loader2,
  AlertTriangle, Sparkles, Save, RotateCcw, Type, Maximize2, Minimize2,
  Printer, Download, Upload
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import {
  useCompanies, useCompany, useCreateCompany, useUpdateCompany,
  useDeleteCompany, useAnalyzeCompany,
} from '@/hooks/useKrisp';
import { AvatarUpload } from '../components/shared/AvatarUpload';
import { ErrorState } from '../components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism.css';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';
const LABEL = 'text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1.5';

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  website_url?: string;
  website?: string;
  linkedin_url?: string;
  linkedin?: string;
  description?: string;
  status?: 'analyzed' | 'not_analyzed';
  colors?: string[];
  report?: Record<string, string>;
  brand_assets?: {
    primary_color?: string;
    secondary_color?: string;
    ai_context?: string;
    analyzed_at?: string;
    analysis_report?: Record<string, string>;
  };
}

const reportSections = [
  { display: 'Ficha de Identidade', key: 'ficha_identidade' },
  { display: 'Visão Geral e Posicionamento', key: 'visao_geral' },
  { display: 'Produtos e Serviços', key: 'produtos_servicos' },
  { display: 'Público-Alvo e Clientes', key: 'publico_alvo' },
  { display: 'Equipa e Liderança', key: 'equipa_lideranca' },
  { display: 'Presença Digital e Marketing', key: 'presenca_digital' },
  { display: 'Análise Competitiva', key: 'analise_competitiva' },
  { display: 'Indicadores de Crescimento', key: 'indicadores_crescimento' },
  { display: 'Análise SWOT', key: 'swot' },
  { display: 'Conclusões e Insights', key: 'conclusoes' },
];

const TEMPLATE_PLACEHOLDERS = ['{{COMPANY_NAME}}', '{{LOGO_URL}}', '{{COMPANY_LOGO_URL}}', '{{PRIMARY_COLOR}}', '{{SECONDARY_COLOR}}', '{{REPORT_DATA}}'];
const REQUIRED_PLACEHOLDERS = ['{{REPORT_DATA}}'];

const STYLE_OPTIONS = [
  { value: 'corporate', label: 'Corporate Classic', desc: 'Formal, structured, traditional' },
  { value: 'minimal', label: 'Modern Minimal', desc: 'Clean, spacious, focus on content' },
  { value: 'tech', label: 'Startup Tech', desc: 'Bold, modern, geometric' },
  { value: 'consultancy', label: 'Consultancy Premium', desc: 'Executive, refined, data-friendly' },
];

const FONT_OPTIONS = [
  { value: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", label: 'System Default' },
  { value: "'Georgia', 'Times New Roman', serif", label: 'Georgia (Serif)' },
  { value: "'Inter', 'Helvetica Neue', sans-serif", label: 'Inter' },
  { value: "'Roboto', 'Arial', sans-serif", label: 'Roboto' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Source Sans Pro', sans-serif", label: 'Source Sans Pro' },
  { value: "'Fira Code', monospace", label: 'Fira Code (Mono)' },
];

type CompanyPageView = 'list' | 'view' | 'edit' | 'templates';

function getMissingPlaceholders(html: string): string[] {
  return REQUIRED_PLACEHOLDERS.filter(p => !html.includes(p));
}

function getUsedPlaceholders(html: string): string[] {
  return TEMPLATE_PLACEHOLDERS.filter(p => html.includes(p));
}

function fillPlaceholders(html: string, company: Company): string {
  const ba = company.brand_assets || {};
  return html
    .replace(/\{\{COMPANY_NAME\}\}/g, company.name || 'Company Name')
    .replace(/\{\{COMPANY_LOGO_URL\}\}/g, company.logo_url || '')
    .replace(/\{\{LOGO_URL\}\}/g, company.logo_url || '')
    .replace(/\{\{PRIMARY_COLOR\}\}/g, ba.primary_color || '#1a1a2e')
    .replace(/\{\{SECONDARY_COLOR\}\}/g, ba.secondary_color || '#16213e')
    .replace(/\{\{REPORT_DATA\}\}/g, '<h2>Sample Section Title</h2><p>This is sample report content to demonstrate how your template will look when populated with real data. The actual report will contain analysis, metrics, and insights.</p><h2>Another Section</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>');
}

function openHtmlForPdf(html: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => win.print(), 600);
    });
  }
}

function downloadHtmlFile(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const CompaniesPage = () => {
  const [pageView, setPageView] = useState<CompanyPageView>('list');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const companiesQuery = useCompanies();

  const openView = (company: Company, view: CompanyPageView) => {
    setSelectedCompany(company);
    setPageView(view);
  };

  const backToList = () => {
    setPageView('list');
    setSelectedCompany(null);
  };

  return (
    <div className="space-y-4">
      {pageView === 'list' && (
        companiesQuery.isError
          ? <ErrorState message="Failed to load companies" onRetry={() => companiesQuery.refetch()} />
          : <CompanyList companies={companiesQuery.data?.companies || []} loading={companiesQuery.isLoading} onView={c => openView(c, 'view')} onEdit={c => openView(c, 'edit')} onTemplates={c => openView(c, 'templates')} />
      )}
      {pageView === 'view' && selectedCompany && <CompanyView company={selectedCompany} onBack={backToList} onEdit={() => setPageView('edit')} />}
      {pageView === 'edit' && selectedCompany && <CompanyEdit company={selectedCompany} onBack={backToList} onTemplates={() => setPageView('templates')} onUpdated={(c) => setSelectedCompany(c)} />}
      {pageView === 'templates' && selectedCompany && <CompanyTemplates company={selectedCompany} onBack={() => setPageView('edit')} />}
    </div>
  );
};

// ==================== LIST ====================

function CompanyList({ companies, loading, onView, onEdit, onTemplates }: {
  companies: Company[]; loading: boolean;
  onView: (c: Company) => void; onEdit: (c: Company) => void; onTemplates: (c: Company) => void;
}) {
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const createCompany = useCreateCompany();
  const deleteCompany = useDeleteCompany();
  const analyzeCompany = useAnalyzeCompany();

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Company name is required'); return; }
    try {
      await createCompany.mutateAsync({ name: newName.trim() });
      toast.success('Company created');
      setNewName('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create company');
    }
  };

  const handleAnalyze = async (company: Company) => {
    toast.info(`Analyzing ${company.name}...`);
    try {
      await analyzeCompany.mutateAsync(company.id);
      toast.success(`${company.name} analysis complete`);
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCompany.mutateAsync(deleteTarget.id);
      toast.success('Company deleted');
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
            <AlertDialogTitle>Delete {deleteTarget?.name || 'this item'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The company and all its data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className={BTN_DANGER}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--gm-text-primary)]">Companies</h1>
          <p className="text-sm text-[var(--gm-text-tertiary)]">Manage company profiles and assets</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New company name..." className={cn(INPUT, 'max-w-xs')}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
        <button onClick={handleCreate} disabled={createCompany.isPending}
          className={cn(BTN_PRIMARY, 'px-4 py-2 text-sm')}>
          {createCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} New company
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12 text-[var(--gm-text-tertiary)] text-sm">No companies yet. Create one above.</div>
      ) : (
        <div className="space-y-3">
          {companies.map((company, i) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(CARD, 'p-4 hover:border-[var(--gm-accent-primary)]/20')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--gm-bg-tertiary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-sm font-bold text-[var(--gm-text-primary)]">{(company.name || '???').substring(0, 3).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--gm-text-primary)]">{company.name}</h3>
                    {(company.colors || []).length > 0 && (
                      <div className="flex gap-0.5">
                        {(company.colors || []).map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      company.status === 'analyzed' ? 'bg-[var(--gm-accent-primary)]/10 text-[var(--gm-accent-primary)]' : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]'
                    }`}>
                      {company.status === 'analyzed' ? 'Analyzed' : 'Not analyzed'}
                    </span>
                  </div>
                  {(company.website || company.website_url) && <p className="text-[10px] text-[var(--gm-text-tertiary)]">{company.website || company.website_url}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                  <button onClick={() => onView(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button onClick={() => onEdit(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => onTemplates(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Templates
                  </button>
                  <button onClick={() => handleAnalyze(company)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
                    <Zap className="w-3.5 h-3.5" /> {company.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                  </button>
                  <button onClick={() => setDeleteTarget(company)} className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-[var(--color-danger-500)]/10 hover:text-[var(--color-danger-500)] transition-colors">
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
  const companyQuery = useCompany(company.id);
  const fullCompany = companyQuery.data?.company || company;
  const [activeSection, setActiveSection] = useState(reportSections[0].key);
  const analyzeCompany = useAnalyzeCompany();

  const analysisReport = fullCompany.brand_assets?.analysis_report || {};

  const handleReanalyze = async () => {
    try {
      await analyzeCompany.mutateAsync(company.id);
      toast.success('Analysis complete');
      companyQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
  };

  const activeSectionData = reportSections.find(s => s.key === activeSection);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </button>

      <div className="flex items-center gap-4 mb-2">
        <div className="w-14 h-14 rounded-xl bg-[var(--gm-bg-tertiary)] flex items-center justify-center overflow-hidden">
          {fullCompany.logo_url ? (
            <img src={fullCompany.logo_url} alt={fullCompany.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-lg font-bold text-[var(--gm-text-primary)]">{(fullCompany.name || '???').substring(0, 3).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--gm-text-primary)]">{fullCompany.name}</h1>
            {fullCompany.brand_assets?.primary_color && (
              <div className="flex gap-1 ml-2">
                <div className="w-4 h-4 rounded-sm border border-[var(--gm-border-primary)]" style={{ backgroundColor: fullCompany.brand_assets.primary_color }} />
                {fullCompany.brand_assets?.secondary_color && (
                  <div className="w-4 h-4 rounded-sm border border-[var(--gm-border-primary)]" style={{ backgroundColor: fullCompany.brand_assets.secondary_color }} />
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {(fullCompany.website || fullCompany.website_url) && (
              <a href={fullCompany.website || fullCompany.website_url} target="_blank" rel="noreferrer"
                className="text-xs text-[var(--gm-accent-primary)] flex items-center gap-1 hover:underline">
                <Globe className="w-3 h-3" /> {fullCompany.website || fullCompany.website_url}
              </a>
            )}
            {(fullCompany.linkedin || fullCompany.linkedin_url) && (
              <a href={fullCompany.linkedin || fullCompany.linkedin_url} target="_blank" rel="noreferrer"
                className="text-xs text-[var(--gm-accent-primary)] flex items-center gap-1 hover:underline">
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleReanalyze} disabled={analyzeCompany.isPending}
            className={cn(BTN_PRIMARY, 'px-4 py-2 text-sm')}>
            {analyzeCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-analyze
          </button>
          <button onClick={onEdit} className="text-sm text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">Edit</button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0">
          <h4 className="text-xs font-semibold text-[var(--gm-text-primary)] mb-2">Report Sections</h4>
          <div className="space-y-0.5">
            {reportSections.map(section => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  activeSection === section.key ? 'bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)] font-medium' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]'
                }`}
              >
                {section.display}
                {activeSection === section.key && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        <div className={cn(CARD, 'flex-1 p-6')}>
          <h3 className="text-lg font-bold text-[var(--gm-text-primary)] mb-4">{activeSectionData?.display}</h3>
          <div className="text-sm text-[var(--gm-text-tertiary)] whitespace-pre-line leading-relaxed">
            {analysisReport[activeSection] || `Content for "${activeSectionData?.display}" — run analysis to populate.`}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== EDIT ====================

function CompanyEdit({ company, onBack, onTemplates, onUpdated }: {
  company: Company; onBack: () => void; onTemplates: () => void; onUpdated?: (c: Company) => void;
}) {
  const companyQuery = useCompany(company.id);
  const fullCompany = companyQuery.data?.company || company;

  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description || '');
  const [logoUrl, setLogoUrl] = useState(company.logo_url || '');
  const [website, setWebsite] = useState(company.website || company.website_url || '');
  const [linkedin, setLinkedin] = useState(company.linkedin || company.linkedin_url || '');
  const [primaryColor, setPrimaryColor] = useState(fullCompany.brand_assets?.primary_color || '');
  const [secondaryColor, setSecondaryColor] = useState(fullCompany.brand_assets?.secondary_color || '');
  const [aiContext, setAiContext] = useState(fullCompany.brand_assets?.ai_context || '');
  const updateCompany = useUpdateCompany();
  const analyzeCompany = useAnalyzeCompany();

  useEffect(() => {
    if (companyQuery.data?.company) {
      const c = companyQuery.data.company;
      setPrimaryColor(c.brand_assets?.primary_color || '');
      setSecondaryColor(c.brand_assets?.secondary_color || '');
      setAiContext(c.brand_assets?.ai_context || '');
      if (c.logo_url) setLogoUrl(c.logo_url);
    }
  }, [companyQuery.data]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    const urlPattern = /^https?:\/\//;
    if (website.trim() && !urlPattern.test(website.trim())) {
      toast.error('Website must start with http:// or https://');
      return;
    }
    if (linkedin.trim() && !urlPattern.test(linkedin.trim())) {
      toast.error('LinkedIn URL must start with http:// or https://');
      return;
    }
    try {
      const brand_assets = {
        ...(fullCompany.brand_assets || {}),
        primary_color: primaryColor || undefined,
        secondary_color: secondaryColor || undefined,
        ai_context: aiContext || undefined,
      };
      const result = await updateCompany.mutateAsync({
        id: company.id, name, description, logo_url: logoUrl,
        website_url: website, linkedin_url: linkedin, brand_assets,
      } as any);
      toast.success('Company updated');
      if (onUpdated && result?.company) onUpdated(result.company);
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleAnalyze = async () => {
    toast.info(`Analyzing ${company.name}...`);
    try {
      await analyzeCompany.mutateAsync(company.id);
      toast.success('Analysis complete');
      companyQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
  };

  const analyzedAt = fullCompany.brand_assets?.analyzed_at;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </button>

      <div className={cn(CARD, 'p-5')}>
        <h2 className="text-lg font-bold text-[var(--gm-text-primary)] mb-5">Edit {company.name}</h2>

        <div className="flex gap-8">
          <div className="flex-shrink-0">
            <label className={cn(LABEL, 'mb-3')}>Company Logo</label>
            <AvatarUpload
              currentUrl={logoUrl || undefined}
              name={company.name}
              uploadEndpoint={`/api/companies/${company.id}/logo`}
              deleteEndpoint={`/api/companies/${company.id}/logo`}
              onUploaded={(url) => { setLogoUrl(url); }}
              onRemoved={() => { setLogoUrl(''); }}
              onUrlChange={(url) => { setLogoUrl(url); }}
              size="xl"
              showUrlInput={true}
            />
          </div>

          <div className="flex-1 max-w-lg space-y-5">
            <div>
              <label className={LABEL}>Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={cn(INPUT, 'resize-y')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}><Globe className="w-3 h-3" /> Website</label>
                <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className={INPUT} />
              </div>
              <div>
                <label className={LABEL}><ExternalLink className="w-3 h-3" /> LinkedIn</label>
                <Input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/company/..." className={INPUT} />
              </div>
            </div>
          </div>
        </div>

        {/* Brand Colors & AI Section */}
        <div className="mt-8 pt-5 border-t border-[var(--gm-border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(SECTION_TITLE, 'text-sm')}>Brand & AI Analysis</h3>
            <div className="flex items-center gap-3">
              {analyzedAt && (
                <span className="text-[10px] text-[var(--gm-text-tertiary)]">
                  Last analyzed: {new Date(analyzedAt).toLocaleDateString()}
                </span>
              )}
              <button onClick={handleAnalyze} disabled={analyzeCompany.isPending} className={cn(BTN_SECONDARY, 'text-xs')}>
                {analyzeCompany.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {analyzedAt ? 'Re-analyze' : 'Analyze with AI'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className={LABEL}><Palette className="w-3 h-3" /> Primary Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor || '#1a1a2e'} onChange={e => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded border border-[var(--gm-border-primary)] cursor-pointer bg-transparent" />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} placeholder="#1a1a2e" className={cn(INPUT, 'font-mono text-xs flex-1')} />
              </div>
            </div>
            <div>
              <label className={LABEL}><Palette className="w-3 h-3" /> Secondary Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={secondaryColor || '#16213e'} onChange={e => setSecondaryColor(e.target.value)}
                  className="w-8 h-8 rounded border border-[var(--gm-border-primary)] cursor-pointer bg-transparent" />
                <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} placeholder="#16213e" className={cn(INPUT, 'font-mono text-xs flex-1')} />
              </div>
            </div>
          </div>

          <div className="mt-4 max-w-lg">
            <label className={LABEL}><Sparkles className="w-3 h-3" /> AI Brand Context</label>
            <textarea value={aiContext} onChange={e => setAiContext(e.target.value)} rows={2}
              placeholder="AI-generated brand summary (auto-filled on analysis)" className={cn(INPUT, 'resize-y text-xs')} />
          </div>

          {(primaryColor || secondaryColor) && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[10px] text-[var(--gm-text-tertiary)]">Brand preview:</span>
              <div className="flex gap-1.5 items-center">
                {primaryColor && (
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-6 rounded-md shadow-sm border border-[var(--gm-border-primary)]" style={{ backgroundColor: primaryColor }} />
                    <span className="text-[10px] font-mono text-[var(--gm-text-tertiary)]">{primaryColor}</span>
                  </div>
                )}
                {secondaryColor && (
                  <div className="flex items-center gap-1 ml-2">
                    <div className="w-6 h-6 rounded-md shadow-sm border border-[var(--gm-border-primary)]" style={{ backgroundColor: secondaryColor }} />
                    <span className="text-[10px] font-mono text-[var(--gm-text-tertiary)]">{secondaryColor}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-[var(--gm-border-primary)] pt-4 flex justify-center gap-2">
          <button onClick={handleSave} disabled={updateCompany.isPending} className={cn(BTN_PRIMARY, 'px-5 py-2.5 text-sm')}>
            {updateCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {updateCompany.isPending ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onBack} className={cn(BTN_SECONDARY, 'px-5 py-2.5 text-sm')}>Cancel</button>
        </div>

        <div className="mt-8 pt-5 border-t border-[var(--gm-border-primary)]">
          <h3 className={cn(SECTION_TITLE, 'text-sm mb-3')}>Documents</h3>
          <button onClick={onTemplates} className={cn(BTN_SECONDARY, 'px-4 py-2 text-sm')}>
            <FileText className="w-4 h-4" /> Templates (A4 / PPT)
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== TEMPLATES ====================

function CompanyTemplates({ company, onBack }: { company: Company; onBack: () => void }) {
  const companyQuery = useCompany(company.id);
  const fullCompany = companyQuery.data?.company || company;

  const [templateType, setTemplateType] = useState<'a4' | 'ppt'>('a4');
  const [codeTab, setCodeTab] = useState<'code' | 'theme'>('code');
  const [templateCode, setTemplateCode] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('corporate');
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const [themePrimary, setThemePrimary] = useState(fullCompany.brand_assets?.primary_color || '#1a1a2e');
  const [themeSecondary, setThemeSecondary] = useState(fullCompany.brand_assets?.secondary_color || '#16213e');
  const [themeFont, setThemeFont] = useState("'Segoe UI', Roboto, Helvetica, Arial, sans-serif");

  useEffect(() => {
    if (companyQuery.data?.company?.brand_assets) {
      const ba = companyQuery.data.company.brand_assets;
      if (ba.primary_color) setThemePrimary(ba.primary_color);
      if (ba.secondary_color) setThemeSecondary(ba.secondary_color);
    }
  }, [companyQuery.data]);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const data = await apiClient.get<{ html: string }>(`/api/companies/${company.id}/templates/${templateType}`);
      setTemplateCode(data.html || `<!-- No ${templateType} template yet -->`);
      toast.success('Template loaded');
    } catch {
      setTemplateCode(`<!-- No ${templateType} template found -->`);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setShowStylePicker(false);
    try {
      const data = await apiClient.post<{ html: string }>(`/api/companies/${company.id}/templates/generate`, {
        type: templateType, style: selectedStyle,
      });
      setTemplateCode(data.html || templateCode);
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
      await apiClient.put(`/api/companies/${company.id}/templates/${templateType}`, { html: templateCode });
      toast.success('Template saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setResetting(true);
    try {
      const data = await apiClient.post<{ html: string }>(`/api/companies/${company.id}/templates/${templateType}/reset`);
      setTemplateCode(data.html || '');
      toast.success('Template reset to default');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset');
    } finally {
      setResetting(false);
    }
  };

  const handleExportHtml = () => {
    if (!templateCode) { toast.error('No template to export'); return; }
    const filled = fillPlaceholders(templateCode, fullCompany);
    downloadHtmlFile(filled, `${company.name}-${templateType}-template.html`);
    toast.success('Template exported');
  };

  const handleExportRaw = () => {
    if (!templateCode) { toast.error('No template to export'); return; }
    downloadHtmlFile(templateCode, `${company.name}-${templateType}-template-raw.html`);
    toast.success('Raw template exported');
  };

  const handleImportHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      toast.error('Please select an HTML file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setTemplateCode(content);
        toast.success('Template imported from file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrintPreview = () => {
    if (!previewHtml) { toast.error('No template to preview'); return; }
    openHtmlForPdf(previewHtml);
  };

  useEffect(() => { loadTemplate(); }, [templateType]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [templateCode, saving]);

  // Escape to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  const previewHtml = useMemo(() => {
    if (!templateCode || templateCode.startsWith('<!--')) return '';
    return fillPlaceholders(templateCode, fullCompany);
  }, [templateCode, fullCompany]);

  const missingPlaceholders = useMemo(() => getMissingPlaceholders(templateCode), [templateCode]);
  const usedPlaceholders = useMemo(() => getUsedPlaceholders(templateCode), [templateCode]);

  const applyThemeToCode = useCallback(() => {
    let code = templateCode;
    code = code.replace(/(--primary:\s*)([^;]+)(;)/g, `$1${themePrimary}$3`);
    code = code.replace(/(--secondary:\s*)([^;]+)(;)/g, `$1${themeSecondary}$3`);
    code = code.replace(/(font-family:\s*)([^;]+)(;)/g, `$1${themeFont}$3`);
    setTemplateCode(code);
    toast.success('Theme applied to code');
  }, [templateCode, themePrimary, themeSecondary, themeFont]);

  const highlightCode = useCallback((code: string) => {
    return Prism.highlight(code, Prism.languages.markup, 'markup');
  }, []);

  const editorHeight = isFullscreen ? 'calc(100vh - 120px)' : '500px';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={cn('space-y-4', isFullscreen && 'fixed inset-0 z-50 bg-[var(--gm-bg-primary)] p-6 overflow-auto')}
    >
      <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleImportHtml} className="hidden" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Edit
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--gm-text-primary)]">{company.name} – Templates</h1>
            <p className="text-sm text-[var(--gm-text-tertiary)]">Manage document templates for this company</p>
          </div>
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['a4', 'ppt'] as const).map(t => (
            <button key={t} onClick={() => setTemplateType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                templateType === t ? 'bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]'
              }`}>
              {t === 'a4' ? 'A4 document' : 'Presentation'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadTemplate} disabled={loadingTemplate}
            className={cn(BTN_SECONDARY, 'px-3 py-1.5 text-xs disabled:opacity-50')}>
            {loadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Reload
          </button>

          <button onClick={handleResetToDefault} disabled={resetting}
            className={cn(BTN_SECONDARY, 'px-3 py-1.5 text-xs disabled:opacity-50')}>
            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Reset default
          </button>

          {/* Import / Export */}
          <button onClick={() => fileInputRef.current?.click()} className={cn(BTN_SECONDARY, 'px-3 py-1.5 text-xs')}>
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button onClick={handleExportRaw} className={cn(BTN_SECONDARY, 'px-3 py-1.5 text-xs')}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>

          {/* AI Generate */}
          <div className="relative">
            <button onClick={() => setShowStylePicker(!showStylePicker)} disabled={generating}
              className={cn(BTN_PRIMARY, 'px-3 py-1.5 text-xs')}>
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? 'Generating...' : 'Generate AI'}
            </button>
            {showStylePicker && !generating && (
              <div className={cn(CARD, 'absolute right-0 top-full mt-1 z-50 p-3 w-72 shadow-lg')}>
                <p className="text-xs font-semibold text-[var(--gm-text-primary)] mb-2">Choose a style</p>
                <div className="space-y-1.5">
                  {STYLE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setSelectedStyle(opt.value)}
                      className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                        selectedStyle === opt.value
                          ? 'bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)]'
                          : 'text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)]'
                      )}>
                      <span className="font-medium">{opt.label}</span>
                      <span className="block text-[10px] opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <button onClick={handleGenerate} className={cn(BTN_PRIMARY, 'w-full mt-3 py-2 text-sm justify-center')}>
                  <Sparkles className="w-4 h-4" /> Generate
                </button>
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving} className={cn(BTN_PRIMARY, 'px-3 py-1.5 text-xs')}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* Placeholder validation */}
      {missingPlaceholders.length > 0 && templateCode.length > 20 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-[var(--color-warning-500)]/10 border border-[var(--color-warning-500)]/20">
          <AlertTriangle className="w-4 h-4 text-[var(--color-warning-500)] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--gm-text-secondary)]">
            <span className="font-medium">Missing required placeholders: </span>
            {missingPlaceholders.map(p => (
              <code key={p} className="mx-1 px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[10px] font-mono">{p}</code>
            ))}
          </div>
        </div>
      )}

      {usedPlaceholders.length > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--gm-text-tertiary)]">
          <span>Placeholders:</span>
          {usedPlaceholders.map(p => (
            <code key={p} className="px-1.5 py-0.5 rounded bg-[var(--gm-accent-primary)]/10 text-[var(--gm-accent-primary)] font-mono">{p}</code>
          ))}
          <span className="ml-auto text-[var(--gm-text-tertiary)]">Ctrl+S to save</span>
        </div>
      )}

      {/* Editor + Preview */}
      <div className="flex gap-4" onClick={() => showStylePicker && setShowStylePicker(false)}>
        <div className="flex-1 min-w-0" ref={editorWrapperRef}>
          <div className="flex border-b border-[var(--gm-border-primary)] mb-2">
            {(['code', 'theme'] as const).map(tab => (
              <button key={tab} onClick={() => setCodeTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                  codeTab === tab ? 'text-[var(--gm-accent-primary)] border-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] border-transparent'
                }`}>
                {tab === 'code' ? <Code2 className="w-3.5 h-3.5" /> : <Palette className="w-3.5 h-3.5" />}
                {tab === 'code' ? 'Code' : 'Theme'}
              </button>
            ))}
          </div>

          {codeTab === 'code' ? (
            <div className="border border-[var(--gm-border-primary)] rounded-lg overflow-hidden bg-white">
              <div className="overflow-auto" style={{ height: editorHeight }}>
                <Editor
                  value={templateCode}
                  onValueChange={setTemplateCode}
                  highlight={highlightCode}
                  padding={16}
                  style={{
                    fontFamily: "'Fira Code', 'Consolas', monospace",
                    fontSize: 12,
                    lineHeight: '1.5',
                    minHeight: editorHeight,
                  }}
                  textareaClassName="focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className={cn(CARD, 'p-5 space-y-5')} style={{ minHeight: editorHeight }}>
              <h4 className="text-sm font-semibold text-[var(--gm-text-primary)]">Visual Theme Editor</h4>
              <p className="text-xs text-[var(--gm-text-tertiary)]">Adjust colors and fonts, then apply to update the template code.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}><Palette className="w-3 h-3" /> Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={themePrimary} onChange={e => setThemePrimary(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-[var(--gm-border-primary)] cursor-pointer bg-transparent p-0.5" />
                    <Input value={themePrimary} onChange={e => setThemePrimary(e.target.value)} className={cn(INPUT, 'font-mono text-xs')} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}><Palette className="w-3 h-3" /> Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={themeSecondary} onChange={e => setThemeSecondary(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-[var(--gm-border-primary)] cursor-pointer bg-transparent p-0.5" />
                    <Input value={themeSecondary} onChange={e => setThemeSecondary(e.target.value)} className={cn(INPUT, 'font-mono text-xs')} />
                  </div>
                </div>
              </div>

              <div>
                <label className={LABEL}><Type className="w-3 h-3" /> Font Family</label>
                <select value={themeFont} onChange={e => setThemeFont(e.target.value)} className={cn(INPUT, 'cursor-pointer')}>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div>
                <label className={cn(LABEL, 'mb-2')}>Preview</label>
                <div className="flex gap-2 items-stretch h-16 rounded-lg overflow-hidden border border-[var(--gm-border-primary)]">
                  <div className="flex-1 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: themePrimary, fontFamily: themeFont }}>Primary</div>
                  <div className="flex-1 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: themeSecondary, fontFamily: themeFont }}>Secondary</div>
                  <div className="flex-1 flex items-center justify-center text-sm bg-white border-l border-[var(--gm-border-primary)]"
                    style={{ fontFamily: themeFont, color: themePrimary }}>Body Text</div>
                </div>
              </div>

              <button onClick={applyThemeToCode} className={cn(BTN_PRIMARY, 'px-5 py-2.5 text-sm')}>
                <Check className="w-4 h-4" /> Apply theme to template code
              </button>
            </div>
          )}
        </div>

        {/* Live Preview panel */}
        <div className={cn('flex-shrink-0', isFullscreen ? 'w-[45%]' : 'w-[360px]')}>
          <div className="flex items-center justify-between mb-2">
            <p className={SECTION_TITLE}>Live Preview</p>
            <div className="flex gap-1">
              <button onClick={handlePrintPreview} disabled={!previewHtml}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--gm-text-tertiary)] hover:text-[var(--gm-accent-primary)] hover:bg-[var(--gm-surface-hover)] transition-colors disabled:opacity-30">
                <Printer className="w-3 h-3" /> Print / PDF
              </button>
              <button onClick={handleExportHtml} disabled={!previewHtml}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--gm-text-tertiary)] hover:text-[var(--gm-accent-primary)] hover:bg-[var(--gm-surface-hover)] transition-colors disabled:opacity-30">
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
          </div>
          <div className="border border-[var(--gm-border-primary)] rounded-lg overflow-hidden bg-white"
            style={{ height: isFullscreen ? 'calc(100vh - 200px)' : '520px' }}>
            {previewHtml ? (
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                title="Template Preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                style={{
                  transform: templateType === 'a4' ? 'scale(0.35)' : 'scale(0.3)',
                  transformOrigin: 'top left',
                  width: templateType === 'a4' ? '210mm' : '297mm',
                  height: templateType === 'a4' ? '297mm' : '210mm',
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[var(--gm-text-tertiary)]">
                <div className="text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No template to preview</p>
                  <p className="text-[10px] mt-1">Load or generate a template</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] text-[var(--gm-text-tertiary)] text-center">
            {templateType === 'a4' ? '210mm x 297mm (A4 Portrait)' : '297mm x 210mm (A4 Landscape)'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default CompaniesPage;
