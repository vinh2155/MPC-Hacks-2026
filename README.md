# Brianna

> AI-powered expense intelligence dashboard for fleet managers — Brim Financial x MPC Hacks 2026

Brianna is a manager dashboard for a trucking company to oversee team spending, approve purchase requests, monitor budget, and generate reports. Switch between Employee and Manager views with a UI toggle — no login required. All AI reasoning runs server-side through Claude over real trucking transaction data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript, Tailwind v4, Recharts |
| Backend | Node.js 22 + Express + TypeScript |
| AI | Claude (`claude-sonnet-4-6`) via multi-step reasoning chains |
| Data | `transactions.xlsx` (4,235 rows) parsed into SQLite in-memory DB at startup (`node:sqlite` built-in) |
| Validation | Zod on every Claude JSON response; retry once on parse failure |

---

## Roles

| Role | Access | What they see |
|---|---|---|
| Employee | UI toggle | Request submission form + live status screen (5s polling) |
| Manager | UI toggle (default) | Full dashboard: Chat, Transactions, Policy, Approvals, Reports, Budget Tracker, Employee Rankings |

---

## Features

### F1 — Natural Language Chat
Ask plain-English questions about transaction data and get answers with the right visualization — bar, line, pie, table, or single-number callout. Conversation history preserved for 10 turns. Every response includes 3 follow-up suggestion chips.

**AI chain:** intent extraction → Claude generates SQL → SQLite query → contextual analysis → visualization type selection

### F2 — Policy Management
Editable spending limits (total budget, pre-auth threshold, tip caps, split-charge window) and free-text compliance rules. Changes persist to disk and take effect on the next compliance scan.

### F3 — Employee Request Flow & Approvals
**Employee:** Submits a purchase request (name, item, amount, category, reason) and sees a live status screen.

**Manager:** Approvals inbox shows each pending request with the employee's recent 30-day spend, budget impact, and a Claude-generated approve / deny / escalate recommendation with reasoning. One-click decision; budget updates immediately.

**AI chain:** employee spend context + policy limits → approve/deny/escalate recommendation with reasoning

### F4 — Reports
Two Claude-generated report types, downloadable as JSON:

- **Period Report** (weekly / monthly): exec memo covering spend vs budget, top categories, notable transactions, policy violations, approval decisions, and budget health
- **Employee Report**: full spend profile for a selected employee — total spend, category breakdown, all requests and outcomes, and comparison to the 8-person team average

**AI chain:** SQL aggregations across 6 data points → Claude narrative in structured sections

### F5 — Budget Tracker
Animated spend bar color-coded by utilization (green below 70%, amber to 90%, red above). Alongside it, a category breakdown pie chart with human-readable labels (Fuel, Meals, Vehicle Maintenance — not raw MCC codes). Polls every 5 seconds.

**Year-end forecast:** derives average monthly burn rate from transaction history, projects it forward, and shows projected year-end total, surplus or overrun, and a two-tone progress bar (actuals solid, projected translucent). Color-coded green / amber / red based on projected utilization.

### F6 — Employee Rankings
Compliance leaderboard ranking all 8 employees. Score is built from a weighted penalty model (pre-auth violations, split-charge detections, denied requests, spend vs team average) then normalized so the best employee always maps to 95 and the lowest to 40, giving a meaningful spread for any time window.

Filterable by period (last day / month / 3 months / 6 months / year / all time) and sortable by score or alphabetically.

**AI chain:** per-employee spend + violation data → single Claude call → one-sentence plain-English insight per employee

---

## Getting Started

### Prerequisites

- Node.js ≥ 22
- Anthropic API key

### Install & Run

```bash
# Clone the repo
git clone https://github.com/vinh2155/MPC-Hacks-2026.git
cd MPC-Hacks-2026

# Backend (http://localhost:3001)
cd backend
npm install
cp .env.example .env   # paste your ANTHROPIC_API_KEY
npm run dev

# Frontend (http://localhost:5173) — new terminal
cd frontend
npm install
npm run dev
```

---

## Security

- `ANTHROPIC_API_KEY` lives only in `backend/.env` — never sent to the frontend
- All Claude calls are server-side; the frontend only hits `/api/*` endpoints
- Claude-generated SQL is validated as read-only before execution (no INSERT / UPDATE / DELETE)
- User-supplied strings embedded in Claude prompts are sanitized against prompt injection

---

## Input Data

4,235 transactions across 6 months from a real trucking company, anonymized. Loaded from `data/transactions.xlsx` into a SQLite in-memory database at server startup. Includes 8 employees (rotating fake names), merchant info, and MCC codes mapped to human-readable category labels (Fuel, Meals, Vehicle Maintenance, Government Permits, Parts & Supplies, Tolls & Permits).
