/**
 * Billing Module Tests
 * Tests for balance operations, blocking, unlimited mode, and tier calculations
 */

// Mock Supabase client
const mockRpc = jest.fn();
const mockFrom = jest.fn(() => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      order: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    in: jest.fn(() => Promise.resolve({ data: [], error: null }))
  })),
  insert: jest.fn(() => ({
    select: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
    }))
  })),
  update: jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve({ error: null }))
  })),
  upsert: jest.fn(() => ({
    select: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
    }))
  })),
  delete: jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve({ error: null }))
  }))
}));

jest.mock('../../src/supabase/client', () => ({
  getClient: () => ({
    rpc: mockRpc,
    from: mockFrom
  }),
  getAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom
  })
}));

// Mock notifications
jest.mock('../../src/supabase/notifications', () => ({
  createNotification: jest.fn(() => Promise.resolve({ success: true }))
}));

const billing = require('../../src/supabase/billing');

describe('Billing Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkProjectBalance', () => {
    it('should allow unlimited projects', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          allowed: true,
          reason: null,
          balance_eur: 100,
          unlimited: true,
          tokens_in_period: 50000,
          current_tier_name: 'Tier 1',
          current_markup_percent: 20
        }],
        error: null
      });

      const result = await billing.checkProjectBalance('project-123');
      
      expect(result.allowed).toBe(true);
      expect(result.unlimited).toBe(true);
      expect(result.balance_eur).toBe(100);
    });

    it('should block projects with zero balance', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          allowed: false,
          reason: 'No balance available. Contact admin to add funds.',
          balance_eur: 0,
          unlimited: false,
          tokens_in_period: 10000,
          current_tier_name: null,
          current_markup_percent: 0
        }],
        error: null
      });

      const result = await billing.checkProjectBalance('project-123');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No balance available');
      expect(result.balance_eur).toBe(0);
    });

    it('should block when balance is insufficient for estimated cost', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          allowed: false,
          reason: 'Insufficient balance. Available: €5.00, Required: €10.00',
          balance_eur: 5,
          unlimited: false,
          tokens_in_period: 5000,
          current_tier_name: 'Tier 1',
          current_markup_percent: 20
        }],
        error: null
      });

      const result = await billing.checkProjectBalance('project-123', 10);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient balance');
    });

    it('should allow when balance is sufficient', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          allowed: true,
          reason: null,
          balance_eur: 50,
          unlimited: false,
          tokens_in_period: 30000,
          current_tier_name: 'Tier 2',
          current_markup_percent: 15
        }],
        error: null
      });

      const result = await billing.checkProjectBalance('project-123', 5);
      
      expect(result.allowed).toBe(true);
      expect(result.balance_eur).toBe(50);
    });

    it('should handle errors gracefully and allow by default', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Database error'));

      const result = await billing.checkProjectBalance('project-123');
      
      // On error, should allow to avoid blocking legitimate requests
      expect(result.allowed).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  describe('debitProjectBalance', () => {
    it('should debit balance successfully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          success: true,
          new_balance: 45,
          reason: null
        }],
        error: null
      });

      const result = await billing.debitProjectBalance('project-123', 5);
      
      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(45);
    });

    it('should fail when insufficient balance', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          success: false,
          new_balance: 2,
          reason: 'Insufficient balance'
        }],
        error: null
      });

      const result = await billing.debitProjectBalance('project-123', 10);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Insufficient balance');
    });

    it('should record transaction for unlimited projects without deducting', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          success: true,
          new_balance: 100, // Balance unchanged
          reason: null
        }],
        error: null
      });

      const result = await billing.debitProjectBalance('project-123', 5);
      
      expect(result.success).toBe(true);
    });
  });

  describe('creditProjectBalance', () => {
    it('should add funds successfully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          success: true,
          new_balance: 150,
          reason: null
        }],
        error: null
      });

      const result = await billing.creditProjectBalance('project-123', 50, 'admin-1');
      
      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(150);
    });

    it('should handle errors', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          success: false,
          new_balance: 0,
          reason: 'Project not found'
        }],
        error: null
      });

      const result = await billing.creditProjectBalance('invalid-project', 50);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Project not found');
    });
  });

  describe('calculateBillableCost', () => {
    it('should calculate billable cost with markup', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          provider_cost_eur: 0.092,
          billable_cost_eur: 0.1104, // 20% markup
          markup_percent: 20,
          tier_id: 'tier-1',
          period_key: '2026-02',
          usd_to_eur_rate: 0.92
        }],
        error: null
      });

      const result = await billing.calculateBillableCost('project-123', 0.10, 5000);
      
      expect(result.provider_cost_eur).toBeCloseTo(0.092);
      expect(result.billable_cost_eur).toBeCloseTo(0.1104);
      expect(result.markup_percent).toBe(20);
    });

    it('should fallback to no markup on error', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Database error'));

      const result = await billing.calculateBillableCost('project-123', 0.10, 5000);
      
      // Should return provider cost without markup
      expect(result.provider_cost_eur).toBeCloseTo(0.092);
      expect(result.billable_cost_eur).toBeCloseTo(0.092);
      expect(result.markup_percent).toBe(0);
    });
  });

  describe('setProjectUnlimited', () => {
    it('should enable unlimited mode', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await billing.setProjectUnlimited('project-123', true);
      
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('set_project_unlimited', expect.objectContaining({
        p_project_id: 'project-123',
        p_unlimited: true
      }));
    });

    it('should disable unlimited mode', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await billing.setProjectUnlimited('project-123', false);
      
      expect(result).toBe(true);
    });
  });

  describe('getCurrentPeriodKey', () => {
    it('should return monthly period key', () => {
      const key = billing.getCurrentPeriodKey('monthly');
      expect(key).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
    });

    it('should return weekly period key', () => {
      const key = billing.getCurrentPeriodKey('weekly');
      expect(key).toMatch(/^\d{4}-\d{2}$/); // YYYY-WW format
    });
  });

  describe('Tier calculations', () => {
    it('should apply correct tier based on token consumption', async () => {
      // First call for 0-100k tokens (Tier 1: 50% markup)
      mockRpc.mockResolvedValueOnce({
        data: [{
          provider_cost_eur: 0.092,
          billable_cost_eur: 0.138, // 50% markup
          markup_percent: 50,
          tier_id: 'tier-1',
          period_key: '2026-02',
          usd_to_eur_rate: 0.92
        }],
        error: null
      });

      const result1 = await billing.calculateBillableCost('project-123', 0.10, 50000);
      expect(result1.markup_percent).toBe(50);

      // Second call for >100k tokens (Tier 2: 30% markup)
      mockRpc.mockResolvedValueOnce({
        data: [{
          provider_cost_eur: 0.092,
          billable_cost_eur: 0.1196, // 30% markup
          markup_percent: 30,
          tier_id: 'tier-2',
          period_key: '2026-02',
          usd_to_eur_rate: 0.92
        }],
        error: null
      });

      const result2 = await billing.calculateBillableCost('project-123', 0.10, 150000);
      expect(result2.markup_percent).toBe(30);
    });
  });

  describe('Period usage tracking', () => {
    it('should update period usage atomically', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await billing.updatePeriodUsage(
        'project-123',
        1000, // input tokens
        500,  // output tokens
        0.092, // provider cost
        0.1104, // billable cost
        '2026-02'
      );
      
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('update_period_usage', expect.objectContaining({
        p_project_id: 'project-123',
        p_input_tokens: 1000,
        p_output_tokens: 500
      }));
    });
  });
});
