import "server-only";

import {
  imageMime,
  throwVisionTimeout,
  type VisionProvider,
} from "../types";

/** `gemini-2.5-flash-lite` 404s for new Google keys; this alias is the working default. */
export const GEMINI_VISION_MODEL = "gemini-flash-lite-latest";

const GEMINI_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

function candidateText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") {
    return "";
  }
  const content = (candidates[0] as { content?: unknown }).content;
  if (!content || typeof content !== "object") return "";
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

export function createGeminiProvider(): VisionProvider {
  const model = () => process.env.GEMINI_VISION_MODEL?.trim() || GEMINI_VISION_MODEL;
  return {
    id: "gemini",
    model,
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY?.trim()),
    async completeJson(req) {
      const key = process.env.GEMINI_API_KEY?.trim();
      if (!key) throw new Error("missing_gemini_key");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), req.abortMs);
      try {
        const res = await fetch(`${GEMINI_GENERATE_URL}/${model()}:generateContent`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: req.system }],
            },
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: imageMime(req.image),
                      data: req.image.bytes.toString("base64"),
                    },
                  },
                  { text: req.userText },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: req.maxTokens,
              responseMimeType: "application/json",
              responseSchema: req.schema,
            },
          }),
        });
        const payload = (await res.json()) as {
          error?: { message?: string; status?: string };
        };
        if (!res.ok) {
          throw new Error(payload.error?.message || `gemini_${res.status}`);
        }
        const text = candidateText(payload);
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
