CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) = 36),
  concept TEXT NOT NULL CHECK(length(trim(concept)) BETWEEN 1 AND 160),
  amount_centavos INTEGER NOT NULL CHECK(typeof(amount_centavos) = 'integer' AND amount_centavos > 0 AND amount_centavos <= 9007199254740991),
  expense_date TEXT NOT NULL CHECK(length(expense_date) = 10 AND expense_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(expense_date, 1, 4) BETWEEN '0001' AND '9999' AND date(expense_date, '+0 days') IS NOT NULL AND date(expense_date, '+0 days') = expense_date),
  category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
  created_at TEXT NOT NULL CHECK(length(created_at) = 24),
  updated_at TEXT NOT NULL CHECK(length(updated_at) = 24)
);
CREATE INDEX IF NOT EXISTS expenses_date_created ON expenses(expense_date DESC, created_at DESC, id DESC);
