import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  useQuestions, useCreateQuestion, useUpdateQuestion, useDeleteQuestion,
  useFacts, useCreateFact, useUpdateFact, useDeleteFact,
  useRisks, useCreateRisk, useUpdateRisk, useDeleteRisk,
  useActions, useCreateAction, useUpdateAction, useDeleteAction,
  useDecisions, useCreateDecision, useUpdateDecision, useDeleteDecision,
} from '../hooks/useGodMode';
import QuestionsPanel from '../components/sot/QuestionsPanel';
import FactsPanel from '../components/sot/FactsPanel';
import RisksPanel from '../components/sot/RisksPanel';
import ActionsPanel from '../components/sot/ActionsPanel';
import DecisionsPanel from '../components/sot/DecisionsPanel';

type SotTab = 'questions' | 'facts' | 'risks' | 'actions' | 'decisions';

export default function SotPage() {
  const [activeTab, setActiveTab] = useState<SotTab>('questions');

  // ── Queries ──
  const questions = useQuestions();
  const facts = useFacts();
  const risks = useRisks();
  const actions = useActions();
  const decisions = useDecisions();

  // ── Mutations ──
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  const createFact = useCreateFact();
  const updateFact = useUpdateFact();
  const deleteFact = useDeleteFact();

  const createRisk = useCreateRisk();
  const updateRisk = useUpdateRisk();
  const deleteRisk = useDeleteRisk();

  const createAction = useCreateAction();
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();

  const createDecision = useCreateDecision();
  const updateDecision = useUpdateDecision();
  const deleteDecision = useDeleteDecision();

  // ── Tab config ──
  const tabs: { key: SotTab; label: string; count: number }[] = [
    { key: 'questions', label: 'Questions', count: (questions.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'facts', label: 'Facts', count: (facts.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'risks', label: 'Risks', count: (risks.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'actions', label: 'Actions', count: (actions.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'decisions', label: 'Decisions', count: (decisions.data as unknown[] | undefined)?.length ?? 0 },
  ];

  const isLoading = questions.isLoading || facts.isLoading || risks.isLoading || actions.isLoading || decisions.isLoading;

  // ── Wire save: decide create vs update by checking server data ──
  function makeSaveHandler(
    serverData: Array<{ id: string }> | undefined,
    createMut: { mutate: (data: Record<string, unknown>) => void },
    updateMut: { mutate: (data: { id: string; [key: string]: unknown }) => void },
  ) {
    return (item: { id: string; [key: string]: unknown }) => {
      const exists = serverData?.some(x => x.id === item.id);
      if (exists) {
        updateMut.mutate(item);
      } else {
        const { id: _clientId, ...data } = item;
        createMut.mutate(data);
      }
    };
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Source of Truth</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Content — rich panels with API-wired CRUD */}
      {!isLoading && (
        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {activeTab === 'questions' && (
            <QuestionsPanel
              initialData={(questions.data ?? []) as any}
              onSave={makeSaveHandler(questions.data as any, createQuestion, updateQuestion)}
              onDelete={(id) => deleteQuestion.mutate(id)}
            />
          )}
          {activeTab === 'facts' && (
            <FactsPanel
              initialData={(facts.data ?? []) as any}
              onSave={makeSaveHandler(facts.data as any, createFact, updateFact)}
              onDelete={(id) => deleteFact.mutate(id)}
            />
          )}
          {activeTab === 'risks' && (
            <RisksPanel
              initialData={(risks.data ?? []) as any}
              onSave={makeSaveHandler(risks.data as any, createRisk, updateRisk)}
              onDelete={(id) => deleteRisk.mutate(id)}
            />
          )}
          {activeTab === 'actions' && (
            <ActionsPanel
              initialData={(actions.data ?? []) as any}
              onSave={makeSaveHandler(actions.data as any, createAction, updateAction)}
              onDelete={(id) => deleteAction.mutate(id)}
            />
          )}
          {activeTab === 'decisions' && (
            <DecisionsPanel
              initialData={(decisions.data ?? []) as any}
              onSave={makeSaveHandler(decisions.data as any, createDecision, updateDecision)}
              onDelete={(id) => deleteDecision.mutate(id)}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
