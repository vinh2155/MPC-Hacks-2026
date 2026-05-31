import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { askClaude, type ClaudeError } from '../lib/claude';
import { loadPolicyRules, loadPolicyLimits } from './policy';

const router = Router();

// ── Zod schemas ────────────────────────────────────────────────────────────────

const ViolationSchema = z.object({
  transaction_code: z.number().nullable(),
  employee_name: z.string(),
  violation_type: z.string(),
  policy_rule_cited: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  reasoning: z.string(),
  is_repeat_offender: z.boolean(),
  related_transactions: z.array(z.object({
    transaction_code: z.number().nullable(),
    amount: z.number(),
    date: z.string(),
    merchant: z.string(),
  })).optional(),
});
const BatchResponseSchema = z.object({ violations: z.array(ViolationSchema) });
type Violation = z.infer<typeof ViolationSchema>;

// ── Types ──────────────────────────────────────────────────────────────────────

interface TxnRow {
  transaction_code: number | null;
  posting_date: string | null;
  merchant_name: string | null;
  amount: number | null;
  category_label: string | null;
  employee_name: string | null;
  transaction_description: string | null;
}

interface EmpCtxRow {
  category_label: string | null;
  total: number;
  cnt: number;
}

interface PreauthRow {
  transaction_code: number | null;
  employee_name: string | null;
  merchant_name: string | null;
  amount: number | null;
  posting_date: string | null;
  category_label: string | null;
}

interface SplitChargeRow {
  code1: number | null;
  code2: number | null;
  employee_name: string | null;
  merchant_name: string | null;
  amount1: number | null;
  amount2: number | null;
  date1: string | null;
  date2: string | null;
}

// ── Prepared statements (compiled once at startup) ─────────────────────────────

// Explicit MAX query avoids relying on sort-order assumptions
const maxDateStmt = db.prepare(`
  SELECT MAX(posting_date) AS max_date
  FROM transactions
  WHERE debit_or_credit = 'debit'
`);

// Scoped to the 30-day window computed at scan time
const allDebitsStmt = db.prepare(`
  SELECT transaction_code, posting_date, merchant_name, amount, category_label,
         employee_name, transaction_description
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND posting_date >= :since_date
  ORDER BY posting_date DESC
`);

const employeeContextStmt = db.prepare(`
  SELECT category_label, SUM(amount) AS total, COUNT(*) AS cnt
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND employee_name = :employee_name
    AND posting_date >= :since_date
  GROUP BY category_label
`);

const preauthStmt = db.prepare(`
  SELECT transaction_code, employee_name, merchant_name, amount, posting_date, category_label
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND amount > :threshold
    AND posting_date >= :since_date
`);

const splitChargeStmt = db.prepare(`
  SELECT t1.transaction_code AS code1,
         t2.transaction_code AS code2,
         t1.employee_name,
         t1.merchant_name,
         t1.amount AS amount1,
         t2.amount AS amount2,
         t1.posting_date AS date1,
         t2.posting_date AS date2
  FROM transactions t1
  JOIN transactions t2
    ON t1.employee_name = t2.employee_name
   AND t1.merchant_name = t2.merchant_name
   AND t1.transaction_code < t2.transaction_code
   AND ABS(julianday(t2.posting_date) - julianday(t1.posting_date)) <= :window_days
   AND t2.amount BETWEEN t1.amount * 0.9 AND t1.amount * 1.1
  WHERE t1.debit_or_credit = 'debit'
    AND t2.debit_or_credit = 'debit'
    AND t1.posting_date >= :since_date
    AND t2.posting_date >= :since_date
`);

// ── Module-level scan cache ────────────────────────────────────────────────────

let lastScanViolations: Violation[] = [];
let lastScanTxnCount = 0;
let scanInProgress = false;

// ── Constants ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 15;
const MAX_CONCURRENT = 1;
const BATCH_DELAY_MS = 2_000; // pause between batches to stay under 30k TPM rate limit

