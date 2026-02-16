import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSOTData } from '@/hooks/useGodMode';
import ActionsPanel from '@/components/sot/ActionsPanel';
import QuestionsPanel from '@/components/sot/QuestionsPanel';
import FactsPanel from '@/components/sot/FactsPanel';
import RisksPanel from '@/components/sot/RisksPanel';
import DecisionsPanel from '@/components/sot/DecisionsPanel';
import { Loader2 } from 'lucide-react';

type SotView = 'questions' | 'facts' | 'risks' | 'actions' | 'decisions';

const SourceOfTruthPage = () => {
  const [view, setView] = useState<SotView>('questions');
  const { data: sotData, isLoading } = useSOTData();

  const questions = sotData?.questions || [];
  const facts = sotData?.facts || [];
  const risks = sotData?.risks || [];
  const actions = sotData?.actions || [];
  const decisions = sotData?.decisions || [];

  const tabs: { id: SotView; label: string; count: number }[] = [
    { id: 'questions', label: 'Questions', count: questions.length },
    { id: 'facts', label: 'Facts', count: facts.length },
    { id: 'risks', label: 'Risks', count: risks.length },
    { id: 'actions', label: 'Actions', count: actions.length },
    { id: 'decisions', label: 'Decisions', count: decisions.length },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Source of Truth</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${view === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {view === 'questions' && <QuestionsPanel initialData={questions} />}
        {view === 'facts' && <FactsPanel initialData={facts} />}
        {view === 'risks' && <RisksPanel initialData={risks} />}
        {view === 'actions' && <ActionsPanel initialData={actions} />}
        {view === 'decisions' && <DecisionsPanel initialData={decisions} />}
      </motion.div>
    </div>
  );
};

export default SourceOfTruthPage;
