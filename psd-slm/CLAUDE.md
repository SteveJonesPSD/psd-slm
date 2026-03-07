# Innov8iv Engage — Sales Lifecycle Management (SLM)

## Project Overview
Innov8iv Engage is a custom SLM platform built with Next.js + TypeScript + Supabase for managing the full commercial lifecycle: opportunities → quotes → deal registrations → sales orders → purchase orders → invoicing → commission. Built for PSD Group, a small UK IT managed services provider (~500+ customers, 7 staff).

## Tech Stack
- **Frontend:** Next.js with TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, REST API, Row-Level Security) — EU region (eu-west-2 London)
- **Hosting:** Vercel (auto-deploys from GitHub main branch)
- **Repo:** GitHub private repository
- **AI Integration:** Anthropic Claude API (Helen/Jasper/Lucia agents; AutoGRUMP tone analysis via Haiku; inbound PO extraction; AI product creation; AI quote generation from supplier PDFs; AI quote acceptance from customer PO documents)
- **Email Integration:** Microsoft 365 via Graph API (inbound polling, outbound sending, helpdesk ticket creation/threading)

---

## Critical Business Rules

### 1. Deal Registration Pricing
Same product can have different buy prices per customer. When a customer has an active deal registration with a supplier, the buy price on quote lines auto-populates from the deal reg, NOT the product catalogue default. The `deal_reg_line_id` field traces the pricing source through quote → SO → PO.

### 2. Sales Order to Purchase Order Mapping
Customer order POs belong to a specific Sales Order (`purchase_orders.sales_order_id`). Every PO line maps to a specific SO line. Stock is NEVER pooled across customers. Two customers ordering identical products generate separate POs with separate costs.

**Stocking orders** are POs raised without an SO link (`sales_order_id = NULL`, `purchase_type = 'stock_order'`). These replenish general inventory. When stock from a stocking order is needed for a customer, it is manually allocated from the SO detail page.

**Auto-allocation:** When goods are received against an SO-linked PO (any delivery destination), stock is automatically allocated to the SO — serials go straight to `allocated` status, stock allocation records are created, and the SO line moves towards `allocated`. For stock orders (no SO link), serials go to `in_stock` for later manual allocation.

### 3. Per-Line Margin Tracking
Buy and sell prices are recorded at every stage: quote line → SO line → PO line → invoice line. Margin is calculated per line, not just at totals. Commission is calculated from ACTUAL invoiced margin, not quoted margin.

### 4. Sales Attribution
Each quote has attribution entries (must total 100%). Types: direct, involvement, override. These splits carry through to commission calculation when invoices are raised.

### 5. Fulfilment Routes
Each line has a route: `stock` (from PSD inventory), `deliver_to_site` (ordered for customer), `drop_ship` (supplier ships direct). Products have a `default_route` field (`from_stock` or `drop_ship`) — all quote creation paths (manual, AI import, template clone) must respect this default.

### 6. Quote Types
`business`, `education`, `charity`, `public_sector` — affects commission rates.

### 7. Stock Allocation is Always Manual (Except One Case)
Stock must never be auto-allocated to an SO from general inventory — the purchaser decides whether to allocate from stock, raise a PO, or split. The sole exception is SO-linked POs: these auto-allocate on receipt (deliberate design).

---

## Database
Schema deployed to Supabase (EU region). Key tables: `companies`, `contacts`, `products`, `suppliers`, `deal_registrations`, `deal_registration_lines`, `opportunities`, `quotes`, `quote_groups`, `quote_lines`, `quote_attributions`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`, `invoices`, `invoice_lines`, `commission_entries`, `commission_rates`, `activity_log`, `tickets` (includes `auto_nudge_sent_at`), `ticket_emails`, `mail_connections`, `mail_channels`, `customer_email_domains`, `chat_sessions`, `chat_messages`, `system_presence`, `customer_contracts`, `contract_types`, `contract_visit_slots`, `jobs`, `job_tasks`, `api_keys`, `user_mail_credentials`, `quote_email_sends`, `user_working_hours`, `portal_users` (includes `is_group_admin`), `portal_magic_links`, `contract_esign_requests`, `contract_renewal_flags`, `user_passkeys`, `passkey_challenges`, `company_groups`, `company_group_members`.

Key views: `v_margin_traceability`, `v_commission_summary`, `v_active_deal_pricing`, `v_ticket_summary`.

### Contract Data Model (Unified)
`customer_contracts` is the **single source of truth** for all contracts — both service desk (SLA/support hours) and visit scheduling. The old `support_contracts` table is deprecated and no longer queried.

- `customer_contracts` — one contract per customer engagement. Key columns: `contract_type_id` (FK → `contract_types`), `sla_plan_id` (FK → `sla_plans`, nullable), `monthly_hours` (support hours allowance, nullable), `calendar_id` (FK → `visit_calendars`, nullable), `status` ('draft'/'active'/'expired'/'cancelled').
- `contract_types` — defines what a contract includes: `name`, `includes_remote_support` (bool), `includes_telephone` (bool), `includes_onsite` (bool), `allowed_schedule_weeks` (int array), `default_sla_plan_id` (FK → `sla_plans`, nullable), `default_monthly_hours` (numeric, nullable). ProFlex 1–4 are the standard types. SLA inheritance: contract direct `sla_plan_id` → type `default_sla_plan_id` → org default SLA plan → null.
- `tickets.customer_contract_id` — FK linking a ticket to its customer contract (for SLA resolution and entitlement badges). The old `tickets.contract_id` (→ `support_contracts`) is deprecated.
- Entitlement badges on ticket detail derive from `contract_types.includes_remote_support/telephone/onsite` — not from an enum.

---

## Authentication & Security

### Authentication
Supabase Auth with email/password + TOTP MFA + WebAuthn passkeys. Row-level security scoped to organisation. Six roles with ~50 granular permissions:
- **super_admin** — full platform access including system settings
- **admin** — full operational access
- **sales** — own pipeline + shared company/contact data
- **tech** — read-only commercial, full scheduling
- **finance** — invoicing + commission
- **field** — scheduling/jobs only (mobile-optimised)

MFA is enforced for admin and finance roles. All auth logic isolated in `lib/auth/` — components call `getCurrentUser()`, `signIn()`, `signOut()`. Never call `supabase.auth.getUser()` directly in components or pages.

### Login Methods (per-role, configurable)
Five methods available in `org_settings` (category `login_methods`, key = role name):
- `password` — email + password (default)
- `magic_link` — passwordless email link
- `password_mfa` — password + TOTP authenticator app
- `passkey` — passwordless biometric only (Face ID / Touch ID / Windows Hello)
- `password_passkey` — password + biometric as 2FA (TOTP fallback if enrolled)

Login method resolution: `lib/login-methods.ts` → `getLoginMethodForEmail()`.

### WebAuthn / Passkey Authentication
Passkeys provide biometric authentication via the Web Authentication API (FIDO2). Uses `@simplewebauthn/server` (server) and `@simplewebauthn/browser` (client).

- **Core library:** `lib/passkeys.ts` — all `@simplewebauthn/server` imports confined here. Handles registration options/verification, authentication options/verification, CRUD, challenge management.
- **Tables:** `user_passkeys` (credential storage — credential_id, public_key, counter, device_name, transports), `passkey_challenges` (ephemeral 5-min TTL challenges consumed on verification).
- **API routes:** All under `/api/passkeys/`:
  - `POST /register/options` — generate registration challenge (authenticated)
  - `POST /register/verify` — verify and store passkey (authenticated)
  - `POST /authenticate/options` — generate auth challenge (public, login flow)
  - `POST /authenticate/verify` — verify passkey and create session (public)
  - `GET /status` — passkey count for sidebar nudge (authenticated)
- **Session bridging:** Supabase doesn't support WebAuthn natively. After passkey verification, `admin.generateLink({ type: 'magiclink' })` creates a token server-side (no email sent), client calls `supabase.auth.verifyOtp()` to establish the session.
- **Platform authenticators only:** `authenticatorAttachment: 'platform'` — limits to Face ID / Touch ID / Windows Hello (no security keys).
- **Proxy enforcement:** `password_passkey` roles without enrolled passkeys are redirected to `/profile/security` until they register a passkey. Passkey auth routes (`/api/passkeys/authenticate/`) are in `PUBLIC_ROUTES`.
- **Security settings:** `/profile/security` — accessible to ALL authenticated users (not behind admin guard). Manages passkeys, MFA, trusted devices, and password. Linked from profile page.
- **Admin escape hatches:** Clear individual user passkeys (Team page), bulk reset all org passkeys (Login Methods settings, super_admin only).
- **Sidebar nudge:** `PasskeyNudge` component in sidebar footer — shows "Set up biometric login" link when user has no passkeys and their role requires them. Dismissable via localStorage.
- **Environment variables:** `WEBAUTHN_RP_ID` (e.g. `localhost`), `WEBAUTHN_RP_NAME` (e.g. `Innov8iv Engage`), `WEBAUTHN_ORIGIN` (e.g. `http://localhost:3000`).

