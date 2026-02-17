/**
 * Purpose:
 *   Sends transactional emails through the Resend API. Provides pre-built
 *   branded HTML templates for invitations, OTP login codes, email
 *   confirmation, and new-device security alerts.
 *
 * Responsibilities:
 *   - Low-level sendEmail() that posts to the Resend REST endpoint
 *   - Configuration check (isConfigured) so callers can gracefully skip
 *     email when RESEND_API_KEY is absent
 *   - Branded HTML + plaintext template functions for each email type:
 *     invitation, login code, email confirmation, new-device login
 *
 * Key dependencies:
 *   - Resend API (https://api.resend.com/emails): HTTP POST with Bearer token
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Sends real emails when RESEND_API_KEY is set; no-ops with a warning
 *     otherwise
 *   - Reads RESEND_API_KEY from process.env at module load time (not lazy)
 *
 * Notes:
 *   - The `from` address defaults to "GodMode <noreply@godmode.app>".
 *     Change DEFAULT_FROM when deploying under a different domain.
 *   - Invitation emails contain an expiration notice of 48 hours, but the
 *     actual TTL is enforced by the invites module, not here.
 *   - Email templates use inline CSS for broad email-client compatibility,
 *     including Outlook (`<!--[if mso]>`) fallbacks.
 *   - isConfigured() rejects the placeholder key "re_1234567890" to avoid
 *     accidental sends during development.
 *   - This module does NOT interact with Supabase tables; it is a pure
 *     outbound email service.
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'email' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';

// Default sender - update with your verified domain
const DEFAULT_FROM = 'GodMode <noreply@godmode.app>';

/**
 * Check if Resend is configured
 */
function isConfigured() {
    return !!(RESEND_API_KEY && RESEND_API_KEY !== 're_1234567890');
}

