#!/bin/bash
# Run this script once after installing and authenticating the GitHub CLI:
#   winget install --id GitHub.cli
#   gh auth login
#
# Usage: bash docs/create_issues.sh

REPO="vinh2155/MPC-Hacks-2026"

echo "Creating GitHub issues for $REPO..."

gh issue create --repo $REPO --title "[Foundation] Backend scaffold" \
--body "## Description
Set up the Express + TypeScript backend project under \`backend/\`.

Initialize a Node.js project with TypeScript, Express, \`better-sqlite3\`, \`xlsx\`, \`zod\`, and \`@anthropic-ai/sdk\`. Include a \`.env.example\` with \`ANTHROPIC_API_KEY\` and \`PORT\`. Set up \`tsconfig.json\`, nodemon for dev, and \`npm run dev\` / \`npm run build\` scripts.

## Acceptance Criteria
- \`npm run dev\` starts the server on port 3001
- \`GET /api/health\` returns \`{ status: \"ok\" }\`
- TypeScript compiles without errors
- \`.env.example\` documents all required env vars

## Metadata
- **Complexity:** Small | **Owner:** Backend | **Dependencies:** None"

gh issue create --repo $REPO --title "[Foundation] Frontend scaffold" \
--body "## Description
Set up the React + Vite + TypeScript frontend project under \`frontend/\`.

Initialize with \`npm create vite@latest\` using the React + TypeScript template. Install \`recharts\` and a CSS reset or Tailwind. Set up a proxy in \`vite.config.ts\` to forward \`/api\` requests to \`http://localhost:3001\`.

## Acceptance Criteria
- \`npm run dev\` starts the app at \`http://localhost:5173\`
- \`/api\` requests proxy to backend without CORS errors
- TypeScript compiles without errors

## Metadata
- **Complexity:** Small | **Owner:** Frontend | **Dependencies:** #1"

gh issue create --repo $REPO --title "[Foundation] Data layer: load transactions into SQLite" \
--body "## Description
At server startup, parse \`data/transactions.xlsx\` and load it into a SQLite in-memory database.

Create \`backend/src/db/index.ts\`. On startup:
1. Read \`data/transactions.xlsx\` using the \`xlsx\` package
2. Create a SQLite in-memory DB with \`new Database(':memory:')\`
3. Create a \`transactions\` table with all 16 columns (snake_case): \`transaction_code\`, \`transaction_description\`, \`transaction_category\`, \`posting_date\`, \`transaction_date\`, \`merchant_name\`, \`amount\`, \`debit_or_credit\`, \`merchant_category_code\`, \`merchant_city\`, \`merchant_country\`, \`merchant_postal_code\`, \`merchant_state\`, \`conversion_rate\`, \`employee_name\`, \`category_label\`
4. Create a \`requests\` table: \`id\` (uuid), \`employee_name\`, \`item_description\`, \`amount\`, \`category\`, \`reason\`, \`status\` (pending/approved/denied), \`created_at\`
5. Bulk-insert all 4,235 Excel rows

## Acceptance Criteria
- Server logs row count on startup: \"Loaded 4235 transactions into SQLite\"
- \`GET /api/debug/transactions?limit=5\` returns 5 rows as JSON
- \`requests\` table exists and accepts inserts

## Metadata
- **Complexity:** Medium | **Owner:** Backend | **Dependencies:** #1"

gh issue create --repo $REPO --title "[Foundation] Claude API client with Zod validation" \
--body "## Description
Create a reusable server-side Claude wrapper at \`backend/src/lib/claude.ts\`.

Export \`askClaude<T>(prompt, schema, options?): Promise<T>\` that:
1. Calls \`anthropic.messages.create\` requesting JSON output
2. Parses response with \`schema.safeParse()\`
3. On parse failure, retries once with an error-correction prompt
4. On second failure, throws \`{ error: string, raw: string }\`

Use \`claude-opus-4-6\` as default model. System prompt instructs Claude to always return valid JSON matching the requested schema.

## Acceptance Criteria
- Valid Claude response returns typed result
- Invalid response triggers one retry
- Second failure throws structured error (not unhandled exception)

## Metadata
- **Complexity:** Small | **Owner:** Backend | **Dependencies:** #1"

gh issue create --repo $REPO --title "[Foundation] Role toggle UI (Employee / Manager)" \
--body "## Description
Add an Employee / Manager toggle to the top nav that switches between the two views.

Create a \`RoleContext\` (React context + \`useState\`) holding \`role: 'employee' | 'manager'\`. Add a toggle button in the nav bar. Wrap the app in \`RoleProvider\` and use a \`useRole()\` hook to conditionally render views.

- **Manager view tabs:** Budget Tracker, Chat, Compliance, Approvals Inbox, Reports
- **Employee view:** Submit Request form and Request Status screen only

## Acceptance Criteria
- Toggle button visible in top nav at all times
- Switching role immediately changes the visible view
- No API call needed — purely client-side state

## Metadata
- **Complexity:** Small | **Owner:** Frontend | **Dependencies:** #2"

gh issue create --repo $REPO --title "[F0] Budget summary API endpoint" \
--body "## Description
Expose \`GET /api/budget/summary\` returning total spend, budget, utilization, and spend by category.

Response shape:
\`\`\`json
{
  \"totalSpend\": 38200.50,
  \"totalBudget\": 50000,
  \"utilizationPct\": 76.4,
  \"byCategory\": [{ \"label\": \"Fuel\", \"amount\": 12400.00 }]
}
\`\`\`

Use a hardcoded \`TOTAL_BUDGET = 50000\` constant. Include approved request amounts in \`totalSpend\` (join \`requests\` where \`status = 'approved'\`).

## Acceptance Criteria
- Returns correct totals from SQLite
- Approved requests included in spend total
- Response time < 200ms

## Metadata
- **Complexity:** Small | **Owner:** Backend | **Dependencies:** #3"

gh issue create --repo $REPO --title "[F0] Budget gauge UI (main dashboard)" \
--body "## Description
Build the animated budget bar/gauge — the manager's landing view — at \`frontend/src/components/BudgetGauge.tsx\`.

- Fetch from \`GET /api/budget/summary\` on mount, poll every 5s
- Display animated fill bar (Recharts \`RadialBarChart\` or CSS transition) showing \`utilizationPct\`
- Show: \"$38,200 of $50,000 spent\"
- Color: green < 70%, yellow 70–90%, red > 90%
- Clicking opens category breakdown modal (see #8)

## Acceptance Criteria
- Bar visible on manager dashboard load with no user action
- Color changes at correct thresholds
- Clicking opens breakdown view
- Updates without page refresh after an approval (via polling)

## Metadata
- **Complexity:** Medium | **Owner:** Frontend | **Dependencies:** #5, #6"

gh issue create --repo $REPO --title "[F0] Category breakdown pie chart" \
--body "## Description
Render a Recharts \`PieChart\` showing spend by \`category_label\` inside the breakdown modal opened from the budget gauge.

- Use \`byCategory\` from \`GET /api/budget/summary\`
- Show top 8 categories; group rest as \"Other\"
- Tooltip: label + dollar amount + % of total
- Legend below chart

## Acceptance Criteria
- Uses \`category_label\` values — no raw MCC codes visible anywhere
- \"Other\" group used when > 8 categories
- Renders inside modal opened from budget gauge (#7)

## Metadata
- **Complexity:** Small | **Owner:** Frontend | **Dependencies:** #7"

gh issue create --repo $REPO --title "[F1] Natural language chat — backend AI chain" \
--body "## Description
Implement the 4-step AI chain at \`POST /api/chat\` accepting \`{ message: string, history: Message[] }\`.

**Step 1 — Intent extraction:** Claude call → \`{ filters: { employeeNames?, dateRange?, categories?, metric? }, intent: string }\`

**Step 2 — SQL generation:** Claude generates a SQL SELECT query given the DB schema + intent. Execute against SQLite. Return rows.

**Step 3 — Contextual analysis:** Claude call with rows + question → \`{ insight: string }\`

**Step 4 — Visualization selection:** Claude returns final response:
\`\`\`json
{
  \"answer\": \"string\",
  \"visualization\": { \"type\", \"title\", \"data\": [], \"config\": {} },
  \"followUpSuggestions\": [\"...\", \"...\", \"...\"],
  \"metadata\": { \"rowsAnalyzed\", \"dateRange\", \"confidence\" }
}
\`\`\`

Validate each step with Zod. Pass last 10 messages as context. **Never allow INSERT/UPDATE/DELETE in Claude-generated SQL.**

## Acceptance Criteria
- Returns correct response schema
- SQL is read-only (validate before execution)
- Conversation history passed for ≥10 turns
- Responds in < 8s for typical queries

## Metadata
- **Complexity:** Large | **Owner:** Backend | **Dependencies:** #3, #4"

gh issue create --repo $REPO --title "[F1] Natural language chat — frontend UI" \
--body "## Description
Build the chat interface at \`frontend/src/pages/ChatPage.tsx\`.

- Message thread: user messages right-aligned, AI responses left-aligned
- AI response renders: text answer + appropriate Recharts chart based on \`visualization.type\` (bar_chart, line_chart, pie_chart, table, summary_card, none)
- 3 clickable follow-up suggestion chips below each AI response
- Input box + send button at bottom
- Loading spinner while awaiting response
- History maintained in component state, sent with each request

## Acceptance Criteria
- All 6 visualization types render correctly
- Follow-up chips pre-fill and send the query on click
- History preserved across ≥10 turns in the same session

## Metadata
- **Complexity:** Medium | **Owner:** Frontend | **Dependencies:** #5, #9"

gh issue create --repo $REPO --title "[F2] Policy compliance engine — backend AI chain" \
--body "## Description
Implement the 3-step compliance scan at \`POST /api/compliance/scan\`. Process transactions in batches of 50.

**Step 1 — Context gathering:** For each transaction, pull employee's last 30 days of spend from SQLite.

**Step 2 — Policy comparison:** Claude reasons about each transaction against these rules:
- Expenses > \$50 require pre-authorization
- Alcohol only with customer (names + purpose required)
- Tips: max 15% services, max 20% meals
- Corporate card: no personal expenses
- Travel: most cost-effective; CRA km rate
- Parking tickets not reimbursable

**Step 3 — Severity scoring:** Claude returns violation records:
\`\`\`json
{ \"transaction_id\", \"employee_name\", \"violation_type\", \"policy_rule_cited\", \"severity\": \"critical|high|medium|low\", \"reasoning\", \"is_repeat_offender\" }
\`\`\`

Also implement split-charge detection in pure SQL (same employee, amounts within 10%, same merchant, within 48h).

Expose \`GET /api/compliance/score\` → \`{ score, totalTransactions, violations }\`.

## Acceptance Criteria
- Each violation includes the specific policy clause cited
- Repeat offender flag when ≥3 violations within 30 days for same employee
- Split-charge detection works independently of Claude
- Scans 1,000 transactions in < 30s

## Metadata
- **Complexity:** Large | **Owner:** Backend | **Dependencies:** #3, #4"

gh issue create --repo $REPO --title "[F2] Compliance dashboard UI" \
--body "## Description
Build the compliance results view at \`frontend/src/pages/CompliancePage.tsx\`.

- \"Run Scan\" button → calls \`POST /api/compliance/scan\` with progress indicator
- Violations list: employee name, amount, merchant, violation type, severity badge (red=critical, orange=high, yellow=medium, blue=low), expandable reasoning
- Filter bar: by severity and employee name (client-side)
- Repeat offender badge on employee name when \`is_repeat_offender: true\`
- Compliance score from \`GET /api/compliance/score\` shown in top nav/header at all times

## Acceptance Criteria
- Severity badges color-coded correctly
- Reasoning expandable/collapsible per row
- Repeat offender badge visible
- Compliance score in header updates after scan

## Metadata
- **Complexity:** Medium | **Owner:** Frontend | **Dependencies:** #5, #11"

gh issue create --repo $REPO --title "[F3] Employee request form + pending status screen" \
--body "## Description
Build the employee-facing request UI at \`frontend/src/pages/EmployeeRequestPage.tsx\`.

**Form state:** Fields: employee name, item description, amount (number), category (dropdown with human-readable labels), reason (textarea). Submit → \`POST /api/requests\`.

**Pending state:** After submit, show request details + current status. Poll \`GET /api/requests/:id\` every 5s to reflect manager's decision.

## Acceptance Criteria
- All fields validated before submit (no empty, amount > 0)
- Category dropdown uses human-readable labels (Fuel, Meals, etc.) — not MCC codes
- Pending screen appears immediately after submit
- Status updates to Approved/Denied without page refresh

## Metadata
- **Complexity:** Small | **Owner:** Frontend | **Dependencies:** #3, #5"

gh issue create --repo $REPO --title "[F3] Approvals inbox — backend endpoints + Claude recommendation" \
--body "## Description
Expose request CRUD + AI recommendation endpoints.

- \`POST /api/requests\` — insert request, return \`{ id }\`
- \`GET /api/requests\` — all requests, newest first
- \`GET /api/requests/:id\` — single request
- \`PATCH /api/requests/:id\` — update status to approved/denied; approved amounts feed into budget totals
- \`POST /api/requests/:id/recommendation\` — Claude call returning:
  \`{ recommendation: \"approve\" | \"deny\" | \"escalate\", reasoning: string }\`
  Claude receives: request details + employee's last 30 days from SQLite + current budget utilization

## Acceptance Criteria
- All CRUD endpoints work correctly
- Recommendation includes employee spend history context
- Approving updates \`GET /api/budget/summary\` totals
- Recommendation generated in < 8s

## Metadata
- **Complexity:** Medium | **Owner:** Backend | **Dependencies:** #3, #4"

gh issue create --repo $REPO --title "[F3] Approvals inbox — manager UI" \
--body "## Description
Build the manager's approvals inbox at \`frontend/src/pages/ApprovalsPage.tsx\`.

On load, fetch all requests from \`GET /api/requests\`. For each pending request, fetch recommendation from \`POST /api/requests/:id/recommendation\`. Display per request:
- Employee name, amount, category, reason
- Budget impact if approved (e.g. \"Utilization goes from 76% → 79%\")
- Claude recommendation chip (green=Approve, red=Deny, yellow=Escalate) + reasoning paragraph
- Approve and Deny buttons → \`PATCH /api/requests/:id\`

## Acceptance Criteria
- Recommendation displayed alongside each request (loading state while fetching)
- Approve/Deny buttons immediately move request to Resolved section
- Budget gauge (#7) updates in real time after decision

## Metadata
- **Complexity:** Medium | **Owner:** Frontend | **Dependencies:** #7, #14"

gh issue create --repo $REPO --title "[F4] Period report — backend" \
--body "## Description
Implement \`POST /api/reports/period\` accepting \`{ period: \"weekly\" | \"monthly\" }\`.

1. Query SQLite for the date range: total spend, spend by category, top 5 transactions by amount, violations from last scan, approved/denied request counts, budget utilization
2. Claude generates plain-English executive memo covering all 6 sections: total spend vs budget, top categories, notable transactions, policy violations, approvals/denials, budget health summary
3. Return: \`{ period, generatedAt, narrative: string, data: { ...raw figures } }\`

## Acceptance Criteria
- Correct date range: weekly = last 7 days, monthly = last 30 days
- Narrative includes all 6 required sections including budget utilization %
- Completes in < 15s

## Metadata
- **Complexity:** Medium | **Owner:** Backend | **Dependencies:** #3, #4, #11"

gh issue create --repo $REPO --title "[F4] Employee report — backend" \
--body "## Description
Implement \`POST /api/reports/employee\` accepting \`{ employeeName: string }\`.

1. Query SQLite: total spend, spend by category, all requests + statuses, compliance violations for this employee
2. Query team average spend across all 8 employees
3. Claude generates full spend profile narrative including team average comparison
4. Return: \`{ employeeName, generatedAt, narrative: string, data: { totalSpend, byCategory, requests, violations, teamAvgSpend } }\`

Also expose \`GET /api/employees\` → list of unique \`employee_name\` values for the frontend dropdown.

## Acceptance Criteria
- \`GET /api/employees\` returns the 8 employee names
- Report includes category breakdown, requests with outcomes, policy flags, team comparison
- Completes in < 15s

## Metadata
- **Complexity:** Medium | **Owner:** Backend | **Dependencies:** #3, #4"

gh issue create --repo $REPO --title "[F4] Reports tab UI" \
--body "## Description
Build the reports tab at \`frontend/src/pages/ReportsPage.tsx\` with two modes toggled by a segmented control.

**Period Report mode:**
- Weekly / Monthly selector
- \"Generate Report\" button → \`POST /api/reports/period\`
- Renders narrative as formatted text with section headers
- \"Download JSON\" button

**Employee Report mode:**
- Dropdown populated from \`GET /api/employees\`
- \"Generate Report\" button → \`POST /api/reports/employee\`
- Renders narrative as formatted text
- \"Download JSON\" button

## Acceptance Criteria
- Both report types render correctly
- \"Download JSON\" triggers a browser file download
- Loading spinner shown during generation (up to 15s)
- Employee dropdown shows all 8 names

## Metadata
- **Complexity:** Medium | **Owner:** Frontend | **Dependencies:** #5, #16, #17"

gh issue create --repo $REPO --title "[Polish] Real-time budget sync on approval" \
--body "## Description
Ensure the budget gauge updates immediately when the manager approves or denies a request — no page refresh needed.

After \`PATCH /api/requests/:id\` resolves in \`ApprovalsPage\`, signal \`BudgetGauge\` to refetch from \`GET /api/budget/summary\`. Use a shared React context or a simple event emitter.

## Acceptance Criteria
- Budget gauge visually updates within 1s of an approval decision
- Works for both approve and deny

## Metadata
- **Complexity:** Small | **Owner:** Fullstack | **Dependencies:** #7, #15"

gh issue create --repo $REPO --title "[Polish] Compliance score in dashboard header" \
--body "## Description
Show the compliance score (% clean transactions) in the top nav bar at all times on the manager view.

Fetch \`GET /api/compliance/score\` when manager role is active. Display \"Compliance: 94%\" with color coding: green ≥ 90%, yellow 75–89%, red < 75%. Refetch after each compliance scan.

## Acceptance Criteria
- Score visible in nav on manager view at all times
- Updates after a scan without page refresh
- Color-coded correctly at thresholds

## Metadata
- **Complexity:** Small | **Owner:** Frontend | **Dependencies:** #5, #11, #12"

gh issue create --repo $REPO --title "[Polish] Split-charge detection UI callout" \
--body "## Description
Highlight split-charge violations distinctly in the compliance violations list.

When \`violation_type === 'split_charge'\`, render a distinct \"Split Charge Detected\" badge and visually group the related transactions (same employee, merchant, date range) so the manager can see the pattern clearly.

## Acceptance Criteria
- Split-charge violations have a distinct visual badge
- Related transactions are visually grouped in the list
- Works for 2+ transactions in the pattern

## Metadata
- **Complexity:** Small | **Owner:** Frontend | **Dependencies:** #12"

gh issue create --repo $REPO --title "[Polish] JSON export for reports" \
--body "## Description
\"Download JSON\" button on the Reports tab triggers a proper browser file download.

On click, serialize the full API response to JSON, create a \`Blob\`, and use \`URL.createObjectURL\` + a temporary \`<a>\` element to trigger download. Filename: \`brianna-report-{type}-{date}.json\`.

## Acceptance Criteria
- Download triggers immediately on click
- File is valid JSON
- Filename includes report type and date

## Metadata
- **Complexity:** Small | **Owner:** Frontend | **Dependencies:** #18"

echo "All 22 issues created!"
