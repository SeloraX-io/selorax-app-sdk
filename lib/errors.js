/**
 * Custom error classes for structured error handling.
 *
 *   try { await seloraxApi.orders.get(storeId, id); }
 *   catch (err) {
 *       if (err instanceof SeloraxApiError) { ... }
 *       if (err.isRetryable) { ... }
 *   }
 */

class SeloraxError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'SeloraxError';
        this.code = code || 'SELORAX_ERROR';
    }
}

class SeloraxApiError extends SeloraxError {
    constructor(message, status, data, endpoint) {
        super(message, 'API_ERROR');
        this.name = 'SeloraxApiError';
        this.status = status;
        this.data = data;
        this.endpoint = endpoint;
        this.isRetryable = status === 429 || status >= 500;
    }
}

class SeloraxAuthError extends SeloraxError {
    constructor(message, reason) {
        super(message, 'AUTH_ERROR');
        this.name = 'SeloraxAuthError';
        this.reason = reason; // 'missing_token' | 'invalid_token' | 'expired_token' | 'not_configured'
    }
}

class SeloraxWebhookError extends SeloraxError {
    constructor(message, reason) {
        super(message, 'WEBHOOK_ERROR');
        this.name = 'SeloraxWebhookError';
        this.reason = reason; // 'invalid_signature' | 'stale_timestamp' | 'missing_headers'
    }
}

class SeloraxConfigError extends SeloraxError {
    constructor(message, missingVars) {
        super(message, 'CONFIG_ERROR');
        this.name = 'SeloraxConfigError';
        this.missingVars = missingVars;
    }
}

module.exports = {
    SeloraxError,
    SeloraxApiError,
    SeloraxAuthError,
    SeloraxWebhookError,
    SeloraxConfigError,
};