/**
 * Send an email via the Resend REST API.
 *
 * Returns early with an error result if Resend is not configured.
 * The `to` param is normalized to an array for the API payload.
 *
 * @param {object} params
 * @param {string|string[]} params.to - Recipient email(s)
 * @param {string} params.subject
 * @param {string} params.html - HTML body
 * @param {string} [params.text] - Plaintext fallback
 * @param {string} [params.from] - Defaults to DEFAULT_FROM
 * @param {string} [params.replyTo]
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
async function sendEmail({ to, subject, html, text, from = DEFAULT_FROM, replyTo }) {
    if (!isConfigured()) {
        log.warn({ event: 'email_not_configured' }, 'Resend not configured - email not sent');
        return { success: false, error: 'Email service not configured' };
    }

    try {
        const response = await fetch(RESEND_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                text,
                reply_to: replyTo,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            log.warn({ event: 'email_resend_error', data }, 'Resend error');
            return { success: false, error: data.message || 'Failed to send email' };
        }

        log.debug({ event: 'email_sent', id: data.id }, 'Sent successfully');
        return { success: true, id: data.id };
    } catch (error) {
        log.warn({ event: 'email_error', reason: error.message }, 'Error');
        return { success: false, error: error.message };
    }
}

/**
 * Send a branded project invitation email with inviter name, project name,
 * role badge, optional personal message, and CTA button linking to the
 * invite acceptance URL.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.inviterName
 * @param {string} params.projectName
 * @param {string} params.role - 'admin' or other (displayed as "Team Member")
 * @param {string} [params.message] - Optional personal note from inviter
 * @param {string} params.inviteLink - Full URL to accept the invitation
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
async function sendInvitationEmail({ to, inviterName, projectName, role, message, inviteLink }) {
    const subject = `${inviterName} invited you to join ${projectName} on GodMode`;
    
    const roleLabel = role === 'admin' ? 'Administrator' : 'Team Member';
    const roleIcon = role === 'admin' ? '👑' : '👤';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Invitation</title>
    <!--[if mso]>
    <style type="text/css">
        .fallback-font { font-family: Arial, sans-serif !important; }
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 20px;">
        <tr>
            <td align="center">
                <!-- Logo -->
                <table cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                    <tr>
                        <td align="center">
                            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); border-radius: 16px; display: inline-block; text-align: center; line-height: 56px; box-shadow: 0 8px 32px rgba(225, 29, 72, 0.4);">
                                <span style="font-size: 28px; color: white; font-weight: 700;">G</span>
                            </div>
                        </td>
                    </tr>
                </table>
                
                <!-- Main Card - Glassmorphism Style -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: rgba(255, 255, 255, 0.95); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1); overflow: hidden;">
                    
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #e11d48 0%, #be123c 50%, #9f1239 100%); padding: 48px 40px; text-align: center; position: relative;">
                            <!-- Decorative circles -->
                            <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                            <div style="position: absolute; bottom: -20px; left: -20px; width: 80px; height: 80px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
                            
                            <p style="margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">You're Invited</p>
                            <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Join the Team! 🚀</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 48px 40px;">
                            <!-- Inviter info -->
                            <div style="text-align: center; margin-bottom: 32px;">
                                <div style="display: inline-block; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 16px 28px; border-radius: 50px; border: 1px solid #e2e8f0;">
                                    <span style="font-size: 14px; color: #64748b;">
                                        <strong style="color: #1e293b;">${inviterName}</strong> invited you to
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Project Card -->
                            <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border: 2px solid #fbcfe8; border-radius: 20px; padding: 28px; margin-bottom: 28px; text-align: center;">
                                <p style="margin: 0 0 8px; font-size: 13px; color: #be185d; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Project</p>
                                <h2 style="margin: 0 0 12px; font-size: 26px; font-weight: 700; color: #1e293b;">${projectName}</h2>
                                <div style="display: inline-block; background: white; padding: 8px 16px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                    <span style="font-size: 13px; color: #64748b;">
                                        ${roleIcon} Role: <strong style="color: #e11d48;">${roleLabel}</strong>
                                    </span>
                                </div>
                            </div>
                            
                            ${message ? `
                            <!-- Personal Message -->
                            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; padding: 24px; margin-bottom: 28px; border-left: 4px solid #e11d48;">
                                <p style="margin: 0 0 10px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">💬 Personal Message</p>
                                <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.7; font-style: italic;">"${message}"</p>
                            </div>
                            ` : ''}
                            
                            <!-- CTA Button -->
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 36px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: white; text-decoration: none; padding: 18px 56px; border-radius: 14px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 24px rgba(225, 29, 72, 0.35); letter-spacing: 0.3px; transition: all 0.2s;">
                                            ✨ Accept Invitation
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Alternative link -->
                            <div style="background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                                <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">Or copy this link:</p>
                                <p style="margin: 0; font-size: 12px; color: #64748b; word-break: break-all; font-family: 'SF Mono', Monaco, Consolas, monospace; background: white; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">${inviteLink}</p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 28px 40px; border-top: 1px solid #e2e8f0;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
                                            ⏰ This invitation expires in <strong>48 hours</strong>
                                        </p>
                                        <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                                            If you didn't expect this invitation, you can safely ignore this email.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Bottom branding -->
                <table cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                    <tr>
                        <td align="center">
                            <p style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: white;">
                                God<span style="color: #e11d48;">Mode</span>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.5);">
                                Project Intelligence Platform
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    const text = `
🚀 You're Invited to GodMode!

${inviterName} has invited you to join "${projectName}" as a ${roleLabel}.

${message ? `💬 Personal message: "${message}"` : ''}

Click here to accept the invitation:
${inviteLink}

⏰ This invitation expires in 48 hours.

---
GodMode - Project Intelligence Platform
If you didn't expect this invitation, you can safely ignore this email.
    `.trim();

    return sendEmail({ to, subject, html, text });
}

/**
 * Send login OTP code email
 * Used for passwordless login
 */
