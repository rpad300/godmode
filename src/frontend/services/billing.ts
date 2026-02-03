/**
 * Billing Service
 * API client for project billing and cost control
 */

import { http } from './api';

// ============================================
// TYPES
// ============================================

export interface ProjectBillingSummary {
  balance_eur: number;
  unlimited_balance: boolean;
  period_key: string;
  tokens_this_period: number;
  provider_cost_this_period: number;
  billable_cost_this_period: number;
  requests_this_period: number;
  current_tier_name: string | null;
  current_markup_percent: number;
  balance_percent_used: number;
}

export interface ProjectBillingOverview {
  project_id: string;
  project_name: string;
  balance_eur: number;
  unlimited_balance: boolean;
  tokens_this_period: number;
  billable_cost_this_period: number;
  is_blocked: boolean;
  current_tier_name: string | null;
}

export interface PricingConfig {
  id: string;
  scope: 'global' | 'project';
  project_id: string | null;
  fixed_markup_percent: number;
  period_type: 'monthly' | 'weekly';
  usd_to_eur_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pricing_tiers?: PricingTier[];
}

export interface PricingTier {
  id: string;
  pricing_config_id: string;
  token_limit: number | null;
  markup_percent: number;
  name: string | null;
  tier_order: number;
}

export interface BalanceTransaction {
  id: string;
  project_id: string;
  transaction_type: 'credit' | 'debit' | 'adjustment' | 'refund';
  amount_eur: number;
  balance_before: number;
  balance_after: number;
  llm_request_id: string | null;
  description: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface BalanceCheckResult {
  allowed: boolean;
  reason?: string;
  balance_eur: number;
  unlimited: boolean;
  tokens_in_period: number;
  current_tier_name?: string;
  current_markup_percent: number;
}

// ============================================
// ADMIN FUNCTIONS (Superadmin only)
// ============================================

/**
 * Get billing overview for all projects
 */
export async function getAllProjectsBilling(): Promise<ProjectBillingOverview[]> {
  try {
    const response = await http.get<{ success: boolean; projects: ProjectBillingOverview[] }>(
      '/api/admin/billing/projects'
    );
    return response.data?.projects || [];
  } catch (error) {
    console.error('[Billing] Error getting all projects billing:', error);
    return [];
  }
}

/**
 * Get global pricing config
 */
export async function getGlobalPricingConfig(): Promise<PricingConfig | null> {
  try {
    const response = await http.get<{ success: boolean; config: PricingConfig }>(
      '/api/admin/billing/pricing'
    );
    return response.data?.config || null;
  } catch (error) {
    console.error('[Billing] Error getting global pricing config:', error);
    return null;
  }
}

/**
 * Set global pricing config
 */
export async function setGlobalPricingConfig(config: {
  fixed_markup_percent?: number;
  period_type?: 'monthly' | 'weekly';
  usd_to_eur_rate?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await http.post<{ success: boolean; error?: string }>(
      '/api/admin/billing/pricing',
      config
    );
    return response.data || { success: false };
  } catch (error) {
    console.error('[Billing] Error setting global pricing config:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get global pricing tiers
 */
export async function getGlobalPricingTiers(): Promise<{ tiers: PricingTier[]; config_id: string | null }> {
  try {
    const response = await http.get<{ success: boolean; tiers: PricingTier[]; config_id: string }>(
      '/api/admin/billing/pricing/tiers'
    );
    return { 
      tiers: response.data?.tiers || [], 
      config_id: response.data?.config_id || null 
    };
  } catch (error) {
    console.error('[Billing] Error getting global pricing tiers:', error);
    return { tiers: [], config_id: null };
  }
}

/**
 * Set global pricing tiers
 */
export async function setGlobalPricingTiers(tiers: Array<{
  token_limit: number | null;
  markup_percent: number;
  name?: string;
}>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await http.post<{ success: boolean; error?: string }>(
      '/api/admin/billing/pricing/tiers',
      { tiers }
    );
    return response.data || { success: false };
  } catch (error) {
    console.error('[Billing] Error setting global pricing tiers:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get project billing summary (admin)
 */
export async function getProjectBillingSummaryAdmin(projectId: string): Promise<ProjectBillingSummary | null> {
  try {
    const response = await http.get<{ success: boolean; summary: ProjectBillingSummary }>(
      `/api/admin/billing/projects/${projectId}`
    );
    return response.data?.summary || null;
  } catch (error) {
    console.error('[Billing] Error getting project billing summary:', error);
    return null;
  }
}

/**
 * Get project balance (admin)
 */
export async function getProjectBalance(projectId: string): Promise<BalanceCheckResult | null> {
  try {
    const response = await http.get<BalanceCheckResult & { success: boolean }>(
      `/api/admin/billing/projects/${projectId}/balance`
    );
    if (response.data?.success) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('[Billing] Error getting project balance:', error);
    return null;
  }
}

/**
 * Credit project balance (admin)
 */
export async function creditProjectBalance(
  projectId: string, 
  amount: number, 
  description?: string
): Promise<{ success: boolean; new_balance?: number; error?: string }> {
  try {
    const response = await http.post<{ success: boolean; new_balance: number; reason?: string }>(
      `/api/admin/billing/projects/${projectId}/balance`,
      { amount, description }
    );
    return {
      success: response.data?.success || false,
      new_balance: response.data?.new_balance,
      error: response.data?.reason
    };
  } catch (error) {
    console.error('[Billing] Error crediting project balance:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Set project unlimited mode (admin)
 */
export async function setProjectUnlimited(
  projectId: string, 
  unlimited: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await http.post<{ success: boolean; unlimited: boolean }>(
      `/api/admin/billing/projects/${projectId}/balance`,
      { unlimited }
    );
    return { success: response.data?.success || false };
  } catch (error) {
    console.error('[Billing] Error setting project unlimited:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get project balance transactions (admin)
 */
export async function getBalanceTransactions(
  projectId: string, 
  limit = 50
): Promise<BalanceTransaction[]> {
  try {
    const response = await http.get<{ success: boolean; transactions: BalanceTransaction[] }>(
      `/api/admin/billing/projects/${projectId}/transactions?limit=${limit}`
    );
    return response.data?.transactions || [];
  } catch (error) {
    console.error('[Billing] Error getting balance transactions:', error);
    return [];
  }
}

/**
 * Get project pricing override (admin)
 */
export async function getProjectPricingOverride(projectId: string): Promise<{
  override: PricingConfig | null;
  using_global: boolean;
  global_config: PricingConfig | null;
}> {
  try {
    const response = await http.get<{
      success: boolean;
      override: PricingConfig | null;
      using_global: boolean;
      global_config: PricingConfig | null;
    }>(`/api/admin/billing/projects/${projectId}/pricing`);
    return {
      override: response.data?.override || null,
      using_global: response.data?.using_global ?? true,
      global_config: response.data?.global_config || null
    };
  } catch (error) {
    console.error('[Billing] Error getting project pricing override:', error);
    return { override: null, using_global: true, global_config: null };
  }
}

/**
 * Set project pricing override (admin)
 */
export async function setProjectPricingOverride(projectId: string, config: {
  fixed_markup_percent?: number;
  period_type?: 'monthly' | 'weekly';
  usd_to_eur_rate?: number;
  tiers?: Array<{
    token_limit: number | null;
    markup_percent: number;
    name?: string;
  }>;
}): Promise<{ success: boolean; config_id?: string; error?: string }> {
  try {
    const response = await http.post<{ success: boolean; config_id?: string; error?: string }>(
      `/api/admin/billing/projects/${projectId}/pricing`,
      config
    );
    return response.data || { success: false };
  } catch (error) {
    console.error('[Billing] Error setting project pricing override:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete project pricing override (admin)
 */
export async function deleteProjectPricingOverride(projectId: string): Promise<boolean> {
  try {
    const response = await http.delete<{ success: boolean }>(
      `/api/admin/billing/projects/${projectId}/pricing`
    );
    return response.data?.success || false;
  } catch (error) {
    console.error('[Billing] Error deleting project pricing override:', error);
    return false;
  }
}

// ============================================
// PROJECT FUNCTIONS (For project members)
// ============================================

/**
 * Get billing summary for current project
 */
export async function getProjectBillingSummary(projectId: string): Promise<ProjectBillingSummary | null> {
  try {
    const response = await http.get<{ success: boolean; summary: ProjectBillingSummary }>(
      `/api/projects/${projectId}/billing`
    );
    return response.data?.summary || null;
  } catch (error) {
    console.error('[Billing] Error getting project billing summary:', error);
    return null;
  }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Format currency in EUR
 */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format large numbers (tokens)
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Get tier display info
 */
export function getTierDisplayInfo(tiers: PricingTier[]): string {
  if (!tiers || tiers.length === 0) {
    return 'No tiers configured';
  }
  
  return tiers.map((tier, index) => {
    const prevLimit = index > 0 ? tiers[index - 1].token_limit : 0;
    const fromStr = formatTokens(prevLimit || 0);
    const toStr = tier.token_limit ? formatTokens(tier.token_limit) : '∞';
    return `${fromStr}-${toStr}: +${tier.markup_percent}%`;
  }).join(' | ');
}

// ============================================
// SERVICE EXPORT
// ============================================

export const billingService = {
  // Admin functions
  getAllProjectsBilling,
  getGlobalPricingConfig,
  setGlobalPricingConfig,
  getGlobalPricingTiers,
  setGlobalPricingTiers,
  getProjectBillingSummaryAdmin,
  getProjectBalance,
  creditProjectBalance,
  setProjectUnlimited,
  getBalanceTransactions,
  getProjectPricingOverride,
  setProjectPricingOverride,
  deleteProjectPricingOverride,
  
  // Project functions
  getProjectBillingSummary,
  
  // Utilities
  formatEur,
  formatTokens,
  getTierDisplayInfo
};

export default billingService;
