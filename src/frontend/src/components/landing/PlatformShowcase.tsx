/**
 * Purpose:
 *   Landing page section that showcases all six platform modules
 *   (Dashboard, Knowledge Graph, Team Analysis, Source of Truth, AI Chat,
 *   Timeline) with animated mockup previews and trilingual descriptions.
 *
 * Responsibilities:
 *   - Renders six alternating left/right blocks, each pairing a text
 *     description with a MockWindow-wrapped interactive mockup component
 *   - MockWindow: reusable dark-themed browser-chrome frame
 *   - DashboardMockup: health score, metric cards, daily briefing
 *   - GraphMockup: SVG knowledge graph with animated node/edge drawing
 *   - TeamAnalysisMockup: communication density bars, member scorecards
 *   - SourceOfTruthMockup: sprint tab with action list
 *   - ChatMockup: RAG chat conversation with source citations
 *   - TimelineMockup: Gantt-like sprint progress bars
 *   - Trilingual translations (pt/en/es) for section labels and descriptions
 *
 * Key dependencies:
 *   - framer-motion: scroll-triggered fade/scale animations
 *   - lucide-react: module icons
 *   - Lang (i18n): language code type for translation selection
 *
 * Side effects:
 *   - None (purely presentational)
 *
 * Notes:
 *   - All mockup data is hardcoded; these are static illustrations, not
 *     live dashboards.
 *   - Uses HSL color values throughout for a unified dark-theme palette.
 *   - The file is large (~500 lines) because each mockup is a self-contained
 *     sub-component with its own data and layout.
 */
import { motion } from 'framer-motion';
import {
  Brain, Network, Users, MessageSquare, Target, BarChart3,
  FileText, AlertTriangle, Clock, CheckCircle2, TrendingUp,
  ArrowUpRight, ArrowDownRight, Activity, Zap, Search,
  Send, Bot, User, GitBranch, Calendar, ChevronRight
} from 'lucide-react';
import { type Lang } from '@/i18n/landing-translations';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