async function sendLoginCodeEmail({ to, code, expiresInMinutes = 10 }) {
    const subject = `${code} is your GodMode login code`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Code</title>
    <!--[if mso]>
    <style type="text/css">
        .fallback-font { font-family: Arial, sans-serif !important; }
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 20px;">
        <tr>
            <td align="center">
                <!-- Logo -->
                <table cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                    <tr>
                        <td align="center">
                            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); border-radius: 16px; display: inline-block; text-align: center; line-height: 56px; box-shadow: 0 8px 32px rgba(225, 29, 72, 0.4);">
                                <span style="font-size: 28px; color: white; font-weight: 700;">G</span>
                            </div>
                        </td>
                    </tr>
                </table>
                
                <!-- Main Card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: rgba(255, 255, 255, 0.95); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #e11d48 0%, #be123c 50%, #9f1239 100%); padding: 48px 40px; text-align: center;">
                            <p style="margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Login Code</p>
                            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Sign in to GodMode</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 48px 40px;">
                            <p style="margin: 0 0 24px; font-size: 16px; color: #475569; text-align: center; line-height: 1.6;">
                                Enter this code to sign in to your account:
                            </p>
                            
                            <!-- Code Display -->
                            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; margin: 24px 0; text-align: center;">
                                <div style="font-size: 48px; font-weight: 800; letter-spacing: 12px; color: #1e293b; font-family: 'SF Mono', Monaco, Consolas, monospace;">
                                    ${code}
                                </div>
                            </div>
                            
                            <!-- Expiration notice -->
                            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center; border: 1px solid #fcd34d;">
                                <p style="margin: 0; font-size: 14px; color: #92400e;">
                                    ⏰ This code expires in <strong>${expiresInMinutes} minutes</strong>
                                </p>
                            </div>
                            
                            <!-- Security notice -->
                            <div style="background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                                    🔒 If you didn't request this code, you can safely ignore this email.<br>
                                    Someone may have entered your email address by mistake.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                                Never share this code with anyone. GodMode staff will never ask for it.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Bottom branding -->
                <table cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                    <tr>
                        <td align="center">
                            <p style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: white;">
                                God<span style="color: #e11d48;">Mode</span>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.5);">
                                Project Intelligence Platform
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    const text = `
Your GodMode Login Code: ${code}

Enter this code to sign in to your account.

⏰ This code expires in ${expiresInMinutes} minutes.

🔒 Security Notice:
- If you didn't request this code, you can safely ignore this email.
- Never share this code with anyone.
- GodMode staff will never ask for your login code.

---
GodMode - Project Intelligence Platform
    `.trim();

    return sendEmail({ to, subject, html, text });
}

/**
 * Send email confirmation code
 * Used after registration to verify email address
 */
async function sendEmailConfirmationEmail({ to, code, confirmLink, expiresInMinutes = 10 }) {
    const subject = `Confirm your GodMode account`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Your Email</title>
    <!--[if mso]>
    <style type="text/css">
        .fallback-font { font-family: Arial, sans-serif !important; }
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 20px;">
        <tr>
            <td align="center">
                <!-- Logo -->
                <table cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                    <tr>
                        <td align="center">
                            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); border-radius: 16px; display: inline-block; text-align: center; line-height: 56px; box-shadow: 0 8px 32px rgba(225, 29, 72, 0.4);">
                                <span style="font-size: 28px; color: white; font-weight: 700;">G</span>
                            </div>
                        </td>
                    </tr>
                </table>
                
                <!-- Main Card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: rgba(255, 255, 255, 0.95); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 48px 40px; text-align: center;">
                            <p style="margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Welcome to GodMode</p>
                            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Confirm Your Email ✉️</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 48px 40px;">
                            <p style="margin: 0 0 24px; font-size: 16px; color: #475569; text-align: center; line-height: 1.6;">
                                Thanks for signing up! Please confirm your email address to activate your account.
                            </p>
                            
                            <!-- Code Display -->
                            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 16px; padding: 32px; margin: 24px 0; text-align: center;">
                                <p style="margin: 0 0 12px; font-size: 14px; color: #166534; font-weight: 600;">Your confirmation code:</p>
                                <div style="font-size: 48px; font-weight: 800; letter-spacing: 12px; color: #166534; font-family: 'SF Mono', Monaco, Consolas, monospace;">
                                    ${code}
                                </div>
                            </div>
                            
                            ${confirmLink ? `
                            <!-- CTA Button -->
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${confirmLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 14px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35); letter-spacing: 0.3px;">
                                            ✓ Confirm Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 16px; font-size: 13px; color: #94a3b8; text-align: center;">
                                Or copy this link to your browser:
                            </p>
                            <div style="background: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 24px;">
                                <p style="margin: 0; font-size: 11px; color: #64748b; word-break: break-all; font-family: 'SF Mono', Monaco, Consolas, monospace;">${confirmLink}</p>
                            </div>
                            ` : ''}
                            
                            <!-- Expiration notice -->
                            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center; border: 1px solid #fcd34d;">
                                <p style="margin: 0; font-size: 14px; color: #92400e;">
                                    ⏰ This code expires in <strong>${expiresInMinutes} minutes</strong>
                                </p>
                            </div>
                            
                            <!-- Security notice -->
                            <div style="background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                                    🔒 If you didn't create an account, you can safely ignore this email.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Bottom branding -->
                <table cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                    <tr>
                        <td align="center">
                            <p style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: white;">
                                God<span style="color: #e11d48;">Mode</span>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.5);">
                                Project Intelligence Platform
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    const text = `
Welcome to GodMode!

Please confirm your email address to activate your account.

Your confirmation code: ${code}

${confirmLink ? `Or click this link to confirm:\n${confirmLink}\n` : ''}
⏰ This code expires in ${expiresInMinutes} minutes.

🔒 If you didn't create an account, you can safely ignore this email.

---
GodMode - Project Intelligence Platform
    `.trim();

    return sendEmail({ to, subject, html, text });
}

