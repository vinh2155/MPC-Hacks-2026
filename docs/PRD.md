# Brianna — Product Requirements Document

**Hackathon:** Brim Financial x MPC Hacks  
**Challenge:** AI-Powered Expense Intelligence for SMBs  
**Version:** 1.0 | 2026-05-30

---

## Overview

Brianna is a finance intelligence dashboard that lets SMB finance managers understand, police, and act on company spending through natural language — powered by Claude over real transaction data.

**Input data:** 6 months of anonymized SMB transactions (~50 employees, multiple departments) + Brim's expense policy document.

---

## Users

| Persona | Role | Primary Need |
|---|---|---|
| Finance Manager | Day-to-day operator | Fast answers, policy enforcement, report generation |
| Approver (Manager) | Decision-maker | Clear context to approve/deny without back-and-forth |
| CFO | Final sign-off | High-level reports, budget health |

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Recharts
- **Backend:** Node.js + Express + TypeScript
- **AI:** Claude (Anthropic) via multi-step reasoning chains
- **Data:** Excel file parsed into SQLite in-memory DB at server startup (`better-sqlite3`, `Database(':memory:')`)
- **Validation:** Zod on every Claude JSON response

---

## Required Features

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

### F3 — AI Pre-Approval Workflow

When a transaction exceeds the approval threshold, notify the approver with full context and a Claude-generated recommendation. One reply closes the loop.

**Trigger:** Any transaction flagged by compliance engine OR exceeding $500 (configurable per department)

**Approval Request includes:**
- Transaction details
- Employee's spend history (last 30 days)
- Department budget utilization %
- Claude recommendation: `approve` | `deny` | `escalate` + reasoning paragraph

**Example Claude output:**
> "Sarah from Marketing is requesting $1,200 for a conference registration. Her department has $3,400 remaining in Q2 budget. She attended 2 conferences this year. **Recommendation: Approve** — within policy, aligns with past pattern."

**Acceptance Criteria**
- Approver can one-click approve or deny with optional comment
- Status (pending / approved / denied) reflected in compliance dashboard
- Threshold configurable per department

---

### F4 — Automated Expense Report Generation

Group related transactions by employee/trip, attach policy check results, and produce a CFO-ready report.

**Grouping Logic**
Cluster transactions by: same employee + date proximity (within 5 days) + same cost center/category

**Report includes:**
- Per-employee summary
- Per-trip/project breakdown with all transactions
- Inline policy violations
- Claude-generated CFO narrative (2–3 sentences)

**Example:** Sarah's San Diego conference → 10 transactions auto-grouped into one report, each tagged with category, policy status, and linked to the approval decision.

**Acceptance Criteria**
- Report generation completes in <15s for 500 transactions
- Downloadable as JSON (MVP)
- CFO narrative generated by Claude summarizing spend, compliance, and any concerns

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
- **Data:** Excel parsed into SQLite in-memory DB at startup (`better-sqlite3`); Claude generates SQL for all queries; no persistent database required

---

## Out of Scope

- User authentication
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
