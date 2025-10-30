import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type HttpMethod = "GET" | "POST" | "OPTIONS";

type StripeAction =
  | "createPaymentIntent"
  | "capturePaymentIntent"
  | "cancelPaymentIntent"
  | "createRefund"
  | "createCustomer"
  | "getCustomer"
  | "updateCustomer"
  | "listCustomerPaymentMethods"
  | "getPaymentMethod"
  | "attachPaymentMethod"
  | "detachPaymentMethod"
  | "createSetupIntent";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_API_BASE = "https://api.stripe.com/v1";

if (!STRIPE_SECRET_KEY) {
  console.warn(
    "[stripe-payments] Missing STRIPE_SECRET_KEY environment variable. Stripe requests will fail."
  );
}

interface StripeErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    param?: string;
  };
}

function ensureSecret(): void {
  if (!STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe secret key is not configured. Please set STRIPE_SECRET_KEY with your Stripe secret."
    );
  }
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function appendNested(form: URLSearchParams, prefix: string, value: Record<string, unknown>) {
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || val === null) continue;
    if (typeof val === "object" && !Array.isArray(val)) {
      appendNested(form, `${prefix}[${key}]`, val as Record<string, unknown>);
    } else if (Array.isArray(val)) {
      val.forEach((item, index) => {
        if (item === undefined || item === null) return;
        if (typeof item === "object") {
          appendNested(form, `${prefix}[${index}]`, item as Record<string, unknown>);
        } else {
          form.append(`${prefix}[${index}]`, String(item));
        }
      });
    } else {
      form.set(`${prefix}[${key}]`, String(val));
    }
  }
}

