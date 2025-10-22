import type { Request, Response } from 'express';
import { Router } from 'express';
import { registerPaymentIntentRoutes } from './payment-intents.js';
import { registerCustomerRoutes } from './customer-management.js';
import { stripeWebhooksRouter } from './webhooks.js';

export function createStripeRouter() {
  const router = Router();

  registerPaymentIntentRoutes(router);
  registerCustomerRoutes(router);
  router.use('/webhooks', stripeWebhooksRouter);

  router.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      timestamp: new Date().toISOString(),
      statusCode: 404,
    });
  });

  return router;
}
