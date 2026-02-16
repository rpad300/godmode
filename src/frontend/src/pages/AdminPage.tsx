import { Shield } from 'lucide-react';

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin</h1>
      <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
        <Shield className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
        <p>Admin panel - system stats, user management, and more.</p>
      </div>
    </div>
  );
}
