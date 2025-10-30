import { Router } from 'express';
import { PayPalClient } from './client';
import { PayPalService } from './service';
import { registerOrderRoutes } from './orders';
import { registerAuthorizationRoutes } from './authorizations';
function createPayPalClient(options) {
    const clientId = options.clientId || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = options.clientSecret || process.env.PAYPAL_CLIENT_SECRET;
    const sandboxMode = options.sandboxMode ?? (process.env.PAYPAL_SANDBOX_MODE !== 'false');
    if (!clientId || !clientSecret) {
        throw new Error('PayPal client credentials are not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.');
    }
    return new PayPalClient({
        clientId,
        clientSecret,
        environment: sandboxMode ? 'sandbox' : 'live',
    });
}
function createErrorHandler() {
    return (error, _req, res, _next) => {
        console.error('Unhandled PayPal router error:', error);
        res.status(500).json({ success: false, error: 'Internal PayPal API error' });
    };
}
export function createPayPalRouter(options = {}) {
    const router = Router();
    const client = createPayPalClient(options);
    const service = new PayPalService();
    registerOrderRoutes(router, client, service);
    registerAuthorizationRoutes(router, client, service);
    router.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'PayPal API endpoint not found',
            timestamp: new Date().toISOString(),
            statusCode: 404,
        });
    });
    router.use(createErrorHandler());
    return router;
}
