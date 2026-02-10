/**
 * Billing API (Project Cost Control)
 * Extracted from server.js
 *
 * Superadmin endpoints:
 * - GET /api/admin/billing/projects
 * - GET/POST /api/admin/billing/pricing
 * - GET/POST /api/admin/billing/pricing/tiers
 * - GET/POST /api/admin/billing/exchange-rate
 * - POST /api/admin/billing/exchange-rate/refresh
 * - GET /api/admin/billing/projects/:id
 * - GET/POST /api/admin/billing/projects/:id/balance
 * - GET /api/admin/billing/projects/:id/transactions
 * - GET/POST/DELETE /api/admin/billing/projects/:id/pricing
 *
 * Project member endpoint:
 * - GET /api/projects/:id/billing
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

async function checkSuperAdmin(supabase, req, res) {
    const log = getLogger().child({ module: 'billing' });
    log.debug({ event: 'billing_check_superadmin' }, 'checkSuperAdmin called');
    if (!supabase || !supabase.isConfigured()) {
        log.debug({ event: 'billing_not_configured' }, 'Supabase not configured');
        jsonResponse(res, { error: 'Database not configured' }, 503);
        return false;
    }
    const authResult = await supabase.auth.verifyRequest(req);
    log.debug({ event: 'billing_auth', authenticated: authResult.authenticated, userId: authResult.user?.id }, 'Auth result');
    if (!authResult.authenticated) {
        log.debug({ event: 'billing_not_authenticated' }, 'Not authenticated');
        jsonResponse(res, { error: 'Authentication required' }, 401);
        return false;
    }
    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
    log.debug({ event: 'billing_superadmin', isSuperAdmin }, 'isSuperAdmin');
    if (!isSuperAdmin) {
        jsonResponse(res, { error: 'Superadmin access required' }, 403);
        return false;
    }
    return authResult.user;
}

async function handleBilling(ctx) {
    const { req, res, pathname, supabase, storage } = ctx;
    const log = getLogger().child({ module: 'billing' });
    if (!pathname.startsWith('/api/admin/billing/') && !pathname.match(/^\/api\/projects\/[^/]+\/billing$/)) {
        return false;
    }
    const billing = require('../../supabase/billing');

    // GET /api/admin/billing/projects - Get all projects billing overview (superadmin)
    if (pathname === '/api/admin/billing/projects' && req.method === 'GET') {
        try {
            const user = await checkSuperAdmin(supabase, req, res);
            if (!user) return true;
            const projects = await billing.getAllProjectsBilling();
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
            const config = await billing.getGlobalPricingConfig();
            if (!config) {
                jsonResponse(res, { error: 'Global pricing config not found' }, 404);
                return true;
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
                        let project = null;
                        const client = storage._supabase?.supabase;
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
