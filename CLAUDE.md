# BudgetFlow — Claude Code Instructions

## Project Overview

BudgetFlow is a budget pacing and forecasting tool for Bright digital marketing agency. It replaces the broken Excel workflow where "daily budget x days in month" produces wrong forecasts when budgets change mid-month.

**Stack**: React + Vite + Tailwind CSS v4 + Supabase + Vercel
**Language**: Hebrew (RTL) as primary UI language
**Design**: Glass Dark design system (see `DESIGN_SYSTEM.md`)

---

## Design System

קרא את `DESIGN_SYSTEM.md` לפני כל עבודה על UI.

### כללים:
- עקוב אחרי Glass Dark design system — בלי חריגות.
- כל surface = glass-panel או glass-card. לעולם לא solid background.
- צבע אקסנט = כחול (#2563eb) בלבד. לא להוסיף צבעים.
- כפתורים = pill (rounded-full). Primary = כחול. Ghost = שקוף עם גבול.
- טקסט = rgba(255,255,255) עם שקיפויות (0.9 / 0.55 / 0.35). לעולם לא #fff.
- ריווח = נדיב. padding p-5 עד p-8. gap-3 עד gap-4.
- אנימציות = CSS transitions בלבד. לא framer-motion.
- RTL = logical properties בלבד (ms/me/ps/pe/border-s/border-e).
- Line-height בעברית = 1.7 לגוף, 1.4 לכותרות.
- פונט: Heebo (Google Fonts). Fallback: 'Heebo', 'Assistant', 'Noto Sans Hebrew', sans-serif.
- Icons: lucide-react, outline only, size={18} in buttons, size={20} standalone.
- Semantic colors: success=#22c55e, warning=#f59e0b, danger=#ef4444 — use sparingly for status indicators only.

---

## Data Model (Supabase)

### Tables

#### clients
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| name | text | Client name |
| slug | text unique | URL-friendly identifier |
| share_token | text unique | Random token for client share link |
| is_active | boolean | Active/archived |
| notes | text | General notes |
| meta_ad_account_id | text nullable | Meta Ad Account ID (e.g. act_123456) |
| google_customer_id | text nullable | Google Ads customer ID |
| google_mcc_id | text nullable | Google MCC ID |
| created_at | timestamptz | Creation date |

#### campaigns
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| client_id | uuid FK→clients | Reference to client |
| name | text | Display name |
| technical_name | text | System name (e.g. "Bright \| Conv \| Remarketing \| 11.05.25") |
| platform | text CHECK('facebook','google') | Platform |
| campaign_type | text | Sales, Awareness, Shopping, Brand, GDN, etc. |
| ad_link | text | Link to ad preview |
| status | text CHECK('active','paused','stopped','scheduled') | Campaign status |
| start_date | date | Campaign start date |
| end_date | date nullable | Campaign end date (null = ongoing) |
| notes | text | Campaign notes |
| meta_campaign_id | text nullable | Meta campaign ID for sync |
| actual_spend | numeric default 0 | Actual spend synced from Meta |
| actual_spend_month | text nullable | Month of actual_spend (YYYY-MM) to detect stale data |
| last_synced_at | timestamptz nullable | Last Meta sync timestamp |
| created_at | timestamptz | Creation date |

#### budget_periods
Core table. Each row = a period with a specific daily budget.
When budget changes, create new row + close previous row's end_date.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| campaign_id | uuid FK→campaigns | Reference to campaign |
| daily_budget | numeric | Daily budget in NIS |
| start_date | date | When this budget became effective |
| end_date | date nullable | When this budget ended (null = current) |
| created_by | uuid FK→team_members | Who set this budget |
| created_at | timestamptz | When created |

#### changelog
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| campaign_id | uuid FK→campaigns | Reference to campaign |
| action | text CHECK('budget_change','status_change','campaign_added','campaign_removed','note_added') | Action type |
| description | text | Human-readable description |
| old_value | text | Previous value |
| new_value | text | New value |
| performed_by | text | Team member name |
| performed_at | timestamptz | When action occurred |

#### team_members
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| name | text | Display name |
| email | text unique | Login email |
| role | text CHECK('admin','campaigner') | Role |
| is_active | boolean | Active/deactivated |

---

## Budget Forecast Logic

### Monthly Forecast Calculation

For each campaign in a given month:

1. Collect all budget_periods that overlap with the target month
2. For each period: daily_budget × number_of_days_in_that_period_within_the_month
3. Sum all periods = accurate monthly forecast

**Example**: Campaign X in March 2026 (31 days):
- Period 1: March 1-14 at ₪200/day = 14 × 200 = ₪2,800
- Period 2: March 15-31 at ₪300/day = 17 × 300 = ₪5,100
- Monthly forecast = ₪7,900

### Edge Cases
- Campaign stopped mid-month: only count days until stop date
- Campaign started mid-month: only count from start date
- Campaign paused: exclude paused days
- Campaign scheduled: no forecast until start_date arrives (₪0 spend)
- No budget change: simple daily × remaining days

### Forecast Metrics
- **Spent So Far**: Sum of (daily_budget × days_elapsed) per period up to today
- **Remaining Forecast**: current_daily_budget × days_left_in_month
- **Total Monthly Forecast**: Spent So Far + Remaining Forecast
- **Original Plan**: initial_daily_budget × days_in_month
- **Variance**: Total Forecast - Original Plan

---

## Screens

### 1. Dashboard (Home) — `/`
- Client cards: name, active campaigns count, total monthly forecast, platform breakdown
- Quick stats bar: total forecast all clients, total active campaigns
- Search/filter by client name
- Add new client button

### 2. Client View (Internal) — `/clients/:slug`
- Two separate tables: Facebook campaigns, Google campaigns
- Campaign table columns: name, current daily budget (inline editable), monthly forecast (auto), status indicator, ad link, notes, last change date
- Summary row per platform: total daily, total monthly forecast, total original plan, variance
- Grand total row: combined FB + Google
- Actions: add campaign, edit campaign (modal), change budget, change status, remove from plan, view changelog (slide-out), copy share link
- Monthly progress bar with budget change markers (dots on timeline with hover tooltips)

### 3. Campaign Edit Modal
- Campaign name + technical name
- Platform selector (facebook/google)
- Campaign type
- Daily budget field (change creates new budget_period + changelog entry)
- Start/end date
- Ad link
- Notes
- Status toggle
- Budget history timeline showing all changes visually

### 4. Changelog Panel (Slide-out)
- Full history for a campaign or entire client
- Filter by: action type, date range, team member
- Each entry: timestamp, who, what changed, old → new value
- Color-coded by action type

### 5. Client Share View — `/share/:token`
- Public, no login required
- Shows: client name, FB campaigns table, Google campaigns table
- Columns: campaign name, daily budget, monthly forecast, status
- Summary rows per platform + grand total
- Read-only, no editing, no changelog
- Branded with Bright logo
- Regenerate share token option (invalidates old links)

---

## User Roles

| Role | Access | Actions |
|------|--------|---------|
| Admin | Full | Create clients, manage campaigns, manage team, view all |
| Campaigner | Assigned clients | Add/edit campaigns, change budgets, update statuses |
| Client (share link) | Own data only | View tables + forecast, no editing |

---

## Key UX Flows

### Adding a Campaign
1. Navigate to client page
2. Click "הוסף קמפיין"
3. Fill: name, platform, type, daily budget, start date, ad link
4. System creates campaign + first budget_period + changelog entry
5. Campaign appears in correct table (FB/Google)

### Changing Budget Mid-Month
1. Click on daily budget cell (inline) or open campaign modal
2. Enter new daily budget
3. System asks for effective date (defaults to today)
4. System closes current budget_period (sets end_date)
5. System creates new budget_period
6. Changelog entry: "תקציב שונה מ-X ל-Y, החל מ-DATE"
7. Monthly forecast recalculates

### Stopping a Campaign
1. Change status to "stopped"
2. System asks for stop date (defaults to today)
3. Sets campaign end_date + closes budget_period
4. Changelog entry created
5. Forecast recalculates

### Removing a Campaign from Budget Plan
When a campaign is paused/stopped mid-month but the forecast still shows the full month:
1. Click the CalendarOff icon (📅✕) in the campaign row actions
2. `RemoveFromPlanDialog` opens with effective date (defaults to today)
3. Shows preview of updated forecast based on chosen date
4. On confirm: closes active `budget_period` (sets end_date) + sets campaign `end_date`
5. Changelog entry: "קמפיין הוצא מתוכנית התקציב החל מ-DATE"
6. Forecast recalculates to only include days up to the effective date
- API action: `PUT /api/campaigns/:id` with `{ action: 'remove_from_plan', effective_date }`
- Hook: `useRemoveFromPlan` in `useCampaigns.ts`

---

## Supabase RLS Policies

- **Authenticated team**: Full CRUD on assigned clients
- **Admin**: Full CRUD on everything
- **Public share view**: SELECT only, filtered by share_token match

---

## Technical Notes

- Use React Query (TanStack Query) for server state management
- Currency: always display as ₪ with thousands separator (e.g., ₪48,000)
- Dates: display in DD.MM.YY format in UI
- All UI text in Hebrew
- Mobile-responsive but desktop-first (this is a work tool)
- Platform icons: use Meta (Facebook) and Google icons/logos in campaign rows
- Status colors: active=success green, paused=warning yellow, stopped=danger red, scheduled=indigo — applied as subtle background tint on glass-card, not solid colors

### Meta Sync (`api/meta/sync.ts`)
- Sync fetches campaigns from two sources: **Insights API** (campaigns with spend/impressions this month) + **Campaigns API** (all ACTIVE campaigns, to catch scheduled/zero-spend)
- **Scheduled detection**: Meta API reports scheduled campaigns as `ACTIVE` with a future `start_time`, NOT as `SCHEDULED`. The sync detects this by comparing `start_time` to current date
- Status mapping: `ACTIVE` + future start → `scheduled`, `ACTIVE` → `active`, `PAUSED` → `paused`, everything else → `stopped`
- `actual_spend_month` tracks which month the spend data belongs to, preventing stale display on new month
- After DB schema changes to the status CHECK constraint, run `POST /api/migrate` to apply

### Build & Deploy
- Vercel build runs `tsc -b && vite build` — stricter than `tsc --noEmit` (fails on unused variables/imports)
- Always verify with `npx tsc -b` locally before pushing, not just `tsc --noEmit`

---

## File Structure

```
budgetflow/
├── api/                           ← Vercel serverless functions
│   ├── _lib/                      ← Shared backend: db.ts, schema.ts, api-helpers.ts
│   ├── meta/
│   │   └── sync.ts                ← Meta Ads sync (insights + scheduled detection)
│   ├── campaigns/
│   │   ├── index.ts               ← GET/POST campaigns
│   │   └── [id].ts                ← PUT/DELETE single campaign (actions: budget, status, remove_from_plan)
│   ├── clients/                   ← Client CRUD
│   ├── changelog/                 ← Changelog API
│   ├── migrate.ts                 ← DB migration runner (POST /api/migrate)
│   └── migrations/                ← SQL migration files
├── src/
│   ├── components/
│   │   ├── ui/                    ← GlassPanel, GlassCard, StatusBadge, StatusDropdown, etc.
│   │   ├── CampaignTable.tsx
│   │   ├── CampaignModal.tsx
│   │   ├── MonthProgressBar.tsx     ← Progress bar with budget change markers
│   │   ├── RemoveFromPlanDialog.tsx  ← Remove campaign from budget plan
│   │   └── ...
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── ClientView.tsx
│   │   └── ShareView.tsx
│   ├── hooks/
│   │   ├── useCampaigns.ts
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts                 ← API client
│   │   ├── forecast.ts            ← Budget calculation logic
│   │   └── format.ts              ← Currency, date formatting
│   ├── types/
│   │   └── index.ts               ← TypeScript interfaces
│   └── globals.css                ← Design tokens + glass utility classes
├── public/
├── CLAUDE.md                      ← this file
├── DESIGN_SYSTEM.md               ← Glass Dark design system
├── vercel.json
└── package.json
```

---

## MVP Phases

### Phase 1 (MVP)
- Client CRUD
- Campaign CRUD with FB/Google separation
- Budget periods with segmented forecast
- Full changelog
- Client share link (view-only, no auth)
- Team auth (email/password via Supabase)

### Phase 2
- Month-over-month comparison
- Budget alerts (approaching limit, overspend)
- CSV/PDF export
- Multi-month forecast (next 3 months)
- Campaign duplication

### Phase 3
- ~~Meta API integration for actual spend~~ ✓ Done — `api/meta/sync.ts`
- Actual vs. forecast comparison
- Google Ads API integration
- Auto-detection of budget changes from API
