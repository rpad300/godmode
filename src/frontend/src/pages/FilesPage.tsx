import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Mic, Mail, MessageSquare, CheckCircle, Clock, AlertCircle,
  Upload, Search, Filter, Grid3X3, List, Trash2, RotateCw, Download,
  ChevronDown, X, FolderUp, Plus
} from 'lucide-react';
import { useDocuments } from '@/hooks/useGodMode';
// import { mockFiles } from '@/data/mock-data';
import type { ProcessedFile } from '@/types/godmode';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import FileDetailModal from '@/components/files/FileDetailModal';
import ImportTranscriptModal from '@/components/files/ImportTranscriptModal';
import AddEmailModal from '@/components/files/AddEmailModal';
import ImportConversationModal from '@/components/files/ImportConversationModal';
import ImportDocumentModal from '@/components/files/ImportDocumentModal';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

const typeIcon: Record<string, any> = {
  document: FileText,
  transcript: Mic,
  email: Mail,
  conversation: MessageSquare,
};

const typeLabel: Record<string, string> = {
  document: 'Document',
  transcript: 'Transcript',
  email: 'Email',
  conversation: 'Conversation',
};

type ViewMode = 'table' | 'grid';
type SortField = 'name' | 'type' | 'size' | 'status' | 'facts' | 'date';
type SortDir = 'asc' | 'desc';

