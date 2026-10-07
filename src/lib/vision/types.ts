import "server-only";

export type VisionImage = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

/** Shared request shape every vision backend must accept. */
export type VisionJsonRequest = {
  image: VisionImage;
  system: string;
  userText: string;
  /** Used by providers that name JSON schemas (e.g. OpenRouter). */
  schemaName: string;
  schema: object;
  maxTokens: number;
  abortMs: number;
};

export type VisionProviderId = "gemini" | "openrouter";

export type VisionProvider = {
  id: VisionProviderId;
  /** Model id reported in logs (provider-specific). */
  model: () => string;
  isConfigured: () => boolean;
  completeJson: (req: VisionJsonRequest) => Promise<string>;
};

export function imageMime(image: { type: string }): string {
  return image.type && image.type.startsWith("image/") ? image.type : "image/jpeg";
}

export function dataUrl(image: { type: string; bytes: Buffer }): string {
  return `data:${imageMime(image)};base64,${image.bytes.toString("base64")}`;
}

export function throwVisionTimeout(err: unknown): never {
  if (err instanceof Error && err.name === "AbortError") {
    throw Object.assign(new Error("vision_timeout"), { code: "timeout" });
  }
  throw err;
}
