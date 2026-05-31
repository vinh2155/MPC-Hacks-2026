import { Router } from 'express';
import { db } from '../db';

const router = Router();

interface EmployeeRow { employee_name: string }

const employeesStmt = db.prepare(`
  SELECT DISTINCT employee_name
  FROM transactions
  WHERE employee_name IS NOT NULL
  ORDER BY employee_name
`);

router.get('/', (_req, res) => {
  const rows = employeesStmt.all({}) as unknown as EmployeeRow[];
  res.json(rows.map(r => r.employee_name));
});

export default router;