### API Route Security
Every `/api/` route MUST verify session and org_id before executing. Missing auth checks are the most likely real-world breach vector. All routes use the auth middleware guard. `org_id` is always sourced from the verified session — never from request body or query params.

---

## Security & GDPR Architecture

> **IMPORTANT:** These rules govern ALL new code touching personal data. Encryption is implemented at the DAL layer — components and API routes are unaffected and receive/send plaintext. Never bypass the DAL for PII fields.

### Encryption Utilities
Two files in `lib/` handle all cryptographic operations:

**`lib/crypto.ts`** — field encryption:
```typescript
encrypt(plaintext: string): string      // AES-256-GCM → base64 iv:tag:ciphertext
decrypt(ciphertext: string): string     // reverse of above
blindIndex(value: string): string       // HMAC-SHA256 of normalised value
```
Key sourced from `FIELD_ENCRYPTION_KEY` env var (32-byte hex). Never hardcoded. Uses Node.js `crypto` module — server-side only.

**`lib/pii-scrubber.ts`** — strips PII from text before search indexing:
```typescript
sanitiseForSearch(content: string): string
```
Strips: email addresses, UK phone numbers, UK postcodes, IP addresses, password patterns, card number patterns. Used for helpdesk ticket search token generation only. Does NOT alter stored content.

### Encrypted Fields — What and How

| Table | Encrypted Fields | Companion Plaintext Columns |
|---|---|---|
| `contacts` | `email`, `phone`, `mobile` | `email_blind` (HMAC, indexed), `email_domain` (domain part, indexed) |
| `companies` | `email`, `phone`, `address_line1`, `address_line2`, `postcode` | `email_blind` (HMAC, indexed), `postcode_area` (e.g. `OL16`, indexed) |
| `users` | `email` | `email_blind` (HMAC, indexed) |
| `tickets` | `thread_encrypted` (full JSON thread blob) | `search_tokens` (tsvector of sanitised content, GIN indexed) |
| `tickets` | `sender_email` | `sender_email_blind` (HMAC, indexed) |

**Fields that stay plaintext (with rationale):**
- `contacts.first_name`, `contacts.last_name` — B2B context, publicly visible on LinkedIn, essential for name search. Document in Article 30.
- `contacts.job_title` — not sensitive, useful for filtering
- `companies.name` — primary search field, not PII
- `companies.city` — not personally identifiable standalone
- `companies.vat_number` — public business identifier
- IP addresses — **never stored**. Use transiently for abuse detection only, then discard.

### DAL Encryption Pattern
Every DAL function that reads/writes an encrypted field handles crypto transparently:

```typescript
// Writing — encrypt before insert/update
await supabase.from('contacts').insert({
  ...data,
  email: encrypt(data.email),
  email_blind: blindIndex(data.email.toLowerCase()),
  email_domain: data.email.split('@')[1]?.toLowerCase() ?? null,
  phone: data.phone ? encrypt(data.phone) : null,
})

// Reading — decrypt after fetch
return { ...row, email: decrypt(row.email), phone: row.phone ? decrypt(row.phone) : null }
```

Callers of DAL functions always receive decrypted plaintext. The crypto layer is invisible above the DAL.

### Search with Encrypted Fields
Because encrypted fields cannot be queried directly, search uses:

- **Exact email lookup:** `WHERE email_blind = blindIndex(searchEmail.toLowerCase())` — fast, indexed
- **Domain search:** `WHERE email_domain = 'psdgroup.co.uk'` — plaintext, fast
- **Name search:** Standard `ILIKE` on plaintext `first_name`/`last_name`/`name` columns — unchanged
- **Postcode area:** `WHERE postcode_area = 'OL16'` — plaintext, fast
- **Ticket full-text:** `WHERE search_tokens @@ plainto_tsquery('english', $query)` via GIN index

