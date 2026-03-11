/**
 * SDK constants — webhook topics, scopes, token prefixes, headers.
 *
 *   const { WEBHOOK_TOPICS, SCOPES } = require('selorax-app-sdk');
 *   app.use('/webhooks', createWebhookRouter({
 *       [WEBHOOK_TOPICS.ORDER_STATUS_CHANGED]: handler,
 *   }));
 */

const WEBHOOK_TOPICS = {
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_STATUS_CHANGED: 'order.status_changed',
    ORDER_CANCELLED: 'order.cancelled',
    ORDER_DELETED: 'order.deleted',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_DELETED: 'product.deleted',
    CUSTOMER_CREATED: 'customer.created',
    CUSTOMER_UPDATED: 'customer.updated',
    INVENTORY_UPDATED: 'inventory.updated',
    APP_INSTALLED: 'app.installed',
    APP_UNINSTALLED: 'app.uninstalled',
};

const SCOPES = {
    READ_ORDERS: 'read_orders',
    WRITE_ORDERS: 'write_orders',
    READ_PRODUCTS: 'read_products',
    WRITE_PRODUCTS: 'write_products',
    READ_CUSTOMERS: 'read_customers',
    WRITE_CUSTOMERS: 'write_customers',
    READ_INVENTORY: 'read_inventory',
    WRITE_INVENTORY: 'write_inventory',
};

const TOKEN_PREFIXES = {
    CLIENT_ID: 'sx_app_',
    CLIENT_SECRET: 'sx_secret_',
    ACCESS_TOKEN: 'sx_at_',
    REFRESH_TOKEN: 'sx_rt_',
    AUTH_CODE: 'sx_ac_',
    WEBHOOK_SECRET: 'whsec_',
};

const HEADERS = {
    SESSION_TOKEN: 'X-Session-Token',
    CLIENT_ID: 'X-Client-Id',
    CLIENT_SECRET: 'X-Client-Secret',
    STORE_ID: 'X-Store-Id',
    WEBHOOK_SIGNATURE: 'X-SeloraX-Signature',
    WEBHOOK_EVENT: 'X-SeloraX-Webhook-Event',
    WEBHOOK_TIMESTAMP: 'X-SeloraX-Timestamp',
};

// ── Extension Targets ──────────────────────────────────────────
// Where extensions can appear in the SeloraX dashboard.
const EXTENSION_TARGETS = {
    // Order
    ORDER_DETAIL_BLOCK: 'order.detail.block',
    ORDER_DETAIL_ACTION: 'order.detail.action',
    ORDER_LIST_ACTION: 'order.list.action',
    ORDER_LIST_SELECTION_ACTION: 'order.list.selection-action',
    ORDER_DETAIL_PRINT_ACTION: 'order.detail.print-action',
    // Product
    PRODUCT_DETAIL_BLOCK: 'product.detail.block',
    PRODUCT_DETAIL_ACTION: 'product.detail.action',
    PRODUCT_LIST_ACTION: 'product.list.action',
    PRODUCT_LIST_SELECTION_ACTION: 'product.list.selection-action',
    PRODUCT_DETAIL_PRINT_ACTION: 'product.detail.print-action',
    // Customer
    CUSTOMER_DETAIL_BLOCK: 'customer.detail.block',
    CUSTOMER_DETAIL_ACTION: 'customer.detail.action',
    CUSTOMER_LIST_ACTION: 'customer.list.action',
    CUSTOMER_LIST_SELECTION_ACTION: 'customer.list.selection-action',
    // Dashboard
    DASHBOARD_WIDGET: 'dashboard.widget',
    DASHBOARD_BLOCK: 'dashboard.block',
    // Navigation
    NAVIGATION_LINK: 'navigation.link',
    // Settings
    SETTINGS_PAGE: 'settings.page',
    // POS
    POS_ACTION: 'pos.action',
    POS_CART_BLOCK: 'pos.cart.block',
    // Checkout
    CHECKOUT_BLOCK: 'checkout.block',
    CHECKOUT_ACTION: 'checkout.action',
    // Fulfillment
    FULFILLMENT_DETAIL_BLOCK: 'fulfillment.detail.block',
    FULFILLMENT_DETAIL_ACTION: 'fulfillment.detail.action',
    // Global
    GLOBAL_ACTION: 'global.action',
};

// ── Extension Component Types ──────────────────────────────────
// Valid component types for JSON UI trees (used in the "type" field).
const EXTENSION_COMPONENTS = {
    // Layout
    Stack: 'Stack',
    Grid: 'Grid',
    Card: 'Card',
    Divider: 'Divider',
    Separator: 'Separator',
    Box: 'Box',
    InlineStack: 'InlineStack',
    BlockStack: 'BlockStack',
    InlineGrid: 'InlineGrid',
    Bleed: 'Bleed',
    Layout: 'Layout',
    LayoutSection: 'LayoutSection',
    Page: 'Page',
    ButtonGroup: 'ButtonGroup',
    Collapsible: 'Collapsible',
    // Display
    Text: 'Text',
    Heading: 'Heading',
    Image: 'Image',
    Badge: 'Badge',
    Icon: 'Icon',
    KeyValue: 'KeyValue',
    Table: 'Table',
    List: 'List',
    Thumbnail: 'Thumbnail',
    Banner: 'Banner',
    CalloutCard: 'CalloutCard',
    EmptyState: 'EmptyState',
    Tag: 'Tag',
    DescriptionList: 'DescriptionList',
    MediaCard: 'MediaCard',
    Avatar: 'Avatar',
    // Input
    TextField: 'TextField',
    TextArea: 'TextArea',
    Select: 'Select',
    Checkbox: 'Checkbox',
    RadioGroup: 'RadioGroup',
    Toggle: 'Toggle',
    DatePicker: 'DatePicker',
    Autocomplete: 'Autocomplete',
    ColorPicker: 'ColorPicker',
    DropZone: 'DropZone',
    RangeSlider: 'RangeSlider',
    // Action
    Button: 'Button',
    Link: 'Link',
    ActionMenu: 'ActionMenu',
    PageActions: 'PageActions',
    // Feedback
    Alert: 'Alert',
    Progress: 'Progress',
    Spinner: 'Spinner',
    Truncate: 'Truncate',
    TextStyle: 'TextStyle',
    // Data
    IndexTable: 'IndexTable',
    DataTable: 'DataTable',
    Filters: 'Filters',
    Pagination: 'Pagination',
    // Overlay
    Modal: 'Modal',
    Drawer: 'Drawer',
    Tabs: 'Tabs',
    Accordion: 'Accordion',
    Popover: 'Popover',
    Tooltip: 'Tooltip',
    // Navigation
    Listbox: 'Listbox',
    // Resource
    ResourceItem: 'ResourceItem',
    ResourceList: 'ResourceList',
};

// ── Extension Action Types ─────────────────────────────────────
// Actions that can be triggered from extension buttons, forms, etc.
const EXTENSION_ACTIONS = {
    CALL_BACKEND: 'call_backend',
    NAVIGATE: 'navigate',
    OPEN_MODAL: 'open_modal',
    OPEN_DRAWER: 'open_drawer',
    CLOSE_MODAL: 'close_modal',
    CLOSE_DRAWER: 'close_drawer',
    OPEN_LINK: 'open_link',
    SET_STATE: 'set_state',
};

module.exports = {
    WEBHOOK_TOPICS,
    SCOPES,
    TOKEN_PREFIXES,
    HEADERS,
    EXTENSION_TARGETS,
    EXTENSION_COMPONENTS,
    EXTENSION_ACTIONS,
};
