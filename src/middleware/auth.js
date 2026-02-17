/**
 * Purpose:
 *   Express middleware for JWT-based authentication and role-based
 *   authorization, backed by Supabase Auth.
 *
 * Responsibilities:
 *   - Token extraction from Authorization header, cookie, or x-access-token header
 *   - JWT verification via Supabase Auth (getUser)
 *   - Route-level guards: requireAuth, requireProjectAccess, requireAdmin, requireSuperAdmin
 *   - Optional auth for mixed public/private endpoints
 *   - Basic per-user/IP rate limiting (fixed window) and multi-tier OTP rate limiting
 *   - Global auth handler that protects all /api routes except a PUBLIC_ROUTES allowlist
 *
 * Key dependencies:
 *   - ../supabase: Supabase client for token verification and role lookups
 *     (loaded with a try/catch so the server can still start without it)
 *   - ../logger: Structured logging (pino-based)
 *
 * Side effects:
 *   - Mutates `req` by attaching: user, token, projectId, projectRole
 *   - rateLimitMap / otpRateLimitMap grow unboundedly in memory (no eviction);
 *     acceptable for moderate traffic but could leak under sustained attack
 *
 * Notes:
 *   - In development without SUPABASE_URL, requireAuth silently passes all requests
 *     to ease local dev. This is gated on NODE_ENV === 'development'.
 *   - requireProjectAccess and requireAdmin each call verifyToken independently
 *     rather than chaining requireAuth, so they are self-contained middleware.
 *   - OTP rate limiting uses three sliding windows (minute/hour/day) keyed by
 *     email (preferred) or IP, to mitigate brute-force OTP guessing.
 *
 * Usage:
 *   const { requireAuth, requireProjectAccess, optionalAuth } = require('./middleware/auth');
 *
 *   app.get('/api/facts', requireAuth, handler);
 *   app.get('/api/projects/:projectId/facts', requireProjectAccess, handler);
 *   app.get('/api/public', optionalAuth, handler);
 */

const { logger: rootLogger } = require('../logger');
const log = rootLogger.child({ module: 'auth-middleware' });

// Supabase is loaded lazily so the server can start even when credentials are
// missing (e.g. local dev, CI). When null, requireAuth falls through in
// development mode and returns 503 in production.
let supabase = null;
try {
    supabase = require('../supabase');
} catch (e) {
    log.warn({ event: 'auth_middleware_supabase_unavailable', reason: e.message }, 'Supabase module not available');
}

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/password-reset',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/otp/request',
    '/api/auth/otp/verify',
    '/api/auth/otp/resend',
    '/api/auth/otp/config',
    '/api/auth/confirm-email',
    '/api/auth/resend-confirmation',
    '/api/health',
    '/api/status',
    '/api/version',
    '/api/openapi',
    '/' // Static files
];

/**
 * Check if route is public
 */
function isPublicRoute(path) {
    // Static files
    if (!path.startsWith('/api/')) return true;
    
    // Public API routes
    for (const route of PUBLIC_ROUTES) {
        if (path === route || path.startsWith(route + '/')) {
            return true;
        }
    }
    
    return false;
}

/**
 * Extract and verify a JWT token from the incoming request.
 *
 * Token lookup order: Authorization Bearer header > access_token cookie > x-access-token header.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{valid: boolean, user?: object, token?: string, error?: string}>}
 *   `valid` is true only when Supabase confirms the token maps to an active user.
 */
async function verifyToken(req) {
    if (!supabase) {
        return { valid: false, error: 'Auth not configured' };
    }
    
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.cookies?.access_token) {
        token = req.cookies.access_token;
    } else if (req.headers['x-access-token']) {
        token = req.headers['x-access-token'];
    }
    
    if (!token) {
        return { valid: false, error: 'No token provided' };
    }
    
    try {
        const result = await supabase.auth.getUser(token);
        
        if (!result.success || !result.user) {
            return { valid: false, error: result.error || 'Invalid token' };
        }
        
        return { valid: true, user: result.user, token };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}

/**
 * Require authentication middleware
 * Returns 401 if not authenticated
 */
async function requireAuth(req, res, next) {
    // Skip for public routes
    if (isPublicRoute(req.path)) {
        return next();
    }
    
    // Check if Supabase is configured
    if (!supabase || !supabase.isConfigured?.()) {
        // In development without Supabase, allow all requests
        if (process.env.NODE_ENV === 'development' && !process.env.SUPABASE_URL) {
            log.warn({ event: 'auth_skip_development' }, 'Supabase not configured, skipping auth in development');
            return next();
        }
        
        return res.status(503).json({
            error: 'Authentication service unavailable',
            code: 'AUTH_UNAVAILABLE'
        });
    }
    
    const result = await verifyToken(req);
    
    if (!result.valid) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED',
            message: result.error
        });
    }
    
    // Attach user to request
    req.user = result.user;
    req.token = result.token;
    
    next();
}

