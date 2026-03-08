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
Schema deployed to Supabase (EU region). Key tables: `companies`, `contacts`, `products`, `suppliers`, `deal_registrations`, `deal_registration_lines`, `opportunities`, `quotes`, `quote_groups`, `quote_lines`, `quote_attributions`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`, `invoices`, `invoice_lines`, `commission_entries`, `commission_rates`, `activity_log`, `auth_events` (90-day retention, truncated IPs only), `user_sessions` (heartbeat-based idle detection), `tickets` (includes `auto_nudge_sent_at`), `ticket_emails`, `mail_connections`, `mail_channels`, `customer_email_domains`, `chat_sessions`, `chat_messages`, `system_presence`, `customer_contracts`, `contract_types`, `contract_type_pricebook_lines`, `contract_visit_slots`, `contract_invoice_schedule`, `contract_line_supplier_prices`, `jobs` (includes `departed_at`, `return_arrived_at`), `job_tasks`, `job_gps_log`, `api_keys`, `user_mail_credentials`, `quote_email_sends`, `user_working_hours`, `portal_users` (includes `is_group_admin`), `portal_magic_links`, `contract_esign_requests`, `contract_renewal_flags`, `user_passkeys`, `passkey_challenges`, `company_groups`, `company_group_members`, `onsite_job_items`, `onsite_job_categories`, `onsite_job_audit`.

Key views: `v_margin_traceability`, `v_commission_summary`, `v_active_deal_pricing`, `v_ticket_summary`, `v_contract_invoice_schedule`, `v_contract_renewal_pipeline`, `v_pending_invoice_alerts`, `v_expiring_contracts`, `v_contract_line_costs`.

### Contract Data Model (Unified)
`customer_contracts` is the **single source of truth** for all contracts — support (service desk SLA), service (subscriptions), and licensing (licenses/warranties). The old `support_contracts` table is deprecated and no longer queried.

**Three contract categories:**
- `support` — service desk SLA/support hours, visit scheduling (existing behaviour preserved)
- `service` — subscription products, fixed or rolling term, auto-invoice, upgrade with pro-rata credit
- `licensing` — license/warranty products, fixed term, renewal quote workflow

**Key tables:**
- `customer_contracts` — one contract per customer engagement. Key columns: `contract_type_id` (FK → `contract_types`), `sla_plan_id` (FK → `sla_plans`, nullable), `monthly_hours` (nullable), `calendar_id` (FK → `visit_calendars`, nullable), `status` ('draft'/'active'/'expired'/'cancelled'/'pending_signature'/'declined_signature'/'awaiting_activation'/'renewal_flagged'/'renewal_sent'/'renewal_accepted'/'schedule_pending'/'not_renewing'/'renewed'), `source_quote_id` (FK → `quotes`, nullable — links to the quote from which contract was created), `esign_status` ('not_required'/'pending'/'signed'/'waived'), `renewal_status` ('active'/'alert_180'/'alert_90'/'notice_given'/'renewal_in_progress'/'rolling'/'superseded'/'expired'/'cancelled'), `is_rolling` (bool), `rolling_frequency` ('monthly'/'annual'), `term_months` (nullable), `go_live_date`, `invoice_schedule_start`, `auto_invoice` (bool), `invoice_frequency` ('annual'/'monthly'/'quarterly'), `upgrade_go_live_date` (nullable — set when superseded), `superseded_by` (nullable).
- `contract_types` — defines what a contract includes: `name`, `category` ('support'/'service'/'licensing'), `includes_remote_support/telephone/onsite` (bools), `allowed_schedule_weeks` (int array), `default_sla_plan_id`, `default_monthly_hours`, `default_term_months`, `default_notice_alert_days`, `secondary_alert_days`, `auto_invoice` (bool), `invoice_frequency`, `billing_cycle_type` ('fixed_date'/'start_date'/'go_live_date'), `default_billing_month` (nullable, 4=April/9=September). ProFlex 1–4 are the standard support types. COALESCE pattern: contract field → contract_type default.
- `contract_type_pricebook_lines` — soft-default line items per contract type (support category). Columns: `contract_type_id`, `description`, `annual_price`, `buy_price` (nullable), `vat_rate`, `sort_order`, `is_active`. Copied into `contract_lines` on support contract creation — independent from that point. RLS scoped by org via contract_types join.
- `customer_contracts` billing columns: `billing_cycle_type` ('fixed_date'/'start_date'/'go_live_date', nullable — inherited from contract_type), `billing_month` (nullable, for fixed_date), `billing_day` (default 1).
- `contract_invoice_schedule` — invoice schedule rows. Columns: `contract_id`, `scheduled_date`, `period_label`, `period_start`, `period_end`, `base_amount`, `amount_override` (nullable), `invoice_id` (FK → `invoices`, nullable), `status` ('pending'/'draft_created'/'sent'/'skipped'/'cancelled'), `is_prorata` (bool), `prorata_days` (nullable), `prorata_total_days` (nullable). Year 1 invoiced via Sales Order for service/licensing; support contracts generate full schedule including Year 1.
- `contract_line_supplier_prices` — stub table for future supplier price list integration. Populated on contract creation, not yet read from.
- `contract_lines` — extended with `source_quote_line_id`, `source_pricebook_line_id`, `product_type`, `unit_price`, `buy_price`, `line_type` ('recurring'/'one_off'/'usage').
- `contract_renewals` — extended with `renewal_quote_id` (FK → `quotes`), `renewal_workflow_status` ('pending'/'quote_generated'/'quote_sent'/'quote_accepted'/'signed'/'completed').
- `tickets.customer_contract_id` — FK linking a ticket to its customer contract (for SLA resolution and entitlement badges). The old `tickets.contract_id` (→ `support_contracts`) is deprecated.
- Entitlement badges on ticket detail derive from `contract_types.includes_remote_support/telephone/onsite` — not from an enum.

**Product types:** `goods`, `service`, `hardware`, `labour`, `consumable`, `software`, `subscription`, `license`, `warranty`. The last three are "contractable" types — quote lines with these product types can be selected to create contracts.

**Billing cycle types:**
- `fixed_date` — ICT/ProFlex support contracts. Billing anchored to a fixed month (April or September). Year 1 is pro-rata: `(daysRemaining / daysInYear) * annualValue` using calendar days. Year 2+ full annual amounts on the billing month anniversary.
- `start_date` — AC/CCTV support contracts. Billing on the contract start date anniversary. No pro-rata — every year is a full annual period.
- `go_live_date` — service/licensing contracts created from quotes. Year 1 invoiced via Sales Order; Year 2+ schedule generated from go-live anniversary.

**Pricebook lines:** `contract_type_pricebook_lines` stores default line items per support contract type. Managed in contract type settings (General/Pricebook tabs). Lines include annual sell price, buy price, and VAT rate. On support contract creation, selected pricebook lines are copied into `contract_lines` with `source_pricebook_line_id` tracing the origin. Lines are independent after creation — pricebook changes don't retroactively affect existing contracts.

**Support contract creation:** `createSupportContract()` creates a contract + lines from pricebook selection in one operation. Contract form auto-loads pricebook lines when a support type is selected, with checkboxes to include/exclude and auto-calculated annual value. Buy price tracked alongside sell price for margin visibility.

**Invoice schedule engine:** `generateInvoiceSchedule()` creates schedule rows based on billing cycle type. For `fixed_date`: pro-rata Year 1 row + full annual rows from Year 2. For `start_date`: full annual rows from Year 1. For `go_live_date`: Year 2+ rows only (Year 1 via SO). Called automatically on: `createSupportContract()`, `updateContractStatus('active')`, `signContract()`, `waiveEsign()`. `processPendingContractInvoices()` creates draft invoices for rows where `scheduled_date <= today`. Schedule supports amount overrides and skip with reason.

**Support contract invoicing tab:** Contracts list page has an "Invoicing" tab (admin/finance only) for raising annual invoices on support contracts. Shows active support contracts with due status calculated per billing cycle type. Per-row modal allows line price editing before creating draft invoice. Bulk "Create All Due Invoices" button. Prevents duplicate drafts. Server actions: `getSupportContractsForInvoicing()`, `createSupportContractInvoice()`, `bulkCreateSupportInvoices()`.

**Rolling contracts:** Service contracts with `auto_invoice = true` automatically transition to rolling after `end_date` passes. `extendRollingSchedule()` generates 3 years of additional rows. Can be cancelled with a date via `cancelRollingContract()`.

**Contract cancellation cascades:** When a contract is cancelled (`updateContractStatus('cancelled')`) or a rolling contract is stopped (`cancelRollingContract()`), `cancelFutureScheduledWork()` automatically cancels all future visit instances linked to the contract, their linked jobs (via `job_id` bridge), any pending onsite job items on those visits, and any jobs created directly from the contract (`source_type = 'contract'`). Only affects items from the cancellation date onwards; completed/closed items are preserved.

**Visit slot cycle week validation:** When adding visit slots, the number of cycle weeks selected must exactly match the contract type requirement (`maxWeeks` derived from ProFlex level or visit frequency). The Save button is disabled until the required number is met. Different-days mode enforces this structurally (grid always has `maxWeeks` rows). Hint text shows amber "X more needed" feedback.

**Upgrade flow (service):** `upgradeContract()` calculates pro-rata credit from the most recent invoice period, creates a draft credit note, cancels remaining schedule rows, and marks the contract as superseded.

**Licensing renewal flow:** `generateRenewalQuote()` creates a draft quote from contract lines (with attribution copied from source quote). Workflow: quote_generated → quote_sent → quote_accepted → signed → completed. `completeRenewalSigning()` creates the new contract, generates its invoice schedule, and expires the old contract.

**E-sign gate:** When a service/licensing contract has `esign_status = 'pending'`, the "Create Sales Order" button on the linked quote is disabled until the contract is signed or waived. `signContract()` and `waiveEsign()` handle the transitions.

---

## Authentication & Security

### Authentication
Supabase Auth with email/password + TOTP MFA + WebAuthn passkeys. Row-level security scoped to organisation. Six roles with ~50 granular permissions:
- **super_admin** — full platform access including system settings
- **admin** — full operational access
- **sales** — own pipeline + shared company/contact data
- **tech** — read-only commercial, full scheduling
- **finance** — invoicing + commission
- **field_engineer** — scheduling/jobs only (mobile-optimised). On desktop, sees "My Schedule" view (own assigned jobs only, same as mobile) instead of the full dispatch calendar. Contracts and Products are hidden from sidebar and DB permissions removed. Has: `scheduling.view/create/edit`, `customers.view`, `helpdesk.view/create/edit`.

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
- **Session bridging:** Supabase doesn't support WebAuthn natively. After passkey verification, `admin.generateLink({ type: 'magiclink' })` creates a token server-side (no email sent). Client calls `supabase.auth.verifyOtp()` using `email_otp` (preferred, avoids token_hash format issues) or `hashed_token` fallback. The verify route returns `verifyMethod: 'otp' | 'token_hash'` so the client knows which `verifyOtp` overload to use.
- **Platform authenticators only:** `authenticatorAttachment: 'platform'` — limits to Face ID / Touch ID / Windows Hello (no security keys).
- **Proxy enforcement:** `password_passkey` roles without enrolled passkeys are redirected to `/profile/security` until they register a passkey. Passkey auth routes (`/api/passkeys/authenticate/`) are in `PUBLIC_ROUTES`.
- **Security settings:** `/profile/security` — accessible to ALL authenticated users (not behind admin guard). Manages passkeys, MFA, trusted devices, and password. Linked from profile page.
- **Admin escape hatches:** Clear individual user passkeys (Team page), bulk reset all org passkeys (Login Methods settings, super_admin only).
- **Sidebar nudge:** `PasskeyNudge` component in sidebar footer — shows "Set up biometric login" link when user has no passkeys and their role requires them. Dismissable via localStorage.
- **Environment variables:** `WEBAUTHN_RP_ID` (e.g. `localhost`), `WEBAUTHN_RP_NAME` (e.g. `Innov8iv Engage`), `WEBAUTHN_ORIGIN` (e.g. `http://localhost:3000`).

