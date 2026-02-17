/**
 * Purpose:
 *   Project invitation system supporting email-based invites, shareable
 *   invite links, and token-based acceptance flow.
 *
 * Responsibilities:
 *   - Create targeted (email) or open invites with configurable role and TTL
 *   - Generate shareable invite links (default: 7-day, member role)
 *   - List pending/active invites for a project
 *   - Revoke an existing invite
 *   - Preview invite metadata by token (for the join page)
 *   - Accept invite: adds authenticated user as project member
 *
 * Key dependencies:
 *   - supabase.invites: invite CRUD, token generation, acceptance logic
 *   - supabase.auth: token extraction, user verification
 *   - emailService (ctx): optional transactional email for invite notifications
 *   - supabase admin client: resolves inviter name and project name for emails
 *
 * Side effects:
 *   - POST /invites creates an invite row and optionally sends an email
 *   - POST /invites/accept creates a project_members row
 *   - DELETE /invites/:id marks the invite as revoked
 *
 * Notes:
 *   - Returns 503 if Supabase is not configured
 *   - Invite URLs are built from the Host header (http://{host}/join?token=...)
 *   - Email sending is best-effort; failure does not block the invite creation
 *   - Default expiry: 48h for email invites, 168h (7 days) for link invites
 *
 * Routes:
 *   POST   /api/projects/:id/invites       - Create invite (auth required)
 *          Body: { role, email, expiresInHours, message }
 *   GET    /api/projects/:id/invites/link   - Generate shareable link (auth required)
 *   GET    /api/projects/:id/invites        - List invites for project
 *   DELETE /api/invites/:id                 - Revoke invite
 *   GET    /api/invites/preview             - Preview invite (?token=xxx)
 *   POST   /api/invites/accept              - Accept invite (auth required)
 *          Body: { token }
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

/**
 * Handle invites routes
 * @param {object} ctx - Context object with req, res, pathname, parsedUrl, supabase, emailService
 * @returns {Promise<boolean>} - true if handled, false if not a handled route
 */
async function handleInvites(ctx) {
    const { req, res, pathname, parsedUrl, supabase, emailService } = ctx;
    const log = getLogger().child({ module: 'invites' });
    // POST /api/projects/:id/invites - Create invite
    if (pathname.match(/^\/api\/projects\/([^/]+)\/invites$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const token = supabase.auth.extractToken(req);
        if (!token) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Invalid token' }, 401);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/invites$/)[1];
        const body = await parseBody(req);

        const result = await supabase.invites.createInvite({
            projectId: projectId,
            createdBy: userResult.user.id,
            role: body.role || 'read',
            email: body.email,
            expiresInHours: body.expiresInHours || 48
        });

        if (result.success) {
            const baseUrl = `http://${req.headers.host}`;
            const inviteUrl = `${baseUrl}/join?token=${result.token}`;

            let emailSent = false;
            if (emailService && emailService.isConfigured() && body.email) {
                try {
                    const adminClient = supabase.getAdminClient();
                    const [inviterRes, projectRes] = await Promise.all([
                        adminClient.from('user_profiles').select('display_name, username').eq('id', userResult.user.id).single(),
                        adminClient.from('projects').select('name').eq('id', projectId).single(),
                    ]);

                    const inviterName = inviterRes.data?.display_name || inviterRes.data?.username || userResult.user.email;
                    const projectName = projectRes.data?.name || 'a project';

                    const emailResult = await emailService.sendInvitationEmail({
                        to: body.email,
                        inviterName,
                        projectName,
                        role: body.role || 'member',
                        message: body.message,
                        inviteLink: inviteUrl,
                    });

                    emailSent = emailResult.success;
                    if (!emailResult.success) {
                        log.warn({ event: 'invites_email_send_failed', reason: emailResult.error }, 'Email send failed');
                    }
                } catch (emailError) {
                    log.warn({ event: 'invites_email_error', reason: emailError.message }, 'Email error');
                }
            }

            jsonResponse(res, {
                success: true,
                invite: result.invite,
                invite_url: inviteUrl,
                token: result.token,
                email_sent: emailSent,
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/invites/link - Generate shareable invite link
    if (pathname.match(/^\/api\/projects\/([^/]+)\/invites\/link$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const token = supabase.auth.extractToken(req);
        if (!token) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Invalid token' }, 401);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/invites\/link$/)[1];

        const result = await supabase.invites.createInvite({
            projectId: projectId,
            createdBy: userResult.user.id,
            role: 'member',
            email: null,
            expiresInHours: 168
        });

        if (result.success) {
            const baseUrl = `http://${req.headers.host}`;
            const inviteUrl = `${baseUrl}/join?token=${result.token}`;

            jsonResponse(res, {
                success: true,
                link: inviteUrl,
                invite_url: inviteUrl,
                token: result.token,
                expires_at: result.invite?.expires_at,
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/invites - List invites
    if (pathname.match(/^\/api\/projects\/([^/]+)\/invites$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/invites$/)[1];
        const result = await supabase.invites.listInvites(projectId);

        if (result.success) {
            jsonResponse(res, { invites: result.invites });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // DELETE /api/invites/:id - Revoke invite
    if (pathname.match(/^\/api\/invites\/([^/]+)$/) && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const inviteId = pathname.match(/^\/api\/invites\/([^/]+)$/)[1];
        const result = await supabase.invites.revokeInvite(inviteId);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/invites/preview?token=xxx - Preview invite
    if (pathname === '/api/invites/preview' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const token = (parsedUrl || parseUrl(req.url)).query.token;

        if (!token) {
            jsonResponse(res, { error: 'Token required' }, 400);
            return true;
        }

        const result = await supabase.invites.getInviteByToken(token);

        if (result.success) {
            jsonResponse(res, { invite: result.invite });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/invites/accept - Accept invite
    if (pathname === '/api/invites/accept' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const authToken = supabase.auth.extractToken(req);
        if (!authToken) {
            jsonResponse(res, { error: 'You must be logged in to accept an invite' }, 401);
            return true;
        }

        const userResult = await supabase.auth.getUser(authToken);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Invalid token' }, 401);
            return true;
        }

        const body = await parseBody(req);

        if (!body.token) {
            jsonResponse(res, { error: 'Invite token required' }, 400);
            return true;
        }

        const result = await supabase.invites.acceptInvite(
            body.token,
            userResult.user.id,
            userResult.user.email
        );

        if (result.success) {
            jsonResponse(res, {
                success: true,
                membership: result.membership
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = { handleInvites };