const FilesPage = ({ initialFileId }: { initialFileId?: string }) => {
  const navigate = useNavigate();
  const { data: serverDocuments, refetch } = useDocuments();
  const [files, setFiles] = useState<ProcessedFile[]>([]);

  useEffect(() => {
    if (serverDocuments) {
      setFiles(serverDocuments.map(doc => ({
        id: doc.id,
        name: doc.filename,
        type: (doc.doc_type as any) || 'document',
        size: '—',
        processedAt: doc.created_at ? new Date(doc.created_at).toLocaleString() : '',
        status: (doc.status === 'completed' ? 'processed' : doc.status === 'failed' ? 'error' : doc.status) as any,
        factsExtracted: doc.facts_count || 0
      })));
    }
  }, [serverDocuments]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailFile, setDetailFile] = useState<ProcessedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importModal, setImportModal] = useState<'transcript' | 'email' | 'conversation' | 'document' | null>(null);

  useEffect(() => {
    if (initialFileId) {
      const existing = files.find(f => f.id === initialFileId);
      if (existing) {
        setDetailFile(existing);
      } else {
        apiClient.get<{ document: any }>(`/api/documents/${initialFileId}`)
          .then(data => {
            if (data.document) {
              const doc = data.document;
              const sizeKB = doc.file_size ? Math.round(doc.file_size / 1024) + ' KB' : '—';
              const file: ProcessedFile = {
                id: doc.id,
                name: doc.filename || 'Untitled',
                type: doc.doc_type || 'document',
                size: sizeKB,
                processedAt: doc.processed_at ? new Date(doc.processed_at).toLocaleString() : '',
                status: doc.status || 'pending',
                factsExtracted: doc.facts_count || 0
              };
              setFiles(prev => [file, ...prev]);
              setDetailFile(file);
            }
          })
          .catch(err => {
            console.error('Failed to load linked file:', err);
            toast.error('Failed to load file details');
          });
      }
    } else {
      // If initialFileId is undefined, make sure we clear the modal
      setDetailFile(null);
    }
  }, [initialFileId, files]);

  // URL sync removed to prevent unmount/remount cycle which closes modal for local state files
  /*
  // Update URL when detailFile changes
  useEffect(() => {
    // If we have a detail file, we want the URL to reflect it
    if (detailFile && detailFile.id !== initialFileId) {
      navigate(`/documents/${detailFile.id}`);
    }
  }, [detailFile, navigate, initialFileId]);
  */

  const handleCloseModal = () => {
    setDetailFile(null);
    navigate('/files');
  };

  const filteredFiles = useMemo(() => {
    let result = files.filter(f => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== 'all' && f.type !== filterType) return false;
      if (filterStatus !== 'all' && f.status !== filterStatus) return false;
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'facts': cmp = a.factsExtracted - b.factsExtracted; break;
        case 'date': cmp = (a.processedAt || '').localeCompare(b.processedAt || ''); break;
        default: cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [files, search, filterType, filterStatus, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const hasActiveFilters = search || filterType !== 'all' || filterStatus !== 'all';

  // Simulated upload
  const handleUpload = useCallback(async (filesToUpload: File[], folder: 'newinfo' | 'newtranscripts' = 'newinfo') => {
    setUploading(true);
    setUploadProgress(10); // Start progress

    try {
      const formData = new FormData();
      filesToUpload.forEach(file => {
        formData.append('files', file);
      });
      formData.append('folder', folder);

      await apiClient.upload('/api/upload', formData);

      setUploadProgress(100);
      toast.success(`${filesToUpload.length} file(s) uploaded successfully`);

      // Refresh documents list
      refetch();
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [serverDocuments]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleUpload(droppedFiles);
    }
  }, [handleUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected && selected.length > 0) {
      handleUpload(Array.from(selected));
    }
    e.target.value = '';
  }, [handleUpload]);

  const handleBatchDelete = () => {
    setFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
    toast.success(`${selectedIds.size} file(s) deleted`);
    clearSelection();
  };

  const handleBatchReprocess = () => {
    setFiles(prev => prev.map(f => selectedIds.has(f.id) ? { ...f, status: 'pending' as const } : f));
    toast.success(`${selectedIds.size} file(s) queued for reprocessing`);
    clearSelection();
  };

  const handleReprocess = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'pending' as const } : f));
    toast.success('File queued for reprocessing');
    setDetailFile(null);
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => toggleSort(field)}
      className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ChevronDown className={`w-3 h-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
        )}
      </span>
    </th>
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Files</h1>
          <p className="text-sm text-muted-foreground">{files.length} files · {files.filter(f => f.status === 'processed').length} processed</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setImportModal('document')} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Document
          </button>
          <button onClick={() => setImportModal('transcript')} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /> Transcript
          </button>
          <button onClick={() => setImportModal('email')} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button onClick={() => setImportModal('conversation')} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Conversation
          </button>
          <label className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload Files
            <input type="file" multiple className="hidden" onChange={handleFileInput} accept=".pdf,.docx,.txt,.eml,.json,.pptx,.xlsx,.csv" />
          </label>
        </div>
      </div>

      {/* Upload progress */}
      <AnimatePresence>
        {uploading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Upload className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm text-foreground font-medium">Uploading...</span>
              <span className="text-xs text-muted-foreground ml-auto">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" style={{ width: `${uploadProgress}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
          }`}
      >
        <FolderUp className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground/50'}`} />
        <p className="text-sm text-muted-foreground">
          {isDragging ? 'Drop files here...' : 'Drag & drop files here, or use the Upload button'}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">Supports PDF, DOCX, TXT, EML, JSON, PPTX, XLSX, CSV</p>
      </div>

      {/* Filters & Search */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="pl-9 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="transcript">Transcript</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="conversation">Conversation</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button onClick={() => { setSearch(''); setFilterType('all'); setFilterStatus('all'); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear filters
          </button>
        )}
        <div className="ml-auto flex gap-1 bg-secondary rounded-lg p-0.5">
          <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-card shadow-sm' : ''}`}>
            <List className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-card shadow-sm' : ''}`}>
            <Grid3X3 className="w-3.5 h-3.5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Batch actions */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-primary/10 rounded-lg px-4 py-2"
          >
            <span className="text-sm text-primary font-medium">{selectedIds.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={handleBatchReprocess} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors">
                <RotateCw className="w-3 h-3" /> Reprocess
              </button>
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors">
                <Download className="w-3 h-3" /> Export
              </button>
              <button onClick={handleBatchDelete} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-colors">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
              <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 w-8">
                  <Checkbox
                    checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <SortHeader field="name">File</SortHeader>
                <SortHeader field="type"><span className="hidden sm:inline">Type</span></SortHeader>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Size</th>
                <SortHeader field="status">Status</SortHeader>
                <SortHeader field="date"><span className="hidden md:inline">Processed</span></SortHeader>
                <SortHeader field="facts"><span className="hidden sm:inline text-right">Facts</span></SortHeader>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file, i) => {
                const Icon = typeIcon[file.type] || FileText;
                const isSelected = selectedIds.has(file.id);
                return (
                  <motion.tr
                    key={file.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(file.id)} />
                    </td>
                    <td className="px-4 py-3" onClick={() => setDetailFile(file)}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-foreground font-medium truncate max-w-[250px]">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" onClick={() => setDetailFile(file)}>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{file.type}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell" onClick={() => setDetailFile(file)}>{file.size}</td>
                    <td className="px-4 py-3" onClick={() => setDetailFile(file)}>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${file.status === 'processed' ? 'bg-emerald-500/10 text-emerald-500' :
                        file.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                        {file.status === 'processed' ? <CheckCircle className="w-3 h-3" /> :
                          file.status === 'pending' ? <Clock className="w-3 h-3" /> :
                            <AlertCircle className="w-3 h-3" />}
                        {file.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell" onClick={() => setDetailFile(file)}>
                      {file.processedAt || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell" onClick={() => setDetailFile(file)}>{file.factsExtracted}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {filteredFiles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No files match the current filters.</p>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFiles.map((file, i) => {
            const Icon = typeIcon[file.type] || FileText;
            const isSelected = selectedIds.has(file.id);
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setDetailFile(file)}
                className={`bg-card border rounded-xl p-4 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group ${isSelected ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(file.id)} />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground truncate mb-1">{file.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{file.type}</span>
                  <span className="text-[10px] text-muted-foreground">{file.size}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${file.status === 'processed' ? 'bg-emerald-500/10 text-emerald-500' :
                    file.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                    {file.status === 'processed' ? <CheckCircle className="w-3 h-3" /> :
                      file.status === 'pending' ? <Clock className="w-3 h-3" /> :
                        <AlertCircle className="w-3 h-3" />}
                    {file.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{file.factsExtracted} facts</span>
                </div>
                {file.processedAt && (
                  <p className="text-[10px] text-muted-foreground mt-2">{file.processedAt}</p>
                )}
              </motion.div>
            );
          })}
          {filteredFiles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 col-span-full">No files match the current filters.</p>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <FileDetailModal
        file={detailFile}
        open={!!detailFile}
        onClose={() => setDetailFile(null)}
        onReprocess={handleReprocess}
      />

      {/* Import Modals */}
      <ImportTranscriptModal
        open={importModal === 'transcript'}
        onClose={() => setImportModal(null)}
        onImport={(data) => {
          if (data.file) {
            handleUpload([data.file], 'newtranscripts').then(() => refetch());
          } else if (data.content) {
            const blob = new Blob([data.content], { type: 'text/plain' });
            const file = new File([blob], data.content.slice(0, 30).replace(/[^a-z0-9]/gi, '_') + '.txt', { type: 'text/plain' });
            handleUpload([file], 'newtranscripts').then(() => refetch());
          }
          // const newFile: ProcessedFile = { id: `new-${Date.now()}`, name: data.content?.slice(0, 30) + '.txt' || 'Transcript.txt', type: 'transcript', size: '—', processedAt: '', status: 'pending', factsExtracted: 0 };
          // setFiles(prev => [newFile, ...prev]);
          // toast.success('Transcript imported');
        }}
      />
      <AddEmailModal
        open={importModal === 'email'}
        onClose={() => setImportModal(null)}
        onImport={(data) => {
          if (data.file) {
            handleUpload([data.file], 'newinfo').then(() => refetch());
          } else if (data.content) {
            // Paste
            const blob = new Blob([data.content], { type: 'message/rfc822' });
            const file = new File([blob], 'Paste.eml', { type: 'message/rfc822' });
            handleUpload([file], 'newinfo').then(() => refetch());
          } else if (data.manual) {
            // Manual entry - create simple JSON or EML. Let's do JSON for now as it is easier
            const json = JSON.stringify(data.manual, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const file = new File([blob], (data.manual.subject || 'Email') + '.json', { type: 'application/json' });
            handleUpload([file], 'newinfo').then(() => refetch());
          }
          // const newFile: ProcessedFile = { id: `new-${Date.now()}`, name: 'Imported Email.eml', type: 'email', size: '—', processedAt: '', status: 'pending', factsExtracted: 0 };
          // setFiles(prev => [newFile, ...prev]);
          // toast.success('Email added');
        }}
      />
      <ImportConversationModal
        open={importModal === 'conversation'}
        onClose={() => setImportModal(null)}
        onImport={(data) => {
          if (data.file) {
            handleUpload([data.file], 'newinfo').then(() => refetch());
          } else if (data.content) {
            const blob = new Blob([data.content], { type: 'text/plain' });
            const file = new File([blob], 'Conversation.txt', { type: 'text/plain' });
            handleUpload([file], 'newinfo').then(() => refetch());
          }
          // const newFile: ProcessedFile = { id: `new-${Date.now()}`, name: 'Imported Conversation.json', type: 'conversation', size: '—', processedAt: '', status: 'pending', factsExtracted: 0 };
          // setFiles(prev => [newFile, ...prev]);
          // toast.success('Conversation imported');
        }}
      />
      <ImportDocumentModal
        open={importModal === 'document'}
        onClose={() => setImportModal(null)}
        onImport={(data) => {
          if (data.file) {
            handleUpload([data.file], 'newinfo').then(() => refetch());
          } else if (data.content) {
            const blob = new Blob([data.content], { type: 'text/plain' });
            const file = new File([blob], (data.title || 'Untitled') + '.txt', { type: 'text/plain' });
            handleUpload([file], 'newinfo').then(() => refetch());
          }
          // const newFile: ProcessedFile = { id: `new-${Date.now()}`, name: (data.title || 'Untitled Document') + '.txt', type: 'document', size: '—', processedAt: '', status: 'pending', factsExtracted: 0 };
          // setFiles(prev => [newFile, ...prev]);
          // toast.success('Document imported');
        }}
      />
    </div>
  );
};

export default FilesPage;
