import type { User } from '../types';

interface StripeApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface StripeCustomer {
  id: string;
  email?: string;
  name?: string;
  invoice_settings?: {
    default_payment_method?: string | null;
  };
}

interface StripePaymentMethodCard {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export interface StripePaymentMethod {
  id: string;
  type: string;
  card?: StripePaymentMethodCard;
}

interface CreateCustomerPayload {
  email: string;
  name?: string;
  user_id: string;
}

export type PaymentServiceErrorCode =
  | 'PAYMENT_SERVICE_HTTP_ERROR'
  | 'PAYMENT_SERVICE_HTML_RESPONSE'
  | 'PAYMENT_SERVICE_INVALID_CONTENT'
  | 'PAYMENT_SERVICE_JSON_PARSE_ERROR'
  | 'PAYMENT_SERVICE_ERROR';

export interface PaymentServiceErrorDetails {
  status?: number;
  contentType?: string | null;
  url?: string;
  bodySnippet?: string;
}

export class PaymentServiceResponseError extends Error {
  code: PaymentServiceErrorCode;
  details: PaymentServiceErrorDetails;

  constructor(
    code: PaymentServiceErrorCode,
    message: string,
    details: PaymentServiceErrorDetails = {}
  ) {
    super(message);
    this.name = 'PaymentServiceResponseError';
    this.code = code;
    this.details = details;
  }
}

import { supabase } from './supabase';

const supabaseProjectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF?.trim();
const supabaseRestUrl = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');

const resolveStripeFunctionBase = () => {
  if (supabaseProjectRef) {
    return `https://${supabaseProjectRef}.functions.supabase.co/stripe-payments`;
  }

  if (supabaseRestUrl) {
    return `${supabaseRestUrl}/functions/v1/stripe-payments`;
  }

  console.warn('[StripeCustomerClient] Missing Supabase configuration. Falling back to relative function path.');
  return '/functions/v1/stripe-payments';
};

const STRIPE_FUNCTION_BASE = resolveStripeFunctionBase();

async function getAuthHeaders(): Promise<Record<string, string>> {
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
      console.warn('[StripeCustomerClient] Failed to fetch session for auth header', error);
    }

    const token = data?.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('[StripeCustomerClient] Unable to include auth header', error);
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const status = response.status;
  const url = response.url;

  if (!response.ok) {
    let bodySnippet: string | undefined;
    try {
      bodySnippet = (await response.clone().text()).slice(0, 200);
    } catch (error) {
      bodySnippet = undefined;
    }

    throw new PaymentServiceResponseError(
      'PAYMENT_SERVICE_HTTP_ERROR',
      `Payment service responded with ${status} ${response.statusText}`,
      {
        status,
        contentType,
        url,
        bodySnippet,
      }
    );
  }

  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    let bodySnippet: string | undefined;
    try {
      bodySnippet = (await response.clone().text()).trim().slice(0, 200);
    } catch (error) {
      bodySnippet = undefined;
    }

    const isHtml =
      (contentType && contentType.toLowerCase().includes('text/html')) ||
      (bodySnippet ? bodySnippet.startsWith('<') : false);

    throw new PaymentServiceResponseError(
      isHtml ? 'PAYMENT_SERVICE_HTML_RESPONSE' : 'PAYMENT_SERVICE_INVALID_CONTENT',
      'Payment service returned a non-JSON response. The backend may be unavailable.',
      {
        status,
        contentType,
        url,
        bodySnippet,
      }
    );
  }

  let json: StripeApiResponse<T>;
  try {
    json = (await response.json()) as StripeApiResponse<T>;
  } catch (error) {
    throw new PaymentServiceResponseError(
      'PAYMENT_SERVICE_JSON_PARSE_ERROR',
      'Payment service returned invalid JSON.',
      {
        status,
        contentType,
        url,
      }
    );
  }

  if (!json.success || typeof json.data === 'undefined') {
    throw new PaymentServiceResponseError(
      'PAYMENT_SERVICE_ERROR',
      json.error || 'Payment service request failed',
      {
        status,
        contentType,
        url,
      }
    );
  }

  return json.data;
}

