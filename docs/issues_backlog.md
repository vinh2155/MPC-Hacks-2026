# Brianna — Issues Backlog

Organized: Foundation → Features → Polish

---

## FOUNDATION

### #1 — Backend scaffold
**Owner:** Backend | **Complexity:** Small

Set up the Express + TypeScript backend project under `backend/`.

**Description:**
Initialize a Node.js project with TypeScript, Express, `better-sqlite3`, `xlsx`, `zod`, and `@anthropic-ai/sdk`. Include a `.env.example` with `ANTHROPIC_API_KEY` and `PORT`. Set up `tsconfig.json`, `nodemon` for dev, and a `npm run dev` / `npm run build` script.

**Acceptance Criteria:**
- `npm run dev` starts the server on port 3001
- `GET /api/health` returns `{ status: "ok" }`
- TypeScript compiles without errors
- `.env.example` documents all required env vars

**Dependencies:** None

---

### #2 — Frontend scaffold
**Owner:** Frontend | **Complexity:** Small

Set up the React + Vite + TypeScript frontend project under `frontend/`.

**Description:**
Initialize with `npm create vite@latest` using the React + TypeScript template. Install `recharts`, `axios` (or native fetch wrapper), and a minimal CSS reset or Tailwind. Remove boilerplate. Set up a proxy in `vite.config.ts` to forward `/api` requests to `http://localhost:3001`.

**Acceptance Criteria:**
- `npm run dev` starts the app at `http://localhost:5173`
- `/api` requests proxy to backend without CORS errors
- TypeScript compiles without errors

**Dependencies:** #1

---

### #3 — Data layer: load transactions into SQLite
**Owner:** Backend | **Complexity:** Medium

At server startup, parse `data/transactions.xlsx` and load it into a SQLite in-memory database.

**Description:**
Create `backend/src/db/index.ts`. On startup:
1. Read `data/transactions.xlsx` using the `xlsx` package
2. Create a SQLite in-memory DB with `new Database(':memory:')`
3. Create a `transactions` table with columns matching the Excel headers (snake_case): `transaction_code`, `transaction_description`, `transaction_category`, `posting_date`, `transaction_date`, `merchant_name`, `amount`, `debit_or_credit`, `merchant_category_code`, `merchant_city`, `merchant_country`, `merchant_postal_code`, `merchant_state`, `conversion_rate`, `employee_name`, `category_label`
4. Create a `requests` table for employee purchase requests: `id` (uuid), `employee_name`, `item_description`, `amount`, `category`, `reason`, `status` (pending/approved/denied), `created_at`
5. Bulk-insert all Excel rows into `transactions`
6. Export the `db` instance for use across the app

**Acceptance Criteria:**
- Server logs row count on startup (e.g. "Loaded 4235 transactions into SQLite")
- `GET /api/debug/transactions?limit=5` returns 5 rows as JSON
- `requests` table exists and accepts inserts

**Dependencies:** #1

---

### #4 — Claude API client with Zod validation
**Owner:** Backend | **Complexity:** Small

Create a reusable server-side Claude wrapper that validates all structured responses with Zod and retries once on parse failure.

**Description:**
Create `backend/src/lib/claude.ts`. Export a function `askClaude<T>(prompt: string, schema: ZodSchema<T>, options?): Promise<T>` that:
1. Calls `anthropic.messages.create` with the given prompt, requesting JSON output
2. Parses the response with `schema.safeParse`
3. On parse failure, retries once with an error-correction prompt
4. On second failure, throws a structured error: `{ error: string, raw: string }`

Use `claude-opus-4-6` as the default model. System prompt should instruct Claude to always respond with valid JSON matching the requested schema.

**Acceptance Criteria:**
- Valid Claude response passes Zod parsing and returns typed result
- Invalid response triggers one retry
- Second failure throws structured error (not unhandled exception)

**Dependencies:** #1

---

### #5 — Role toggle UI
**Owner:** Frontend | **Complexity:** Small

Add an Employee / Manager toggle to the top nav that switches between the two views.

