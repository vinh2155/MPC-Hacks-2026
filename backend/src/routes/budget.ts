import { Router } from 'express';
import { db } from '../db';
import { TOTAL_BUDGET } from '../lib/config';

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

router.get('/summary', (_req, res) => {
  const txnTotal = (txnSpendStmt.get({}) as { total: number }).total;
  const reqTotal = (approvedRequestsStmt.get({}) as { total: number }).total;
  const totalSpend = txnTotal + reqTotal;
  const byCategory = byCategoryStmt.all({}) as { label: string; amount: number }[];

  res.json({
    totalSpend,
    totalBudget: TOTAL_BUDGET,
    utilizationPct: parseFloat(((totalSpend / TOTAL_BUDGET) * 100).toFixed(1)),
    byCategory,
  });
});

export default router;