async function callStripeFunction<T>(payload: Record<string, unknown>): Promise<T> {
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(STRIPE_FUNCTION_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof PaymentServiceResponseError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new PaymentServiceResponseError(
        'PAYMENT_SERVICE_ERROR',
        'Failed to reach Stripe service. Please verify the Supabase Edge Function deployment.',
        {
          status: 0,
          url: STRIPE_FUNCTION_BASE,
          bodySnippet: error.message,
        }
      );
    }

    throw error;
  }
}

export async function getStripeCustomer(customerId: string): Promise<StripeCustomer | null> {
  try {
    const data = await callStripeFunction<{ customer: StripeCustomer }>({
      action: 'getCustomer',
      customer_id: customerId,
    });
    return data.customer;
  } catch (error) {
    if (error instanceof PaymentServiceResponseError) {
      if (error.details.status === 404) {
        return null;
      }
      console.warn('Stripe customer lookup unavailable:', error.message, error.details);
      return null;
    }

    console.error('Failed to fetch Stripe customer:', error);
    return null;
  }
}

export async function createStripeCustomer(payload: CreateCustomerPayload): Promise<StripeCustomer> {
  const data = await callStripeFunction<{ customer: StripeCustomer }>({
    action: 'createCustomer',
    payload,
  });
  return data.customer;
}

export async function ensureStripeCustomer(user: User, existingCustomerId?: string | null): Promise<StripeCustomer> {
  if (existingCustomerId) {
    const existing = await getStripeCustomer(existingCustomerId);
    if (existing) {
      return existing;
    }
  }

  if (!user.email) {
    throw new Error('Email is required to create a Stripe customer');
  }

  const customer = await createStripeCustomer({
    email: user.email,
    name: user.display_name,
    user_id: user.id,
  });

  return customer;
}

export async function listStripeCardPaymentMethods(customerId: string): Promise<StripePaymentMethod[]> {
  const data = await callStripeFunction<{ payment_methods: StripePaymentMethod[] }>({
    action: 'listCustomerPaymentMethods',
    customer_id: customerId,
    payment_method_type: 'card',
  });
  return data.payment_methods || [];
}

export async function createStripeSetupIntent(customerId: string): Promise<{ client_secret: string }> {
  const data = await callStripeFunction<{ setup_intent: { client_secret: string } }>({
    action: 'createSetupIntent',
    customer_id: customerId,
  });

  if (!data.setup_intent?.client_secret) {
    throw new Error('Failed to create setup intent');
  }

  return { client_secret: data.setup_intent.client_secret };
}

export async function attachStripePaymentMethod(
  customerId: string,
  paymentMethodId: string,
  setAsDefault?: boolean
): Promise<void> {
  if (!paymentMethodId) {
    return;
  }

  try {
    await callStripeFunction<{ success: boolean }>({
      action: 'attachPaymentMethod',
      customer_id: customerId,
      payment_method_id: paymentMethodId,
      set_as_default: Boolean(setAsDefault),
    });
  } catch (error) {
    if (
      error instanceof PaymentServiceResponseError &&
      error.details.status === 409 &&
      setAsDefault
    ) {
      await updateCustomerDefaultPaymentMethod(customerId, paymentMethodId);
      return;
    }

    throw error;
  }
}

export async function updateCustomerDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
  await callStripeFunction<{ success: boolean }>({
    action: 'updateCustomer',
    customer_id: customerId,
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

export async function retrieveStripePaymentMethod(paymentMethodId: string): Promise<StripePaymentMethod | null> {
  try {
    const data = await callStripeFunction<{ payment_method: StripePaymentMethod }>({
      action: 'getPaymentMethod',
      payment_method_id: paymentMethodId,
    });
    return data.payment_method;
  } catch (error) {
    if (error instanceof PaymentServiceResponseError) {
      if (error.details.status === 404) {
        return null;
      }
      console.warn('Stripe payment method retrieval unavailable:', error.message, error.details);
      return null;
    }

    console.error('Failed to retrieve Stripe payment method:', error);
    return null;
  }
}
