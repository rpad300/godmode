/**
 * Charts Store
 * Chart instances and visualization state
 */

import type { Chart } from 'chart.js';

// Types
export interface ChartInstance {
  id: string;
  chart: Chart | null;
  container: string;
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';
}

export interface NetworkInstance {
  id: string;
  network: unknown | null;
  container: string;
}

export interface ChartsState {
  charts: Map<string, ChartInstance>;
  networks: Map<string, NetworkInstance>;
  activeChart: string | null;
}

// State
const state: ChartsState = {
  charts: new Map(),
  networks: new Map(),
  activeChart: null,
};

// Listeners
const listeners: Set<() => void> = new Set();

/**
 * Notify listeners
 */
function notify(): void {
  listeners.forEach(fn => fn());
}

/**
 * Register a chart instance
 */
export function registerChart(id: string, chart: Chart, container: string, type: ChartInstance['type']): void {
  state.charts.set(id, { id, chart, container, type });
  notify();
}

/**
 * Get a chart instance
 */
export function getChart(id: string): Chart | null {
  return state.charts.get(id)?.chart ?? null;
}

/**
 * Destroy and remove a chart
 */
export function destroyChart(id: string): void {
  const instance = state.charts.get(id);
  if (instance?.chart) {
    instance.chart.destroy();
  }
  state.charts.delete(id);
  notify();
}

/**
 * Update chart data
 */
export function updateChartData(id: string, data: unknown): void {
  const instance = state.charts.get(id);
  if (instance?.chart) {
    instance.chart.data = data as Chart['data'];
    instance.chart.update();
  }
}

/**
 * Register a network visualization
 */
export function registerNetwork(id: string, network: unknown, container: string): void {
  state.networks.set(id, { id, network, container });
  notify();
}

/**
 * Get a network instance
 */
export function getNetwork(id: string): unknown | null {
  return state.networks.get(id)?.network ?? null;
}

/**
 * Destroy and remove a network
 */
export function destroyNetwork(id: string): void {
  const instance = state.networks.get(id);
  if (instance?.network && typeof (instance.network as { destroy?: () => void }).destroy === 'function') {
    (instance.network as { destroy: () => void }).destroy();
  }
  state.networks.delete(id);
  notify();
}

/**
 * Set active chart for highlighting
 */
export function setActiveChart(id: string | null): void {
  state.activeChart = id;
  notify();
}

/**
 * Get all chart IDs
 */
export function getChartIds(): string[] {
  return Array.from(state.charts.keys());
}

/**
 * Get all network IDs
 */
export function getNetworkIds(): string[] {
  return Array.from(state.networks.keys());
}

/**
 * Destroy all charts and networks
 */
export function destroyAll(): void {
  state.charts.forEach((instance) => {
    if (instance.chart) {
      instance.chart.destroy();
    }
  });
  state.networks.forEach((instance) => {
    if (instance.network && typeof (instance.network as { destroy?: () => void }).destroy === 'function') {
      (instance.network as { destroy: () => void }).destroy();
    }
  });
  state.charts.clear();
  state.networks.clear();
  state.activeChart = null;
  notify();
}

/**
 * Subscribe to changes
 */
export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Export as namespace
export const chartsStore = {
  registerChart,
  getChart,
  destroyChart,
  updateChartData,
  registerNetwork,
  getNetwork,
  destroyNetwork,
  setActiveChart,
  getChartIds,
  getNetworkIds,
  destroyAll,
  subscribe,
};
