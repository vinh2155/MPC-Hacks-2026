import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { askClaude, type ClaudeError } from '../lib/claude';
import { TOTAL_BUDGET } from '../lib/config';

const router = Router();

// ── Zod schemas ────────────────────────────────────────────────────────────────

const NarrativeSchema = z.object({
  narrative: z.string().min(1),
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface MaxDateRow { max_date: string | null }
interface TotalSpendRow { total: number }
interface SpendRow { category_label: string | null; total: number }
interface TopTxnRow {
  merchant_name: string | null;
  amount: number | null;
  posting_date: string | null;
  employee_name: string | null;
  category_label: string | null;
}
interface ViolationCountRow { cnt: number }
interface RequestCountRow { status: string; cnt: number }
interface EmployeeTopTxnRow {
  merchant_name: string | null;
  amount: number | null;
  posting_date: string | null;
  category_label: string | null;
}
interface EmployeeRequestRow {
  id: string;
  item_description: string;
  amount: number;
  category: string;
  status: string;
  created_at: string;
}

// ── Prepared statements ────────────────────────────────────────────────────────

const maxDateStmt = db.prepare(`
  SELECT MAX(posting_date) AS max_date
  FROM transactions
  WHERE debit_or_credit = 'debit'
`);

const totalSpendStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND posting_date >= :since
`);

const allTimeSpendStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE debit_or_credit = 'debit'
`);

const spendByCategoryStmt = db.prepare(`
  SELECT category_label, COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND posting_date >= :since
  GROUP BY category_label
  ORDER BY total DESC
`);

const topTxnsStmt = db.prepare(`
  SELECT merchant_name, amount, posting_date, employee_name, category_label
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND posting_date >= :since
  ORDER BY amount DESC
  LIMIT 5
`);

const preauthCountStmt = db.prepare(`
  SELECT COUNT(*) AS cnt
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND amount > 50
    AND posting_date >= :since
`);

// Same split-charge logic as compliance.ts — count pairs
const splitChargeCountStmt = db.prepare(`
  SELECT COUNT(*) AS cnt
  FROM transactions t1
  JOIN transactions t2
    ON t1.employee_name = t2.employee_name
   AND t1.merchant_name = t2.merchant_name
   AND t1.transaction_code < t2.transaction_code
   AND ABS(julianday(t2.posting_date) - julianday(t1.posting_date)) <= 2
   AND t2.amount BETWEEN t1.amount * 0.9 AND t1.amount * 1.1
  WHERE t1.debit_or_credit = 'debit'
    AND t2.debit_or_credit = 'debit'
    AND t1.posting_date >= :since
    AND t2.posting_date >= :since
`);

const requestCountsStmt = db.prepare(`
  SELECT status, COUNT(*) AS cnt
  FROM requests
  WHERE created_at >= :since
  GROUP BY status
`);

// ── Employee report prepared statements ───────────────────────────────────────

const empExistsStmt = db.prepare(`
  SELECT COUNT(*) AS cnt
  FROM transactions
  WHERE employee_name = :name
`);

const empTotalSpendStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND employee_name = :name
`);

const empSpendByCategoryStmt = db.prepare(`
  SELECT category_label, COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND employee_name = :name
  GROUP BY category_label
  ORDER BY total DESC
`);

const empTopTxnsStmt = db.prepare(`
  SELECT merchant_name, amount, posting_date, category_label
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND employee_name = :name
  ORDER BY amount DESC
  LIMIT 5
`);

const empRequestsStmt = db.prepare(`
  SELECT id, item_description, amount, category, status, created_at
  FROM requests
  WHERE employee_name = :name
  ORDER BY created_at DESC
  LIMIT 20
`);

const empPreauthCountStmt = db.prepare(`
  SELECT COUNT(*) AS cnt
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND employee_name = :name
    AND amount > 50
    AND posting_date >= :since
`);

// Split-charge pairs involving this employee (last 30 days)
const empSplitPairCountStmt = db.prepare(`
  SELECT COUNT(*) AS cnt
  FROM transactions t1
  JOIN transactions t2
    ON t1.employee_name = t2.employee_name
   AND t1.merchant_name = t2.merchant_name
   AND t1.transaction_code < t2.transaction_code
   AND ABS(julianday(t2.posting_date) - julianday(t1.posting_date)) <= 2
   AND t2.amount BETWEEN t1.amount * 0.9 AND t1.amount * 1.1
  WHERE t1.debit_or_credit = 'debit'
    AND t2.debit_or_credit = 'debit'
    AND t1.employee_name = :name
    AND t1.posting_date >= :since
    AND t2.posting_date >= :since
`);

// ── Route ──────────────────────────────────────────────────────────────────────

router.post('/period', async (req, res, next) => {
  try {
    const rawPeriod: unknown = (req.body as Record<string, unknown>).period;
    if (rawPeriod !== 'weekly' && rawPeriod !== 'monthly') {
      res.status(400).json({ error: 'period must be "weekly" or "monthly"' });
      return;
    }
    const period = rawPeriod;
    const days = period === 'weekly' ? 7 : 30;

    // Anchor to max posting date in DB
    const maxDateRow = maxDateStmt.get({}) as unknown as MaxDateRow;
    if (maxDateRow.max_date === null) {
      res.json({
        period,
        generatedAt: new Date().toISOString(),
        narrative: 'No transaction data available.',
        data: {
          sinceDate: null,
          totalSpend: 0,
          allTimeBudgetUtilization: 0,
          spendByCategory: [],
          topTransactions: [],
          preauthCount: 0,
          splitPairCount: 0,
          approvedCount: 0,
          deniedCount: 0,
        },
      });
      return;
    }

    const maxDate = maxDateRow.max_date;
    const maxDateObj = new Date(maxDate + 'T00:00:00Z');
    maxDateObj.setUTCDate(maxDateObj.getUTCDate() - days);
    const sinceDate = maxDateObj.toISOString().split('T')[0];

    // Gather data
    const totalSpendRow = totalSpendStmt.get({ since: sinceDate }) as unknown as TotalSpendRow;
    const totalSpend = totalSpendRow.total ?? 0;

    const allTimeRow = allTimeSpendStmt.get({}) as unknown as TotalSpendRow;
    const allTimeSpend = allTimeRow.total ?? 0;
    // All-time utilization (not period-scoped) — clearly named to avoid confusion with totalSpend
    const allTimeBudgetUtilization = Math.round((allTimeSpend / TOTAL_BUDGET) * 100);

    const spendByCategory = (spendByCategoryStmt.all({ since: sinceDate }) as unknown as SpendRow[]).map(r => ({
      category: r.category_label ?? 'Unknown',
      total: r.total,
    }));

    const topTransactions = (topTxnsStmt.all({ since: sinceDate }) as unknown as TopTxnRow[]).map(r => ({
      merchant: r.merchant_name ?? 'Unknown',
      amount: r.amount ?? 0,
      date: r.posting_date ?? '',
      employee: r.employee_name ?? 'Unknown',
      category: r.category_label ?? 'Unknown',
    }));

    const preauthCount = (preauthCountStmt.get({ since: sinceDate }) as unknown as ViolationCountRow).cnt ?? 0;
    // splitCount counts pairs — a transaction in a split-charge pair is also counted by preauthCount if amount > 50.
    // Report both separately rather than summing, to avoid double-counting.
    const splitPairCount = (splitChargeCountStmt.get({ since: sinceDate }) as unknown as ViolationCountRow).cnt ?? 0;

    const requestRows = requestCountsStmt.all({ since: sinceDate }) as unknown as RequestCountRow[];
    const approvedCount = requestRows.find(r => r.status === 'approved')?.cnt ?? 0;
    const deniedCount = requestRows.find(r => r.status === 'denied')?.cnt ?? 0;

    // Build prompt
    const categoryLines = spendByCategory.length > 0
      ? spendByCategory.map(c => `  ${c.category}: $${c.total.toFixed(2)}`).join('\n')
      : '  (no transactions in this period)';

    const txnLines = topTransactions.length > 0
      ? topTransactions.map(t => `  $${t.amount.toFixed(2)} at ${t.merchant} (${t.category}) — ${t.employee} on ${t.date}`).join('\n')
      : '  (no transactions in this period)';

    const prompt = `You are writing an executive expense report for a trucking company manager.

PERIOD: ${period} (${sinceDate} to ${maxDate})
BUDGET: $${TOTAL_BUDGET.toLocaleString()} total | $${totalSpend.toFixed(2)} spent this period | ${allTimeBudgetUtilization}% all-time budget utilization

SPEND BY CATEGORY:
${categoryLines}

TOP 5 TRANSACTIONS:
${txnLines}

POLICY FLAGS THIS PERIOD: ${preauthCount} transactions require pre-authorization (over $50); ${splitPairCount} potential split-charge pairs detected (note: these categories can overlap)
REQUESTS: ${approvedCount} approved, ${deniedCount} denied

Write a concise executive memo covering ALL 6 of these sections in order:
1. Total spend vs budget
2. Top spending categories
3. Notable transactions
4. Policy violations
5. Approval activity
6. Budget health summary

Keep each section 2-3 sentences. Use plain English only — no markdown, no headers, no bullet points, no asterisks.

Return JSON: { "narrative": "<memo text with a blank line between each section>" }`;

    let narrative: string;
    try {
      const result = await askClaude(prompt, NarrativeSchema, { maxTokens: 2048 });
      narrative = result.narrative;
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'raw' in err) {
        res.status(502).json({ error: 'Report generation failed', detail: (err as ClaudeError).error });
      } else {
        next(err);
      }
      return;
    }

    res.json({
      period,
      generatedAt: new Date().toISOString(),
      narrative,
      data: {
        sinceDate,
        totalSpend,
        allTimeBudgetUtilization,
        spendByCategory,
        topTransactions,
        preauthCount,
        splitPairCount,
        approvedCount,
        deniedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/employee', async (req, res, next) => {
  try {
    const rawName: unknown = (req.body as Record<string, unknown>).employeeName;
    if (typeof rawName !== 'string' || !rawName.trim()) {
      res.status(400).json({ error: 'employeeName is required' });
      return;
    }
    const employeeName = rawName.trim();

    // C2: reject unknown employee names (not present in transactions table)
    const existsRow = empExistsStmt.get({ name: employeeName }) as unknown as ViolationCountRow;
    if ((existsRow.cnt ?? 0) === 0) {
      res.status(404).json({ error: `Unknown employee: "${employeeName}"` });
      return;
    }

    // Anchor compliance window to MAX(posting_date) — same as compliance.ts
    const maxDateRow = maxDateStmt.get({}) as unknown as MaxDateRow;
    // C1: mirror /period's explicit null check — return a clear no-data response instead of
    // falling back to today's date and calling Claude with all-zero data.
    if (maxDateRow.max_date === null) {
      res.json({
        employeeName,
        generatedAt: new Date().toISOString(),
        narrative: 'No transaction data available.',
        data: {
          totalSpend: 0,
          teamAverageSpend: 0,
          spendByCategory: [],
          topTransactions: [],
          requests: [],
          preauthCount: 0,
          splitPairCount: 0,
        },
      });
      return;
    }
    const maxDate = maxDateRow.max_date;
    const maxDateObj = new Date(maxDate + 'T00:00:00Z');
    maxDateObj.setUTCDate(maxDateObj.getUTCDate() - 30);
    const sinceDate = maxDateObj.toISOString().split('T')[0]!;

    // Employee spend (all-time)
    const empTotalRow = empTotalSpendStmt.get({ name: employeeName }) as unknown as TotalSpendRow;
    const totalSpend = empTotalRow.total ?? 0;

    // Team average = all-time total / 8 employees
    const teamTotalRow = allTimeSpendStmt.get({}) as unknown as TotalSpendRow;
    const teamAverageSpend = (teamTotalRow.total ?? 0) / 8;

    const spendByCategory = (empSpendByCategoryStmt.all({ name: employeeName }) as unknown as SpendRow[]).map(r => ({
      category: r.category_label ?? 'Unknown',
      total: r.total,
    }));

    const topTransactions = (empTopTxnsStmt.all({ name: employeeName }) as unknown as EmployeeTopTxnRow[]).map(r => ({
      merchant: r.merchant_name ?? 'Unknown',
      amount: r.amount ?? 0,
      date: r.posting_date ?? '',
      category: r.category_label ?? 'Unknown',
    }));

    const requests = (empRequestsStmt.all({ name: employeeName }) as unknown as EmployeeRequestRow[]).map(r => ({
      id: r.id,
      item_description: r.item_description,
      amount: r.amount,
      category: r.category,
      status: r.status,
      created_at: r.created_at,
    }));

    const preauthCount = (empPreauthCountStmt.get({ name: employeeName, since: sinceDate }) as unknown as ViolationCountRow).cnt ?? 0;
    const splitPairCount = (empSplitPairCountStmt.get({ name: employeeName, since: sinceDate }) as unknown as ViolationCountRow).cnt ?? 0;

    // Build prompt
    const diffPct = teamAverageSpend > 0
      ? Math.round(((totalSpend - teamAverageSpend) / teamAverageSpend) * 100)
      : 0;
    const diffLabel = diffPct >= 0 ? `${diffPct}% above` : `${Math.abs(diffPct)}% below`;

    const categoryLines = spendByCategory.length > 0
      ? spendByCategory.map(c => `  ${c.category}: $${c.total.toFixed(2)}`).join('\n')
      : '  (no transactions)';

    const txnLines = topTransactions.length > 0
      ? topTransactions.map(t => `  $${t.amount.toFixed(2)} at ${t.merchant} (${t.category}) on ${t.date}`).join('\n')
      : '  (no transactions)';

    const requestLines = requests.length > 0
      ? requests.map(r => `  ${r.item_description} ($${r.amount.toFixed(2)}, ${r.category}) — ${r.status}`).join('\n')
      : '  (no requests submitted)';

    const prompt = `You are writing an employee spend profile for a trucking company manager.

EMPLOYEE: ${JSON.stringify(employeeName)}
TOTAL SPEND (all-time): $${totalSpend.toFixed(2)}
TEAM AVERAGE SPEND: $${teamAverageSpend.toFixed(2)} — this employee is ${diffLabel} the team average

SPEND BY CATEGORY (all-time):
${categoryLines}

TOP 5 TRANSACTIONS (all-time):
${txnLines}

PURCHASE REQUESTS:
${requestLines}

POLICY FLAGS (last 30 days): ${preauthCount} transactions over $50 requiring pre-authorization; ${splitPairCount} potential split-charge pairs detected

Write a concise spend profile covering ALL 5 sections in order:
1. Spend vs team average
2. Top spending categories
3. Notable transactions
4. Requests and outcomes
5. Policy flag summary

Keep each section 2-3 sentences. Use plain English only — no markdown, no headers, no bullet points, no asterisks.

Return JSON: { "narrative": "<profile text with a blank line between each section>" }`;

    let narrative: string;
    try {
      const result = await askClaude(prompt, NarrativeSchema, { maxTokens: 2048 });
      narrative = result.narrative;
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'raw' in err) {
        res.status(502).json({ error: 'Report generation failed', detail: (err as ClaudeError).error });
      } else {
        next(err);
      }
      return;
    }

    res.json({
      employeeName,
      generatedAt: new Date().toISOString(),
      narrative,
      data: {
        totalSpend,
        teamAverageSpend,
        spendByCategory,
        topTransactions,
        requests,
        preauthCount,
        splitPairCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
