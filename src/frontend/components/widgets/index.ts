/**
 * Widgets Index
 * Re-exports all dashboard widgets
 */

export { createStatsCard, updateStatsCard, createStatsGrid } from './StatsCard';
export type { StatsCardProps } from './StatsCard';

export { createHealthIndicator, createHealthBadge, getHealthColor, getHealthStatus } from './HealthIndicator';
export type { HealthIndicatorProps } from './HealthIndicator';

export { createTrendChart } from './TrendChart';
export type { TrendChartProps } from './TrendChart';

export { createRiskMatrix, createRiskSummary } from './RiskMatrix';
export type { RiskMatrixProps } from './RiskMatrix';
