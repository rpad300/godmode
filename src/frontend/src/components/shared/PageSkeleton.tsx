import { Skeleton } from '../ui/skeleton';

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4 space-y-2">
          <Skeleton className="h-3 w-16 bg-gm-surface-secondary" />
          <Skeleton className="h-6 w-24 bg-gm-surface-secondary" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-32 bg-gm-surface-secondary" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 bg-gm-surface-secondary" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gm-border-primary bg-gm-surface-primary">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0 bg-gm-surface-secondary" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3 bg-gm-surface-secondary" />
            <Skeleton className="h-2.5 w-1/3 bg-gm-surface-secondary" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full bg-gm-surface-secondary" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5">
      <Skeleton className="h-4 w-28 mb-4 bg-gm-surface-secondary" />
      <div className="flex items-end gap-2 h-36">
        {[40, 65, 30, 80, 55, 70, 45, 60].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t bg-gm-surface-secondary" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-5 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40 bg-gm-surface-secondary" />
        <Skeleton className="h-8 w-24 rounded-lg bg-gm-surface-secondary" />
      </div>
      <StatCardSkeleton count={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton lines={4} />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}

export function EmailsSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24 bg-gm-surface-secondary" />
        <Skeleton className="h-9 w-28 rounded-lg bg-gm-surface-secondary" />
      </div>
      <StatCardSkeleton count={4} />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 max-w-sm rounded-lg bg-gm-surface-secondary" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-9 w-20 rounded-lg bg-gm-surface-secondary" />
        ))}
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

export function SotSkeleton() {
  return (
    <div className="p-5 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-36 bg-gm-surface-secondary" />
          <Skeleton className="h-5 w-20 rounded-full bg-gm-surface-secondary" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg bg-gm-surface-secondary" />
          <Skeleton className="h-8 w-20 rounded-lg bg-gm-surface-secondary" />
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg bg-gm-surface-secondary" />
        ))}
      </div>
      <StatCardSkeleton count={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
