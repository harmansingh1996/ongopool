import type { Request, Response } from 'express';
import { Router } from 'express';
import Stripe from 'stripe';
import { stripe } from './stripeClient';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!endpointSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set.');
}

async function handlePaymentIntentEvent(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  console.log(`PaymentIntent ${event.type}:`, paymentIntent.id);
}

async function handleCustomerEvent(event: Stripe.Event) {
  const customer = event.data.object as Stripe.Customer;

  console.log(`Customer ${event.type}:`, customer.id);
}

async function handlePaymentMethodEvent(event: Stripe.Event) {
  const paymentMethod = event.data.object as Stripe.PaymentMethod;

  console.log(`PaymentMethod ${event.type}:`, paymentMethod.id);
}

async function handleSetupIntentEvent(event: Stripe.Event) {
  const setupIntent = event.data.object as Stripe.SetupIntent;

  console.log(`SetupIntent ${event.type}:`, setupIntent.id);
}

async function handleChargeEvent(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;

  console.log(`Charge ${event.type}:`, charge.id);
}

const router: Router = Router();

router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig || Array.isArray(sig)) {
    return res.status(400).json({ error: 'Missing Stripe signature header' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
      case 'payment_intent.requires_action':
        await handlePaymentIntentEvent(event);
        break;
      case 'customer.created':
      case 'customer.updated':
      case 'customer.deleted':
        await handleCustomerEvent(event);
        break;
      case 'payment_method.attached':
      case 'payment_method.detached':
        await handlePaymentMethodEvent(event);
        break;
      case 'setup_intent.succeeded':
      case 'setup_intent.setup_failed':
        await handleSetupIntentEvent(event);
        break;
      case 'charge.succeeded':
      case 'charge.failed':
      case 'charge.captured':
        await handleChargeEvent(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export const stripeWebhooksRouter = router;
