/**
 * Webhook Verification & Router Factory
 *
 * Features:
 *   - HMAC-SHA256 signature verification with timing-safe comparison
 *   - Timestamp freshness check (configurable window)
 *   - Router factory with async handler support
 *   - Standalone middleware for custom setups
 *   - Wildcard handler ('*') for catch-all logging
 *
 * Usage:
 *   const { createWebhookRouter } = require('selorax-app-sdk');
 *
 *   const router = createWebhookRouter({
 *       'order.status_changed': async (event, req, res) => { ... },
 *       '*': (event) => console.log('Received:', event.topic),
 *   });
 */
const crypto = require('crypto');
const { HEADERS } = require('./constants');

const DEFAULT_TIMESTAMP_TOLERANCE = 5 * 60; // 5 minutes in seconds

/**
 * Verify HMAC-SHA256 webhook signature.
 *
 * @param {string} rawBody - Raw request body string
 * @param {string} signature - X-SeloraX-Signature header ("sha256=<hex>")
 * @param {string} timestamp - X-SeloraX-Timestamp header (unix seconds)
 * @param {string} secret - Webhook signing secret (whsec_...)
 * @param {object} [options]
 * @param {number} [options.tolerance=300] - Max age in seconds
 * @returns {boolean}
 */
function verifyWebhook(rawBody, signature, timestamp, secret, options = {}) {
    if (!signature || !secret || !rawBody) return false;

    const tolerance = options.tolerance ?? DEFAULT_TIMESTAMP_TOLERANCE;

    // Timestamp freshness check
    if (timestamp) {
        const age = Math.floor(Date.now() / 1000) - Number(timestamp);
        if (isNaN(age) || Math.abs(age) > tolerance) return false;
    }

    const signaturePayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
    const expected = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(signaturePayload)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected),
            Buffer.from(signature)
        );
    } catch {
        return false;
    }
}

/**
 * Compute the expected HMAC signature for a payload.
 * Useful for testing webhook handlers locally.
 *
 * @param {string} body - Request body
 * @param {string} secret - Signing secret
 * @param {string} [timestamp] - Unix timestamp
 * @returns {{ signature: string, timestamp: string }}
 */
function signPayload(body, secret, timestamp) {
    const ts = timestamp || String(Math.floor(Date.now() / 1000));
    const signaturePayload = `${ts}.${body}`;
    const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(signaturePayload)
        .digest('hex');
    return { signature, timestamp: ts };
}

/**
 * Express middleware that verifies webhook signature on the request.
 * Use this if you want verification without the router factory.
 *
 *   app.post('/webhooks', webhookMiddleware(), (req, res) => { ... });
 *   app.post('/webhooks', webhookMiddleware({ secret: 'custom' }), handler);
 *
 * @param {object} [options]
 * @param {string} [options.secret] - Override env WEBHOOK_SIGNING_SECRET
 * @param {number} [options.tolerance] - Max timestamp age in seconds
 * @returns {Function} Express middleware
 */
function webhookMiddleware(options = {}) {
    return (req, res, next) => {
        const signature = req.header(HEADERS.WEBHOOK_SIGNATURE);
        const timestamp = req.header(HEADERS.WEBHOOK_TIMESTAMP);
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const secret = options.secret || process.env.WEBHOOK_SIGNING_SECRET;

        if (!signature) {
            return res.status(400).send({
                message: 'Missing webhook signature header.',
                code: 'missing_signature',
                status: 400,
            });
        }

        if (!verifyWebhook(rawBody, signature, timestamp, secret, options)) {
            return res.status(401).send({
                message: 'Invalid webhook signature.',
                code: 'invalid_signature',
                status: 401,
            });
        }

        // Attach parsed event to request
        req.webhookEvent = {
            topic: req.header(HEADERS.WEBHOOK_EVENT),
            store_id: req.body.store_id,
            data: req.body.data || req.body,
            timestamp,
        };

        next();
    };
}

/**
 * Create an Express router that verifies signatures and routes events.
 *
 * @param {Object<string, Function>} handlers - topic → handler(event, req, res)
 * @param {object} [options]
 * @param {string} [options.secret] - Override env WEBHOOK_SIGNING_SECRET
 * @param {number} [options.tolerance] - Max timestamp age in seconds
 * @param {string} [options.path='/receive'] - Route path
 * @returns {express.Router}
 */
function createWebhookRouter(handlers, options = {}) {
    const router = require('express').Router();
    const routePath = options.path || '/receive';

    router.post(routePath, (req, res) => {
        const signature = req.header(HEADERS.WEBHOOK_SIGNATURE);
        const eventTopic = req.header(HEADERS.WEBHOOK_EVENT);
        const timestamp = req.header(HEADERS.WEBHOOK_TIMESTAMP);

        if (!signature || !eventTopic) {
            return res.status(400).send({
                message: 'Missing webhook headers.',
                code: 'missing_headers',
                status: 400,
            });
        }

        const rawBody = req.rawBody || JSON.stringify(req.body);
        const secret = options.secret || process.env.WEBHOOK_SIGNING_SECRET;

        if (!verifyWebhook(rawBody, signature, timestamp, secret, options)) {
            return res.status(401).send({
                message: 'Invalid webhook signature.',
                code: 'invalid_signature',
                status: 401,
            });
        }

        const event = {
            topic: eventTopic,
            store_id: req.body.store_id,
            data: req.body.data || req.body,
            timestamp,
        };

        // Call wildcard handler first (for logging / metrics)
        if (handlers['*'] && handlers['*'] !== handlers[eventTopic]) {
            try { handlers['*'](event, req, res); } catch { /* swallow wildcard errors */ }
        }

        const handler = handlers[eventTopic];
        if (handler) {
            try {
                const result = handler(event, req, res);
                if (result && typeof result.catch === 'function') {
                    result.catch((err) => {
                        console.error(`[Webhook] Handler error for ${eventTopic}:`, err.message);
                        if (!res.headersSent) {
                            res.status(500).send({ message: 'Webhook handler error.', status: 500 });
                        }
                    });
                    return;
                }
            } catch (err) {
                console.error(`[Webhook] Handler error for ${eventTopic}:`, err.message);
                if (!res.headersSent) {
                    return res.status(500).send({ message: 'Webhook handler error.', status: 500 });
                }
            }
        } else {
            res.status(200).send({ message: 'Event received, no handler registered.', status: 200 });
        }
    });

    return router;
}

module.exports = { verifyWebhook, signPayload, webhookMiddleware, createWebhookRouter };
