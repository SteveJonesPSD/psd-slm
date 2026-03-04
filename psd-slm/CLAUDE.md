# Innov8iv Engage — Sales Lifecycle Management (SLM)

## Project Overview
Innov8iv Engage is a custom SLM platform built with Next.js + TypeScript + Supabase for managing the full commercial lifecycle: opportunities → quotes → deal registrations → sales orders → purchase orders → invoicing → commission. Built for PSD Group, a small UK IT managed services provider (~100 customers, 7 staff).

## Tech Stack
- **Frontend:** Next.js with TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, REST API, Row-Level Security)
- **Hosting:** Vercel (auto-deploys from GitHub main branch)
- **Repo:** GitHub private repository
- **AI Integration:** Anthropic Claude API (Helen AI — helpdesk triage, draft responses, diagnostic assist; inbound PO extraction; AI product creation from URL/paste/screenshot; AI quote generation from supplier PDFs; AI quote acceptance from customer PO documents)

## Critical Business Rules

### 1. Deal Registration Pricing
Same product can have different buy prices per customer. When a customer has an active deal registration with a supplier, the buy price on quote lines auto-populates from the deal reg, NOT the product catalogue default. The `deal_reg_line_id` field traces the pricing source through quote → SO → PO.

### 2. Sales Order to Purchase Order Mapping
Customer order POs belong to a specific Sales Order (`purchase_orders.sales_order_id`). Every PO line maps to a specific SO line. Stock is NEVER pooled across customers. Two customers ordering identical products generate separate POs with separate costs.

**Stocking orders** are POs raised without an SO link (`sales_order_id = NULL`, `purchase_type = 'stock_order'`). These replenish general inventory. When stock from a stocking order is needed for a customer, it's manually allocated from the SO detail page.

**Auto-allocation:** When goods are received against an SO-linked PO (any delivery destination), stock is automatically allocated to the SO — serials go straight to `allocated` status, stock allocation records are created, and the SO line moves towards `allocated`. This eliminates the manual allocation step for the standard customer order flow. For stock orders (no SO link), serials go to `in_stock` for later manual allocation.

### 3. Per-Line Margin Tracking
Buy and sell prices are recorded at every stage: quote line → SO line → PO line → invoice line. Margin is calculated per line, not just at totals. Commission is calculated from ACTUAL invoiced margin, not quoted margin.

### 4. Sales Attribution
Each quote has attribution entries (must total 100%). Types: direct, involvement, override. These splits carry through to commission calculation when invoices are raised.

### 5. Fulfilment Routes & Line Status Transitions
Each line has a fulfilment route (simplified from the original 3-option model):
- **Ship from Stock** — PSD delivers from own inventory
- **Ship from Supplier** — supplier ships direct (covers both deliver-to-site and drop-ship scenarios)

**Line status flows** (defined in `lib/sales-orders.ts`):
- **From Stock:** pending → picked → delivered
- **Drop-ship to PSD Office:** pending → ordered → received → **picked** → delivered (pick step required before delivery)
- **Drop-ship to Customer Site:** pending → ordered → received → delivered (no pick needed — supplier delivered direct)
- **Service items:** pending → delivered

**Mixed fulfilment:** A "Ship from Supplier" line can have partial stock allocation. Use "Allocate from Stock" in the fulfilment section, then "Raise PO" for the balance. `generatePurchaseOrders` automatically subtracts allocated stock and existing PO quantities when calculating PO line qty. PO generation requires a `customer_po` on the SO — if missing, a modal prompts for it before proceeding.

**Stock unallocation:** `unallocateStockFromSoLine()` in `stock/actions.ts` reverses stock allocation. Handles both `allocated` and `picked` statuses — for picked items, restores stock on hand (since pick decremented it). Resets serial registry entries to `in_stock`, creates `deallocated` stock movements with reason. Reverts SO line status to `pending`. UI: amber "Unallocate" button per line in the fulfilment section with a confirmation modal requiring a reason.

**PO receipt auto-allocation:** When receiving goods on any SO-linked PO (`purchase_type = 'customer_order'`), serials are registered with `status: 'allocated'` and stock allocations are created automatically. This eliminates the manual "Allocate from Stock" step. For stock orders (`purchase_type = 'stock_order'`), serials go to `in_stock` — manual allocation happens later when an SO needs the items. `receivePoGoods()` returns `autoAllocated: true` when auto-allocation occurs.

**Serial number flow (updated):**
- Customer order PO receipt: captured → `allocated` (auto-allocated to SO)
- Stock order PO receipt: captured → `in_stock` (manual allocation later)
- Manual allocation from stock: `in_stock` → `allocated`
- Pick confirmation: `allocated` → `allocated` (status unchanged, pick recorded)
- Delivery note / collection: `allocated` → `dispatched` (or `collected`)

### 5b. Cross-Domain Permissions
SO line mutations (status changes, receiving, picking) span sales orders, stock, and purchasing domains. The `requireSoOperationPermission()` helper in `orders/actions.ts` accepts any of: `sales_orders.edit`, `purchase_orders.edit`, or `stock.edit`.

### 6. Quote Types
`business`, `education`, `charity`, `public_sector` — affects commission rates.

### 7. Multi-Brand Support
The platform supports multiple brands under one organisation. Each brand has its own name, logo, quote prefix, and contact details. Examples:
- **PSD Group** — quotes prefixed `Q-2026-XXXX`
- **EnviroSentry** — quotes prefixed `ES-2026-XXXX`
- **SchoolCare** — quotes prefixed `SC-2026-XXXX`
Quote numbering sequence is org-wide to avoid collisions across brands.

### 8. Per-Product Default Delivery Destination
Products have a `default_delivery_destination` field: `'psd_office'` (Warehouse, default) or `'customer_site'` (Ship Direct). Large items like servers/racks default to customer site. When creating a Sales Order from a quote, each SO line's delivery destination and fulfilment route are pre-populated from the product's default (`customer_site` → `drop_ship`, `psd_office` → `from_stock`). If any non-service lines are set to customer site, a confirmation warning modal lists the affected items before SO creation proceeds. Services always write `psd_office`.
- **Migration:** `20260320000001_product_default_delivery.sql` — adds `default_delivery_destination TEXT NOT NULL DEFAULT 'psd_office'` with CHECK constraint
- **Product form:** Select dropdown after "Stocked" checkbox (goods only), amber hint when "Customer Site" selected
- **SO creation:** `orders/new/page.tsx` fetches `default_delivery_destination` in quote_lines product select; `create-so-form.tsx` pre-populates line overrides and shows direct-ship warning modal

