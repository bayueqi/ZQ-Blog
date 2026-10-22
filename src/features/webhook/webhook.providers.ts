import type {
  WebhookEndpoint,
  WebhookProvider,
} from "@/features/webhook/webhook.schema";

/** What a notification offers a body template, as `{{name}}`. */
export interface WebhookContent {
  id: string;
  type: string;
  timestamp: string;
  test: boolean;
  /** A short heading, such as "Blog notification · New comment". */
  title: string;
  /** The full plain-text notification, link included. */
  message: string;
  /** The comment, or the review page of a friend link request. */
  url: string;
  data: Record<string, unknown>;
}

export interface WebhookRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export const WEBHOOK_TEMPLATE_VARIABLES = [
  "title",
  "message",
  "url",
  "type",
  "timestamp",
  "data.*",
] as const;

/** Which providers keep a credential in `secret`, and whether it is needed. */
const SECRET_USE: Record<WebhookProvider, "required" | "optional" | "none"> = {
  generic: "required",
  telegram: "required",
  custom: "optional",
  discord: "none",
  feishu: "none",
  dingtalk: "none",
  wecom: "none",
  bark: "none",
  ntfy: "none",
};

export function providerOf(endpoint: Pick<WebhookEndpoint, "provider">) {
  return endpoint.provider ?? "generic";
}

export function webhookSecretUse(provider: WebhookProvider) {
  return SECRET_USE[provider];
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * The first setting a provider still needs, or null once it can deliver.
 * An endpoint with nothing filled in reports "url" (or "secret" for Telegram).
 */
export function missingWebhookField(
  endpoint: WebhookEndpoint,
): "url" | "secret" | "chatId" | "template" | null {
  const provider = providerOf(endpoint);
  if (provider === "telegram") {
    if (!endpoint.secret.trim()) return "secret";
    return endpoint.chatId?.trim() ? null : "chatId";
  }
  if (!isHttpUrl(endpoint.url.trim())) return "url";
  if (SECRET_USE[provider] === "required" && !endpoint.secret.trim())
    return "secret";
  if (provider === "custom" && !endpoint.template?.trim()) return "template";
  return null;
}

/** Whether nothing that would make the endpoint deliver has been entered. */
export function isWebhookEmpty(endpoint: WebhookEndpoint) {
  return providerOf(endpoint) === "telegram"
    ? !endpoint.secret.trim() && !endpoint.chatId?.trim()
    : !endpoint.url.trim();
}

function variable(content: WebhookContent, name: string): string {
  const value = name.startsWith("data.")
    ? content.data[name.slice("data.".length)]
    : name in content && name !== "data"
      ? content[name as keyof Omit<WebhookContent, "data">]
      : undefined;
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

/**
 * Replaces each `{{name}}` with a value from `content`, JSON-escaped (without
 * quotes) when `json` is set so it can sit inside a JSON string. Unknown
 * names become empty.
 */
export function renderWebhookTemplate(
  template: string,
  content: WebhookContent,
  json: boolean,
) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name: string) => {
    const value = variable(content, name);
    return json ? JSON.stringify(value).slice(1, -1) : value;
  });
}

const CHAT_TEXT = "{{title}}\\n{{message}}";

/** A JSON string literal, for a value written into a template. */
const literal = (value: string) => JSON.stringify(value);

/** Bark's push URL is `<server>/<device key>/<optional text…>`. */
function barkUrl(value: string) {
  const url = new URL(value);
  const key = url.pathname.split("/").find(Boolean) ?? "";
  return `${url.origin}/${key}`;
}

/** ntfy publishes JSON to the server root, naming the topic in the body. */
function ntfyTarget(value: string) {
  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);
  const topic = segments.pop() ?? "";
  return {
    url: `${url.origin}/${segments.map((part) => `${part}/`).join("")}`,
    topic,
  };
}

/**
 * The URL and body template a preset sends, which is also where "custom"
 * starts when the admin switches to it. Telegram's URL carries the bot
 * token, so a starter written for the form uses `token` as given.
 */
