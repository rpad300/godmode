import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SprintTaskAssociation from './SprintTaskAssociation';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: {
    content: string;
    format: string;
    title: string;
    channelName: string;
    documentDate: string;
    skipAI: boolean;
    sprintId: string;
    taskId: string;
    file?: File | null;
  }) => void;
  loading?: boolean;
}

const formatOptions = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'slack', label: 'Slack' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'discord', label: 'Discord' },
  { value: 'zoom', label: 'Zoom Chat' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'generic', label: 'Generic Chat' },
];

const ImportConversationModal = ({ open, onClose, onImport, loading }: Props) => {
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('auto');
  const [title, setTitle] = useState('');
  const [channelName, setChannelName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [skipAI, setSkipAI] = useState(false);
  const [sprintId, setSprintId] = useState('none');
  const [taskId, setTaskId] = useState('none');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setContent(''); setFormat('auto'); setTitle(''); setChannelName('');
    setDocumentDate(''); setSkipAI(false); setSprintId('none'); setTaskId('none');
    setFileName(''); setTab('paste'); setFile(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const canSubmit = tab === 'paste' ? content.trim().length >= 20 : !!file;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (tab === 'upload' && file && !content) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result || '');
        onImport({ content: text, format, title, channelName, documentDate, skipAI, sprintId, taskId, file });
        reset();
        onClose();
      };
      reader.readAsText(file);
      return;
    }
    onImport({ content, format, title, channelName, documentDate, skipAI, sprintId, taskId, file });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-5 pb-0 shrink-0">
          <DialogTitle className="text-lg text-white">Import Conversation</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Import a chat conversation by pasting text or uploading a file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 px-5 pt-3 border-b border-white/10 shrink-0">
          <button onClick={() => setTab('paste')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'paste' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            Paste Text
          </button>
          <button onClick={() => setTab('upload')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'upload' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            Upload File
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {tab === 'paste' ? (
            <>
              <div>
                <p className="text-sm font-medium text-white mb-2">Paste conversation or transcript:</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Paste your conversation here...\n\nSupported formats:\n• WhatsApp, Slack, Teams, Discord, Telegram\n• Zoom Chat, Google Meet\n• Any text with speaker names\n\nExample:\n[10:30] John: Hello everyone\n[10:31] Jane: Hi John!\n[10:32] John: Let's discuss the project...`}
                  className="w-full min-h-[150px] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                  style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }}
                />
                <p className="text-xs text-gray-400 mt-1">Include timestamps and speaker names for better parsing. Min 20 characters.</p>
              </div>
            </>
          ) : (
            <div className="border-2 border-dashed rounded-xl p-8 text-center transition-colors" style={{ borderColor: 'var(--gm-border-primary, #2d2d44)' }}>
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-500" />
              <label className="cursor-pointer">
                <p className="text-sm font-medium text-blue-400">Drop chat file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse &bull; .txt, .json</p>
                <input type="file" className="hidden" accept=".txt,.json" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFileName(e.target.files[0].name);
                    setFile(e.target.files[0]);
                  }
                }} />
              </label>
              {fileName && <p className="text-sm text-white mt-3 font-medium">{fileName}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="mt-1 w-full h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Conversation Date</label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="mt-1 w-full h-8 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sprint Planning"
                className="mt-1 w-full rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Channel (optional)</label>
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. #general"
                className="mt-1 w-full rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipAI}
              onChange={(e) => setSkipAI(e.target.checked)}
              className="rounded border-gray-600"
            />
            <span className="text-xs text-gray-400">Skip AI analysis (faster, no title/summary generation)</span>
          </label>

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
              {loading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportConversationModal;
