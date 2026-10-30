const SUMMARY_MODEL = "@cf/zai-org/glm-4.7-flash";

/**
 * GLM-4.7-Flash 是带推理的模型，思考过程也占 token。上限给低了会被 reasoning
 * 全部吃满，最终 `content` 返回空串，前端看起来就是「点了没反应」。
 */
const SUMMARY_MAX_TOKENS = 2048;

/** Chat Completions 与纯文本模型返回的字段不一样，这里统一取正文。 */
function extractText(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const record = output as {
    response?: unknown;
    choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
  };
  if (typeof record.response === "string") return record.response;
  const choice = record.choices?.[0];
  if (typeof choice?.message?.content === "string") {
    return choice.message.content;
  }
  return typeof choice?.text === "string" ? choice.text : "";
}

export async function summarizeText(context: { env: Env }, text: string) {
  const output = await context.env.AI.run(SUMMARY_MODEL, {
    messages: [
      {
        role: "system",
        content: `你是一个专业的内容摘要生成助手。
请遵循以下规则：
1. **语言一致**：摘要语言必须与正文的主要语言保持一致；正文混用多种语言时，优先使用占比最高的叙述语言，不要翻译成另一种语言。
2. **长度限制**：控制在 200 字以内。
3. **内容要求**：直接输出摘要内容，不要包含"摘要："、"Summary:"、"本文讲了"等前缀或废话，保留核心观点。`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0.3,
    max_tokens: SUMMARY_MAX_TOKENS,
  });

  return { summary: extractText(output).trim() };
}
