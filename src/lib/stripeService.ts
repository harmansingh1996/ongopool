import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

// Initialize Stripe with publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const supabaseRestUrl = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
const supabaseProjectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF?.trim();

const resolveStripeFunctionBase = () => {
  if (supabaseProjectRef) {
    return `https://${supabaseProjectRef}.functions.supabase.co/stripe-payments`;
  }

  if (supabaseRestUrl) {
    return `${supabaseRestUrl}/functions/v1/stripe-payments`;
  }

  console.warn('[StripeService] Missing Supabase configuration. Falling back to relative function path.');
  return '/functions/v1/stripe-payments';
};

const STRIPE_FUNCTION_BASE = resolveStripeFunctionBase();

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
}

export interface CreatePaymentIntentData {
  amount: number;
  currency?: string;
  capture_method?: 'automatic' | 'manual';
  metadata?: Record<string, string>;
}

export class StripeService {
  private static async getStripe() {
    return await stripePromise;
  }

  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (anonKey) {
      headers['apikey'] = anonKey;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[StripeService] Failed to fetch session for auth header', error);
      }

      const token = data?.session?.access_token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('[StripeService] Unable to include auth header', error);
    }

    return headers;
  }

  /**
   * Create a Payment Intent for authorization (payment hold)
   */
  static async createPaymentIntent(data: CreatePaymentIntentData): Promise<StripePaymentIntent> {
    try {
      const headers = await this.getAuthHeaders();

      const amountInCents = Math.round(data.amount * 100);

      const response = await fetch(`${STRIPE_FUNCTION_BASE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'createPaymentIntent',
          amount: amountInCents,
          currency: (data.currency || 'cad').toLowerCase(),
          capture_method: data.capture_method || 'manual',
          metadata: data.metadata || {},
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage = result.error || response.statusText || 'Failed to create payment intent';
        throw new Error(errorMessage);
      }

      const { payment_intent } = result.data || result; // Support { data: { payment_intent } } shape

      return {
        id: payment_intent.id,
        amount: payment_intent.amount,
        currency: payment_intent.currency,
        status: payment_intent.status,
        client_secret: payment_intent.client_secret,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Confirm a payment with card details
   */
  static async confirmPayment(clientSecret: string, cardElement: any): Promise<any> {
    try {
      const stripe = await this.getStripe();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return paymentIntent;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Capture a payment intent (convert authorization to charge)
   */
  static async capturePayment(paymentIntentId: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${STRIPE_FUNCTION_BASE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'capturePaymentIntent',
          payment_intent_id: paymentIntentId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage = result.error || response.statusText || 'Failed to capture payment';
        throw new Error(errorMessage);
      }

      return (result.data || result).payment_intent;
    } catch (error) {
      console.error('Error capturing payment:', error);
      throw error;
    }
  }

  /**
   * Cancel a payment intent (void authorization)
   */
  static async cancelPayment(paymentIntentId: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${STRIPE_FUNCTION_BASE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'cancelPaymentIntent',
          payment_intent_id: paymentIntentId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage = result.error || response.statusText || 'Failed to cancel payment';
        throw new Error(errorMessage);
      }

      return (result.data || result).payment_intent;
    } catch (error) {
      console.error('Error canceling payment:', error);
      throw error;
    }
  }

  /**
   * Create a refund for a captured payment
   */
  static async createRefund(paymentIntentId: string, amount?: number): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${STRIPE_FUNCTION_BASE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'createRefund',
          payment_intent_id: paymentIntentId,
          amount: amount ? Math.round(amount * 100) : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage = result.error || response.statusText || 'Failed to create refund';
        throw new Error(errorMessage);
      }

      return (result.data || result).refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }
}

export default StripeService;