### Accepted Email Domains
`org_settings` key `accepted_email_domains` (category `general`) stores a JSON array of allowed domains (e.g. `["psdgroup.co.uk", "psd.com"]`). Configured in Organisation settings. When set, `inviteUser()` and `updateUser()` in `team/actions.ts` reject emails from unlisted domains. Empty array = no restriction. Login page email input uses a generic placeholder (no domain hint) for security.

### Team Invitations & Welcome Emails
- **Single invite:** `inviteUser()` creates auth account + users row, optionally sends a branded welcome email via Graph API with login credentials and sign-in link.
- **Bulk invite:** `bulkInviteUsers()` accepts up to 50 entries (parsed from `Name, email` / `Name <email>` / bare email formats), creates accounts sequentially, sends welcome emails. Returns per-entry results.
- **Welcome email:** Sent via first active `mail_channel` using application-level `GraphClient`. Fire-and-forget — email failure never blocks account creation.
- **UI:** Team page has "Invite Team Member" (single) and "Bulk Invite" buttons. Both have "Send welcome email" checkbox (on by default).

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

### Audit Logging Architecture

Two-layer audit system:

**`activity_log`** — operational CRUD across all modules. Fire-and-forget via `logActivity()` in `lib/activity-log.ts`. 7-year retention (aligns with financial records). ~47 files use this across all modules.

