import { describe, expect, it } from "vitest";
import {
  buildWebhookRequest,
  missingWebhookField,
  renderWebhookTemplate,
  webhookResponseError,
  type WebhookContent,
} from "@/features/webhook/webhook.providers";
import type { WebhookEndpoint } from "@/features/webhook/webhook.schema";

const content: WebhookContent = {
  id: "msg_1",
  type: "comment.admin_root_created",
  timestamp: "2026-10-14T00:00:00.000Z",
  test: false,
  title: "博客通知 · 新评论",
  message: 'Ada 说："好"\n https://example.com/p?comment=1',
  url: "https://example.com/p?comment=1",
  data: { commenterName: "Ada", postTitle: "Hello" },
};

function endpoint(fields: Partial<WebhookEndpoint>): WebhookEndpoint {
  return { url: "", secret: "", ...fields };
}

async function sent(fields: Partial<WebhookEndpoint>) {
  const request = await buildWebhookRequest(endpoint(fields), content, "{}");
  return { ...request, json: JSON.parse(request.body) as unknown };
}

describe("renderWebhookTemplate", () => {
  it("escapes values for JSON, reads data fields and empties unknown names", () => {
    const body = renderWebhookTemplate(
      '{"text": "{{ message }}", "who": "{{data.commenterName}}", "x": "{{nope}}"}',
      content,
      true,
    );
    expect(JSON.parse(body)).toEqual({
      text: content.message,
      who: "Ada",
      x: "",
    });
  });
});

describe("buildWebhookRequest", () => {
  it("sends the generic body untouched with a verifiable signature", async () => {
    const request = await buildWebhookRequest(
      endpoint({ url: " https://hooks.example.com/n ", secret: "k" }),
      content,
      '{"id":"msg_1"}',
    );
    expect(request.url).toBe("https://hooks.example.com/n");
    expect(request.body).toBe('{"id":"msg_1"}');
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("k"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = Buffer.from(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${content.timestamp}.{"id":"msg_1"}`),
      ),
    ).toString("hex");
    expect(request.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Flare-Event": "comment.admin_root_created",
      "X-Flare-Signature": `sha256=${expected}`,
    });
  });

  it("messages a Telegram chat through the bot token's URL", async () => {
    const request = await sent({
      provider: "telegram",
      secret: "123:abc",
      chatId: "-10042",
    });
    expect(request.url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(request.json).toEqual({
      chat_id: "-10042",
      text: `${content.title}\n${content.message}`,
    });
  });

  it("speaks each chat bot's format", async () => {
    const text = `${content.title}\n${content.message}`;
    expect(
      (await sent({ provider: "discord", url: "https://d/x" })).json,
    ).toEqual({ content: text });
    expect(
      (await sent({ provider: "feishu", url: "https://f/x" })).json,
    ).toEqual({ msg_type: "text", content: { text } });
    for (const provider of ["dingtalk", "wecom"] as const) {
      expect((await sent({ provider, url: "https://d/x" })).json).toEqual({
        msgtype: "text",
        text: { content: text },
      });
    }
  });

  it("pushes to Bark's key URL and ntfy's server root", async () => {
    const bark = await sent({
      provider: "bark",
      url: "https://api.day.app/KEY/这里改成你自己的推送内容",
    });
    expect(bark.url).toBe("https://api.day.app/KEY");
    expect(bark.json).toEqual({
      title: content.title,
      body: content.message,
      url: content.url,
    });

    const ntfy = await sent({
      provider: "ntfy",
      url: "https://ntfy.example.com/sub/my-topic",
    });
    expect(ntfy.url).toBe("https://ntfy.example.com/sub/");
    expect(ntfy.json).toEqual({
      topic: "my-topic",
      title: content.title,
      message: content.message,
      click: content.url,
    });
  });

  it("fills a custom template, as JSON or as plain text", async () => {
    const json = await buildWebhookRequest(
      endpoint({
        provider: "custom",
        url: "https://c/x",
        template: '{"msg": "{{message}}"}',
      }),
      content,
      "{}",
    );
    expect(JSON.parse(json.body)).toEqual({ msg: content.message });
    expect(json.headers).not.toHaveProperty("X-Flare-Signature");

    const text = await buildWebhookRequest(
      endpoint({
        provider: "custom",
        url: "https://c/x",
        secret: "k",
        template: "{{title}}: {{message}}",
      }),
      content,
      "{}",
    );
    expect(text.body).toBe(`${content.title}: ${content.message}`);
    expect(text.headers).toMatchObject({
      "Content-Type": "text/plain; charset=utf-8",
      "X-Flare-Signature": expect.stringMatching(/^sha256=/),
    });
  });
});

describe("missingWebhookField", () => {
  it("names what each channel still needs", () => {
    expect(missingWebhookField(endpoint({ url: "https://x" }))).toBe("secret");
    expect(
      missingWebhookField(endpoint({ provider: "telegram", secret: "t" })),
    ).toBe("chatId");
    expect(
      missingWebhookField(endpoint({ provider: "discord", url: "nope" })),
    ).toBe("url");
    expect(
      missingWebhookField(endpoint({ provider: "discord", url: "https://d" })),
    ).toBeNull();
    expect(
      missingWebhookField(endpoint({ provider: "custom", url: "https://c" })),
    ).toBe("template");
  });
});

describe("webhookResponseError", () => {
  it("reads refusals that arrive with 200", () => {
    expect(
      webhookResponseError(
        "dingtalk",
        true,
        '{"errcode":310000,"errmsg":"keywords not in content"}',
      ),
    ).toBe("keywords not in content");
    expect(
      webhookResponseError(
        "feishu",
        true,
        '{"code":19024,"msg":"Key Words Not Found"}',
      ),
    ).toBe("Key Words Not Found");
    expect(
      webhookResponseError("feishu", true, '{"code":0,"msg":"success"}'),
    ).toBeNull();
    expect(webhookResponseError("discord", true, "")).toBeNull();
  });

  it("prefers the service's own explanation of a failure", () => {
    expect(
      webhookResponseError(
        "telegram",
        false,
        '{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}',
      ),
    ).toBe("Bad Request: chat not found");
    expect(webhookResponseError("generic", false, "nope")).toBe("nope");
  });
});
