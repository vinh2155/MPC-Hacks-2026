import { Router } from 'express';
import { db } from '../db';
import { getLastScanViolations } from './compliance';

const router = Router();

interface TxnRow {
  transaction_code: number | null;
  posting_date: string | null;
  transaction_date: string | null;
  merchant_name: string | null;
  amount: number | null;
  debit_or_credit: string | null;
  category_label: string | null;
  employee_name: string | null;
  transaction_description: string | null;
  merchant_city: string | null;
  merchant_state: string | null;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

const ALLOWED_SORT_COLS = new Set([
  'posting_date',
  'amount',
  'employee_name',
  'merchant_name',
]);

const categoriesStmt = db.prepare(
  `SELECT DISTINCT category_label FROM transactions WHERE category_label IS NOT NULL ORDER BY category_label`,
);

const maxDateStmt = db.prepare(`SELECT MAX(posting_date) AS max_date FROM transactions`);

const PRESET_DAYS: Record<string, number | null> = {
  last_day: 1,
  last_month: 30,
  last_3months: 90,
  last_6months: 180,
  last_year: 365,
  all_time: null,
};

function presetToSinceDate(preset: string): string | null {
  const days = PRESET_DAYS[preset];
  if (days === null || days === undefined) return null;
  const row = maxDateStmt.get({}) as unknown as { max_date: string | null };
  if (!row.max_date) return null;
  const d = new Date(row.max_date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

router.get('/categories', (_req, res) => {
  const rows = categoriesStmt.all({}) as unknown as { category_label: string }[];
  res.json(rows.map(r => r.category_label));
});

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10) || 25));
  const search = String(req.query.search ?? '').trim();
  const employee = String(req.query.employee ?? '').trim();
  const category = String(req.query.category ?? '').trim();
  const preset = String(req.query.preset ?? 'all_time');
  const sinceDate = presetToSinceDate(preset);
  const debitOnly = req.query.debitOnly === 'true';
  const violationsOnly = req.query.violationsOnly === 'true';
  const sortBy = String(req.query.sortBy ?? 'posting_date');
  const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';

  // Build violation map from last scan
  const violations = getLastScanViolations();
  const violationMap = new Map<number, { severity: string; violation_type: string; policy_rule_cited: string; reasoning: string }>();
  for (const v of violations) {
    if (v.transaction_code !== null) {
      const existing = violationMap.get(v.transaction_code);
      // Keep highest severity if multiple violations on same txn
      if (!existing || (SEVERITY_ORDER[v.severity] ?? 0) > (SEVERITY_ORDER[existing.severity] ?? 0)) {
        violationMap.set(v.transaction_code, {
          severity: v.severity,
          violation_type: v.violation_type,
          policy_rule_cited: v.policy_rule_cited,
          reasoning: v.reasoning,
        });
      }
    }
  }

  // Build WHERE clauses
  const conditions: string[] = [];
  const params: Record<string, string | number> = {};

  if (debitOnly) {
    conditions.push(`debit_or_credit = 'debit'`);
  }
  if (employee) {
    conditions.push(`employee_name = :employee`);
    params.employee = employee;
  }
  if (category) {
    conditions.push(`category_label = :category`);
    params.category = category;
  }
  if (sinceDate) {
    conditions.push(`posting_date >= :sinceDate`);
    params.sinceDate = sinceDate;
  }
  if (search) {
    conditions.push(`(merchant_name LIKE :search OR transaction_description LIKE :search OR employee_name LIKE :search)`);
    params.search = `%${search}%`;
  }
  if (violationsOnly && violationMap.size > 0) {
    const codes = [...violationMap.keys()].join(',');
    conditions.push(`transaction_code IN (${codes})`);
  } else if (violationsOnly && violationMap.size === 0) {
    // No violations scanned yet — return empty
    res.json({ transactions: [], total: 0, page, pageSize, pageCount: 0 });
    return;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countSql = `SELECT COUNT(*) AS cnt FROM transactions ${where}`;
  const countRow = db.prepare(countSql).get(params) as unknown as { cnt: number };
  const total = countRow.cnt;

  // Fetch page (skip severity sort in SQL — done in JS after join)
  const useSqlSort = ALLOWED_SORT_COLS.has(sortBy);
  const orderClause = useSqlSort ? `ORDER BY ${sortBy} ${sortDir}` : `ORDER BY posting_date DESC`;

  let rows: TxnRow[];

  if (sortBy === 'severity') {
    // Fetch all matching rows, join violations, sort in memory, then slice
    const allSql = `
      SELECT transaction_code, posting_date, transaction_date, merchant_name, amount,
             debit_or_credit, category_label, employee_name, transaction_description,
             merchant_city, merchant_state
      FROM transactions
      ${where}
      ORDER BY posting_date DESC
    `;
    const allRows = db.prepare(allSql).all(params) as unknown as TxnRow[];
    const withViolations = allRows.map(r => ({
      ...r,
      violation: r.transaction_code !== null ? (violationMap.get(r.transaction_code) ?? null) : null,
    }));
    withViolations.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.violation?.severity ?? 'none'] ?? 0;
      const sb = SEVERITY_ORDER[b.violation?.severity ?? 'none'] ?? 0;
      return sortDir === 'DESC' ? sb - sa : sa - sb;
    });
    const sliced = withViolations.slice((page - 1) * pageSize, page * pageSize);
    res.json({
      transactions: sliced,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
    return;
  }

  const dataSql = `
    SELECT transaction_code, posting_date, transaction_date, merchant_name, amount,
           debit_or_credit, category_label, employee_name, transaction_description,
           merchant_city, merchant_state
    FROM transactions
    ${where}
    ${orderClause}
    LIMIT :limit OFFSET :offset
  `;
  rows = db.prepare(dataSql).all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as unknown as TxnRow[];

  const withViolations = rows.map(r => ({
    ...r,
    violation: r.transaction_code !== null ? (violationMap.get(r.transaction_code) ?? null) : null,
  }));

  res.json({
    transactions: withViolations,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  });
});

export default router;
