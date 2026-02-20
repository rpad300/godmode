/**
 * Purpose:
 *   Modal dialog for importing chat conversations from various platforms
 *   (WhatsApp, Slack, Teams, Discord) via paste or file upload.
 *
 * Responsibilities:
 *   - Tab-based UI with paste and upload modes
 *   - Paste tab: freeform textarea with format auto-detection selector
 *     (auto, WhatsApp, Slack, Teams, Discord)
 *   - Upload tab: file input accepting .txt, .json files
 *   - Resets form state on close or submission
 *
 * Key dependencies:
 *   - Dialog (shadcn/ui): modal container
 *   - Select (shadcn/ui): format selector dropdown
 *
 * Side effects:
 *   - None (delegates import action to parent via onImport)
 *
 * Notes:
 *   - Unlike the other import modals, this one does NOT include a
 *     SprintTaskAssociation selector.
 *   - The onImport payload uses `content || fileName` which may send
 *     just a filename string without the actual file content for paste
 *     mode fallback.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: any) => void;
}

const ImportConversationModal = ({ open, onClose, onImport }: Props) => {
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('auto');
  const [fileName, setFileName] = useState('');

  const [file, setFile] = useState<File | null>(null);

  const reset = () => { setContent(''); setFormat('auto'); setFileName(''); setTab('paste'); setFile(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = () => {
    onImport({ content: content || fileName, format, file });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-lg text-white">Import Conversation</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 px-5 pt-3 border-b border-white/10">
          <button onClick={() => setTab('paste')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'paste' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            Paste Text
          </button>
          <button onClick={() => setTab('upload')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'upload' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            Upload File
          </button>
        </div>

        <div className="p-5 space-y-4">
          {tab === 'paste' ? (
            <>
              <div>
                <p className="text-sm font-medium text-white mb-2">Paste conversation or transcript:</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Paste your conversation here...\n\nSupported formats:\n• WhatsApp, Slack, Teams, Discord chats\n• Meeting transcripts (Zoom, Google Meet)\n• Email threads\n• Any text with speaker names\n\nExample:\n[10:30] John: Hello everyone\n[10:31] Jane: Hi John!\n[10:32] John: Let's discuss the project...`}
                  className="w-full min-h-[180px] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                  style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }}
                />
                <p className="text-xs text-gray-400 mt-1">Include timestamps and speaker names for better parsing.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">Format:</span>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="w-[160px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="teams">Teams</SelectItem>
                    <SelectItem value="discord">Discord</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="border-2 border-dashed rounded-xl p-8 text-center transition-colors" style={{ borderColor: 'var(--gm-border-primary, #2d2d44)' }}>
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-500" />
              <label className="cursor-pointer">
                <p className="text-sm font-medium text-blue-400">Drop chat file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse • .txt, .json</p>
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

          <div className="flex gap-2 pt-2">
            <button onClick={handleClose} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-gray-300 hover:text-white" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              Import
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportConversationModal;
