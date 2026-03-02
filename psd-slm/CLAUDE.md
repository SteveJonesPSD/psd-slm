# Innov8iv Engage — Sales Lifecycle Management (SLM)

## Project Overview
Innov8iv Engage is a custom SLM platform built with Next.js + TypeScript + Supabase for managing the full commercial lifecycle: opportunities → quotes → deal registrations → sales orders → purchase orders → invoicing → commission. Built for PSD Group, a small UK IT managed services provider (~100 customers, 7 staff).

## Tech Stack
- **Frontend:** Next.js with TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, REST API, Row-Level Security)
- **Hosting:** Vercel (auto-deploys from GitHub main branch)
- **Repo:** GitHub private repository
- **AI Integration:** Anthropic Claude API (planned — embedded chat assistant)

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
Each line has a fulfilment route (simplified from the original 3-option model):
- **Ship from Stock** — PSD delivers from own inventory
- **Ship from Supplier** — supplier ships direct (covers both deliver-to-site and drop-ship scenarios)

### 6. Quote Types
`business`, `education`, `charity`, `public_sector` — affects commission rates.

### 7. Multi-Brand Support
The platform supports multiple brands under one organisation. Each brand has its own name, logo, quote prefix, and contact details. Examples:
- **PSD Group** — quotes prefixed `Q-2026-XXXX`
- **EnviroSentry** — quotes prefixed `ES-2026-XXXX`
- **SchoolCare** — quotes prefixed `SC-2026-XXXX`
Quote numbering sequence is org-wide to avoid collisions across brands.

### 8. Serial Number Tracking
Serial number requirements are set at the **category level** as a default, with **product-level overrides**. Not all items require serial tracking (e.g. software licenses don't).

## Database
Schema is deployed to Supabase. Key tables: `organisations`, `companies`, `contacts`, `products`, `product_categories`, `suppliers`, `product_suppliers`, `deal_registrations`, `deal_registration_lines`, `opportunities`, `quotes`, `quote_groups`, `quote_lines`, `quote_attributions`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`, `invoices`, `invoice_lines`, `commission_entries`, `commission_rates`, `org_settings`, `brands`, `activity_log`.

Key views: `v_margin_traceability`, `v_commission_summary`, `v_active_deal_pricing`.

## Authentication
Supabase Auth with email/password. Row-level security scoped to organisation. Roles: admin (full access), sales (own pipeline + shared data), tech (read-only commercial), finance (invoicing + commission).

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

## Module Build Order & Status
1. ~~Companies & Contacts~~ ✅ Built
2. ~~Authentication & Roles~~ ✅ Built (RLS enforced, role-based access working)
3. ~~Products, Suppliers & Categories~~ ✅ Built (multi-supplier support, category-level serial defaults)
4. ~~Deal Registrations~~ ✅ Built & validated (minor permission fixes applied)
5. ~~Opportunities & Pipeline~~ ✅ Built & validating (kanban + list views, 6-stage pipeline, drag-and-drop stage changes)
6. ~~Global Settings~~ ✅ Prompted (org settings, brands, API key management, email templates — prerequisite for Quotes)
7. **Quote Builder** ← Next (expanded requirements: DR tie-in, contract tracking flag, PDF generation, customer portal with PO upload + change requests, attribution splits)
8. Sales Orders & Purchase Orders
9. Invoicing & Commission
10. AI Chat Assistant (side quest — Claude API with tool-calling against Engage data + SharePoint documents)

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
- **HaloPSA** — helpdesk/PSA for service delivery (tickets, SLAs, contracts). API integration for customer data sync. Placeholder settings page exists.
- **Claude API** — embedded AI chat assistant for querying Engage data and SharePoint documents. Architecture designed (tool-calling pattern), build prompt ready.
- **Microsoft 365 / SharePoint** — Phase 1b of AI integration, for searching NDPs, price lists, and product specs.
- **EnviroSentry** — PSD's own environmental sensor product (Arduino-based)
- **IngressaEdge** — PSD's BLE access control reader product

## Reference
The original React prototype is available in the project as `psd-slm-prototype.jsx`. Use it for UI patterns and data model reference but do NOT import from it — we're rebuilding with proper architecture.
