import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { askClaude } from '../lib/claude';
import { loadPolicyLimits } from './policy';

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────────

interface CategoryRow    { employee_name: string; category_label: string; total: number }
interface SpendRow       { employee_name: string; total_spend: number; transaction_count: number }
interface PreauthRow     { employee_name: string; preauth_count: number }
interface SplitRow       { employee_name: string; split_count: number }
interface RequestRow     { employee_name: string; status: string; cnt: number }
interface EmployeeRow    { employee_name: string }

// ── Prepared statements ────────────────────────────────────────────────────────

const allEmployeesStmt = db.prepare(`
  SELECT DISTINCT employee_name FROM transactions ORDER BY employee_name
`);

const maxDateStmt = db.prepare(`
  SELECT MAX(posting_date) AS max_date FROM transactions WHERE debit_or_credit = 'debit'
`);

const spendStmt = db.prepare(`
  SELECT employee_name,
         SUM(amount)  AS total_spend,
         COUNT(*)     AS transaction_count
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND posting_date >= :since
  GROUP BY employee_name
`);

const preauthStmt = db.prepare(`
  SELECT employee_name, COUNT(*) AS preauth_count
  FROM transactions
  WHERE debit_or_credit = 'debit'
    AND amount > :threshold
    AND posting_date >= :since
  GROUP BY employee_name
`);

const splitStmt = db.prepare(`
  SELECT t1.employee_name, COUNT(*) AS split_count
  FROM transactions t1
  JOIN transactions t2
    ON t1.employee_name = t2.employee_name
   AND t1.merchant_name = t2.merchant_name
   AND t1.transaction_code < t2.transaction_code
   AND ABS(julianday(t2.posting_date) - julianday(t1.posting_date)) <= :window_days
   AND t2.amount BETWEEN t1.amount * 0.9 AND t1.amount * 1.1
  WHERE t1.debit_or_credit = 'debit'
    AND t2.debit_or_credit = 'debit'
    AND t1.posting_date >= :since
    AND t2.posting_date >= :since
  GROUP BY t1.employee_name
`);

// Requests are session-only so no period filter — show all-time
const requestStmt = db.prepare(`
  SELECT employee_name, status, COUNT(*) AS cnt
  FROM requests
  GROUP BY employee_name, status
`);

// Top 3 spending categories per employee — used to enrich AI insights
const topCategoriesStmt = db.prepare(`
  SELECT employee_name, category_label, SUM(amount) AS total
  FROM transactions
  WHERE debit_or_credit = 'debit' AND posting_date >= :since
  GROUP BY employee_name, category_label
  ORDER BY employee_name, total DESC
`);

// ── Helpers ────────────────────────────────────────────────────────────────────

type Period = 'day' | 'month' | '3months' | '6months' | 'year' | 'all';

function sinceDate(period: Period, maxDate: string): string {
  if (period === 'all') return '0000-01-01';
  const d = new Date(maxDate + 'T00:00:00Z');
  const offsets: Record<Period, number> = {
    day: 1, month: 30, '3months': 90, '6months': 180, year: 365, all: 0,
  };
  d.setUTCDate(d.getUTCDate() - offsets[period]);
  return d.toISOString().split('T')[0];
}

// Raw penalty: higher = worse employee. Weights chosen so violations and
// spend-vs-average both contribute, giving natural spread across employees.
function rawPenalty(
  preauthViolations: number,
  splitPairCount: number,
  deniedRequests: number,
  totalSpend: number,
  teamAvgSpend: number,
): number {
  let p = preauthViolations * 4 + splitPairCount * 20 + deniedRequests * 10;
  if (teamAvgSpend > 0) {
    const ratio = totalSpend / teamAvgSpend;
    if      (ratio > 2.0)  p += 20;
    else if (ratio > 1.5)  p += 12;
    else if (ratio > 1.25) p += 6;
  }
  return p;
}

// Normalize raw penalties across all employees so that the best maps to
// SCORE_MAX (95) and the worst to SCORE_MIN (40). Relative order is preserved.
const SCORE_MAX = 95;
const SCORE_MIN = 40;

function normalizeScores(penalties: number[]): number[] {
  const lo = Math.min(...penalties);
  const hi = Math.max(...penalties);
  if (lo === hi) return penalties.map(() => Math.round((SCORE_MAX + SCORE_MIN) / 2));
  return penalties.map(p =>
    Math.round(SCORE_MAX - (p - lo) / (hi - lo) * (SCORE_MAX - SCORE_MIN))
  );
}