/* ── Window Chrome (always dark for app preview feel) ── */
const MockWindow = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`bg-[hsl(230,22%,10%)] rounded-2xl border border-[hsl(230,15%,18%)] overflow-hidden shadow-2xl ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(230,25%,8%)] border-b border-[hsl(230,15%,15%)]">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[hsl(0,72%,55%)]" />
        <div className="w-3 h-3 rounded-full bg-[hsl(38,92%,55%)]" />
        <div className="w-3 h-3 rounded-full bg-[hsl(142,70%,45%)]" />
      </div>
      <span className="text-[10px] text-[hsl(220,10%,40%)] ml-2 font-mono">{title}</span>
    </div>
    {children}
  </div>
);

/* ── 1. Dashboard Preview ── */
const DashboardMockup = () => {
  const metrics = [
    { label: 'Factos Extraídos', value: '1,247', icon: FileText, color: 'from-[hsl(200,100%,55%)] to-[hsl(220,80%,60%)]', change: '+23%', up: true },
    { label: 'Riscos Ativos', value: '38', icon: AlertTriangle, color: 'from-[hsl(0,72%,55%)] to-[hsl(330,70%,50%)]', change: '-12%', up: false },
    { label: 'Ações Pendentes', value: '156', icon: Clock, color: 'from-[hsl(38,92%,55%)] to-[hsl(15,80%,55%)]', change: '+8%', up: true },
    { label: 'Decisões', value: '89', icon: CheckCircle2, color: 'from-[hsl(142,70%,45%)] to-[hsl(165,80%,45%)]', change: '+31%', up: true },
  ];

  return (
    <MockWindow title="godmode.app/dashboard">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 bg-[hsl(230,22%,13%)] rounded-xl p-3 border border-[hsl(230,15%,16%)]">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[hsl(142,70%,45%)] to-[hsl(165,80%,45%)] flex items-center justify-center">
            <span className="text-lg font-bold text-[hsl(230,25%,5%)]">87</span>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-[hsl(220,20%,92%)]">Health Score</div>
            <div className="text-[10px] text-[hsl(220,10%,45%)]">Projeto em bom estado — 3 riscos precisam de atenção</div>
            <div className="mt-1.5 h-1.5 bg-[hsl(230,15%,18%)] rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} whileInView={{ width: '87%' }} transition={{ delay: 0.5, duration: 1 }} viewport={{ once: true }}
                className="h-full bg-gradient-to-r from-[hsl(142,70%,45%)] to-[hsl(165,80%,45%)] rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }} viewport={{ once: true }}
              className="bg-[hsl(230,22%,13%)] rounded-xl p-3 border border-[hsl(230,15%,16%)]">
              <div className="flex items-center justify-between mb-1.5">
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center`}>
                  <m.icon className="w-3 h-3 text-[hsl(230,25%,5%)]" />
                </div>
                <span className={`text-[10px] font-medium flex items-center gap-0.5 ${m.up ? 'text-[hsl(142,70%,45%)]' : 'text-[hsl(0,72%,55%)]'}`}>
                  {m.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{m.change}
                </span>
              </div>
              <div className="text-lg font-bold text-[hsl(220,20%,92%)]">{m.value}</div>
              <div className="text-[10px] text-[hsl(220,10%,45%)]">{m.label}</div>
            </motion.div>
          ))}
        </div>
        <div className="bg-[hsl(230,22%,13%)] rounded-xl p-3 border border-[hsl(230,15%,16%)]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-[hsl(38,92%,55%)]" />
            <span className="text-xs font-semibold text-[hsl(220,20%,92%)]">Daily Briefing</span>
          </div>
          <div className="space-y-1.5">
            {[
              { color: 'bg-[hsl(142,70%,45%)]', text: '5 novos factos extraídos do meeting de ontem' },
              { color: 'bg-[hsl(38,92%,55%)]', text: '2 ações aproximam-se do deadline' },
              { color: 'bg-[hsl(0,72%,55%)]', text: '1 risco escalado para prioridade alta' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${item.color} mt-1.5 shrink-0`} />
                <span className="text-[10px] text-[hsl(220,10%,55%)]">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockWindow>
  );
};

/* ── 2. Knowledge Graph Preview ── */
const GraphMockup = () => {
  const nodes = [
    { id: 'center', x: 50, y: 50, label: 'Migração Cloud', size: 22, color: 'hsl(200,100%,55%)' },
    { id: 'p1', x: 20, y: 25, label: 'João Silva', size: 14, color: 'hsl(280,80%,55%)' },
    { id: 'p2', x: 80, y: 20, label: 'Maria Santos', size: 16, color: 'hsl(280,80%,55%)' },
    { id: 'p3', x: 15, y: 75, label: 'Ana Costa', size: 12, color: 'hsl(280,80%,55%)' },
    { id: 'd1', x: 75, y: 70, label: 'Usar AWS', size: 12, color: 'hsl(142,70%,45%)' },
    { id: 'r1', x: 85, y: 45, label: 'Downtime Risk', size: 10, color: 'hsl(0,72%,55%)' },
    { id: 'f1', x: 35, y: 80, label: 'Budget: €50k', size: 10, color: 'hsl(38,92%,55%)' },
    { id: 'f2', x: 55, y: 20, label: 'Q2 Deadline', size: 10, color: 'hsl(38,92%,55%)' },
    { id: 'a1', x: 30, y: 45, label: 'Setup CI/CD', size: 11, color: 'hsl(165,80%,45%)' },
  ];

  const edges = [
    ['center', 'p1'], ['center', 'p2'], ['center', 'p3'],
    ['center', 'd1'], ['center', 'r1'], ['center', 'f1'],
    ['center', 'f2'], ['p1', 'a1'], ['p2', 'd1'], ['d1', 'r1'],
  ];

  return (
    <MockWindow title="godmode.app/knowledge-graph">
      <div className="relative h-[280px] p-4">
        <div className="flex gap-1 mb-3">
          {['Explorer', 'Ontology', 'Query', 'Analytics'].map((tab, i) => (
            <span key={tab} className={`px-2.5 py-1 rounded-md text-[10px] font-medium ${i === 0 ? 'bg-[hsl(200,100%,55%/0.15)] text-[hsl(200,100%,55%)]' : 'text-[hsl(220,10%,40%)]'}`}>{tab}</span>
          ))}
        </div>
        <svg viewBox="0 0 100 100" className="w-full h-[220px]">
          {edges.map(([from, to], i) => {
            const n1 = nodes.find(n => n.id === from)!;
            const n2 = nodes.find(n => n.id === to)!;
            return (
              <motion.line key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
                stroke="hsl(220,10%,25%)" strokeWidth="0.3"
                initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }} viewport={{ once: true }} />
            );
          })}
          {nodes.map((node, i) => (
            <motion.g key={node.id} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.07, type: 'spring' }} viewport={{ once: true }}>
              <circle cx={node.x} cy={node.y} r={node.size / 8} fill={node.color} opacity={0.2} />
              <circle cx={node.x} cy={node.y} r={node.size / 14} fill={node.color} />
              <text x={node.x} y={node.y + node.size / 6 + 1.5} textAnchor="middle" fill="hsl(220,10%,55%)" fontSize="2.2" fontWeight="500">{node.label}</text>
            </motion.g>
          ))}
        </svg>
      </div>
    </MockWindow>
  );
};

/* ── 3. Team Analysis Preview ── */
const TeamAnalysisMockup = () => {
  const members = [
    { name: 'João Silva', role: 'Tech Lead', score: 92, influence: 88, comm: 76, avatar: 'JS', style: 'Analítico' },
    { name: 'Maria Santos', role: 'CTO', score: 96, influence: 95, comm: 82, avatar: 'MS', style: 'Decisivo' },
    { name: 'Ana Costa', role: 'PM', score: 88, influence: 72, comm: 94, avatar: 'AC', style: 'Colaborativo' },
    { name: 'Pedro Mendes', role: 'Dev', score: 78, influence: 55, comm: 68, avatar: 'PM', style: 'Executor' },
  ];

  return (
    <MockWindow title="godmode.app/team-analysis">
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 bg-[hsl(230,22%,13%)] rounded-xl p-3 border border-[hsl(230,15%,16%)]">
            <div className="text-[10px] text-[hsl(220,10%,45%)] mb-1">Communication Density</div>
            <div className="text-xl font-bold text-[hsl(200,100%,55%)]">73%</div>
            <div className="flex items-end gap-0.5 mt-2 h-8">
              {[45, 62, 55, 78, 65, 82, 73].map((h, i) => (
                <motion.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} transition={{ delay: 0.3 + i * 0.05 }} viewport={{ once: true }}
                  className="flex-1 rounded-sm bg-[hsl(200,100%,55%/0.5)]" />
              ))}
            </div>
          </div>
          <div className="flex-1 bg-[hsl(230,22%,13%)] rounded-xl p-3 border border-[hsl(230,15%,16%)]">
            <div className="text-[10px] text-[hsl(220,10%,45%)] mb-1">Decision Influence</div>
            <div className="text-xl font-bold text-[hsl(280,80%,55%)]">Top: MS</div>
            <div className="flex items-end gap-0.5 mt-2 h-8">
              {[88, 95, 72, 55].map((h, i) => (
                <motion.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} transition={{ delay: 0.3 + i * 0.05 }} viewport={{ once: true }}
                  className="flex-1 rounded-sm bg-[hsl(280,80%,55%/0.5)]" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          {members.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }} viewport={{ once: true }}
              className="flex items-center gap-2.5 p-2 rounded-lg bg-[hsl(230,22%,13%)] border border-[hsl(230,15%,16%)]">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] flex items-center justify-center text-[9px] font-bold text-[hsl(230,25%,5%)]">
                {m.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[hsl(220,20%,92%)] truncate">{m.name}</div>
                <div className="text-[9px] text-[hsl(220,10%,45%)]">{m.role} · {m.style}</div>
              </div>
              <div className="flex gap-1">
                {[
                  { v: m.influence, c: 'bg-[hsl(280,80%,55%)]' },
                  { v: m.comm, c: 'bg-[hsl(200,100%,55%)]' },
                ].map((bar, j) => (
                  <div key={j} className="w-8 h-1.5 bg-[hsl(230,15%,18%)] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${bar.v}%` }} transition={{ delay: 0.6 + i * 0.1 }} viewport={{ once: true }}
                      className={`h-full rounded-full ${bar.c}`} />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </MockWindow>
  );
};

