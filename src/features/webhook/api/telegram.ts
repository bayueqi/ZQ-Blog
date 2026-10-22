export interface TelegramChat {
  id: string;
  name: string;
  type: string;
}

interface TelegramChatObject {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/** The chat each kind of update happened in. */
const CHAT_UPDATES = [
  "message",
  "edited_message",
  "channel_post",
  "my_chat_member",
] as const;

function nameOf(chat: TelegramChatObject) {
  return (
    chat.title ||
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
    (chat.username ? `@${chat.username}` : String(chat.id))
  );
}

/**
 * The chats a bot has recently heard from, newest first. Telegram keeps
 * updates for 24 hours, and none at all while the bot has a webhook set.
 */
export async function listTelegramChats(
  token: string,
): Promise<Array<TelegramChat>> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100`,
    { signal: AbortSignal.timeout(10_000) },
  );
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: Array<Record<string, { chat?: TelegramChatObject } | undefined>>;
  } | null;
  if (!body?.ok) {
    throw new Error(
      body?.description ?? `${response.status} ${response.statusText}`,
    );
  }

  const chats = new Map<string, TelegramChat>();
  for (const update of [...(body.result ?? [])].reverse()) {
    for (const kind of CHAT_UPDATES) {
      const chat = update[kind]?.chat;
      if (chat && !chats.has(String(chat.id))) {
        chats.set(String(chat.id), {
          id: String(chat.id),
          name: nameOf(chat),
          type: chat.type,
        });
      }
    }
  }
  return [...chats.values()];
}
