import { useState, useRef, useCallback } from 'react';
import { Upload, X, Link2, Loader2, Camera } from 'lucide-react';
import { cn, isValidAvatarUrl, getInitials } from '../../lib/utils';
import { apiClient } from '../../lib/api-client';

interface AvatarUploadProps {
  currentUrl?: string | null;
  name?: string;
  /** Callback-based: caller handles the upload and returns the new URL */
  onUpload?: (file: File) => Promise<string>;
  /** Endpoint-based: component POSTs the file to this endpoint automatically */
  uploadEndpoint?: string;
  /** Endpoint-based: component DELETEs this endpoint automatically */
  deleteEndpoint?: string;
  onUrlChange?: (url: string) => void;
  /** Callback-based remove */
  onRemove?: () => Promise<void>;
  /** Called after a successful endpoint-based upload */
  onUploaded?: (url: string) => void;
  /** Called after a successful endpoint-based delete */
  onRemoved?: () => void;
  size?: 'md' | 'lg' | 'xl';
  showUrlInput?: boolean;
  className?: string;
}

const SIZES = {
  md: { box: 'w-16 h-16', text: 'text-lg', icon: 'w-4 h-4' },
  lg: { box: 'w-24 h-24', text: 'text-2xl', icon: 'w-5 h-5' },
  xl: { box: 'w-32 h-32', text: 'text-3xl', icon: 'w-6 h-6' },
};

const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_SIZE = 5 * 1024 * 1024;

export function AvatarUpload({
  currentUrl, name = '', onUpload, uploadEndpoint, deleteEndpoint,
  onUrlChange, onRemove, onUploaded, onRemoved,
  size = 'lg', showUrlInput: showUrlInputProp = true, className
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlInputVisible, setUrlInputVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [imgError, setImgError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = SIZES[size];
  const initials = getInitials(name);

  const displayUrl = previewUrl || (isValidAvatarUrl(currentUrl) ? currentUrl : null);
  const hasImage = displayUrl && !imgError;
  const canRemove = !!(onRemove || deleteEndpoint);
  const canUrl = showUrlInputProp && !!onUrlChange;

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_SIZE) return;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setImgError(false);
    setUploading(true);
    try {
      if (onUpload) {
        await onUpload(file);
      } else if (uploadEndpoint) {
        const fd = new FormData();
        fd.append('file', file);
        const result = await apiClient.upload<{ avatar_url: string }>(uploadEndpoint, fd);
        onUploaded?.(result.avatar_url);
      }
    } catch {
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }, [onUpload, uploadEndpoint, onUploaded]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim() && onUrlChange) {
      onUrlChange(urlInput.trim());
      setUrlInputVisible(false);
      setUrlInput('');
      setImgError(false);
      setPreviewUrl(null);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      if (onRemove) {
        await onRemove();
      } else if (deleteEndpoint) {
        await apiClient.delete(deleteEndpoint);
        onRemoved?.();
      }
      setPreviewUrl(null);
      setImgError(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          s.box, 'relative rounded-full overflow-hidden cursor-pointer group transition-all',
          dragOver && 'ring-2 ring-[var(--gm-accent-primary)] ring-offset-2 ring-offset-[var(--gm-bg-primary)]',
          'hover:ring-2 hover:ring-[var(--gm-accent-primary)]/40'
        )}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        {hasImage ? (
          <img src={displayUrl} alt={name} className="w-full h-full object-cover"
            onError={() => setImgError(true)} />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center bg-gradient-to-br', gradientFor(name))}>
            <span className={cn(s.text, 'font-bold text-white')}>{initials}</span>
          </div>
        )}

        <div className={cn(
          'absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
          uploading && 'opacity-100'
        )}>
          {uploading ? (
            <Loader2 className={cn(s.icon, 'text-white animate-spin')} />
          ) : (
            <Camera className={cn(s.icon, 'text-white')} />
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept={ACCEPT} onChange={onFileChange} className="hidden" />

      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--gm-text-secondary)] hover:text-[var(--gm-accent-primary)] hover:bg-[var(--gm-surface-hover)] transition-colors disabled:opacity-50">
          <Upload className="w-3 h-3" /> Upload
        </button>
        {canUrl && (
          <button type="button" onClick={() => setUrlInputVisible(!urlInputVisible)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--gm-text-secondary)] hover:text-[var(--gm-accent-primary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
            <Link2 className="w-3 h-3" /> URL
          </button>
        )}
        {(hasImage || isValidAvatarUrl(currentUrl)) && canRemove && (
          <button type="button" onClick={handleRemove}
            disabled={removing}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--color-danger-500)] hover:bg-[var(--color-danger-500)]/10 transition-colors disabled:opacity-50">
            {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Remove
          </button>
        )}
      </div>

      {urlInputVisible && (
        <div className="flex items-center gap-1.5 w-full max-w-xs">
          <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
            placeholder="https://..."
            onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
            className="flex-1 h-7 px-2 text-[10px] rounded border border-[var(--gm-border-primary)] bg-[var(--gm-bg-secondary)] text-[var(--gm-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gm-accent-primary)]" />
          <button type="button" onClick={handleUrlSubmit}
            className="h-7 px-2 rounded text-[10px] font-medium bg-[var(--gm-accent-primary)] text-white hover:opacity-90 transition-opacity">
            Set
          </button>
        </div>
      )}

      <p className="text-[9px] text-[var(--gm-text-tertiary)] text-center">
        JPG, PNG, GIF or WebP · Max 5 MB
      </p>
    </div>
  );
}
