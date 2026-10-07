import "server-only";

import {
  dataUrl,
  throwVisionTimeout,
  type VisionJsonRequest,
  type VisionProvider,
} from "../types";
import { CLASSIFY_SCHEMA_STRICT, RECEIPT_SCHEMA_STRICT } from "../prompts";

export const OPENROUTER_VISION_MODEL = "google/gemini-2.5-flash";

function contentText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as { content?: unknown };
  const content = msg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function openRouterSchema(req: VisionJsonRequest): object {
  if (req.schemaName === "receipt_classify") return CLASSIFY_SCHEMA_STRICT;
  if (req.schemaName === "receipt_parse") return RECEIPT_SCHEMA_STRICT;
  return req.schema;
}

export function createOpenRouterProvider(): VisionProvider {
  const model = () => process.env.OPENROUTER_VISION_MODEL?.trim() || OPENROUTER_VISION_MODEL;
  return {
    id: "openrouter",
    model,
    isConfigured: () => Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    async completeJson(req) {
      const key = process.env.OPENROUTER_API_KEY?.trim();
      if (!key) throw new Error("missing_openrouter_key");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), req.abortMs);
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://127.0.0.1:43147",
            "X-Title": "Split the Wine",
          },
          body: JSON.stringify({
            model: model(),
            temperature: 0,
            max_tokens: req.maxTokens,
            messages: [
              { role: "system", content: req.system },
              {
                role: "user",
                content: [
                  { type: "text", text: req.userText },
                  { type: "image_url", image_url: { url: dataUrl(req.image) } },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: req.schemaName,
                strict: true,
                schema: openRouterSchema(req),
              },
            },
            provider: { require_parameters: true },
          }),
        });
        const payload = (await res.json()) as {
          error?: { message?: string };
          choices?: { message?: unknown }[];
        };
        if (!res.ok) {
          throw new Error(payload.error?.message || `openrouter_${res.status}`);
        }
        const text = contentText(payload.choices?.[0]?.message);
        if (!text.trim()) throw new Error("empty_model_response");
        return text;
      } catch (err) {
        throwVisionTimeout(err);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
