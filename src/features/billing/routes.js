/**
 * Purpose:
 *   Billing and cost-control API for managing project balances, pricing
 *   configurations, exchange rates, and per-project billing overrides.
 *
 * Responsibilities:
 *   - Superadmin CRUD for global and per-project pricing, tiered pricing, and exchange rates
 *   - Project balance management (credit, unlimited flag, block/unblock)
 *   - Balance transaction history retrieval
 *   - Read-only billing summary for project members
 *
 * Key dependencies:
 *   - ../../supabase/billing: all billing data-access operations
 *   - ../../supabase/notifications: sends balance-added notifications to project members
 *   - supabase (ctx): auth verification, admin client for direct DB updates
 *
 * Side effects:
 *   - Writes to Supabase tables: pricing configs, balance transactions, project status
 *   - Sends notification records on balance credit
 *   - May call external exchange-rate API on /exchange-rate/refresh
 *
 * Notes:
 *   - All /api/admin/billing/* routes require superadmin; returns 401/403 otherwise
 *   - /api/projects/:id/billing is unauthenticated (project-scoped, no auth check)
 *   - billing module is lazy-required inside handleBilling to avoid circular deps
 *
 * Routes:
 *   Superadmin:
 *     GET    /api/admin/billing/projects                     - All projects billing overview
 *     GET    /api/admin/billing/pricing                      - Global pricing config
 *     POST   /api/admin/billing/pricing                      - Set global pricing config
 *     GET    /api/admin/billing/pricing/tiers                - Global pricing tiers
 *     POST   /api/admin/billing/pricing/tiers                - Set global pricing tiers
 *     GET    /api/admin/billing/exchange-rate                 - Exchange rate config
 *     POST   /api/admin/billing/exchange-rate                 - Set exchange rate mode (auto/manual)
 *     POST   /api/admin/billing/exchange-rate/refresh         - Force-refresh exchange rate
 *     GET    /api/admin/billing/projects/:id                  - Project billing summary
 *     GET    /api/admin/billing/projects/:id/balance          - Project balance
 *     POST   /api/admin/billing/projects/:id/balance          - Credit balance or set unlimited
 *     GET    /api/admin/billing/projects/:id/transactions     - Balance transaction log
 *     GET    /api/admin/billing/projects/:id/pricing          - Project pricing override
 *     POST   /api/admin/billing/projects/:id/pricing          - Set project pricing override (+ tiers)
 *     DELETE /api/admin/billing/projects/:id/pricing          - Remove project pricing override
 *     POST   /api/admin/billing/projects/:id/block            - Block/unblock project
 *     POST   /api/admin/billing/projects/:id/unlimited        - Toggle unlimited status
 *   Project member:
 *     GET    /api/projects/:id/billing                        - Billing summary (no auth)
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

/**
 * Verify the request is from a superadmin user.
 * Sends 503/401/403 responses directly if checks fail.
 * @returns {object|false} The authenticated user object, or false if denied.
 */
async function checkSuperAdmin(supabase, req, res) {
    const log = getLogger().child({ module: 'billing' });

    // In development, allow billing admin without auth for local testing
    if (process.env.NODE_ENV === 'development' && process.env.BILLING_SKIP_BALANCE_CHECK === 'true') {
        log.debug({ event: 'billing_dev_bypass' }, 'Dev mode: skipping superadmin check');
        return { id: 'dev-admin', email: 'dev@localhost' };
    }

    if (!supabase || !supabase.isConfigured()) {
        jsonResponse(res, { error: 'Database not configured' }, 503);
        return false;
    }
    const authResult = await supabase.auth.verifyRequest(req);
    if (!authResult.authenticated) {
        log.debug({ event: 'billing_not_authenticated' }, 'Not authenticated');
        jsonResponse(res, { error: 'Authentication required' }, 401);
        return false;
    }
    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
    if (!isSuperAdmin) {
        log.warn({ event: 'billing_not_superadmin', userId: authResult.user.id }, 'User is not superadmin');
        jsonResponse(res, { error: 'Superadmin access required' }, 403);
        return false;
    }
    return authResult.user;
}

