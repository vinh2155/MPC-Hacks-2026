import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { askClaude, type ClaudeError } from '../lib/claude';

const router = Router();

// ── Request / history schemas ─────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
type Message = z.infer<typeof MessageSchema>;

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  history: z.array(MessageSchema).default([]),
});

// ── Per-step response schemas ─────────────────────────────────────────────────

const IntentSchema = z.object({
  filters: z.object({
    employeeNames: z.array(z.string()).optional(),
    dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
    categories: z.array(z.string()).optional(),
    metric: z.string().optional(),
  }),
  intent: z.string(),
});

const SqlSchema = z.object({ sql: z.string() });

const InsightSchema = z.object({ insight: z.string() });

const VisualizationSchema = z.object({
  answer: z.string(),
  visualization: z.object({
    type: z.enum(['bar', 'pie', 'line', 'table', 'number']),
    title: z.string(),
    data: z.array(z.unknown()),
    config: z.record(z.unknown()),
  }),
  followUpSuggestions: z.array(z.string()).min(1).max(5),
  metadata: z.object({
    dateRange: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
  }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const DB_SCHEMA = `
transactions (
  transaction_code INTEGER, transaction_description TEXT, transaction_category INTEGER,
  posting_date TEXT, transaction_date TEXT, merchant_name TEXT, amount REAL,
  debit_or_credit TEXT, merchant_category_code INTEGER, merchant_city TEXT,
  merchant_country TEXT, merchant_postal_code TEXT, merchant_state TEXT,
  conversion_rate REAL, employee_name TEXT, category_label TEXT
)
requests (
  id TEXT, employee_name TEXT, item_description TEXT, amount REAL,
  category TEXT, reason TEXT,
  status TEXT CHECK(status IN ('pending','approved','denied')), created_at TEXT
)
Notes:
- Only debit_or_credit = 'debit' rows count toward spend totals
- Employees: Jordan, Maya, Tyler, Priya, Marcus, Sofia, Ethan, Leila
- category_label values: Fuel, Meals, Vehicle Maintenance, Government Permits, Parts & Supplies, Tolls & Permits
- Dates stored as TEXT in YYYY-MM-DD format
`.trim();

function isReadOnly(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return (
    (upper.startsWith('SELECT') || upper.startsWith('WITH')) &&
    !/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE|ATTACH|DETACH|PRAGMA|VACUUM)\b/.test(upper)
  );
}

function formatHistory(history: Message[]): string {
  return history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }
    const { message, history } = parsed.data;
    const recentHistory = history.slice(-10);
    const historyBlock = recentHistory.length > 0
      ? `\n\nConversation history:\n${formatHistory(recentHistory)}`
      : '';

    // Step 1 — Intent extraction
    const intent = await askClaude(
      `Extract intent and filters from this message about company spending data.
User message: "${message}"${historyBlock}

Employees: Jordan, Maya, Tyler, Priya, Marcus, Sofia, Ethan, Leila
Categories: Fuel, Meals, Vehicle Maintenance, Government Permits, Parts & Supplies, Tolls & Permits

Return JSON with:
- intent: one sentence describing what the user wants to know
- filters: optional narrowing (employeeNames[], dateRange {start,end}, categories[], metric)`,
      IntentSchema,
    );

    // Step 2 — SQL generation + execution
    const { sql } = await askClaude(
      `Generate a SQLite SELECT query to answer this intent.

Schema:
${DB_SCHEMA}

Intent: "${intent.intent}"
Filters: ${JSON.stringify(intent.filters)}

Rules:
- SELECT only — no mutations
- Add LIMIT 100 unless the query is a single-row aggregate
- Use BETWEEN or >= / <= for date ranges (text comparison works for YYYY-MM-DD)

Return JSON: { "sql": "SELECT ..." }`,
      SqlSchema,
    );

    if (!isReadOnly(sql)) {
      return void res.status(400).json({ error: 'Generated SQL is not a read-only SELECT' });
    }

    // Enforce row cap server-side in case Claude omits LIMIT
    const cappedSql = /\bLIMIT\b/i.test(sql)
      ? sql
      : `${sql.trimEnd().replace(/;$/, '')} LIMIT 100`;

    let rows: unknown[];
    try {
      rows = db.prepare(cappedSql).all();
    } catch (sqlErr) {
      return void res.status(400).json({ error: 'SQL execution failed', details: String(sqlErr) });
    }

    // Step 3 — Contextual analysis
    const { insight } = await askClaude(
      `Analyze these query results and provide a concise insight.

User question: "${message}"
Intent: "${intent.intent}"
Results (${rows.length} rows): ${JSON.stringify(rows.slice(0, 20))}

Return JSON: { "insight": "2-3 sentence analysis of the key finding" }`,
      InsightSchema,
    );

    // Step 4 — Visualization + final response
    const response = await askClaude(
      `Generate a complete response with the best visualization for this data.

User question: "${message}"
Insight: "${insight}"
Data (${rows.length} rows): ${JSON.stringify(rows.slice(0, 50))}

Visualization type guide:
- "bar": comparing values across categories or employees
- "pie": showing proportional breakdown of a total
- "line": spending over time
- "table": listing individual transactions or records
- "number": a single key metric (e.g. total spend)

Return JSON with ALL of these fields:
- answer: a friendly 1-2 sentence response to the user's question
- visualization.type: one of bar/pie/line/table/number
- visualization.title: a short descriptive chart title
- visualization.data: array of data objects for the chart (e.g. [{ label: "Fuel", value: 1234 }])
- visualization.config: chart config object (use {} if no special config needed)
- followUpSuggestions: array of 1–5 follow-up questions the manager might ask next
- metadata.dateRange: describe the date coverage (e.g. "Jan–May 2025" or "all time")
- metadata.confidence: "high" if data directly answers the question, "medium" if approximate, "low" if inferred`,
      VisualizationSchema,
    );

    res.json({ ...response, metadata: { ...response.metadata, rowsAnalyzed: rows.length } });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'raw' in err) {
      return void res.status(502).json({ error: 'AI processing failed', details: (err as ClaudeError).error });
    }
    next(err);
  }
});

export default router;
