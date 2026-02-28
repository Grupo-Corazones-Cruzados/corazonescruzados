const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Failed to get PayPal access token");
  const data = await res.json();
  return data.access_token;
}

export async function createPayPalOrder(params: {
  orderId: number;
  total: number;
  items: { name: string; quantity: number; unitPrice: number }[];
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ paypalOrderId: string; approvalUrl: string }> {
  const accessToken = await getPayPalAccessToken();
  const itemTotal = params.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0
  );
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `order_${params.orderId}`,
        description: `Pedido #${params.orderId} - Corazones Cruzados`,
        amount: {
          currency_code: "USD",
          value: params.total.toFixed(2),
          breakdown: {
            item_total: { currency_code: "USD", value: itemTotal.toFixed(2) },
          },
        },
        items: params.items.map((i) => ({
          name: i.name.slice(0, 127),
          quantity: i.quantity.toString(),
          unit_amount: { currency_code: "USD", value: i.unitPrice.toFixed(2) },
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
  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create PayPal order");
  const data = await res.json();
  const approvalLink = data.links?.find(
    (l: { rel: string }) => l.rel === "approve"
  );
  if (!approvalLink) throw new Error("No approval URL in PayPal response");
  return { paypalOrderId: data.id, approvalUrl: approvalLink.href };
}

export async function capturePayPalOrder(
  paypalOrderId: string
): Promise<{ captureId: string; status: string; payerEmail: string | null }> {
  const accessToken = await getPayPalAccessToken();
  const res = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to capture PayPal payment");
  const data = await res.json();
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) throw new Error("No capture data in PayPal response");
  return {
    captureId: capture.id,
    status: capture.status,
    payerEmail: data.payer?.email_address || null,
  };
}
