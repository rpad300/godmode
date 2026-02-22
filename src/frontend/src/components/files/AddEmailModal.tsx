import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mail, Loader2 } from 'lucide-react';
import SprintTaskAssociation from './SprintTaskAssociation';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: {
    tab: string;
    content: string;
    manual: { from: string; date: string; to: string; cc: string; subject: string; body: string };
    sprintId: string;
    taskId: string;
    file?: File | null;
  }) => void;
  loading?: boolean;
}

const AddEmailModal = ({ open, onClose, onImport, loading }: Props) => {
  const [tab, setTab] = useState<'paste' | 'upload' | 'manual'>('paste');
  const [content, setContent] = useState('');
  const [sprintId, setSprintId] = useState('none');
  const [taskId, setTaskId] = useState('none');
  const [fileName, setFileName] = useState('');
  const [manual, setManual] = useState({ from: '', date: '', to: '', cc: '', subject: '', body: '' });
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setContent(''); setSprintId('none'); setTaskId('none'); setFileName(''); setTab('paste');
    setManual({ from: '', date: '', to: '', cc: '', subject: '', body: '' });
    setFile(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const canSubmit =
    (tab === 'paste' && content.trim().length > 0) ||
    (tab === 'upload' && !!file) ||
    (tab === 'manual' && manual.from.trim().length > 0 && manual.to.trim().length > 0 && manual.body.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onImport({ tab, content, manual, sprintId, taskId, file });
    reset();
    onClose();
  };

  const tabs = [
    { id: 'paste' as const, label: 'Paste Text' },
    { id: 'upload' as const, label: 'Upload .eml/.msg' },
    { id: 'manual' as const, label: 'Manual Entry' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-5 pb-0 shrink-0">
          <DialogTitle className="text-lg text-white">Add Email</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Import an email by pasting, uploading, or entering details manually.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 px-5 pt-3 border-b border-white/10 shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {tab === 'paste' && (
            <div>
              <p className="text-sm font-medium text-white mb-2">Paste email content:</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Paste the full email content here...\n\nInclude headers if available:\nFrom: sender@example.com\nTo: recipient@example.com\nSubject: Meeting notes\nDate: Jan 31, 2026\n\nEmail body text...`}
                className="w-full min-h-[180px] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }}
              />
              <p className="text-xs text-gray-400 mt-1">Include headers (From, To, Subject, Date) for better parsing.</p>
            </div>
          )}

          {tab === 'upload' && (
            <div className="border-2 border-dashed rounded-xl p-8 text-center transition-colors" style={{ borderColor: 'var(--gm-border-primary, #2d2d44)' }}>
              <Mail className="w-10 h-10 mx-auto mb-3 text-gray-500" />
              <label className="cursor-pointer">
                <p className="text-sm font-medium text-blue-400">Drop email file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse &bull; .eml, .msg</p>
                <input type="file" className="hidden" accept=".eml,.msg" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFileName(e.target.files[0].name);
                    setFile(e.target.files[0]);
                  }
                }} />
              </label>
              {fileName && <p className="text-sm text-white mt-3 font-medium">{fileName}</p>}
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-400">From *</label>
                  <input value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} placeholder="sender@example.com" className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">Date</label>
                  <input type="datetime-local" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400">To *</label>
                <input value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} placeholder="recipient@example.com (comma-separated)" className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400">CC</label>
                <input value={manual.cc} onChange={(e) => setManual({ ...manual, cc: e.target.value })} placeholder="cc@example.com (comma-separated)" className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400">Subject</label>
                <input value={manual.subject} onChange={(e) => setManual({ ...manual, subject: e.target.value })} placeholder="Email subject" className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400">Body *</label>
                <textarea value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} placeholder="Email content..." className="mt-1 w-full min-h-[80px] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }} />
              </div>
            </div>
          )}

          <SprintTaskAssociation sprintId={sprintId} taskId={taskId} onSprintChange={setSprintId} onTaskChange={setTaskId} />

          <div className="flex gap-2 pt-2">
            <button onClick={handleClose} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-gray-300 hover:text-white" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)' }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Adding...' : 'Add Email'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmailModal;