**`auth_events`** — authentication events only. Fire-and-forget via `logAuthEvent()` in `lib/auth-log.ts`. 90-day rolling retention. Legal basis: legitimate interest (security monitoring). Documented in Article 30. IP addresses stored truncated only (last octet zeroed) — never full IPs.

**`user_sessions`** — session heartbeats for idle detection and engagement reporting. Updated in-place per heartbeat (no new row per ping). Idle periods >15 min written to `activity_log` on return. 30-day retention.

**IP address policy (updated):**
- Operational data: never stored
- Auth events: truncated IP only (`192.168.1.0` — last octet zeroed), 90-day retention, Article 30 documented
- Raw IPs: never persisted anywhere

**Key logging points per module:**
- Quotes: sent, accepted (all 3 methods), rejected, revision created, attribution changed
- Sales Orders: customer PO updated, stock allocated/unallocated (with reason), line status changed, DN created
- Purchase Orders: goods received (full/partial), price variance on receipt, sent to supplier, cancelled
- Invoices: sent, paid, voided (highest accountability), credit note created, Xero push
- Stock: serials registered, dispatched, engineer collection confirmed, pick confirmed
- Helpdesk: viewed (debounced 30 min), first response (with response time in minutes)
- Auth: all login/logout/MFA/passkey/magic link/portal events

