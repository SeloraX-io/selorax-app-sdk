<div align="center">

# selorax-app-sdk

### Build apps for the SeloraX e-commerce platform

[![npm version](https://img.shields.io/npm/v/selorax-app-sdk?color=%230076FF&label=npm&style=flat-square)](https://www.npmjs.com/package/@selorax/cli)
[![npm downloads](https://img.shields.io/npm/dm/selorax-app-sdk?color=%2300C48D&style=flat-square)](https://www.npmjs.com/package/@selorax/cli)
[![license](https://img.shields.io/npm/l/selorax-app-sdk?color=%23333&style=flat-square)](https://github.com/SeloraX-io/selorax-app-boilerplate/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/selorax-app-sdk?color=%23339933&style=flat-square)](https://nodejs.org)

<br />

[Getting Started](#getting-started) &nbsp;&bull;&nbsp; [Guides](#guides) &nbsp;&bull;&nbsp; [Extensions](#extensions) &nbsp;&bull;&nbsp; [API Reference](#api-reference) &nbsp;&bull;&nbsp; [Examples](#full-example) &nbsp;&bull;&nbsp; [Troubleshooting](#troubleshooting)

<br />

<table>
<tr>
<td width="20%" align="center"><strong>Auth</strong><br /><sub>Session token verification<br />for iframe apps</sub></td>
<td width="20%" align="center"><strong>API Client</strong><br /><sub>Orders, products, billing<br />and 16+ endpoints</sub></td>
<td width="20%" align="center"><strong>Webhooks</strong><br /><sub>HMAC-verified event<br />delivery &amp; routing</sub></td>
<td width="20%" align="center"><strong>Extensions</strong><br /><sub>JSON UI components<br />for dashboard integration</sub></td>
<td width="20%" align="center"><strong>Token Store</strong><br /><sub>OAuth token management<br />with swappable backend</sub></td>
</tr>
</table>

</div>

---

## Installation

```bash
npm install selorax-app-sdk
```

> [!NOTE]
> **Peer dependency:** Your project must have [`express`](https://expressjs.com) v4 or v5 installed.

<details>
<summary><strong>Prerequisites</strong></summary>

| Requirement | Version | Notes |
|:------------|:--------|:------|
| Node.js | ≥ 18 | Uses native `fetch` |
| Express | v4 or v5 | Peer dependency |
| SeloraX Developer Account | — | [Register here](https://portal.selorax.io) to get credentials. See [docs](https://docs.selorax.io) for guides. |

</details>

---

## Getting Started

### 1. Get your credentials

Register your app on the [SeloraX Developer Portal](https://portal.selorax.io). You'll receive:

| Credential | Prefix | Example |
|:-----------|:------:|:--------|
| Client ID | `sx_app_` | `sx_app_1b16e193a28d2640...` |
| Client Secret | `sx_secret_` | `sx_secret_dd0f155b6e333f59...` |
| Session Signing Key | — | `ac4d5804b66820c347f626...` |
| Webhook Secret | `whsec_` | `whsec_8a3f1d2e5b7c9a0f...` |

### 2. Configure environment

Create a `.env` file:

```env
# ━━━ Required ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELORAX_API_URL=https://api.selorax.io/api
SELORAX_CLIENT_ID=sx_app_your_client_id
SELORAX_CLIENT_SECRET=sx_secret_your_client_secret

# ━━━ Optional ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION_SIGNING_KEY=your_64_char_hex_signing_key
WEBHOOK_SIGNING_SECRET=whsec_your_webhook_secret
```

### 3. Write your first app

```js
require('dotenv').config();
const express = require('express');
const { seloraxAuth, seloraxApi, createWebhookRouter } = require('selorax-app-sdk');

const app = express();

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

// Webhook events from the platform
app.use('/webhooks', createWebhookRouter({
  'order.status_changed': (event, req, res) => {
    console.log(`Order #${event.data.order_id} → ${event.data.status}`);
    res.json({ message: 'OK', status: 200 });
  },
}));

// Your app's dashboard API (protected)
app.get('/api/dashboard', seloraxAuth, async (req, res) => {
  const store = await seloraxApi.store.get(req.session.store_id);
  res.json({ data: store.data });
});

app.listen(5010);
```

---

## Guides

### Authentication

<table>
<tr>
<td>

**The problem:** When a merchant opens your app in the SeloraX dashboard, the app loads inside an iframe. You need to securely identify *which merchant* is using your app — without asking them to log in again.

**The solution:** The dashboard sends a short-lived **session token** to your iframe via `postMessage`. Your frontend passes it to your backend in every request. The SDK verifies it automatically.

</td>
</tr>
</table>

#### How the token flows

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│  SeloraX Dashboard  │         │  Your Frontend      │         │  Your Backend        │
│                     │         │  (iframe)           │         │  (Express)           │
└─────────┬───────────┘         └─────────┬───────────┘         └─────────┬───────────┘
          │                               │                               │
          │  1. Load iframe               │                               │
          │  ?store_id=22&host=...        │                               │
          │──────────────────────────────>│                               │
          │                               │                               │
          │  2. Session token             │                               │
          │  via postMessage              │                               │
          │──────────────────────────────>│                               │
          │                               │                               │
          │                               │  3. GET /api/dashboard        │
          │                               │  X-Session-Token: eyJ...      │
          │                               │──────────────────────────────>│
          │                               │                               │
          │                               │                  4. seloraxAuth
          │                               │                     verifies  │
          │                               │                     ↓         │
          │                               │                  req.session = │
          │                               │                  { store_id,  │
          │                               │                    install_id,│
          │                               │                    app_id }   │
          │                               │                               │
          │                               │  5. JSON response             │
          │                               │<──────────────────────────────│
```

#### Usage

```js
const { seloraxAuth } = require('selorax-app-sdk');

app.get('/api/my-feature', seloraxAuth, (req, res) => {
  // req.session is populated after verification:
  const { store_id, installation_id, app_id } = req.session;

  res.json({ store_id });
});
```

#### Verification modes

The middleware picks the best available method automatically:

| Mode | Condition | Speed | How it works |
|:-----|:----------|:-----:|:-------------|
| **Local** | `SESSION_SIGNING_KEY` is set | **< 1ms** | Verifies JWT signature locally with HMAC-SHA256. No network call. |
| **Platform** | Signing key not set | **~50ms** | Calls `/apps/session/verify` with your client credentials. Results cached for 5 minutes. |

> [!TIP]
> Set `SESSION_SIGNING_KEY` in production for the fastest possible auth. Without it, the SDK still works — it just makes an HTTP call to the platform (cached).

---

### Platform API

<table>
<tr>
<td>

**The problem:** Your app needs to read and write merchant data — orders, products, customers, billing. You'd have to handle authentication headers, URL building, error parsing, and query parameters for every request.

**The solution:** `seloraxApi` provides a namespaced client that handles all of this. Just call the method with a `storeId` and get back parsed JSON.

</td>
</tr>
</table>

```js
const { seloraxApi } = require('selorax-app-sdk');
```

> [!IMPORTANT]
> Every API call authenticates using your `SELORAX_CLIENT_ID` and `SELORAX_CLIENT_SECRET`. These are sent as headers on every request and **never expire** — similar to Shopify's offline access tokens.

<details>
<summary><strong>Orders</strong> — List and retrieve order data</summary>

```js
// List with pagination and filters
const orders = await seloraxApi.orders.list(storeId, {
  page: 1,
  limit: 20,
});

// Get a single order by ID
const order = await seloraxApi.orders.get(storeId, orderId);
```

**Response structure:**
```json
{
  "message": "Orders fetched.",
  "data": [
    {
      "id": 1234,
      "order_number": "SX-1234",
      "status": "processing",
      "total": 1500,
      "customer_name": "John Doe",
      "customer_phone": "01700000000"
    }
  ],
  "status": 200
}
```

</details>

<details>
<summary><strong>Products</strong> — List and retrieve product data</summary>

```js
const products = await seloraxApi.products.list(storeId, { page: 1 });
const product  = await seloraxApi.products.get(storeId, productId);
```

</details>

<details>
<summary><strong>Customers</strong> — List and retrieve customer data</summary>

```js
const customers = await seloraxApi.customers.list(storeId, { page: 1 });
const customer  = await seloraxApi.customers.get(storeId, userId);
```

</details>

<details>
<summary><strong>Store</strong> — Get store information</summary>

```js
// Returns name, currency, domain, settings, etc.
const store = await seloraxApi.store.get(storeId);
```

</details>

<details>
<summary><strong>Inventory</strong> — List inventory levels</summary>

```js
const inventory = await seloraxApi.inventory.list(storeId, { page: 1 });
```

</details>

<details>
<summary><strong>Billing</strong> — Charges, wallet, and top-ups</summary>

All merchant payments flow through the SeloraX platform:

```js
// ── One-time or recurring charges ──────────────────

// Create a charge (merchant sees an approval page)
const charge = await seloraxApi.billing.createCharge(storeId, {
  name: 'Pro Plan',
  amount: 500,
  type: 'one_time',   // or 'recurring'
});
// → charge.data.confirmation_url  (redirect merchant here)

// Check if merchant approved
const status = await seloraxApi.billing.getCharge(storeId, chargeId);


// ── Wallet (for usage-based billing) ───────────────

// Check balance
const wallet = await seloraxApi.billing.getWallet(storeId);

// Debit per-usage (e.g., SMS sent, API call made)
await seloraxApi.billing.debitWallet(storeId, 10, 'SMS delivery', {
  sms_id: 456,
  phone: '01700000000',
});

// Request a top-up (merchant pays via payment gateway)
await seloraxApi.billing.createTopup(storeId, 500);
```

</details>

<details>
<summary><strong>Webhook Subscriptions</strong> — Manage event subscriptions</summary>

```js
// List current subscriptions
const subs = await seloraxApi.webhooks.list(storeId);

// Subscribe to an event
await seloraxApi.webhooks.create(storeId, {
  topic: 'order.status_changed',
  url: 'https://myapp.com/webhooks/receive',
});
```

</details>

<details>
<summary><strong>Custom API Calls</strong> — Call any platform endpoint</summary>

```js
// GET
const data = await seloraxApi.apiCall(storeId, 'GET', '/apps/v1/custom-endpoint');

// POST with body
const result = await seloraxApi.apiCall(storeId, 'POST', '/apps/v1/custom-endpoint', {
  key: 'value',
});
```

</details>

#### Error handling

All methods throw on non-2xx responses with a structured error:

```js
try {
  await seloraxApi.orders.get(storeId, 'bad-id');
} catch (err) {
  err.message   // → "Order not found"
  err.status    // → 404
  err.data      // → { message: "Order not found", status: 404 }
}
```

---

### Webhooks

<table>
<tr>
<td>

**The problem:** When events happen on the platform — an order ships, your app gets installed or uninstalled — you need to react in real time. The platform sends signed HTTP requests to your app, but you need to verify they're genuine.

**The solution:** The SDK provides two approaches: a router factory that handles everything, or a low-level verify function for custom setups.

</td>
</tr>
</table>

> [!WARNING]
> Your Express app **must** capture the raw request body for HMAC verification. Add this **before** all routes:
>
> ```js
> app.use(express.json({
>   verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
> }));
> ```

#### Option A: Router Factory *(recommended)*

One function — creates a complete webhook endpoint with signature verification:

```js
const { createWebhookRouter } = require('selorax-app-sdk');

const webhooks = createWebhookRouter({

  'order.status_changed': (event, req, res) => {
    const { store_id, data } = event;
    console.log(`[Store ${store_id}] Order #${data.order_id} → "${data.status}"`);

    // Your logic here:
    // - Send push notification
    // - Update your database
    // - Trigger an automation

    res.json({ message: 'Processed', status: 200 });
  },

  'app.installed': (event, req, res) => {
    console.log(`Installed on store ${event.store_id}`);
    // Initialize default settings for this store...
    res.json({ message: 'OK', status: 200 });
  },

  'app.uninstalled': (event, req, res) => {
    console.log(`Uninstalled from store ${event.store_id}`);
    // Clean up data for this store...
    res.json({ message: 'OK', status: 200 });
  },

});

// Mounts at: POST /webhooks/receive
app.use('/webhooks', webhooks);
```

**The `event` object:**

```js
{
  topic: 'order.status_changed',    // event name
  store_id: 22,                      // originating store
  data: {                            // event-specific payload
    order_id: 1234,
    order_number: 'SX-1234',
    status: 'shipped',
    customer_name: 'John Doe',
    customer_phone: '01700000000',
    total: 1500,
    store_name: 'My Store',
  }
}
```

#### Option B: Manual Verification

Full control for custom setups:

```js
const { verifyWebhook } = require('selorax-app-sdk');

app.post('/my-endpoint', (req, res) => {
  const isValid = verifyWebhook(
    req.rawBody,                          // raw body string
    req.header('X-SeloraX-Signature'),    // "sha256=<hex>"
    req.header('X-SeloraX-Timestamp'),    // Unix seconds
    process.env.WEBHOOK_SIGNING_SECRET    // "whsec_..."
  );

  if (!isValid) return res.status(401).json({ message: 'Bad signature' });

  // Process the verified event...
  res.json({ message: 'OK' });
});
```

#### Security guarantees

| Protection | How it works |
|:-----------|:-------------|
| **Authenticity** | HMAC-SHA256 signature over `timestamp.body` proves the request came from SeloraX |
| **Timing attack prevention** | Signatures compared with `crypto.timingSafeEqual` |
| **Replay attack prevention** | Requests older than 5 minutes are automatically rejected |

---

### Token Store

<table>
<tr>
<td>

**The problem:** After a merchant installs your app via OAuth, you receive access and refresh tokens. You need to store them somewhere and retrieve them later when making API calls on behalf of that store.

**The solution:** A simple key-value store keyed by `store_id`. Ships with an in-memory implementation for development. Swap the backend for production.

</td>
</tr>
</table>

```js
const { tokenStore } = require('selorax-app-sdk');
```

| Method | Returns | Description |
|:-------|:--------|:------------|
| `get(storeId)` | `object \| null` | Retrieve stored tokens |
| `set(storeId, data)` | `void` | Store tokens |
| `remove(storeId)` | `void` | Delete tokens |
| `getAll()` | `array` | List all stored tokens |

```js
// After OAuth code exchange — store the tokens
tokenStore.set(storeId, {
  access_token: 'sx_at_...',
  refresh_token: 'sx_rt_...',
  installation_id: 5,
  scopes: ['read_orders', 'read_products'],
  expires_at: '2025-06-01T00:00:00Z',
});

// Later — retrieve tokens for API calls
const tokens = tokenStore.get(storeId);
// → { store_id, access_token, refresh_token, installation_id, scopes, expires_at, updated_at }

// On uninstall — clean up
tokenStore.remove(storeId);
```

> [!CAUTION]
> The built-in store is **in-memory only** — all tokens are lost when the server restarts. For production, replace with MySQL, Redis, or any persistent storage.

---

### Extensions

<table>
<tr>
<td>

**The problem:** You want your app's UI to appear natively inside the SeloraX dashboard — on the main dashboard, order detail pages, product pages, etc. — without building an iframe.

**The solution:** Define your UI as a JSON component tree in `extensions.json`, register it via the dev portal API, and handle backend calls when the dashboard proxies requests to your server.

</td>
</tr>
</table>

#### Extension JSON UI

Extensions use a declarative JSON format. Each node has a `type`, `props`, and optional `children`:

```json
{
  "type": "Card",
  "props": { "title": "My Widget" },
  "children": [
    { "type": "Text", "props": { "content": "Hello {{state.name}}" } },
    {
      "type": "Button",
      "props": { "label": "Click Me" },
      "actions": {
        "onClick": {
          "type": "call_backend",
          "url": "/api/extensions/my-action",
          "method": "POST"
        }
      }
    }
  ]
}
```

#### Available constants

```js
const { EXTENSION_TARGETS, EXTENSION_COMPONENTS, EXTENSION_ACTIONS } = require('selorax-app-sdk');

// 26 targets — where extensions can appear
EXTENSION_TARGETS.DASHBOARD_WIDGET     // 'dashboard.widget'
EXTENSION_TARGETS.ORDER_DETAIL_BLOCK   // 'order.detail.block'
EXTENSION_TARGETS.NAVIGATION_LINK      // 'navigation.link'

// 50+ component types — what you can render
EXTENSION_COMPONENTS.Card       // 'Card'
EXTENSION_COMPONENTS.Text       // 'Text'
EXTENSION_COMPONENTS.Button     // 'Button'
EXTENSION_COMPONENTS.TextArea   // 'TextArea'
EXTENSION_COMPONENTS.Badge      // 'Badge'

// 8 action types — what can happen on interaction
EXTENSION_ACTIONS.CALL_BACKEND  // 'call_backend'
EXTENSION_ACTIONS.SET_STATE     // 'set_state'
EXTENSION_ACTIONS.NAVIGATE      // 'navigate'
```

#### Template syntax

String props support `{{expression}}` templates:

| Expression | Example | Description |
|:-----------|:--------|:------------|
| State access | `{{state.count}}` | Read from extension's local state |
| Context access | `{{context.order.order_id}}` | Read from page context (e.g., current order) |
| Negation | `{{!state.loaded}}` | Boolean negation |
| Input value | `{{$value}}` | Current form input value (in `onChange` actions) |
| Interpolation | `"Total: {{state.amount}}"` | Inline string interpolation |

#### Conditional rendering

Any component can have a `when` prop. It renders only when the expression is truthy:

```json
{ "type": "Text", "props": { "when": "{{state.loaded}}", "content": "Ready!" } }
{ "type": "Spinner", "props": { "when": "{{!state.loaded}}" } }
```

#### Response directives

When the dashboard proxies a `call_backend` action to your server, your response can include directives:

```js
res.json({
    update_state: { count: 42, loaded: true },          // Patch local state
    show_toast: { message: 'Saved!', type: 'success' }, // Toast notification
    navigate: '/3/orders',                                // Redirect user
    open_modal: { title: 'Details', ui: { ... } },      // Open a modal
    close_modal: true,                                    // Close current modal
    refetch: ['ORDERS_KEY'],                             // Invalidate React Query caches
});
```

#### Registration

Use `scripts/register-extensions.js` in the boilerplate, or call the dev portal API directly:

```bash
# Register
curl -X POST http://localhost:4301/api/v1/apps/{APP_ID}/extensions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "extension_id": "my-widget", "target": "dashboard.widget", ... }'

# Deploy (makes extensions live)
curl -X POST http://localhost:4301/api/v1/apps/{APP_ID}/extensions/deploy \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "extensions": [...], "message": "v1" }'
```

---

## API Reference

### Exports

```js
const {
  seloraxAuth,          // Express middleware
  seloraxApi,           // Platform API client
  createWebhookRouter,  // Webhook router factory
  verifyWebhook,        // Manual HMAC verification
  tokenStore,           // Token storage
  EXTENSION_TARGETS,    // Extension target constants
  EXTENSION_COMPONENTS, // Valid component types
  EXTENSION_ACTIONS,    // Valid action types
} = require('selorax-app-sdk');
```

### `seloraxAuth`

| Aspect | Details |
|:-------|:--------|
| **Type** | Express middleware `(req, res, next)` |
| **Reads** | `X-Session-Token` header |
| **Sets** | `req.session` → `{ store_id: number, installation_id: number, app_id: number }` |
| **Errors** | `401` — missing or invalid token · `500` — platform verification failed |

### `seloraxApi`

<table>
<tr><th align="left">Namespace</th><th align="left">Method</th><th align="center">HTTP</th><th align="left">Platform Endpoint</th></tr>
<tr><td rowspan="2"><strong>orders</strong></td><td><code>.list(storeId, params?)</code></td><td align="center">GET</td><td><code>/apps/v1/orders</code></td></tr>
<tr><td><code>.get(storeId, orderId)</code></td><td align="center">GET</td><td><code>/apps/v1/orders/:id</code></td></tr>
<tr><td rowspan="2"><strong>products</strong></td><td><code>.list(storeId, params?)</code></td><td align="center">GET</td><td><code>/apps/v1/products</code></td></tr>
<tr><td><code>.get(storeId, productId)</code></td><td align="center">GET</td><td><code>/apps/v1/products/:id</code></td></tr>
<tr><td rowspan="2"><strong>customers</strong></td><td><code>.list(storeId, params?)</code></td><td align="center">GET</td><td><code>/apps/v1/customers</code></td></tr>
<tr><td><code>.get(storeId, userId)</code></td><td align="center">GET</td><td><code>/apps/v1/customers/:id</code></td></tr>
<tr><td><strong>store</strong></td><td><code>.get(storeId)</code></td><td align="center">GET</td><td><code>/apps/v1/store</code></td></tr>
<tr><td><strong>inventory</strong></td><td><code>.list(storeId, params?)</code></td><td align="center">GET</td><td><code>/apps/v1/inventory</code></td></tr>
<tr><td rowspan="5"><strong>billing</strong></td><td><code>.createCharge(storeId, body)</code></td><td align="center">POST</td><td><code>/apps/v1/billing/charges</code></td></tr>
<tr><td><code>.getCharge(storeId, chargeId)</code></td><td align="center">GET</td><td><code>/apps/v1/billing/charges/:id</code></td></tr>
<tr><td><code>.getWallet(storeId)</code></td><td align="center">GET</td><td><code>/apps/v1/billing/wallet</code></td></tr>
<tr><td><code>.debitWallet(storeId, amount, desc, meta?)</code></td><td align="center">POST</td><td><code>/apps/v1/billing/wallet/debit</code></td></tr>
<tr><td><code>.createTopup(storeId, amount)</code></td><td align="center">POST</td><td><code>/apps/v1/billing/wallet-topup</code></td></tr>
<tr><td rowspan="2"><strong>webhooks</strong></td><td><code>.list(storeId)</code></td><td align="center">GET</td><td><code>/apps/v1/webhooks</code></td></tr>
<tr><td><code>.create(storeId, body)</code></td><td align="center">POST</td><td><code>/apps/v1/webhooks</code></td></tr>
<tr><td><strong>generic</strong></td><td><code>apiCall(storeId, method, path, body?)</code></td><td align="center">any</td><td>any endpoint</td></tr>
</table>

### `createWebhookRouter(handlers)`

| Param | Type | Description |
|:------|:-----|:------------|
| `handlers` | `{ [topic]: (event, req, res) => void }` | Event topic → handler map |

Returns `express.Router` with route `POST /receive`.

### `verifyWebhook(rawBody, signature, timestamp, secret)`

| Param | Type | Description |
|:------|:-----|:------------|
| `rawBody` | `string` | Raw HTTP request body |
| `signature` | `string` | `X-SeloraX-Signature` header value |
| `timestamp` | `string` | `X-SeloraX-Timestamp` header value |
| `secret` | `string` | Your webhook signing secret |

Returns `boolean` — `true` if valid signature and timestamp within 5 minutes.

### `tokenStore`

| Method | Returns | Description |
|:-------|:--------|:------------|
| `.get(storeId)` | `object \| null` | Retrieve stored tokens |
| `.set(storeId, data)` | `void` | Store token data |
| `.remove(storeId)` | `void` | Delete stored tokens |
| `.getAll()` | `array` | List all stored token objects |

---

## Full Example

<details>
<summary><strong>Complete Express app using all SDK features</strong> (click to expand)</summary>

```js
require('dotenv').config();
const express = require('express');
const {
  seloraxAuth,
  seloraxApi,
  createWebhookRouter,
  tokenStore,
} = require('selorax-app-sdk');

const app = express();

// ── Raw body capture (required for webhook HMAC) ───────────
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

// ── OAuth Install Callback ─────────────────────────────────
app.post('/oauth/callback', async (req, res) => {
  const { code } = req.body;

  const tokenRes = await fetch(`${process.env.SELORAX_API_URL}/apps/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.SELORAX_CLIENT_ID,
      client_secret: process.env.SELORAX_CLIENT_SECRET,
      code,
      redirect_uri: 'http://localhost:5010/oauth/callback',
    }),
  });

  const data = await tokenRes.json();
  tokenStore.set(data.data.store_id, data.data);
  console.log(`Installed on store ${data.data.store_id}`);
  res.json({ message: 'Installed', status: 200 });
});

// ── Webhooks ───────────────────────────────────────────────
app.use('/webhooks', createWebhookRouter({
  'order.status_changed': (event, req, res) => {
    console.log(`[Store ${event.store_id}] Order #${event.data.order_id} → ${event.data.status}`);
    res.json({ message: 'OK', status: 200 });
  },

  'app.uninstalled': (event, req, res) => {
    tokenStore.remove(event.store_id);
    console.log(`Uninstalled from store ${event.store_id}`);
    res.json({ message: 'OK', status: 200 });
  },
}));

// ── Protected App Routes ───────────────────────────────────
app.get('/api/dashboard', seloraxAuth, async (req, res) => {
  const { store_id } = req.session;

  const [store, orders, wallet] = await Promise.all([
    seloraxApi.store.get(store_id),
    seloraxApi.orders.list(store_id, { limit: 5 }),
    seloraxApi.billing.getWallet(store_id),
  ]);

  res.json({
    store: store.data,
    recent_orders: orders.data,
    wallet_balance: wallet.data?.balance,
  });
});

// ── Start ──────────────────────────────────────────────────
app.listen(5010, () => console.log('App running on http://localhost:5010'));
```

</details>

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     SeloraX Merchant Dashboard                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Your App (iframe)                        │  │
│  │                                                            │  │
│  │   Frontend (Next.js)              Backend (Express)        │  │
│  │   ┌──────────────┐               ┌──────────────────┐     │  │
│  │   │              │   HTTP +      │                  │     │  │
│  │   │  App Bridge  │   X-Session   │  seloraxAuth     │     │  │
│  │   │  handles     │──────────────>│  verifies token  │     │  │
│  │   │  postMessage │   Token       │       │          │     │  │
│  │   │  tokens      │               │       ▼          │     │  │
│  │   │              │               │  seloraxApi      │     │  │
│  │   └──────────────┘               │  calls platform ─┼─────┼──┼──> SeloraX
│  │                                  │                  │     │  │    Platform
│  │                                  │  Webhook Router  │<────┼──┼──  API
│  │                                  │  verifies HMAC   │     │  │
│  │                                  └──────────────────┘     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Data flow:**

| Step | What happens |
|:----:|:-------------|
| **1** | Merchant opens your app in the dashboard → iframe loads |
| **2** | Dashboard sends a session token to the iframe via `postMessage` |
| **3** | Frontend makes API calls to your backend with `X-Session-Token` |
| **4** | `seloraxAuth` verifies the token → populates `req.session` |
| **5** | Your backend calls `seloraxApi` to read/write platform data |
| **6** | Platform sends webhook events (order changes, installs) to your backend |
| **7** | `createWebhookRouter` verifies HMAC signature → routes to your handler |

---

## Troubleshooting

<details>
<summary><strong>"SELORAX_CLIENT_ID and SELORAX_CLIENT_SECRET must be set in .env"</strong></summary>

Your `.env` file is missing credentials. Get them from the [Developer Portal](https://portal.selorax.io). Make sure you're calling `require('dotenv').config()` before importing the SDK.

</details>

<details>
<summary><strong>"Invalid or expired session token" (401)</strong></summary>

Session tokens expire after **10 minutes**. Your frontend should automatically request fresh tokens from the dashboard via `postMessage`. If testing manually, you'll need to get a new token from the dashboard.

</details>

<details>
<summary><strong>"Session token verification not configured" (401)</strong></summary>

Neither verification method is available. You need at least one of:
- `SESSION_SIGNING_KEY` set in `.env` (for local verification), **or**
- `SELORAX_CLIENT_ID` + `SELORAX_CLIENT_SECRET` + `SELORAX_API_URL` all set (for platform verification)

</details>

<details>
<summary><strong>"Invalid webhook signature" (401)</strong></summary>

Three things to check:
1. `WEBHOOK_SIGNING_SECRET` matches the secret shown in the Developer Portal
2. You have the raw body capture middleware **before** your routes:
   ```js
   app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString(); } }));
   ```
3. The request body hasn't been modified between capture and verification

</details>

<details>
<summary><strong>Webhook timestamps being rejected</strong></summary>

The SDK rejects webhooks older than 5 minutes. This usually means your server's clock is off. Fix with:
```bash
# Linux
sudo ntpdate pool.ntp.org

# macOS (usually auto-synced)
sudo sntp -sS pool.ntp.org
```

</details>

<details>
<summary><strong>API calls returning 403 "insufficient_scope"</strong></summary>

Your app doesn't have the required permission scope. Check the scopes you requested during app registration on the Developer Portal. Common scopes: `read_orders`, `read_products`, `read_customers`, `read_inventory`.

</details>

---

## Links

| Resource | URL |
|:---------|:----|
| Documentation | [docs.selorax.io](https://docs.selorax.io) |
| Developer Portal | [portal.selorax.io](https://portal.selorax.io) |
| npm SDK | [@selorax/cli](https://www.npmjs.com/package/@selorax/cli) |
| npm UI Kit | [@selorax/ui](https://www.npmjs.com/package/@selorax/ui) |
| App Boilerplate | [github.com/SeloraX-io/selorax-app-boilerplate](https://github.com/SeloraX-io/selorax-app-boilerplate) |
| SeloraX Platform | [selorax.io](https://selorax.io) |

---

## License

MIT

---

<div align="center">
<sub>Built for the <a href="https://selorax.io">SeloraX</a> developer community</sub>
</div>
