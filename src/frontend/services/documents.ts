/**
 * Documents Service
 * Handles file upload, processing, and document management
 */

import { http } from './api';
import { toast } from './toast';

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path?: string;
  content?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  processingError?: string;
  facts_count?: number;
  questions_count?: number;
  created_at: string;
  processed_at?: string;
}

export interface UploadResult {
  success: boolean;
  files: Array<{
    filename: string;
    id: string;
    size: number;
    status: string;
  }>;
  totalSize: number;
  processingStarted: boolean;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  queueLength: number;
  completedCount: number;
  errorCount: number;
  pendingFiles: string[];
  processingFile?: string;
  completedFiles: string[];
  errors: Array<{ file: string; error: string }>;
}

export interface EmbeddingStatus {
  total: number;
  totalChunks?: number;
  embedded: number;
  pending: number;
  failed?: number;
  model?: string;
  models: string[];
  available_embedding_models?: string[];
  lastUpdated?: string;
}

export interface KnowledgeItem {
  id: string;
  content: string;
  category?: string;
  source?: string;
  embedding?: number[];
  created_at: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  subject?: string;
  summary?: string;
  messages: Array<{
    from: string;
    content: string;
    timestamp: string;
  }>;
  source_file?: string;
  created_at: string;
}

/**
 * Upload files
 */
export async function uploadFiles(files: File[], onProgress?: (progress: number) => void): Promise<UploadResult> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const xhr = new XMLHttpRequest();
  
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}

/**
 * Upload single file with text extraction
 */
export async function uploadWithExtraction(file: File): Promise<{
  id: string;
  text: string;
  pageCount?: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload-extract', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
}

/**
 * Get processing status
 */
export async function getProcessingStatus(): Promise<ProcessingStatus> {
  const response = await http.get<ProcessingStatus>('/api/processing-status');
  return response.data;
}

export interface DocumentsResponse {
  documents: Document[];
  total: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  statuses: {
    processed: number;
    pending: number;
    processing?: number;
    failed: number;
    deleted?: number;
  };
}

/**
 * Get all documents with optional status filter
 */
