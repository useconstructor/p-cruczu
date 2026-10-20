export const MAX_CENTAVOS = 9007199254740991n;
export type ExpenseInput = { concept: string; amount: string; expense_date: string; category: string };
export type Fields = Partial<Record<keyof ExpenseInput, string>>;
export type Expense = Omit<ExpenseInput, "amount"> & { id: string; amount_centavos: string; created_at: string; updated_at: string };
export type Ledger = { expenses: Expense[]; total_centavos: string; count: number; categories: string[] };
const moneyFormat = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
export function formatMoney(value: string): string {
  const cents = BigInt(value);
  return moneyFormat.formatToParts(cents / 100n).map((part) => part.type === "fraction"
    ? (cents % 100n).toString().padStart(2, "0") : part.value).join("");
}
export function amountError(value: string): string | undefined {
  if (!value) return "Introduce el importe.";
  if (/^-/.test(value)) return "El importe debe ser mayor que cero.";
  if (/^\d+[.,]\d{3,}$/.test(value)) return "Usa como máximo dos decimales.";
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value))
    return "Usa solo dígitos y una coma o punto decimal, sin separadores de miles.";
  const [whole, fraction = ""] = value.split(/[.,]/);
  const significant = whole.replace(/^0+/, "") || "0";
  if (significant.length > 14) return `El máximo es ${formatMoney(MAX_CENTAVOS.toString())}.`;
  const cents = BigInt(significant) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents === 0n) return "El importe debe ser mayor que cero.";
  if (cents > MAX_CENTAVOS) return `El máximo es ${formatMoney(MAX_CENTAVOS.toString())}.`;
}
export function parseAmount(value: string): bigint | null {
  if (amountError(value)) return null;
  const [whole, fraction = ""] = value.split(/[.,]/);
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validateExpense(body: unknown): { fields: Fields; input: ExpenseInput; centavos: bigint | null } {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const input = Object.fromEntries(["concept", "amount", "expense_date", "category"].map((key) => [key,
    typeof source[key] === "string" ? ["concept", "category"].includes(key) ? source[key].trim() : source[key] : "",
  ])) as ExpenseInput;
  const fields: Fields = {};
  if (!input.concept || [...input.concept].length > 160) fields.concept = "Escribe un concepto de 1 a 160 caracteres.";
  const problem = amountError(input.amount);
  if (problem) fields.amount = problem;
  if (!validDate(input.expense_date)) fields.expense_date = "Selecciona una fecha válida.";
  if (!input.category || [...input.category].length > 60) fields.category = "Escribe una categoría de 1 a 60 caracteres.";
  return { fields, input, centavos: parseAmount(input.amount) };
}
export function editAmount(value: string): string {
  const cents = BigInt(value);
  return `${cents / 100n},${(cents % 100n).toString().padStart(2, "0")}`;
}
export function formatDate(value: string): string {
  const parts = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).formatToParts(new Date(`${value}T12:00:00Z`));
  return ["day", "month", "year"].map((type) => parts.find((p) => p.type === type)?.value).join(" ");
}
export function matches(expense: Pick<Expense, "concept" | "category">, query: string) {
  const normalize = (text: string) => text.normalize("NFC").toLocaleLowerCase("es-CO");
  const q = normalize(query.trim());
  return [expense.concept, expense.category].some((text) => normalize(text).includes(q));
}
