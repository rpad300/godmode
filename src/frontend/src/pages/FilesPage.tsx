import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Mic, Mail, MessageSquare, Upload, RotateCw, Trash2, Search,
  Loader2, CheckCircle, Clock, AlertCircle, FolderOpen,
  Star, Download, List, Archive, LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePendingFiles, useDeletePendingFile, useUploadFiles, useProcessFiles,
  useDocuments, useDeleteDocument, useReprocessDocument, useProcessStatus,
  useToggleDocumentFavorite, useRestoreDocument,
  useBulkDeleteDocuments, useBulkReprocessDocuments, useBulkExportDocuments,
  type DocumentItem,
} from '../hooks/useGodMode';
import FileDetailModal from '../components/files/FileDetailModal';

const typeIcon: Record<string, typeof FileText> = {
  documents: FileText,
  transcripts: Mic,
  emails: Mail,
  images: MessageSquare,
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'processed': case 'completed': return { icon: CheckCircle, cls: 'bg-gm-status-success-bg text-gm-status-success' };
    case 'processing': return { icon: Loader2, cls: 'bg-blue-600/10 text-gm-interactive-primary' };
    case 'pending': return { icon: Clock, cls: 'bg-gm-status-warning-bg text-gm-status-warning' };
    case 'deleted': return { icon: Archive, cls: 'bg-gm-surface-secondary text-gm-text-tertiary' };
    default: return { icon: AlertCircle, cls: 'bg-gm-status-danger-bg text-gm-status-danger' };
  }
};

