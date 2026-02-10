/**
 * Auth feature routes
 * Extracted from server.js
 * 
 * Handles:
 * - /api/auth/status
 * - /api/auth/register
 * - /api/auth/login
 * - /api/auth/logout
 * - /api/auth/me
 * - /api/auth/refresh
 * - /api/auth/forgot-password
 * - /api/auth/reset-password
 * - /api/auth/otp/*
 * - /api/auth/confirm-email
 * - /api/auth/resend-confirmation
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');
const { getCookieSecurityFlags, getClientIp } = require('../../server/middleware');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');

/**
 * Handle auth routes
 * @param {object} ctx - Context object with req, res, pathname, parsedUrl, supabase
 * @returns {Promise<boolean>} - true if handled, false if not an auth route
 */
async function handleAuth(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;
    const log = getLogger().child({ module: 'auth' });

    // Only handle /api/auth/* routes
    if (!pathname.startsWith('/api/auth/')) {
        return false;
    }

    // GET /api/auth/status - Check if auth is configured
    if (pathname === '/api/auth/status' && req.method === 'GET') {
        if (supabase && supabase.isConfigured()) {
            const configInfo = supabase.getConfigInfo();
            jsonResponse(res, { 
                configured: true, 
                url: configInfo.url
            });
        } else {
            jsonResponse(res, { configured: false });
        }
        return true;
    }
    
    // POST /api/auth/register - Register new user
    if (pathname === '/api/auth/register' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const body = await parseBody(req);
        const { email, password, username, display_name } = body;
        
        // Register user in Supabase Auth
        const result = await supabase.auth.register(email, password, { username, display_name });
        
        if (result.success) {
            // Get client IP for OTP rate limiting
            const requestIp = getClientIp(req);
            const userAgent = req.headers['user-agent'] || null;
            
            // Create OTP for email confirmation via Resend (our branded emails)
            try {
                const otp = require('../../supabase/otp');
                const emailService = require('../../supabase/email');
                
                const otpResult = await otp.createOTP(email, 'email_confirm', requestIp, userAgent);
                
                if (otpResult.success) {
                    // Build confirmation link
                    const appUrl = process.env.APP_URL || 'http://localhost:3005';
                    const confirmLink = `${appUrl}/api/auth/confirm-email?email=${encodeURIComponent(email)}&code=${otpResult.code}`;
                    
                    // Send branded confirmation email via Resend
                    const emailResult = await emailService.sendEmailConfirmationEmail({
                        to: email,
                        code: otpResult.code,
                        confirmLink: confirmLink,
                        expiresInMinutes: otpResult.expiresInMinutes
                    });
                    
                    if (!emailResult.success) {
                        log.warn({ event: 'auth_confirmation_email_failed', reason: emailResult.error }, 'Failed to send confirmation email');
                    } else {
                        log.info({ event: 'auth_confirmation_email_sent', email }, 'Sent confirmation email');
                    }
                }
            } catch (err) {
                logError(err, { module: 'auth', event: 'auth_confirmation_otp_error' });
            }
            
            // Don't set session cookies - user needs to confirm email first
            jsonResponse(res, {
                success: true,
                user: result.user,
                needsEmailVerification: true,
                message: 'Account created! Please check your email to verify your account.'
            });
        } else {
            jsonResponse(res, result, 400);
        }
        return true;
    }
    
    // POST /api/auth/login - Login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const body = await parseBody(req);
        const { email, password } = body;
        
        const result = await supabase.auth.login(email, password);
        
        if (result.success) {
            // Check if email is confirmed
            if (!result.user.email_confirmed_at) {
                // Email not confirmed - don't allow login
                // Optionally resend confirmation email
                try {
                    const otp = require('../../supabase/otp');
                    const emailService = require('../../supabase/email');
                    
                    // Check rate limit before sending new confirmation
                    const requestIp = getClientIp(req);
                    
                    const rateLimitCheck = await otp.checkRateLimit(email, requestIp);
                    
                    if (rateLimitCheck.allowed) {
                        const otpResult = await otp.createOTP(email, 'email_confirm', requestIp);
                        
                        if (otpResult.success) {
                            const appUrl = process.env.APP_URL || 'http://localhost:3005';
                            const confirmLink = `${appUrl}/api/auth/confirm-email?email=${encodeURIComponent(email)}&code=${otpResult.code}`;
                            
                            await emailService.sendEmailConfirmationEmail({
                                to: email,
                                code: otpResult.code,
                                confirmLink: confirmLink,
                                expiresInMinutes: otpResult.expiresInMinutes
                            });
                            
                            log.info({ event: 'auth_confirmation_resent', email }, 'Resent confirmation email');
                        }
                    }
                } catch (err) {
                    logError(err, { module: 'auth', event: 'auth_resend_confirmation_error' });
                }
                
                jsonResponse(res, {
                    success: false,
                    error: 'Please verify your email address before logging in.',
                    needsEmailVerification: true,
                    email: email
                }, 403);
                return true;
            }
            
            // Email confirmed - allow login (send only serializable fields so client always gets valid JSON)
            const cookieFlags = getCookieSecurityFlags(req);
            res.setHeader('Set-Cookie', [
                `sb-access-token=${result.session.access_token}; ${cookieFlags}; Path=/; Max-Age=3600`,
                `sb-refresh-token=${result.session.refresh_token}; ${cookieFlags}; Path=/; Max-Age=2592000`
            ]);
            jsonResponse(res, {
                success: true,
                user: {
                    id: result.user.id,
                    email: result.user.email
                }
            });
        } else {
            jsonResponse(res, result, 401);
        }
        return true;
    }
    
    // POST /api/auth/logout - Logout
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const token = supabase.auth.extractToken(req);
        await supabase.auth.logout(token);
        
        // Clear cookies
        const logoutCookieFlags = getCookieSecurityFlags(req);
        res.setHeader('Set-Cookie', [
            `sb-access-token=; ${logoutCookieFlags}; Path=/; Max-Age=0`,
            `sb-refresh-token=; ${logoutCookieFlags}; Path=/; Max-Age=0`
        ]);
        
        jsonResponse(res, { success: true });
        return true;
    }
    
    // GET /api/auth/me - Get current user (tries access token, then refresh token)
    if (pathname === '/api/auth/me' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { authenticated: false, user: null });
            return true;
        }

        const cookies = req.headers.cookie || '';
        let token = supabase.auth.extractToken(req);

        // If we have an access token, validate it
        if (token) {
            const result = await supabase.auth.getUser(token);
            if (result.success) {
                jsonResponse(res, { authenticated: true, user: result.user });
                return true;
            }
        }

        // No valid access token: try refresh token and set new cookies
        const refreshMatch = cookies.match(/sb-refresh-token=([^;]+)/);
        if (refreshMatch) {
            const refreshResult = await supabase.auth.refreshToken(refreshMatch[1].trim());
            if (refreshResult.success) {
                const flags = getCookieSecurityFlags(req);
                res.setHeader('Set-Cookie', [
                    `sb-access-token=${refreshResult.session.access_token}; ${flags}; Path=/; Max-Age=3600`,
                    `sb-refresh-token=${refreshResult.session.refresh_token}; ${flags}; Path=/; Max-Age=2592000`
                ]);
                const userResult = await supabase.auth.getUser(refreshResult.session.access_token);
                if (userResult.success) {
                    jsonResponse(res, { authenticated: true, user: userResult.user });
                    return true;
                }
            }
        }

        jsonResponse(res, { authenticated: false, user: null });
        return true;
    }
    
    // POST /api/auth/refresh - Refresh access token
    if (pathname === '/api/auth/refresh' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        // Get refresh token from cookie
        const cookies = req.headers['cookie'] || '';
        const refreshMatch = cookies.match(/sb-refresh-token=([^;]+)/);
        
        if (!refreshMatch) {
            jsonResponse(res, { error: 'No refresh token' }, 401);
            return true;
        }
        
        const result = await supabase.auth.refreshToken(refreshMatch[1]);
        
        if (result.success) {
            const refreshCookieFlags = getCookieSecurityFlags(req);
            res.setHeader('Set-Cookie', [
                `sb-access-token=${result.session.access_token}; ${refreshCookieFlags}; Path=/; Max-Age=3600`,
                `sb-refresh-token=${result.session.refresh_token}; ${refreshCookieFlags}; Path=/; Max-Age=2592000`
            ]);
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, result, 401);
        }
        return true;
    }
    
    // POST /api/auth/forgot-password - Request password reset
    if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const body = await parseBody(req);
        const result = await supabase.auth.requestPasswordReset(body.email);
        jsonResponse(res, result);
        return true;
    }
    
    // POST /api/auth/reset-password - Reset password with token
    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const body = await parseBody(req);
        const result = await supabase.auth.updatePassword(body.password, body.access_token);
        
        if (result.success) {
            jsonResponse(res, result);
        } else {
            jsonResponse(res, result, 400);
        }
        return true;
    }

    // ==================== OTP Authentication API ====================
    
    // POST /api/auth/otp/request - Request OTP code for login
    if (pathname === '/api/auth/otp/request' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const body = await parseBody(req);
        const { email } = body;
        
        if (!email || !email.includes('@')) {
            jsonResponse(res, { error: 'Valid email is required' }, 400);
            return true;
        }
        
        // Get client IP for rate limiting
        const requestIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || null;
        
        try {
            // Check if user exists (for login, user must exist)
            const { getAdminClient } = require('../../supabase/client');
            const admin = getAdminClient();
            
            if (admin) {
                const { data: existingUser } = await admin
                    .from('user_profiles')
                    .select('id')
                    .eq('email', email.toLowerCase())
                    .maybeSingle();
                
                // For security, don't reveal if email exists
            }
            
            // Create OTP
            const otp = require('../../supabase/otp');
            const result = await otp.createOTP(email, 'login', requestIp, userAgent);
            
            if (!result.success) {
                // Return rate limit info if applicable
                if (result.retryAfter) {
                    jsonResponse(res, { 
                        error: result.error,
                        retryAfter: result.retryAfter
                    }, 429);
                } else {
                    jsonResponse(res, { error: result.error }, 400);
                }
                return true;
            }
            
            // Send email with OTP code
            const emailService = require('../../supabase/email');
            const emailResult = await emailService.sendLoginCodeEmail({
                to: email,
                code: result.code,
                expiresInMinutes: result.expiresInMinutes
            });
            
            if (!emailResult.success) {
                log.warn({ event: 'auth_otp_email_failed', reason: emailResult.error }, 'Failed to send OTP email');
            }
            
            // Always return success (don't reveal if email exists or was sent)
            jsonResponse(res, { 
                success: true,
                message: 'If an account exists with this email, you will receive a login code.',
                expiresInMinutes: result.expiresInMinutes,
                config: otp.getConfig()
            });
            
        } catch (err) {
            logError(err, { module: 'auth', event: 'auth_otp_request_error' });
            jsonResponse(res, { error: 'Failed to process request' }, 500);
        }
        return true;
    }
    
    // POST /api/auth/otp/verify - Verify OTP code and login
    if (pathname === '/api/auth/otp/verify' && req.method === 'POST') {
        return await handleOTPVerify(req, res, supabase);
    }
    
    // POST /api/auth/otp/resend - Resend OTP code (alias for request)
    if (pathname === '/api/auth/otp/resend' && req.method === 'POST') {
        // Just fall through - not handled here, will be picked up as otp/request
        // This could be improved by calling the request handler directly
        return false;
    }
    
    // GET /api/auth/otp/config - Get OTP configuration for frontend
    if (pathname === '/api/auth/otp/config' && req.method === 'GET') {
        try {
            const otp = require('../../supabase/otp');
            jsonResponse(res, otp.getConfig());
        } catch (err) {
            jsonResponse(res, { 
                codeLength: 6, 
                expirationMinutes: 10, 
                resendCooldownSeconds: 60 
            });
        }
        return true;
    }
    
    // POST /api/auth/resend-confirmation - Resend email confirmation
    if (pathname === '/api/auth/resend-confirmation' && req.method === 'POST') {
        return await handleResendConfirmation(req, res, supabase);
    }
    
    // GET /api/auth/confirm-email - Confirm email via link (redirect)
    if (pathname === '/api/auth/confirm-email' && req.method === 'GET') {
        return await handleConfirmEmailGet(req, res, parsedUrl);
    }
    
    // POST /api/auth/confirm-email - Confirm email via code (API)
    if (pathname === '/api/auth/confirm-email' && req.method === 'POST') {
        return await handleConfirmEmailPost(req, res, supabase);
    }

    // Not an auth route we handle
    return false;
}

