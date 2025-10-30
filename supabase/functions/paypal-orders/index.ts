import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type HttpMethod = "GET" | "POST" | "OPTIONS";

type PayPalAction =
  | "createOrder"
  | "captureOrder"
  | "getOrderDetails"
  | "authorizeOrder"
  | "captureAuthorization"
  | "voidAuthorization";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENVIRONMENT = (Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox").toLowerCase();

const PAYPAL_BASE_URL =
  PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

interface PayPalToken {
  token: string;
  expiresAt: number;
}

let cachedToken: PayPalToken | null = null;

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn(
    "[paypal-orders] Missing PayPal credentials. PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required."
  );
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials are not configured.");
  }

  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to obtain PayPal access token (${response.status}): ${text.substring(0, 2000)}`
    );
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

async function paypalRequest(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {}
): Promise<any> {
  const token = await getAccessToken();

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  let url = `${PAYPAL_BASE_URL}${path}`;
  if (init.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    if (isJson) {
      const data = await response.json();
      const message = data?.message || data?.error_description || data?.error || JSON.stringify(data);
      throw new Error(`PayPal request failed (${response.status}): ${message}`);
    }

    const text = await response.text();
    throw new Error(
      `PayPal request failed (${response.status}): ${text.substring(0, 2000)}`
    );
  }

  if (isJson) {
    return await response.json();
  }

  return await response.text();
}

interface CreateOrderPayload {
  amount: number;
  currency: string;
  intent: "AUTHORIZE" | "CAPTURE";
  bookingId?: number;
  userId?: string;
  description?: string;
}

async function handleCreateOrder(body: any) {
  const payload: CreateOrderPayload = body?.payload ?? body ?? {};
  const { amount, currency = "CAD", intent = "CAPTURE", bookingId, userId, description } = payload;

  if (typeof amount !== "number" || amount <= 0) {
    throw new Error("Valid amount is required to create a PayPal order.");
  }

  const paypalResponse = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent,
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          custom_id: bookingId ? String(bookingId) : undefined,
          description,
        },
      ],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: intent === "AUTHORIZE" ? "CONTINUE" : "PAY_NOW",
      },
      payer: userId
        ? {
            payer_id: userId,
          }
        : undefined,
    }),
  });

  return {
    success: true,
    data: paypalResponse,
  };
}

async function handleCaptureOrder(body: any) {
  const { orderId } = body ?? {};
  if (!orderId) {
    throw new Error("orderId is required to capture a PayPal order.");
  }

  const paypalResponse = await paypalRequest(
    `/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return {
    success: true,
    data: paypalResponse,
  };
}

async function handleAuthorizeOrder(body: any) {
  const { orderId } = body ?? {};
  if (!orderId) {
    throw new Error("orderId is required to authorize a PayPal order.");
  }

  const paypalResponse = await paypalRequest(
    `/v2/checkout/orders/${orderId}/authorize`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return {
    success: true,
    data: paypalResponse,
  };
}

async function handleCaptureAuthorization(body: any) {
  const { authorizationId, amount, currency = "CAD" } = body ?? {};
  if (!authorizationId) {
    throw new Error("authorizationId is required to capture a PayPal authorization.");
  }

  const payload = amount
    ? {
        amount: {
          currency_code: currency,
          value: Number(amount).toFixed(2),
        },
      }
    : {};

  const paypalResponse = await paypalRequest(
    `/v2/payments/authorizations/${authorizationId}/capture`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return {
    success: true,
    data: paypalResponse,
  };
}

async function handleVoidAuthorization(body: any) {
  const { authorizationId } = body ?? {};
  if (!authorizationId) {
    throw new Error("authorizationId is required to void a PayPal authorization.");
  }

  await paypalRequest(`/v2/payments/authorizations/${authorizationId}/void`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return {
    success: true,
    data: { voided: true },
  };
}

async function handleGetOrderDetails(params: URLSearchParams) {
  const orderId = params.get("orderId");
  if (!orderId) {
    throw new Error("orderId query parameter is required.");
  }

  const paypalResponse = await paypalRequest(`/v2/checkout/orders/${orderId}`, {
    method: "GET",
  });

  return {
    success: true,
    data: paypalResponse,
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

  const action: PayPalAction | undefined = body?.action;
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
      case "createOrder":
        return jsonResponse(await handleCreateOrder(body));
      case "captureOrder":
        return jsonResponse(await handleCaptureOrder(body));
      case "authorizeOrder":
        return jsonResponse(await handleAuthorizeOrder(body));
      case "captureAuthorization":
        return jsonResponse(await handleCaptureAuthorization(body));
      case "voidAuthorization":
        return jsonResponse(await handleVoidAuthorization(body));
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
    console.error(`[paypal-orders] Action ${action} failed:`, error);
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
  const action = url.searchParams.get("action") as PayPalAction | null;

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
      case "getOrderDetails":
        return jsonResponse(await handleGetOrderDetails(url.searchParams));
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
    console.error(`[paypal-orders] GET action ${action} failed:`, error);
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

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return jsonResponse(
      {
        success: false,
        error: "PayPal credentials are not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
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
