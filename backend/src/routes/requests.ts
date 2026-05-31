import { Router } from 'express';
import { db } from '../db';

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

export default router;
