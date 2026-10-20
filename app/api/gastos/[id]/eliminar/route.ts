import { mutateExpense } from "@/lib/gastos-api";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutateExpense(request, "delete", (await context.params).id);
}