**Audit Log UI:** `/settings/audit-log` — admin/super_admin only. Three tabs: Activity (filterable `activity_log` browser), Authentication (`auth_events` with brute-force alerts), Engagement (per-user summary with online status, action counts, idle time).

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
8b. ~~Onsite Scheduling~~ ✅ (dispatch calendar, field engineer mobile app, job task templates, e-signatures, PDF reports, GPS logging, conflict detection with travel gap checks, Smart Schedule with OSRM travel estimation, return travel tracking with full timestamp timeline)
9. ~~Purchase Orders~~ ✅ (PO from SO, draft-first, receiving goods, price variance, PDF, stock-aware quantities, customer PO gate, auto-allocation on receipt, stocking orders)
9b. ~~Stock & Fulfilment~~ ✅ (stock locations/levels, allocations, picking, delivery notes, fulfilment view, serial uniqueness, tablet-optimised picking, PO-linked serial pre-selection, stock unallocation with reason)
10. ~~Invoicing~~ ✅ (full/partial invoicing, stat cards, credit notes, branded PDF, overdue detection, `quantity_invoiced` tracking)
10b. **Commission** ← Next
10c. ~~Contracts~~ ✅ (contract types with 3 categories — support/service/licensing, customer contracts unified table, lines, entitlements, renewal chain, settings, seed data, e-sign infrastructure, invoice schedule engine, contract creation from quote lines, e-sign gate on SO creation, days-remaining dashboard with alerts, upgrade flow with pro-rata credit notes, licensing renewal workflow with quote generation, rolling contract auto-detection and cancellation, supplier price stubs)
10d. ~~Visit Scheduling~~ ✅ (academic year calendars, multi-calendar support, 4-week cycle patterns, extra weeks, ProFlex quick-fill, visit generation, bulk confirm, customer visit history)
11. ~~AI Chat Agents~~ ✅ (Jasper/Helen/Lucia with tool-calling, floating chat panel, dedicated pages, persistent sessions, admin chat archive, markdown with auto-linking)
12. ~~Engineer Stock Collection~~ ✅ (QR magic links, PDF slips, touch-to-confirm mobile UI, GPS capture, partial collection)
13. ~~Email Integration~~ ✅ (Microsoft 365 Graph API, inbound polling, ticket creation/threading, outbound replies, auto-polling, domain matching, processing log)
14. ~~Customer Portal~~ ✅ (magic link auth, dashboard, tickets, contracts, visits, quotes, orders, KB, admin impersonation, portal access management)
15. ~~Company Groups~~ ✅ (parent-child company relationships, group membership UI, group badges on customer list, quote builder group contact picker, portal group dashboard + group ticket view, internal group ticket view, group admin portal flag)
16. ~~Audit Logging~~ ✅ (auth_events table, user_sessions with heartbeat, gap-fill logging across all modules, 3-tab audit UI with activity/auth/engagement views, brute-force alerts, idle detection)
17. ~~Onsite Jobs~~ ✅ (portal + internal OJI creation, ticket push, urgent escalation with auto-ticket, visit auto-linking, engineer notes, sales notification, category management, 4 email notifications, customer/job detail badges)