Do NOT attempt `WHERE email = encrypt(x)` — each encryption produces a different IV, so ciphertext is never equal. Always use blind indexes for equality lookups.

### Search Abstraction Layer
All search operations go through `lib/search/index.ts`. This abstracts the implementation (currently PostgreSQL FTS) so it can be swapped to Typesense or similar without touching callers:

```typescript
searchTickets(query: string, orgId: string): Promise<SearchResult[]>
searchContacts(query: string, orgId: string): Promise<SearchResult[]>
searchCompanies(query: string, orgId: string): Promise<SearchResult[]>
searchByEmail(email: string, orgId: string): Promise<SearchResult[]>
```

Agent tool calls (Helen, Jasper, Lucia) MUST use `lib/search/` functions, not raw Supabase queries directly.

### Helpdesk Ticket Encryption
Ticket thread content is stored as an AES-256-GCM encrypted JSON blob in `thread_encrypted`. The full conversation (all messages, directions, timestamps) is in this blob.

Write pipeline (inbound email or agent reply):
1. Parse content (plaintext available server-side)
2. Fire AutoGRUMP **before** encryption (receives plaintext — no change to AutoGRUMP)
3. Run `sanitiseForSearch(content)` → generate `search_tokens` tsvector
4. `encrypt(JSON.stringify(thread))` → store in `thread_encrypted`
5. Write to DB with both columns

Read pipeline:
- Ticket list views: metadata + decrypted `subject` only — thread not decrypted
- Ticket detail: `decrypt(thread_encrypted)` → parse JSON → return messages
- Search results: metadata only, no thread content in results

### New Module Rules (Privacy by Design)
Before building any new module that handles personal data:
1. Identify which fields are PII (names, emails, phones, addresses, IPs, any data that identifies a person)
2. Add encrypt/blind-index pattern to the DAL from day one — not as a retrofit
3. Update the encryption field map above
4. Document the new data type in the Article 30 record

### Environment Variables Required
```
FIELD_ENCRYPTION_KEY    # 32-byte hex — AES-256-GCM key. Generate: openssl rand -hex 32
BLIND_INDEX_PEPPER      # 32-byte hex — HMAC pepper. Generate: openssl rand -hex 32 (different from above)
```
Both live in Vercel encrypted vault (production) and `.env.local` (dev). Never committed to Git.

### Key Rotation
If either key must be rotated: run `scripts/rotate-keys.ts` (dry-run first), which decrypts all fields with the old key and re-encrypts with the new. Triggers: staff with env access leaving, suspected exposure, annual review. Document rotation in ops runbook.

### GDPR Obligations (Summary)
- Supabase DPA signed (Art. 28) ✓
- Vercel DPA signed (Art. 28) ✓
- Anthropic API DPA reviewed (Art. 28) — verify international transfer SCCs
- Article 30 Record of Processing maintained and updated per module
- Right to erasure: `anonymiseContact(id)` / `anonymiseCompany(id)` DAL functions replace PII with `[DELETED]` — never delete rows (preserves SO/invoice referential integrity)
- Data retention: 7 years for financial records (tax), 2 years for inactive prospect contacts
- Breach notification procedure documented in ops runbook (72-hour ICO notification window)

---

## Portability & Vendor Independence
The platform MUST remain portable to self-hosted infrastructure. Every architectural decision should assume we may move to self-hosted PostgreSQL + standalone Next.js.

### Database Layer
- Write standard PostgreSQL. Do NOT use Supabase-specific SQL extensions, proprietary functions, or platform-only features.
- RLS policies must use standard PostgreSQL syntax. `auth.uid()` and `auth.jwt()` are acceptable (part of GoTrue, available in self-hosted Supabase).
- All schema changes captured in migration files. Migrations must be runnable against any standard PostgreSQL 15+ instance.
- Database views and functions: plain SQL/plpgsql — no Edge Function dependencies.

### Data Access Layer
- All Supabase client calls wrapped in a DAL (e.g. `lib/db/companies.ts`). Components and pages must NOT call the Supabase client directly.
- DAL functions typed with our own interfaces, not Supabase generated types as the primary contract.

### Authentication
- All auth calls go through `lib/auth/`. Components call `getCurrentUser()`, `signIn()`, `signOut()`.
- Session handling uses standard JWT patterns.

### File Storage
- File uploads use Supabase Storage via abstraction: `uploadFile(bucket, path, file)`, `getFileUrl(bucket, path)` — swappable to S3/MinIO/local.

### Hosting & Deployment
- No Vercel-specific features: no `@vercel/` packages, no Vercel KV/Blob/Cron.
- Next.js must build and run with `next build && next start`. Test periodically.
- Environment variables follow standard `.env.local` patterns.

---

## Team Members
- Steve Dixon (super_admin) — MD, lead developer
- Mark Reynolds (sales)
- Rachel Booth (sales)
- Jake Parry (sales)
- Lisa Greenwood (admin)
- Dan Whittle (tech)
- Sam Hartley (tech)

---

## UI Conventions
- Tailwind CSS for all styling
- Consistent component patterns: tables with sortable columns, stat cards, modals for forms, badge components for statuses
- Margin colour coding: green ≥30%, amber ≥15%, red <15%
- Currency formatting: GBP with `Intl.NumberFormat("en-GB")`
- Status badges with colour/background pairs
- Clean, professional aesthetic — business tool, not consumer app
- **Colour conventions:** Purple for AI features; amber/red for warning indicators (AutoGRUMP)

### Buttons
All action buttons MUST use the `<Button>` component from `@/components/ui/button`. Never use raw `<button>` with inline Tailwind colour classes.

**Variants** (translucent background + border + glow hover):
- `default` — slate (secondary actions: Cancel, PDF, Duplicate)
- `primary` — blue (primary actions: Save, Create, Submit, Edit, Add)
- `success` — green (positive actions: Activate, Confirm, Accept, Publish)
- `danger` — red (destructive actions: Delete, Cancel Contract, Reject)
- `purple` — purple (AI features: AI Quote, AI Accept)
- `blue` — blue (navigation actions: Create Sales Order, View Sales Order, Resend)
- `ghost` — transparent (minimal actions)

