const ZEPTOMAIL_URL = "https://api.zeptomail.com/v1.1/email";
const ZEPTOMAIL_KEY = process.env.ZEPTOMAIL_API_KEY || "";
const FROM_ADDRESS = process.env.ZEPTOMAIL_FROM || "sistemas@acpe.com.ec";

interface ZeptoResponse {
  request_id?: string;
  data?: { code?: string; message?: string }[];
  message?: string;
  error?: { code?: string; details?: { code?: string; message?: string }[] };
}

interface ZeptoMailOptions {
  apiKey?: string;
  fromAddress?: string;
}

export async function sendZeptoMailEmail(
  to: string,
  toName: string | undefined,
  subject: string,
  htmlBody: string,
  options?: ZeptoMailOptions
): Promise<{ requestId: string | null }> {
  const apiKey = options?.apiKey || ZEPTOMAIL_KEY;
  const fromAddr = options?.fromAddress || FROM_ADDRESS;

  if (!apiKey) {
    throw new Error("ZeptoMail API key not configured");
  }

  const body = {
    from: { address: fromAddr },
    to: [
      {
        email_address: {
          address: to,
          ...(toName ? { name: toName } : {}),
        },
      },
    ],
    subject,
    htmlbody: htmlBody,
  };

  const res = await fetch(ZEPTOMAIL_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Zoho-enczapikey ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as ZeptoResponse;

  if (!res.ok) {
    const detail =
      json.error?.details?.[0]?.message ||
      json.message ||
      `ZeptoMail error ${res.status}`;
    throw new Error(detail);
  }

  return { requestId: json.request_id || null };
}