// ── Route ──────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const period = (String(req.query.period ?? 'all')) as Period;
  const validPeriods: Period[] = ['day', 'month', '3months', '6months', 'year', 'all'];
  const safePeriod: Period = validPeriods.includes(period) ? period : 'all';

  const maxDateRow = maxDateStmt.get({}) as unknown as { max_date: string | null };
  if (!maxDateRow.max_date) {
    res.json({ period: safePeriod, employees: [], teamAverageSpend: 0 });
    return;
  }

  const since = sinceDate(safePeriod, maxDateRow.max_date);
  const limits = loadPolicyLimits();
  const windowDays = limits.splitChargeWindowHours / 24;

  const allEmployees = (allEmployeesStmt.all({}) as unknown as EmployeeRow[]).map(r => r.employee_name);

  const spendMap    = new Map((spendStmt.all({ since }) as unknown as SpendRow[]).map(r => [r.employee_name, r]));
  const preauthMap  = new Map((preauthStmt.all({ since, threshold: limits.preauthThreshold }) as unknown as PreauthRow[]).map(r => [r.employee_name, r.preauth_count]));
  const splitMap    = new Map((splitStmt.all({ since, window_days: windowDays }) as unknown as SplitRow[]).map(r => [r.employee_name, r.split_count]));

  const requestMap = new Map<string, { approved: number; denied: number }>();
  for (const r of requestStmt.all({}) as unknown as RequestRow[]) {
    if (!requestMap.has(r.employee_name)) requestMap.set(r.employee_name, { approved: 0, denied: 0 });
    const entry = requestMap.get(r.employee_name)!;
    if (r.status === 'approved') entry.approved = r.cnt;
    if (r.status === 'denied')   entry.denied   = r.cnt;
  }

  const baseEmployees = allEmployees.map(name => {
    const spend             = spendMap.get(name);
    const preauthViolations = preauthMap.get(name) ?? 0;
    const splitPairCount    = splitMap.get(name)   ?? 0;
    const requests          = requestMap.get(name) ?? { approved: 0, denied: 0 };
    return {
      name,
      totalSpend:       spend?.total_spend       ?? 0,
      transactionCount: spend?.transaction_count ?? 0,
      preauthViolations,
      splitPairCount,
      approvedRequests: requests.approved,
      deniedRequests:   requests.denied,
    };
  });

  const teamAverageSpend = baseEmployees.length
    ? baseEmployees.reduce((s, e) => s + e.totalSpend, 0) / baseEmployees.length
    : 0;

  // Compute & normalize scores across all employees so best→95, worst→40
  const penalties = baseEmployees.map(e =>
    rawPenalty(e.preauthViolations, e.splitPairCount, e.deniedRequests, e.totalSpend, teamAverageSpend)
  );
  const scores = normalizeScores(penalties);

  const employees = baseEmployees.map((e, i) => ({ ...e, score: scores[i] }));

  // Rank by score descending; ties broken alphabetically
  const ranked = [...employees].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const rankMap = new Map(ranked.map((e, i) => [e.name, i + 1]));

  res.json({
    period: safePeriod,
    teamAverageSpend,
    employees: employees.map(e => ({ ...e, rank: rankMap.get(e.name)! })),
  });
});

// ── Insights route ─────────────────────────────────────────────────────────────

const InsightsSchema = z.object({
  insights: z.record(z.string()),
});

const PERIOD_LABEL: Record<Period, string> = {
  day: 'the last day', month: 'the last 30 days', '3months': 'the last 3 months',
  '6months': 'the last 6 months', year: 'the last year', all: 'all time',
};