/* ── 4. Source of Truth Preview ── */
const SourceOfTruthMockup = () => {
  const tabs = ['Ações', 'Factos', 'Riscos', 'Decisões', 'Perguntas'];
  const actions = [
    { title: 'Configurar pipeline CI/CD', owner: 'JS', status: 'in_progress', priority: 'high', sprint: 'Sprint 3' },
    { title: 'Revisão de arquitetura DB', owner: 'MS', status: 'completed', priority: 'high', sprint: 'Sprint 2' },
    { title: 'Documentar APIs externas', owner: 'AC', status: 'pending', priority: 'medium', sprint: 'Sprint 3' },
    { title: 'Load testing prod', owner: 'PM', status: 'pending', priority: 'high', sprint: 'Sprint 4' },
    { title: 'Setup monitoring alerts', owner: 'JS', status: 'in_progress', priority: 'medium', sprint: 'Sprint 3' },
  ];

  const statusColors: Record<string, string> = {
    completed: 'bg-[hsl(142,70%,45%)] text-[hsl(230,25%,5%)]',
    in_progress: 'bg-[hsl(200,100%,55%)] text-[hsl(230,25%,5%)]',
    pending: 'bg-[hsl(38,92%,55%/0.15)] text-[hsl(38,92%,55%)]',
  };
  const priorityColors: Record<string, string> = {
    high: 'text-[hsl(0,72%,55%)]',
    medium: 'text-[hsl(38,92%,55%)]',
    low: 'text-[hsl(220,10%,45%)]',
  };

  return (
    <MockWindow title="godmode.app/source-of-truth">
      <div className="p-4 space-y-3">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab, i) => (
            <span key={tab} className={`px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap ${i === 0 ? 'bg-[hsl(200,100%,55%/0.15)] text-[hsl(200,100%,55%)]' : 'text-[hsl(220,10%,40%)]'}`}>{tab}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-[hsl(165,80%,45%/0.15)] text-[hsl(165,80%,45%)]">Sprint 3 — Ativo</span>
          <span className="text-[9px] text-[hsl(220,10%,40%)]">12 Jan — 26 Jan</span>
        </div>
        <div className="space-y-1.5">
          {actions.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }} viewport={{ once: true }}
              className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(230,22%,13%)] border border-[hsl(230,15%,16%)]">
              <div className={`w-1.5 h-7 rounded-full ${a.priority === 'high' ? 'bg-[hsl(0,72%,55%)]' : a.priority === 'medium' ? 'bg-[hsl(38,92%,55%)]' : 'bg-[hsl(220,10%,30%)]'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] font-medium truncate ${a.status === 'completed' ? 'line-through text-[hsl(220,10%,45%)]' : 'text-[hsl(220,20%,92%)]'}`}>{a.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-[hsl(220,10%,40%)]">{a.sprint}</span>
                  <span className={`text-[9px] font-medium ${priorityColors[a.priority]}`}>●</span>
                </div>
              </div>
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] flex items-center justify-center text-[7px] font-bold text-[hsl(230,25%,5%)]">{a.owner}</div>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${statusColors[a.status]}`}>
                {a.status === 'completed' ? '✓' : a.status === 'in_progress' ? '⟳' : '○'}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </MockWindow>
  );
};

