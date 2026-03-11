/**
 * SeloraX Platform API Client
 *
 * Features:
 *   - Namespaced methods (orders, products, billing, etc.)
 *   - Auto-retry with exponential backoff on 429 / 5xx
 *   - Configurable timeout per request
 *   - Pagination helper to fetch all pages
 *   - Class-based — instantiate with custom config or use env defaults
 *
 * Usage:
 *   // Default (reads from process.env)
 *   const { seloraxApi } = require('selorax-app-sdk');
 *   const orders = await seloraxApi.orders.list(storeId);
 *
 *   // Custom instance
 *   const { SeloraxApi } = require('selorax-app-sdk');
 *   const api = new SeloraxApi({ apiUrl, clientId, clientSecret });
 */

const { SeloraxApiError, SeloraxConfigError } = require('./errors');
const { HEADERS } = require('./constants');

const DEFAULTS = {
    timeout: 30000,       // 30 seconds
    maxRetries: 3,
    retryBaseDelay: 500,  // ms — doubles each attempt: 500, 1000, 2000
};

class SeloraxApi {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || process.env.SELORAX_API_URL || 'https://api-dev.selorax.io/api';
        this.clientId = config.clientId || process.env.SELORAX_CLIENT_ID;
        this.clientSecret = config.clientSecret || process.env.SELORAX_CLIENT_SECRET;
        this.timeout = config.timeout ?? DEFAULTS.timeout;
        this.maxRetries = config.maxRetries ?? DEFAULTS.maxRetries;
        this.retryBaseDelay = config.retryBaseDelay ?? DEFAULTS.retryBaseDelay;
        this.onRequest = config.onRequest || null;   // (method, path, storeId) => void
        this.onResponse = config.onResponse || null; // (method, path, status, ms) => void

        // Namespaced methods
        this.orders = {
            list: (storeId, params) => this.get(storeId, '/apps/v1/orders', params),
            get: (storeId, orderId) => this.get(storeId, `/apps/v1/orders/${orderId}`),
            listAll: (storeId, params) => this.paginate(storeId, '/apps/v1/orders', params),
        };

        this.products = {
            list: (storeId, params) => this.get(storeId, '/apps/v1/products', params),
            get: (storeId, productId) => this.get(storeId, `/apps/v1/products/${productId}`),
            listAll: (storeId, params) => this.paginate(storeId, '/apps/v1/products', params),
        };

        this.customers = {
            list: (storeId, params) => this.get(storeId, '/apps/v1/customers', params),
            get: (storeId, userId) => this.get(storeId, `/apps/v1/customers/${userId}`),
            listAll: (storeId, params) => this.paginate(storeId, '/apps/v1/customers', params),
        };

        this.store = {
            get: (storeId) => this.get(storeId, '/apps/v1/store'),
        };

        this.inventory = {
            list: (storeId, params) => this.get(storeId, '/apps/v1/inventory', params),
            listAll: (storeId, params) => this.paginate(storeId, '/apps/v1/inventory', params),
        };

        this.billing = {
            createCharge: (storeId, body) => this.post(storeId, '/apps/v1/billing/charges', body),
            getCharge: (storeId, chargeId) => this.get(storeId, `/apps/v1/billing/charges/${chargeId}`),
            getWallet: (storeId) => this.get(storeId, '/apps/v1/billing/wallet'),
            debitWallet: (storeId, amount, description, metadata) =>
                this.post(storeId, '/apps/v1/billing/wallet/debit', { amount, description, metadata }),
            createTopup: (storeId, amount) => this.post(storeId, '/apps/v1/billing/wallet-topup', { amount }),
        };