// Rule 1 (>$50 pre-authorization) and split-charge detection are handled by SQL — not Claude.

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getLastScanViolations(): Violation[] {
  return lastScanViolations;
}

function buildPrompt(
  batch: TxnRow[],
  employeeContext: Record<string, EmpCtxRow[]>,
): string {
  const batchEmployees = [...new Set(batch.map(t => t.employee_name).filter((e): e is string => e !== null))];

  const contextLines = batchEmployees.map(emp => {
    const ctx = employeeContext[emp] ?? [];
    if (ctx.length === 0) return `${emp}: no spend history in last 30 days`;
    const rows = ctx
      .map(r => `  ${r.category_label ?? 'Unknown'}: $${(r.total ?? 0).toFixed(2)} (${r.cnt} txns)`)
      .join('\n');
    return `${emp} — last 30 days:\n${rows}`;
  }).join('\n\n');

  const txnJson = JSON.stringify(
    batch.map(t => ({
      transaction_code: t.transaction_code,
      date: t.posting_date,
      merchant: t.merchant_name,
      amount: t.amount,
      category: t.category_label,
      employee: t.employee_name,
      description: t.transaction_description,
    })),
    null,
    2,
  );

  const rules = loadPolicyRules();
  const limits = loadPolicyLimits();
  const rulesText = rules.length > 0
    ? 'COMPANY EXPENSE POLICY RULES:\n' + rules.map((r, i) => `${i + 1}. ${r.name}: ${r.rule}`).join('\n')
    : 'COMPANY EXPENSE POLICY RULES: (none defined)';
  const limitsText = `CONFIGURED LIMITS:\n- Pre-authorization threshold: $${limits.preauthThreshold}\n- Max tip (services): ${limits.tipMaxServices}%\n- Max tip (meals): ${limits.tipMaxMeals}%`;

  return `${rulesText}

${limitsText}

EMPLOYEE SPEND CONTEXT (last 30 days by category):
${contextLines}

TRANSACTIONS TO ANALYZE:
${txnJson}

Analyze each transaction for policy violations. Return ONLY transactions that violate a policy rule — omit compliant ones.
Return JSON: { "violations": [ { "transaction_code": number|null, "employee_name": string, "violation_type": string, "policy_rule_cited": string, "severity": "critical"|"high"|"medium"|"low", "reasoning": string, "is_repeat_offender": false } ] }
Note: always set is_repeat_offender to false — it is computed server-side after all batches are merged.`;
}

