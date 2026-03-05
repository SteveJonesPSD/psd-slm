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
Each line has a route: `stock` (from PSD inventory), `deliver_to_site` (ordered for customer), `drop_ship` (supplier ships direct).

### 6. Quote Types
`business`, `education`, `charity`, `public_sector` — affects commission rates.

### 7. Stock Allocation is Always Manual (Except One Case)
Stock must never be auto-allocated to an SO from general inventory — the purchaser decides whether to allocate from stock, raise a PO, or split. The sole exception is SO-linked POs: these auto-allocate on receipt (deliberate design).

---

## Database
Schema deployed to Supabase (EU region). Key tables: `companies`, `contacts`, `products`, `suppliers`, `deal_registrations`, `deal_registration_lines`, `opportunities`, `quotes`, `quote_groups`, `quote_lines`, `quote_attributions`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`, `invoices`, `invoice_lines`, `commission_entries`, `commission_rates`, `activity_log`, `tickets`, `ticket_emails`, `mail_connections`, `mail_channels`, `customer_email_domains`, `chat_sessions`, `chat_messages`, `system_presence`, `contracts`, `contract_visit_slots`, `jobs`, `job_tasks`, `api_keys`, `user_mail_credentials`, `quote_email_sends`.

Key views: `v_margin_traceability`, `v_commission_summary`, `v_active_deal_pricing`, `v_ticket_summary`.

---

## Authentication & Security

### Authentication
Supabase Auth with email/password + TOTP MFA. Row-level security scoped to organisation. Six roles with ~50 granular permissions:
- **super_admin** — full platform access including system settings
- **admin** — full operational access
- **sales** — own pipeline + shared company/contact data
- **tech** — read-only commercial, full scheduling
- **finance** — invoicing + commission
- **field** — scheduling/jobs only (mobile-optimised)

MFA is enforced for admin and finance roles. All auth logic isolated in `lib/auth/` — components call `getCurrentUser()`, `signIn()`, `signOut()`. Never call `supabase.auth.getUser()` directly in components or pages.

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

---

## Module Build Order & Status
1. ~~Companies & Contacts~~ ✅
2. ~~Authentication & Roles~~ ✅ (RLS enforced, RBAC with 6 roles & ~50 permissions)
3. ~~Products, Suppliers & Categories~~ ✅ (multi-supplier, category-level serial defaults, AI-assisted product creation)
4. ~~Deal Registrations~~ ✅
5. ~~Opportunities & Pipeline~~ ✅ (kanban + list, 6-stage, drag-and-drop)
6. ~~Global Settings~~ ✅ (org settings, brands, API key management, email templates, avatar management)
7. ~~Quote Builder~~ ✅ (DR tie-in, PDF, customer portal, attribution, versioning, templates, notifications, e-signatures, attachments, AI quote generation from supplier PDFs, manual + AI-powered acceptance)
7b. ~~Inbound PO Processing~~ ✅ (PDF upload, AI extraction via Claude, quote matching pipeline)
7c. ~~Helpdesk & Ticketing~~ ✅ (ticket queue, SLA, contracts, canned responses, categories, tags, departments, KB, reports, customer portal, mobile views, Helen AI with triage/drafts/diagnostic assist, scratchpad, AutoGRUMP, ticket presence). **UI label: "Service Desk" — internal code/routes/permissions remain `/helpdesk/` and `helpdesk.*`**
8. ~~Sales Orders~~ ✅ (SO from accepted quote, line status transitions, receive goods with serial capture, delivery summary)
8b. ~~Onsite Scheduling~~ ✅ (dispatch calendar, field engineer mobile app, job task templates, e-signatures, PDF reports, GPS logging)
9. ~~Purchase Orders~~ ✅ (PO from SO, draft-first, receiving goods, price variance, PDF, stock-aware quantities, customer PO gate, auto-allocation on receipt, stocking orders)
9b. ~~Stock & Fulfilment~~ ✅ (stock locations/levels, allocations, picking, delivery notes, fulfilment view, serial uniqueness, tablet-optimised picking, PO-linked serial pre-selection, stock unallocation with reason)
10. ~~Invoicing~~ ✅ (full/partial invoicing, stat cards, credit notes, branded PDF, overdue detection, `quantity_invoiced` tracking)
10b. **Commission** ← Next
10c. ~~Contracts~~ ✅ (contract types, customer contracts, lines, entitlements, renewal chain, settings, seed data)
10d. ~~Visit Scheduling~~ ✅ (academic year calendars, 4-week cycle patterns, ProFlex quick-fill, visit generation, bulk confirm, customer visit history)
11. ~~AI Chat Agents~~ ✅ (Jasper/Helen/Lucia with tool-calling, floating chat panel, dedicated pages, persistent sessions, admin chat archive, markdown with auto-linking)
12. ~~Engineer Stock Collection~~ ✅ (QR magic links, PDF slips, touch-to-confirm mobile UI, GPS capture, partial collection)
13. ~~Email Integration~~ ✅ (Microsoft 365 Graph API, inbound polling, ticket creation/threading, outbound replies, auto-polling, domain matching, processing log)

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

## Scheduling Module
- **Job number format:** `JOB-{YEAR}-{NNNN}`
- **RLS:** Uses `auth_org_id()` and `auth_has_permission()` helpers — NOT raw `user_roles` joins
- **SO → Job integration:** `requires_install` flag on SO; red icon if no linked job, green if linked
- **Task response types:** `yes_no`, `text`, `date` — materialised from templates on job creation

---

## Invoicing Module
- **Invoice number format:** `{brand.invoice_prefix}-{YYYY}-{NNNN}` (e.g. `INV-2026-0001`)
- **Credit note numbers:** `{parent_invoice_number}-CN{N}`

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
- **Send modal:** `quotes/[id]/send-quote-modal.tsx` — 2-step (choose method → compose). Supports PDF, portal link, or both. Fallback sender if assigned user has no connected mailbox.
- **Portal PDF download:** PDF route supports `?token=` query param for unauthenticated access. `PortalPdfButton` on portal page.
- **Team page:** "Email Sending" column + Connect/Disconnect mailbox buttons (admin only)

---

## Reference
The original React prototype is available as `psd-slm-prototype.jsx`. Use for UI patterns and data model reference only — do NOT import from it.
