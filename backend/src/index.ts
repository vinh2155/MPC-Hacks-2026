import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db';
import { TOTAL_BUDGET } from './lib/config';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

const categorySummaryStmt = db.prepare(`
  SELECT category_label, SUM(amount) AS amount
  FROM transactions
  WHERE debit_or_credit = 'debit'
  GROUP BY category_label
  ORDER BY amount DESC
`);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/budget/summary', (_req, res) => {
  try {
    const rows = categorySummaryStmt.all() as { category_label: string | null; amount: number }[];
    const totalSpend = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const utilizationPct = (totalSpend / TOTAL_BUDGET) * 100;

    res.json({
      totalSpend,
      totalBudget: TOTAL_BUDGET,
      utilizationPct,
      byCategory: rows.map(r => ({ label: r.category_label ?? 'Other', amount: r.amount ?? 0 })),
    });
  } catch (err) {
    console.error('Budget summary query failed:', err);
    res.status(500).json({ error: 'Failed to fetch budget summary' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  const debugStmt = db.prepare('SELECT * FROM transactions LIMIT :limit');
  app.get('/api/debug/transactions', (req, res) => {
    const raw = parseInt(String(req.query.limit ?? ''), 10);
    const limit = Math.max(1, Math.min(isNaN(raw) ? 10 : raw, 100));
    const rows = debugStmt.all({ limit });
    res.json(rows);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
