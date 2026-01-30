/**
 * PayPal Integration Utilities
 *
 * Environment variables required:
 * - PAYPAL_CLIENT_ID
 * - PAYPAL_CLIENT_SECRET
 * - PAYPAL_MODE (sandbox | live)
 */

const PAYPAL_BASE_URL = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

/**
 * Get PayPal access token for API calls
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("PayPal auth error:", errorData);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Create a PayPal order for checkout
 */
export async function createPayPalOrder(params: {
  orderId: number;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{
  paypalOrderId: string;
  approvalUrl: string;
}> {
  const accessToken = await getPayPalAccessToken();

  const itemTotal = params.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const orderPayload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `order_${params.orderId}`,
        description: `Pedido #${params.orderId} - Corazones Cruzados`,
        amount: {
          currency_code: "USD",
          value: params.total.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: "USD",
              value: itemTotal.toFixed(2),
            },
          },
        },
        items: params.items.map((item) => ({
          name: item.name.slice(0, 127), // PayPal max 127 chars
          quantity: item.quantity.toString(),
          unit_amount: {
            currency_code: "USD",
            value: item.unitPrice.toFixed(2),
          },
        })),
      },
    ],
    application_context: {
      brand_name: "Corazones Cruzados",
      locale: "es-US",
      landing_page: "LOGIN",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("PayPal create order error:", errorData);
    throw new Error("Failed to create PayPal order");
  }

  const data = await response.json();

  const approvalLink = data.links?.find((link: any) => link.rel === "approve");
  if (!approvalLink) {
    throw new Error("No approval URL in PayPal response");
  }

  return {
    paypalOrderId: data.id,
    approvalUrl: approvalLink.href,
  };
}

/**
 * Capture a PayPal order after approval
 */
export async function capturePayPalOrder(paypalOrderId: string): Promise<{
  captureId: string;
  status: string;
  payerEmail: string | null;
}> {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("PayPal capture error:", errorData);
    throw new Error("Failed to capture PayPal payment");
  }

  const data = await response.json();

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) {
    throw new Error("No capture data in PayPal response");
  }

  return {
    captureId: capture.id,
    status: capture.status,
    payerEmail: data.payer?.email_address || null,
  };
}

/**
 * Verify PayPal webhook signature (for production use)
 */
export async function verifyPayPalWebhook(params: {
  webhookId: string;
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookEvent: any;
}): Promise<boolean> {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      webhook_id: params.webhookId,
      transmission_id: params.transmissionId,
      transmission_time: params.transmissionTime,
      cert_url: params.certUrl,
      auth_algo: params.authAlgo,
      transmission_sig: params.transmissionSig,
      webhook_event: params.webhookEvent,
    }),
  });

  if (!response.ok) {
    console.error("PayPal webhook verification failed");
    return false;
  }

  const data = await response.json();
  return data.verification_status === "SUCCESS";
}
