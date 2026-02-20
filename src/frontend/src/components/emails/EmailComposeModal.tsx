import { useState, useRef, useCallback } from 'react';
import {
  X, Send, Loader2, Paperclip, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../ui/Dialog';
import { cn } from '../../lib/utils';
import { useSendEmail, useImportEmail } from '../../hooks/useGodMode';
import { apiClient } from '../../lib/api-client';

type Mode = 'compose' | 'reply' | 'forward';
type InputTab = 'compose' | 'paste' | 'upload';

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: Mode;
  replyTo?: Record<string, unknown> | null;
}

export default function EmailComposeModal({ open, onClose, mode = 'compose', replyTo }: Props) {
  const isReply = mode === 'reply' && !!replyTo;
  const isForward = mode === 'forward' && !!replyTo;

  const [inputTab, setInputTab] = useState<InputTab>(isReply || isForward ? 'compose' : 'compose');
  const [to, setTo] = useState(isReply ? String(replyTo?.from_email || replyTo?.from || '') : '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(
    isReply ? `Re: ${String(replyTo?.subject || '')}` :
    isForward ? `Fwd: ${String(replyTo?.subject || '')}` : ''
  );
  const [body, setBody] = useState(
    isForward ? `\n\n---------- Forwarded message ----------\nFrom: ${String(replyTo?.from || replyTo?.from_name || '')}\nDate: ${replyTo?.date ? new Date(String(replyTo.date)).toLocaleString() : ''}\nSubject: ${String(replyTo?.subject || '')}\n\n${String(replyTo?.body || replyTo?.body_text || '')}` :
    isReply ? `\n\n> On ${replyTo?.date ? new Date(String(replyTo.date)).toLocaleString() : ''}, ${String(replyTo?.from || replyTo?.from_name || '')} wrote:\n> ${String(replyTo?.body || replyTo?.body_text || '').split('\n').join('\n> ')}` : ''
  );
  const [pasteContent, setPasteContent] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);
  const [aiDraft, setAiDraft] = useState('');
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const sendEmail = useSendEmail();
  const importEmail = useImportEmail();

  const handleClose = () => {
    setTo(''); setCc(''); setSubject(''); setBody(''); setPasteContent('');
    setFileName(''); fileObjRef.current = null; setAiDraft('');
    onClose();
  };

  const handleSend = async () => {
    if (inputTab === 'compose') {
      if (!to.trim() || !body.trim()) {
        toast.error('To and Body are required');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emails = to.split(',').map(e => e.trim()).filter(Boolean);
      const invalid = emails.filter(e => !emailRegex.test(e));
      if (invalid.length > 0) {
        toast.error(`Invalid email address: ${invalid[0]}`);
        return;
      }
      setSending(true);
      try {
        await sendEmail.mutateAsync({
          to: to.split(',').map(e => e.trim()).filter(Boolean),
          cc: cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : undefined,
          subject,
          body,
          replyToId: isReply ? String(replyTo?.id || '') : undefined,
        });
        toast.success(isReply ? 'Reply sent' : isForward ? 'Email forwarded' : 'Email sent');
        handleClose();
      } catch {
        toast.error('Failed to send email');
      } finally {
        setSending(false);
      }
    } else if (inputTab === 'paste') {
      if (pasteContent.trim().length < 10) {
        toast.error('Please paste email content (min 10 chars)');
        return;
      }
      setSending(true);
      try {
        await importEmail.mutateAsync({ emailText: pasteContent });
        toast.success('Email imported and analyzed');
        handleClose();
      } catch {
        toast.error('Failed to import email');
      } finally {
        setSending(false);
      }
    } else if (inputTab === 'upload') {
      const file = fileObjRef.current;
      if (!file) {
        toast.error('Please select a file');
        return;
      }
      setSending(true);
      try {
        const base64 = await fileToBase64(file);
        const isMsg = file.name.toLowerCase().endsWith('.msg');
        await importEmail.mutateAsync(
          isMsg ? { msgBase64: base64, filename: file.name } : { emlBase64: base64, filename: file.name }
        );
        toast.success('Email file imported and analyzed');
        handleClose();
      } catch {
        toast.error('Failed to import email file');
      } finally {
        setSending(false);
      }
    }
  };

  const handleInsertAiDraft = useCallback(() => {
    if (aiDraft) {
      setBody(aiDraft);
      setAiDraft('');
    }
  }, [aiDraft]);

  const handleGenerateDraft = async () => {
    if (!replyTo?.id) return;
    setGeneratingDraft(true);
    try {
      const data = await apiClient.post<{ ok?: boolean; draft?: string; response?: string }>(`/api/emails/${replyTo.id}/response`, {});
      if (data.ok || data.draft) {
        setAiDraft(data.draft || data.response || '');
        toast.success('AI draft generated');
      } else {
        toast.error('Failed to generate draft');
      }
    } catch {
      toast.error('Failed to generate draft');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.eml') || file.name.endsWith('.msg'))) {
      fileObjRef.current = file;
      setFileName(file.name);
    }
  }, []);

  const title = isReply ? 'Reply' : isForward ? 'Forward' : 'Compose Email';
  const sendLabel = inputTab === 'compose' ? (isReply ? 'Send Reply' : isForward ? 'Forward' : 'Send') : 'Import & Analyze';

  const inputTabs: { key: InputTab; label: string }[] = isReply || isForward
    ? [{ key: 'compose', label: 'Compose' }]
    : [
        { key: 'compose', label: 'Compose' },
        { key: 'paste', label: 'Paste Text' },
        { key: 'upload', label: 'Upload .eml/.msg' },
      ];

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* Header */}
        <div className="px-5 py-4 shrink-0" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.25), rgba(37,99,235,0.08))' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Input tabs */}
        {inputTabs.length > 1 && (
          <div className="flex px-5 border-b border-[var(--gm-border-primary)] shrink-0" style={{ borderColor: 'var(--gm-border-primary)' }}>
            {inputTabs.map(t => (
              <button key={t.key} onClick={() => setInputTab(t.key)}
                className={cn('px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
                  inputTab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200')}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[var(--gm-surface-primary)]" style={{ backgroundColor: 'var(--gm-surface-primary)' }}>
          {inputTab === 'compose' && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">To *</label>
                  <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com (comma-separated)"
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-sm text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setShowCc(!showCc)} className="text-[10px] text-gm-interactive-primary hover:underline flex items-center gap-1">
                    {showCc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} CC
                  </button>
                </div>
                {showCc && (
                  <div>
                    <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">CC</label>
                    <input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com"
                      className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-sm text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Subject</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject"
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-sm text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Body *</label>
                    {isReply && replyTo?.id && (
                      <button onClick={handleGenerateDraft} disabled={generatingDraft}
                        className="text-[10px] text-gm-interactive-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                        {generatingDraft ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Generate AI Draft
                      </button>
                    )}
                  </div>
                  <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..."
                    rows={10}
                    className="w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-sm text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus resize-y leading-relaxed" />
                </div>

                {aiDraft && (
                  <div className="bg-blue-600/5 border border-blue-600/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-gm-interactive-primary font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Draft</span>
                      <button onClick={handleInsertAiDraft} className="text-[10px] px-2 py-0.5 rounded bg-gm-interactive-primary text-gm-text-on-brand hover:bg-gm-interactive-primary-hover">
                        Use this draft
                      </button>
                    </div>
                    <pre className="text-xs text-gm-text-primary whitespace-pre-wrap font-sans">{aiDraft}</pre>
                  </div>
                )}
              </div>
            </>
          )}

          {inputTab === 'paste' && (
            <div>
              <label className="text-xs font-medium text-gm-text-primary mb-2 block">Paste email content:</label>
              <textarea value={pasteContent} onChange={e => setPasteContent(e.target.value)}
                placeholder={`Paste the full email content here...\n\nInclude headers if available:\nFrom: sender@example.com\nTo: recipient@example.com\nSubject: Meeting notes\nDate: Jan 31, 2026\n\nEmail body text...`}
                rows={12}
                className="w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-4 py-3 text-sm text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus resize-y font-mono leading-relaxed" />
              <p className="text-[10px] text-gm-text-tertiary mt-1.5">Include headers (From, To, Subject, Date) for better parsing. AI will analyze and extract entities.</p>
            </div>
          )}

          {inputTab === 'upload' && (
            <div>
              <div className="border-2 border-dashed border-gm-border-primary rounded-xl p-12 text-center hover:border-blue-600/30 transition-colors cursor-pointer bg-[var(--gm-surface-hover)]"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}>
                <Paperclip className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-sm font-medium text-gm-interactive-primary">Drop email file here</p>
                <p className="text-xs text-gm-text-tertiary mt-1">or click to browse &middot; .eml, .msg</p>
                <input ref={fileRef} type="file" className="hidden" accept=".eml,.msg" onChange={e => {
                  if (e.target.files?.[0]) {
                    fileObjRef.current = e.target.files[0];
                    setFileName(e.target.files[0].name);
                  }
                }} />
              </div>
              {fileName && (
                <div className="flex items-center gap-3 mt-4 p-3 bg-gm-surface-secondary rounded-lg border border-gm-border-primary">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
                    <Paperclip className="w-5 h-5 text-gm-interactive-primary" />
                  </div>
                  <span className="text-sm font-medium text-gm-text-primary flex-1 truncate">{fileName}</span>
                  <button onClick={() => { fileObjRef.current = null; setFileName(''); }} className="text-gm-text-tertiary hover:text-gm-status-danger text-lg">&times;</button>
                </div>
              )}
              <p className="text-[10px] text-gm-text-tertiary mt-3">Email will be parsed, analyzed with AI, and entities extracted automatically.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--gm-border-primary)] shrink-0" style={{ borderColor: 'var(--gm-border-primary)', backgroundColor: 'var(--gm-surface-secondary)' }}>
          <button onClick={handleClose} className="px-4 py-2 rounded-lg text-slate-300 text-sm font-medium hover:bg-white/10 border border-white/20 transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending}
            className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-sm font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sendLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