**Sizes:** `sm` (text-xs) for page action bars and inline buttons; `md` (text-sm, default) for standalone form submissions. All buttons on the same page should use the same size — if the top-of-page action buttons use `sm`, bottom-of-page buttons must also use `sm`.

**Links styled as buttons:** For `<Link>` or `<a>` elements that should look like buttons, apply the variant's Tailwind classes inline (border + bg + text + hover glow) since the `<Button>` component renders a `<button>` element.

### Spacing & Vertical Rhythm
Mandatory across the entire platform. When in doubt, use MORE whitespace. Dark cards on dark backgrounds need generous gaps to create visible separation.

**Main content area (dashboard layout):**
- Padding: `py-8 md:py-10 lg:py-12` vertical, `px-6 md:px-10 lg:px-12` horizontal — never reduce

**Page headers (PageHeader component):**
- Bottom margin: `mb-12` (48px)
- Title to subtitle: `mb-1`

**Detail pages:**
- Back link/breadcrumb: `mb-6` below
- Title + action buttons: `mb-10` below
- Stat card grids: `gap-4` between cards, `mb-10` below the row
- Content section cards: `mb-8` below each
- Info card grids (2-col): `gap-6` between columns, `mb-8` below

**List pages:**
- Filter/search bars: `mb-8` below before the table
- Stat card rows: `mb-10` below

**Chat / message layouts:**
- Between messages: `space-y-5`
- Avatar to content: `gap-3`
- Bubble padding: `px-4 py-3` minimum
- First line of text must optically align with avatar vertical centre — `items-start` with `mt-0.5` or `mt-1` on text block

**Section headings within a page:**
- Section titles inside cards: `mb-4` to their content
- Card/panel internal padding: `p-5` or `p-6`, never `p-3`/`p-4` for primary content

**Tables inside cards:**
- Card header: `px-5 py-4` with `border-b`
- Table rows: `py-3 px-4` minimum cell padding

**Forms and modals:**
- Modal content: `p-6`
- Form field groups: `gap-4`
- Form section labels: `mt-6 mb-3`
- Action button row: `mt-6` above, `gap-3` between

**General minimums:**
- Between major page sections: `mb-8` (32px) minimum
- Between stat rows and content: `mb-10` (40px) minimum
- Never use `mb-3`/`mb-4`/`mb-5` as gap between major sections
- Between interactive elements: `gap-3` minimum
- Filter bars with multiple controls: `gap-3` between, `flex-wrap` for responsive
- Empty states inside cards: `py-12`

### Dark Mode
Per-user theme preference in `users.theme_preference` (`'light'`, `'dark'`, `'system'`).
- **ThemeProvider:** `components/theme-provider.tsx` — applies `dark` class to `<html>`, `useTheme()` hook
- **Flash prevention:** Inline `<script>` in root `layout.tsx` reads `localStorage` synchronously before hydration
- **Dark palette:** `bg-slate-900` (page), `bg-slate-800` (cards/panels/sidebar), `border-slate-700`, `text-slate-200` (body), `text-white` (headings)
- **CSS approach:** Bulk coverage via `globals.css` + component-level `dark:` variants

---

## Code Conventions
- TypeScript strict mode
- Supabase client via `@supabase/supabase-js`
- Server components where possible, client components only when interactivity needed
- All database operations through DAL (never direct Supabase calls from components)
- Form validation before submission
- Optimistic UI updates where appropriate
- Activity logging on all create/update/delete operations — must include `user_id`, `org_id`, `action`, `entity_type`, `entity_id`, `timestamp`
- **UUID generation:** Client-side: use `generateUUID()` from `@/lib/utils`. Server-side: `crypto.randomUUID()` directly.
- **LAN dev access:** `next.config.ts` includes `allowedDevOrigins` for `http://10.0.21.104:3000`
- **Polling — NEVER use server actions for recurring calls.** Server actions trigger RSC payload refresh, re-rendering server components and resetting client state. All polling uses `fetch()` to API routes or browser Supabase client.
- **Polling state guards:** All polling hooks compare new data against previous value before `setState`. Use `useRef` with JSON string equality guard. Only call setter when data actually changed.
- **Git:** Use feature branches (`feature/auth`, `feature/products`). Never `git add .` — only stage specific files each session created or modified.
- **End-of-session commit — MANDATORY:** Before ending every session, commit all new and modified files. Stage each file explicitly (no `git add .`). Include the version bump in `lib/version.ts`. Do NOT push — pushes are only done when the user explicitly requests it. Untracked files left behind cause build failures on deploy.
- **Versioning:** See the Versioning section below. Every commit MUST include an appropriate version bump in `lib/version.ts`.

---

## Versioning
Single source of truth: `app/src/lib/version.ts` exports `APP_VERSION` and `BUILD_DATE`.

**Format:** Semantic versioning — `MAJOR.MINOR.PATCH`
- **MAJOR** — breaking changes, major rewrites, or significant platform milestones (e.g. multi-tenancy launch)
- **MINOR** — new features, new modules, significant UI additions (e.g. new portal section, new scheduling view)
- **PATCH** — bug fixes, small tweaks, styling changes, refactors, config updates

**Rules — MANDATORY on every commit:**
1. Before committing, bump the version in `app/src/lib/version.ts`:
   - Update `APP_VERSION` with the new version string
   - Update `BUILD_DATE` to today's date (`YYYY-MM-DD`)
2. Include `lib/version.ts` in every commit's staged files
3. Multiple changes in a single commit? Use the highest-impact bump (feature + bugfix = MINOR)
4. If unsure between MINOR and PATCH, prefer MINOR for anything user-visible

**Where version is displayed:**
- Main login page (bottom, grey text)
- Portal login page (bottom, grey text)
- Organisation settings page (version + build date banner at top of form)

**Current version:** Check `app/src/lib/version.ts`

---

