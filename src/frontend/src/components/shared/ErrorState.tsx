import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong loading this data.', onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <AlertTriangle className="h-10 w-10 text-red-500/60" />
      <p className="text-sm text-gm-text-tertiary max-w-md">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
