import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/debug/transactions', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const rows = db.prepare('SELECT * FROM transactions LIMIT :limit').all({ limit });
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