export function presetRequestTemplate(
  provider: Exclude<WebhookProvider, "generic" | "custom">,
  endpoint: Pick<WebhookEndpoint, "url" | "chatId">,
  token: string,
): { url: string; template: string } {
  switch (provider) {
    case "telegram":
      return {
        url: `https://api.telegram.org/bot${token}/sendMessage`,
        template: `{"chat_id": ${literal(endpoint.chatId?.trim() ?? "")}, "text": "${CHAT_TEXT}"}`,
      };
    case "discord":
      return { url: endpoint.url, template: `{"content": "${CHAT_TEXT}"}` };
    case "feishu":
      return {
        url: endpoint.url,
        template: `{"msg_type": "text", "content": {"text": "${CHAT_TEXT}"}}`,
      };
    case "dingtalk":
    case "wecom":
      return {
        url: endpoint.url,
        template: `{"msgtype": "text", "text": {"content": "${CHAT_TEXT}"}}`,
      };
    case "bark":
      return {
        url: isHttpUrl(endpoint.url) ? barkUrl(endpoint.url) : endpoint.url,
        template:
          '{"title": "{{title}}", "body": "{{message}}", "url": "{{url}}"}',
      };
    case "ntfy": {
      if (!isHttpUrl(endpoint.url)) return { url: endpoint.url, template: "" };
      const target = ntfyTarget(endpoint.url);
      return {
        url: target.url,
        template: `{"topic": ${literal(target.topic)}, "title": "{{title}}", "message": "{{message}}", "click": "{{url}}"}`,
      };
    }
    default: {
      provider satisfies never;
      throw new Error("Unknown webhook provider");
    }
  }
}

async function hmacHex(secret: string, text: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The `X-Flare-*` headers that let a receiver check the body came from us. */
async function flareHeaders(
  content: WebhookContent,
  secret: string,
  body: string,
) {
  return {
    "X-Flare-Event": content.type,
    "X-Flare-Timestamp": content.timestamp,
    "X-Flare-Signature": `sha256=${await hmacHex(secret, `${content.timestamp}.${body}`)}`,
  };
}

/**
 * The POST that delivers `content` to `endpoint`. `genericBody` is the Flare
 * JSON body the generic provider sends unchanged.
 */
export async function buildWebhookRequest(
  endpoint: WebhookEndpoint,
  content: WebhookContent,
  genericBody: string,
): Promise<WebhookRequest> {
  const provider = providerOf(endpoint);
  if (provider === "generic") {
    return {
      url: endpoint.url.trim(),
      headers: {
        "Content-Type": "application/json",
        ...(await flareHeaders(content, endpoint.secret, genericBody)),
      },
      body: genericBody,
    };
  }
  if (provider === "custom") {
    const template = endpoint.template ?? "";
    const json = renderWebhookTemplate(template, content, true);
    let isJson = true;
    try {
      JSON.parse(json);
    } catch {
      isJson = false;
    }
    const body = isJson
      ? json
      : renderWebhookTemplate(template, content, false);
    return {
      url: endpoint.url.trim(),
      headers: {
        "Content-Type": isJson
          ? "application/json"
          : "text/plain; charset=utf-8",
        ...(endpoint.secret
          ? await flareHeaders(content, endpoint.secret, body)
          : {}),
      },
      body,
    };
  }
  const preset = presetRequestTemplate(
    provider,
    { url: endpoint.url.trim(), chatId: endpoint.chatId },
    endpoint.secret.trim(),
  );
  return {
    url: preset.url,
    headers: { "Content-Type": "application/json" },
    body: renderWebhookTemplate(preset.template, content, true),
  };
}

/**
 * Why a provider refused a delivery, read from its response, or null when it
 * accepted it. Feishu, DingTalk and WeCom answer 200 even when they refuse.
 */
export function webhookResponseError(
  provider: WebhookProvider,
  ok: boolean,
  text: string,
): string | null {
  let json: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object")
      json = parsed as Record<string, unknown>;
  } catch {
    // Not JSON; fall back to the raw text.
  }
  const field = (name: string) =>
    typeof json?.[name] === "string" ? (json[name] as string) : "";
  const code = (name: string) =>
    typeof json?.[name] === "number" ? (json[name] as number) : 0;

  switch (provider) {
    case "feishu":
      // Older bots answer `StatusCode`, newer ones `code`.
      if (code("code") || code("StatusCode"))
        return field("msg") || field("StatusMessage") || text;
      break;
    case "dingtalk":
    case "wecom":
      if (code("errcode")) return field("errmsg") || text;
      break;
    default:
      break;
  }
  if (ok) return null;
  return (
    field("description") || // Telegram
    field("message") || // Discord, Bark
    field("error") || // ntfy
    text
  );
}