## Module Build Order & Status
1. ~~Companies & Contacts~~ ✅
2. ~~Authentication & Roles~~ ✅ (RLS enforced, RBAC with 6 roles & ~50 permissions, WebAuthn passkeys, 5 login methods)
3. ~~Products, Suppliers & Categories~~ ✅ (multi-supplier, category-level serial defaults, AI-assisted product creation)
4. ~~Deal Registrations~~ ✅
5. ~~Opportunities & Pipeline~~ ✅ (kanban + list, 6-stage, drag-and-drop)
6. ~~Global Settings~~ ✅ (org settings, brands, API key management, email templates, avatar management)
7. ~~Quote Builder~~ ✅ (DR tie-in, PDF, customer portal, attribution, versioning, templates, notifications, e-signatures, attachments, AI quote generation from supplier PDFs, manual + AI-powered acceptance)
7b. ~~Inbound PO Processing~~ ✅ (PDF upload, AI extraction via Claude, quote matching pipeline)
7c. ~~Helpdesk & Ticketing~~ ✅ (ticket queue, SLA, contracts, canned responses, categories, tags, departments, KB, reports, customer portal, mobile views, Helen AI with triage/drafts/diagnostic assist/AI nudge, scratchpad, AutoGRUMP, ticket presence, contract entitlement badges). **UI label: "Service Desk" — internal code/routes/permissions remain `/helpdesk/` and `helpdesk.*`**. Ticket detail shows support entitlement badges (Remote/Telephone/Onsite) from `customer_contracts` → `contract_types.includes_remote_support/telephone/onsite`, or a red "No Contract" badge if none linked. Dynamic contract resolution: if ticket has no `customer_contract_id` but has a `customer_id`, `getTicket()` looks up the active contract at render time. SLA resolution: contract direct `sla_plan_id` → `contract_types.default_sla_plan_id` → org default SLA → null. Queries `customer_contracts` (not the deprecated `support_contracts`).
8. ~~Sales Orders~~ ✅ (SO from accepted quote, line status transitions, receive goods with serial capture, delivery summary). **Service detection:** `isServiceItem()` in `lib/sales-orders.ts` checks `product_type === 'service'` — do NOT use `is_stocked`/`is_serialised` heuristics. All queries feeding SO creation must include `product_type` in the product select.
8b. ~~Onsite Scheduling~~ ✅ (dispatch calendar, field engineer mobile app, job task templates, e-signatures, PDF reports, GPS logging, conflict detection with travel gap checks, Smart Schedule with OSRM travel estimation)
9. ~~Purchase Orders~~ ✅ (PO from SO, draft-first, receiving goods, price variance, PDF, stock-aware quantities, customer PO gate, auto-allocation on receipt, stocking orders)
9b. ~~Stock & Fulfilment~~ ✅ (stock locations/levels, allocations, picking, delivery notes, fulfilment view, serial uniqueness, tablet-optimised picking, PO-linked serial pre-selection, stock unallocation with reason)
10. ~~Invoicing~~ ✅ (full/partial invoicing, stat cards, credit notes, branded PDF, overdue detection, `quantity_invoiced` tracking)
10b. **Commission** ← Next
10c. ~~Contracts~~ ✅ (contract types with support entitlement booleans, customer contracts as unified table for both service desk SLA and visit scheduling, lines, entitlements, renewal chain, settings, seed data, e-sign infrastructure)
10d. ~~Visit Scheduling~~ ✅ (academic year calendars, multi-calendar support, 4-week cycle patterns, extra weeks, ProFlex quick-fill, visit generation, bulk confirm, customer visit history)
11. ~~AI Chat Agents~~ ✅ (Jasper/Helen/Lucia with tool-calling, floating chat panel, dedicated pages, persistent sessions, admin chat archive, markdown with auto-linking)
12. ~~Engineer Stock Collection~~ ✅ (QR magic links, PDF slips, touch-to-confirm mobile UI, GPS capture, partial collection)
13. ~~Email Integration~~ ✅ (Microsoft 365 Graph API, inbound polling, ticket creation/threading, outbound replies, auto-polling, domain matching, processing log)
14. ~~Customer Portal~~ ✅ (magic link auth, dashboard, tickets, contracts, visits, quotes, orders, KB, admin impersonation, portal access management)
15. ~~Company Groups~~ ✅ (parent-child company relationships, group membership UI, group badges on customer list, quote builder group contact picker, portal group dashboard + group ticket view, internal group ticket view, group admin portal flag)

**Upcoming / Planned:**
- Xero integration (outbound invoice push, inbound payment polling — Engage is single source of truth)
- OCR / inbound customer PO processing (Phase 2)
- HaloPSA integration
- Quote Templates module
- Multi-tenancy (org isolation already in schema via `org_id`)
- Encryption (field-level AES-256-GCM via DAL — see Security & GDPR section)

---

## Development Workflow
- **Claude Project chats:** Architecture, planning, prompt generation, code review
- **Claude Code sessions:** Actual building using this CLAUDE.md for persistent context
- Each module: plan in Project chat → generate build prompt (.md file) → build in Claude Code → generate validation prompt → validate → review → commit & deploy
- Build prompts must be framed as **additive updates**, not greenfield builds — greenfield framing causes Claude Code to ask what needs updating rather than acting
- When running parallel Claude Code windows, use separate branches

---

## Polling & Real-Time Patterns
- **System presence:** `use-system-presence.ts` — 15s heartbeat via `fetch()` to `/api/presence`. JSON equality guard prevents re-renders.
- **Notification bell:** Polls `/api/notifications/unread-count` every 30s. Server actions only for user-initiated interactions.
- **Queue presence:** `ticket-queue.tsx` polls `/api/helpdesk/queue-presence` every 30s.
- **Email auto-poll:** `use-email-polling.ts` polls every 60s with concurrency guard. Toggle via `org_settings` key `email_auto_poll_enabled`.
- No WebSockets/Realtime anywhere — pure polling via API routes, portable.

---

## Email Integration (Microsoft Graph)
3-layer: Graph API client → Mail poller/router → Module handlers.

- **Graph client:** `lib/email/graph-client.ts` — per-instance token caching (5min buffer), retry on 403/429/503
- **Helpdesk handler:** `lib/email/handlers/helpdesk.ts` — 4-tier threading: In-Reply-To → References → `[TKT-YYYY-NNNN]` in subject → Graph conversationId
- **Outbound:** `addMessage()` fire-and-forgets `sendEmailReplyIfNeeded()`. Non-internal replies on `source='email'` tickets only. Uses admin Supabase client (not internal HTTP fetch).
- **Acknowledgements:** New tickets from email get auto-ack with ticket number in subject
- **Self-send protection:** `pollChannel()` skips messages where sender = channel mailbox address
- **Domain matching:** Inbound emails matched via `customer_email_domains` table. Unmatched domains are rejected and logged.