**Upcoming / Planned:**
- Xero integration (outbound invoice push, inbound payment polling — Engage is single source of truth)
- OCR / inbound customer PO processing (Phase 2)
- HaloPSA integration
- Quote Templates module
- Multi-tenancy (org isolation already in schema via `org_id`)

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
- **Session heartbeat:** `use-session-heartbeat.ts` — 5-min interval via `fetch()` to `/api/session/heartbeat`. Tracks activity via passive event listeners (mousemove/keydown/click/touchstart). No state — uses `useRef` only. Mounted via `<SessionHeartbeat />` in dashboard layout.
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
- **Job statuses (8):** `unscheduled`, `scheduled`, `travelling`, `on_site`, `completed`, `return_travelling`, `closed`, `cancelled`. Flow: scheduled → travelling → on_site → completed → return_travelling → closed.
- **RLS:** Uses `auth_org_id()` and `auth_has_permission()` helpers — NOT raw `user_roles` joins. `auth_has_permission()` takes TWO arguments: `auth_has_permission('scheduling', 'admin')` — NOT dot-notation.
- **SO → Job integration:** `requires_install` flag on SO; red icon if no linked job, green if linked
- **Task response types:** `yes_no`, `text`, `date` — materialised from templates on job creation. All three types editable on field job detail page (not just at completion).
- **Conflict detection:** `POST /api/scheduling/check-conflicts` checks `jobs`, `activities`, AND `user_working_hours` for time overlaps, insufficient travel gaps (gap < `travel_buffer_minutes`), non-working days (hard block), and outside individual working hours (overridable). Conflict types: `time_overlap`, `no_travel_gap`, `annual_leave` (hard block), `training`, `other_non_job`. Annual leave + non-working days = hard block, no override. Job form fires conflict check with 500ms debounce when engineer + date + time are set.
- **Smart Schedule:** `POST /api/scheduling/smart-schedule` computes suggested start times factoring in travel duration (OSRM) + buffer + individual working hours. Uses each engineer's individual end time (not just org default). Returns `hard_block` for non-working days. Skips non-working engineers in team suggestions. Modal UI with purple branding. Travel estimation: `lib/scheduling/travel.ts` uses Nominatim geocoding (postcode-first strategy for UK) + OSRM driving time — keyless, portable, self-hostable.
- **Working hours (org-level):** `org_settings` keys `working_day_start`, `working_day_end`, `travel_buffer_minutes` (category: `scheduling`). Config UI at `/scheduling/config/working-hours`. `org_settings` unique constraint is `(org_id, setting_key)` — category is NOT part of the unique constraint.
- **Working hours (individual):** `user_working_hours` table stores per-user, per-day overrides (day_of_week 1–7 ISO, is_working_day, start_time, end_time). If no row exists for a user+day, org defaults apply. Config UI at `/scheduling/config/individual-hours` (admin only). Calendar display: non-working days show hatched grey overlay (no override, drag disabled); reduced hours show amber hatched blocks before/after custom times (overridable).
- **Conflict panel layout:** Sticky right sidebar (w-80) on the job form, hidden on mobile (`hidden lg:block`). Form expands from `max-w-3xl` to `max-w-5xl` when conflicts present.
- **Field engineer view:** `field_engineer` role sees "My Schedule" on both desktop and mobile — uses `MobileScheduleView` with `getMyScheduleRange()` (own assigned jobs, 2-week window). Full dispatch calendar (`WeekView`) is only rendered for other roles. This avoids loading all jobs/engineers/activities data for field staff.

### Return Travel Tracking
Tracks the full engineer journey: travel to site, on-site work, and return travel. All timestamps logged for future overtime reporting.

