/**
 * Dashboard Service
 * Fetches dashboard data, stats, trends, and health metrics
 */

import { http } from './api';

// Types
export interface DashboardData {
  documents: {
    total: number;
    processed: number;
    pending: number;
  };
  totalFacts: number;
  factsByCategory?: Record<string, number>;
  factsVerifiedCount?: number;
  totalQuestions: number;
  totalDecisions: number;
  totalRisks: number;
  totalActions: number;
  totalPeople: number;
  questionsByPriority: {
    critical: number;
    high: number;
    medium: number;
    resolved: number;
  };
  risksByImpact: {
    high: number;
    medium: number;
    low: number;
  };
  overdueActions: number;
  overdueItems: Array<{
    id: string;
    content: string;
    assignee?: string;
    due_date?: string;
  }>;
  questionAging: {
    fresh: number;    // 0-3 days
    aging: number;    // 4-7 days
    stale: number;    // 8-14 days
    critical: number; // 14+ days
  };
  oldestQuestions: Array<{
    id: string;
    content: string;
    created_at: string;
    priority?: string;
  }>;
  trends?: TrendData;
  trendInsights?: Record<string, unknown>;
}

export interface TrendData {
  hasTrends: boolean;
  periodDays: number;
  compareDate: string;
  facts: TrendMetric;
  questions: TrendMetric;
  risks: TrendMetric;
  actions: TrendMetric;
  decisions: TrendMetric;
}

export interface TrendMetric {
  current: number;
  previous: number;
  delta: number;
  direction: 'up' | 'down' | 'stable';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface TrendHistory {
  date: string;
  facts: number;
  questions: number;
  risks: number;
  actions: number;
  decisions: number;
  // Index signature for dynamic access
  [key: string]: string | number;
}

export interface HealthData {
  score: number; // 0-100
  status: 'Healthy' | 'Good' | 'Needs Attention' | 'At Risk' | 'Critical';
  color: string;
  factors: Array<{
    type: 'positive' | 'negative';
    factor: string;
    impact: number;
    detail: string;
  }>;
  calculatedAt: string;
}

export interface Insight {
  type: 'warning' | 'alert' | 'info' | 'positive';
  icon: string;
  title: string;
  message: string;
  suggestion: string;
  category: 'workload' | 'risk' | 'timeline' | 'knowledge' | 'progress';
}

export interface Alert {
  severity: 'critical' | 'high' | 'warning';
  type: 'action' | 'risk' | 'question';
  title: string;
  message: string;
  owner?: string;
  assignee?: string;
  id: string | number;
}

/**
 * Get full dashboard data
 */
export async function getDashboard(): Promise<DashboardData | null> {
  try {
    const response = await http.get<DashboardData>('/api/dashboard');
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Get basic stats
 */
export async function getStats(): Promise<{
  documents: { total: number; processed: number; pending: number };
  facts: number;
  questions: { total: number; pending: number; resolved: number; critical: number };
  decisions: number;
  risks: number;
  people: number;
} | null> {
  try {
    const response = await http.get('/api/stats');
    return response.data as {
      documents: { total: number; processed: number; pending: number };
      facts: number;
      questions: { total: number; pending: number; resolved: number; critical: number };
      decisions: number;
      risks: number;
      people: number;
    };
  } catch {
    return null;
  }
}

/**
 * Get trends data
 */
export async function getTrends(days = 7): Promise<{
  trends: TrendData;
  history: TrendHistory[];
} | null> {
  try {
    const response = await http.get<{ trends: TrendData; history: TrendHistory[] }>(`/api/trends?days=${days}`);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Get health score
 */
export async function getHealth(): Promise<HealthData | null> {
  try {
    const response = await http.get<HealthData>('/api/sot/health');
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Get insights
 */
export async function getInsights(): Promise<Insight[]> {
  try {
    const response = await http.get<{ insights: Insight[] }>('/api/sot/insights');
    return response.data.insights || [];
  } catch {
    return [];
  }
}

/**
 * Get alerts
 */
export async function getAlerts(): Promise<Alert[]> {
  try {
    const response = await http.get<{ alerts: Alert[] }>('/api/sot/alerts');
    return response.data.alerts || [];
  } catch {
    return [];
  }
}

/**
 * Load all dashboard data in parallel
 */
export async function loadDashboardData(): Promise<{
  dashboard: DashboardData | null;
  health: HealthData | null;
  insights: Insight[];
  alerts: Alert[];
}> {
  const [dashboard, health, insights, alerts] = await Promise.all([
    getDashboard(),
    getHealth(),
    getInsights(),
    getAlerts(),
  ]);

  return { dashboard, health, insights, alerts };
}

// Export as namespace
export const dashboardService = {
  getDashboard,
  getStats,
  getTrends,
  getHealth,
  getInsights,
  getAlerts,
  loadAll: loadDashboardData,
};