---

## AI Chat Agents (Jasper, Helen, Lucia)
- **API routes:** `/api/agents/{helen,jasper,lucia}/route.ts` — own system prompt, tool definitions, multi-turn tool-calling loops (max 10 iterations)
- **Floating panel:** `components/chat-panel.tsx` — auto-selects agent by page context
- **Search tools:** Agent tool calls MUST use `lib/search/` abstraction functions — never raw Supabase queries. This ensures encryption is transparent to agents.
- **Chat persistence:** `chat_sessions` + `chat_messages` tables, RLS scoped to user's own non-archived sessions

### Agent Prompt Rules
- Every record reference MUST be a markdown link with UUID (e.g. `[Q-2026-0019](/quotes/{uuid})`)
- Tables MUST have maximum 3 columns
- No Margin column in tables — mention in summary text
- Lists use `list-inside` positioning
- Tone context (AutoGRUMP score) injected into Helen assist calls

---

## AutoGRUMP™ (Tone Monitoring)
- **Trigger:** Every inbound customer message — fire-and-forget, before encryption write
- **Analysis:** `lib/helpdesk/tone-analysis.ts` → Claude Haiku → frustration score 1–5 + trend + summary
- **Scores:** 1=happy, 2=neutral, 3=mildly frustrated, 4=frustrated, 5=angry
- **UI:** Amber badge at score 3, red at 4–5, pulsing at 5. `AutogrumpBadge` + `AutogrumpBanner` components.
- **Toggle:** `org_settings` category `helen`, key `autogrump_enabled`

---

## AI Nudge (Follow-Up Prompts)
Generates context-aware follow-up messages for tickets awaiting customer response, encouraging a reply or ticket closure.

### Manual Nudge
- **UI:** Fuchsia "AI Nudge" button in reply box (desktop + mobile), alongside AI Suggest (purple) and Canned Response (grey)
- **API:** `POST /api/helpdesk/nudge` — Claude Haiku generates nudge using Helen persona + general guardrails + nudge-specific guardrails
- **Output:** Populates reply box for agent review before sending. Agent can edit freely.
- **Close link:** Appended automatically — `{siteUrl}/t/{portal_token}/close` with suggestion text

### Auto-Nudge
- **Trigger:** 50% of auto-close period elapsed, measured in **calendar time** (not business hours) — fires even over weekends
- **Processing:** Runs inside `processAutoClose()` in `lib/helpdesk/auto-close.ts`. Checks `tickets.auto_nudge_sent_at` — only one nudge per waiting period.
- **Generation:** Claude Haiku with Helen persona + general guardrails + nudge guardrails. Falls back to configurable template if AI fails.
- **Delivery:** Sent as customer-facing message from "Helen (AI Assistant)". For email-origin tickets, also sends via Graph API with styled HTML close/reply buttons.
- **Close link:** Every nudge (auto and manual) includes a link to `/t/{portal_token}/close` where the customer can close the ticket themselves.
- **Email format:** HTML email with green "Close Ticket" button and indigo "View & Reply" button.
- **Reset:** `auto_nudge_sent_at` resets whenever `waiting_since` resets (customer reply, status change, new agent reply).
- **Exclusions:** `hold_open` tickets excluded. Requires auto-close to be enabled.

### Customer Self-Close
- **Page:** `/t/[token]/close` — public, unauthenticated. Confirmation screen with "Yes, Close My Ticket" / "No, I Still Need Help" buttons.
- **API:** `POST /api/tickets/portal-close` — public route (in `proxy.ts` PUBLIC_ROUTES). Accepts portal token, closes ticket, adds customer message.

### Settings
- **Toggle:** `org_settings` category `helen`, key `helen_nudge_enabled`
- **Guardrails:** `helen_nudge_guardrails` — nudge-specific rules injected into AI prompt alongside general Helen guardrails. Always visible in settings (applies to both manual and auto nudge).
- **Fallback template:** `helen_nudge_template` — used if AI generation fails. Supports `{ticket_number}`, `{subject}`, `{customer_name}`, `{contact_name}` placeholders.
- **Settings UI:** Fuchsia-themed "Auto-Nudge" card on Helen AI settings page (`/helpdesk/helen`)

### Reply Box Button Colours
- **Reply** — indigo (active state)
- **Internal Note** — amber/yellow (always tinted, darker when active)
- **AI Suggest** — purple
- **AI Nudge** — fuchsia
- **Canned Response** — grey

### Migration
- `20260403000006_auto_nudge.sql` — adds `auto_nudge_sent_at TIMESTAMPTZ` to `tickets`

---

## Scheduling Module
- **Job number format:** `JOB-{YEAR}-{NNNN}`
- **RLS:** Uses `auth_org_id()` and `auth_has_permission()` helpers — NOT raw `user_roles` joins. `auth_has_permission()` takes TWO arguments: `auth_has_permission('scheduling', 'admin')` — NOT dot-notation.
- **SO → Job integration:** `requires_install` flag on SO; red icon if no linked job, green if linked
- **Task response types:** `yes_no`, `text`, `date` — materialised from templates on job creation
- **Conflict detection:** `POST /api/scheduling/check-conflicts` checks `jobs`, `activities`, AND `user_working_hours` for time overlaps, insufficient travel gaps (gap < `travel_buffer_minutes`), non-working days (hard block), and outside individual working hours (overridable). Conflict types: `time_overlap`, `no_travel_gap`, `annual_leave` (hard block), `training`, `other_non_job`. Annual leave + non-working days = hard block, no override. Job form fires conflict check with 500ms debounce when engineer + date + time are set.
- **Smart Schedule:** `POST /api/scheduling/smart-schedule` computes suggested start times factoring in travel duration (OSRM) + buffer + individual working hours. Uses each engineer's individual end time (not just org default). Returns `hard_block` for non-working days. Skips non-working engineers in team suggestions. Modal UI with purple branding. Travel estimation: `lib/scheduling/travel.ts` uses Nominatim geocoding (postcode-first strategy for UK) + OSRM driving time — keyless, portable, self-hostable.
- **Working hours (org-level):** `org_settings` keys `working_day_start`, `working_day_end`, `travel_buffer_minutes` (category: `scheduling`). Config UI at `/scheduling/config/working-hours`. `org_settings` unique constraint is `(org_id, setting_key)` — category is NOT part of the unique constraint.
- **Working hours (individual):** `user_working_hours` table stores per-user, per-day overrides (day_of_week 1–7 ISO, is_working_day, start_time, end_time). If no row exists for a user+day, org defaults apply. Config UI at `/scheduling/config/individual-hours` (admin only). Calendar display: non-working days show hatched grey overlay (no override, drag disabled); reduced hours show amber hatched blocks before/after custom times (overridable).
- **Conflict panel layout:** Sticky right sidebar (w-80) on the job form, hidden on mobile (`hidden lg:block`). Form expands from `max-w-3xl` to `max-w-5xl` when conflicts present.