**Timestamp columns on `jobs`:**
| Event | Column | GPS Event Type |
|---|---|---|
| Travel to customer | `travel_started_at` | `travel_started` |
| Arrive on site | `arrived_at` | `arrived` |
| Job completed | `completed_at` | `completed` |
| Leave customer site | `departed_at` | `departed` |
| End return travel | `return_arrived_at` | `return_arrived` |

**Migration:** `20260307000001_return_travel.sql`

**Field engineer flow:**
1. "Start Travel" → status `travelling`
2. "I've Arrived" → status `on_site`
3. "Complete Job" → completion form (tasks, notes, photos, signatures) → status `completed`
4. "Start Return Travel" → status `return_travelling`
5. "End Travel" → status `closed`

After completion, the engineer is redirected to the job detail page (not the jobs list) to see the return travel buttons. A timeline card shows all logged timestamps.

**Schedule block icons:**
- Van (SVG) for `travelling` and `return_travelling` — amber left border, pulsing
- Wrench (SVG) for `on_site` — purple left border, pulsing
- Checkmark for `completed`, double-check for `validated`, blue bg for `closed`

**Validation:** Jobs can be validated in both `completed` and `closed` status. Reopen clears `departed_at` and `return_arrived_at`.

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

## Contracts Expansion Module
Extends the base contracts module with three contract categories, billing cycles, pricebook management, invoice scheduling, and lifecycle management.

- **Migrations:** `20260411000001_contracts_expansion_phase1.sql`, `20260412000002_contracts_billing_cycles.sql`
- **Product types added:** `subscription`, `license`, `warranty` (contractable), `hardware`, `labour`, `consumable`, `software` (alongside existing `goods`/`service`)
- **Contract categories:** `support` (existing), `service` (subscriptions, fixed/rolling), `licensing` (licenses/warranties, renewal)
- **Contract type billing fields:** `billing_cycle_type` ('fixed_date'/'start_date'/'go_live_date'), `default_billing_month` (4=April/9=September), `default_term_months`, `default_notice_alert_days`, `secondary_alert_days`, `auto_invoice`, `invoice_frequency`
- **Billing cycle types:** `fixed_date` (ICT/ProFlex — pro-rata Year 1, fixed billing month), `start_date` (AC/CCTV — anniversary billing, no pro-rata), `go_live_date` (service/licensing — Year 1 via SO, Year 2+ from go-live). Pro-rata formula: `(daysRemaining / daysInYear) * annualValue`.
- **Pricebook management:** `contract_type_pricebook_lines` table — soft defaults per contract type (support only). Managed in contract type settings (General/Pricebook tabs). Stores annual sell price, buy price, VAT rate. Lines copied into `contract_lines` on creation with `source_pricebook_line_id` tracing origin. Server actions: `getPricebookLines()`, `savePricebookLines()`.
- **Support contract creation:** `createSupportContract()` — creates contract + lines from pricebook selection in one operation, then calls `generateInvoiceSchedule()` to create schedule rows immediately. Contract form auto-loads pricebook lines with checkboxes, auto-calculates annual value. Buy price tracked for margin visibility.
- **Contract creation from quote lines:** Contractable quote lines (subscription/license/warranty) can be selected to create a draft contract. Mixed-type validation prevents combining subscription + license in one contract. Two-step modal: configure → preview → create.
- **E-sign gate:** Service/licensing contracts with `esign_status = 'pending'` block SO creation on linked quotes. `signContract()`/`waiveEsign()` server actions. Blue banner on contract detail page.
- **Invoice schedule engine:** `generateInvoiceSchedule()` supports all 3 billing cycle types. `fixed_date`: pro-rata Year 1 + full annual Year 2+. `start_date`: full annual from Year 1. `go_live_date`: Year 2+ only. `processPendingContractInvoices()` auto-creates draft invoices. Override amount and skip with reason per row. Pro-rata column with amber pill badge on schedule UI.
- **Alerts dashboard:** `syncContractAlertStatuses()` updates `renewal_status` at 180/90 day thresholds. Alert banner on contracts list (expiring, pending invoices, e-sign pending). Days Remaining column + Renewal Status column in contracts table. Days-remaining card on detail page.
- **Upgrade flow (service only):** Pro-rata credit calculation from most recent invoice period. Creates draft credit note with negative amounts. Cancels remaining schedule rows. Marks contract as superseded.
- **Licensing renewal workflow:** `generateRenewalQuote()` → mark sent → mark accepted → `completeRenewalSigning()` with term selection. Creates new contract with inherited settings and invoice schedule.
- **Rolling contracts:** `processExpiredFixedTermContracts()` auto-transitions expired service contracts with `auto_invoice=true` to rolling. `extendRollingSchedule()` generates 3 years additional rows. `cancelRollingContract()` with date picker.
- **Cancellation cascade:** `cancelFutureScheduledWork()` helper — on contract cancellation or rolling contract stop, cancels future visit instances, linked jobs, onsite job items, and direct contract-source jobs from the cancellation date onwards.
- **Visit slot validation:** Cycle week selection enforced to exactly match contract type requirement (e.g. ProFlex 3 = 3 weeks). Save button disabled until met. Different-days mode structurally enforces via fixed row count.
- **Support contract invoicing tab:** Dedicated "Invoicing" tab on contracts list (admin/finance only). Lists active support contracts with Last Invoiced, Invoice Due, Annual Value columns. Invoice due logic for `fixed_date` (April/September billing date check) and `start_date` (anniversary check). Per-row "Create Invoice" button opens modal with editable lines and date. "Create All Due Invoices" bulk action creates drafts for all due contracts, skips those with existing drafts or no lines. Server actions: `getSupportContractsForInvoicing()`, `createSupportContractInvoice()`, `bulkCreateSupportInvoices()`.
- **Schedule generation on activation:** `updateContractStatus()` calls `generateInvoiceSchedule()` when activating a contract. `signContract()` and `waiveEsign()` also trigger schedule generation.
- **Renewal copies billing fields:** `renewContract()` copies `billing_cycle_type`, `billing_month`, `billing_day`, `sla_plan_id`, `monthly_hours`, `calendar_id` to the new contract, and copies `buy_price` + `source_pricebook_line_id` on lines.
- **Supplier price stubs:** `contract_line_supplier_prices` table populated on creation, not yet read from. TODO hooks in renewal quote generator for future supplier price list integration.
- **Server actions:** All in `app/(dashboard)/contracts/actions.ts`
- **UI components:** `esign-banner.tsx`, `invoice-schedule-section.tsx`, `upgrade-section.tsx`, `renewal-flow-section.tsx`, `contracts-alert-banner.tsx`, `contracts-page-tabs.tsx`, `invoicing-tab.tsx`
- **Types:** `lib/contracts/types.ts` — `ContractCategory`, `BillingCycleType`, `EsignStatus`, `RenewalStatus`, `InvoiceFrequency`, `ScheduleStatus`, `ContractInvoiceSchedule`, `ContractLineSupplierPrice`, `PricebookLine`, `CreateSupportContractPayload`, `BILLING_CYCLE_LABELS`, `BILLING_MONTH_OPTIONS`

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

