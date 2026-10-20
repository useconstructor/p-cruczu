import { mutateExpense } from "@/lib/gastos-api";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return mutateExpense(request, "edit", (await context.params).id);
}
export async function DELETE(request: Request, context: Context) {
  // Older callers sent no JSON on DELETE. Keep their contract while retaining
  // the same origin and UUID checks as the current POST endpoint.
  const normalized = new Request(request.url, { method: "POST", headers: request.headers, body: "{}" });
  normalized.headers.set("content-type", "application/json");
  return mutateExpense(normalized, "delete", (await context.params).id);
}
