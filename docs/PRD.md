# Brianna — Product Requirements Document

**Hackathon:** Brim Financial x MPC Hacks  
**Challenge:** AI-Powered Expense Intelligence for SMBs  
**Version:** 1.1 | 2026-05-30

---

## Overview

Brianna is a manager dashboard that lets a single manager oversee their team's spending, approve purchase requests, monitor budget, and generate reports — powered by Claude over real transaction data. There are two roles: Employee and Manager, switched via a UI toggle (no real auth needed for the prototype).

**Input data:** 6 months of anonymized trucking company transactions (~50 employees) + Brim's expense policy document. Transactions include `employee_name` (8–10 rotating fake names) and `category_label` (human-readable labels mapped from MCC codes).

---

## Users & Roles

| Role | Access | Primary Need |
|---|---|---|
| Employee | Employee view | Submit purchase requests, check request status |
| Manager | Full dashboard | Approve requests, monitor budget, run reports, query spend data |

**Role switching:** A simple UI toggle in the top nav switches between Employee and Manager views. No authentication required for the prototype. The dashboard reflects a single manager's team — there is no multi-department or multi-manager view.

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Recharts
- **Backend:** Node.js + Express + TypeScript
- **AI:** Claude (Anthropic) via multi-step reasoning chains
- **Data:** Excel file parsed into SQLite in-memory DB at server startup (`better-sqlite3`, `Database(':memory:')`)
- **Validation:** Zod on every Claude JSON response

---

## Required Features

### F0 — Budget Tracker (Main Dashboard)

The first thing the manager sees when they open the app. A single company-wide budget visual showing total spend vs total budget — displayed as an animated filling bar or gauge. The visual should feel real-time and alive.

**Interactions**
- Clicking the bar/gauge opens a breakdown view
- Breakdown shows a pie chart by `category_label` (human-readable, not raw MCC codes)
- Budget tracker updates in real time when approvals are granted or denied

**Acceptance Criteria**
- Budget bar/gauge visible on initial load with no further action
- Category breakdown uses `category_label` values (e.g. Fuel, Meals, Vehicle Maintenance — not 5541, 5812, 7538)
- Budget total updates immediately after manager approves or denies a request

---

### F1 — Natural Language Chat

Finance managers ask plain-English questions about transaction data and receive answers with the appropriate visualization.

**User Stories**
- As a finance manager, I ask "What did Marketing spend on software last quarter?" and receive a bar chart + summary.
- As a finance manager, I ask "How does that compare to Engineering?" and get an updated comparison without re-explaining context.

**AI Chain (4 steps)**
1. **Intent extraction** — Claude parses query into structured filters (department, date range, category, metric)
2. **Data query** — Claude generates SQL → backend executes against SQLite in-memory DB → returns rows
3. **Contextual analysis** — Claude generates 2–3 sentence insight from results
4. **Visualization + format** — Claude selects chart type and returns final JSON

**Response Schema**
```
{
  answer: string,
  visualization: { type, title, data[], config },
  followUpSuggestions: [string, string, string],
  metadata: { rowsAnalyzed, dateRange, confidence }
}
```

**Visualization types:** `bar_chart`, `line_chart`, `pie_chart`, `table`, `summary_card`, `none`

**Acceptance Criteria**
- Conversation history preserved for ≥10 turns
- Every response includes a visualization type and 3 follow-up suggestions
- Handles ambiguous queries by asking a clarifying question in the answer field

---

### F2 — Policy Compliance Engine

Automatically scan all transactions against Brim's expense policy. Flag violations with context-aware reasoning, not just rule matching.

**Key Policy Rules (from Brim policy doc)**
- All expenses >$50 require manager pre-authorization and receipts
- Alcohol only permitted when dining with a customer (names + purpose required)
- Tips: max 15% for services/porterage, max 20% for meals
- Corporate card: personal expenses prohibited; only named cardholder may use
- Travel: most cost-effective transport required; CRA km rate for personal vehicles
- Car rental receipts required; parking tickets not reimbursable

**AI Chain (3 steps)**
1. **Context gathering** — pull transaction + employee spend history
2. **Policy comparison** — Claude reasons about violation with context (e.g. $200 team dinner ≠ $200 solo dinner; split charges to duck $500 threshold)
3. **Severity scoring + recommendation** — rank Critical / High / Medium / Low

