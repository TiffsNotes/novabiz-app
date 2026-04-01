# NovaBiz OS — Developer Setup Guide

> The AI Executive Team for Every Small Business  
> Full-stack Next.js 14 application powering all 8 platform modules.

---

## What's built

| Layer | Details |
|---|---|
| **Database** | PostgreSQL via Supabase — 1,400-line schema, 35+ models |
| **AI engines** | 8 Claude-powered agents (AutoBooks, CRM, ERP, GrowthEngine, BI, Payroll, Forecast, Savings) |
| **API routes** | 25 Next.js API routes covering all modules |
| **Module UIs** | 14 full React components (Dashboard, CommandInbox, AutoBooks, CRM, HR, Inventory, PSA, Analytics, Platform, Payroll, Invoices, CashOracle, GrowthEngine, eCommerce) |
| **Job queue** | BullMQ on Redis — 8 scheduled background jobs |
| **Integrations** | Plaid (bank sync) + Gusto (payroll) wired, 50+ others ready to connect |

---

## Quick start

### 1. Prerequisites

```bash
node >= 18.17
npm >= 9
postgresql (local or Supabase)
redis (local or Upstash)
```

### 2. Clone and install

```bash
git clone <repo>
cd novabiz-app
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`:

```env
# Required for core functionality
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-...

# Required for bank connections
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox

# Required for payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Required for job queue
REDIS_URL=redis://localhost:6379
```

### 4. Set up database

```bash
# Push schema to your database
npm run db:push

# Seed demo data (Pacific Coast Grill restaurant)
npm run db:seed
```

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Architecture

```
novabiz-app/
├── prisma/
│   ├── schema.prisma          # Complete 35-model database schema
│   └── seed.ts                # Demo data (Pacific Coast Grill)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (ClerkProvider)
│   │   ├── globals.css         # Design tokens + Tailwind
│   │   ├── onboarding/         # 4-step onboarding flow
│   │   ├── dashboard/          # 20 dashboard pages
│   │   │   ├── page.tsx        # Executive overview
│   │   │   ├── inbox/          # CommandInbox
│   │   │   ├── autobooks/      # Transaction management
│   │   │   ├── invoices/       # AR/AP
│   │   │   ├── gl/             # General Ledger
│   │   │   ├── forecasting/    # CashOracle
│   │   │   ├── tax/            # Compliance
│   │   │   ├── inventory/      # WMS + stock
│   │   │   ├── orders/         # Sales orders
│   │   │   ├── procurement/    # Purchase orders
│   │   │   ├── crm/            # Pipeline + contacts
│   │   │   ├── marketing/      # GrowthEngine
│   │   │   ├── ecommerce/      # Omnichannel orders
│   │   │   ├── payroll/        # PayrollAI
│   │   │   ├── hr/             # Employees + leave
│   │   │   ├── projects/       # PSA
│   │   │   ├── timesheets/     # Time tracking
│   │   │   ├── analytics/      # BI + reports
│   │   │   ├── automations/    # Platform + NOVA AI
│   │   │   └── settings/       # Config + billing
│   │   │
│   │   └── api/
│   │       ├── dashboard/      # KPIs + AI brief
│   │       ├── inbox/          # Approve/reject actions
│   │       ├── autobooks/      # Transactions + P&L
│   │       ├── finance/        # Invoices, bills, GL
│   │       ├── forecast/       # CashOracle
│   │       ├── savings/        # ROI tracker
│   │       ├── crm/            # Contacts, deals, tickets
│   │       ├── hr/             # Employees, leave, reviews
│   │       ├── erp/            # Inventory, POs, orders
│   │       ├── ecommerce/      # eComm orders + customers
│   │       ├── marketing/      # Campaigns + social
│   │       ├── payroll/        # Payroll runs
│   │       ├── psa/            # Projects, timesheets
│   │       ├── analytics/      # Report builder
│   │       ├── plaid/          # Bank connection
│   │       └── platform/       # Chat + onboarding
│   │
│   ├── components/
│   │   ├── ui/index.tsx        # Shared UI: Button, Card, Table, Modal, etc.
│   │   ├── layout/
│   │   │   └── DashboardLayout.tsx   # Sidebar + top bar
│   │   └── modules/            # 14 full module UI components
│   │
│   ├── lib/
│   │   ├── db/index.ts         # Prisma singleton
│   │   ├── ai/
│   │   │   ├── autobooks.ts    # Transaction categorization (Claude)
│   │   │   ├── crm.ts          # Lead scoring + follow-ups
│   │   │   ├── erp.ts          # Reorder triggers + WMS
│   │   │   ├── growth.ts       # Campaigns + social + reviews
│   │   │   ├── bi.ts           # Executive dashboards + reports
│   │   │   ├── forecast.ts     # 90-day cash forecast
│   │   │   ├── savings.ts      # ROI documentation
│   │   │   └── actions.ts      # Approval gate + inbox
│   │   ├── integrations/
│   │   │   ├── plaid.ts        # Bank connection + transaction sync
│   │   │   └── gusto.ts        # Payroll sync + execution
│   │   └── jobs/
│   │       └── queue.ts        # BullMQ workers + schedules
│   │
│   ├── middleware.ts           # Clerk auth on all dashboard routes
│   └── types/index.ts          # Shared TypeScript types
```

---

## Module reference

### 1. Financial Management (AutoBooks)
- AI categorizes every transaction using Claude (confidence-gated)
- Generates P&L, balance sheet, cash flow automatically
- Multi-currency support via FxRate table
- GL journal entries for every financial event
- AR/AP aging with automated reminders
- **API:** `GET/POST /api/autobooks`, `GET /api/finance`

### 2. ERP Core (Inventory + WMS + Orders)
- Inventory tracking with bin locations across warehouses
- FIFO/LIFO/WAC costing methods
- Auto-generates purchase orders when stock hits reorder points
- Receives inventory and updates stock levels
- Sales order fulfillment with inventory deduction
- **API:** `GET/POST /api/erp`

### 3. CRM (SalesFlow)
- Pipeline board with customizable stages
- AI lead scoring (0–100) via Claude
- Automated follow-up email drafting for stale deals
- Support ticket management with AI response suggestions
- Activity logging across calls, emails, meetings
- **API:** `GET/POST /api/crm`

### 4. HR (PayrollAI)
- Employee records with departments, pay rates, types
- Gusto integration for payroll sync and execution
- Leave request management with approval workflow
- Performance reviews with AI summaries
- Benefits administration
- **API:** `GET /api/hr`, `GET/POST /api/payroll`

### 5. eCommerce (Omnichannel)
- Multi-storefront: Shopify, WooCommerce, POS, Amazon
- Unified order management across all channels
- Customer LTV prediction
- Segment customers (VIP, regular, at-risk)
- **API:** `GET /api/ecommerce`

### 6. PSA (Projects + Timesheets)
- Project tracking with budget vs actual
- Hierarchical tasks with status and assignments
- Timesheet entry and approval workflow
- Expense management with billable tracking
- Milestone billing
- **API:** `GET /api/psa`

### 7. Analytics & BI
- Real-time executive dashboard pulling from all 7 modules
- AI daily brief generated by Claude
- Report builder: P&L, AR aging, inventory, payroll
- Role-based dashboard views
- **API:** `GET /api/dashboard`, `GET /api/dashboard/brief`, `POST /api/analytics/report`

### 8. Platform (NOVA AI + Automations)
- **NOVA CoS:** Conversational AI with full business context — ask anything
- Workflow builder with trigger/action templates
- Integrations hub (50+ connectors, Plaid connected)
- Custom dashboard configuration
- **API:** `POST /api/platform/chat`, `POST /api/platform/onboarding`

---

## AI approval gate

