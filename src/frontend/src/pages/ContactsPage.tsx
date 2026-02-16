import { useContacts } from '../hooks/useGodMode';
import { Users } from 'lucide-react';

export default function ContactsPage() {
  const { data, isLoading } = useContacts();
  const contacts = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contacts</h1>

      {contacts.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          No contacts found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact, i) => (
            <div key={String(contact.id ?? i)} className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{String(contact.name ?? 'Unknown')}</div>
                  {contact.role && (
                    <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {String(contact.role)}
                    </div>
                  )}
                  {contact.email && (
                    <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {String(contact.email)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