        this.webhooks = {
            list: (storeId) => this.get(storeId, '/apps/v1/webhooks'),
            create: (storeId, body) => this.post(storeId, '/apps/v1/webhooks', body),
        };
    }

    _validateCredentials() {
        const missing = [];
        if (!this.clientId) missing.push('SELORAX_CLIENT_ID');
        if (!this.clientSecret) missing.push('SELORAX_CLIENT_SECRET');
        if (missing.length > 0) {
            throw new SeloraxConfigError(
                `Missing required credentials: ${missing.join(', ')}. Set them in .env or pass to constructor.`,
                missing
            );
        }
    }

    _buildHeaders(storeId) {
        return {
            'Content-Type': 'application/json',
            [HEADERS.CLIENT_ID]: this.clientId,
            [HEADERS.CLIENT_SECRET]: this.clientSecret,
            [HEADERS.STORE_ID]: String(storeId),
        };
    }

    async _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Core request method with retry logic.
     */
    async apiCall(storeId, method, path, body = null) {
        this._validateCredentials();

        const url = `${this.apiUrl}${path}`;
        const headers = this._buildHeaders(storeId);
        const options = { method, headers };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        if (this.timeout > 0) {
            options.signal = AbortSignal.timeout(this.timeout);
        }

        if (this.onRequest) this.onRequest(method, path, storeId);

        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            const start = Date.now();
            try {
                const response = await fetch(url, options);
                const ms = Date.now() - start;
                if (this.onResponse) this.onResponse(method, path, response.status, ms);

                const data = await response.json();

                if (!response.ok) {
                    const err = new SeloraxApiError(
                        data.message || `API call failed: ${response.status}`,
                        response.status,
                        data,
                        `${method} ${path}`
                    );

                    // Retry on 429 (rate limit) or 5xx (server error)
                    if (err.isRetryable && attempt < this.maxRetries) {
                        const delay = this.retryBaseDelay * Math.pow(2, attempt);
                        // Respect Retry-After header if present
                        const retryAfter = response.headers.get('Retry-After');
                        const waitMs = retryAfter ? Number(retryAfter) * 1000 : delay;
                        await this._sleep(waitMs);
                        lastError = err;
                        continue;
                    }
                    throw err;
                }

                return data;

            } catch (err) {
                if (err instanceof SeloraxApiError) throw err;

                // Network errors / timeouts — retry
                if (attempt < this.maxRetries && err.name !== 'SeloraxConfigError') {
                    await this._sleep(this.retryBaseDelay * Math.pow(2, attempt));
                    lastError = err;
                    continue;
                }

                if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                    throw new SeloraxApiError(
                        `Request timed out after ${this.timeout}ms`,
                        0, null, `${method} ${path}`
                    );
                }
                throw err;
            }
        }

        throw lastError;
    }

    // ── Convenience methods ──

    _buildQuery(params) {
        if (!params || Object.keys(params).length === 0) return '';
        return '?' + new URLSearchParams(params).toString();
    }

    get(storeId, path, params) {
        return this.apiCall(storeId, 'GET', path + this._buildQuery(params));
    }

    post(storeId, path, body) {
        return this.apiCall(storeId, 'POST', path, body);
    }

    put(storeId, path, body) {
        return this.apiCall(storeId, 'PUT', path, body);
    }

    del(storeId, path) {
        return this.apiCall(storeId, 'DELETE', path);
    }

    /**
     * Auto-paginate: fetches all pages and returns combined data array.
     *
     *   const allOrders = await api.orders.listAll(storeId, { limit: 50 });
     *
     * @param {number} storeId
     * @param {string} path - API path
     * @param {object} params - Query params (limit, etc.)
     * @param {number} [maxPages=50] - Safety limit to prevent infinite loops
     * @returns {Array} Combined data from all pages
     */
    async paginate(storeId, path, params = {}, maxPages = 50) {
        const allData = [];
        let page = 1;
        const limit = params.limit || 50;

        for (let i = 0; i < maxPages; i++) {
            const result = await this.get(storeId, path, { ...params, page, limit });
            const items = Array.isArray(result.data) ? result.data : [];
            allData.push(...items);

            // Stop when we get fewer items than the limit (last page)
            if (items.length < limit) break;
            page++;
        }

        return allData;
    }
}

// Default singleton instance (reads from env)
const defaultInstance = new SeloraxApi();

// Export both the class and a default instance with flat access
module.exports = {
    SeloraxApi,
    apiCall: (...args) => defaultInstance.apiCall(...args),
    get: (...args) => defaultInstance.get(...args),
    post: (...args) => defaultInstance.post(...args),
    put: (...args) => defaultInstance.put(...args),
    del: (...args) => defaultInstance.del(...args),
    paginate: (...args) => defaultInstance.paginate(...args),
    orders: defaultInstance.orders,
    products: defaultInstance.products,
    customers: defaultInstance.customers,
    store: defaultInstance.store,
    inventory: defaultInstance.inventory,
    billing: defaultInstance.billing,
    webhooks: defaultInstance.webhooks,
};
