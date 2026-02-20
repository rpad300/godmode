/**
 * Purpose:
 *   Modal dialog for importing documents via paste or file upload, with
 *   optional sprint/task association.
 *
 * Responsibilities:
 *   - Tab-based UI with paste and upload modes
 *   - Paste tab: title input and freeform textarea for document content
 *   - Upload tab: file input accepting .pdf, .docx, .txt, .pptx, .xlsx,
 *     .csv
 *   - SprintTaskAssociation selector for linking the document to a
 *     sprint/task
 *   - Resets form state on close or submission
 *
 * Key dependencies:
 *   - Dialog (shadcn/ui): modal container
 *   - SprintTaskAssociation: sprint/task selector sub-component
 *
 * Side effects:
 *   - None (delegates import action to parent via onImport)
 *
 * Notes:
 *   - The onImport payload uses `content || fileName` for the content
 *     field, which sends the filename as content when pasting is empty
 *     but a file was previously uploaded. This may be unintentional.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import SprintTaskAssociation from './SprintTaskAssociation';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: any) => void;
}

const ImportDocumentModal = ({ open, onClose, onImport }: Props) => {
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [sprintId, setSprintId] = useState('none');
  const [taskId, setTaskId] = useState('none');
  const [fileName, setFileName] = useState('');

  const [file, setFile] = useState<File | null>(null);

  const reset = () => { setContent(''); setTitle(''); setSprintId('none'); setTaskId('none'); setFileName(''); setTab('paste'); setFile(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = () => {
    onImport({ content: content || fileName, title, sprintId, taskId, file });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-lg text-white">Import Document</DialogTitle>
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
                <p className="text-xs text-gray-400 mt-1">or click to browse • .pdf, .docx, .txt, .pptx, .xlsx, .csv</p>
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
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              Import
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDocumentModal;
