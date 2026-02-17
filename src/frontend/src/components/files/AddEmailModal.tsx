/**
 * Purpose:
 *   Modal dialog for importing email content into the system via three
 *   input methods: paste text, upload .eml/.msg file, or manual entry.
 *
 * Responsibilities:
 *   - Tab-based UI with paste, upload, and manual entry modes
 *   - Paste tab: freeform textarea for pasted email content with headers
 *   - Upload tab: drag-and-drop / click-to-browse file input (.eml, .msg)
 *   - Manual tab: structured fields for from, to, cc, subject, body, date
 *   - SprintTaskAssociation selector for linking the email to a sprint/task
 *   - Resets all form state on close or submission
 *
 * Key dependencies:
 *   - Dialog (shadcn/ui): modal container
 *   - SprintTaskAssociation: sprint/task selector sub-component
 *
 * Side effects:
 *   - None (delegates import action to parent via onImport callback)
 *
 * Notes:
 *   - The onImport payload includes the raw tab value so the parent
 *     can decide how to parse based on input method.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail } from 'lucide-react';
import SprintTaskAssociation from './SprintTaskAssociation';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: any) => void;
}

const AddEmailModal = ({ open, onClose, onImport }: Props) => {
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

  const handleSubmit = () => {
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
          <DialogTitle className="text-lg">Add Email</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 px-5 pt-3 border-b border-border shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {tab === 'paste' && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Paste email content:</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Paste the full email content here...\n\nInclude headers if available:\nFrom: sender@example.com\nTo: recipient@example.com\nSubject: Meeting notes\nDate: Jan 31, 2026\n\nEmail body text...`}
                className="w-full min-h-[180px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">Include headers (From, To, Subject, Date) for better parsing.</p>
            </div>
          )}

          {tab === 'upload' && (
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors">
              <Mail className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <label className="cursor-pointer">
                <p className="text-sm font-medium text-primary">Drop email file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse • .eml, .msg</p>
                <input type="file" className="hidden" accept=".eml,.msg" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFileName(e.target.files[0].name);
                    setFile(e.target.files[0]);
                  }
                }} />
              </label>
              {fileName && <p className="text-sm text-foreground mt-3 font-medium">{fileName}</p>}
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">From *</label>
                  <input value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} placeholder="sender@example.com" className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <input type="datetime-local" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">To *</label>
                <input value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} placeholder="recipient@example.com (comma-separated)" className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">CC</label>
                <input value={manual.cc} onChange={(e) => setManual({ ...manual, cc: e.target.value })} placeholder="cc@example.com (comma-separated)" className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <input value={manual.subject} onChange={(e) => setManual({ ...manual, subject: e.target.value })} placeholder="Email subject" className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Body *</label>
                <textarea value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} placeholder="Email content..." className="mt-1 w-full min-h-[80px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
              </div>
            </div>
          )}

          <SprintTaskAssociation sprintId={sprintId} taskId={taskId} onSprintChange={setSprintId} onTaskChange={setTaskId} />

          <div className="flex gap-2 pt-2">
            <button onClick={handleClose} className="flex-1 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Add Email
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmailModal;