---

## Visit Scheduling Module
- **Multi-calendar:** Multiple calendars can be active simultaneously (e.g. 36-week and 39-week). `activateCalendar()` does NOT auto-archive others.
- **Calendar assignment:** Each `customer_contract` has a `calendar_id` FK to `visit_calendars`. Visit generation filters slots to contracts assigned to the selected calendar.
- **Week types:** Normal weeks participate in the 4-week cycle. Holiday weeks (`is_holiday`) are skipped entirely. Extra weeks (`is_extra`) are scheduled but don't participate in cycle rotation — visits generated for ALL slots regardless of cycle_week_numbers.
- **Extra weeks:** Used in 39-week calendars for the 3 additional weeks beyond the standard 36. Since 39-week customers are always ProFlex 4 (daily), all slots apply.
- **Allowed schedule weeks:** `contract_types.allowed_schedule_weeks INTEGER[]` controls which calendar lengths a type supports. ProFlex 1–3 = `{36}`, ProFlex 4 = `{36,39}`. Contract form bidirectionally filters: selecting a calendar filters contract types, selecting a type filters calendars.
- **Visits per year calculation:** Uses `calendar_schedule_weeks` (from assigned calendar) instead of hardcoded 36. Falls back to 36 if no calendar assigned.
- **View:** `v_contract_visit_slots` includes `calendar_id` from the parent contract.

---

## Invoicing Module
- **Invoice number format:** `{brand.invoice_prefix}-{YYYY}-{NNNN}` (e.g. `INV-2026-0001`)
- **Credit note numbers:** `{parent_invoice_number}-CN{N}`

---

## E-Sign & Renewal Module
Contract e-signing engine — type-agnostic, works for any contract type (ICT visits, licensing, maintenance, etc.).

- **Migration:** `20260408000001_esign_module.sql`
- **Tables:** `contract_esign_requests` (token-based signing requests), `contract_renewal_flags` (renewal due/overdue tracking)
- **Token pattern:** `/sign/[token]` — unauthenticated, token IS the auth (same pattern as `/collect/[token]`)
- **Request types:** `new_contract`, `renewal_acceptance`, `schedule_acceptance` — adding a new type means adding a new document template, not restructuring the engine
- **Request statuses:** `pending`, `signed`, `declined`, `expired`
- **Contract statuses (extended to 13):** `draft`, `pending_signature`, `declined_signature`, `awaiting_activation`, `active`, `renewal_flagged`, `renewal_sent`, `renewal_accepted`, `schedule_pending`, `not_renewing`, `expired`, `cancelled`, `renewed`
- **Storage bucket:** `esign-documents` (private, 50MB, PDF/PNG)
- **Types:** `lib/esign/types.ts`
- **Server actions:** `lib/esign/actions.ts` — CRUD for requests + flags, sign/decline/expire, contract status updates (all via admin client)
- **Token utility:** `lib/esign/token.ts` — `buildSigningUrl()`, `isRequestExpired()`, `expireStaleRequests()`
- **Org settings (category: `esign`):** `default_renewal_notice_days` (60), `esign_from_name` ("Contracts Team"), `esign_expiry_days` (30)
- **Contract fields added:** `account_manager_id`, `renewal_notice_days` (per-contract override), `esign_required`
- **Contract types field added:** `requires_visit_slots` (gates "Send for Signing" on visit-based types)
- **Extensibility:** `request_type` is a CHECK constraint today — adding a new type means: add to CHECK, add document template, add post-sign handler case

---

## Company Groups Module
Parent–child company relationships. Domain-agnostic — supports MATs, franchise groups, NHS trusts, or any business group structure.

- **Migration:** `20260410000001_company_groups.sql`
- **Tables:** `company_groups` (parent company + group metadata), `company_group_members` (member companies with colour + display_order)
- **Types:** `types/company-groups.ts` — `CompanyGroup`, `CompanyGroupMember`, `GroupType` (`group`/`mat`/`franchise`/`nhs_trust`), `BillingModel` (`individual`/`centralised`), `GROUP_TYPE_LABELS`, `GROUP_MEMBER_COLOURS` (10-colour palette)
- **Server actions:** `lib/company-groups/actions.ts` — full CRUD: `getCompanyGroups`, `getCompanyGroup`, `getGroupForCompany` (returns `asParent` + `asMembers`), `createCompanyGroup`, `updateCompanyGroup`, `addGroupMember` (auto-colour), `removeGroupMember`, `updateMemberColour`, `updateMemberOrder`
- **Permission:** `companies.manage_groups` — granted to admin, super_admin, sales
- **Constraints:** One group per parent company (`UNIQUE(org_id, parent_company_id)`). A company CAN be a member of multiple groups. A company CAN be both parent and member.

### Back-Office UI
- **Customer detail:** `GroupMembershipSection` — parent view (member table with colour swatches, add/remove/edit), member view (group name + parent link), no-group view (create/add-to-existing buttons), "Group Tickets" button links to `/helpdesk/groups/[groupId]`
- **Customer list:** Purple "Group: X" badge on parent rows, grey "↳ X" badge on member rows
- **Quote builder:** Contact picker surfaces parent company contacts (with `[Group Name]` suffix) when selected customer is a group member
- **Internal group tickets:** `/helpdesk/groups/[groupId]` — cross-member ticket list with colour dots, toggle pills per member, clickable rows → ticket detail

### Portal
- **Group admin flag:** `portal_users.is_group_admin` — set by internal staff via `toggleGroupAdmin()` in `lib/portal/admin-actions.ts`
- **Session:** `PortalContext.isGroupAdmin` — included in portal session resolution
- **Navigation:** "Group" nav item visible only to group admins
- **Group dashboard:** `/portal/group` — member cards with colour bars + stat summary (open tickets, contracts, quotes)
- **Group tickets:** `/portal/group/tickets` — cross-member ticket list with colour dots, toggle pills, search + status filter
- **Portal actions:** `lib/portal/group-actions.ts` — `getPortalGroup`, `getPortalMemberStats`, `getPortalGroupTickets`

### Deferred (Phase 2)
- Portal impersonation (view-as-member) read-only mode
- Centralised billing model behaviour
- Group-level deal registrations / quotes
- Portal job/visit grid colour coding

---

## Avatar Patterns
Every avatar renders inside a coloured circle. `<img>` with `object-cover` when URL present, `onError` fallback to initials. Consistent across `Avatar`, `AgentAvatar`, `UserAvatar`, `SidebarAgentAvatar`, `ViewerAvatar`.

---

## API Development Rules
When building external-facing APIs (Xero, HaloPSA, third-party):
- Use `api_keys` table with hash storage (HMAC of key — never store plaintext). Keys shown once on creation only.
- Enforce scopes at middleware level: `requireApiKey(['companies:read'])`
- `org_id` ALWAYS sourced from the verified API key — never from request body. Callers cannot override which org they access.
- Version all external routes from day one: `/api/v1/...`
- Log all API calls to `activity_log` with `api_key_id` as actor
- Build explicit response serialisers — never pass raw DB objects to external consumers
- Rate limit all external endpoints

---

## Quote Email Sending
Outbound quote emails sent from individual salespeople's M365 mailboxes via per-user delegated OAuth2.

- **Migration:** `20260401000001_user_mail_credentials.sql` — `user_mail_credentials` (per-user OAuth tokens), `quote_email_sends` (send tracking)
- **`UserGraphClient`** (`lib/email/user-graph-client.ts`) — delegated OAuth via `/me/sendMail` (vs `GraphClient` which uses application-level client credentials). `saveToSentItems: true` is mandatory — emails appear in sender's Sent Items.
- **OAuth flow:** `GET /api/auth/mail-connect` → Microsoft consent → `GET /api/auth/mail-callback` → stores tokens in `user_mail_credentials`
- **Azure AD:** App Registration needs delegated `Mail.Send`, `User.Read`, `offline_access`. Redirect URI: `{SITE_URL}/api/auth/mail-callback`
- **Send action:** `sendQuoteEmail()` in `quotes/send-actions.ts` — generates PDF, builds HTML email, sends via `UserGraphClient`, records in `quote_email_sends`, updates status to `sent`. `X-Engage-Quote-ID`/`X-Engage-Quote-Number` headers stored for future NDR matching.
- **Send modal:** `quotes/[id]/send-quote-modal.tsx` — 2-step (choose method → compose). Supports PDF, portal link, or both. Fallback sender if assigned user has no connected mailbox. Zero-sell-price warning: if any non-optional lines have £0 sell price, an amber banner lists them and requires checkbox confirmation before sending.
- **Portal PDF download:** PDF route supports `?token=` query param for unauthenticated access. `PortalPdfButton` on portal page.
- **Team page:** "Email Sending" column + Connect/Disconnect mailbox buttons (admin only)

---

## Customer Portal
Self-service portal for customer contacts. Accessible at `/portal/`. Uses its own auth system (magic link emails), not Supabase Auth.

### Auth
- **Tables:** `portal_users` (linked to `contacts` via `contact_id`, scoped by `org_id`), `portal_magic_links` (token-based, 15-min expiry)
- **Flow:** Email → `/api/portal/auth/request` generates magic link → `/portal/auth/[token]` validates and creates session cookie (`portal_session`)
- **Session:** `lib/portal/session.ts` reads/writes the `portal_session` cookie containing `{ portalUserId, contactId, customerId, orgId }`
- **Layout:** `/portal/layout.tsx` checks session for all non-public paths. Public paths: `/portal/login`, `/portal/auth/`
- **Proxy:** `proxy.ts` sets `x-pathname` header so server components can read the current path
- **Org resolution:** Single-tenant — queries `organisations` table directly (no `NEXT_PUBLIC_ORG_ID` env var)
- **Contacts scoping:** `contacts` table has NO `org_id` column — scope through `customers!inner(org_id)` join

### Portal Modules
- **Dashboard** (`/portal/dashboard`) — stat cards (open tickets, pending quotes, upcoming visits, active contracts) + activity feed
- **Tickets/Helpdesk** (`/portal/helpdesk`) — view/create tickets, SLA resolution via `customer_contracts`
- **Contracts** (`/portal/contracts`) — list/detail view of `customer_contracts` with visit slot schedules
- **Visits** (`/portal/visits`) — week grid view (Mon–Fri columns, nav arrows, today highlight) of `visit_instances` via `customer_contracts`. Status-coloured cards (amber=scheduled, green=confirmed, blue=completed). Upcoming weeks summary below grid. Dashboard visit blocks match same colour scheme.
- **Quotes** (`/portal/quotes`) — view sent quotes, accept/decline
- **Orders** (`/portal/orders`) — view sales orders
- **Knowledge Base** (`/portal/knowledge-base`) — public KB articles

### Admin Side
- **Portal access:** Granted/revoked from customer detail page (`customers/[id]/portal-access-section.tsx`)
- **Permission:** Uses `customers.edit_all` (not `customers.edit`)
- **Impersonation:** Purple "Impersonate" button on each active portal user in customer detail page. POSTs to `/api/portal/impersonate` (creates 1-hour impersonation session), then opens `/api/portal/impersonate/start?token=...` in new tab (sets `portal_sid` cookie and redirects to `/portal/dashboard`). Admin-only.
- **Server actions:** `lib/portal/admin-actions.ts` (grant, revoke, resend magic link)

### Data Access
All portal data fetched via `createAdminClient()` (service role) since portal users don't have Supabase Auth sessions. All queries scoped by `ctx.customerId` + `ctx.orgId` from the portal session. Action files in `lib/portal/`: `dashboard-actions.ts`, `helpdesk-actions.ts`, `contracts-actions.ts`, `visits-actions.ts`, `quotes-actions.ts`, `orders-actions.ts`, `kb-actions.ts`, `contacts-actions.ts`.

---

## Reference
The original React prototype is available as `psd-slm-prototype.jsx`. Use for UI patterns and data model reference only — do NOT import from it.
