import { usePendingFiles } from '../hooks/useGodMode';
import { FolderOpen, FileText } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

export default function FilesPage() {
  const { data: pendingFiles = [], isLoading } = usePendingFiles();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading files...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Files</h1>
        <Badge variant="secondary">{pendingFiles.length} pending</Badge>
      </div>

      {pendingFiles.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          No files pending. Drag and drop files into the sidebar to add them.
        </div>
      ) : (
        <div className="space-y-2">
          {pendingFiles.map((file) => (
            <div
              key={`${file.folder}/${file.filename}`}
              className="flex items-center gap-3 rounded-lg border bg-[hsl(var(--card))] p-3"
            >
              <FileText className="h-5 w-5 text-[hsl(var(--muted-foreground))] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{file.filename}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {file.folder} &middot; {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {file.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
