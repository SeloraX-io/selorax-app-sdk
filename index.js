const seloraxAuth = require('./lib/selorax-auth');
const { createAuth, verifyLocal, TokenVerificationCache } = require('./lib/selorax-auth');
const seloraxApi = require('./lib/selorax-api');
const { SeloraxApi } = require('./lib/selorax-api');
const { verifyWebhook, signPayload, webhookMiddleware, createWebhookRouter } = require('./lib/selorax-webhooks');
const tokenStore = require('./lib/token-store');
const { createTokenStore, MemoryTokenStore } = require('./lib/token-store');
const { WEBHOOK_TOPICS, SCOPES, TOKEN_PREFIXES, HEADERS, EXTENSION_TARGETS, EXTENSION_COMPONENTS, EXTENSION_ACTIONS } = require('./lib/constants');
const {
    SeloraxError,
    SeloraxApiError,
    SeloraxAuthError,
    SeloraxWebhookError,
    SeloraxConfigError,
} = require('./lib/errors');

module.exports = {
    // ── Core (default instances) ──
    seloraxAuth,
    seloraxApi,
    tokenStore,

    // ── Factories (custom config) ──
    createAuth,
    SeloraxApi,
    createWebhookRouter,
    createTokenStore,

    // ── Webhook utilities ──
    verifyWebhook,
    signPayload,
    webhookMiddleware,

    // ── Auth utilities ──
    verifyLocal,
    TokenVerificationCache,

    // ── Token store utilities ──
    MemoryTokenStore,

    // ── Constants ──
    WEBHOOK_TOPICS,
    SCOPES,
    TOKEN_PREFIXES,
    HEADERS,
    EXTENSION_TARGETS,
    EXTENSION_COMPONENTS,
    EXTENSION_ACTIONS,

    // ── Error classes ──
    SeloraxError,
    SeloraxApiError,
    SeloraxAuthError,
    SeloraxWebhookError,
    SeloraxConfigError,
};
