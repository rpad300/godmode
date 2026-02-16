import { Share2 } from 'lucide-react';

export default function GraphPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Knowledge Graph</h1>
      </div>
      <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center h-[calc(100vh-12rem)] flex items-center justify-center">
        <div>
          <Share2 className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            Knowledge graph visualization will be rendered here using React Flow.
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Process documents to populate the graph.
          </p>
        </div>
      </div>
    </div>
  );
}