async function processBatch(
  batch: TxnRow[],
  employeeContext: Record<string, EmpCtxRow[]>,
): Promise<Violation[]> {
  try {
    const result = await askClaude(
      buildPrompt(batch, employeeContext),
      BatchResponseSchema,
    );
    return result.violations;
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'raw' in err) {
      console.error('Claude parse error, skipping batch:', (err as ClaudeError).error);
    } else {
      console.error('Batch failed, skipping:', err);
    }
    return [];
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

router.post('/scan', async (_req, res, next) => {
  if (scanInProgress) {
    res.status(409).json({ error: 'A scan is already in progress' });
    return;
  }
  scanInProgress = true;

  try {
    // Step 1 — Context gathering

    // Use explicit MAX aggregation rather than relying on sort order
    const maxDateRow = maxDateStmt.get({}) as unknown as { max_date: string | null };
    if (maxDateRow.max_date === null) {
      lastScanTxnCount = 0;
      lastScanViolations = [];
      res.json({ violations: [] });
      return;
    }
    const maxDate = maxDateRow.max_date;
    const maxDateObj = new Date(maxDate + 'T00:00:00Z');
    maxDateObj.setUTCDate(maxDateObj.getUTCDate() - 30);
    const sinceDate = maxDateObj.toISOString().split('T')[0];

    // Fetch the full 30-day window (used for SQL-based checks and employee context)
    const allTxns = allDebitsStmt.all({ since_date: sinceDate }) as unknown as TxnRow[];

    // For Claude analysis only use the most recent 3 days to stay within rate limits
    const claudeWindowObj = new Date(maxDate + 'T00:00:00Z');
    claudeWindowObj.setUTCDate(claudeWindowObj.getUTCDate() - 3);
    const claudeSinceDate = claudeWindowObj.toISOString().split('T')[0];
    const claudeTxns = allTxns.filter(t => t.posting_date !== null && t.posting_date >= claudeSinceDate);

    const uniqueEmployees = [
      ...new Set(allTxns.map(t => t.employee_name).filter((e): e is string => e !== null)),
    ];
    const employeeContext: Record<string, EmpCtxRow[]> = {};
    for (const emp of uniqueEmployees) {
      employeeContext[emp] = employeeContextStmt.all({
        employee_name: emp,
        since_date: sinceDate,
      }) as unknown as EmpCtxRow[];
    }

    // Step 2 — SQL-based rule checks (no Claude)
    const limits = loadPolicyLimits();
    const allViolations: Violation[] = [];

    const preauthRows = preauthStmt.all({ since_date: sinceDate, threshold: limits.preauthThreshold }) as unknown as PreauthRow[];
    for (const row of preauthRows) {
      allViolations.push({
        transaction_code: row.transaction_code,
        employee_name: row.employee_name ?? '',
        violation_type: 'preauth_required',
        policy_rule_cited: `Expenses > $${limits.preauthThreshold} require manager pre-authorization and receipts.`,
        severity: 'medium',
        reasoning: `$${(row.amount ?? 0).toFixed(2)} charge at ${row.merchant_name} (${row.category_label}) on ${row.posting_date} exceeds the $${limits.preauthThreshold} pre-authorization threshold.`,
        is_repeat_offender: false,
      });
    }

    const windowDays = limits.splitChargeWindowHours / 24;
    const splitCharges = splitChargeStmt.all({ since_date: sinceDate, window_days: windowDays }) as unknown as SplitChargeRow[];
    for (const sc of splitCharges) {
      allViolations.push({
        transaction_code: sc.code1,
        employee_name: sc.employee_name ?? '',
        violation_type: 'split_charge',
        policy_rule_cited:
          'Expenses must not be split across multiple transactions to circumvent the pre-authorization threshold.',
        severity: 'high',
        reasoning: `Potential split charge: $${(sc.amount1 ?? 0).toFixed(2)} at ${sc.merchant_name} on ${sc.date1} and $${(sc.amount2 ?? 0).toFixed(2)} on ${sc.date2} (same employee, same merchant, within ${limits.splitChargeWindowHours}h, amounts within 10%).`,
        is_repeat_offender: false,
        related_transactions: [
          { transaction_code: sc.code1, amount: sc.amount1 ?? 0, date: sc.date1 ?? '', merchant: sc.merchant_name ?? '' },
          { transaction_code: sc.code2, amount: sc.amount2 ?? 0, date: sc.date2 ?? '', merchant: sc.merchant_name ?? '' },
        ],
      });
    }

    // Compute repeat offenders: >= 3 violations within the scanned window → flag all their violations
    const countByEmployee: Record<string, number> = {};
    for (const v of allViolations) {
      countByEmployee[v.employee_name] = (countByEmployee[v.employee_name] ?? 0) + 1;
    }
    const repeatOffenders = new Set(
      Object.entries(countByEmployee)
        .filter(([, count]) => count >= 3)
        .map(([name]) => name),
    );
    const finalViolations = allViolations.map(v => ({
      ...v,
      is_repeat_offender: repeatOffenders.has(v.employee_name),
    }));

    lastScanViolations = finalViolations;
    lastScanTxnCount = allTxns.length;

    res.json({ violations: finalViolations });
  } catch (err) {
    next(err);
  } finally {
    scanInProgress = false;
  }
});

router.get('/score', (_req, res) => {
  const score =
    lastScanTxnCount === 0
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((lastScanTxnCount - lastScanViolations.length) / lastScanTxnCount) * 100,
            ),
          ),
        );
  res.json({ score, totalTransactions: lastScanTxnCount, violationCount: lastScanViolations.length });
});

export default router;
