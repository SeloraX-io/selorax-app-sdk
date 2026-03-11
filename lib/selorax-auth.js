/**
 * Session Token Middleware
 *
 * Features:
 *   - Local JWT verification (fast, no network)
 *   - Platform verification fallback with LRU-bounded cache
 *   - Factory function for custom config: createAuth({ signingKey, ... })
 *   - Structured errors via SeloraxAuthError
 *
 * Usage:
 *   const { seloraxAuth } = require('selorax-app-sdk');
 *   app.use('/api', seloraxAuth, handler);
 *
 *   // Custom config:
 *   const { createAuth } = require('selorax-app-sdk');
 *   const auth = createAuth({ signingKey: '...', cacheTtl: 60000 });
 *   app.use('/api', auth, handler);
 */
const jwt = require('jsonwebtoken');
const { SeloraxAuthError } = require('./errors');

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes
const DEFAULT_CACHE_MAX = 1000;            // max cached tokens

class TokenVerificationCache {
    constructor(ttl = DEFAULT_CACHE_TTL, maxSize = DEFAULT_CACHE_MAX) {
        this.ttl = ttl;
        this.maxSize = maxSize;
        this._cache = new Map();
        this._cleanupTimer = setInterval(() => this._cleanup(), Math.min(ttl, 2 * 60 * 1000));
        this._cleanupTimer.unref();
    }

    get(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(key, data) {
        // Evict oldest if at capacity
        if (this._cache.size >= this.maxSize) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
        this._cache.set(key, { data, expiresAt: Date.now() + this.ttl });
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, entry] of this._cache) {
            if (now > entry.expiresAt) this._cache.delete(key);
        }
    }

    get size() {
        return this._cache.size;
    }

    clear() {
        this._cache.clear();
    }
}

/**
 * Verify session token via the platform HTTP endpoint.
 */
async function verifyViaPlatform(sessionToken, config, cache) {
    const cached = cache.get(sessionToken);
    if (cached) return cached;

    const res = await fetch(`${config.apiUrl}/apps/session/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_token: sessionToken,
            client_id: config.clientId,
            client_secret: config.clientSecret,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { valid: false, error: err.message || 'Verification failed' };
    }

    const body = await res.json();
    const result = {
        valid: true,
        store_id: body.data.store_id,
        installation_id: body.data.installation_id,
        app_id: body.data.app_id,
    };

    cache.set(sessionToken, result);
    return result;
}

/**
 * Verify session token locally via JWT signature.
 */
function verifyLocal(sessionToken, signingKey) {
    let payload;
    try {
        payload = jwt.verify(sessionToken, signingKey, { algorithms: ['HS256'] });
    } catch (e) {
        const reason = e.name === 'TokenExpiredError' ? 'expired_token' : 'invalid_token';
        throw new SeloraxAuthError(
            reason === 'expired_token' ? 'Session token has expired.' : 'Invalid session token.',
            reason
        );
    }

    const store_id = Number(payload.sub);
    const installation_id = Number(payload.sid);

    if (!store_id || !installation_id) {
        throw new SeloraxAuthError('Invalid session token claims.', 'invalid_token');
    }

    return { store_id, installation_id, app_id: payload.app_id };
}

/**
 * Create an auth middleware with custom configuration.
 *
 * @param {object} config
 * @param {string} [config.signingKey] - SESSION_SIGNING_KEY for local verification
 * @param {string} [config.apiUrl] - Platform API URL for remote verification
 * @param {string} [config.clientId] - Client ID for remote verification
 * @param {string} [config.clientSecret] - Client secret for remote verification
 * @param {number} [config.cacheTtl=300000] - Cache TTL in ms for platform-verified tokens
 * @param {number} [config.cacheMax=1000] - Max number of cached tokens
 * @returns {Function} Express middleware
 */
function createAuth(config = {}) {
    const signingKey = config.signingKey || process.env.SESSION_SIGNING_KEY;
    const apiUrl = config.apiUrl || process.env.SELORAX_API_URL;
    const clientId = config.clientId || process.env.SELORAX_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.SELORAX_CLIENT_SECRET;
    const cacheTtl = config.cacheTtl ?? DEFAULT_CACHE_TTL;
    const cacheMax = config.cacheMax ?? DEFAULT_CACHE_MAX;

    const cache = new TokenVerificationCache(cacheTtl, cacheMax);

    return async function seloraxAuth(req, res, next) {
        const sessionToken = req.header('X-Session-Token') || req.header('x-session-token');

        if (!sessionToken) {
            return res.status(401).send({
                message: 'Access denied. No session token provided.',
                code: 'missing_token',
                status: 401,
            });
        }

        // Fast path: local JWT verification
        if (signingKey) {
            try {
                req.session = verifyLocal(sessionToken, signingKey);
                return next();
            } catch (e) {
                return res.status(401).send({
                    message: e.message,
                    code: e.reason,
                    status: 401,
                });
            }
        }

        // Fallback: platform verification
        if (apiUrl && clientId && clientSecret) {
            try {
                const result = await verifyViaPlatform(
                    sessionToken,
                    { apiUrl, clientId, clientSecret },
                    cache
                );

                if (!result.valid) {
                    return res.status(401).send({
                        message: result.error || 'Invalid session token.',
                        code: 'invalid_token',
                        status: 401,
                    });
                }

                req.session = {
                    store_id: result.store_id,
                    installation_id: result.installation_id,
                    app_id: result.app_id,
                };
                return next();

            } catch (e) {
                if (e instanceof SeloraxAuthError) {
                    return res.status(401).send({ message: e.message, code: e.reason, status: 401 });
                }
                console.error('[SeloraX Auth] Platform verification error:', e.message);
                return res.status(500).send({
                    message: 'Session verification failed.',
                    code: 'verification_error',
                    status: 500,
                });
            }
        }

        return res.status(401).send({
            message: 'Session token verification not configured. Set SESSION_SIGNING_KEY or platform credentials.',
            code: 'not_configured',
            status: 401,
        });
    };
}

// Default middleware using env vars
const defaultAuth = createAuth();

module.exports = defaultAuth;
module.exports.createAuth = createAuth;
module.exports.verifyLocal = verifyLocal;
module.exports.TokenVerificationCache = TokenVerificationCache;
