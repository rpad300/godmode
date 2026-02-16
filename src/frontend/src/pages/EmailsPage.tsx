import { useEmails } from '../hooks/useGodMode';
import { Mail } from 'lucide-react';

export default function EmailsPage() {
  const { data, isLoading } = useEmails();
  const emails = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading emails...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Emails</h1>

      {emails.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          <Mail className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          No emails imported yet.
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email, i) => (
            <div key={String(email.id ?? i)} className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <div className="font-medium text-sm">{String(email.subject ?? 'No subject')}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {String(email.from ?? '')} {email.date ? `- ${new Date(String(email.date)).toLocaleDateString()}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