/**
 * Handle OTP verification
 */
async function handleOTPVerify(req, res, supabase) {
    if (!supabase || !supabase.isConfigured()) {
        jsonResponse(res, { error: 'Authentication not configured' }, 503);
        return true;
    }
    
    const body = await parseBody(req);
    const { email, code } = body;
    
    if (!email || !code) {
        jsonResponse(res, { error: 'Email and code are required' }, 400);
        return true;
    }
    
    // Validate code format
    if (!/^\d{6}$/.test(code)) {
        jsonResponse(res, { error: 'Invalid code format. Please enter 6 digits.' }, 400);
        return true;
    }
    
    try {
        const otp = require('../../supabase/otp');
        const verifyResult = await otp.verifyOTP(email, code, 'login');
        
        if (!verifyResult.success) {
            jsonResponse(res, { 
                error: verifyResult.error,
                attemptsRemaining: verifyResult.attemptsRemaining
            }, 401);
            return true;
        }
        
        // OTP verified - create session for the user
        const { getAdminClient, getClient } = require('../../supabase/client');
        const admin = getAdminClient();
        
        if (!admin) {
            jsonResponse(res, { error: 'Database not configured' }, 503);
            return true;
        }
        
        // Find user by email
        const { data: userData, error: userError } = await admin.auth.admin.listUsers();
        
        if (userError) {
            log.warn({ event: 'auth_list_users_failed', reason: userError.message }, 'Failed to list users');
            jsonResponse(res, { error: 'Authentication failed' }, 500);
            return true;
        }
        
        const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            jsonResponse(res, { error: 'No account found with this email' }, 404);
            return true;
        }
        
        // Check if email is confirmed
        if (!user.email_confirmed_at) {
            jsonResponse(res, { 
                error: 'Please confirm your email address first',
                needsEmailVerification: true
            }, 403);
            return true;
        }
        
        // Generate session tokens using Supabase Admin API
        const { data: sessionData, error: sessionError } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: user.email
        });
        
        if (sessionError || !sessionData) {
            log.warn({ event: 'auth_session_generate_failed', reason: sessionError?.message }, 'Failed to generate session');
            jsonResponse(res, { 
                error: 'Failed to create session. Please try password login.',
                fallbackToPassword: true
            }, 500);
            return true;
        }
        
        // Get user profile
        const profile = await supabase.auth.getUserProfile(user.id);
        
        // Try to verify the magic link token
        const client = getClient();
        
        if (sessionData.properties?.hashed_token) {
            const verifyUrl = sessionData.properties.verification_url || sessionData.properties.action_link;
            
            if (verifyUrl) {
                try {
                    const urlParams = new URL(verifyUrl);
                    const token = urlParams.searchParams.get('token') || urlParams.hash?.split('access_token=')[1]?.split('&')[0];
                    
                    if (token) {
                        const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
                            token_hash: sessionData.properties.hashed_token,
                            type: 'magiclink'
                        });
                        
                        if (!verifyError && verifyData.session) {
                            // Set session cookies
                            const otpCookieFlags = getCookieSecurityFlags(req);
                            res.setHeader('Set-Cookie', [
                                `sb-access-token=${verifyData.session.access_token}; ${otpCookieFlags}; Path=/; Max-Age=3600`,
                                `sb-refresh-token=${verifyData.session.refresh_token}; ${otpCookieFlags}; Path=/; Max-Age=2592000`
                            ]);
                            
                            // Invalidate all other OTPs for this email
                            await otp.invalidateOTPs(email, 'login');
                            
                            // Send new device notification
                            try {
                                const emailService = require('../../supabase/email');
                                const requestIp = getClientIp(req);
                                const userAgent = req.headers['user-agent'] || null;
                                
                                emailService.sendNewDeviceLoginEmail({
                                    to: email,
                                    deviceInfo: userAgent,
                                    loginTime: new Date().toISOString(),
                                    ipAddress: requestIp
                                }).catch(e => log.debug({ event: 'auth_device_notification_skipped', reason: e.message }, 'Device notification skipped'));
                            } catch (e) { /* ignore */ }
                            
                            jsonResponse(res, {
                                success: true,
                                user: {
                                    id: user.id,
                                    email: user.email,
                                    email_confirmed_at: user.email_confirmed_at,
                                    created_at: user.created_at,
                                    user_metadata: user.user_metadata,
                                    profile: profile
                                }
                            });
                            return true;
                        }
                    }
                } catch (e) {
                    log.warn({ event: 'auth_token_verification_error', reason: e.message }, 'Token verification error');
                }
            }
        }
        
        // If we couldn't create a proper session, return the magic link
        if (sessionData.properties?.action_link) {
            jsonResponse(res, {
                success: true,
                redirectTo: sessionData.properties.action_link,
                message: 'Please click the link to complete login'
            });
            return true;
        }
        
        // Last resort
        jsonResponse(res, { 
            error: 'OTP verification succeeded but session creation failed. Please use password login.',
            otpVerified: true
        }, 500);
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_otp_verify_error' });
        jsonResponse(res, { error: 'Verification failed' }, 500);
    }
    return true;
}

