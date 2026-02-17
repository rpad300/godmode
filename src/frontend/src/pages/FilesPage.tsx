import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Mic, Mail, MessageSquare, Upload, RotateCw, Trash2, Search,
  Loader2, CheckCircle, Clock, AlertCircle, FolderOpen, Filter, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePendingFiles, useDeletePendingFile, useUploadFiles, useProcessFiles,
  useDocuments, useDeleteDocument, useReprocessDocument,
  type DocumentItem,
} from '../hooks/useGodMode';

const typeIcon: Record<string, typeof FileText> = {
  documents: FileText,
  transcripts: Mic,
  emails: Mail,
  images: MessageSquare,
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'processed': case 'completed': return { icon: CheckCircle, cls: 'bg-success/10 text-success' };
    case 'processing': return { icon: Loader2, cls: 'bg-primary/10 text-primary' };
    case 'pending': return { icon: Clock, cls: 'bg-warning/10 text-warning' };
    default: return { icon: AlertCircle, cls: 'bg-destructive/10 text-destructive' };
  }
};

export default function FilesPage() {
  const [tab, setTab] = useState<'documents' | 'pending'>('documents');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // ── Queries ──
  const documents = useDocuments({ search: search || undefined, type: typeFilter || undefined, status: statusFilter || undefined, limit: 100 });
  const pending = usePendingFiles();

  // ── Mutations ──
  const uploadFiles = useUploadFiles();
  const processFiles = useProcessFiles();
  const deleteDocument = useDeleteDocument();
  const reprocessDocument = useReprocessDocument();
  const deletePendingFile = useDeletePendingFile();

  const docList = documents.data?.documents ?? [];
  const statusCounts = documents.data?.statusCounts;
  const pendingFiles = pending.data ?? [];

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFiles.mutate(
      { files: Array.from(files), type: 'newinfo' },
      {
        onSuccess: () => toast.success(`${files.length} file(s) uploaded`),
        onError: () => toast.error('Upload failed'),
      },
    );
  };

  const handleProcess = () => {
    processFiles.mutate(undefined, {
      onSuccess: () => toast.success('Processing started'),
      onError: () => toast.error('Processing failed to start'),
    });
  };

  const handleDeleteDoc = (id: string) => {
    deleteDocument.mutate(id, {
      onSuccess: () => { toast.success('Document deleted'); setSelectedDoc(null); },
    });
  };

  const handleReprocess = (id: string) => {
    reprocessDocument.mutate(id, {
      onSuccess: () => toast.success('Reprocessing started'),
    });
  };

  // ── Detail view ──
  if (selectedDoc) {
    const sb = statusBadge(selectedDoc.status);
    const Icon = typeIcon[selectedDoc.type || ''] || FileText;
    const entities = selectedDoc.entity_counts;
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedDoc(null)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted">
            <ChevronDown className="w-4 h-4 text-muted-foreground rotate-90" />
          </button>
          <Icon className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{selectedDoc.original_filename || selectedDoc.filename}</h2>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${sb.cls}`}>
              <sb.icon className="w-3 h-3" /> {selectedDoc.status}
            </span>
          </div>
          <button onClick={() => handleReprocess(selectedDoc.id)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5" /> Reprocess
          </button>
          <button onClick={() => handleDeleteDoc(selectedDoc.id)} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Type', value: selectedDoc.type || 'unknown' },
            { label: 'Size', value: selectedDoc.size ? `${(Number(selectedDoc.size) / 1024).toFixed(1)} KB` : '—' },
            { label: 'Created', value: selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleDateString() : '—' },
            { label: 'Updated', value: selectedDoc.updated_at ? new Date(selectedDoc.updated_at).toLocaleDateString() : '—' },
          ].map(m => (
            <div key={m.label} className="bg-card border border-border rounded-xl p-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</span>
              <p className="text-sm font-medium text-foreground mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Entity counts */}
        {entities && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(entities).map(([key, val]) => (
              <div key={key} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-lg font-bold text-primary">{val ?? 0}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{key}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content preview */}
        {selectedDoc.content_preview && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Content Preview</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-[12]">{selectedDoc.content_preview}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Main list view ──
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Files & Documents</h1>
        <div className="flex gap-2">
          {pendingFiles.length > 0 && (
            <button onClick={handleProcess} disabled={processFiles.isPending} className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 flex items-center gap-1.5 disabled:opacity-50">
              {processFiles.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              Process {pendingFiles.length} file(s)
            </button>
          )}
          <label className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        <button onClick={() => setTab('documents')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'documents' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Documents <span className="ml-1 text-[10px] opacity-60">{documents.data?.total ?? 0}</span>
        </button>
        <button onClick={() => setTab('pending')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Pending <span className="ml-1 text-[10px] opacity-60">{pendingFiles.length}</span>
        </button>
      </div>

      {/* Status counts */}
      {tab === 'documents' && statusCounts && (
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Processed', value: statusCounts.processed ?? 0, color: 'text-success' },
            { label: 'Processing', value: statusCounts.processing ?? 0, color: 'text-primary' },
            { label: 'Pending', value: statusCounts.pending ?? 0, color: 'text-warning' },
            { label: 'Failed', value: statusCounts.failed ?? 0, color: 'text-destructive' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {tab === 'documents' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All types</option>
            <option value="documents">Documents</option>
            <option value="transcripts">Transcripts</option>
            <option value="emails">Emails</option>
            <option value="images">Images</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All statuses</option>
            <option value="processed">Processed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      )}

      {/* Content */}
      {tab === 'documents' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {documents.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : docList.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              No documents found. Upload files to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {docList.map(doc => {
                const sb = statusBadge(doc.status);
                const Icon = typeIcon[doc.type || ''] || FileText;
                return (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {doc.original_filename || doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {doc.type && <span className="text-[10px] text-muted-foreground capitalize">{doc.type}</span>}
                          {doc.size && <span className="text-[10px] text-muted-foreground">{(Number(doc.size) / 1024).toFixed(1)} KB</span>}
                          {doc.created_at && <span className="text-[10px] text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${sb.cls}`}>
                        <sb.icon className={`w-3 h-3 ${doc.status === 'processing' ? 'animate-spin' : ''}`} /> {doc.status}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'pending' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {pending.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pendingFiles.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              No pending files. Upload files to add them to the processing queue.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingFiles.map(file => (
                <div key={`${file.folder}/${file.filename}`} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{file.folder}</span>
                      <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">{file.status}</span>
                  <button
                    onClick={() => deletePendingFile.mutate({ folder: file.folder, filename: file.filename })}
                    className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