export interface GetDocumentsOptions {
  status?: string;
  type?: string; // documents, transcripts, emails, images
  search?: string;
  sort?: 'created_at' | 'updated_at' | 'filename';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export async function getDocuments(statusOrOptions?: string | GetDocumentsOptions): Promise<DocumentsResponse> {
  try {
    // Handle both legacy (status string) and new options object
    const options: GetDocumentsOptions = typeof statusOrOptions === 'string' 
      ? { status: statusOrOptions }
      : statusOrOptions || {};
    
    const params = new URLSearchParams();
    if (options.status && options.status !== 'all') params.set('status', options.status);
    if (options.type && options.type !== 'all') params.set('type', options.type);
    if (options.search) params.set('search', options.search);
    if (options.sort) params.set('sort', options.sort);
    if (options.order) params.set('order', options.order);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    
    const queryString = params.toString();
    const url = queryString ? `/api/documents?${queryString}` : '/api/documents';
    
    const response = await http.get<DocumentsResponse>(url);
    return {
      documents: response.data.documents || [],
      total: response.data.total || 0,
      limit: response.data.limit,
      offset: response.data.offset,
      hasMore: response.data.hasMore,
      statuses: response.data.statuses || { processed: 0, pending: 0, failed: 0, deleted: 0 }
    };
  } catch {
    return { documents: [], total: 0, statuses: { processed: 0, pending: 0, failed: 0, deleted: 0 } };
  }
}

/**
 * Get a single document
 */
export async function getDocument(id: string): Promise<Document | null> {
  try {
    const response = await http.get<{ document: Document }>(`/api/documents/${id}`);
    return response.data.document;
  } catch {
    return null;
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string, options?: { softDelete?: boolean }): Promise<void> {
  const params = options?.softDelete ? '?soft=true' : '';
  await http.delete(`/api/documents/${id}${params}`);
}

/**
 * Restore a soft-deleted document
 */
export async function restoreDocument(id: string): Promise<void> {
  await http.post(`/api/documents/${id}/restore`);
  toast.success('Document restored');
}

/**
 * Reprocess a document
 */
export async function reprocessDocument(id: string): Promise<void> {
  await http.post(`/api/documents/${id}/reprocess`);
  toast.info('Document queued for reprocessing');
}

/**
 * Get document summary
 */
export async function getDocumentSummary(id: string): Promise<string> {
  const response = await http.get<{ summary: string }>(`/api/documents/${id}/summary`);
  return response.data.summary || '';
}

/**
 * Get knowledge base items
 */
export async function getKnowledgeBase(category?: string): Promise<KnowledgeItem[]> {
  try {
    const url = category ? `/api/knowledge?category=${category}` : '/api/knowledge';
    const response = await http.get<{ items: KnowledgeItem[] }>(url);
    return response.data.items || [];
  } catch {
    return [];
  }
}

/**
 * Add knowledge item
 */
export async function addKnowledgeItem(content: string, category?: string): Promise<KnowledgeItem> {
  const response = await http.post<{ item: KnowledgeItem; id: string }>('/api/knowledge', {
    content,
    category,
  });
  return response.data.item || { id: response.data.id, content, category, created_at: new Date().toISOString() };
}

/**
 * Search knowledge base
 */
export async function searchKnowledge(query: string, limit = 10): Promise<KnowledgeItem[]> {
  const response = await http.get<{ results: KnowledgeItem[] }>(`/api/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return response.data.results || [];
}

/**
 * Get conversations
 */
export async function getConversations(): Promise<Conversation[]> {
  try {
    const response = await http.get<{ conversations: Conversation[] }>('/api/conversations');
    return response.data.conversations || [];
  } catch {
    return [];
  }
}

/**
 * Get a single conversation
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  try {
    const response = await http.get<{ conversation: Conversation }>(`/api/conversations/${id}`);
    return response.data.conversation;
  } catch {
    return null;
  }
}

/**
 * Parse conversation preview (without saving)
 */
export async function parseConversationPreview(text: string): Promise<{
  message_count: number;
  participants: string[];
  format: string;
  preview: unknown[];
}> {
  const response = await http.post<{
    message_count: number;
    participants: string[];
    format: string;
    preview: unknown[];
  }>('/api/conversations/parse', { text });
  return response.data;
}

/**
 * Import a conversation
 */
export async function importConversation(text: string, options?: { 
  skipAI?: boolean; 
  formatHint?: string;
  meta?: Record<string, unknown>;
}): Promise<Conversation> {
  const response = await http.post<{ conversation: Conversation }>('/api/conversations', { 
    text, 
    ...options 
  });
  return response.data.conversation;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  await http.delete(`/api/conversations/${id}`);
}

/**
 * Re-embed a conversation (regenerate embeddings)
 */
export async function reembedConversation(id: string): Promise<void> {
  await http.post(`/api/conversations/${id}/reembed`);
}

// ==================== Bulk Operations ====================

/**
 * Bulk delete documents
 */
export async function bulkDeleteDocuments(ids: string[]): Promise<{ deleted: number; errors: Array<{ id: string; error: string }> }> {
  const response = await http.post<{ deleted: number; errors: Array<{ id: string; error: string }> }>('/api/documents/bulk/delete', { ids });
  return response.data;
}

/**
 * Bulk reprocess documents
 */
export async function bulkReprocessDocuments(ids: string[]): Promise<{ success: boolean; message: string; ids: string[] }> {
  const response = await http.post<{ success: boolean; message: string; ids: string[] }>('/api/documents/bulk/reprocess', { ids });
  return response.data;
}

/**
 * Bulk export documents as ZIP
 */
export async function bulkExportDocuments(ids: string[], format: 'original' | 'markdown' = 'original'): Promise<Blob> {
  const response = await fetch('/api/documents/bulk/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, format }),
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to export documents');
  }
  
  return response.blob();
}

/**
 * Download bulk export
 */
export async function downloadBulkExport(ids: string[], format: 'original' | 'markdown' = 'original'): Promise<void> {
  const blob = await bulkExportDocuments(ids, format);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `documents_export_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const documentsService = {
  upload: uploadFiles,
  uploadWithExtraction,
  getProcessingStatus,
  getAll: getDocuments,
  get: getDocument,
  delete: deleteDocument,
  restore: restoreDocument,
  reprocess: reprocessDocument,
  getSummary: getDocumentSummary,
  // Bulk operations
  bulkDelete: bulkDeleteDocuments,
  bulkReprocess: bulkReprocessDocuments,
  bulkExport: bulkExportDocuments,
  downloadBulkExport,
};

// Additional knowledge functions
async function getKnowledgeStatus(): Promise<{
  total: number;
  embedded: number;
  pending: number;
  models: string[];
}> {
  try {
    const response = await http.get<{ status: { total: number; embedded: number; pending: number; models: string[] } }>('/api/knowledge/status');
    return response.data.status;
  } catch {
    return { total: 0, embedded: 0, pending: 0, models: [] };
  }
}

async function exportKnowledgeMarkdown(): Promise<string> {
  const response = await http.get<{ markdown: string }>('/api/knowledge/export?format=markdown');
  return response.data.markdown || '';
}

async function exportKnowledgeJson(): Promise<KnowledgeItem[]> {
  const response = await http.get<{ items: KnowledgeItem[] }>('/api/knowledge/export?format=json');
  return response.data.items || [];
}

async function regenerateKnowledge(): Promise<{ success: boolean; processed: number }> {
  const response = await http.post<{ success: boolean; processed: number }>('/api/knowledge/regenerate');
  return response.data;
}

async function synthesizeKnowledge(topic?: string): Promise<{ summary: string; sources: string[] }> {
  const response = await http.post<{ summary: string; sources: string[] }>('/api/knowledge/synthesize', { topic });
  return response.data;
}

export const knowledgeService = {
  getAll: getKnowledgeBase,
  add: addKnowledgeItem,
  search: searchKnowledge,
  getStatus: getKnowledgeStatus,
  exportMarkdown: exportKnowledgeMarkdown,
  exportJson: exportKnowledgeJson,
  regenerate: regenerateKnowledge,
  synthesize: synthesizeKnowledge,
};

export const conversationsService = {
  getAll: getConversations,
  get: getConversation,
  getById: getConversation, // Alias
  parsePreview: parseConversationPreview,
  import: importConversation,
  delete: deleteConversation,
  reembed: reembedConversation,
};