/**
 * Handle resend confirmation email
 */
async function handleResendConfirmation(req, res, supabase) {
    if (!supabase || !supabase.isConfigured()) {
        jsonResponse(res, { error: 'Authentication not configured' }, 503);
        return true;
    }
    
    const body = await parseBody(req);
    const { email } = body;
    
    if (!email || !email.includes('@')) {
        jsonResponse(res, { error: 'Valid email is required' }, 400);
        return true;
    }
    
    const requestIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    
    try {
        const otp = require('../../supabase/otp');
        const emailService = require('../../supabase/email');
        
        // Create OTP for email confirmation
        const otpResult = await otp.createOTP(email, 'email_confirm', requestIp, userAgent);
        
        if (!otpResult.success) {
            if (otpResult.retryAfter) {
                jsonResponse(res, { 
                    error: otpResult.error,
                    retryAfter: otpResult.retryAfter
                }, 429);
            } else {
                jsonResponse(res, { error: otpResult.error }, 400);
            }
            return true;
        }
        
        // Build confirmation link
        const appUrl = process.env.APP_URL || 'http://localhost:3005';
        const confirmLink = `${appUrl}/api/auth/confirm-email?email=${encodeURIComponent(email)}&code=${otpResult.code}`;
        
        // Send branded confirmation email via Resend
        const emailResult = await emailService.sendEmailConfirmationEmail({
            to: email,
            code: otpResult.code,
            confirmLink: confirmLink,
            expiresInMinutes: otpResult.expiresInMinutes
        });
        
        if (!emailResult.success) {
            log.warn({ event: 'auth_confirmation_email_failed', reason: emailResult.error }, 'Failed to send confirmation email');
        }
        
        jsonResponse(res, { 
            success: true,
            message: 'If an account exists with this email, a confirmation code has been sent.',
            expiresInMinutes: otpResult.expiresInMinutes
        });
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_resend_confirmation_error' });
        jsonResponse(res, { error: 'Failed to process request' }, 500);
    }
    return true;
}

