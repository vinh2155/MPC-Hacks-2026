import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { askClaude } from '../lib/claude';
import { TOTAL_BUDGET } from '../lib/config';

const router = Router();

const insertStmt = db.prepare(`
  INSERT INTO requests (id, employee_name, item_description, amount, category, reason, status, created_at)
  VALUES (:id, :employee_name, :item_description, :amount, :category, :reason, 'pending', :created_at)
`);

const getAllStmt = db.prepare(`
  SELECT * FROM requests ORDER BY created_at DESC
`);

const getByIdStmt = db.prepare(`
  SELECT * FROM requests WHERE id = :id
`);

const updateStatusStmt = db.prepare(`
  UPDATE requests SET status = :status WHERE id = :id
`);

const employeeSpendStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE employee_name = :employee_name
    AND debit_or_credit = 'debit'
    AND posting_date >= :since
`);

const employeeCategoryStmt = db.prepare(`
  SELECT category_label AS label, SUM(amount) AS total
  FROM transactions
  WHERE employee_name = :employee_name
    AND debit_or_credit = 'debit'
    AND posting_date >= :since
    AND category_label IS NOT NULL
  GROUP BY category_label
  ORDER BY total DESC
`);

const budgetTxnStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE debit_or_credit = 'debit'
`);

const budgetApprovedStmt = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total FROM requests WHERE status = 'approved'
`);

interface RequestRow {
  id: string; employee_name: string; item_description: string;
  amount: number; category: string; reason: string;
  status: string; created_at: string;
}

const recommendationSchema = z.object({
  recommendation: z.enum(['approve', 'deny', 'escalate']),
  reasoning: z.string(),
});

router.post('/', (req, res) => {
  const { employee_name, item_description, amount, category, reason } = req.body ?? {};

  if (!employee_name || !item_description || amount == null || !category || !reason) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  const parsedAmount = parseFloat(amount);
  if (!isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0' });
    return;
  }

  const id = crypto.randomUUID();
  insertStmt.run({
    id,
    employee_name: String(employee_name),
    item_description: String(item_description),
    amount: parsedAmount,
    category: String(category),
    reason: String(reason),
    created_at: new Date().toISOString(),
  });

  res.status(201).json({ id });
});

router.get('/', (_req, res) => {
  const rows = getAllStmt.all({});
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = getByIdStmt.get({ id: req.params.id });
  if (!row) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }
  res.json(row);
});

router.patch('/:id', (req, res) => {
  const { status } = req.body ?? {};
  if (status !== 'approved' && status !== 'denied') {
    res.status(400).json({ error: 'status must be "approved" or "denied"' });
    return;
  }

  const existing = getByIdStmt.get({ id: req.params.id }) as { status: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }
  if (existing.status !== 'pending') {
    res.status(409).json({ error: 'Request already decided' });
    return;
  }

  updateStatusStmt.run({ status, id: req.params.id });
  res.json(getByIdStmt.get({ id: req.params.id }));
});

router.post('/:id/recommendation', async (req, res, next) => {
  try {
    const request = getByIdStmt.get({ id: req.params.id }) as RequestRow | undefined;
    if (!request) { res.status(404).json({ error: 'Request not found' }); return; }
    if (request.status !== 'pending') {
      res.status(409).json({ error: 'Request already decided' });
      return;
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const empTotal = Number((employeeSpendStmt.get({ employee_name: request.employee_name, since }) as { total: unknown }).total ?? 0);
    const empCats = employeeCategoryStmt.all({ employee_name: request.employee_name, since }) as { label: string; total: number }[];

    const txnTotal = Number((budgetTxnStmt.get({}) as { total: unknown }).total ?? 0);
    const approvedTotal = Number((budgetApprovedStmt.get({}) as { total: unknown }).total ?? 0);
    const totalSpend = txnTotal + approvedTotal;
    const utilizationPct = ((totalSpend / TOTAL_BUDGET) * 100).toFixed(1);
    const remaining = (TOTAL_BUDGET - totalSpend).toFixed(2);

    const catSummary = empCats.length
      ? empCats.map(c => `  ${c.label}: $${c.total.toFixed(2)}`).join('\n')
      : '  No transactions in this period';

    const prompt = `A trucking company employee is requesting expense approval.

Request:
- Employee: ${request.employee_name}
- Item: ${request.item_description}
- Amount: $${request.amount.toFixed(2)}
- Category: ${request.category}
- Reason: ${request.reason}

Employee's last 30 days of company card spend:
- Total: $${empTotal.toFixed(2)}
${catSummary}

Company budget:
- Total: $${TOTAL_BUDGET.toLocaleString()}
- Spent: $${totalSpend.toFixed(2)} (${utilizationPct}% utilized)
- Remaining: $${remaining}

Return JSON: { "recommendation": "approve"|"deny"|"escalate", "reasoning": "<2-3 sentence explanation for the manager>" }
- approve: reasonable amount, legitimate business purpose, fits budget
- deny: excessive for category, no clear justification, or duplicate
- escalate: large but plausible, unusual pattern, or needs clarification`;

    const result = await askClaude(prompt, recommendationSchema, { maxTokens: 1024 });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
