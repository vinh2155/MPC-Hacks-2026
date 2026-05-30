import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db';
import budgetRouter from './routes/budget';
import chatRouter from './routes/chat';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/budget', budgetRouter);
app.use('/api/chat', chatRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const debugStmt = db.prepare('SELECT * FROM transactions LIMIT :limit');
app.get('/api/debug/transactions', (req, res) => {
  if (process.env.NODE_ENV === 'production') return void res.sendStatus(404);
  const raw = parseInt(String(req.query.limit ?? ''), 10);
  const limit = Math.max(1, Math.min(isNaN(raw) ? 10 : raw, 100));
  const rows = debugStmt.all({ limit });
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