/**
 * Handle GET /api/auth/confirm-email (redirect flow)
 */
async function handleConfirmEmailGet(req, res, parsedUrl) {
    const log = getLogger().child({ module: 'auth' });
    const code = parsedUrl.query.code;
    const email = parsedUrl.query.email;
    
    if (!code || !email) {
        res.writeHead(302, { 
            'Location': '/?auth=confirm-error&message=missing-params' 
        });
        res.end();
        return true;
    }
    
    try {
        const otp = require('../../supabase/otp');
        const verifyResult = await otp.verifyOTP(email, code, 'email_confirm');
        
        if (!verifyResult.success) {
            res.writeHead(302, { 
                'Location': `/?auth=confirm-error&message=${encodeURIComponent(verifyResult.error)}` 
            });
            res.end();
            return true;
        }
        
        // Mark email as confirmed in Supabase
        const { getAdminClient } = require('../../supabase/client');
        const admin = getAdminClient();
        
        if (admin) {
            // Find and update user
            const { data: userData } = await admin.auth.admin.listUsers();
            const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
            
            if (user && !user.email_confirmed_at) {
                await admin.auth.admin.updateUserById(user.id, {
                    email_confirm: true
                });
            }
        }
        
        // Invalidate all confirmation OTPs for this email
        await otp.invalidateOTPs(email, 'email_confirm');
        
        // Redirect to success page
        res.writeHead(302, { 
            'Location': '/?auth=confirmed&email=' + encodeURIComponent(email) 
        });
        res.end();
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_confirm_email_error' });
        res.writeHead(302, { 
            'Location': '/?auth=confirm-error&message=server-error' 
        });
        res.end();
    }
    return true;
}