**Violation Record Schema**
```
{
  transaction_id, employee_name, department,
  violation_type, policy_rule_cited,
  severity: "critical" | "high" | "medium" | "low",
  reasoning: string,
  is_repeat_offender: boolean
}
```

**Acceptance Criteria**
- Each violation includes the specific policy clause cited
- Repeat offender = ≥3 violations within 30 days (configurable)
- Split-charge detection: flags same employee, similar amounts, same vendor within 48h
- Compliance score (% clean transactions) shown in dashboard header

---

### F3 — Employee Request Flow & Pre-Approval

Two-sided workflow: employees submit purchase requests; the manager reviews them with full AI context and approves or denies in one click.

**Employee view**
- Simple form: employee name, item description, amount, category, reason
- After submission: pending status screen showing request state

**Manager view (Approvals Inbox)**
Each pending request displays:
- Employee name, amount, category, reason
- Employee's recent spend history
- Current budget impact if approved
- Claude-generated approve / deny / escalate recommendation with reasoning paragraph

**Example Claude output:**
> "Jordan is requesting $340 for vehicle maintenance. Their spend this month is $1,100 against a $2,000 budget. This is a routine category for this team. **Recommendation: Approve** — within policy and budget."

**Trigger (legacy):** Any transaction flagged by compliance engine OR exceeding $500 also routes to this inbox.

**Acceptance Criteria**
- Manager can one-click approve or deny; decision is final
- Approved/denied status reflected in compliance dashboard and budget tracker immediately
- Budget tracker updates in real time after each decision

---

### F4 — Reports Tab

Manager selects a report type and Claude generates a plain-English document. Two report types:

**Option 1 — Period Report**
Manager selects weekly or monthly. Claude generates an executive memo covering:
- Total spend vs budget (budget utilization required)
- Top spending categories
- Notable transactions
- Policy violations flagged
- Requests approved and denied
- Budget health summary

**Option 2 — Employee Report**
Manager selects an employee from a dropdown. Claude generates a full spend profile:
- Total spend for the selected period
- Spending breakdown by category
- All requests and their outcomes (approved / denied)
- Any policy flags
- Comparison to team average

**Acceptance Criteria**
- Report generation completes in <15s for 500 transactions
- Downloadable as JSON (MVP)
- Both report types include Claude-generated plain-English narrative

---

## Optional Features (priority order)

| Feature | Value |
|---|---|
| Anomaly & fraud detection | Split charges, duplicate charges, round-number patterns, unusual merchants |
| Department budget tracking | Real-time utilization + projected overrun alerts |
| Forecasting | "At this burn rate, Marketing exceeds Q3 budget by week 8" (linear extrapolation) |
| Vendor consolidation | "You use 4 coffee vendors — here's the consolidation saving" |
| Employee spend profiles | Peer benchmarking within department |

---

## Non-Functional Requirements

- **Latency:** Chat responses <8s; compliance scan <30s for 1,000 transactions
- **Security:** API key never exposed to frontend; all Claude calls proxied through Express
- **Reliability:** Zod validation on every Claude JSON response; retry once on parse failure; structured error returned on second failure
- **Data:** Excel parsed into SQLite in-memory DB at startup (`better-sqlite3`); Claude generates SQL for all queries; no persistent database required. Required columns: `employee_name` (8–10 rotating fake names), `category_label` (MCC → human-readable: 5541→Fuel, 9399→Government Permits, 7538→Vehicle Maintenance, 5812→Meals, 5046→Parts & Supplies)

---

## Out of Scope

- Real user authentication (UI role toggle between Employee / Manager is in scope)
- Persistent database
- Real email/Slack notifications (UI toast only)
- Mobile responsive design
- PDF export
- Multi-currency

---

## Judging Alignment

| Criterion | Our approach |
|---|---|
| Required features (/6) | All 4 built with real AI reasoning, not rule matching |
| Optional + creativity (/6) | Anomaly detection + forecasting; leverage patterns in the actual 6-month dataset |
| AI depth (/4) | Multi-step chains per feature; Claude generates SQL + reasons about context, not just flags keywords |
| UI/UX (/4) | Finance-manager-first: every AI output includes a visualization chosen for the insight, not decoration |