async function stripeRequest(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined | null> } = {}
): Promise<any> {
  ensureSecret();

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${STRIPE_SECRET_KEY}`);

  let url = `${STRIPE_API_BASE}${path}`;
  if (init.query) {
    url += buildQuery(init.query);
  }

  if (init.body instanceof URLSearchParams) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  } else if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    let message = `Stripe request failed (${response.status})`;
    if (isJson) {
      const data = (await response.json()) as StripeErrorResponse;
      if (data?.error?.message) {
        message = data.error.message;
      }
    } else {
      const text = await response.text();
      if (text) {
        message = `${message}: ${text.substring(0, 2000)}`;
      }
    }
    throw new Error(message);
  }

  if (isJson) {
    return await response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

async function handleCreatePaymentIntent(body: any) {
  const {
    amount,
    currency = "cad",
    capture_method = "manual",
    booking_id,
    user_id,
    payment_method_id,
    metadata = {},
  } = body ?? {};

  if (!amount || typeof amount !== "number" || amount <= 0) {
    throw new Error("Valid amount (in cents) is required to create payment intent.");
  }

  const params = new URLSearchParams();
  params.set("amount", String(Math.round(amount)));
  params.set("currency", String(currency).toLowerCase());
  params.set("capture_method", capture_method);
  params.set("automatic_payment_methods[enabled]", "true");
  params.set("automatic_payment_methods[allow_redirects]", "never");
  params.set("metadata[app]", "OnGoPool");

  if (booking_id) {
    params.set("metadata[booking_id]", String(booking_id));
  }
  if (user_id) {
    params.set("metadata[user_id]", String(user_id));
  }
  if (metadata && typeof metadata === "object") {
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined || value === null) continue;
      params.set(`metadata[${key}]`, String(value));
    }
  }

  if (payment_method_id) {
    params.set("payment_method", payment_method_id);
    params.set("confirm", "true");
  }

  const payment_intent = await stripeRequest("/payment_intents", {
    method: "POST",
    body: params,
  });

  return {
    success: true,
    data: {
      payment_intent,
      client_secret: payment_intent.client_secret,
    },
  };
}

async function handleCapturePaymentIntent(body: any) {
  const { payment_intent_id, amount_to_capture } = body ?? {};
  if (!payment_intent_id) {
    throw new Error("payment_intent_id is required to capture a payment intent.");
  }

  const params = new URLSearchParams();
  if (typeof amount_to_capture === "number" && amount_to_capture > 0) {
    params.set("amount_to_capture", String(Math.round(amount_to_capture)));
  }

  const payment_intent = await stripeRequest(
    `/payment_intents/${payment_intent_id}/capture`,
    {
      method: "POST",
      body: params,
    },
  );

  return {
    success: true,
    data: {
      payment_intent,
      amount_processed: payment_intent.amount_received / 100,
    },
  };
}

async function handleCancelPaymentIntent(body: any) {
  const { payment_intent_id, cancellation_reason } = body ?? {};
  if (!payment_intent_id) {
    throw new Error("payment_intent_id is required to cancel a payment intent.");
  }

  const params = new URLSearchParams();
  if (cancellation_reason) {
    params.set("cancellation_reason", cancellation_reason);
  }

  const payment_intent = await stripeRequest(
    `/payment_intents/${payment_intent_id}/cancel`,
    {
      method: "POST",
      body: params,
    },
  );

  return {
    success: true,
    data: {
      payment_intent,
      amount_processed: 0,
    },
  };
}

async function handleCreateRefund(body: any) {
  const { payment_intent_id, amount, reason } = body ?? {};
  if (!payment_intent_id) {
    throw new Error("payment_intent_id is required to create a refund.");
  }

  const params = new URLSearchParams();
  params.set("payment_intent", payment_intent_id);
  if (typeof amount === "number" && amount > 0) {
    params.set("amount", String(Math.round(amount)));
  }
  if (reason) {
    params.set("reason", reason);
  }

  const refund = await stripeRequest("/refunds", {
    method: "POST",
    body: params,
  });

  return {
    success: true,
    data: {
      refund,
      amount_processed: refund.amount ? refund.amount / 100 : undefined,
    },
  };
}

async function handleCreateCustomer(body: any) {
  const { email, name, phone, user_id, metadata } = body?.payload ?? body ?? {};
  if (!email || !user_id) {
    throw new Error("email and user_id are required to create a customer.");
  }

  // Attempt to locate existing customer with same email
  const existing = await stripeRequest("/customers", {
    method: "GET",
    query: {
      email,
      limit: 1,
    },
  });

  if (existing?.data?.length) {
    const customer = existing.data[0];
    if (customer.metadata?.user_id !== user_id) {
      const params = new URLSearchParams();
      params.set("metadata[user_id]", String(user_id));
      params.set("metadata[updated_at]", new Date().toISOString());
      const updated = await stripeRequest(`/customers/${customer.id}`, {
        method: "POST",
        body: params,
      });
      return { success: true, data: { customer: updated } };
    }
    return { success: true, data: { customer } };
  }

  const params = new URLSearchParams();
  params.set("email", email);
  if (name) params.set("name", name);
  if (phone) params.set("phone", phone);
  params.set("metadata[user_id]", String(user_id));
  params.set("metadata[app]", "OnGoPool");
  params.set("metadata[created_at]", new Date().toISOString());
  if (metadata && typeof metadata === "object") {
    appendNested(params, "metadata", metadata);
  }

  const customer = await stripeRequest("/customers", {
    method: "POST",
    body: params,
  });

  return { success: true, data: { customer } };
}

async function handleGetCustomer(body: any) {
  const { customer_id, email } = body ?? {};
  if (!customer_id && !email) {
    throw new Error("customer_id or email is required to retrieve a customer.");
  }

  if (customer_id) {
    const customer = await stripeRequest(`/customers/${customer_id}`, {
      method: "GET",
    });
    return { success: true, data: { customer } };
  }

  const customers = await stripeRequest("/customers", {
    method: "GET",
    query: {
      email,
      limit: 1,
    },
  });

  if (!customers?.data?.length) {
    throw new Error("Customer not found");
  }

  return { success: true, data: { customer: customers.data[0] } };
}

async function handleUpdateCustomer(body: any) {
  const { customer_id, email, name, phone, metadata, invoice_settings } = body ?? {};
  if (!customer_id) {
    throw new Error("customer_id is required to update a customer.");
  }

  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (name) params.set("name", name);
  if (phone) params.set("phone", phone);

  if (metadata && typeof metadata === "object") {
    appendNested(params, "metadata", metadata);
    params.set("metadata[updated_at]", new Date().toISOString());
  }

  if (invoice_settings && typeof invoice_settings === "object") {
    appendNested(params, "invoice_settings", invoice_settings);
  }

  const customer = await stripeRequest(`/customers/${customer_id}`, {
    method: "POST",
    body: params,
  });

  return { success: true, data: { customer } };
}

async function handleListCustomerPaymentMethods(body: any) {
  const { customer_id, payment_method_type = "card", limit = 20 } = body ?? {};
  if (!customer_id) {
    throw new Error("customer_id is required to list payment methods.");
  }

  const paymentMethods = await stripeRequest("/payment_methods", {
    method: "GET",
    query: {
      customer: customer_id,
      type: payment_method_type,
      limit,
    },
  });

  return {
    success: true,
    data: { payment_methods: paymentMethods.data ?? [] },
  };
}

async function handleGetPaymentMethod(body: any) {
  const { payment_method_id } = body ?? {};
  if (!payment_method_id) {
    throw new Error("payment_method_id is required to retrieve a payment method.");
  }

  const payment_method = await stripeRequest(`/payment_methods/${payment_method_id}`, {
    method: "GET",
  });

  return { success: true, data: { payment_method } };
}

async function handleAttachPaymentMethod(body: any) {
  const { customer_id, payment_method_id, set_as_default } = body ?? {};
  if (!customer_id || !payment_method_id) {
    throw new Error("customer_id and payment_method_id are required to attach a payment method.");
  }

  const params = new URLSearchParams();
  params.set("customer", customer_id);

  const payment_method = await stripeRequest(`/payment_methods/${payment_method_id}/attach`, {
    method: "POST",
    body: params,
  });

  if (set_as_default) {
    const defaultParams = new URLSearchParams();
    defaultParams.set("invoice_settings[default_payment_method]", payment_method_id);
    await stripeRequest(`/customers/${customer_id}`, {
      method: "POST",
      body: defaultParams,
    });
  }

  return { success: true, data: { payment_method } };
}

async function handleDetachPaymentMethod(body: any) {
  const { payment_method_id } = body ?? {};
  if (!payment_method_id) {
    throw new Error("payment_method_id is required to detach a payment method.");
  }

  const payment_method = await stripeRequest(`/payment_methods/${payment_method_id}/detach`, {
    method: "POST",
  });

  return { success: true, data: { payment_method } };
}

async function handleCreateSetupIntent(body: any) {
  const { customer_id, payment_method_types = ["card"] } = body ?? {};
  if (!customer_id) {
    throw new Error("customer_id is required to create a setup intent.");
  }

  const params = new URLSearchParams();
  params.set("customer", customer_id);
  params.set("usage", "off_session");
  params.set("metadata[app]", "OnGoPool");
  params.set("metadata[created_at]", new Date().toISOString());

  payment_method_types.forEach((type: string, index: number) => {
    params.set(`payment_method_types[${index}]`, type);
  });

  const setup_intent = await stripeRequest("/setup_intents", {
    method: "POST",
    body: params,
  });

  return {
    success: true,
    data: {
      setup_intent,
      client_secret: setup_intent.client_secret,
    },
  };
}

async function handlePost(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse(
      {
        success: false,
        error: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  const action: StripeAction | undefined = body?.action;
  if (!action) {
    return jsonResponse(
      {
        success: false,
        error: "Missing action in request body.",
      },
      { status: 400 },
    );
  }

  try {
    switch (action) {
      case "createPaymentIntent":
        return jsonResponse(await handleCreatePaymentIntent(body));
      case "capturePaymentIntent":
        return jsonResponse(await handleCapturePaymentIntent(body));
      case "cancelPaymentIntent":
        return jsonResponse(await handleCancelPaymentIntent(body));
      case "createRefund":
        return jsonResponse(await handleCreateRefund(body));
      case "createCustomer":
        return jsonResponse(await handleCreateCustomer(body));
      case "getCustomer":
        return jsonResponse(await handleGetCustomer(body));
      case "updateCustomer":
        return jsonResponse(await handleUpdateCustomer(body));
      case "listCustomerPaymentMethods":
        return jsonResponse(await handleListCustomerPaymentMethods(body));
      case "getPaymentMethod":
        return jsonResponse(await handleGetPaymentMethod(body));
      case "attachPaymentMethod":
        return jsonResponse(await handleAttachPaymentMethod(body));
      case "detachPaymentMethod":
        return jsonResponse(await handleDetachPaymentMethod(body));
      case "createSetupIntent":
        return jsonResponse(await handleCreateSetupIntent(body));
      default:
        return jsonResponse(
          {
            success: false,
            error: `Unsupported action: ${action}`,
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error(`[stripe-payments] Action ${action} failed:`, error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(
      {
        success: false,
        error: message,
      },
      { status: 400 },
    );
  }
}

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") as StripeAction | null;
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  if (!action) {
    return jsonResponse(
      {
        success: false,
        error: "Missing action query parameter.",
      },
      { status: 400 },
    );
  }

  try {
    switch (action) {
      case "getCustomer":
        return jsonResponse(await handleGetCustomer(params));
      case "listCustomerPaymentMethods":
        return jsonResponse(await handleListCustomerPaymentMethods(params));
      case "getPaymentMethod":
        return jsonResponse(await handleGetPaymentMethod(params));
      default:
        return jsonResponse(
          {
            success: false,
            error: `Unsupported GET action: ${action}`,
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error(`[stripe-payments] GET action ${action} failed:`, error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(
      {
        success: false,
        error: message,
      },
      { status: 400 },
    );
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const method = req.method as HttpMethod;

  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!STRIPE_SECRET_KEY) {
    return jsonResponse(
      {
        success: false,
        error: "Stripe secret key is not configured. Please set STRIPE_SECRET_KEY.",
      },
      { status: 500 },
    );
  }

  if (method === "POST") {
    return await handlePost(req);
  }

  if (method === "GET") {
    return await handleGet(req);
  }

  return jsonResponse(
    {
      success: false,
      error: `Method ${method} not allowed`,
    },
    { status: 405 },
  );
});
