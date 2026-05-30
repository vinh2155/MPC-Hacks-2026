import { DatabaseSync } from 'node:sqlite';
import * as XLSX from 'xlsx';
import * as path from 'path';

const DATA_PATH = path.resolve(__dirname, '../../../data/transactions.xlsx');

export const db = new DatabaseSync(':memory:');

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    transaction_code       INTEGER,
    transaction_description TEXT,
    transaction_category   INTEGER,
    posting_date           TEXT,
    transaction_date       TEXT,
    merchant_name          TEXT,
    amount                 REAL,
    debit_or_credit        TEXT,
    merchant_category_code INTEGER,
    merchant_city          TEXT,
    merchant_country       TEXT,
    merchant_postal_code   TEXT,
    merchant_state         TEXT,
    conversion_rate        REAL,
    employee_name          TEXT,
    category_label         TEXT
  );

  CREATE TABLE IF NOT EXISTS requests (
    id               TEXT PRIMARY KEY,
    employee_name    TEXT NOT NULL,
    item_description TEXT NOT NULL,
    amount           REAL NOT NULL,
    category         TEXT,
    reason           TEXT,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    created_at       TEXT NOT NULL
  );
`);

function excelDateToISO(serial: unknown): string | null {
  if (serial == null || serial === 0) return null;
  if (typeof serial !== 'number' || !isFinite(serial)) return null;
  return new Date((serial - 25569) * 86400 * 1000).toISOString().split('T')[0];
}

const wb = XLSX.readFile(DATA_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

const stmt = db.prepare(`
  INSERT INTO transactions (
    transaction_code, transaction_description, transaction_category,
    posting_date, transaction_date, merchant_name, amount, debit_or_credit,
    merchant_category_code, merchant_city, merchant_country,
    merchant_postal_code, merchant_state, conversion_rate,
    employee_name, category_label
  ) VALUES (
    :transaction_code, :transaction_description, :transaction_category,
    :posting_date, :transaction_date, :merchant_name, :amount, :debit_or_credit,
    :merchant_category_code, :merchant_city, :merchant_country,
    :merchant_postal_code, :merchant_state, :conversion_rate,
    :employee_name, :category_label
  )
`);

db.exec('BEGIN');
try {
  for (const row of rows) {
    stmt.run({
      transaction_code:        row['Transaction Code'] as number ?? null,
      transaction_description: row['Transaction Description'] as string ?? null,
      transaction_category:    row['Transaction Category'] as number ?? null,
      posting_date:            excelDateToISO(row['Posting date of transaction']),
      transaction_date:        excelDateToISO(row['Transaction Date']),
      merchant_name:           row['Merchant Info DBA Name'] as string ?? null,
      amount:                  row['Transaction Amount'] as number ?? null,
      debit_or_credit:         (typeof row['Debit or Credit'] === 'string' ? row['Debit or Credit'].toLowerCase() : null) || null,
      merchant_category_code:  row['Merchant Category Code'] as number ?? null,
      merchant_city:           row['Merchant City'] as string ?? null,
      merchant_country:        row['Merchant Country'] as string ?? null,
      merchant_postal_code:    row['Merchant Postal Code'] as string ?? null,
      merchant_state:          row['Merchant State/Province'] as string ?? null,
      conversion_rate:         row['Conversion Rate'] as number ?? null,
      employee_name:           row['employee_name'] as string ?? null,
      category_label:          row['category_label'] as string ?? null,
    });
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

console.log(`Loaded ${rows.length} transactions into SQLite`);
