/**
 * Token Store — pluggable storage for OAuth tokens.
 *
 * Ships with an in-memory implementation. For production, create your own
 * adapter that implements { get, set, remove, getAll }.
 *
 * Features:
 *   - TTL expiration (auto-clears expired tokens)
 *   - Size-bounded (evicts oldest when at capacity)
 *   - has() / count() / clear() helpers
 *   - createTokenStore() factory for custom TTL/size
 *
 * Usage:
 *   const { tokenStore } = require('selorax-app-sdk');
 *   tokenStore.set(storeId, { access_token, refresh_token, ... });
 *
 *   // Custom store with 1-hour TTL, max 500 entries:
 *   const { createTokenStore } = require('selorax-app-sdk');
 *   const store = createTokenStore({ ttl: 3600000, maxSize: 500 });
 */

class MemoryTokenStore {
    /**
     * @param {object} [options]
     * @param {number} [options.ttl=0] - Token TTL in ms. 0 = no expiration.
     * @param {number} [options.maxSize=10000] - Max stored tokens. 0 = unlimited.
     */
    constructor(options = {}) {
        this.ttl = options.ttl || 0;
        this.maxSize = options.maxSize || 10000;
        this._store = new Map();

        if (this.ttl > 0) {
            this._cleanupTimer = setInterval(() => this._cleanup(), Math.min(this.ttl, 60000));
            this._cleanupTimer.unref();
        }
    }

    get(storeId) {
        const entry = this._store.get(Number(storeId));
        if (!entry) return null;
        if (this.ttl > 0 && Date.now() > entry._expiresAt) {
            this._store.delete(Number(storeId));
            return null;
        }
        const { _expiresAt, ...data } = entry;
        return data;
    }

    set(storeId, data) {
        // Evict oldest if at capacity
        if (this.maxSize > 0 && this._store.size >= this.maxSize && !this._store.has(Number(storeId))) {
            const firstKey = this._store.keys().next().value;
            this._store.delete(firstKey);
        }

        this._store.set(Number(storeId), {
            store_id: Number(storeId),
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            installation_id: data.installation_id,
            scopes: data.scopes,
            expires_at: data.expires_at,
            updated_at: new Date().toISOString(),
            _expiresAt: this.ttl > 0 ? Date.now() + this.ttl : Infinity,
        });
    }

    remove(storeId) {
        return this._store.delete(Number(storeId));
    }

    has(storeId) {
        return this.get(storeId) !== null;
    }

    getAll() {
        const results = [];
        for (const [key] of this._store) {
            const data = this.get(key);
            if (data) results.push(data);
        }
        return results;
    }

    count() {
        return this._store.size;
    }

    clear() {
        this._store.clear();
    }

    _cleanup() {
        if (this.ttl <= 0) return;
        const now = Date.now();
        for (const [key, entry] of this._store) {
            if (now > entry._expiresAt) this._store.delete(key);
        }
    }
}

/**
 * Create a token store with custom options.
 * @param {object} [options]
 * @param {number} [options.ttl=0] - TTL in ms
 * @param {number} [options.maxSize=10000] - Max entries
 * @returns {MemoryTokenStore}
 */
function createTokenStore(options) {
    return new MemoryTokenStore(options);
}

// Default singleton
const defaultStore = new MemoryTokenStore();

module.exports = defaultStore;
module.exports.createTokenStore = createTokenStore;
module.exports.MemoryTokenStore = MemoryTokenStore;