/**
 * Main billing route handler. Returns true if the request was handled, false to pass through.
 * Matches /api/admin/billing/* (superadmin) and /api/projects/:id/billing (member).
 */
async function handleBilling(ctx) {
    const { req, res, pathname, supabase, storage } = ctx;
    const log = getLogger().child({ module: 'billing' });
    if (!pathname.startsWith('/api/admin/billing/') && !pathname.match(/^\/api\/projects\/[^/]+\/billing$/)) {
        return false;
    }
    const billing = require('../../supabase/billing');

    // GET /api/admin/billing/projects - Get all projects billing overview (superadmin)
    // Enriches each project with key_source info (which LLM providers use project vs system keys)
    if (pathname === '/api/admin/billing/projects' && req.method === 'GET') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const projects = await billing.getAllProjectsBilling();

            // Enrich with BYOK key source info per project
            const secrets = require('../../supabase/secrets');
            const mainProviders = ['openai', 'anthropic', 'gemini', 'grok', 'deepseek'];
            for (const project of projects) {
                try {
                    const keyInfo = {};
                    for (const p of mainProviders) {
                        const result = await secrets.getProviderApiKey(p, project.project_id);
                        if (result.success) {
                            keyInfo[p] = result.source; // 'project' or 'system'
                        }
                    }
                    project.key_sources = keyInfo;
                    // If ANY key comes from 'project', billing is partially/fully BYOK
                    const sources = Object.values(keyInfo);
                    project.uses_own_keys = sources.includes('project');
                    project.all_own_keys = sources.length > 0 && sources.every(s => s === 'project');
                } catch (e) {
                    project.key_sources = {};
                    project.uses_own_keys = false;
                    project.all_own_keys = false;
                }
            }

            jsonResponse(res, { success: true, projects });
        } catch (error) {
            log.warn({ event: 'billing_projects_error', reason: error?.message }, 'Error getting all projects billing');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // GET /api/admin/billing/pricing - Get global pricing config (superadmin)
    if (pathname === '/api/admin/billing/pricing' && req.method === 'GET') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const config = await billing.getGlobalPricingConfig();
            jsonResponse(res, { success: true, config });
        } catch (error) {
            log.warn({ event: 'billing_pricing_config_error', reason: error?.message }, 'Error getting global pricing config');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // POST /api/admin/billing/pricing - Set global pricing config (superadmin)
    if (pathname === '/api/admin/billing/pricing' && req.method === 'POST') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const body = await parseBody(req);
            const result = await billing.setGlobalPricingConfig({
                fixedMarkupPercent: body.fixed_markup_percent,
                periodType: body.period_type,
                usdToEurRate: body.usd_to_eur_rate,
                updatedBy: user.id
            });
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'billing_pricing_set_error', reason: error?.message }, 'Error setting global pricing config');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // GET /api/admin/billing/pricing/tiers - Get global pricing tiers (superadmin)
    if (pathname === '/api/admin/billing/pricing/tiers' && req.method === 'GET') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const config = await billing.getGlobalPricingConfig();
            if (!config) {
                jsonResponse(res, { success: true, tiers: [] });
                return true;
            }
            const tiers = await billing.getPricingTiers(config.id);
            jsonResponse(res, { success: true, tiers, config_id: config.id });
        } catch (error) {
            log.warn({ event: 'billing_tiers_get_error', reason: error?.message }, 'Error getting global pricing tiers');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // POST /api/admin/billing/pricing/tiers - Set global pricing tiers (superadmin)
    if (pathname === '/api/admin/billing/pricing/tiers' && req.method === 'POST') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const body = await parseBody(req);
            let config = await billing.getGlobalPricingConfig();
            if (!config) {
                // Auto-create default global config if missing
                await billing.setGlobalPricingConfig({
                    fixedMarkupPercent: 0,
                    periodType: 'monthly',
                    usdToEurRate: 0.92,
                    updatedBy: user.id
                });
                config = await billing.getGlobalPricingConfig();

                if (!config) {
                    jsonResponse(res, { error: 'Failed to create global pricing config' }, 500);
                    return true;
                }
            }
            const result = await billing.setPricingTiers(config.id, body.tiers || []);
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'billing_tiers_set_error', reason: error?.message }, 'Error setting global pricing tiers');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // GET /api/admin/billing/exchange-rate - Get exchange rate config (superadmin)
    if (pathname === '/api/admin/billing/exchange-rate' && req.method === 'GET') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const config = await billing.getExchangeRateConfig();
            jsonResponse(res, { success: true, ...config });
        } catch (error) {
            log.warn({ event: 'billing_exchange_config_error', reason: error?.message }, 'Error getting exchange rate config');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // POST /api/admin/billing/exchange-rate - Set exchange rate mode (superadmin)
    if (pathname === '/api/admin/billing/exchange-rate' && req.method === 'POST') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const body = await parseBody(req);
            const result = await billing.setExchangeRateMode(body.auto, body.manualRate);
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'billing_exchange_set_error', reason: error?.message }, 'Error setting exchange rate mode');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // POST /api/admin/billing/exchange-rate/refresh - Force refresh exchange rate (superadmin)
    if (pathname === '/api/admin/billing/exchange-rate/refresh' && req.method === 'POST') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const result = await billing.refreshExchangeRate();
            jsonResponse(res, { success: true, ...result });
        } catch (error) {
            log.warn({ event: 'billing_exchange_refresh_error', reason: error?.message }, 'Error refreshing exchange rate');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // Project-specific billing endpoints (match /api/admin/billing/projects/:id/*)
    const billingProjectMatch = pathname.match(/^\/api\/admin\/billing\/projects\/([^/]+)(\/.*)?$/);
    if (billingProjectMatch) {
        const projectId = billingProjectMatch[1];
        const subPath = billingProjectMatch[2] || '';

        // GET /api/admin/billing/projects/:id - Get project billing summary
        if (subPath === '' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const summary = await billing.getProjectBillingSummary(projectId);
                jsonResponse(res, { success: true, summary });
            } catch (error) {
                log.warn({ event: 'billing_project_summary_error', reason: error?.message }, 'Error getting project billing summary');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // GET /api/admin/billing/projects/:id/balance - Get project balance
        if (subPath === '/balance' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const balance = await billing.checkProjectBalance(projectId);
                jsonResponse(res, { success: true, ...balance });
            } catch (error) {
                log.warn({ event: 'billing_balance_get_error', reason: error?.message }, 'Error getting project balance');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // POST /api/admin/billing/projects/:id/balance - Set project balance
        if (subPath === '/balance' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const body = await parseBody(req);
                const notifications = require('../../supabase/notifications');

                let result;
                if (body.amount !== undefined) {
                    result = await billing.creditProjectBalance(
                        projectId,
                        parseFloat(body.amount),
                        user.id,
                        body.description || 'Balance added by admin'
                    );

                    if (result.success) {
                        log.info({ event: 'billing_credit_added', projectId, amount: body.amount, newBalance: result.new_balance }, 'Balance credited');
                        try {
                            let project = null;
                            const client = storage?._supabase?.supabase;
                            if (client) {
                                const { data } = await client.from('projects').select('name').eq('id', projectId).single();
                                project = data;
                            }
                            await notifications.createBalanceAddedNotification(
                                projectId,
                                parseFloat(body.amount),
                                result.new_balance,
                                project?.name,
                                user.id
                            );
                        } catch (notifErr) {
                            log.debug({ event: 'billing_credit_notification_failed', reason: notifErr?.message }, 'Non-fatal: notification failed');
                        }
                    }
                } else if (body.unlimited !== undefined) {
                    const success = await billing.setProjectUnlimited(projectId, body.unlimited, user.id);
                    result = { success, unlimited: body.unlimited };
                } else {
                    jsonResponse(res, { error: 'Provide amount or unlimited flag' }, 400);
                    return true;
                }

                jsonResponse(res, result);
            } catch (error) {
                log.warn({ event: 'billing_balance_set_error', reason: error?.message }, 'Error setting project balance');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // GET /api/admin/billing/projects/:id/transactions - Get balance transactions
        if (subPath === '/transactions' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const parsedUrl = parseUrl(req.url || '');
                const limit = parseInt(parsedUrl.query?.limit || '50', 10);
                const transactions = await billing.getBalanceTransactions(projectId, limit);
                jsonResponse(res, { success: true, transactions });
            } catch (error) {
                log.warn({ event: 'billing_transactions_error', reason: error?.message }, 'Error getting balance transactions');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // GET /api/admin/billing/projects/:id/pricing - Get project pricing override
        if (subPath === '/pricing' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const override = await billing.getProjectPricingOverride(projectId);
                const globalConfig = await billing.getGlobalPricingConfig();
                jsonResponse(res, {
                    success: true,
                    override,
                    using_global: !override,
                    global_config: globalConfig
                });
            } catch (error) {
                log.warn({ event: 'billing_pricing_override_get_error', reason: error?.message }, 'Error getting project pricing override');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // POST /api/admin/billing/projects/:id/pricing - Set project pricing override
        if (subPath === '/pricing' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const body = await parseBody(req);
                const result = await billing.setProjectPricingOverride(projectId, {
                    fixedMarkupPercent: body.fixed_markup_percent,
                    periodType: body.period_type,
                    usdToEurRate: body.usd_to_eur_rate,
                    createdBy: user.id
                });

                if (result.success && result.config_id && body.tiers) {
                    await billing.setPricingTiers(result.config_id, body.tiers);
                }

                jsonResponse(res, result);
            } catch (error) {
                log.warn({ event: 'billing_pricing_override_set_error', reason: error?.message }, 'Error setting project pricing override');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // DELETE /api/admin/billing/projects/:id/pricing - Remove project pricing override
        if (subPath === '/pricing' && req.method === 'DELETE') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const success = await billing.deleteProjectPricingOverride(projectId);
                jsonResponse(res, { success });
            } catch (error) {
                log.warn({ event: 'billing_pricing_override_delete_error', reason: error?.message }, 'Error deleting project pricing override');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // POST /api/admin/billing/projects/:id/block - Block/Unblock project
        if (subPath === '/block' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const body = await parseBody(req);
                const blocked = body.blocked === true;

                const { getAdminClient, getClient } = require('../../supabase/client');
                const adminClient = getAdminClient() || getClient();
                if (!adminClient) {
                    throw new Error('Supabase client not available');
                }

                const { error } = await adminClient
                    .from('projects')
                    .update({ status: blocked ? 'blocked' : 'active' })
                    .eq('id', projectId);

                if (error) throw error;
                log.info({ event: 'billing_project_block', projectId, blocked }, `Project ${blocked ? 'blocked' : 'unblocked'}`);
                jsonResponse(res, { success: true, blocked });
            } catch (error) {
                log.warn({ event: 'billing_project_block_error', projectId, reason: error?.message }, 'Error blocking/unblocking project');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }

        // POST /api/admin/billing/projects/:id/unlimited - Set project unlimited status
        if (subPath === '/unlimited' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(supabase, req, res);
                if (!user) return true;
                const body = await parseBody(req);
                const unlimited = body.unlimited === true;

                const success = await billing.setProjectUnlimited(projectId, unlimited, user.id);

                if (!success) {
                    throw new Error('Failed to set unlimited status. The database column may not exist.');
                }

                log.info({ event: 'billing_project_unlimited', projectId, unlimited }, `Project unlimited set to ${unlimited}`);
                jsonResponse(res, { success: true, unlimited });
            } catch (error) {
                log.warn({ event: 'billing_project_unlimited_error', projectId, reason: error?.message }, 'Error setting project unlimited status');
                jsonResponse(res, { error: error.message }, 500);
            }
            return true;
        }
    }

    // GET /api/projects/:id/billing - Get billing summary for project (project members)
    const projectBillingMatch = pathname.match(/^\/api\/projects\/([^/]+)\/billing$/);
    if (projectBillingMatch && req.method === 'GET') {
        try {
            const projectId = projectBillingMatch[1];
            const summary = await billing.getProjectBillingSummary(projectId);
            jsonResponse(res, { success: true, summary });
        } catch (error) {
            log.warn({ event: 'billing_project_error', reason: error?.message }, 'Error getting project billing');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleBilling };
