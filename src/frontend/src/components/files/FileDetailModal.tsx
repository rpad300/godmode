import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileText, Mic, Mail, MessageSquare, CheckCircle, Clock, AlertCircle, X, ExternalLink, RotateCw } from 'lucide-react';
import { ProcessedFile } from '@/types/godmode';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const typeIcon: Record<string, any> = {
  document: FileText,
  transcript: Mic,
  email: Mail,
  conversation: MessageSquare,
};

const mockExtractedFacts = [
  'System uses microservices architecture with 12 services',
  'Sprint planning happens every Monday at 10:00',
  'Data retention policy requires 7 years for financial records',
  'MVP launch planned for Q2 2026',
];

const mockMetadata = {
  pages: 24,
  language: 'English',
  author: 'Team Lead',
  lastModified: '2026-02-10 14:32',
  encoding: 'UTF-8',
  wordCount: 8420,
};

interface Props {
  file: ProcessedFile | null;
  open: boolean;
  onClose: () => void;
  onReprocess: (id: string) => void;
}

const FileDetailModal = ({ file, open, onClose, onReprocess }: Props) => {
  if (!file) return null;

  const Icon = typeIcon[file.type] || FileText;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">File Details: {file.name}</DialogTitle>
        <DialogDescription className="sr-only">Detailed view of the selected file including metadata and extracted facts.</DialogDescription>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{file.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{file.type}</span>
                <span className="text-xs text-muted-foreground">{file.size}</span>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${file.status === 'processed' ? 'bg-emerald-500/10 text-emerald-500' :
                  file.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                  {file.status === 'processed' ? <CheckCircle className="w-3 h-3" /> :
                    file.status === 'pending' ? <Clock className="w-3 h-3" /> :
                      <AlertCircle className="w-3 h-3" />}
                  {file.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-foreground">{file.factsExtracted}</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Facts Extracted</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-foreground">{mockMetadata.pages}</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Pages</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-foreground">{mockMetadata.wordCount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Words</p>
            </div>
          </div>

          {/* Metadata */}
          <div>
            <h3 className="text-xs uppercase text-muted-foreground font-semibold mb-2">Metadata</h3>
            <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
              {[
                { label: 'Processed at', value: file.processedAt || 'Pending' },
                { label: 'Language', value: mockMetadata.language },
                { label: 'Author', value: mockMetadata.author },
                { label: 'Last Modified', value: mockMetadata.lastModified },
                { label: 'Encoding', value: mockMetadata.encoding },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="text-foreground font-medium">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Extracted Facts */}
          {file.status === 'processed' && (
            <div>
              <h3 className="text-xs uppercase text-muted-foreground font-semibold mb-2">Extracted Facts (Sample)</h3>
              <div className="space-y-1.5">
                {mockExtractedFacts.slice(0, Math.min(file.factsExtracted, 4)).map((fact, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-primary/5 rounded-lg p-2.5">
                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-foreground/90 leading-relaxed">{fact}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Preview */}
          <div>
            <h3 className="text-xs uppercase text-muted-foreground font-semibold mb-2">Content Preview</h3>
            <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground font-mono leading-relaxed max-h-32 overflow-y-auto">
              {file.type === 'transcript'
                ? '00:00:05 Speaker 1: Welcome everyone to today\'s meeting.\n00:00:12 Speaker 2: Thanks for joining. Let\'s start with the sprint review...\n00:00:25 Speaker 1: Sure. We completed 8 out of 10 stories this sprint...\n00:00:45 Speaker 3: I have a question about the auth service deployment...'
                : file.type === 'email'
                  ? 'From: sender@techcorp.com\nTo: team@techcorp.com\nSubject: ' + file.name.replace('.eml', '') + '\n\nHi Team,\n\nPlease find attached the latest requirements document...'
                  : file.type === 'conversation'
                    ? '[10:15 AM] dev_user: Has anyone reviewed the PR for the auth module?\n[10:17 AM] tech_lead: Yes, looks good. Minor comments on error handling.\n[10:18 AM] dev_user: Will address those today.'
                    : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. This document outlines the architectural decisions made during the Q1 2026 review period. Section 1: System Overview...'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onReprocess(file.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
            >
              <RotateCw className="w-3 h-3" /> Reprocess
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors">
              <ExternalLink className="w-3 h-3" /> Open Original
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileDetailModal;