/**
 * Handle POST /api/auth/confirm-email (API flow)
 */
async function handleConfirmEmailPost(req, res, supabase) {
    if (!supabase || !supabase.isConfigured()) {
        jsonResponse(res, { error: 'Authentication not configured' }, 503);
        return true;
    }
    
    const body = await parseBody(req);
    const { email, code } = body;
    
    if (!email || !code) {
        jsonResponse(res, { error: 'Email and code are required' }, 400);
        return true;
    }
    
    try {
        const otp = require('../../supabase/otp');
        const verifyResult = await otp.verifyOTP(email, code, 'email_confirm');
        
        if (!verifyResult.success) {
            jsonResponse(res, { 
                error: verifyResult.error,
                attemptsRemaining: verifyResult.attemptsRemaining
            }, 401);
            return true;
        }
        
        // Mark email as confirmed
        const { getAdminClient } = require('../../supabase/client');
        const admin = getAdminClient();
        
        if (admin) {
            const { data: userData } = await admin.auth.admin.listUsers();
            const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
            
            if (user && !user.email_confirmed_at) {
                await admin.auth.admin.updateUserById(user.id, {
                    email_confirm: true
                });
            }
        }
        
        // Invalidate all confirmation OTPs
        await otp.invalidateOTPs(email, 'email_confirm');
        
        jsonResponse(res, { 
            success: true, 
            message: 'Email confirmed successfully. You can now log in.' 
        });
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_confirm_email_error' });
        jsonResponse(res, { error: 'Confirmation failed' }, 500);
    }
    return true;
}

module.exports = {
    handleAuth
};
