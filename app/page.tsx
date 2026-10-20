"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Search, X, AlertCircle, Loader2, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ExpenseForm, FormFailure } from "@/components/expense-form";
import { editAmount, formatDate, formatMoney, matches, type Expense, type ExpenseInput, type Ledger } from "@/lib/expenses";
async function write(action: "create" | "edit" | "delete", input?: ExpenseInput, id?: string): Promise<Expense> {
  const endpoint = action === "create" ? "/api/gastos" : `/api/gastos/${id}/${action === "edit" ? "editar" : "eliminar"}`;
  const response = await fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input ?? {}) });
  const result = await response.json();
  if (!response.ok) throw new FormFailure(result.error?.message || "No pudimos completar la solicitud.", result.error?.fields);
  return result.data;
}
export default function Home() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const currentQuery = useRef("");
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState({ message: "", scope: "form", confirmed: false });
  const [highlight, setHighlight] = useState("");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteLock = useRef(false);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const editTrigger = useRef<HTMLElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const defaults = useMemo(() => editing ? { concept: editing.concept, amount: editAmount(editing.amount_centavos), expense_date: editing.expense_date, category: editing.category } : undefined, [editing]);
  const refresh = useCallback(async (afterWrite = false) => {
    const requestId = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const q = currentQuery.current;
    setLoading(true);
    setReadError("");
    try {
      const response = await fetch(`/api/gastos?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "No pudimos cargar los gastos.");
      if (requestId === sequence.current) { setLedger(result.data); setAppliedQuery(q); }
    } catch (error) {
      if (requestId === sequence.current && !abort.signal.aborted) setReadError(afterWrite
        ? "El cambio ya está guardado, pero no pudimos actualizar el listado. Reintenta la consulta."
        : error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError)
          ? error.message : "No pudimos cargar los gastos. Inténtalo de nuevo.");
    } finally { if (requestId === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(timer);
  }, [query, refresh]);
  useEffect(() => () => { ++sequence.current; controller.current?.abort(); }, []);
  useEffect(() => {
    if (highlight) { const timer = setTimeout(() => setHighlight(""), 4500); return () => clearTimeout(timer); }
  }, [highlight]);
  function search(value: string) {
    ++sequence.current;
    controller.current?.abort();
    currentQuery.current = value;
    setQuery(value);
    setLoading(true);
  }
  async function save(input: ExpenseInput) {
    setNotice({ message: "", scope: "form", confirmed: false });
    const saved = await write(editing ? "edit" : "create", input, editing?.id);
    const message = editing ? "Cambios guardados." : "Gasto guardado.";
    setNotice({ message: message + (matches(saved, currentQuery.current) ? "" : " No coincide con la búsqueda actual."), scope: "form", confirmed: true });
    if (editing) { setEditing(null); setFormVersion((n) => n + 1); }
    try { (window as Window & { constructorTrack?: (event: string) => void }).constructorTrack?.(editing ? "Expense updated" : "Expense saved"); } catch { /* Analytics cannot affect a confirmed write. */ }
    await refresh(true);
    setHighlight(saved.id);
  }
  function cancelEdit() {
    setEditing(null);
    setNotice({ message: "Edición cancelada. No se guardaron cambios.", scope: "form", confirmed: false });
    requestAnimationFrame(() => {
      if (editTrigger.current?.isConnected) editTrigger.current.focus(); else listHeading.current?.focus();
    });
  }
  function restoreDeleteFocus(event: Event) {
    // Radix calls this after its focus scope unmounts. Keep the actual opener
    // across renders; a completed deletion or a hidden row uses the heading.
    event.preventDefault();
    const opener = deleteTrigger.current;
    if (opener?.isConnected && !opener.disabled && opener.getClientRects().length) {
      opener.focus();
    } else {
      listHeading.current?.focus();
    }
  }
  async function remove() {
    if (!deleting || deleteLock.current) return;
    deleteLock.current = true;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await write("delete", undefined, deleting.id);
      if (editing?.id === deleting.id) { setEditing(null); setFormVersion((n) => n + 1); }
      setNotice({ message: "Gasto eliminado.", scope: "ledger", confirmed: true });
      deleteTrigger.current = null;
      await refresh(true);
      setDeleting(null);
    } catch (error) {
      setDeleteError(error instanceof FormFailure ? error.message : "No pudimos confirmar la eliminación. Actualiza el listado antes de reintentar.");
    } finally { deleteLock.current = false; setDeleteBusy(false); }
  }
  function rowState(expense: Expense) {
    const background = highlight === expense.id ? "bg-accent" : "hover:bg-background/70";
    const gutter = editing?.id === expense.id
      ? "shadow-[inset_3px_0_0_var(--color-foreground)]"
      : highlight === expense.id ? "shadow-[inset_3px_0_0_var(--color-primary)]" : "";
    return `${background} ${gutter}`;
  }
  function editStatus(expense: Expense) {
    return editing?.id === expense.id
      ? <span data-testid="editing-label" className="mt-1 block text-[13px] font-medium text-foreground">En edición</span>
      : null;
  }
  function actions(expense: Expense) {
    return <div className="flex justify-end gap-1">
      <Button variant="ghost" disabled={formBusy || deleteBusy} className="h-11 rounded-sm px-3 text-sm text-primary" aria-label={`Editar ${expense.concept}`} onClick={(e) => {
        editTrigger.current = e.currentTarget;
        setNotice({ message: "", scope: "form", confirmed: false });
        setEditing(expense);
      }}>Editar</Button>
      <Button variant="ghost" disabled={formBusy || deleteBusy} className="h-11 rounded-sm px-3 text-sm hover:bg-destructive/5 hover:text-destructive" aria-label={`Eliminar ${expense.concept}`} onClick={(e) => {
        deleteTrigger.current = e.currentTarget; setDeleteError(""); setDeleting(expense);
      }}>Eliminar</Button>
    </div>;
  }
  const subtotal = ledger?.expenses.reduce((sum, expense) => sum + BigInt(expense.amount_centavos), 0n).toString() ?? "0";
  return <div className="min-h-screen">
    <header className="border-b bg-white">
      <div className="mx-auto flex min-h-[80px] max-w-[1248px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-sm bg-primary text-white sm:flex"><BookOpen size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.035em]">Gastos AWS API</h1>
        </div>
        <Button variant="outline" className="h-11 shrink-0 rounded-sm bg-white px-3 text-sm" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw size={16} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />Actualizar
        </Button>
      </div>
    </header>
    <main className="mx-auto max-w-[1248px] px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
      <div className="@container/book border-y bg-white">
        <section aria-label="Total registrado" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-primary/30 px-4 py-4 sm:px-6 @min-[1160px]/book:pr-(--ledger-actions-width)">
          <div><h2 className="text-sm font-medium text-primary">Total registrado</h2><p className="mt-1 text-[13px]">Incluye todos los gastos, incluso al buscar.</p></div>
          <div className="ml-auto min-w-0 max-w-full text-right">
            <p data-testid="total" className="break-all font-mono text-[32px] font-medium leading-tight tracking-[-0.045em] tabular-nums">{ledger ? ledger.total_centavos.length > 15 ? <><span className="block text-[13px] tracking-normal sm:inline sm:text-[32px]">COP{" "}</span><span className="text-[22px] sm:text-[32px]">{formatMoney(ledger.total_centavos).replace(/^COP\s+/, "")}</span></> : formatMoney(ledger.total_centavos) : loading ? <span className="inline-block h-10 w-40 animate-pulse bg-muted motion-reduce:animate-none"><span className="sr-only">Cargando total</span></span> : "—"}</p>
            {ledger && (readError || loading) && <p className="mt-1 text-[13px]">{readError ? "Pendiente de actualización" : "Actualizando…"}</p>}
          </div>
        </section>
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
          <section aria-labelledby="form-heading" className="border-b p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex items-baseline justify-between gap-2"><h2 id="form-heading" className="text-xl font-semibold tracking-tight">{editing ? "Editar gasto" : "Nuevo gasto"}</h2><span className="text-[13px]">{editing ? "En edición" : "Todos obligatorios"}</span></div>
            <ExpenseForm key={editing?.id ?? `new-${formVersion}`} defaults={defaults} categories={ledger?.categories ?? []} onSave={save} onCancel={editing ? cancelEdit : undefined} onPending={setFormBusy} />
            <div role="status" aria-live="polite" aria-atomic="true" data-testid="creation-status" className={`mt-2 flex min-h-5 items-start gap-2 text-[13px] leading-5 ${notice.confirmed ? "text-primary" : "text-foreground"}`}>
              {notice.scope === "form" && notice.message && <>{notice.confirmed && <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}<span>{notice.message}</span></>}
            </div>
          </section>
          <section aria-labelledby="list-heading" className="@container/ledger min-w-0">
            <div className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 id="list-heading" ref={listHeading} tabIndex={-1} className="text-xl font-semibold tracking-tight">Tus gastos</h2>
                <span className="text-right text-[13px]">{loading ? "Consultando…" : ledger ? `${ledger.expenses.length} de ${ledger.count} ${ledger.count === 1 ? "gasto" : "gastos"}` : "Sin datos disponibles"}</span>
              </div>
              <p className="mb-4 text-[13px]">Por fecha del gasto, más reciente primero.</p>
              <label htmlFor="search" className="mb-1.5 block text-sm font-medium">Buscar por concepto o categoría</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-5" strokeWidth={1.7} aria-hidden="true" />
                <Input id="search" placeholder="Concepto o categoría" value={query} maxLength={320} onChange={(e) => search(e.target.value)} className="h-11 rounded-sm bg-white pl-10 pr-11 text-base" />
                {query && <Button variant="ghost" className="absolute right-0 top-0 size-11 p-0" aria-label="Limpiar búsqueda" onClick={() => search("")}><X size={17} aria-hidden="true" /></Button>}
              </div>
              <div data-testid="ledger-feedback-strip" className="mt-2 grid min-h-5 content-start gap-x-3 text-[13px] leading-5 sm:grid-cols-[minmax(0,1fr)_auto] lg:@min-[820px]/ledger:mr-[calc(var(--ledger-actions-width)-1.5rem)]">
                <div role="status" aria-live="polite" aria-atomic="true" data-testid="ledger-status" className="text-primary">{notice.scope === "ledger" ? notice.message : ""}</div>
                {!!appliedQuery.trim() && ledger && <p className="flex flex-wrap justify-end gap-x-2"><span>Subtotal de resultados</span><span data-testid="subtotal" className="break-all font-mono font-medium tabular-nums">{formatMoney(subtotal)}</span></p>}
              </div>
            </div>
            <div aria-busy={loading} data-testid="ledger-content">
              {readError && <div role="alert" className="border-y bg-destructive/5 p-4 sm:px-6"><p className="flex gap-2 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{readError}</p>{ledger && <p className="mt-2 text-[13px]">Los datos anteriores están pendientes de actualización.</p>}<Button variant="outline" className="mt-3 h-11 rounded-sm bg-white" onClick={() => void refresh()}>Reintentar consulta</Button></div>}
              {!ledger && loading ? <div role="status" className="space-y-4 border-t px-4 py-6 sm:px-6"><span className="sr-only">Cargando gastos</span>{[0, 1, 2].map((i) => <div key={i} className="flex animate-pulse gap-6 motion-reduce:animate-none"><span className="h-5 flex-1 bg-muted" /><span className="h-5 w-28 bg-muted" /></div>)}</div> : ledger && <>
                <table className="hidden w-full table-fixed text-left lg:@min-[820px]/ledger:table">
                  <caption className="sr-only">Gastos ordenados por fecha descendente</caption>
                  <colgroup><col className="w-(--ledger-date-width)" /><col /><col className="w-(--ledger-category-width)" /><col className="w-(--ledger-amount-width)" /><col className="w-(--ledger-actions-width)" /></colgroup>
                  <thead className="border-y bg-background/50 text-[13px] font-medium"><tr><th scope="col" className="py-3 pl-6 font-medium">Fecha</th><th scope="col" className="px-2 py-3 font-medium">Concepto</th><th scope="col" className="px-2 py-3 font-medium">Categoría</th><th scope="col" className="py-3 text-right font-medium">Importe en COP</th><th scope="col" className="py-3 pr-6 text-right font-medium">Acciones</th></tr></thead>
                  <tbody>{ledger.expenses.map((expense) => <tr key={expense.id} data-testid="expense-row" data-expense-id={expense.id} data-saved={highlight === expense.id} data-editing={editing?.id === expense.id} className={`border-b last:border-b-0 transition-colors duration-300 motion-reduce:transition-none ${rowState(expense)}`}>
                    <td className="py-4 pl-6 align-top text-[13px]"><time dateTime={expense.expense_date}>{formatDate(expense.expense_date)}</time></td>
                    <td className="break-words px-2 py-4 align-top text-base font-medium">{expense.concept}{editStatus(expense)}</td>
                    <td className="break-words px-2 py-4 align-top text-[13px]">{expense.category}</td>
                    <td data-testid="expense-amount" className={`py-4 text-right align-top font-mono text-base font-medium tabular-nums ${highlight === expense.id ? "text-primary" : ""}`}>{expense.amount_centavos.length > 14 ? <><span className="block text-[13px] font-normal">COP{" "}</span><span className="whitespace-nowrap">{formatMoney(expense.amount_centavos).replace(/^COP\s+/, "")}</span></> : formatMoney(expense.amount_centavos)}</td>
                    <td className="py-1 pr-3 align-top">{actions(expense)}</td>
                  </tr>)}</tbody>
                </table>
                <ul aria-label="Movimientos" className="border-t lg:@min-[820px]/ledger:hidden">{ledger.expenses.map((expense) => <li key={expense.id} data-testid="expense-row" data-expense-id={expense.id} data-saved={highlight === expense.id} data-editing={editing?.id === expense.id} className={`border-b px-4 py-4 last:border-b-0 transition-colors duration-300 motion-reduce:transition-none sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-6 sm:px-6 ${rowState(expense)}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:contents"><p className="text-[13px]"><span className="sr-only">Fecha: </span><time dateTime={expense.expense_date}>{formatDate(expense.expense_date)}</time></p>
                  <p data-testid="expense-amount" className={`ml-auto min-w-0 max-w-full break-all text-right font-mono text-base font-medium tabular-nums ${highlight === expense.id ? "text-primary" : ""}`}>{formatMoney(expense.amount_centavos)}</p></div>
                  <h3 className="col-span-2 mt-2 min-w-0 break-words text-base font-medium sm:col-span-1 sm:col-start-1">{expense.concept}{editStatus(expense)}</h3>
                  <p className="col-span-2 mt-1 min-w-0 break-words text-[13px] sm:col-span-1 sm:col-start-1">Categoría: {expense.category}</p>
                  <div className="col-span-2 mt-1 sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-2 sm:self-end">{actions(expense)}</div>
                </li>)}</ul>
                {!ledger.expenses.length && <div className="min-h-[180px] px-4 py-8 sm:px-6"><BookOpen className="mb-3 size-6 text-primary" strokeWidth={1.4} aria-hidden="true" /><h3 className="text-base font-medium">{appliedQuery.trim() ? "No encontramos gastos" : "Aún no has registrado gastos"}</h3><p className="mt-2 text-sm leading-6">{appliedQuery.trim() ? "Prueba con otro concepto o categoría." : "Registra tu primer gasto. Cada movimiento cuenta."}</p>{appliedQuery.trim() && <Button variant="link" className="mt-2 h-11 px-0" onClick={() => search("")}>Limpiar búsqueda</Button>}</div>}
              </>}
            </div>
          </section>
        </div>
      </div>
    </main>
    <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !deleteLock.current) setDeleting(null); }}>
      <AlertDialogContent onEscapeKeyDown={(e) => { if (deleteLock.current) e.preventDefault(); }} onCloseAutoFocus={restoreDeleteFocus}>
        <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
        <AlertDialogDescription>Se eliminará del registro y del total. Esta acción no se puede deshacer.</AlertDialogDescription>
        {deleting && <div data-testid="delete-summary" className="my-6 grid grid-cols-1 gap-x-6 gap-y-2 border-y py-4 min-[480px]:flex min-[480px]:flex-wrap min-[480px]:items-baseline min-[480px]:justify-between"><p data-testid="delete-concept" className="min-w-0 max-w-full flex-[1_1_140px] break-words font-medium">{deleting.concept}</p><p data-testid="delete-amount" className="ml-auto max-w-full break-words text-right font-mono text-base font-medium tabular-nums">{formatMoney(deleting.amount_centavos)}</p></div>}
        {deleteError && <div role="alert" className="mb-4"><p className="text-sm text-destructive">{deleteError}</p><Button variant="link" className="mt-1 h-11 px-0" onClick={() => void refresh()}>Actualizar listado</Button></div>}
        <div className="flex justify-end gap-2"><AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteBusy} onClick={(e) => { e.preventDefault(); void remove(); }}>{deleteBusy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{deleteBusy ? "Eliminando…" : "Eliminar gasto"}</AlertDialogAction></div>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