/**
 * Send new device login notification
 * Optional security email when login from new device/location
 */
async function sendNewDeviceLoginEmail({ to, deviceInfo, loginTime, ipAddress }) {
    const subject = `New sign-in to your GodMode account`;
    
    const formattedTime = new Date(loginTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Sign-in</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 20px;">
        <tr>
            <td align="center">
                <!-- Logo -->
                <table cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                    <tr>
                        <td align="center">
                            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); border-radius: 16px; display: inline-block; text-align: center; line-height: 56px; box-shadow: 0 8px 32px rgba(225, 29, 72, 0.4);">
                                <span style="font-size: 28px; color: white; font-weight: 700;">G</span>
                            </div>
                        </td>
                    </tr>
                </table>
                
                <!-- Main Card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: rgba(255, 255, 255, 0.95); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%); padding: 48px 40px; text-align: center;">
                            <p style="margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Security Alert</p>
                            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 800;">New Sign-in Detected 🔐</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 48px 40px;">
                            <p style="margin: 0 0 24px; font-size: 16px; color: #475569; text-align: center; line-height: 1.6;">
                                We noticed a new sign-in to your GodMode account.
                            </p>
                            
                            <!-- Login details -->
                            <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin: 24px 0;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                            <span style="font-size: 13px; color: #94a3b8;">When</span><br>
                                            <span style="font-size: 15px; color: #1e293b; font-weight: 500;">${formattedTime}</span>
                                        </td>
                                    </tr>
                                    ${deviceInfo ? `
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                            <span style="font-size: 13px; color: #94a3b8;">Device</span><br>
                                            <span style="font-size: 15px; color: #1e293b; font-weight: 500;">${deviceInfo}</span>
                                        </td>
                                    </tr>
                                    ` : ''}
                                    ${ipAddress ? `
                                    <tr>
                                        <td style="padding: 8px 0;">
                                            <span style="font-size: 13px; color: #94a3b8;">IP Address</span><br>
                                            <span style="font-size: 15px; color: #1e293b; font-weight: 500;">${ipAddress}</span>
                                        </td>
                                    </tr>
                                    ` : ''}
                                </table>
                            </div>
                            
                            <!-- Security notice -->
                            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fecaca; border-radius: 12px; padding: 16px; text-align: center;">
                                <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.6;">
                                    ⚠️ If this wasn't you, please change your password immediately and contact support.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                                This is an automated security notification from GodMode.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Bottom branding -->
                <table cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                    <tr>
                        <td align="center">
                            <p style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: white;">
                                God<span style="color: #e11d48;">Mode</span>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.5);">
                                Project Intelligence Platform
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    const text = `
🔐 New Sign-in to Your GodMode Account

We noticed a new sign-in to your account.

Details:
- When: ${formattedTime}
${deviceInfo ? `- Device: ${deviceInfo}` : ''}
${ipAddress ? `- IP Address: ${ipAddress}` : ''}

⚠️ If this wasn't you, please change your password immediately and contact support.

---
GodMode - Project Intelligence Platform
    `.trim();

    return sendEmail({ to, subject, html, text });
}

module.exports = {
    isConfigured,
    sendEmail,
    sendInvitationEmail,
    sendLoginCodeEmail,
    sendEmailConfirmationEmail,
    sendNewDeviceLoginEmail,
};
