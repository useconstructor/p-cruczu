import "server-only";
import { ensureSchema } from "@/lib/db";
import { failure, json, readObject, safeOrigin, serialize, validId } from "@/lib/api";
import { matches, validateExpense, type Expense } from "@/lib/expenses";
export async function getExpenses(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") || "";
    if (q.length > 320) return failure("INVALID_QUERY", "La búsqueda es demasiado larga.", 400);
    const db = await ensureSchema();
    // All derived values share one coherent read, including the unfiltered total.
    const { rows } = await db.execute("SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC, id DESC");
    const all = rows.map(serialize) as Expense[];
    return json({ data: {
      expenses: all.filter((item) => matches(item, q)),
      total_centavos: all.reduce((total, item) => total + BigInt(item.amount_centavos), 0n).toString(),
      count: all.length,
      categories: [...new Set(all.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "es")),
    } });
  } catch { return failure("READ_FAILED", "No pudimos cargar los gastos. Inténtalo de nuevo.", 500); }
}
export async function mutateExpense(request: Request, action: "create" | "edit" | "delete", id?: string) {
  if (!safeOrigin(request)) return failure("INVALID_ORIGIN", "Origen de solicitud no permitido.", 400);
  if (action !== "create" && (!id || !validId(id))) return failure("INVALID_ID", "El identificador del gasto no es válido.", 400);
  let body;
  try { body = await readObject(request); }
  catch { return failure("INVALID_JSON", "La solicitud debe contener un objeto JSON válido.", 400); }
  const checked = validateExpense(body);
  if (action !== "delete" && Object.keys(checked.fields).length)
    return failure("VALIDATION_ERROR", "Revisa los campos indicados.", 400, checked.fields);
  try {
    const db = await ensureSchema();
    const { input, centavos } = checked;
    const now = new Date().toISOString();
    const result = action === "delete"
      ? await db.execute({ sql: "DELETE FROM expenses WHERE id=? RETURNING id", args: [id!] })
      : action === "edit"
        ? await db.execute({ sql: "UPDATE expenses SET concept=?, amount_centavos=?, expense_date=?, category=?, updated_at=? WHERE id=? RETURNING *", args: [input.concept, centavos!, input.expense_date, input.category, now, id!] })
        : await db.execute({ sql: "INSERT INTO expenses (id, concept, amount_centavos, expense_date, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *", args: [crypto.randomUUID(), input.concept, centavos!, input.expense_date, input.category, now, now] });
    // SQLite adapters may report rowsAffected=0 for a RETURNING statement.
    // Each returned row is itself proof that the mutation affected that row.
    const affected = result.rowsAffected || result.rows.length;
    if (affected !== 1 || result.rows.length !== 1)
      return failure("NOT_FOUND", "Este movimiento ya no existe. Actualiza el listado para consultar los gastos actuales.", 404);
    return json({ data: serialize(result.rows[0]) }, action === "create" ? 201 : 200);
  } catch {
    return failure("WRITE_FAILED", action === "delete" ? "No pudimos eliminar el gasto. Inténtalo de nuevo." : "No pudimos guardar el gasto. Tus datos se conservan.", 500);
  }
}
