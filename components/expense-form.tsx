"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Loader2, Check, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  validateExpense,
  formatDate,
  localToday,
  type ExpenseInput,
  type Fields,
} from "@/lib/expenses";
export class FormFailure extends Error {
  constructor(
    message: string,
    public fields: Fields = {},
  ) {
    super(message);
  }
}
function initial(): ExpenseInput {
  return {
    concept: "",
    amount: "",
    expense_date: localToday(),
    category: "",
  };
}
export function ExpenseForm({
  defaults,
  categories,
  onSave,
  onCancel,
  onPending,
}: {
  defaults?: ExpenseInput;
  categories: string[];
  onSave: (input: ExpenseInput) => Promise<void>;
  onCancel?: () => void;
  onPending?: (busy: boolean) => void;
}) {
  const [values, setValues] = useState<ExpenseInput>(defaults ?? { concept: "", amount: "", expense_date: "", category: "" });
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const prefix = defaults ? "edit" : "new";
  useEffect(() => {
    if (defaults) {
      form.current?.querySelector<HTMLInputElement>('[name="concept"]')?.focus();
    } else {
      // Browser-local calendar date, initialized only after hydration.
      queueMicrotask(() => setValues((current) => ({ ...current, expense_date: localToday() })));
    }
  }, [defaults]);
  function focusInvalid(errors: Fields) {
    const key = Object.keys(errors)[0];
    form.current?.querySelector<HTMLInputElement>(`[name="${key}"]`)?.focus();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const checked = validateExpense(values);
    setFields(checked.fields);
    setError("");
    if (Object.keys(checked.fields).length) {
      focusInvalid(checked.fields);
      return;
    }
    lock.current = true;
    setBusy(true);
    onPending?.(true);
    try {
      await onSave(checked.input);
      if (!defaults) {
        setValues(initial());
        setFields({});
      }
    } catch (e) {
      const problem =
        e instanceof FormFailure
          ? e
          : new FormFailure(
              "No pudimos confirmar el guardado. Consulta el registro antes de volver a intentarlo.",
            );
      setError(problem.message);
      setFields(problem.fields);
      focusInvalid(problem.fields);
    } finally {
      lock.current = false;
      setBusy(false);
      onPending?.(false);
    }
  }
  function field(
    key: keyof ExpenseInput,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) {
    return (
      <div className={`min-w-0 space-y-1.5 ${key === "concept" ? "sm:max-lg:col-span-2" : ""}`}>
        <label
          className="block text-sm font-medium"
          htmlFor={`${prefix}-${key}`}
        >
          {label}
        </label>
        <div className={key === "expense_date" ? "relative" : ""}>
        <Input
          {...props}
          id={`${prefix}-${key}`}
          name={key}
          value={
            key === "expense_date" && /^\d{4}-\d{2}-\d{2}$/.test(values[key])
              ? values[key].split("-").reverse().join("/")
              : values[key]
          }
          onChange={(event) => {
            const entered = event.target.value;
            const value =
              key === "expense_date" && /^\d{2}\/\d{2}\/\d{4}$/.test(entered)
                ? entered.split("/").reverse().join("-")
                : entered;
            setValues({ ...values, [key]: value });
            setFields((old) => ({ ...old, [key]: undefined }));
          }}
          aria-invalid={!!fields[key]}
          aria-describedby={`${prefix}-${key}-help`}
          disabled={busy}
          className={`h-11 rounded-sm bg-white text-base shadow-none aria-invalid:border-destructive ${key === "amount" ? "text-right font-mono tabular-nums" : ""} ${key === "expense_date" ? "pr-12 tabular-nums" : ""}`}
        />
        {key === "expense_date" && (
          <span className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-sm focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
            <CalendarDays className="size-5" strokeWidth={1.7} aria-hidden="true" />
            <input
              type="date"
              id={`${prefix}-expense_date-calendar`}
              aria-label="Elegir fecha en calendario"
              aria-describedby={`${prefix}-expense_date-help`}
              value={/^\d{4}-\d{2}-\d{2}$/.test(values.expense_date) ? values.expense_date : ""}
              min="0001-01-01"
              max="9999-12-31"
              disabled={busy}
              onChange={(event) => {
                setValues({ ...values, expense_date: event.target.value });
                setFields((old) => ({ ...old, expense_date: undefined }));
              }}
              className="absolute inset-0 h-11 w-11 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
          </span>
        )}
        </div>
        <div id={`${prefix}-${key}-help`} className={key === "amount" ? "lg:min-h-10" : undefined}>
          {fields[key] ? (
            <p className="text-[13px] leading-5 text-destructive">{fields[key]}</p>
          ) : key === "amount" ? (
            <p className="text-[13px] leading-5">
              <span>Sin separadores de miles. </span>
              <span className="whitespace-nowrap">Ej.: 1250,50 o 1250.50</span>
            </p>
          ) : key === "expense_date" &&
            /^\d{4}-\d{2}-\d{2}$/.test(values.expense_date) &&
            !validateExpense(values).fields.expense_date ? (
            <p className="sr-only">
              Fecha seleccionada:{" "}
              <time dateTime={values.expense_date}>
                {formatDate(values.expense_date)}
              </time>
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <form ref={form} aria-label={defaults ? "Editar gasto" : "Nuevo gasto"} noValidate onSubmit={submit} className="grid grid-cols-1 gap-3 sm:gap-4 sm:max-lg:grid-cols-2">
      {field("concept", "Concepto", {
        maxLength: 160,
        placeholder: "¿En qué gastaste?",
        autoComplete: "off",
        required: true,
      })}
      {field("amount", "Importe en COP", {
        inputMode: "decimal",
        placeholder: "0,00",
        autoComplete: "off",
        required: true,
      })}
      {field("expense_date", "Fecha", {
        type: "text",
        lang: "es-CO",
        placeholder: "DD/MM/AAAA",
        inputMode: "numeric",
        autoComplete: "off",
        maxLength: 10,
        required: true,
      })}
      {field("category", "Categoría", {
        maxLength: 60,
        placeholder: "Escribe o elige",
        list: `${prefix}-categories`,
        autoComplete: "off",
        required: true,
      })}
      <datalist id={`${prefix}-categories`}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:max-lg:col-span-2">
          {error}
        </p>
      )}
      <div className={`sm:max-lg:self-start sm:max-lg:pt-[26px] ${onCancel ? "flex flex-wrap justify-end gap-2 pt-1" : "pt-1"}`}>
        {onCancel && (
          <Button
            variant="outline"
            className="h-11 rounded-sm"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={busy}
          className={`h-11 rounded-sm text-sm ${!onCancel ? "w-full" : ""}`}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : defaults ? (
            <Check className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {busy ? "Guardando…" : defaults ? "Guardar cambios" : "Guardar gasto"}
        </Button>
      </div>
    </form>
  );
}