**Description:**
Create a `RoleContext` (React context + `useState`) that holds `role: 'employee' | 'manager'`. Add a toggle button in the nav bar (e.g. "Switch to Manager" / "Switch to Employee"). The toggle is purely client-side state — no API call needed. Wrap the app in `RoleProvider` and use `useRole()` hook to conditionally render Employee or Manager views.

**Acceptance Criteria:**
- Toggle button visible in top nav at all times
- Switching role immediately changes the visible view
- Manager view shows: Budget Tracker, Chat, Compliance, Approvals Inbox, Reports tabs
- Employee view shows: Submit Request form and Request Status screen only

**Dependencies:** #2

---

## FEATURES

### #6 — Budget summary API endpoint
**Owner:** Backend | **Complexity:** Small

Expose a `GET /api/budget/summary` endpoint that returns total spend, total budget, and spend by category.

**Description:**
Query the `transactions` table for the sum of all `amount` values (debit only). Use a hardcoded total budget of `$50,000` for the prototype (make it a constant in a config file so it can be changed). Also return spend grouped by `category_label`. Response shape:
```json
{
  "totalSpend": 38200.50,
  "totalBudget": 50000,
  "utilizationPct": 76.4,
  "byCategory": [
    { "label": "Fuel", "amount": 12400.00 },
    ...
  ]
}
```
Include approved request amounts in `totalSpend` (join `requests` table where `status = 'approved'`).

**Acceptance Criteria:**
- Returns correct totals from SQLite
- Approved requests are included in the spend total
- Response time < 200ms

**Dependencies:** #3

---

### #7 — Budget gauge UI (main dashboard)
**Owner:** Frontend | **Complexity:** Medium

Build the animated budget bar/gauge component that is the manager's landing view.