router.post('/insights', async (req, res, next) => {
  const validPeriods: Period[] = ['day', 'month', '3months', '6months', 'year', 'all'];
  const period = (String(req.body.period ?? 'all')) as Period;
  const safePeriod: Period = validPeriods.includes(period) ? period : 'all';

  try {
    const maxDateRow = maxDateStmt.get({}) as unknown as { max_date: string | null };
    if (!maxDateRow.max_date) { res.json({ insights: {} }); return; }

    const since      = sinceDate(safePeriod, maxDateRow.max_date);
    const limits     = loadPolicyLimits();
    const windowDays = limits.splitChargeWindowHours / 24;

    const allEmployees = (allEmployeesStmt.all({}) as unknown as EmployeeRow[]).map(r => r.employee_name);
    const spendMap   = new Map((spendStmt.all({ since }) as unknown as SpendRow[]).map(r => [r.employee_name, r]));
    const preauthMap = new Map((preauthStmt.all({ since, threshold: limits.preauthThreshold }) as unknown as PreauthRow[]).map(r => [r.employee_name, r.preauth_count]));
    const splitMap   = new Map((splitStmt.all({ since, window_days: windowDays }) as unknown as SplitRow[]).map(r => [r.employee_name, r.split_count]));

    // Top categories per employee
    const catMap = new Map<string, { label: string; total: number }[]>();
    for (const r of topCategoriesStmt.all({ since }) as unknown as CategoryRow[]) {
      if (!catMap.has(r.employee_name)) catMap.set(r.employee_name, []);
      catMap.get(r.employee_name)!.push({ label: r.category_label, total: r.total });
    }

    const requestMap = new Map<string, { approved: number; denied: number }>();
    for (const r of requestStmt.all({}) as unknown as RequestRow[]) {
      if (!requestMap.has(r.employee_name)) requestMap.set(r.employee_name, { approved: 0, denied: 0 });
      const entry = requestMap.get(r.employee_name)!;
      if (r.status === 'approved') entry.approved = r.cnt;
      if (r.status === 'denied')   entry.denied   = r.cnt;
    }

    const baseEmployees = allEmployees.map(name => {
      const spend             = spendMap.get(name);
      const preauthViolations = preauthMap.get(name) ?? 0;
      const splitPairCount    = splitMap.get(name)   ?? 0;
      const requests          = requestMap.get(name) ?? { approved: 0, denied: 0 };
      const topCats           = (catMap.get(name) ?? []).slice(0, 3);
      return { name, totalSpend: spend?.total_spend ?? 0, transactionCount: spend?.transaction_count ?? 0,
               preauthViolations, splitPairCount, topCats,
               approvedRequests: requests.approved, deniedRequests: requests.denied };
    });

    const teamAvg = baseEmployees.length
      ? baseEmployees.reduce((s, e) => s + e.totalSpend, 0) / baseEmployees.length
      : 0;

    const insightPenalties = baseEmployees.map(e =>
      rawPenalty(e.preauthViolations, e.splitPairCount, e.deniedRequests, e.totalSpend, teamAvg)
    );
    const insightScores = normalizeScores(insightPenalties);
    const employees = baseEmployees.map((e, i) => ({ ...e, score: insightScores[i] }));

    const ranked = [...employees].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const rankMap = new Map(ranked.map((e, i) => [e.name, i + 1]));

    const lines = employees.map(e => {
      const rank   = rankMap.get(e.name)!;
      const vsAvg  = teamAvg > 0
        ? `${e.totalSpend > teamAvg ? '+' : ''}${Math.round((e.totalSpend - teamAvg) / teamAvg * 100)}% vs team avg`
        : 'no comparison available';
      const cats = e.topCats.map(c => `${c.label} ($${c.total.toFixed(0)})`).join(', ') || 'no transactions';
      return `${e.name} — rank ${rank}/8, score ${e.score}/100: $${e.totalSpend.toFixed(0)} spend (${vsAvg}), ` +
             `${e.transactionCount} transactions, ${e.preauthViolations} pre-auth flags, ` +
             `${e.splitPairCount} split-charge pairs, ${e.deniedRequests} denied requests. ` +
             `Top categories: ${cats}.`;
    }).join('\n');

    const prompt = `You are a fleet manager's assistant reviewing employee expense compliance for a trucking company.

Period: ${PERIOD_LABEL[safePeriod]}
Team average spend: $${teamAvg.toFixed(0)}
Pre-authorization threshold: $${limits.preauthThreshold}

Employee data:
${lines}

Write exactly one sentence per employee explaining their compliance score in plain, manager-friendly language. Be specific: name the actual issue (e.g. "3 pre-auth flags on fuel purchases") or, for clean records, note what makes them stand out positively. Max 30 words per sentence.

Return JSON: { "insights": { "EmployeeName": "one sentence", ... } }`;

    const result = await askClaude(prompt, InsightsSchema);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
