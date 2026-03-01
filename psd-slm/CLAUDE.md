# Innov8iv Engage — Sales Lifecycle Management (SLM)

## Project Overview
Next.js + TypeScript + Supabase platform for managing the full commercial lifecycle: opportunities → quotes → sales orders → purchase orders → invoicing → commission.

## Tech Stack
- **Frontend:** Next.js with TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, REST API, Row-Level Security)
- **Hosting:** Vercel (auto-deploys from GitHub main branch)
- **Repo:** GitHub private repository

## Critical Business Rules

### 1. Deal Registration Pricing
Same product can have different buy prices per customer. When a customer has an active deal registration with a supplier, the buy price on quote lines auto-populates from the deal reg, NOT the product catalogue default. The `deal_reg_line_id` field traces the pricing source through quote → SO → PO.

### 2. 1:1 Sales Order to Purchase Order Mapping
Every PO belongs to a specific Sales Order (`purchase_orders.sales_order_id` is required). Every PO line maps to a specific SO line (`purchase_order_lines.sales_order_line_id` is required). Stock is NEVER pooled across customers. Two customers ordering identical products generate separate POs with separate costs.

### 3. Per-Line Margin Tracking
Buy and sell prices are recorded at every stage: quote line → SO line → PO line → invoice line. Margin is calculated per line, not just at totals. Commission is calculated from ACTUAL invoiced margin, not quoted margin.

### 4. Sales Attribution
Each quote has attribution entries (must total 100%). Types: direct, involvement, override. These splits carry through to commission calculation when invoices are raised.

### 5. Fulfilment Routes
Each quote/SO line has a fulfilment route — this describes **who ships to the customer**, not where PSD sources the item from:
- `from_stock` — PSD delivers to customer. The item may come from existing inventory or be purchased first — that sourcing decision happens at SO processing time, not at quote time.
- `drop_ship` — Supplier ships direct to customer. PSD never handles the goods.

Default is always `from_stock`. `drop_ship` is a deliberate per-line choice, never auto-defaulted. The `is_stocked` flag on products indicates PSD may hold inventory, but does NOT restrict route selection.

### 6. Quote Types
`business`, `education`, `charity`, `public_sector` — affects commission rates.

## Database
Schema is deployed to Supabase. Key tables: `customers`, `contacts`, `products`, `suppliers`, `deal_registrations`, `deal_registration_lines`, `opportunities`, `quotes`, `quote_groups`, `quote_lines`, `quote_attributions`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`, `invoices`, `invoice_lines`, `commission_entries`, `commission_rates`, `activity_log`, `users`, `roles`, `permissions`, `role_permissions`.

Key views: `v_margin_traceability`, `v_commission_summary`, `v_active_deal_pricing`.

Key RPC functions: `clear_must_change_password` (SECURITY DEFINER — lets users clear their own forced-change flag).

## Authentication & RBAC
Supabase Auth with email/password. Row-level security scoped to organisation. Full RBAC system with `roles`, `permissions`, and `role_permissions` tables. 6 roles: Super Admin, Admin, Sales, Accounts, Purchasing, Engineering (~50 permissions across 13 modules).

- Auth helpers: `requireAuth()` / `requirePermission(module, action)` from `src/lib/auth.ts`
- Client-side: `useAuth()` hook from `src/components/auth-provider.tsx`
- Proxy-based route protection in `src/proxy.ts` (Next.js 16 pattern, not middleware.ts)
- Invited users get `must_change_password: true` and are redirected to `/auth/change-password` on first login
- Auth admin operations (create/ban/unban users) use the service-role client from `src/lib/supabase/admin.ts`

## Team Members
- Steve Dixon (admin) — MD, lead developer
- Mark Reynolds (sales)
- Rachel Booth (sales)
- Jake Parry (sales)
- Lisa Greenwood (admin)
- Dan Whittle (tech)
- Sam Hartley (tech)

## UI Conventions
- Use Tailwind CSS for all styling
- Consistent component patterns: tables with sortable columns, stat cards, modals for forms, badge components for statuses
- Margin colour coding: green ≥30%, amber ≥15%, red <15%
- Currency formatting: GBP with Intl.NumberFormat("en-GB")
- Status badges with colour/background pairs (see existing prototype for patterns)
- Clean, professional aesthetic — not flashy. Think business tool, not consumer app.

## Module Build Order
1. ~~Companies & Contacts~~ (done)
2. ~~Authentication & Roles~~ (done)
3. ~~Products, Suppliers & Categories~~ (done)
4. Deal Registrations (next)
5. Opportunities & Pipeline
6. Quote Builder
7. Sales Orders & Purchase Orders
8. Invoicing & Commission

## Code Conventions
- TypeScript strict mode
- Supabase client via `@supabase/supabase-js`
- Server components where possible, client components only when interactivity needed
- All database operations through Supabase client (not raw SQL from frontend)
- Form validation before submission
- Optimistic UI updates where appropriate
- Activity logging on all create/update/delete operations via `logActivity()` from `src/lib/activity-log.ts` — fire-and-forget, never blocks responses
- Server actions use permission checks via the RBAC system (`requirePermission(module, action)`)
- Always roll back partial operations on failure (e.g. delete orphaned auth account if user row insert fails)

## Reference
The original React prototype is available in the project as `psd-slm-prototype.jsx`. Use it for UI patterns and data model reference but do NOT import from it — we're rebuilding with proper architecture.
