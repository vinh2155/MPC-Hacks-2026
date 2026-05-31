import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db';
import budgetRouter from './routes/budget';
import chatRouter from './routes/chat';
import complianceRouter from './routes/compliance';
import requestsRouter from './routes/requests';
import reportsRouter from './routes/reports';
import employeesRouter from './routes/employees';
import policyRouter from './routes/policy';
import transactionsRouter from './routes/transactions';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/budget', budgetRouter);
app.use('/api/chat', chatRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/policy', policyRouter);
app.use('/api/transactions', transactionsRouter);

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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'error' in err && 'raw' in err) {
    res.status(502).json({ error: (err as { error: string }).error });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

// Node 22 + keep-alive can send both Content-Length and Transfer-Encoding on
// long-running responses, which violates HTTP/1.1 and breaks Vite's proxy.
// Disabling keep-alive prevents chunked encoding from being applied.
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
server.keepAliveTimeout = 0;
server.setTimeout(300_000); // 5 min — long-running compliance scan
