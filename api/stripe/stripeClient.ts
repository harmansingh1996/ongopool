import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2025-09-30.clover", // match the Stripe 19.x type
});

