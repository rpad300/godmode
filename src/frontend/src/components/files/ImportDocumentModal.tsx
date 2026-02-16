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
          <DialogTitle className="text-lg">Import Document</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 px-5 pt-3 border-b border-border">
          <button onClick={() => setTab('paste')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'paste' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            Paste Text
          </button>
          <button onClick={() => setTab('upload')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'upload' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            Upload File
          </button>
        </div>

        <div className="p-5 space-y-4">
          {tab === 'paste' ? (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Document Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Architecture Review" className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Paste document content:</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the document content here..."
                  className="w-full min-h-[150px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
            </>
          ) : (
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <label className="cursor-pointer">
                <p className="text-sm font-medium text-primary">Drop document file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse • .pdf, .docx, .txt, .pptx, .xlsx, .csv</p>
                <input type="file" className="hidden" accept=".pdf,.docx,.txt,.pptx,.xlsx,.csv" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFileName(e.target.files[0].name);
                    setFile(e.target.files[0]);
                  }
                }} />
              </label>
              {fileName && <p className="text-sm text-foreground mt-3 font-medium">{fileName}</p>}
            </div>
          )}

          <SprintTaskAssociation sprintId={sprintId} taskId={taskId} onSprintChange={setSprintId} onTaskChange={setTaskId} />

          <div className="flex gap-2 pt-2">
            <button onClick={handleClose} className="flex-1 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Import
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDocumentModal;
