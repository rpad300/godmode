/**
 * Invites feature routes
 * Extracted from server.js
 *
 * Handles:
 * - POST /api/projects/:id/invites
 * - GET  /api/projects/:id/invites/link
 * - GET  /api/projects/:id/invites
 * - DELETE /api/invites/:id
 * - GET  /api/invites/preview?token=xxx
 * - POST /api/invites/accept
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleInvites(ctx) {
    const { req, res, pathname, parsedUrl, supabase, emailService } = ctx;

    // POST /api/projects/:id/invites - Create invite
    if (pathname.match(/^\/api\/projects\/([^/]+)\/invites$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        // Get current user
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
            // Build invite URL
            const baseUrl = `http://${req.headers.host}`;
            const inviteUrl = `${baseUrl}/join?token=${result.token}`;

            // Send invitation email if email service is configured
            let emailSent = false;
            if (emailService && emailService.isConfigured() && body.email) {
                try {
                    // Get inviter profile and project name
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
                        console.warn('[Invites] Email send failed:', emailResult.error);
                    }
                } catch (emailError) {
                    console.error('[Invites] Email error:', emailError.message);
                }
            }

            jsonResponse(res, {
                success: true,
                invite: result.invite,
                invite_url: inviteUrl,
                token: result.token, // Only returned once!
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

        // Get current user
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

        // Create a general invite (no specific email)
        const result = await supabase.invites.createInvite({
            projectId: projectId,
            createdBy: userResult.user.id,
            role: 'member',
            email: null, // No specific email - shareable link
            expiresInHours: 168 // 7 days for shareable links
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

        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
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

        const token = parsedUrl?.query?.token;

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

        // Get current user
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
