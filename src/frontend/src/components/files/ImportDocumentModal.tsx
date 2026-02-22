import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileText, Loader2 } from 'lucide-react';
import SprintTaskAssociation from './SprintTaskAssociation';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: { content: string; title: string; sprintId: string; taskId: string; file?: File | null }) => void;
  loading?: boolean;
}

const ImportDocumentModal = ({ open, onClose, onImport, loading }: Props) => {
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [sprintId, setSprintId] = useState('none');
  const [taskId, setTaskId] = useState('none');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const reset = () => { setContent(''); setTitle(''); setSprintId('none'); setTaskId('none'); setFileName(''); setTab('paste'); setFile(null); };
  const handleClose = () => { reset(); onClose(); };

  const canSubmit = tab === 'paste' ? content.trim().length > 0 : !!file;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onImport({ content, title, sprintId, taskId, file });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-5 pb-0 shrink-0">
          <DialogTitle className="text-lg text-white">Import Document</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Import a document by pasting text or uploading a file.
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
                <label className="text-xs font-medium text-gray-400">Document Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Architecture Review" className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', borderColor: 'var(--gm-border-primary, #2d2d44)', border: '1px solid var(--gm-border-primary, #2d2d44)' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-white mb-2">Paste document content:</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the document content here..."
                  className="w-full min-h-[150px] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                  style={{ backgroundColor: 'var(--gm-surface-secondary, #252540)', border: '1px solid var(--gm-border-primary, #2d2d44)' }}
                />
              </div>
            </>
          ) : (
            <div className="border-2 border-dashed rounded-xl p-8 text-center transition-colors" style={{ borderColor: 'var(--gm-border-primary, #2d2d44)' }}>
              <FileText className="w-10 h-10 mx-auto mb-3 text-gray-500" />
              <label className="cursor-pointer">
                <p className="text-sm font-medium text-blue-400">Drop document file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse &bull; .pdf, .docx, .txt, .pptx, .xlsx, .csv</p>
                <input type="file" className="hidden" accept=".pdf,.docx,.txt,.pptx,.xlsx,.csv" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFileName(e.target.files[0].name);
                    setFile(e.target.files[0]);
                  }
                }} />
              </label>
              {fileName && <p className="text-sm text-white mt-3 font-medium">{fileName}</p>}
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
              {loading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDocumentModal;