## Onsite Jobs Module
Lightweight job-logging system for tracking onsite work items raised by portal users, pushed from service desk tickets, or created internally. Distinct from the Scheduling module (dispatch calendar) — OJIs are tracked items, not calendar-scheduled jobs.

- **Migration:** `20260307000002_onsite_jobs.sql`
- **Tables:** `onsite_job_items` (main items table), `onsite_job_categories` (configurable categories with colour swatches), `onsite_job_audit` (immutable audit trail)
- **Ref number format:** `OJI-{YYYY}-{NNNN}` (auto-incrementing via `generate_oji_ref_number` trigger)
- **Statuses (5):** `pending`, `in_progress`, `complete`, `escalated`, `cancelled`. State machine in `STATUS_TRANSITIONS` with `canTransition()` guard.
- **Priorities (4):** `low`, `medium`, `high`, `urgent`. Portal users can only select low/medium/high; urgent reserved for escalations.
- **Source types (4):** `portal` (customer-raised), `ticket_push` (pushed from service desk), `internal` (staff-created), `escalation` (urgent portal escalation)
- **Permissions:** `onsite_jobs.view/create/edit/push_ticket/notify_sales/cancel/admin`
- **Role grants:** super_admin/admin=all; tech/field_engineer=view/create/edit/cancel; sales=view/notify_sales; finance=view

