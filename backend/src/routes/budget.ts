import { Router } from 'express';
import { db } from '../db';
import { loadPolicyLimits } from './policy';

const router = Router();

const txnSpendStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE debit_or_credit = 'debit'
`);

const approvedRequestsStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM requests
  WHERE status = 'approved'
`);

const byCategoryStmt = db.prepare(`
  SELECT category_label AS label, SUM(amount) AS amount
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND category_label IS NOT NULL
  GROUP BY category_label
  ORDER BY amount DESC
`);

const dateRangeStmt = db.prepare(`
  SELECT MIN(posting_date) AS period_start, MAX(posting_date) AS period_end
  FROM transactions
  WHERE debit_or_credit = 'debit'
`);

router.get('/summary', (_req, res, next) => {
  try {
    const txnTotal = Number((txnSpendStmt.get({}) as { total: unknown }).total ?? 0);
    const reqTotal = Number((approvedRequestsStmt.get({}) as { total: unknown }).total ?? 0);
    const totalSpend = parseFloat((txnTotal + reqTotal).toFixed(2));
    const byCategory = (byCategoryStmt.all({}) as { label: string; amount: number }[])
      .map(r => ({ label: r.label, amount: parseFloat(r.amount.toFixed(2)) }));
    const dateRange = dateRangeStmt.get({}) as { period_start: string; period_end: string };

    const totalBudget = loadPolicyLimits().totalBudget;
    res.json({
      totalSpend,
      totalBudget,
      utilizationPct: parseFloat(((totalSpend / totalBudget) * 100).toFixed(1)),
      byCategory,
      periodStart: dateRange.period_start,
      periodEnd: dateRange.period_end,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