/**
 * Require project access middleware.
 * Verifies auth, then checks that the user holds any membership role on the
 * target project. The project ID is resolved from params, query, or header
 * (in that order).
 *
 * Attaches to req: user, token, projectId, projectRole.
 *
 * @returns 400 if no project ID is supplied, 401 if unauthenticated,
 *          403 if the user has no role on the project, 500 on lookup failure.
 */
async function requireProjectAccess(req, res, next) {
    // First, require authentication
    const authResult = await verifyToken(req);
    
    if (!authResult.valid) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    
    req.user = authResult.user;
    req.token = authResult.token;
    
    // Get project ID from params, query, or header
    const projectId = req.params.projectId || req.query.projectId || req.headers['x-project-id'];
    
    if (!projectId) {
        return res.status(400).json({
            error: 'Project ID required',
            code: 'PROJECT_REQUIRED'
        });
    }
    
    // Check project access
    try {
        const memberRole = await supabase.members.getMemberRole(projectId, authResult.user.id);
        
        if (!memberRole) {
            return res.status(403).json({
                error: 'Access denied to this project',
                code: 'PROJECT_ACCESS_DENIED'
            });
        }
        
        req.projectId = projectId;
        req.projectRole = memberRole;
        
        next();
    } catch (e) {
        return res.status(500).json({
            error: 'Failed to verify project access',
            code: 'PROJECT_ACCESS_ERROR'
        });
    }
}

/**
 * Optional authentication middleware
 * Attaches user to request if authenticated, but doesn't require it
 */
async function optionalAuth(req, res, next) {
    const result = await verifyToken(req);
    
    if (result.valid) {
        req.user = result.user;
        req.token = result.token;
    }
    
    next();
}

/**
 * Require admin role middleware.
 * Like requireProjectAccess, but restricts to 'admin' or 'owner' roles.
 * Returns 403 if the user is a regular member.
 */
async function requireAdmin(req, res, next) {
    // First, require project access
    const authResult = await verifyToken(req);
    
    if (!authResult.valid) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    
    req.user = authResult.user;
    
    const projectId = req.params.projectId || req.query.projectId || req.headers['x-project-id'];
    
    if (!projectId) {
        return res.status(400).json({
            error: 'Project ID required',
            code: 'PROJECT_REQUIRED'
        });
    }
    
    try {
        const memberRole = await supabase.members.getMemberRole(projectId, authResult.user.id);
        
        if (!memberRole || !['owner', 'admin'].includes(memberRole)) {
            return res.status(403).json({
                error: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }
        
        req.projectId = projectId;
        req.projectRole = memberRole;
        
        next();
    } catch (e) {
        return res.status(500).json({
            error: 'Failed to verify admin access',
            code: 'ACCESS_ERROR'
        });
    }
}

/**
 * Require superadmin role middleware
 * User must be a superadmin
 */
async function requireSuperAdmin(req, res, next) {
    const authResult = await verifyToken(req);
    
    if (!authResult.valid) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    
    req.user = authResult.user;
    
    try {
        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
        
        if (!isSuperAdmin) {
            return res.status(403).json({
                error: 'Superadmin access required',
                code: 'SUPERADMIN_REQUIRED'
            });
        }
        
        next();
    } catch (e) {
        return res.status(500).json({
            error: 'Failed to verify superadmin access',
            code: 'ACCESS_ERROR'
        });
    }
}

/**
 * Basic fixed-window rate limiter scoped to this auth module.
 * Keyed by authenticated user ID (preferred) or raw IP.
 *
 * NOTE: This is a simpler, secondary rate limiter that lives in the auth
 * module. The primary, route-aware rate limiter lives in ./ratelimit.js.
 * The rateLimitMap is never pruned -- stale entries accumulate until the
 * process restarts. Acceptable for low-to-moderate traffic.
 */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

function rateLimit(req, res, next) {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    
    let record = rateLimitMap.get(key);
    
    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
        record = { windowStart: now, count: 0 };
        rateLimitMap.set(key, record);
    }
    
    record.count++;
    
    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil((record.windowStart + RATE_LIMIT_WINDOW - now) / 1000)
        });
    }
    
    res.set('X-RateLimit-Limit', RATE_LIMIT_MAX);
    res.set('X-RateLimit-Remaining', RATE_LIMIT_MAX - record.count);
    res.set('X-RateLimit-Reset', record.windowStart + RATE_LIMIT_WINDOW);
    
    next();
}