### 9. Serial Number Tracking
Serial number requirements are set at the **category level** as a default, with **product-level overrides**. Not all items require serial tracking (e.g. software licenses don't).

**Tri-state `is_serialised`:** Products have `is_serialised`: `true` (always), `false` (never), or `null` (inherit from `product_categories.requires_serial`). Always resolve via `resolveSerialisedStatus()` from `lib/products.ts` — never check `is_serialised === true` directly. When querying products for serialisation checks, include `product_categories(requires_serial)` and `product_type` in the select.

**Serial uniqueness:** `receivePoGoods()` and `receiveGoods()` validate serial numbers against `serial_number_registry` before inserting — duplicates are rejected with an error listing the conflicting serial(s). Registry entries use INSERT (not UPSERT) after validation.

**Serial-aware picking:** Serialised items require individual serial selection at pick time via `SerialPickModal` (tablet-optimised tap-to-select tiles + barcode scanner input + "Select All / Deselect All" toggle). `markAsPicked()` skips serialised allocations and returns them in `serialisedSkipped`. `markAsPickedWithSerials()` handles serialised picks with per-serial validation. For pre-existing allocations without recorded serials, the modal fetches available serials from the registry and the action validates against registry instead of the allocation record. **PO-linked pre-selection:** When picking serials for an SO line that has linked PO lines, `getPoLinkedSerials()` in `stock/actions.ts` queries the PO lines' serials from the registry and pre-selects them in the modal with an emerald banner.

**Serial flow:** `in_stock` → `allocated` (on stock allocation) → `dispatched` (on DN creation). Pick step does not change registry status — it records the physical confirmation of which specific serials were picked.

### 10. Contracts
Contract types (ProFlex 1-4, AC, CCTV, etc.) define default visit parameters. Customer contracts override these using COALESCE pattern (NULL = inherit from type). Annual value is always manually set — contract lines are informational. Renewals create new contract rows with parent_contract_id chain (same pattern as quote versioning). Contract numbering: `CON-YYYY-NNNN`. E-sign hooks are present but not enforced until the e-sign module is built.

**Contract Visit Slots:** Each contract can have `contract_visit_slots` defining recurring visit patterns: engineer, day, cycle weeks, time slot (AM/PM/custom). Visit slots map ProFlex tiers to 4-week rolling cycle: PF1=[1], PF2=[1,3], PF3=[1,2,3,4]. Default AM: 08:30-12:00, PM: 12:30-16:00 (overridable per slot). Conflict detection checks engineer availability across all active contracts. Renewal copies slots to new contract. Engineer Week Grid at `/contracts/engineer-grid` shows read-only wall planner view assembled from all active contract slots.
- **Migration:** `20260316000001_contract_visit_slots.sql` — `contract_visit_slots` table, `v_contract_visit_slots` view, `field_engineer` role
- **Types:** `lib/contracts/types.ts` — `ContractVisitSlot`, `ContractVisitSlotWithDetails`, `FieldEngineer`
- **Server actions:** Visit slot CRUD + conflict check + engineer slots query in `contracts/actions.ts`
- **UI:** `contracts/[id]/visit-schedule-section.tsx` — table with add/edit/delete modals, ProFlex quick-fill, conflict warnings
- **Weekdays bulk create:** When a contract has `visit_frequency='daily'`, the Add Visit Slot modal shows a "Weekdays (Mon–Fri)" option that creates 5 slots in one go (one per weekday, same engineer/time/cycle weeks). Conflict checking runs across all 5 days. Button reads "Create 5 Slots". Only shown when adding (not editing).
- **Engineer Grid:** `contracts/engineer-grid/` — 4-week × 5-day grid with click-through to contract detail

### 11. Visit Scheduling
Recurring visit calendar for SchoolCare (education brand). Schools get ICT support visits on a 4-week rolling cycle aligned to the academic year.
- **Migration:** `20260315000001_visit_scheduling.sql` — `visit_settings`, `visit_calendars`, `visit_calendar_weeks`, `visit_instances`, `bank_holidays`. Rewrite migration `20260316000002_visit_scheduling_rewrite.sql` dropped `visit_slot_templates` (patterns now on `contract_visit_slots`), renamed `slot_template_id` → `contract_visit_slot_id`.
- **Types:** `lib/visit-scheduling/types.ts` — VisitInstance (with `contract_visit_slot_id`, `job_id`), VisitInstanceWithDetails (with `job_number`), EngineerWeekView, EngineerMonthView, CycleWeekGrid, GenerationRequest (with month/year), status constants, ProFlex cycle defaults
- **Permissions:** `visit_scheduling.view/create/edit/delete` — admin/super_admin=full, engineering=view+create+edit, sales/accounts/purchasing=view
- **Calendar:** Academic year container with auto-generated weeks (Mon–Fri). Holiday toggles recalculate cycle numbers (1→2→3→4). Status: draft → active → archived.
- **Visit patterns:** Defined on `contract_visit_slots` (contracts module), not in the scheduling module. The scheduling module is execution/review only.
- **Visit generation:** Creates diary entries from `contract_visit_slots` × calendar weeks. Optional month filtering. Skips holiday weeks, flags bank holidays, prevents duplicates. Batched inserts (100/batch).
- **Status flow:** draft → confirmed → completed (also cancelled, rescheduled, bank_holiday_pending)
- **Routes:** `/visit-scheduling` (dashboard), `/visit-scheduling/calendars` (list), `/visit-scheduling/calendars/[id]` (editor), `/visit-scheduling/generate` (generation form with month dropdown), `/visit-scheduling/review` (week + month review)
- **Customer integration:** `customers/[id]/visit-scheduling-section.tsx` shows upcoming + recent visits
- **Dashboard integration:** Visit banner on main dashboard when visits exist today or are unconfirmed
- **Sidebar:** "Visit Calendar" in Support section after Scheduling

**Visit → Job Bridge:** Confirmed visits automatically create scheduling jobs so engineers have one unified schedule.
- **Migration:** `20260317000001_visit_job_bridge.sql` — adds `'visit'` to `jobs.source_type` CHECK, `job_id` FK on `visit_instances`, unique index on `jobs(source_id) WHERE source_type = 'visit'`
- **Shared utility:** `lib/job-utils.ts` — extracted `generateJobNumber()` + `formatJobNumber()` (re-exported from `scheduling/actions.ts`)
- **Bridge functions** in `visit-scheduling/actions.ts`: `getOrCreateVisitJobType()` (auto-creates "Visit" job type), `createJobForVisit()` (creates job with `source_type='visit'`, links via `visit_instances.job_id`)
- **Auto-creation:** `confirmEngineerVisits()` and `confirmEngineerMonthVisits()` create jobs for each confirmed visit that lacks one. Returns `{ count, jobsCreated }`.
- **Two-way sync:** Visit → Job: cancel/reschedule/complete propagates to linked job. Job → Visit: `syncVisitFromJob()` in `scheduling/actions.ts` propagates completion/cancellation back to the visit.
- **Job number enrichment:** `enrichWithJobNumbers()` helper does a separate query for job numbers (avoids breaking main queries if migration not yet applied). Visit card shows linked job number as an indigo link.

**Visit Review (Week + Month):** `/visit-scheduling/review` — page title "Visit Review", Week/Month toggle.
- **Week view:** Per-engineer cards with 5-day table, visit cards with expand actions (complete/reschedule/cancel), "Confirm All" per engineer per week. Date picker jumps to the week containing the selected date.
- **Month view:** `review/month-review.tsx` — per-engineer cards with Mon–Fri calendar grid for the full month. Compact visit blocks (status-coloured left border, customer name). Hover tooltips show status, time slot, time range, contract number, linked job. Tooltip flips alignment for Thu/Fri columns. "Confirm All" per engineer confirms all draft visits for the month. Status legend footer with counts.
- **Month server actions:** `getEngineerMonthView(engineerIds, year, month)` fetches all visits for a month; `confirmEngineerMonthVisits(engineerId, year, month)` bulk confirms + creates jobs.
- **Navigation:** Prev/Next buttons, "This Week"/"This Month" button, date picker. Switching from week to month syncs the month to the current week's month.
- **Holiday overlays on review:** `getHolidaysForRange(startDate, endDate)` in `visit-scheduling/actions.ts` fetches school holiday weeks (`visit_calendar_weeks` where `is_holiday = true`) and bank holidays for a date range. Week view: amber banner for full school holiday weeks, amber pills on bank holiday day headers, muted holiday labels in empty day cells. Month view: `bg-amber-50/60` tinted cells with `text-[9px]` amber labels. Display-only — no actionable buttons. Type: `HolidayData` in `lib/visit-scheduling/types.ts`.

## Database
Schema is deployed to Supabase. Key tables: `organisations`, `customers`, `contacts`, `products`, `product_categories`, `suppliers`, `product_suppliers`, `deal_registrations`, `deal_registration_lines`, `opportunities`, `quotes`, `quote_groups`, `quote_lines`, `quote_attributions`, `quote_attachments`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`, `invoices`, `invoice_lines`, `contract_types`, `customer_contracts`, `contract_lines`, `contract_renewals`, `contract_entitlements`, `contract_visit_slots`, `commission_entries`, `commission_rates`, `org_settings`, `brands`, `activity_log`, `job_gps_log`, `visit_settings`, `visit_calendars`, `visit_calendar_weeks`, `visit_instances`, `bank_holidays`, `job_collections`, `job_collection_lines`.

**Important:** The `companies` table was renamed to `customers` and all `company_id` FKs renamed to `customer_id` (including on `invoices`, `contacts`, `quotes`, `sales_orders`, etc.). Always use `customer_id` in new code. Note: `jobs` still uses `company_id` (not yet renamed).

**Important:** `job_collections.job_id` is nullable — collections can be created directly from a sales order without a linked job. `jobs.source_type` and `jobs.source_id` link jobs to their originating entity (sales_order, ticket, contract, visit).

Key views: `v_margin_traceability`, `v_commission_summary`, `v_active_deal_pricing`, `v_helen_assist_usage`, `v_customer_contracts_active`, `v_contracts_due_renewal`, `v_contract_history`, `v_contract_visit_slots`, `v_engineer_schedule`.

## Authentication
Supabase Auth with email/password. Row-level security scoped to organisation. Uses Next.js 16 `proxy.ts` (not deprecated `middleware.ts`). Seven roles with granular permissions:
- **Super Admin** — full access to everything
- **Admin** — full access to all modules
- **Sales** — pipeline, quotes, deal registrations, customers, helpdesk (create/edit)
- **Accounts** — invoicing, commission, purchasing
- **Purchasing** — purchase orders, suppliers, inbound POs
- **Engineering** — helpdesk (view/create/edit), products (read-only commercial)
- **Field Engineer** — scheduling (view/create/edit), contracts (view), helpdesk (view/create/edit), customers (view)

## Team Management
- Steve Dixon (admin) — MD, lead developer
- Mark Reynolds (sales)
- Rachel Booth (sales)
- Jake Parry (sales)
- Lisa Greenwood (admin)
- Dan Whittle (tech)
- Sam Hartley (tech)

**Admin password reset:** Super Admin and Admin roles can reset any other user's password from the Team page. Opens a modal to specify the new password (min 8 chars + confirm). Sets `must_change_password: true` so the user is forced to change it on next login. Uses `team.edit_all` permission. Server action: `resetPassword(id, newPassword)` in `team/actions.ts`.

## UI Conventions
- Use Tailwind CSS for all styling
- Consistent component patterns: tables with sortable columns, stat cards, modals for forms, badge components for statuses
- Margin colour coding: green ≥30%, amber ≥15%, red <15%
- Currency formatting: GBP with Intl.NumberFormat("en-GB")
- Status badges with colour/background pairs (see existing prototype for patterns)
- Clean, professional aesthetic — not flashy. Think business tool, not consumer app.
- **AI features are purple.** Any button, badge, or UI element that triggers an AI function must use the `purple` Button variant (`bg-purple-600`) and include the sparkle icon. This applies across the entire platform (e.g. AI Quote, Create with AI, Helen AI actions). The `purple` variant is defined in `components/ui/button.tsx`.

### Responsive Design Rules
- **No fixed max-width on the main content area.** The dashboard layout (`app/(dashboard)/layout.tsx`) has no `max-w-*` wrapper — content fills available space. Tables need room.
- **Tables:** All `<table>` elements must have `overflow-x-auto` on their wrapper and a `min-w-[Npx]` to allow horizontal scroll on narrow viewports. Use `whitespace-nowrap` on cells containing badges, statuses, dates, numbers, codes/references — only free-text columns (names, subjects, descriptions) should wrap.
- **DataTable pagination:** `DataTable` has built-in client-side pagination. Props: `defaultPageSize` (default 20), `pageSizeOptions` (default `[20, 50, 100, 0]` where 0 = "All"). Pagination bar (Showing X–Y of Z, page size buttons, Prev/Next) renders below the table automatically when row count exceeds the smallest page size option. Page resets to 0 when data reference changes (e.g. upstream filter). All list views get pagination for free — no per-page changes needed.
- **DataTable columns:** Set `nowrap: true` on all badge, status, date, numeric, and code columns. Only long-text columns (customer name, product name, subject) should omit it.
- **Grids:** Use `grid-cols-1 sm:grid-cols-2` (not bare `grid-cols-2`) for form fields and detail page grids. Use `lg:grid-cols-3` for wider layouts.
- **Filter bars:** Always include `flex-wrap` on filter bar containers. Search inputs use `w-full sm:w-64` (not bare `w-64`).
- **Mobile detection:** `MobileDetector` component (`components/ui/mobile-detector.tsx`) reads `isMobile` from `SidebarProvider` (uses `matchMedia('(max-width: 767px)')`). Same routes serve both desktop and mobile — conditional rendering at the client component level, not separate routes.
- **Mobile patterns:** `BottomSheet` for overlays, card-based lists instead of tables, tab-based detail views instead of split layouts. See `helpdesk/mobile-*` files for reference.

## Module Build Order & Status
1. ~~Companies & Contacts~~ ✅ Built
2. ~~Authentication & Roles~~ ✅ Built (RLS enforced, RBAC with 6 roles & ~50 permissions)
3. ~~Products, Suppliers & Categories~~ ✅ Built (multi-supplier support, category-level serial defaults, AI-assisted product creation)
4. ~~Deal Registrations~~ ✅ Built & validated
5. ~~Opportunities & Pipeline~~ ✅ Built (kanban + list views, 6-stage pipeline, drag-and-drop)
6. ~~Global Settings~~ ✅ Built (org settings, brands, API key management, email templates, avatar management)
7. ~~Quote Builder~~ ✅ Built (DR tie-in, PDF generation, customer portal, attribution splits, versioning, templates, notifications, e-signatures, attachments, AI quote generation from supplier PDFs, manual + AI-powered acceptance)
7b. ~~Inbound PO Processing~~ ✅ Built (PDF upload, AI extraction via Claude, quote matching pipeline)
7c. ~~Helpdesk & Ticketing~~ ✅ Built (ticket queue, SLA tracking, contracts, canned responses, categories, tags, departments, KB, reports, customer portal, mobile-optimised views, Helen AI agent with triage/drafts/diagnostic assist, scratchpad, assist usage reporting, ticket presence collision warnings)
8. ~~Sales Orders~~ ✅ Built (SO from accepted quote, derived header status, line status transitions, receive goods with serial capture, service item auto-detection, delivery summary, invoiced orders hidden by default with toggle, invoiced-this-month stat card)
8b. ~~Onsite Scheduling~~ ✅ Built (dispatch calendar, field engineer mobile app, job task templates with response types, e-signatures, job validation, PDF reports, mobile-responsive scheduling, GPS logging with interactive map)
9. ~~Purchase Orders~~ ✅ Built (PO generation from SO, draft-first workflow, receiving goods with cascading SO status, price variance tracking, PDF generation, stock-aware PO quantities, customer PO gate, tri-state serial enforcement, auto-allocation on receipt for all SO-linked POs, stocking orders for inventory replenishment)
9b. ~~Stock & Fulfilment~~ ✅ Built (stock locations/levels, allocations, picking, delivery notes, fulfilment view with per-line coverage tracking, serial uniqueness validation, serial-aware picking with tablet-optimised tap-to-select UI, PO-linked serial pre-selection, stock unallocation with reason tracking)
10. ~~Invoicing~~ ✅ Built (full/partial invoicing from SOs, invoice list with stat cards, detail page with breadcrumb chain, edit draft, credit notes, branded PDF generation, overdue detection, quantity_invoiced tracking on SO lines)
10b. **Commission** ← Next
10c. ~~Contracts~~ ✅ Built (contract types, customer contracts with COALESCE overrides, lines, entitlements, renewal chain, settings management, seed data)
10d. ~~Visit Scheduling~~ ✅ Built (academic year calendars, 4-week cycle patterns, slot templates with ProFlex quick-fill, visit generation, week review with bulk confirm, customer visit history integration)
11. ~~AI Chat Agents~~ ✅ Built (3 agents — Jasper/Helen/Lucia with tool-calling, floating chat panel, dedicated pages, persistent sessions, admin chat archive, markdown rendering with auto-linking)
12. ~~Engineer Stock Collection~~ ✅ Built (QR-based magic link collection slips, PDF generation, touch-to-confirm mobile UI, GPS capture, partial collection support)

## Development Workflow
- **Claude Project chats:** Architecture discussions, module planning, prompt generation, code review
- **Claude Code sessions:** Actual building, using this CLAUDE.md for persistent context
- Each module follows: plan in Project chat → generate build prompt → build in Claude Code → generate validation prompt → validate in Claude Code → review in Project chat → commit & deploy
- When running parallel Claude Code windows, use **separate branches** (e.g. `feature/auth`, `feature/products`). Never use `git add .` — only stage the specific files each session created or modified.

## Code Conventions
- TypeScript strict mode
- Supabase client via `@supabase/supabase-js`
- Server components where possible, client components only when interactivity needed
- All database operations through Supabase client (not raw SQL from frontend)
- Form validation before submission
- Optimistic UI updates where appropriate
- Activity logging on all create/update/delete operations
- **UUID generation:** In client-side code, use `generateUUID()` from `@/lib/utils` instead of `crypto.randomUUID()`. The latter is unavailable in non-secure contexts (HTTP over LAN). Server-side code (`'use server'` actions, API routes) can use `crypto.randomUUID()` directly since Node.js always supports it.
- **LAN dev access:** `next.config.ts` includes `allowedDevOrigins` for `http://10.0.21.104:3000` to allow team members to connect via LAN IP during development.
- **Polling must use API routes or browser Supabase client, NEVER server actions.** Server actions trigger Next.js RSC payload refresh on every call, which re-renders server components and resets client state (closing modals, losing form input). All recurring/polling operations (heartbeats, badge counts, presence) must use `fetch()` to API routes or the browser Supabase client. Server actions are fine for deliberate user-initiated mutations.
- **Polling state guards:** All polling hooks must compare new data against the previous value before calling `setState`. Use a `useRef` to track the last value (JSON string for objects/arrays, direct comparison for primitives). Only call the setter when data has actually changed. This prevents unnecessary re-renders of the Sidebar and its children every polling cycle. Pattern:
  ```typescript
  const lastJsonRef = useRef<string>('[]')
  // ... inside fetch callback:
  const json = JSON.stringify(newData)
  if (json !== lastJsonRef.current) {
    lastJsonRef.current = json
    setData(newData)
  }
  ```
  Applied in: `useSystemPresence` (15s), `usePolledCount` in sidebar (30s), ticket queue presence (30s).
- **Notification bell:** `components/notification-bell.tsx` polls `/api/notifications/unread-count` (API route) every 30s for the badge count. Uses `getNotifications`/`markAsRead`/`markAllAsRead` server actions for user-initiated dropdown interactions only.
- **Queue presence:** `helpdesk/ticket-queue.tsx` polls `/api/helpdesk/queue-presence` (API route) every 30s. Previously used the `getQueuePresence()` server action which triggered RSC refreshes — fixed to use `fetch()` with equality guard.

## Portability & Vendor Independence
The platform is built on Supabase + Vercel for speed and low operational overhead, but MUST remain portable to self-hosted infrastructure. Every architectural decision should assume we may move to self-hosted PostgreSQL + standalone Next.js in the future.

### Database Layer
- Write standard PostgreSQL. Do NOT use Supabase-specific SQL extensions, proprietary functions, or platform-only features.
- RLS policies must use standard PostgreSQL syntax. The `auth.uid()` and `auth.jwt()` helper functions are acceptable (they're part of Supabase's GoTrue which is available in self-hosted Supabase), but do not build logic that only works via the Supabase Dashboard or Management API.
- All schema changes must be captured in migration files (not applied via the Supabase Dashboard). Migrations must be runnable against any standard PostgreSQL 15+ instance.
- Database views and functions should be plain SQL/plpgsql — no Supabase Edge Function dependencies.

### Data Access Layer
- All Supabase client calls (`supabase.from()`, `supabase.auth`, etc.) must be wrapped in a **data access layer** (e.g. `lib/db/companies.ts`, `lib/db/quotes.ts`). Components and pages must NOT call the Supabase client directly.
- This means if we swap Supabase for a direct `pg` client or Prisma/Drizzle later, we only change the DAL files — not every component in the app.
- Keep the DAL functions typed with our own interfaces, not Supabase's generated types as the primary contract. Supabase types can be used internally within the DAL.

### Authentication
- Auth logic must be isolated behind an auth service layer (e.g. `lib/auth/`). Components call `getCurrentUser()`, `signIn()`, `signOut()` — not `supabase.auth.getUser()` directly.
- Session handling should work with standard JWT patterns. Do not rely on Supabase-specific session management features that wouldn't exist on a self-hosted setup without GoTrue.

### File Storage
- If/when we add file uploads (PDFs, PO documents, attachments), use Supabase Storage via an abstraction layer. The interface should be generic: `uploadFile(bucket, path, file)`, `getFileUrl(bucket, path)` — so we can swap to S3, MinIO, or local filesystem later.

### Hosting & Deployment
- Do NOT use Vercel-specific features: no `@vercel/` packages, no Vercel KV/Blob/Cron, no `vercel.json` rewrites that can't be replicated in standard Next.js config or nginx.
- Next.js must build and run with `next build && next start` (standalone Node.js server). Test this periodically — don't assume Vercel-only deployment.
- Environment variables should follow standard `.env.local` patterns, not Vercel-specific env config.

### Realtime & Edge Functions
- Do NOT use Supabase Realtime subscriptions for core functionality. If real-time updates are needed, implement them as a progressive enhancement that degrades gracefully to polling.
- Do NOT use Supabase Edge Functions. If server-side logic is needed beyond Next.js API routes, use Next.js API routes or server actions — these are portable.

### Practical Test
Ask yourself: "Could I run this on a £20/month VPS with PostgreSQL, Node.js, and nginx?" If the answer is no, the code has a vendor dependency that needs abstracting.

## Planned Integrations
- **HaloPSA** — optional API integration for customer data sync. Placeholder settings page exists. Note: the built-in helpdesk module replaces HaloPSA for ticketing.
- **Claude API** — embedded AI chat assistant for querying Engage data and SharePoint documents. Architecture designed (tool-calling pattern), build prompt ready. Helen AI agent uses Claude for helpdesk triage, draft responses, and diagnostic assist ("Help me Fix This").
- **Microsoft 365 / SharePoint** — Phase 1b of AI integration, for searching NDPs, price lists, and product specs.
- **EnviroSentry** — PSD's own environmental sensor product (Arduino-based)
- **IngressaEdge** — PSD's BLE access control reader product

## Engineer Stock Collection
Purchasing stages picked stock for engineer collection before site visits. QR-based magic link confirmation flow (no auth required, same pattern as quote portal).
- **Migration:** `20260319000001_job_collections.sql` — `job_collections`, `job_collection_lines`, serial registry `collected` status. `20260319000002_collection_nullable_job.sql` — makes `job_id` nullable (collections can be created from SO without a job), adds index on `sales_order_id`. `20260320000002_collection_signatures.sql` — adds `engineer_signature_path`, `engineer_name`, `engineer_initials` to `job_collections`.
- **Number format:** `COL-YYYY-NNNN` (org-wide sequence)
- **Permissions:** `collections.view/create/edit/confirm` — purchasing creates, engineers confirm (separation of duties)
- **Types:** `lib/collections/types.ts` — `JobCollection` (includes `engineer_signature_path`, `engineer_name`, `engineer_initials`), `JobCollectionLine`, `JobCollectionWithDetails`, `CollectionSlipPublic`, `COLLECTION_STATUS_CONFIG`
- **Server actions:** `lib/collections/actions.ts` — `getCollections`, `getCollection`, `getCollectionByToken` (admin client), `getCollectionsForJob`, `getCollectionsForSo`, `getCollectionStats`, `createCollection` (accepts `jobId: string | null`), `confirmCollection` (admin client, accepts signature data), `cancelCollection`
- **Collection slip PDF:** `/api/collections/[id]/slip` — A4 printable with QR code (magic link), large customer name, item list with serials, checkboxes. Uses `qrcode` npm package for server-side QR generation.
- **Magic link:** `/collect/[token]` — standalone mobile-optimised page, no auth, touch-to-confirm items, GPS capture, engineer signature (required), partial confirmation support
- **Confirmation API:** `/api/collect/confirm` — POST endpoint, unauthenticated (token IS the auth). Validates engineer name, initials, and signature. Uploads signature PNG to `job-signatures` storage bucket under `collections/{id}/engineer.png` via admin client. Passes storage path + identity fields to `confirmCollection`.
- **Engineer signature:** Required fields on magic link page: full name, initials (auto-uppercased, max 4 chars), and signature pad (reuses `SignaturePadComponent`). All three are required before confirm buttons are enabled. Signature stored as PNG in `job-signatures` bucket; name/initials stored on `job_collections` record.
- **Serial flow:** `allocated → collected → dispatched`
- **SO-driven workflow:** Primary creation path is from SO fulfilment section ("Prepare Collection" button alongside "Create Delivery Note" — appears when picked lines exist). Creates collection with `job_id: null`, linked via `sales_order_id`. `SoCollectionsSection` on SO detail page shows existing collections with status/print. Collections can also be created from job detail page if the job has a linked SO.
- **Integration:** SO fulfilment section (prepare collection modal + button), SO detail page (collections section), job detail (Collection tab), dashboard (pending collections banner), sidebar nav (Collections in Purchasing section)
- **Detail page "Collected By":** Shows `collected_by_user` avatar if linked, otherwise falls back to `engineer_name` + `engineer_initials` (indigo initials circle). When GPS was captured, an indigo pushpin icon appears next to the name; hovering shows a Leaflet map popout (280×200px, renders to the right of the pin) with an initials-labelled marker and accuracy circle. Click opens Google Maps.
- **Collections table:** "Collected By" column shows user avatar or engineer initials circle + first name. Indigo pushpin icon shown when GPS was captured.
- **GPS map component:** `collections/[id]/gps-map-popout.tsx` — client component, dynamically imports Leaflet, `divIcon` with engineer initials, accuracy circle, OpenStreetMap tiles, no zoom/drag controls.
- **Dependencies:** `qrcode` + `@types/qrcode`, `leaflet` + `@types/leaflet` npm packages
- **Routes:** `/collections` (list with SO column + collected by column), `/collections/[id]` (detail with GPS map popout), `/collect/[token]` (magic link confirmation with signature)

## AI-Assisted Product Creation
"Create with AI" on the products page — split button defaults to screenshot mode, chevron dropdown offers all three input modes:
- **From Screenshot** (default) — paste (Ctrl+V), drag-and-drop, or file browse an image of a product page. Claude Vision OCR extracts product data.
- **From URL** — fetches a supplier/distributor product page, parses HTML with cheerio, extracts data via Claude. Falls back to paste mode on bot protection.
- **From Web Page** — user pastes page text directly, Claude extracts product data.

All three flows converge on the same review form. Key behaviours:
- **Category suggestion**: If Claude's `category_hint` doesn't match an existing category, an amber banner offers to create it on confirmation. New category is added to the dropdown and auto-selected.
- **Supplier linking**: Review form includes supplier dropdown, supplier SKU, standard cost, preferred flag, and product URL. Linked via `product_suppliers` table on save.
- **Source tracking**: Activity log records `source` as `url`, `paste`, or `screenshot`.
- **Files**: `products/ai-create-modal.tsx` (modal), `products/products-table.tsx` (split button), `api/products/analyse-url/route.ts` (API — handles URL fetch, pasted text, and base64 image).
- **Migration dependency**: `product_suppliers.url` column requires `20260306000002_product_supplier_url.sql`. The `createProduct` action handles the column being absent gracefully (fallback insert without `url`).

## Find Serial
"Find Serial" button on the products page opens a modal to look up any serial number and see its full context in one place.
- **Server action:** `findSerial(serialNumber)` in `products/actions.ts` — requires `stock.view`, queries `serial_number_registry` (ilike), joins product/location/PO/DN data, secondary queries for SO+customer and linked jobs
- **UI:** `products/find-serial-modal.tsx` — search input + results card(s) showing serial, product (link), status badge (`in_stock`=green, `allocated`=blue, `collected`=purple, `dispatched`=slate, `returned`=red), location, customer (link), SO (link), install date from linked job (link), PO number, delivery note
- **Integration:** Button in `products-table.tsx` filter bar, visible to all users (not gated by `canCreate`)
- **No migration needed** — uses existing `serial_number_registry` table and FKs

## Quote Attachments
General-purpose file attachments on quotes for storing supplier PDFs, survey notes, photos, and supporting documents.
- **Migration:** `20260310000001_quote_attachments.sql` — `quote_attachments` table (id, quote_id, org_id, file_name, storage_path, file_size, mime_type, uploaded_by, label, source, created_at), `quote-attachments` storage bucket (private, 20MB, PDF/image/Word/Excel)
- **Type:** `QuoteAttachment` interface in `types/database.ts`
- **Server actions:** `quotes/attachment-actions.ts` — `uploadQuoteAttachment`, `deleteQuoteAttachment`, `getQuoteAttachmentUrl` (1-hour signed URLs). Follows deal-reg attachment pattern.
- **UI:** `quotes/[id]/attachments-section.tsx` — collapsible card with count badge, file table with icon/name/label badge/size/date/uploader/delete, drag-and-drop upload
- **Label colours:** "Supplier Quote" (purple), "Survey Notes" (blue), default (grey)
- **Permissions:** Upload requires `quotes.create` or `quotes.edit_all`/`edit_own`; delete requires `quotes.edit_all` or `quotes.delete`. Upload/delete restricted to draft/review status only.
- **Integration:** Quote detail page fetches `quote_attachments` in its `Promise.all` block and renders the section after info cards

## AI Quote Generation from Supplier PDF/Email
"AI Quote" button on the quotes page accepts supplier pricing via PDF, email, or screenshot — extracts line items via Claude, matches against the product catalogue, and creates a draft customer quote with buy prices pre-populated.

### Input Modes
The modal offers three tabbed input modes (purple active tab border):
- **PDF** — existing drag-and-drop PDF upload (unchanged)
- **Email** — drop a `.eml` file (saved from Outlook) OR paste email text into a textarea. `.eml` parsing via `mailparser` extracts body text + sender metadata from headers.
- **Screenshot** — Ctrl+V paste or drag-and-drop an image of a supplier email/quote. Claude Vision OCR extracts pricing.

### Extraction Pipeline
- **Types:** `lib/supplier-quote/types.ts` — `ExtractedSupplierQuote` (includes `sender_email`, `sender_name`), `ExtractedSupplierLine`, `ProductMatchResult`, `SuggestedProduct`, `SupplierMatchResult` (includes `match_method`)
- **PDF extraction:** Reuses `lib/inbound-po/extract.ts` → `extractTextFromPDF` (pdf-parse → Claude Vision OCR fallback)
- **Email parsing:** `lib/supplier-quote/email-extract.ts` — `extractTextFromEml(buffer)` via `mailparser.simpleParser`, returns body text + sender email/name + subject + date. `extractDomain(emailOrUrl)` strips `www.` for consistent domain comparison.
- **AI extraction:** `lib/supplier-quote/ai-extract.ts` — three extraction functions:
  - `extractSupplierQuoteData(text, apiKey)` — PDF prompt (existing)
  - `extractSupplierQuoteFromEmail(text, apiKey, senderEmail?, senderName?)` — email-specific prompt handling conversational text, forwarding chains, signatures. Pre-populates sender fields from .eml headers when available.
  - `extractSupplierQuoteFromScreenshot(base64, mimeType, apiKey)` — Claude Vision multimodal call with email-specific prompt
  - All use 2-attempt retry with 2s delay, JSON normalization with alternative field name fallbacks
- **Product matching:** `lib/supplier-quote/match.ts` — 4-tier matching against product catalogue:
  1. SKU exact match (`product_code` → `products.sku`) → confidence: `exact`
  2. Supplier SKU match (`product_code` → `product_suppliers.supplier_sku`) → confidence: `exact`
  3. Manufacturer part match (`manufacturer_part` → `products.sku`) → confidence: `high`
  4. Description fuzzy match (token overlap >60% against product names) → confidence: `low`, top 3 suggestions
- **Supplier matching:** `matchSupplier(supabase, orgId, supplierName, senderEmail?)` — single query fetches all suppliers with `email`/`website` fields, then 4-tier matching:
  1. Exact name match (case-insensitive) → `match_method: 'name_exact'`
  2. Email domain match (sender email domain vs supplier `email`/`website` domains) → `match_method: 'email_domain'`
  3. Name contains (one-way and reverse) → `match_method: 'name_contains'`
  4. Token overlap fuzzy → `match_method: 'name_fuzzy'`
- **No migration required** — domain matching uses existing `suppliers.email` and `suppliers.website` columns

### API & Actions
- **API route:** `/api/quotes/analyse-supplier/route.ts` — synchronous POST, accepts multipart FormData with one of: `file` (PDF or .eml), `email_text` (pasted content), or `screenshot` + `screenshot_type` (base64 image). Returns extracted data + matches + lookup data + `input_type` field.
- **Server action:** `createQuoteFromSupplierImport` in `quotes/actions.ts` — creates quote (draft) → single group → lines (all drop_ship) → 100% direct attribution → auto-attaches file with label from `attachment_label` field ("Supplier Quote" for PDFs, "Supplier Email" for email inputs)
- **Supplier auto-creation:** If AI extracts a supplier name with no DB match, the supplier is created automatically on quote creation via `new_supplier_name` field

### Modal UI
- **File:** `quotes/supplier-quote-modal.tsx` — multi-step modal triggered by "AI Quote" button in `quotes-page-actions.tsx`
- **Step 1 — Input:** Tabbed interface (PDF / Email / Screenshot) with purple active tab. PDF tab: drag-and-drop zone. Email tab: .eml drop zone + divider + paste textarea + "Analyse Email" purple button. Screenshot tab: paste/drop zone with image preview + "Analyse Screenshot" purple button.
- **Step 2 — Review:** Expanded modal (`max-w-5xl`) with:
  - Extraction info bar: supplier name, reference, sender email (if extracted), match badge ("Supplier matched" or "Domain matched" for email domain matches)
  - Header fields: searchable Supplier and Customer dropdowns (`SearchableSelect` component), Contact (filtered by customer), Assigned To, Brand, Quote Type
  - Amber banner when supplier will be auto-created (no DB match)
  - Editable lines table: description, product code, product match indicator (exact=green, high=green, low=amber with suggestions, none=red with search/create), qty, buy price, sell price, skip checkbox
  - Quick product creation: inline SKU + Name form, calls existing `createProduct` action with supplier linking
  - Footer: total buy value, matched/unmatched count, "Create Quote" button
- **Redirects** to `/quotes/{id}/edit` after creation for sell price entry and fine-tuning

## Stocking Orders & Auto-Allocate on PO Receipt
POs now support two types: `customer_order` (linked to an SO, the default) and `stock_order` (no SO link, for inventory replenishment).

### Schema Changes
- **Migration:** `20260320000002_stocking_orders.sql` — makes `sales_order_id` nullable on `purchase_orders`, `sales_order_line_id` nullable on `purchase_order_lines`, adds `purchase_type` TEXT column with CHECK constraint
- **Types:** `PurchaseOrder.sales_order_id` is now `string | null`, `PurchaseOrderLine.sales_order_line_id` is now `string | null`, `PurchaseOrder.purchase_type` added

### Auto-Allocation on Receipt
When goods are received against a customer order PO (any delivery destination), `receivePoGoods()` automatically:
1. Registers serials with status `allocated` (not `in_stock`)
2. Creates `stock_allocations` records linking to the SO line
3. Increases `quantity_allocated` via RPC
4. Creates `allocated` stock movement
5. Returns `autoAllocated: true`

For stock orders, serials go to `in_stock` — no allocation created.

### Stock Order Creation
- **Route:** `/purchase-orders/new` — "New Stock Order" button on the PO list page
- **Form:** Supplier (searchable), expected delivery date, delivery instructions, notes, product lines with supplier-specific pricing
- **Server action:** `createStockOrder()` in `purchase-orders/actions.ts`
- **Behaviour:** Creates PO with `purchase_type = 'stock_order'`, `sales_order_id = NULL`, `delivery_destination = 'psd_office'`

### UI Changes
- **PO list:** "Stock Order" blue badge on stock order rows, type filter dropdown (All/Customer Order/Stock Order), null-safe customer/SO columns
- **PO detail:** "Stock Order" badge in header, "Stock Replenishment" label in context panel, hides Quoted Cost/Variance stats, hides Route/Quoted Buy/Variance columns in lines table
- **Badge config:** `PURCHASE_TYPE_CONFIG` in `badge.tsx`
- **PO PDF:** Handles null `sales_order_id` gracefully

## Quote Acceptance Enhancements
Three acceptance paths for quotes, tracked via `accepted_by_type` on the `quotes` table.

### Acceptance Paths
- **Customer Portal** (`customer_portal`): Customer accepts via `/q/[token]` portal with e-signature + PO number + optional PO file upload. Requires staff acknowledgement before SO creation.
- **Internal Manual** (`internal_manual`): Staff clicks "Accept Quote" button on sent quotes. Modal with optional PO number. Auto-acknowledges (no separate acknowledgement step needed).
- **AI-Powered** (`internal_ai_accept`): Staff clicks "AI Accept" (purple, sparkle icon) on sent quotes. Upload customer PO as PDF/email/screenshot → Claude extracts PO data → verification table compares against quote (customer name, total value, line count) → accept with extracted PO number.

### AI Accept Pipeline
- **API route:** `/api/quotes/accept-po/route.ts` — accepts FormData with `quote_id` + one of: `file` (PDF), `email_text`, `screenshot`+`screenshot_type`
- **Text extraction:** pdf-parse for native text, Claude Vision OCR fallback for scanned PDFs, Claude Vision for screenshots
- **Data extraction:** Claude Sonnet extracts structured JSON: `po_number`, `customer_name`, `total_value`, `lines[]`
- **Total computation:** Totals computed from `quote_lines` (filtering out optional lines), checked against both ex-VAT subtotal and inc-VAT grand total. Response includes `quote_total_ex_vat`, `quote_total_inc_vat`, and `total_match_type` (`ex_vat` | `inc_vat` | `null`).
- **Customer name matching:** Fuzzy matching via `normalizeForMatch()` (strips Ltd/PLC/Inc suffixes + punctuation) then: exact → contains (bidirectional) → token overlap (>50% threshold)
- **Line count:** Compared against non-optional lines only
- **PO attachment:** On successful extraction, the uploaded PDF or screenshot is auto-attached to the quote as a `quote_attachment` with label "Customer PO" and source `ai_accept`. Best-effort — attachment failure does not block the extraction flow. Email text input has no file to attach.
- **UI:** `quotes/[id]/ai-accept-modal.tsx` — 2-step modal. Step 1: tabbed input (PDF/Email/Screenshot) with purple active tabs. PDF tab auto-analyses on drop (no separate button click needed, purple spinner while analysing). Email/Screenshot tabs retain the "Analyse PO" button. Step 2: verification table with check/cross/dash icons, both ex-VAT and inc-VAT totals shown with match indicator, editable PO number, extracted lines table, warnings for failed checks.

### PO Number Gate on PO Generation
- **Server-side:** `generatePurchaseOrders()` in `purchase-orders/actions.ts` blocks if SO has no `customer_po`
- **Client-side:** SO lines table checks `customerPo` prop before showing PO generation preview. If missing, shows "Customer PO Number Required" modal → saves via `updateSoCustomerPo()` → continues to PO generation
- **Migration:** `20260318000001_quote_accepted_by_type.sql` — adds `accepted_by_type TEXT` to quotes, backfills existing as `customer_portal`

### Hidden Service Lines on PDFs
Service-type products with £0 sell price (e.g. SVC-DELIVERY for delivery costs) are hidden on customer-facing documents: quote PDF, invoice PDF, and customer portal. Lines are flagged as `is_hidden_service` during PDF route data preparation. This allows delivery costs to flow through the margin chain without confusing customers.

## Onsite Scheduling & Job Tasks
Dispatch calendar with Gantt-style timeline, field engineer mobile app, and structured job task checklists.

### Scheduling Core
- **Migration:** `20260304000001_onsite_scheduling.sql` — `job_types`, `jobs`, `job_notes`, `job_photos`, `job_parts`, `skills`, `engineer_skills`, `job_required_skills`
- **Validation:** `20260304000003_job_validation.sql` — `validated_at`, `validated_by`, `validation_notes` on jobs; `job_reports` table
- **Teams:** `20260304000002_teams.sql` — `teams`, `team_members`; only Infrastructure/Engineering teams appear on schedule
- **Signatures:** `20260305000002_job_signatures.sql` — engineer + customer e-signatures on job completion
- **Job number format:** `JOB-{YEAR}-{NNNN}` (auto-incrementing)
- **Permissions:** `scheduling.view/create/edit/delete/admin`
- **Source linking:** Jobs have `source_type` (`manual`, `sales_order`, `ticket`, `contract`, `visit`) and `source_id` (UUID). `CreateJobInput` accepts both. Used to link jobs to sales orders for install tracking and collection workflows.
- **SO → Job integration:** SO list page has "Install?" column. If `requires_install=true` and no linked job exists, shows red icon — clicking navigates to `/scheduling/jobs/new` with URL params pre-populating customer, contact, delivery address, SO reference, and `source_type=sales_order`. Once a job is created with `source_type='sales_order'` and `source_id={soId}`, the icon turns green. Green icon links to the job detail page. `getSalesOrders()` fetches linked jobs via `source_type='sales_order'` query.
- **Job form prefill:** `/scheduling/jobs/new` reads URL params (`source_type`, `source_id`, `source_ref`, `customer_id`, `contact_id`, address fields). `JobForm` accepts `sourceType`, `sourceId`, `sourceRef`, `prefill` props. Shows blue info banner "Linked to SO-2026-XXXX". Prefilled address is preserved until user changes company.

### Job Task Templates & Checklists
- **Migration:** `20260305000003_job_task_templates.sql` — `job_task_templates`, `job_task_template_items`, `job_tasks`; adds `task_template_id` to `job_types`
- **Response types:** Each task item has a `response_type`: `yes_no` (checkbox toggle), `text` (free-form input), `date` (date picker). Stored in both `job_task_template_items` (definition) and `job_tasks` (materialised instance)
- **Task materialisation:** When a job is created via `createJob`, if the job type has a linked template, all template items are copied to `job_tasks` with `response_type` preserved
- **Completion enforcement:** `completeJob` checks all required `job_tasks` are completed before allowing submission. For `yes_no` = toggled on, for `text`/`date` = has a `response_value`
- **`toggleJobTask(taskId, opts?)`:** For `yes_no` types, toggles `is_completed`. For `text`/`date`, sets `is_completed` based on whether `response_value` is non-empty
- **RLS:** Uses `auth_org_id()` and `auth_has_permission()` helpers — NOT raw `user_roles` joins (those don't exist)

### Config Pages
- **Route:** `/scheduling/config/` — tab bar layout with "Job Types" and "Task Templates" tabs
- **Job Types Manager:** CRUD with colour palette, slug auto-generation, default duration, linked template dropdown
- **Task Templates Manager:** CRUD with inline items editor — description, response type dropdown (Yes/No, Free Text, Date), required checkbox, reorder arrows
- **Access:** Settings cog on scheduling PageHeader (admin-only), links to config

## Invoicing Module
- **Migration:** `20260308000001_invoicing_module.sql` — extends `invoices` (brand_id, quote_id, contact_id, invoice_type, parent_invoice_id, customer_po, payment_terms, sent_at, internal_notes, vat_rate, xero_*), extends `invoice_lines` (product_id, sort_order, group_name), adds `quantity_invoiced` to `sales_order_lines`, adds `invoice_prefix` to `brands`
- **Invoice number format:** `{brand.invoice_prefix}-{YYYY}-{NNNN}` (e.g. `INV-2026-0001`)
- **Credit note numbers:** `{parent_invoice_number}-CN{N}` (e.g. `INV-2026-0001-CN1`)
- **Permissions:** `invoices.view/create/edit/delete` — admin/accounts=full, sales=view+create, purchasing/engineering=view
- **Partial invoicing:** `quantity_invoiced` on SO lines tracks how much has been invoiced. Create Invoice modal shows remaining qty per line.
- **Invoice types:** `standard`, `proforma`, `credit_note`
- **Status flow:** draft → sent → paid (with overdue detection client-side via due_date)
- **Voiding:** Reverses `quantity_invoiced` on SO lines, freeing them for re-invoicing
- **Credit notes:** Stored as invoices with `invoice_type='credit_note'`, negative totals, `parent_invoice_id` reference
- **Brand inheritance:** Quote → SO → Invoice. Invoice prefix comes from brand on the originating quote.
- **PDF generation:** `/api/invoices/[id]/pdf` — branded layout with VOID watermark for void invoices, credit note styling
- **SO integration:** `SoInvoicesSection` on SO detail page shows invoice table, progress bar, Create Invoice button
- **Routes:** `/invoices` (list with stat cards), `/invoices/[id]` (detail with breadcrumb chain), `/invoices/[id]/edit` (draft-only)
- **Seed data:** Seed button on `/settings/data`, creates sample invoice from first SO

### GPS Location Logging
Every job interaction captures the device's GPS coordinates for audit and tracking. GPS failure never blocks the action.
- **Migration:** `20260313000001_job_gps_log.sql` — `job_gps_log` table (id, job_id, user_id, org_id, event_type, latitude, longitude, accuracy_metres, captured_at, metadata JSONB)
- **Event types:** `travel_started`, `arrived`, `completed`, `note_added`, `task_toggled`, `photo_added`, `status_changed`
- **Types:** `GpsCoords`, `GpsEventType`, `JobGpsLog` in `types/database.ts`
- **Hook:** `lib/use-geo-capture.ts` — `useGeoCapture()` returns `capturePosition()` (coords or null) and `captureWithReason()` (coords + typed error: `permission_denied`, `position_unavailable`, `timeout`, `not_supported`). High accuracy, 10s timeout, 30s cache.
- **Server helper:** `logGpsEvent()` in `scheduling/actions.ts` — fire-and-forget insert (same pattern as `logActivity`). Called from `changeJobStatus`, `addJobNote`, `toggleJobTask`, `completeJob`.
- **Query:** `getJobGpsLog(jobId)` — fetches log entries with user info, ordered by `captured_at`
- **HTTPS required:** Browser Geolocation API only works on HTTPS (localhost exempted in Chrome). GPS feedback shows specific error reason to users.
- **Non-blocking:** GPS capture runs before server actions; if it fails, the action proceeds without coordinates.

### Mobile Scheduling Views
The `/scheduling` route serves both desktop and mobile using `MobileDetector` (same pattern as helpdesk).
- **Schedule page:** `scheduling/page.tsx` wraps in `<MobileDetector>` — desktop shows dispatch calendar, mobile shows `<MobileScheduleView>`
- **Mobile schedule:** `scheduling/mobile-schedule-view.tsx` — "My Schedule" card-based day view with status summary pills, priority-coloured left borders, time/company/address/contact info, phone links
- **Job detail page:** `scheduling/jobs/[id]/page.tsx` wraps in `<MobileDetector>` — desktop shows `<JobDetail>`, mobile shows `<MobileJobDetail>`
- **Mobile job detail:** `scheduling/jobs/[id]/mobile-job-detail.tsx` — status action buttons with GPS capture, notes, task toggling with GPS, GPS feedback text, 800ms delay before `router.refresh()` to preserve feedback visibility
- **Mobile completion:** `scheduling/jobs/[id]/complete/` — server page + `scheduling-completion-form.tsx` with GPS capture on mount and submit, hidden GPS FormData fields, redirects to `/scheduling` on success

### Field Engineer Mobile App
- **Routes:** `/field` (today's jobs), `/field/job/[id]` (detail), `/field/job/[id]/complete` (completion form)
- **Layout:** Standalone mobile-first layout at `/app/field/layout.tsx`, no sidebar
- **GPS capture:** `field-job-detail.tsx` uses `useGeoCapture()` on status changes, notes, and task toggles. `completion-form.tsx` captures GPS on mount and re-captures at submit time, injects as hidden FormData fields. GPS feedback with specific error messages shown to users.
- **Completion form:** Task checklist at top with progress bar; checkboxes for yes_no, text inputs for text, date pickers for date; required task enforcement; engineer + customer signatures
- **Field detail:** Tasks card shows checklist with response type badges and values

### Office Views
- **Job detail:** `/scheduling/jobs/[id]` — Tasks tab with progress bar, response type badges, response values, completion timestamps. **Location tab** with GPS log panel: interactive Leaflet map with colour-coded numbered markers, tooltips (event type, time, user, accuracy), dashed polyline connecting events in order, colour legend, and timeline list with Google Maps links. Accuracy indicator: green <20m, amber <100m, red >100m.
- **Job report PDF:** `/api/jobs/[id]/report` — includes Task Checklist section with response values
- **Map dependency:** `leaflet` + `react-leaflet` + `@types/leaflet` — OpenStreetMap tiles (no API key, portable). Leaflet loaded via dynamic import to avoid SSR issues.

### Seed Data
- 3 templates: Server Maintenance (7 items), Installation (8 items), Network Survey (5 items)
- Templates linked to maintenance, installation, survey job types
- Seed backfills `job_tasks` for existing jobs when re-run
- **Important:** Seed inserts jobs directly (not via `createJob`), so task materialisation is done explicitly in the seed loop

## Helen Diagnostic Assist ("Help me Fix This")
Teal button in ticket header opens `helen-assist-panel.tsx` modal. Calls Claude Sonnet via `/api/helpdesk/assist` with ticket context, returns structured JSON (summary, possibleCauses, steps, followUpQuestions, confidence).
- **Migration:** `20260305000001_helen_assist.sql` — `helen_assist_log` (token usage tracking), `ticket_scratchpad_notes` (private per-ticket notes)
- **View:** `v_helen_assist_usage` (joins assist_log → users, tickets, categories for reporting)
- **Confidence badge:** green (high), amber (medium), red (low)
- **Selectable steps:** Teal checkboxes on resolution step cards. Deselected steps fade to 50% opacity. "Select all / Deselect all" toggle. Compose Reply button shows count when partial selection; composes only selected steps, renumbered sequentially.
- **Selectable follow-up questions:** Purple checkboxes on purple-themed cards (`border-purple-200 bg-purple-50`). Same select/deselect/compose behaviour as steps. Purple Compose Reply button with count badge.
- **Compose Reply:** Injects formatted text into the reply box via `useRef` callback pattern. Steps get "I've looked into this..." intro; questions get "To help me investigate..." intro.
- **Repeat-use intelligence:** Auto-populates context from prior diagnostics + conversation history, warns if customer hasn't responded since last assist, sends prior diagnostics to API to avoid repeating suggestions.
- **Scratchpad:** `scratchpad-panel.tsx` — collapsible sidebar panel, resizable drag handle (120–600px), source badges (Manual=slate, Helen AI=teal), pin/edit/delete, creator-only delete
- **Reporting:** `/helpdesk/reports/assist-usage` — admin-only page with stat cards, date/user filters, usage table, top-5 categories training insight

## Ticket Presence (Collision Warning)
Amber banner on ticket detail pages warns when another agent is viewing the same ticket, preventing duplicate replies. Reply submission shows a confirmation dialog when other agents are present.
- **Migration:** `supabase/migrations/20260307000001_ticket_presence.sql` — ephemeral `ticket_presence` table (PK `ticket_id, user_id`), no `org_id` (RLS via parent ticket join, same as `ticket_watchers`)
- **Hook:** `helpdesk/tickets/[id]/use-ticket-presence.ts` — 15s heartbeat via `fetch()` to API route, `sendBeacon` for cleanup on `beforeunload`, `fetch` with `keepalive` as fallback
- **Banner:** `helpdesk/tickets/[id]/presence-banner.tsx` — amber styling, avatar circles with user colour, smart pluralisation
- **Reply guard:** `ReplyBox` receives `viewers` prop from `TicketDetail`. When sending a customer-facing reply with other agents present, an amber confirmation modal shows their names ("Jane Smith is currently viewing this ticket. Are you sure you want to send your reply?"). Internal notes bypass the check. "Send Anyway" proceeds, "Cancel" dismisses.
- **API route:** `/api/helpdesk/ticket-presence/route.ts` — POST for heartbeat (upsert + GC + return viewers), DELETE for clear. Supports `_method=DELETE` query param for `sendBeacon` compatibility.
- **Type:** `PresenceViewer` interface remains in `helpdesk/actions.ts` (imported as type-only by presence-banner and reply-box)
- **Timing:** 15s heartbeat, 45s staleness threshold (3 missed beats = gone), 5min hard-delete GC
- **Queue indicators:** `getQueuePresence()` server action returns `Record<ticketId, PresenceViewer[]>` for all active viewers. Helpdesk page passes `initialPresence` to `TicketQueue`, which polls every 30s. `QueuePresenceAvatar` component renders 20px pulsing avatar/initials circles next to ticket numbers. CSS animations: `queue-presence-pulse` (3s opacity cycle), `queue-presence-ring` (3s expanding ring effect).
- **No WebSockets/Realtime** — pure polling via API route (`fetch()`), portable

## Ticket Auto-Close
Automatically closes helpdesk tickets in `waiting_on_customer` status after a configurable period of business hours without customer response, with a warning before closure.
- **Migration:** `supabase/migrations/20260317000001_ticket_auto_close.sql` — adds `hold_open BOOLEAN DEFAULT false`, `waiting_since TIMESTAMPTZ`, `auto_close_warning_sent_at TIMESTAMPTZ` to `tickets`
- **Settings:** `org_settings` category `helpdesk`, keys: `auto_close_enabled` (`true`/`false`), `auto_close_hours` (default `48`), `auto_close_warning_hours` (default `24`)
- **Settings UI:** `/settings/helpdesk/` — `AutoCloseSettingsForm` with enable toggle, close-after hours, warning hours. Linked from settings-nav.tsx under "Helpdesk" section.
- **Processing:** `lib/helpdesk/auto-close.ts` — `processAutoClose(supabase, orgId)` queries waiting tickets, calculates elapsed business minutes via `lib/sla.ts`, closes or warns as appropriate. Weekend gap check: warnings only sent if remaining hours fall entirely within business days.
- **API route:** `/api/helpdesk/auto-close/route.ts` — GET endpoint, authenticated, calls `processAutoClose`
- **Trigger:** Fire-and-forget `triggerAutoClose()` server action called from helpdesk queue page on load
- **Status transitions:** Agent replies auto-set `waiting_on_customer` + `waiting_since`. Customer portal replies clear `waiting_since`. Manual status changes track `waiting_since` lifecycle.
- **Hold Open:** Per-ticket toggle in metadata sidebar (amber styling). Badge in ticket header. Tickets with `hold_open=true` are exempt from auto-close.
- **Auto-close countdown:** Metadata sidebar shows "Auto-close in X business hours" when `waiting_since` is set and ticket is not held open.

## System Presence (Online Avatars in Sidebar)
Shows coloured avatars of online colleagues in the sidebar. Active users have full-colour avatars with emerald dot; idle users are greyed out (40% opacity); offline users are hidden.
- **Migration:** `supabase/migrations/20260309000001_system_presence.sql` — `system_presence` table (PK `user_id`), `org_id` stored directly for simpler RLS, `last_heartbeat` + `last_active` timestamps
- **API route:** `/api/presence/route.ts` — POST for heartbeat (upsert + GC + return online users), DELETE for clear
- **Hook:** `components/use-system-presence.ts` — tracks `mousemove`/`keydown`/`click`/`touchstart` (passive, ref-only), 15s heartbeat via `fetch()` to API route with `isActive` = last interaction <2min ago, cleanup on unmount + `beforeunload`. Uses JSON equality guard (`lastJsonRef`) to skip `setUsers()` when data unchanged — prevents unnecessary Sidebar re-renders.
- **Component:** `components/online-avatars.tsx` — expanded sidebar: "Online" label + horizontal overlapping avatar stack (max 6 + overflow chip); collapsed sidebar: vertical small avatar stack (max 5 + overflow chip)
- **Sidebar integration:** `components/sidebar.tsx` — `<OnlineAvatars>` rendered between `</nav>` and notifications, conditionally shown when users.length > 0
- **Thresholds:** 15s heartbeat, 2min active window (coloured), 5min online window (visible), 5min GC
- **Same pattern as ticket presence** — pure polling via API routes, no WebSockets, portable

## Avatar Image Uploads
Supports uploaded avatar images across the platform with an image-or-initials fallback pattern.

### Storage & Schema
- **Migration:** `supabase/migrations/20260310000002_avatar_uploads.sql` — adds `avatar_url TEXT` to `users` table, creates `avatars` storage bucket (public, 2MB, PNG/JPG/WebP)
- **Storage policies:** Public read, authenticated insert/update/delete
- **Upload API:** `/api/avatars/upload` — accepts FormData with `type` (agent|user), `targetId`, `file`, optional `oldPath` + `delete` flag. Agent uploads require admin; user uploads require self or admin.

### AI Agent Avatars
- **Settings page:** `/settings/avatars` — 3 agent cards (Helen, Jasper, Lucia) with upload/replace/remove
- **Storage:** `org_settings` category=`avatars`, keys: `agent_helen_avatar`, `agent_jasper_avatar`, `agent_lucia_avatar`
- **Utility:** `lib/agent-avatars.ts` — `getAgentAvatars(orgId)` returns `{ helen, jasper, lucia }` URLs
- **Wiring:** Dashboard layout fetches `getAgentAvatars()`, passes to `<Sidebar>` and `<ChatPanel>` as props
- **Chat panel:** `AgentAvatar` helper component replaces all 4 inline avatar circles (toggle button, header, messages, loading)
- **Agent chat pages:** `agentAvatarUrl` prop on `<AgentChat>` component, all 3 pages (Helen/Jasper/Lucia) fetch and pass avatar URLs
- **Sidebar:** Agent nav items show tiny avatar images when available, fallback to emoji via `SidebarAgentAvatar`

### User Avatars
- **Auth layer:** `AuthUser.avatarUrl` mapped from `users.avatar_url` in `lib/auth.ts`
- **Avatar component:** `components/ui/avatar.tsx` — accepts `avatar_url` on user object + standalone `avatarUrl` override prop, renders `<img>` with `object-cover` + `onError` fallback to initials
- **Team management:** Upload/remove in edit modal (`team-table.tsx`), `avatar_url` persisted via `updateUser()` in `team/actions.ts`
- **Propagated to:** Online avatars, ticket presence banner, dispatch calendar engineer rows, field layout header
- **All presence/scheduling queries** include `avatar_url` in their user selects

### Fallback Pattern
Every avatar renders inside a coloured circle. When a URL is present, an `<img>` with `object-cover` fills the circle. On `onError`, the image hides and initials are restored. This pattern is consistent across `Avatar`, `AgentAvatar`, `UserAvatar`, `SidebarAgentAvatar`, `ViewerAvatar`, and inline avatar circles.

## AI Chat Agents (Jasper, Helen, Lucia)
Three embedded AI agents powered by Claude API with tool-calling, each specialised for a domain.

### Architecture
- **Agents:** Jasper (sales), Helen (helpdesk), Lucia (operations/purchasing)
- **API routes:** `/api/agents/{helen,jasper,lucia}/route.ts` — each has its own system prompt, tool definitions, and handler functions with multi-turn tool-calling loops (max 10 iterations)
- **Floating chat panel:** `components/chat-panel.tsx` — bottom-right drawer (`h-[50vh]`, responsive) auto-selects agent based on current page context. Agent avatar, colour-coded bubbles, suggested questions.
- **Dedicated agent pages:** `/agents/{helen,jasper,lucia}/page.tsx` using `components/agent-chat.tsx`
- **Markdown renderer:** `lib/chat-markdown.ts` — shared renderer for AI responses with tables, lists, code blocks, bold/italic, headings, and auto-linking

### Chat Persistence
- **Migration:** `20260310000003_chat_sessions.sql` — `chat_sessions` (user_id, agent_id, org_id, is_archived) + `chat_messages` (session_id, role, content), RLS scoped to user's own non-archived sessions
- **Migration:** `20260310000004_chat_archive.sql` — `is_archived` flag, partial unique index `WHERE is_archived = false`, `v_chat_archive` view joining user info
- **Server actions:** `lib/chat-sessions.ts` — `loadChatSession`, `loadAllChatSessions`, `appendChatMessages`, `clearChatSession` (archives, doesn't delete)
- **Behaviour:** Sessions persist across page refreshes and logins. "New chat" button archives current session and starts fresh. One active session per user per agent; unlimited archived sessions.

### Chat Archive (Admin)
- **Route:** `/settings/chat-archive` — admin/super admin only via `requirePermission('settings', 'view')`
- **UI:** `settings/chat-archive/chat-archive-list.tsx` — stat cards, search/filter by agent/status, sessions table, full thread viewer modal with markdown rendering
- **Data access:** Uses `createAdminClient()` to bypass RLS for cross-user visibility
- **Settings nav:** "Chat Archive" in System section

### Markdown & Auto-Linking
- **Internal links:** Markdown links `[text](/path)` get `data-internal="true"` attribute; `createMarkdownClickHandler(router)` intercepts clicks for client-side navigation via `router.push()`
- **Reference auto-linking:** Bare reference numbers (Q-2026-XXXX, TKT-XXXX, SO-XXXX etc.) auto-link to list page with `?search=` param. Skips matches already inside `<a>` tags to prevent double-linking.
- **Bare path detection:** Internal paths like `/quotes/{uuid}` auto-detected and linkified
- **Safe HTML:** Colour `<span>` tags from AI (for margin formatting) are unescaped after HTML sanitisation
- **Table rendering:** Tables wrapped in scrollable `overflow-x-auto` container with compact `text-[11px]` sizing

### Agent Prompt Rules
All agent system prompts enforce these formatting rules:
- Every record reference MUST be a markdown link with the UUID from tool results (e.g. `[Q-2026-0019](/quotes/{uuid})`)
- Tables MUST have a maximum of 3 columns — responses display in a narrow chat bubble
- No Margin column in tables — mention average margin in summary text instead
- Keep column content short and abbreviated
- Lists use `list-inside` positioning to stay within bubble boundaries

## Reference
The original React prototype is available in the project as `psd-slm-prototype.jsx`. Use it for UI patterns and data model reference but do NOT import from it — we're rebuilding with proper architecture.