Every AI action goes through the approval gate before executing:

```typescript
// From src/lib/ai/actions.ts
const requiresApproval = (
  amount > business.thresholds.transaction ||
  isNewVendor ||
  confidence < 0.85 ||
  actionType === 'payroll_run'
)

if (requiresApproval) {
  // → CommandInbox item created
  // → Business owner reviews in dashboard
  // → approve() or reject() called
} else {
  // → Executes automatically
  // → Logged in audit trail
}
```

Thresholds are configurable per business in Settings → AI Thresholds.

---

## Background jobs (BullMQ)

| Job | Schedule | What it does |
|---|---|---|
| `sync-transactions` | Every 1 hour | Pulls new bank transactions via Plaid |
| `run-autobooks` | Every 2 hours | Categorizes uncategorized transactions |
| `update-forecast` | Daily 6am | Regenerates 90-day cash forecast |
| `check-reorders` | Every 4 hours | Triggers POs for low-stock items |
| `score-leads` | Daily 7am | AI scores all unscored CRM leads |
| `preview-payroll` | Monday 8am | Previews upcoming payroll → inbox |
| `generate-followups` | Daily 9am | Drafts follow-ups for stale deals |
| `monthly-report` | 1st of month | Generates P&L + sends email digest |

Start the worker in a separate process:
```bash
npx tsx src/lib/jobs/worker.ts
```

---

## Deployment

### Option A: Vercel (recommended for frontend)

```bash
npm install -g vercel
vercel deploy
```

Set all env vars in Vercel dashboard. Add `DATABASE_URL` pointing to Supabase.

### Option B: Railway (full-stack with worker)

1. Connect GitHub repo to Railway
2. Add a second service for the BullMQ worker
3. Add Redis and PostgreSQL from Railway marketplace
4. Set environment variables

### Option C: Docker

```bash
docker build -t novabiz-app .
docker run -p 3000:3000 --env-file .env.local novabiz-app
```

---

## Key integrations to wire up

| Integration | Status | What to do |
|---|---|---|
| Plaid | ✅ Built | Add `PLAID_CLIENT_ID` + `PLAID_SECRET` |
| Gusto | ✅ Built | Add `GUSTO_CLIENT_ID` + OAuth flow |
| Stripe | Schema ready | Wire `STRIPE_SECRET_KEY` → billing |
| QuickBooks | Schema ready | Build OAuth + sync in `integrations/` |
| Shopify | Schema ready | Build webhook handler + product sync |
| Gmail | Schema ready | Build OAuth + EmailThread sync |
| Resend | Config ready | Add `RESEND_API_KEY` for emails |

---

## Acquisition readiness checklist

- [ ] Deploy to production on Vercel + Supabase
- [ ] Connect real Plaid (sandbox → production)
- [ ] Connect Gusto (get API access)
- [ ] Stripe billing live (Core $299, Pro $499, Enterprise $999)
- [ ] First 10 paying customers onboarded
- [ ] Savings documentation live ($3,701 avg/mo proven)
- [ ] SOC 2 audit initiated (Type I → Type II)
- [ ] Series A deck updated with real MRR numbers
- [ ] Reach out to Intuit Ventures, Salesforce Ventures, Block

---

## Tech stack

```
Frontend:   Next.js 14 (App Router) + Tailwind CSS
Backend:    Next.js API routes (Node.js)
Database:   PostgreSQL via Prisma (Supabase)
AI:         Anthropic Claude (claude-sonnet-4-6)
Auth:       Clerk (multi-tenant, org-based)
Banking:    Plaid (read-only transactions)
Payroll:    Gusto API
Jobs:       BullMQ + Redis
Email:      Resend
Payments:   Stripe
Deploy:     Vercel (frontend) + Railway (workers)
```

---

*Built for NovaBiz OS — novabizos.com*  
*Target: $250–500M acquisition by Intuit, Salesforce, Block, or Microsoft*