/**
 * OTP-specific rate limiter with three independent fixed windows
 * (minute, hour, day). Intentionally aggressive to prevent brute-force
 * OTP enumeration.
 *
 * Keying strategy: email address from the request body when available
 * (normalised to lowercase), otherwise client IP. Email-based keying
 * prevents an attacker from rotating IPs to bypass limits.
 */
const otpRateLimitMap = new Map();
const OTP_RATE_LIMITS = {
    perMinute: { max: 2, window: 60000 },      // 2 requests per minute
    perHour: { max: 10, window: 3600000 },     // 10 requests per hour
    perDay: { max: 20, window: 86400000 }      // 20 requests per day
};

function otpRateLimit(req, res, next) {
    // Get identifier: prefer email from body, fall back to IP
    let identifier;
    try {
        // For OTP requests, the email is in the body
        if (req.body && req.body.email) {
            identifier = `email:${req.body.email.toLowerCase()}`;
        } else {
            identifier = `ip:${getClientIp(req)}`;
        }
    } catch {
        identifier = `ip:${getClientIp(req)}`;
    }
    
    const now = Date.now();
    
    let record = otpRateLimitMap.get(identifier);
    
    if (!record) {
        record = {
            minuteStart: now,
            minuteCount: 0,
            hourStart: now,
            hourCount: 0,
            dayStart: now,
            dayCount: 0
        };
        otpRateLimitMap.set(identifier, record);
    }
    
    // Reset windows if expired
    if (now - record.minuteStart > OTP_RATE_LIMITS.perMinute.window) {
        record.minuteStart = now;
        record.minuteCount = 0;
    }
    if (now - record.hourStart > OTP_RATE_LIMITS.perHour.window) {
        record.hourStart = now;
        record.hourCount = 0;
    }
    if (now - record.dayStart > OTP_RATE_LIMITS.perDay.window) {
        record.dayStart = now;
        record.dayCount = 0;
    }
    
    // Check limits
    if (record.minuteCount >= OTP_RATE_LIMITS.perMinute.max) {
        const retryAfter = Math.ceil((record.minuteStart + OTP_RATE_LIMITS.perMinute.window - now) / 1000);
        return res.status(429).json({
            error: 'Too many code requests. Please wait before trying again.',
            code: 'OTP_RATE_LIMITED',
            retryAfter
        });
    }
    
    if (record.hourCount >= OTP_RATE_LIMITS.perHour.max) {
        const retryAfter = Math.ceil((record.hourStart + OTP_RATE_LIMITS.perHour.window - now) / 1000);
        return res.status(429).json({
            error: 'Too many code requests this hour. Please try again later.',
            code: 'OTP_RATE_LIMITED_HOUR',
            retryAfter
        });
    }
    
    if (record.dayCount >= OTP_RATE_LIMITS.perDay.max) {
        return res.status(429).json({
            error: 'Daily limit reached. Please try again tomorrow.',
            code: 'OTP_RATE_LIMITED_DAY',
            retryAfter: Math.ceil((record.dayStart + OTP_RATE_LIMITS.perDay.window - now) / 1000)
        });
    }
    
    // Increment counters
    record.minuteCount++;
    record.hourCount++;
    record.dayCount++;
    
    next();
}

/**
 * Resolve the originating client IP from proxy headers, falling back to
 * the socket address. When behind a reverse proxy, x-forwarded-for may
 * contain a comma-separated list; only the first (leftmost) entry is used.
 *
 * @returns {string} IP address or 'unknown'
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.socket?.remoteAddress ||
           'unknown';
}

/**
 * Global authentication handler for all routes
 * Use this to protect all /api routes except public ones
 */
function globalAuthHandler(req, res, next) {
    // Skip non-API routes
    if (!req.path.startsWith('/api/')) {
        return next();
    }
    
    // Skip public routes
    if (isPublicRoute(req.path)) {
        return next();
    }
    
    // Require authentication for all other API routes
    return requireAuth(req, res, next);
}

module.exports = {
    requireAuth,
    requireProjectAccess,
    requireAdmin,
    requireSuperAdmin,
    optionalAuth,
    rateLimit,
    otpRateLimit,
    globalAuthHandler,
    isPublicRoute,
    verifyToken,
    getClientIp,
    PUBLIC_ROUTES
};