/* ── 5. AI Chat Preview ── */
const ChatMockup = () => {
  const messages = [
    { role: 'user', text: 'Quais são os principais riscos do projeto de migração?' },
    { role: 'ai', text: 'Com base nos documentos analisados, identifiquei 3 riscos principais:\n\n**1. Downtime durante migração** (Alto)\nFonte: Reunião 15/Jan — João mencionou janela de 4h\n\n**2. Incompatibilidade de APIs legacy** (Médio)\nFonte: Email Maria → equipa, 12/Jan\n\n**3. Budget overflow** (Médio)\nOrçamento atual: €50k, estimativa revista: €62k', sources: 3 },
    { role: 'user', text: 'Quem é responsável pela mitigação do risco de downtime?' },
  ];

  return (
    <MockWindow title="godmode.app/chat">
      <div className="p-4 space-y-3 h-[320px] flex flex-col">
        <div className="flex-1 space-y-3 overflow-hidden">
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.2 }} viewport={{ once: true }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'ai' && (
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-[hsl(230,25%,5%)]" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl p-3 text-[11px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[hsl(200,100%,55%/0.15)] text-[hsl(220,20%,92%)]'
                  : 'bg-[hsl(230,22%,13%)] text-[hsl(220,10%,65%)] border border-[hsl(230,15%,16%)]'
              }`}>
                {msg.text.split('\n').map((line, j) => (
                  <p key={j} className={line.startsWith('**') ? 'font-semibold text-[hsl(220,20%,85%)] mt-1.5' : line === '' ? 'h-1' : ''}>
                    {line.replace(/\*\*/g, '')}
                  </p>
                ))}
                {'sources' in msg && (
                  <div className="mt-2 pt-2 border-t border-[hsl(230,15%,18%)] flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-[hsl(200,100%,55%)]" />
                    <span className="text-[9px] text-[hsl(200,100%,55%)]">{msg.sources} fontes citadas</span>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-[hsl(230,18%,20%)] flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-[hsl(220,10%,55%)]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <div className="flex gap-2 items-center bg-[hsl(230,22%,13%)] rounded-xl border border-[hsl(230,15%,16%)] p-2">
          <div className="flex-1 text-[10px] text-[hsl(220,10%,35%)]">Pergunte algo sobre os seus documentos...</div>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] flex items-center justify-center">
            <Send className="w-3.5 h-3.5 text-[hsl(230,25%,5%)]" />
          </div>
        </div>
      </div>
    </MockWindow>
  );
};

/* ── 6. Timeline Preview ── */
const TimelineMockup = () => {
  const sprints = [
    { name: 'Sprint 1', start: 5, width: 20, status: 'done', stories: 8 },
    { name: 'Sprint 2', start: 28, width: 22, status: 'done', stories: 12 },
    { name: 'Sprint 3', start: 53, width: 20, status: 'active', stories: 10 },
    { name: 'Sprint 4', start: 76, width: 20, status: 'planned', stories: 6 },
  ];
  const statusColors: Record<string, string> = {
    done: 'bg-[hsl(142,70%,45%)]',
    active: 'bg-[hsl(200,100%,55%)]',
    planned: 'bg-[hsl(230,15%,25%)]',
  };

  return (
    <MockWindow title="godmode.app/timeline">
      <div className="p-4 space-y-3">
        <div className="flex text-[9px] text-[hsl(220,10%,35%)]">
          {['Jan', 'Fev', 'Mar', 'Abr'].map((m) => (
            <span key={m} className="flex-1">{m}</span>
          ))}
        </div>
        <div className="space-y-2">
          {sprints.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }} viewport={{ once: true }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-medium text-[hsl(220,20%,92%)] w-14">{s.name}</span>
                <span className="text-[9px] text-[hsl(220,10%,40%)]">{s.stories} stories</span>
              </div>
              <div className="relative h-5 bg-[hsl(230,22%,13%)] rounded-md border border-[hsl(230,15%,16%)]">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${s.width}%` }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                  className={`absolute top-0.5 bottom-0.5 rounded ${statusColors[s.status]}`}
                  style={{ left: `${s.start}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
        <div className="flex gap-4 pt-1">
          {[
            { label: 'Concluído', color: 'bg-[hsl(142,70%,45%)]' },
            { label: 'Ativo', color: 'bg-[hsl(200,100%,55%)]' },
            { label: 'Planeado', color: 'bg-[hsl(230,15%,25%)]' },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1 text-[9px] text-[hsl(220,10%,45%)]">
              <span className={`w-2 h-2 rounded-sm ${l.color}`} />{l.label}
            </span>
          ))}
        </div>
      </div>
    </MockWindow>
  );
};

/* ═══ Platform Showcase Section Translations ═══ */
const showcaseT = {
  pt: {
    label: 'Plataforma',
    title: 'Explore cada módulo em',
    titleHighlight: 'detalhe',
    subtitle: 'Conheça todas as ferramentas que tornam o GodMode a plataforma mais completa de gestão de conhecimento.',
    modules: [
      { tag: 'Dashboard', title: 'Visão 360° do Projeto', desc: 'Health Score inteligente, métricas em tempo real, Daily Briefing com IA e análise estratégica automática. Tudo num só ecrã.' },
      { tag: 'Knowledge Graph', title: 'Grafos de Conhecimento Interativos', desc: 'Visualize relações entre pessoas, tópicos, decisões e riscos. Navegação radial, queries Cypher e analytics de rede.' },
      { tag: 'Team Analysis', title: 'Análise Profunda de Equipas', desc: 'Padrões de comunicação, influência nas decisões, comportamento sob pressão e competências — tudo extraído automaticamente.' },
      { tag: 'Source of Truth', title: 'A Verdade Única do Projeto', desc: 'Factos, decisões, riscos, ações e perguntas organizados por sprints. Assistente IA para sugerir, refinar e analisar.' },
      { tag: 'AI Chat', title: 'Converse com os Seus Documentos', desc: 'Chat RAG que responde com citações das fontes originais. Pergunte qualquer coisa e obtenha respostas fundamentadas.' },
      { tag: 'Timeline', title: 'Gantt Inteligente de Sprints', desc: 'Visualize sprints, user stories e milestones numa timeline interativa. Acompanhe progresso e identifique atrasos.' },
    ],
  },
  en: {
    label: 'Platform',
    title: 'Explore each module in',
    titleHighlight: 'detail',
    subtitle: 'Discover all the tools that make GodMode the most complete knowledge management platform.',
    modules: [
      { tag: 'Dashboard', title: '360° Project View', desc: 'Smart Health Score, real-time metrics, AI Daily Briefing and automatic strategic analysis. All on one screen.' },
      { tag: 'Knowledge Graph', title: 'Interactive Knowledge Graphs', desc: 'Visualize relationships between people, topics, decisions and risks. Radial navigation, Cypher queries and network analytics.' },
      { tag: 'Team Analysis', title: 'Deep Team Analysis', desc: 'Communication patterns, decision influence, behavior under pressure and skills — all extracted automatically.' },
      { tag: 'Source of Truth', title: 'The Single Source of Truth', desc: 'Facts, decisions, risks, actions and questions organized by sprints. AI assistant to suggest, refine and analyze.' },
      { tag: 'AI Chat', title: 'Chat with Your Documents', desc: 'RAG chat that answers with citations from original sources. Ask anything and get grounded answers.' },
      { tag: 'Timeline', title: 'Smart Sprint Gantt', desc: 'Visualize sprints, user stories and milestones in an interactive timeline. Track progress and identify delays.' },
    ],
  },
  es: {
    label: 'Plataforma',
    title: 'Explora cada módulo en',
    titleHighlight: 'detalle',
    subtitle: 'Descubre todas las herramientas que hacen de GodMode la plataforma más completa de gestión de conocimiento.',
    modules: [
      { tag: 'Dashboard', title: 'Visión 360° del Proyecto', desc: 'Health Score inteligente, métricas en tiempo real, Daily Briefing con IA y análisis estratégico automático. Todo en una pantalla.' },
      { tag: 'Knowledge Graph', title: 'Grafos de Conocimiento Interactivos', desc: 'Visualiza relaciones entre personas, temas, decisiones y riesgos. Navegación radial, queries Cypher y analytics de red.' },
      { tag: 'Team Analysis', title: 'Análisis Profundo de Equipos', desc: 'Patrones de comunicación, influencia en decisiones, comportamiento bajo presión y competencias — todo extraído automáticamente.' },
      { tag: 'Source of Truth', title: 'La Verdad Única del Proyecto', desc: 'Hechos, decisiones, riesgos, acciones y preguntas organizados por sprints. Asistente IA para sugerir, refinar y analizar.' },
      { tag: 'AI Chat', title: 'Conversa con tus Documentos', desc: 'Chat RAG que responde con citas de las fuentes originales. Pregunta cualquier cosa y obtén respuestas fundamentadas.' },
      { tag: 'Timeline', title: 'Gantt Inteligente de Sprints', desc: 'Visualiza sprints, user stories y milestones en un timeline interactivo. Acompaña progreso e identifica retrasos.' },
    ],
  },
};

const mockups = [DashboardMockup, GraphMockup, TeamAnalysisMockup, SourceOfTruthMockup, ChatMockup, TimelineMockup];
const moduleGradients = [
  'from-[hsl(38,92%,55%)] to-[hsl(200,100%,55%)]',
  'from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)]',
  'from-[hsl(280,80%,55%)] to-[hsl(320,70%,55%)]',
  'from-[hsl(142,70%,45%)] to-[hsl(165,80%,45%)]',
  'from-[hsl(200,100%,55%)] to-[hsl(220,80%,60%)]',
  'from-[hsl(165,80%,45%)] to-[hsl(200,100%,55%)]',
];
const moduleIcons = [BarChart3, Network, Users, Target, MessageSquare, Calendar];

interface PlatformShowcaseProps {
  lang: Lang;
}

const PlatformShowcase = ({ lang }: PlatformShowcaseProps) => {
  const t = showcaseT[lang];

  return (
    <section id="plataforma" className="relative px-6 md:px-12 py-24">
      <div className="max-w-7xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-20">
          <motion.span variants={fadeInUp} className="text-xs font-semibold uppercase tracking-widest text-primary">{t.label}</motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-bold mt-3 mb-4">
            {t.title}{' '}<span className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] bg-clip-text text-transparent">{t.titleHighlight}</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.subtitle}</motion.p>
        </motion.div>

        <div className="space-y-32">
          {t.modules.map((mod, i) => {
            const Mockup = mockups[i];
            const Icon = moduleIcons[i];
            const isReversed = i % 2 !== 0;
            return (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={staggerContainer}
                className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16`}>
                <motion.div variants={fadeInUp} className="flex-1 max-w-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${moduleGradients[i]} flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider bg-gradient-to-r ${moduleGradients[i]} bg-clip-text text-transparent`}>{mod.tag}</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">{mod.title}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">{mod.desc}</p>
                </motion.div>
                <motion.div variants={scaleIn} className="flex-1 w-full max-w-md lg:max-w-lg">
                  <Mockup />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformShowcase;
