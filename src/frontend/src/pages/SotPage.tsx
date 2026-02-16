import { useState } from 'react';
import { useQuestions, useFacts, useRisks, useActions, useDecisions } from '../hooks/useGodMode';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/Badge';

type SotTab = 'questions' | 'facts' | 'risks' | 'actions' | 'decisions';

const tabs: { key: SotTab; label: string }[] = [
  { key: 'questions', label: 'Questions' },
  { key: 'facts', label: 'Facts' },
  { key: 'risks', label: 'Risks' },
  { key: 'actions', label: 'Actions' },
  { key: 'decisions', label: 'Decisions' },
];

export default function SotPage() {
  const [activeTab, setActiveTab] = useState<SotTab>('questions');

  const questions = useQuestions();
  const facts = useFacts();
  const risks = useRisks();
  const actions = useActions();
  const decisions = useDecisions();

  const dataMap: Record<SotTab, { data: Array<Record<string, unknown>> | undefined; isLoading: boolean }> = {
    questions: { data: questions.data, isLoading: questions.isLoading },
    facts: { data: facts.data, isLoading: facts.isLoading },
    risks: { data: risks.data, isLoading: risks.isLoading },
    actions: { data: actions.data, isLoading: actions.isLoading },
    decisions: { data: decisions.data, isLoading: decisions.isLoading },
  };

  const current = dataMap[activeTab];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Source of Truth</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            {tab.label}
            {dataMap[tab.key].data && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {dataMap[tab.key].data!.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {current.isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="text-[hsl(var(--muted-foreground))]">Loading...</span>
        </div>
      ) : !current.data || current.data.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          No {activeTab} found. Process documents to extract knowledge.
        </div>
      ) : (
        <div className="space-y-2">
          {current.data.map((item, i) => (
            <div key={String(item.id ?? i)} className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {String(item.content ?? item.question ?? item.decision ?? item.task ?? item.description ?? '')}
                  </p>
                  {item.status && (
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      {String(item.status)}
                    </Badge>
                  )}
                </div>
                {item.priority && (
                  <Badge
                    variant={
                      item.priority === 'critical' || item.priority === 'high'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-[10px] shrink-0"
                  >
                    {String(item.priority)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
