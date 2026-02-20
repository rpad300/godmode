import { useState, useRef, useCallback } from 'react';
import {
  X, Upload, Loader2, FileText, MessageSquare, Sparkles, Users,
  Hash, Calendar, CheckCircle, AlertTriangle, Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../ui/Dialog';
import { cn } from '../../lib/utils';
import { useParseConversation, useImportConversation } from '../../hooks/useGodMode';

type Step = 'input' | 'preview' | 'importing';
type InputTab = 'paste' | 'upload';

const formatOptions = [
  { value: '', label: 'Auto-detect' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'slack', label: 'Slack' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'discord', label: 'Discord' },
  { value: 'zoom', label: 'Zoom Chat' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'generic', label: 'Generic Chat' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ConversationImportModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [inputTab, setInputTab] = useState<InputTab>('paste');
  const [text, setText] = useState('');
  const [formatHint, setFormatHint] = useState('');
  const [title, setTitle] = useState('');
  const [channelName, setChannelName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [skipAI, setSkipAI] = useState(false);
  const [fileName, setFileName] = useState('');
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseConversation = useParseConversation();
  const importConversation = useImportConversation();

  const handleClose = () => {
    setText(''); setFormatHint(''); setTitle(''); setChannelName('');
    setDocumentDate(''); setSkipAI(false); setFileName('');
    setPreviewData(null); setStep('input');
    onClose();
  };

  const handleFileRead = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setText(String(e.target?.result || ''));
    };
    reader.readAsText(file);
  }, []);

  const handleParse = async () => {
    if (!text.trim() || text.trim().length < 20) {
      toast.error('Conversation text is too short');
      return;
    }

    try {
      const data = await parseConversation.mutateAsync({ text, formatHint: formatHint || undefined });
      setPreviewData(data as Record<string, unknown>);
      setStep('preview');
    } catch {
      toast.error('Failed to parse conversation');
    }
  };

  const handleImport = async () => {
    if (!text.trim()) return;
    setStep('importing');
    try {
      const data = await importConversation.mutateAsync({
        text,
        formatHint: formatHint || undefined,
        meta: {
          title: title || undefined,
          channelName: channelName || undefined,
          documentDate: documentDate || undefined,
        },
        skipAI,
      });
      const result = data as Record<string, unknown>;
      toast.success(`Imported: "${result.title || 'Conversation'}" (${(result.stats as Record<string, unknown>)?.messageCount ?? '?'} messages)`);
      handleClose();
    } catch {
      toast.error('Failed to import conversation');
      setStep('preview');
    }
  };

  const stats = previewData?.stats as Record<string, unknown> | undefined;
  const messagesPreview = (previewData?.messagesPreview || []) as Array<Record<string, unknown>>;
  const warnings = (previewData?.warnings || []) as string[];

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">Import Conversation</DialogTitle>

        {/* Header */}
        <div className="px-5 py-4 shrink-0" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.25), rgba(37,99,235,0.08))' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(37,99,235,0.15)' }}>
                <Upload className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Import Conversation</h2>
                <p className="text-[10px] text-slate-300">
                  {step === 'input' && 'Paste or upload a conversation transcript'}
                  {step === 'preview' && 'Review parsed conversation before importing'}
                  {step === 'importing' && 'Importing and analyzing with AI...'}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step: Input */}
        {step === 'input' && (
          <>
            {/* Input tabs */}
            <div className="flex px-5 border-b border-[var(--gm-border-primary)] shrink-0" style={{ borderColor: 'var(--gm-border-primary)' }}>
              {[
                { key: 'paste' as InputTab, label: 'Paste Text' },
                { key: 'upload' as InputTab, label: 'Upload File' },
              ].map(t => (
                <button key={t.key} onClick={() => setInputTab(t.key)}
                  className={cn('px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
                    inputTab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200')}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[var(--gm-surface-primary)]" style={{ backgroundColor: 'var(--gm-surface-primary)' }}>
              {/* Format Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Format</label>
                  <select value={formatHint} onChange={e => setFormatHint(e.target.value)}
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus">
                    {formatOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Title (optional)</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto-generated by AI"
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Channel name (optional)</label>
                  <input value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="e.g. #project-alpha"
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Document date (optional)</label>
                  <input type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)}
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>
              </div>

              {inputTab === 'paste' && (
                <div>
                  <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Conversation text *</label>
                  <textarea value={text} onChange={e => setText(e.target.value)}
                    rows={12} placeholder={`Paste your exported conversation here...\n\nSupported formats:\n- WhatsApp: [31/01/2026, 10:00] John: Hello!\n- Slack: john [10:00 AM] Hello!\n- Discord: john — 01/31/2026 10:00 AM Hello!\n- Teams: john 10:00 AM Hello!\n- Generic: [10:00] john: Hello!`}
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus resize-y font-mono leading-relaxed" />
                </div>
              )}

              {inputTab === 'upload' && (
                <div>
                  <div className="border-2 border-dashed border-gm-border-primary rounded-xl p-12 text-center hover:border-blue-600/30 transition-colors cursor-pointer bg-[var(--gm-surface-hover)]"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFileRead(e.dataTransfer.files[0]); }}>
                    <Paperclip className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-sm font-medium text-gm-interactive-primary">Drop conversation file here</p>
                    <p className="text-xs text-gm-text-tertiary mt-1">or click to browse &middot; .txt, .chat, .log</p>
                    <input ref={fileRef} type="file" className="hidden" accept=".txt,.chat,.log,.text" onChange={e => {
                      if (e.target.files?.[0]) handleFileRead(e.target.files[0]);
                    }} />
                  </div>
                  {fileName && (
                    <div className="flex items-center gap-3 mt-4 p-3 bg-gm-surface-secondary rounded-lg border border-gm-border-primary">
                      <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gm-interactive-primary" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gm-text-primary">{fileName}</span>
                        <p className="text-[10px] text-gm-text-tertiary">{text.length.toLocaleString()} characters loaded</p>
                      </div>
                      <button onClick={() => { setText(''); setFileName(''); }} className="text-gm-text-tertiary hover:text-gm-status-danger text-lg">&times;</button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input type="checkbox" id="skipAI" checked={skipAI} onChange={e => setSkipAI(e.target.checked)}
                  className="rounded border-gm-border-primary" />
                <label htmlFor="skipAI" className="text-xs text-gm-text-tertiary">Skip AI processing (faster import, no entity extraction)</label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--gm-border-primary)] shrink-0" style={{ borderColor: 'var(--gm-border-primary)', backgroundColor: 'var(--gm-surface-secondary)' }}>
              <button onClick={handleClose} className="px-4 py-2 rounded-lg text-slate-300 text-sm font-medium hover:bg-white/10 border border-white/20 transition-colors">
                Cancel
              </button>
              <button onClick={handleParse} disabled={parseConversation.isPending || !text.trim()}
                className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-sm font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {parseConversation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Preview & Parse
              </button>
            </div>
          </>
        )}

        {/* Step: Preview */}
        {step === 'preview' && previewData && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[var(--gm-surface-primary)]" style={{ backgroundColor: 'var(--gm-surface-primary)' }}>
              {/* Parse Results */}
              <div className="bg-[var(--gm-status-success-bg)] border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-gm-status-success" />
                  <span className="text-xs font-semibold text-gm-status-success">Parsed Successfully</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <StatBox label="Format" value={String(previewData.format || 'auto')} icon={MessageSquare} />
                  <StatBox label="Confidence" value={`${Math.round(Number(previewData.confidence || 0) * 100)}%`} icon={Sparkles} />
                  <StatBox label="Messages" value={String(stats?.messageCount || 0)} icon={Hash} />
                  <StatBox label="Participants" value={String((stats?.participants as unknown[])?.length || 0)} icon={Users} />
                </div>
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="bg-[var(--gm-status-warning-bg)] border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-gm-status-warning" />
                    <span className="text-xs font-semibold text-gm-status-warning">Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => <li key={i} className="text-xs text-gm-status-warning">{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Participants */}
              {stats?.participants && (
                <div>
                  <h4 className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Participants
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(stats.participants as string[]).map((p, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-gm-surface-secondary text-gm-text-primary border border-gm-border-primary">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Range */}
              {stats?.dateRange && (
                <div className="flex items-center gap-2 text-xs text-gm-text-tertiary">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {String((stats.dateRange as Record<string, unknown>)?.first || '').split('T')[0]}
                    {' → '}
                    {String((stats.dateRange as Record<string, unknown>)?.last || '').split('T')[0]}
                  </span>
                </div>
              )}

              {/* Message Preview */}
              {messagesPreview.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Message Preview ({messagesPreview.length}{previewData.hasMore ? '+' : ''})
                  </h4>
                  <div className="bg-gm-surface-secondary rounded-xl p-3 space-y-2 max-h-64 overflow-y-auto">
                    {messagesPreview.map((msg, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-[10px] font-semibold text-gm-interactive-primary min-w-[80px] truncate">{String(msg.speaker || msg.sender || 'Unknown')}</span>
                        <span className="text-[10px] text-gm-text-secondary flex-1">{String(msg.text || msg.content || '').substring(0, 200)}</span>
                      </div>
                    ))}
                    {previewData.hasMore && (
                      <p className="text-[10px] text-gm-text-tertiary text-center italic pt-1">... more messages not shown in preview</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--gm-border-primary)] shrink-0" style={{ borderColor: 'var(--gm-border-primary)', backgroundColor: 'var(--gm-surface-secondary)' }}>
              <button onClick={() => setStep('input')} className="px-4 py-2 rounded-lg text-slate-300 text-sm font-medium hover:bg-white/10 border border-white/20 transition-colors">
                Back
              </button>
              <div className="flex gap-2">
                <button onClick={handleClose} className="px-4 py-2 rounded-lg text-slate-300 text-sm font-medium hover:bg-white/10 border border-white/20 transition-colors">
                  Cancel
                </button>
                <button onClick={handleImport}
                  className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-sm font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 transition-colors">
                  <Upload className="w-4 h-4" /> Import{!skipAI && ' & Analyze with AI'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 bg-[var(--gm-surface-primary)]" style={{ backgroundColor: 'var(--gm-surface-primary)' }}>
            <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--gm-text-primary)]">Importing conversation...</p>
              {!skipAI && <p className="text-xs text-slate-400 mt-1">AI is analyzing content, extracting entities, and generating summary</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value, icon: Icon }: { label: string; value: string; icon: typeof MessageSquare }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto mb-1 text-gm-text-tertiary" />
      <p className="text-sm font-bold text-gm-text-primary capitalize">{value}</p>
      <p className="text-[10px] text-gm-text-tertiary">{label}</p>
    </div>
  );
}
