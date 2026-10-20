import "server-only";
import type { Row } from "@libsql/client";
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function failure(code: string, message: string, status: number, fields?: unknown) {
  return json({ error: { code, message, ...(fields ? { fields } : {}) } }, status);
}
export function safeOrigin(request: Request) {
  // Server-controlled settings only: never trust Host or forwarded request headers.
  const configured = [process.env.APP_ORIGIN,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ].filter((value): value is string => !!value);
  const allowed = configured.length ? configured : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3100", "http://127.0.0.1:3100"];
  const origin = request.headers.get("origin");
  return !!origin && allowed.some((value) => {
    try { return new URL(value).origin === origin; } catch { return false; }
  });
}
export const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export async function readObject(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) throw new Error("Invalid content type");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) { await reader.cancel(); throw new Error("Body too large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid object");
  return body as Record<string, unknown>;
}
export function serialize(row: Row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]));
}
