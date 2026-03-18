const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

// Rate limit: max 80 messages per second (Meta Cloud API)
const RATE_LIMIT_PER_SECOND = 80;
const RATE_LIMIT_WINDOW_MS = 1000;

interface MetaWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
}

interface MetaSendResult {
  messageId: string | null;
}

interface MetaResponse {
  messages?: { id: string }[];
  error?: { message: string; code: number };
}

interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters?: TemplateParameter[];
}

interface TemplateParameter {
  type: "text" | "image" | "document" | "video";
  text?: string;
  image?: { link: string };
  document?: { link: string };
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  components: {
    type: string;
    text?: string;
    format?: string;
    buttons?: { type: string; text: string; url?: string }[];
    example?: { body_text?: string[][] };
  }[];
}

interface TemplatesResponse {
  data?: WhatsAppTemplate[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message: string; code: number };
}

// ── Rate limiter ──────────────────────────────────────

class RateLimiter {
  private timestamps: number[] = [];

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than the window
    this.timestamps = this.timestamps.filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS
    );

    if (this.timestamps.length >= RATE_LIMIT_PER_SECOND) {
      const oldest = this.timestamps[0];
      const waitTime = RATE_LIMIT_WINDOW_MS - (now - oldest) + 10;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }

    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter();

// ── Retry with exponential backoff ────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on client errors (4xx) except rate limits (429)
      if (lastError.message.includes("400") || lastError.message.includes("403")) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ── Send text message ─────────────────────────────────

export async function sendWhatsAppTextMessage(
  config: MetaWhatsAppConfig,
  to: string,
  text: string
): Promise<MetaSendResult> {
  await rateLimiter.waitForSlot();

  return withRetry(async () => {
    const url = `${META_GRAPH_URL}/${config.phoneNumberId}/messages`;

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as MetaResponse;

    if (!res.ok) {
      const detail = json.error?.message || `Meta API error ${res.status}`;
      throw new Error(detail);
    }

    return { messageId: json.messages?.[0]?.id || null };
  });
}

// ── Send template message ─────────────────────────────

export async function sendWhatsAppTemplateMessage(
  config: MetaWhatsAppConfig,
  to: string,
  templateName: string,
  languageCode: string = "es",
  components?: TemplateComponent[]
): Promise<MetaSendResult> {
  await rateLimiter.waitForSlot();

  return withRetry(async () => {
    const url = `${META_GRAPH_URL}/${config.phoneNumberId}/messages`;

    const template: Record<string, unknown> = {
      name: templateName,
      language: { code: languageCode },
    };

    if (components && components.length > 0) {
      template.components = components;
    }

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as MetaResponse;

    if (!res.ok) {
      const detail = json.error?.message || `Meta API error ${res.status}`;
      throw new Error(detail);
    }

    return { messageId: json.messages?.[0]?.id || null };
  });
}

// ── Fetch approved templates ──────────────────────────

export async function getWhatsAppTemplates(
  config: MetaWhatsAppConfig
): Promise<WhatsAppTemplate[]> {
  if (!config.businessAccountId) {
    throw new Error("Business Account ID (WABA ID) es necesario para listar plantillas");
  }

  const templates: WhatsAppTemplate[] = [];
  let url: string | null =
    `${META_GRAPH_URL}/${config.businessAccountId}/message_templates?limit=100&status=APPROVED`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });

    const json = (await res.json()) as TemplatesResponse;

    if (!res.ok) {
      const detail = json.error?.message || `Meta API error ${res.status}`;
      throw new Error(detail);
    }

    if (json.data) {
      templates.push(...json.data);
    }

    url = json.paging?.next || null;
  }

  return templates;
}
