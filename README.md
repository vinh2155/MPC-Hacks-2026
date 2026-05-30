# Brianna

> AI-powered expense intelligence dashboard for SMBs — Brim Financial x MPC Hacks 2026

Brianna lets finance managers understand, police, and act on company spending through natural language. Ask plain-English questions about transactions, automatically flag policy violations, streamline pre-approvals, and generate CFO-ready reports — all powered by Claude over real transaction data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript, Recharts |
| Backend | Node.js + Express + TypeScript |
| AI | Claude (Anthropic) via multi-step reasoning chains |
| Data | Excel parsed into SQLite in-memory DB at startup (`better-sqlite3`) |
| Validation | Zod on every Claude JSON response |

---

## Features

### F1 — Natural Language Chat
Ask plain-English questions about transaction data and receive answers with the appropriate visualization. Conversation history preserved for 10+ turns. Every response includes a chart and 3 follow-up suggestions.

**AI chain:** intent extraction → Claude generates SQL → SQLite query → contextual analysis → visualization

### F2 — Policy Compliance Engine
Automatically scans all transactions against Brim's expense policy. Flags violations with context-aware reasoning (not just rule matching), severity scoring, repeat offender detection, and split-charge fraud detection.

**AI chain:** context gathering → policy comparison → severity scoring

### F3 — AI Pre-Approval Workflow
Transactions exceeding $500 or flagged by compliance trigger an approval request with employee spend history, budget utilization, and a Claude-generated approve/deny/escalate recommendation. One-click to close the loop.

### F4 — Automated Expense Report Generation
Groups related transactions by employee/trip, attaches policy check results, and produces a CFO-ready narrative. Handles 500 transactions in under 15 seconds. Downloadable as JSON.

---

## Optional Features

- Anomaly & fraud detection (split charges, duplicates, round-number patterns)
- Department budget tracking with projected overrun alerts
- Forecasting ("At this burn rate, Marketing exceeds Q3 budget by week 8")
- Vendor consolidation recommendations
- Employee spend profiles with peer benchmarking

---

## Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key

### Install & Run

```bash
# Clone the repo
git clone https://github.com/vinh2155/MPC-Hacks-2026.git
cd MPC-Hacks-2026

# Install backend dependencies
cd backend
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY

# Start backend
npm run dev

# In a new terminal — install frontend dependencies
cd frontend
npm install

# Start frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Non-Functional Requirements

- **Latency:** Chat responses <8s; compliance scan <30s for 1,000 transactions
- **Security:** API key never exposed to frontend; all Claude calls proxied through Express
- **Reliability:** Zod validation on every Claude response; retry once on parse failure

---

## Judging Alignment

| Criterion | Our approach |
|---|---|
| Required features (/6) | All 4 built with real AI reasoning, not rule matching |
| Optional + creativity (/6) | Anomaly detection + forecasting; leverages patterns in the actual 6-month dataset |
| AI depth (/4) | Multi-step chains per feature; Claude generates SQL + reasons about context |
| UI/UX (/4) | Finance-manager-first: every AI output includes a visualization chosen for the insight |

---

## Input Data

6 months of anonymized SMB transactions (~50 employees, multiple departments) + Brim's expense policy document. Loaded from Excel into a SQLite in-memory database at server startup.
