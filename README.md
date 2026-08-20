# 🤖 AutoRes AI — Production-Grade Multi-Agent Ticket Resolution System

> **Resume-worthy**: Autonomous AI agents that automatically detect, analyse, fix, test, and resolve software bug tickets — with Human-in-the-Loop approval powered by Groq's ultra-fast LLM inference.

---

## ✨ Features

- 🔍 **Analyser Agent** — Classifies bug type, extracts root cause using Groq (llama-3.3-70b-versatile)
- 🔎 **Code Scout Agent** — Scans codebase with keyword + pattern matching to find the exact buggy file & line
- 🛠️ **Fixer Agent** — Generates a minimal, production-safe patch via Groq
- 🧪 **Tester Agent** — Runs Jest test suite in an isolated sandbox environment
- 👤 **HITL Gate** — Human approval required before any fix is merged; email notification via Nodemailer
- 📚 **Knowledge Agent** — Stores resolutions as vectors (pgvector); auto-resolves recurring bugs
- 📊 **Live Dashboard** — Next.js frontend with real-time WebSocket agent logs, code diffs, metrics
- 🐘 **PostgreSQL + pgvector** — Full relational + vector DB for tickets, resolutions, knowledge base

---

## 🏗️ Architecture

```
autores-ai/
├── demo-app/          # Buggy Express.js corporate API (5 seeded bugs)
├── agents/            # 7 specialized AI agents
│   ├── groq-client.js  # Groq API wrapper (llama-3.3-70b-versatile)
│   ├── orchestrator.js # Master state machine
│   ├── analyser.js
│   ├── code-scout.js
│   ├── fixer.js
│   ├── tester.js
│   ├── knowledge.js
│   ├── notifier.js     # Email via Nodemailer
│   └── sandbox.js
├── api/               # Express + Socket.io backend
├── dashboard/         # Next.js 14 frontend
├── prisma/            # PostgreSQL schema + migrations
└── docker-compose.yml # PostgreSQL 15 + pgvector
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop (running)
- A free Groq API key from [console.groq.com](https://console.groq.com)

### 1. Clone & Configure

```bash
cd autores-ai
cp .env.example .env
# Edit .env and add your GROQ_API_KEY and email SMTP settings
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
# Wait for postgres to be healthy
```

### 3. Install Dependencies & Migrate DB

```bash
# Install root dependencies
npm install

# Install API deps
cd api && npm install && cd ..

# Install Demo App deps
cd demo-app && npm install && cd ..

# Run Prisma migrations
npx prisma migrate dev --name init

# Seed demo tickets
node prisma/seed.js
```

### 4. Start the Dashboard

```bash
cd dashboard && npm install && npm run dev
```

### 5. Start the API Server

```bash
cd api && npm run dev
```

### 6. Start the Demo App

```bash
cd demo-app && npm run dev
```

### 7. Open the Dashboard

Navigate to **http://localhost:3000**

---

## 🎮 Demo Flow

1. Go to **⚡ Raise a Bug** page
2. Select a preset bug (e.g., "Division by Zero") or write your own
3. Click **🚀 Raise Bug & Start Agents**
4. Watch the agent pipeline in real-time on the **Ticket Detail** page
5. When agents finish, the **HITL Approval Panel** appears
6. Click **✅ Approve & Merge** — fix is applied, ticket resolved, knowledge base updated
7. Raise the same bug again — Knowledge Agent detects it and auto-resolves!

---

## 🤖 Agent Pipeline

```
Ticket Created
    ↓
Knowledge Agent → check vector similarity (auto-resolve if 85%+ match)
    ↓
Analyser Agent (Groq) → classify bug type, extract root cause
    ↓
Code Scout → find affected file:line in codebase
    ↓
Sandbox → isolated copy of codebase created
    ↓
Fixer Agent (Groq) → generate minimal patch, apply to sandbox
    ↓
Tester Agent (Jest) → run full test suite in sandbox
    ↓
⏸ HITL Gate → email notification + dashboard approval UI
    ↓ (on APPROVE)
Fix merged → ticket RESOLVED → knowledge base updated
```

---

## 🔧 Environment Variables

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Get from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | Default: `llama-3.3-70b-versatile` |
| `DATABASE_URL` | PostgreSQL connection string |
| `SMTP_HOST` | Email server (e.g., `smtp.gmail.com`) |
| `SMTP_USER` | Email address |
| `SMTP_PASS` | App password (Gmail: Settings → 2FA → App Passwords) |
| `HITL_REVIEWER_EMAIL` | Who receives approval emails |

---

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/tickets` | List all tickets |
| `POST` | `/api/tickets` | Create ticket + start pipeline |
| `GET` | `/api/tickets/:id` | Ticket details with agent logs |
| `POST` | `/api/approvals/:id/decide` | Submit HITL decision |
| `GET` | `/api/knowledge` | Knowledge base entries |
| `GET` | `/api/metrics` | Dashboard metrics |

---

## 🐛 Seeded Demo Bugs

| Bug | Route | Type |
|---|---|---|
| Division by zero | `POST /api/orders` | `DivisionByZero` |
| Null pointer on profile | `GET /api/users/:id` | `NullPointerException` |
| Wrong HTTP status | `POST /api/payments` | `WrongStatusCode` |
| SQL injection | `GET /api/products/search` | `SQLInjection` |
| Off-by-one inventory | `POST /api/inventory/deduct` | `OffByOneError` |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **AI** | Groq API — `llama-3.3-70b-versatile` |
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express, Socket.io |
| **Database** | PostgreSQL 15 + pgvector |
| **ORM** | Prisma |
| **Testing** | Jest + Supertest |
| **Email** | Nodemailer |
| **Infra** | Docker Compose |

---

*Built as a production-grade showcase of multi-agent AI systems for automated corporate DevOps.*