**Description:**
Create `frontend/src/components/BudgetGauge.tsx`. Fetch from `GET /api/budget/summary` on mount and on a 5-second polling interval. Display:
- A large animated fill bar (CSS transition or Recharts `RadialBarChart`) showing `utilizationPct`
- Dollar amounts: "£38,200 of $50,000 spent"
- Color: green < 70%, yellow 70–90%, red > 90%
- Clicking the bar opens a modal/drawer with the category breakdown (see #8)

**Acceptance Criteria:**
- Bar visible on manager dashboard load with no user action
- Color changes at correct thresholds
- Clicking opens breakdown view
- Polls every 5s; updates without page refresh after an approval

**Dependencies:** #5, #6

---

### #8 — Category breakdown pie chart
**Owner:** Frontend | **Complexity:** Small

Render a Recharts `PieChart` showing spend by `category_label` inside the breakdown modal/drawer opened from the budget gauge.

**Description:**
Use data from `GET /api/budget/summary` (`byCategory` array). Render a `PieChart` with `Tooltip` showing label + amount + percentage. Show top 8 categories; group the rest as "Other". Display a legend below the chart.

**Acceptance Criteria:**
- Uses `category_label` values — no raw MCC codes visible
- Tooltip shows category name, dollar amount, and percentage of total
- "Other" group used when > 8 categories
- Renders inside the breakdown modal opened from #7

**Dependencies:** #7

---

### #9 — Chat AI chain backend
**Owner:** Backend | **Complexity:** Large

Implement the 4-step AI chain for the natural language chat feature.

**Description:**
Create `POST /api/chat` accepting `{ message: string, history: Message[] }`. Execute 4 steps:

1. **Intent extraction** — Claude call with Zod schema:
   `{ filters: { employeeNames?, dateRange?, categories?, metric? }, intent: string }`

2. **SQL generation** — Claude call with the DB schema and intent. Claude returns a SQL SELECT query. Execute it against SQLite. Return rows to Claude.

3. **Contextual analysis** — Claude call with rows + question. Returns `{ insight: string }` (2–3 sentences).

4. **Visualization selection** — Claude call returns final response:
   `{ answer, visualization: { type, title, data[], config }, followUpSuggestions: [x3], metadata: { rowsAnalyzed, dateRange, confidence } }`

Validate each Claude step with Zod. Preserve `history` across turns (pass last 10 messages as context).

**Acceptance Criteria:**
- Returns correct response schema (answer, visualization, followUpSuggestions, metadata)
- SQL is executed safely (read-only; never allow INSERT/UPDATE/DELETE from Claude-generated SQL)
- Conversation history passed for ≥10 turns
- Responds in < 8s for typical queries
- Returns structured error if any Claude step fails twice

**Dependencies:** #3, #4

---

### #10 — Chat UI
**Owner:** Frontend | **Complexity:** Medium

Build the chat interface that renders AI responses including visualizations and follow-up suggestion chips.

**Description:**
Create `frontend/src/pages/ChatPage.tsx`. Features:
- Message thread (user messages right-aligned, AI responses left-aligned)
- AI response renders: text answer + appropriate Recharts chart (bar, line, pie, table, or summary card based on `visualization.type`)
- Below each AI response: 3 clickable follow-up suggestion chips that pre-fill the input
- Input box + send button at the bottom
- Loading spinner while awaiting response
- Conversation history maintained in component state and sent with each request

**Acceptance Criteria:**
- All 6 visualization types render correctly (bar_chart, line_chart, pie_chart, table, summary_card, none)
- Follow-up chips are clickable and send the suggested query
- History preserved across ≥10 turns in the same session
- Ambiguous query shows Claude's clarifying question as a normal message

**Dependencies:** #5, #9

---

### #11 — Compliance scan backend
**Owner:** Backend | **Complexity:** Large

Implement the 3-step AI chain that scans all transactions against Brim's expense policy.

**Description:**
Create `POST /api/compliance/scan`. Execute 3 steps per transaction batch (process in batches of 50 to stay within context limits):

1. **Context gathering** — for each transaction, pull the employee's last 30 days of spend from SQLite

2. **Policy comparison** — Claude call with transaction batch + policy rules + employee context. Claude reasons about each transaction. Policy rules to encode:
   - Expenses > $50 require pre-authorization
   - Alcohol only with customer (names + purpose required)
   - Tips: max 15% services, max 20% meals
   - Corporate card: no personal expenses
   - Travel: most cost-effective; CRA km rate
   - Parking tickets not reimbursable

3. **Severity scoring** — Claude returns array of violation records:
   `{ transaction_id, employee_name, violation_type, policy_rule_cited, severity, reasoning, is_repeat_offender }`

Also implement split-charge detection in SQL: same employee, amounts within 10% of each other, same merchant, within 48h.

Also expose `GET /api/compliance/score` returning `{ score: number, totalTransactions: number, violations: number }`.

**Acceptance Criteria:**
- Each violation includes the specific policy clause cited
- Repeat offender flag set when ≥3 violations within 30 days for same employee
- Split-charge detection works independently of Claude (pure SQL)
- `/api/compliance/score` returns correct percentage
- Scans 1,000 transactions in < 30s

**Dependencies:** #3, #4

---

### #12 — Compliance dashboard UI
**Owner:** Frontend | **Complexity:** Medium

Display the compliance scan results: violations list with severity badges, repeat offender flags, and the compliance score in the dashboard header.

**Description:**
Create `frontend/src/pages/CompliancePage.tsx`. Features:
- "Run Scan" button that calls `POST /api/compliance/scan` and shows a progress indicator
- Violations list: each row shows employee name, transaction amount, merchant, violation type, severity badge (color-coded: red=critical, orange=high, yellow=medium, blue=low), and expandable reasoning text
- Filter bar: filter by severity, employee name
- Repeat offender badge on employee name when `is_repeat_offender: true`
- Compliance score (from `GET /api/compliance/score`) shown in the top nav/header bar at all times

**Acceptance Criteria:**
- Severity badges are color-coded correctly
- Reasoning text is expandable/collapsible per row
- Repeat offender badge visible
- Compliance score in header updates after scan
- Filter by severity and employee works client-side

**Dependencies:** #5, #11

---

### #13 — Employee request form
**Owner:** Frontend | **Complexity:** Small

Build the employee-facing request submission form and pending status screen.

**Description:**
Create `frontend/src/pages/EmployeeRequestPage.tsx`. Two states:
1. **Form state:** Fields: employee name (text), item description (text), amount (number), category (dropdown using the known category labels), reason (textarea). Submit button calls `POST /api/requests`.
2. **Pending state:** After submission, show: "Request submitted — pending manager review" with the request details and current status. Poll `GET /api/requests/:id` every 5s to update status to approved/denied.

**Acceptance Criteria:**
- Form validates all fields before submission (no empty fields, amount > 0)
- Category dropdown uses the human-readable labels (Fuel, Meals, etc.) — not MCC codes
- After submit, shows pending screen immediately
- Status updates to "Approved" or "Denied" when manager decides (via polling)

**Dependencies:** #3, #5

---

### #14 — Approvals inbox backend
**Owner:** Backend | **Complexity:** Medium

Expose endpoints for listing pending requests and generating Claude approval recommendations.

**Description:**
- `POST /api/requests` — insert a new request into the `requests` table, return `{ id }`
- `GET /api/requests` — return all requests, newest first
- `GET /api/requests/:id` — return single request by id
- `PATCH /api/requests/:id` — update `status` to `approved` or `denied`; when approved, add `amount` to a running approved-spend total (store in memory or a `budget_adjustments` table)
- `POST /api/requests/:id/recommendation` — Claude call that returns:
  `{ recommendation: "approve" | "deny" | "escalate", reasoning: string }`
  Claude is given: request details, employee's last 30 days of transactions from SQLite, current budget utilization

**Acceptance Criteria:**
- All CRUD endpoints work correctly
- Recommendation includes employee spend history context
- Approving a request causes `GET /api/budget/summary` to reflect the new amount
- Recommendation generated in < 8s

**Dependencies:** #3, #4

---

### #15 — Approvals inbox UI (manager view)
**Owner:** Frontend | **Complexity:** Medium

Build the manager's approvals inbox showing pending requests with AI recommendations and one-click decisions.

**Description:**
Create `frontend/src/pages/ApprovalsPage.tsx`. On load, fetch all requests from `GET /api/requests`. For each pending request, immediately fetch its recommendation from `POST /api/requests/:id/recommendation`. Display per request:
- Employee name, amount, category, reason
- Employee's recent spend summary (from recommendation response context)
- Budget impact if approved (e.g. "Budget utilization goes from 76% → 79%")
- Claude recommendation chip: green "Approve", red "Deny", or yellow "Escalate" with reasoning paragraph
- Two buttons: "Approve" and "Deny" — call `PATCH /api/requests/:id` with the decision

**Acceptance Criteria:**
- Pending requests load on page open
- Recommendation displayed alongside each request (loading state while fetching)
- Approve/Deny buttons call the API and immediately move the request to a "Resolved" section
- Budget gauge (F0) updates in real time after decision

**Dependencies:** #7, #14

---

### #16 — Period report backend
**Owner:** Backend | **Complexity:** Medium

Implement the Claude-generated period report (weekly or monthly exec memo).

**Description:**
Create `POST /api/reports/period` accepting `{ period: "weekly" | "monthly" }`. Steps:
1. Query SQLite for the relevant date range: total spend, spend by category, top 5 transactions by amount, violations from last scan, approved/denied request counts, budget utilization
2. Claude call with all queried data. Claude generates a plain-English executive memo covering all required sections (total spend vs budget, top categories, notable transactions, policy violations, approvals/denials, budget health summary)
3. Return: `{ period, generatedAt, narrative: string, data: { ... raw figures ... } }`

**Acceptance Criteria:**
- Returns correct date range for weekly (last 7 days) and monthly (last 30 days)
- Narrative includes all 6 required sections
- Budget utilization percentage included in narrative
- Completes in < 15s

**Dependencies:** #3, #4, #11

---

### #17 — Employee report backend
**Owner:** Backend | **Complexity:** Medium

Implement the Claude-generated employee spend profile report.

**Description:**
Create `POST /api/reports/employee` accepting `{ employeeName: string }`. Steps:
1. Query SQLite: total spend for employee, spend by category, all requests and their statuses, any compliance violations for this employee
2. Query team average spend across all employees
3. Claude call with all data. Claude generates a full spend profile narrative including comparison to team average
4. Return: `{ employeeName, generatedAt, narrative: string, data: { totalSpend, byCategory, requests, violations, teamAvgSpend } }`

Also expose `GET /api/employees` returning the list of unique `employee_name` values for the frontend dropdown.

**Acceptance Criteria:**
- `GET /api/employees` returns the 8 employee names
- Report includes category breakdown, all requests with outcomes, policy flags
- Team average comparison included in narrative
- Completes in < 15s

**Dependencies:** #3, #4

---

### #18 — Reports tab UI
**Owner:** Frontend | **Complexity:** Medium

Build the reports tab UI with report type selector, controls, rendered narrative, and JSON download.

**Description:**
Create `frontend/src/pages/ReportsPage.tsx`. Two modes toggled by a tab/segmented control:

**Period Report mode:**
- Weekly / Monthly selector (radio or segmented control)
- "Generate Report" button → calls `POST /api/reports/period`
- Loading state while generating
- Renders narrative as formatted text with section headers
- "Download JSON" button

**Employee Report mode:**
- Dropdown populated from `GET /api/employees`
- "Generate Report" button → calls `POST /api/reports/employee`
- Renders narrative as formatted text
- "Download JSON" button

**Acceptance Criteria:**
- Both report types render correctly
- "Download JSON" triggers a browser download of the full response JSON
- Loading spinner shown during generation (can take up to 15s)
- Employee dropdown populated with correct names

**Dependencies:** #5, #16, #17

---

## POLISH

### #19 — Real-time budget sync on approval
**Owner:** Fullstack | **Complexity:** Small

Ensure the budget gauge (F0) updates immediately when the manager approves or denies a request in the approvals inbox.

**Description:**
After `PATCH /api/requests/:id` resolves, the `ApprovalsPage` should invalidate the budget summary cache and trigger a refetch in `BudgetGauge`. Use a shared React context or a simple event emitter to signal the budget gauge to refetch from `GET /api/budget/summary`.

**Acceptance Criteria:**
- Budget gauge visually updates within 1s of an approval decision — no page refresh required
- Works for both approve and deny

**Dependencies:** #7, #15

---

### #20 — Compliance score in dashboard header
**Owner:** Frontend | **Complexity:** Small

Show the compliance score (% clean transactions) in the top nav bar at all times on the manager view.

**Description:**
Fetch `GET /api/compliance/score` when the manager role is active. Display in the nav: "Compliance: 94%" with color coding (green ≥ 90%, yellow 75–89%, red < 75%). Refetch after each compliance scan.

**Acceptance Criteria:**
- Score visible in nav on manager view at all times
- Updates after a scan without page refresh
- Color-coded correctly

**Dependencies:** #5, #11, #12

---

### #21 — Split-charge detection UI callout
**Owner:** Frontend | **Complexity:** Small

Highlight split-charge violations distinctly in the compliance violations list.

**Description:**
When a violation has `violation_type: "split_charge"`, render a distinct badge ("Split Charge Detected") and group the related transactions together visually in the violations list so the manager can see the pattern clearly.

**Acceptance Criteria:**
- Split-charge violations have a distinct visual badge
- Related transactions (same employee, merchant, date range) are visually grouped
- Grouping works for 2+ transactions in the pattern

**Dependencies:** #12

---

### #22 — JSON export for reports
**Owner:** Frontend | **Complexity:** Small

"Download JSON" button on the Reports tab triggers a proper browser download of the report data.

**Description:**
On click, serialize the full API response to a JSON string, create a `Blob`, and use `URL.createObjectURL` + a temporary `<a>` element to trigger the download. Filename format: `brianna-report-{type}-{date}.json`.

**Acceptance Criteria:**
- Download triggers immediately on click
- File is valid JSON that can be opened in any editor
- Filename includes report type and date

**Dependencies:** #18