### Server Actions
- **Location:** `app/(dashboard)/helpdesk/onsite-jobs/actions.ts`
- **CRUD:** `getOnsiteJobItems(filters?)`, `getOnsiteJobItem(id)`, `getOnsiteJobCountForCustomer(customerId)`, `getTotalOpenOjiCount()`
- **Create:** `createOnsiteJobItem(input)` (internal), `createOnsiteJobItemFromPortal(input, orgId)` (portal — admin client)
- **Status:** `updateOnsiteJobStatus(id, newStatus, engineerNote?)` — enforces `canTransition()`, requires notes for completion
- **Notes:** `addEngineerNote(id, note)` — appends to `engineer_notes` text field
- **Sales:** `notifySales(id)` — idempotent (checks `notify_sales_at`), sends email via `sales_alert_email` org setting
- **Push from ticket:** `pushTicketToOji(input)` — creates OJI from ticket, closes ticket, sends email to contact
- **Escalation:** `createEscalation(input)` — creates urgent OJI + auto-creates service desk ticket, sends acknowledgement with contract status
- **Cancel:** `cancelOnsiteJobItem(id, reason?)` (internal), `cancelPortalOnsiteJobItem(id, portalUserId, customerId, orgId)` (portal — ownership check)
- **Categories:** `getOnsiteJobCategories()`, `createOnsiteJobCategory(input)`, `updateOnsiteJobCategory(id, input)`

### Portal Actions
- **Location:** `lib/portal/onsite-job-actions.ts` + `app/portal/onsite-jobs/portal-actions.ts` (thin wrappers)
- **Functions:** `getPortalOnsiteJobItems(ctx)`, `getPortalOnsiteJobItem(id, ctx)`, `getPortalOpenOjiCount(ctx)`, `getNextVisitForPortal(ctx)`, `getPortalOnsiteJobCategories(ctx)`, `checkCustomerOnsiteContract(ctx)`
- **Audit filtering:** Portal detail view hides `internal_note` and `notify_sales` audit actions

### org_settings (category: `onsite_jobs`)
- `sales_alert_email` — email address for sales notifications
- `portal_enabled` — enable/disable portal OJI submission
- `auto_link_visit` — auto-link new OJIs to next upcoming visit instance

### Email Notifications (4 types)
All sent via `GraphClient` from first active `mail_channel` (fire-and-forget):
1. **Portal confirmation** — sent to contact on portal OJI creation
2. **Sales alert** — sent to `sales_alert_email` on "Notify Sales" action
3. **Ticket push notification** — sent to ticket contact when ticket pushed to OJI
4. **Escalation acknowledgement** — sent to contact on urgent escalation (includes contract status)

### Internal UI Routes
- `/helpdesk/onsite-jobs` — list page with stat cards, tab filters (open/complete/all), data table
- `/helpdesk/onsite-jobs/[id]` — detail page with 2-col layout (details+notes | audit timeline), status action buttons
- `/helpdesk/onsite-jobs/customer/[customerId]` — customer-filtered view
- `/helpdesk/onsite-jobs/config` — admin-only categories management (colour swatches, sort order, active toggle)

### Portal UI Routes
- `/portal/onsite-jobs` — list with visit banner (next scheduled visit), "Log New" + "Report Urgent" buttons, tabbed item cards
- `/portal/onsite-jobs/new` — form with subject, on-behalf-of, room, priority (low/medium/high), category, description, preferred datetime
- `/portal/onsite-jobs/[id]` — read-only detail with filtered audit trail, cancel button for own pending items

### Integration Points
- **Service desk → OJI push:** "Push to Onsite Jobs" button on ticket detail (requires `onsite_jobs.push_ticket` permission). `PushToOjiModal` with editable fields.
- **Scheduling badge:** Job detail page shows amber "X Onsite Jobs Awaiting" badge when customer has open OJIs
- **Customer detail:** `OnsiteJobsSection` — CollapsibleCard with compact table (last 10 items), link to full customer view
- **Auto-link visits:** On OJI creation, queries `visit_instances` for next upcoming scheduled/confirmed visit and links via `visit_instance_id`
- **Types:** `lib/onsite-jobs/types.ts` — `OjiStatus`, `OjiPriority`, `OjiSourceType`, `OnsiteJobItem`, `OnsiteJobCategory`, `OnsiteJobAuditEntry`, `OJI_STATUS_CONFIG`, `OJI_PRIORITY_CONFIG`, `STATUS_TRANSITIONS`, `canTransition()`

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
