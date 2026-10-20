import { getExpenses, mutateExpense } from "@/lib/gastos-api";
export const dynamic = "force-dynamic";
export const GET = getExpenses;
export async function POST(request: Request) { return mutateExpense(request, "create"); }