export default function FilesPage() {
  const [tab, setTab] = useState<'documents' | 'pending' | 'deleted'>('documents');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [favOnly, setFavOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalDoc, setModalDoc] = useState<DocumentItem | null>(null);

  const documents = useDocuments({
    search: search || undefined,
    type: typeFilter || undefined,
    status: tab === 'deleted' ? 'deleted' : (statusFilter || undefined),
    limit: 100,
  });
  const pending = usePendingFiles();
  const { data: processStatus } = useProcessStatus();

  const uploadFiles = useUploadFiles();
  const processFiles = useProcessFiles();
  const deleteDocument = useDeleteDocument();
  const reprocessDocument = useReprocessDocument();
  const deletePendingFile = useDeletePendingFile();
  const toggleFavorite = useToggleDocumentFavorite();
  const restoreDocument = useRestoreDocument();
  const bulkDelete = useBulkDeleteDocuments();
  const bulkReprocess = useBulkReprocessDocuments();
  const bulkExport = useBulkExportDocuments();

  const isProcessing = processStatus?.status === 'processing' || processFiles.isPending;
  const rawDocList = documents.data?.documents ?? [];
  const statusCounts = documents.data?.statusCounts;
  const pendingFiles = pending.data ?? [];

  const docList = useMemo(() => {
    if (!favOnly) return rawDocList;
    return rawDocList.filter(d => (d as Record<string, unknown>).is_favorite);
  }, [rawDocList, favOnly]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(docList.map(d => d.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFiles.mutate(
      { files: Array.from(files), type: 'documents' },
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

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    bulkDelete.mutate(ids, {
      onSuccess: () => { toast.success(`${ids.length} document(s) deleted`); clearSelection(); },
      onError: () => toast.error('Bulk delete failed'),
    });
  };

  const handleBulkReprocess = () => {
    const ids = Array.from(selectedIds);
    bulkReprocess.mutate(ids, {
      onSuccess: () => { toast.success(`${ids.length} document(s) queued for reprocessing`); clearSelection(); },
      onError: () => toast.error('Bulk reprocess failed'),
    });
  };

  const handleBulkExport = () => {
    const ids = Array.from(selectedIds);
    bulkExport.mutate({ ids }, {
      onSuccess: () => { toast.success('Export downloaded'); clearSelection(); },
      onError: () => toast.error('Export failed'),
    });
  };

  const handleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleFavorite.mutate(id);
  };

  const handleRestore = (id: string) => {
    restoreDocument.mutate(id, {
      onSuccess: () => toast.success('Document restored'),
    });
  };

  const renderDocCard = (doc: DocumentItem) => {
    const sb = statusBadge(doc.status);
    const Icon = typeIcon[doc.type || ''] || FileText;
    const isFav = !!(doc as Record<string, unknown>).is_favorite;
    const isSelected = selectedIds.has(doc.id);

    if (viewMode === 'grid') {
      return (
        <motion.div
          key={doc.id}
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-gm-surface-primary border rounded-xl p-4 hover:border-blue-600/30 transition-all cursor-pointer group relative ${isSelected ? 'border-gm-interactive-primary ring-2 ring-blue-600/20' : 'border-gm-border-primary'}`}
          onClick={() => setModalDoc(doc)}
        >
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(doc.id)}
              onClick={e => e.stopPropagation()}
              className="w-3.5 h-3.5 rounded border-gm-border-primary accent-gm-interactive-primary"
            />
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <button onClick={(e) => handleFavorite(e, doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-gm-text-tertiary hover:text-yellow-400'}`} />
            </button>
          </div>
          <div className="flex flex-col items-center pt-4">
            <div className="w-12 h-12 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mb-3">
              <Icon className="w-5 h-5 text-gm-interactive-primary" />
            </div>
            <p className="text-sm font-medium text-gm-text-primary truncate w-full text-center">{doc.original_filename || doc.filename}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {doc.type && <span className="text-[10px] text-gm-text-tertiary capitalize">{doc.type}</span>}
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${sb.cls}`}>
                <sb.icon className={`w-3 h-3 ${doc.status === 'processing' ? 'animate-spin' : ''}`} /> {doc.status || '—'}
              </span>
            </div>
            {doc.size && <span className="text-[10px] text-gm-text-tertiary mt-1">{(Number(doc.size) / 1024).toFixed(1)} KB</span>}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={doc.id}
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`bg-gm-surface-primary border rounded-xl p-3.5 hover:border-blue-600/30 transition-all cursor-pointer group ${isSelected ? 'border-gm-interactive-primary ring-2 ring-blue-600/20' : 'border-gm-border-primary'}`}
        onClick={() => setModalDoc(doc)}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(doc.id)}
            onClick={e => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-gm-border-primary accent-gm-interactive-primary flex-shrink-0"
          />
          <button onClick={(e) => handleFavorite(e, doc.id)} className="flex-shrink-0">
            <Star className={`w-4 h-4 transition-colors ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`} />
          </button>
          <Icon className="w-5 h-5 text-gm-text-tertiary group-hover:text-gm-interactive-primary transition-colors flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gm-text-primary truncate group-hover:text-gm-interactive-primary transition-colors">
              {doc.original_filename || doc.filename}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {doc.type && <span className="text-[10px] text-gm-text-tertiary capitalize">{doc.type}</span>}
              {doc.size && <span className="text-[10px] text-gm-text-tertiary">{(Number(doc.size) / 1024).toFixed(1)} KB</span>}
              {doc.created_at && <span className="text-[10px] text-gm-text-tertiary">{new Date(doc.created_at).toLocaleDateString()}</span>}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${sb.cls}`}>
            <sb.icon className={`w-3 h-3 ${doc.status === 'processing' ? 'animate-spin' : ''}`} /> {doc.status || '—'}
          </span>
          <a
            href={`/api/documents/${doc.id}/download`}
            onClick={e => e.stopPropagation()}
            className="w-7 h-7 rounded-lg hover:bg-gm-surface-hover flex items-center justify-center text-gm-text-tertiary hover:text-gm-text-primary transition-colors opacity-0 group-hover:opacity-100"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gm-text-primary">Files & Documents</h1>
        <div className="flex gap-2">
          {(pendingFiles.length > 0 || isProcessing) && (
            <button onClick={handleProcess} disabled={isProcessing} className="px-3 py-1.5 rounded-lg bg-gm-interactive-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-interactive-secondary-hover flex items-center gap-1.5 disabled:opacity-50">
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              {isProcessing ? 'Processing...' : `Process ${pendingFiles.length} file(s)`}
            </button>
          )}
          <label className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gm-surface-secondary rounded-xl p-1">
        {([
          { key: 'documents' as const, label: 'Documents', count: documents.data?.total ?? 0 },
          { key: 'pending' as const, label: 'Pending', count: pendingFiles.length },
          { key: 'deleted' as const, label: 'Deleted', count: statusCounts?.deleted ?? 0 },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); clearSelection(); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-gm-surface-primary text-gm-text-primary shadow-sm' : 'text-gm-text-tertiary hover:text-gm-text-primary'}`}
          >
            {t.label} <span className="ml-1 text-[10px] opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Processing progress bar */}
      {isProcessing && processStatus && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-blue-600/5 border border-blue-600/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gm-interactive-primary" />
              <span className="text-sm font-medium text-gm-text-primary">Processing files...</span>
            </div>
            <span className="text-xs text-gm-text-tertiary">
              {processStatus.processedFiles ?? 0} / {processStatus.totalFiles ?? '?'} files
            </span>
          </div>
          {processStatus.currentFile && (
            <p className="text-xs text-gm-text-tertiary mb-2 truncate">Current: {processStatus.currentFile}</p>
          )}
          <div className="w-full bg-gm-surface-secondary rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-gm-interactive-primary h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${processStatus.progress ?? ((processStatus.processedFiles && processStatus.totalFiles) ? Math.round(((processStatus.processedFiles ?? 0) / (processStatus.totalFiles || 1)) * 100) : 0)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      )}

      {/* Status counts */}
      {tab === 'documents' && statusCounts && (
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Processed', value: statusCounts.processed ?? 0, color: 'text-gm-status-success' },
            { label: 'Processing', value: statusCounts.processing ?? 0, color: 'text-gm-interactive-primary' },
            { label: 'Pending', value: statusCounts.pending ?? 0, color: 'text-gm-status-warning' },
            { label: 'Failed', value: statusCounts.failed ?? 0, color: 'text-gm-status-danger' },
          ].map(s => (
            <div key={s.label} className="bg-gm-surface-primary border border-gm-border-primary rounded-lg px-3 py-2 flex items-center gap-2">
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters + View toggle */}
      {(tab === 'documents' || tab === 'deleted') && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-3 py-1.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
            />
          </div>
          {tab === 'documents' && (
            <>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus">
                <option value="">All types</option>
                <option value="documents">Documents</option>
                <option value="transcripts">Transcripts</option>
                <option value="emails">Emails</option>
                <option value="images">Images</option>
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus">
                <option value="">All statuses</option>
                <option value="processed">Processed</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
              <button
                onClick={() => setFavOnly(!favOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${favOnly ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-600' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary'}`}
              >
                <Star className={`w-3.5 h-3.5 ${favOnly ? 'fill-yellow-400' : ''}`} /> Favorites
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-1 bg-gm-surface-secondary rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gm-surface-primary shadow-sm text-gm-text-primary' : 'text-gm-text-tertiary hover:text-gm-text-primary'}`}>
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gm-surface-primary shadow-sm text-gm-text-primary' : 'text-gm-text-tertiary hover:text-gm-text-primary'}`}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk selection bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 bg-blue-600/5 border border-blue-600/20 rounded-xl px-4 py-2.5"
          >
            <span className="text-sm font-medium text-gm-text-primary">{selectedIds.size} selected</span>
            <button onClick={selectAll} className="text-xs text-gm-interactive-primary hover:underline">Select all</button>
            <button onClick={clearSelection} className="text-xs text-gm-text-tertiary hover:underline">Clear</button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleBulkExport}
                disabled={bulkExport.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs hover:bg-gm-surface-hover transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button
                onClick={handleBulkReprocess}
                disabled={bulkReprocess.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs hover:bg-gm-interactive-primary-hover transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" /> Reprocess
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gm-status-danger-bg text-gm-status-danger text-xs hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Documents tab */}
      {tab === 'documents' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {documents.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" />
            </div>
          ) : docList.length === 0 ? (
            <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-8 text-center text-gm-text-tertiary">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              {favOnly ? 'No favorite documents.' : 'No documents found. Upload files to get started.'}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-2'}>
              {docList.map(doc => renderDocCard(doc))}
            </div>
          )}
        </motion.div>
      )}

      {/* Deleted tab */}
      {tab === 'deleted' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {documents.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" />
            </div>
          ) : rawDocList.length === 0 ? (
            <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-8 text-center text-gm-text-tertiary">
              <Archive className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              No deleted documents.
            </div>
          ) : (
            <div className="space-y-2">
              {rawDocList.map(doc => {
                const Icon = typeIcon[doc.type || ''] || FileText;
                return (
                  <div key={doc.id} className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-3.5 flex items-center gap-3 opacity-70">
                    <Icon className="w-5 h-5 text-gm-text-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gm-text-primary truncate">{doc.original_filename || doc.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {doc.type && <span className="text-[10px] text-gm-text-tertiary capitalize">{doc.type}</span>}
                        {doc.created_at && <span className="text-[10px] text-gm-text-tertiary">{new Date(doc.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(doc.id)}
                      className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Pending tab */}
      {tab === 'pending' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {pending.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" />
            </div>
          ) : pendingFiles.length === 0 ? (
            <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-8 text-center text-gm-text-tertiary">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              No pending files. Upload files to add them to the processing queue.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingFiles.map(file => (
                <div key={`${file.folder}/${file.filename}`} className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-3.5 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gm-text-tertiary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gm-text-primary truncate">{file.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gm-text-tertiary">{file.folder}</span>
                      <span className="text-[10px] text-gm-text-tertiary">{((file.size ?? 0) / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning font-medium">{file.status || '—'}</span>
                  <button
                    onClick={() => deletePendingFile.mutate({ folder: file.folder, filename: file.filename })}
                    className="w-7 h-7 rounded-lg hover:bg-gm-status-danger-bg flex items-center justify-center text-gm-text-tertiary hover:text-gm-status-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <FileDetailModal
        file={modalDoc}
        open={!!modalDoc}
        onClose={() => setModalDoc(null)}
        onReprocess={(id) => {
          reprocessDocument.mutate(id, { onSuccess: () => toast.success('Reprocessing started') });
        }}
        onDelete={(id) => {
          deleteDocument.mutate(id, { onSuccess: () => { toast.success('Document deleted'); setModalDoc(null); } });
        }}
      />
    </div>
  );
}
