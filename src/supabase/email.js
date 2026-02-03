/**
 * Email Service using Resend
 * Handles sending transactional emails
 */

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
 * Send an email via Resend
 */
async function sendEmail({ to, subject, html, text, from = DEFAULT_FROM, replyTo }) {
    if (!isConfigured()) {
        console.warn('[Email] Resend not configured - email not sent');
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
            console.error('[Email] Resend error:', data);
            return { success: false, error: data.message || 'Failed to send email' };
        }

        console.log('[Email] Sent successfully:', data.id);
        return { success: true, id: data.id };
    } catch (error) {
        console.error('[Email] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send project invitation email
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

module.exports = {
    isConfigured,
    sendEmail,
    sendInvitationEmail,
};
