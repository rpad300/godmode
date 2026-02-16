import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
        <Settings className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
        <p>Settings page - configuration options will be available here.</p>
      </div>
    </div>
  );
}
