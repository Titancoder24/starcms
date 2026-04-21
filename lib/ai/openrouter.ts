import { db } from "@/lib/db/client";
import { aiKeys } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { decryptApiKey } from "./encrypt";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type ChatResult = {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
};

async function resolveApiKey(userId: string, siteId: string): Promise<string> {
  // Try stored encrypted key first
  const rows = await db
    .select()
    .from(aiKeys)
    .where(
      and(
        eq(aiKeys.userId, userId),
        eq(aiKeys.siteId, siteId),
        eq(aiKeys.provider, "openrouter"),
        isNull(aiKeys.revokedAt)
      )
    )
    .limit(1);

  if (rows[0]) {
    return decryptApiKey(
      rows[0].ciphertext,
      rows[0].iv,
      rows[0].authTag,
      userId
    );
  }

  // Fall back to env
  const envKey = process.env["OPENROUTER_API_KEY"];
  if (envKey) return envKey;

  throw new Error(
    "No OpenRouter API key configured. Add one in Settings → AI."
  );
}

export async function chat(
  userId: string,
  siteId: string,
  opts: ChatOptions
): Promise<ChatResult> {
  const apiKey = await resolveApiKey(userId, siteId);
  const model = opts.model ?? "anthropic/claude-3-5-haiku";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://starcms.dev",
      "X-Title": "StarCMS",
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message.content ?? "",
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
    },
  };
}
