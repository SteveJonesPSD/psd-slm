import { useState, useCallback } from "react";

const fmt = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const pct = (n) => n.toFixed(1) + "%";
const uid = () => Math.random().toString(36).substr(2, 9);


// --- Users & Roles ---
const USERS = [
  { id: "u1", first_name: "Steve", last_name: "Dixon", email: "steve@psdgroup.co.uk", role: "admin", initials: "SD", color: "#6366f1" },
  { id: "u2", first_name: "Mark", last_name: "Reynolds", email: "mark@psdgroup.co.uk", role: "sales", initials: "MR", color: "#059669" },
  { id: "u3", first_name: "Rachel", last_name: "Booth", email: "rachel@psdgroup.co.uk", role: "sales", initials: "RB", color: "#d97706" },
  { id: "u4", first_name: "Jake", last_name: "Parry", email: "jake@psdgroup.co.uk", role: "sales", initials: "JP", color: "#dc2626" },
  { id: "u5", first_name: "Lisa", last_name: "Greenwood", email: "lisa@psdgroup.co.uk", role: "admin", initials: "LG", color: "#2563eb" },
  { id: "u6", first_name: "Dan", last_name: "Whittle", email: "dan@psdgroup.co.uk", role: "tech", initials: "DW", color: "#7c3aed" },
  { id: "u7", first_name: "Sam", last_name: "Hartley", email: "sam@psdgroup.co.uk", role: "tech", initials: "SH", color: "#0891b2" },
];
const ROLE_CFG = { sales: { label: "Sales", color: "#059669", bg: "#ecfdf5" }, tech: { label: "Tech", color: "#7c3aed", bg: "#f5f3ff" }, admin: { label: "Admin", color: "#2563eb", bg: "#eff6ff" } };
// --- Data ---
const COMPANIES = [
  { id: "c1", name: "Meridian Academy Trust", account_number: "ACC-001", city: "Manchester", postcode: "M1 4BT", phone: "0161 234 5678", email: "procurement@meridianmat.ac.uk", payment_terms: 30, is_active: true },
  { id: "c2", name: "Northern Health NHS Trust", account_number: "ACC-002", city: "Leeds", postcode: "LS1 3EX", phone: "0113 456 7890", email: "estates@northernhealth.nhs.uk", payment_terms: 60, is_active: true },
  { id: "c3", name: "Hartwell Commercial Properties", account_number: "ACC-003", city: "Birmingham", postcode: "B3 2DJ", phone: "0121 789 0123", email: "facilities@hartwellprop.co.uk", payment_terms: 30, is_active: true },
  { id: "c4", name: "Pennine Leisure Group", account_number: "ACC-004", city: "Rochdale", postcode: "OL11 5EF", phone: "01706 345 6789", email: "ops@pennineleisure.co.uk", payment_terms: 45, is_active: true },
];
const CONTACTS = [
  { id: "ct1", company_id: "c1", first_name: "Sarah", last_name: "Mitchell", job_title: "Head of IT", email: "s.mitchell@meridianmat.ac.uk", phone: "0161 234 5679", is_primary: true },
  { id: "ct2", company_id: "c1", first_name: "David", last_name: "Chen", job_title: "Facilities Manager", email: "d.chen@meridianmat.ac.uk", phone: "0161 234 5680", is_primary: false },
  { id: "ct3", company_id: "c2", first_name: "James", last_name: "Whitworth", job_title: "Estates Director", email: "j.whitworth@northernhealth.nhs.uk", phone: "0113 456 7891", is_primary: true },
  { id: "ct4", company_id: "c3", first_name: "Emma", last_name: "Richardson", job_title: "Property Manager", email: "e.richardson@hartwellprop.co.uk", phone: "0121 789 0124", is_primary: true },
  { id: "ct5", company_id: "c4", first_name: "Tom", last_name: "Bradley", job_title: "Operations Director", email: "t.bradley@pennineleisure.co.uk", phone: "01706 345 6790", is_primary: true },
];
const CATEGORIES = [
  { id: "cat1", name: "Environmental Sensors" }, { id: "cat2", name: "Networking" },
  { id: "cat3", name: "Access Control" }, { id: "cat4", name: "Cabling & Infrastructure" }, { id: "cat5", name: "Software & Licensing" },
];
const PRODUCTS = [
  { id: "p1", category_id: "cat1", sku: "ES-SENTRY-PRO", name: "EnviroSentry Pro Unit", manufacturer: "Innov8iv Labs", default_buy_price: 145, default_sell_price: 285, is_serialised: true, is_stocked: true },
  { id: "p2", category_id: "cat1", sku: "ES-SENTRY-EDU", name: "EnviroSentry SmartClass", manufacturer: "Innov8iv Labs", default_buy_price: 110, default_sell_price: 220, is_serialised: true, is_stocked: true },
  { id: "p3", category_id: "cat1", sku: "SEN-SEN55", name: "Sensirion SEN55 Module", manufacturer: "Sensirion", default_buy_price: 28.5, default_sell_price: null, is_serialised: false, is_stocked: true },
  { id: "p4", category_id: "cat2", sku: "NET-SW24-POE", name: "24-Port PoE Managed Switch", manufacturer: "Ubiquiti", default_buy_price: 325, default_sell_price: 445, is_serialised: true, is_stocked: false },
  { id: "p5", category_id: "cat2", sku: "NET-AP-AC", name: "WiFi 6 Access Point", manufacturer: "Ubiquiti", default_buy_price: 129, default_sell_price: 195, is_serialised: true, is_stocked: false },
  { id: "p6", category_id: "cat4", sku: "CAB-CAT6A-305", name: "Cat6A Cable 305m Box", manufacturer: "Excel", default_buy_price: 165, default_sell_price: 225, is_serialised: false, is_stocked: true },
  { id: "p7", category_id: "cat3", sku: "AC-READER-BLE", name: "IngressaEdge BLE Reader", manufacturer: "Innov8iv Labs", default_buy_price: 85, default_sell_price: 165, is_serialised: true, is_stocked: true },
  { id: "p8", category_id: "cat5", sku: "SW-HA-PRO", name: "Home Assistant Pro License", manufacturer: "Nabu Casa", default_buy_price: 0, default_sell_price: 65, is_serialised: false, is_stocked: false },
  { id: "p9", category_id: "cat4", sku: "CAB-PATCH-1M", name: "Cat6A Patch Lead 1m", manufacturer: "Excel", default_buy_price: 2.8, default_sell_price: 5.5, is_serialised: false, is_stocked: true },
  { id: "p10", category_id: "cat1", sku: "ES-HEAD-CO2", name: "EnviroSentry CO2 Sensor Head", manufacturer: "Innov8iv Labs", default_buy_price: 42, default_sell_price: 89, is_serialised: false, is_stocked: true },
];
const SUPPLIERS = [
  { id: "s1", name: "Sensirion AG", account_number: "SUP-001", email: "orders@sensirion.com", phone: "+41 44 306 40 00" },
  { id: "s2", name: "Ubiquiti Networks", account_number: "SUP-002", email: "trade@ui.com", phone: "0800 123 4567" },
  { id: "s3", name: "Excel Networking", account_number: "SUP-003", email: "sales@excel-networking.com", phone: "0121 326 7557" },
  { id: "s4", name: "RS Components", account_number: "SUP-004", email: "orders@rs-online.com", phone: "01onal 403 2000" },
  { id: "s5", name: "Farnell", account_number: "SUP-005", email: "sales@farnell.com", phone: "0113 263 6311" },
];
const OPPS = [
  { id: "o1", company_id: "c1", contact_id: "ct1", assigned_to: "u2", title: "SmartClass rollout - 8 schools", stage: "proposal", estimated_value: 48000, probability: 65, expected_close_date: "2026-03-15", notes: "Phase 1: 4 schools. Phase 2: remaining 4" },
  { id: "o2", company_id: "c2", contact_id: "ct3", assigned_to: "u3", title: "Ward environmental monitoring", stage: "prospecting", estimated_value: 22000, probability: 30, expected_close_date: "2026-04-30", notes: "Pilot ward first, then rollout" },
  { id: "o3", company_id: "c3", contact_id: "ct4", assigned_to: "u2", title: "Exchange Tower IAQ system", stage: "proposal", estimated_value: 15500, probability: 80, expected_close_date: "2026-02-28", notes: "Existing HVAC integration required" },
  { id: "o4", company_id: "c4", contact_id: "ct5", assigned_to: "u4", title: "Hotel vape detection system", stage: "prospecting", estimated_value: 8500, probability: 45, expected_close_date: "2026-05-15", notes: "3 hotels, bedrooms and public areas" },
];
const QUOTE_TYPES = [
  { value: "business", label: "Business" }, { value: "education", label: "Education" },
  { value: "charity", label: "Charity" }, { value: "public_sector", label: "Public Sector" },
];
const INIT_QUOTES = [{
  id: "q1", quote_number: "Q-2026-0001", opportunity_id: "o3", company_id: "c3", contact_id: "ct4",
  assigned_to: "u2",
  attributions: [
    { user_id: "u2", type: "direct", split_pct: 80 },
    { user_id: "u3", type: "involvement", split_pct: 20 },
  ],
  status: "sent", version: 1, valid_until: "2026-03-15", vat_rate: 20, quote_type: "business",
  notes: "Exchange Tower Phase 1", customer_notes: "All equipment installed within 2 weeks of order.",
  portal_token: "abc123xyz",
  groups: [
    { id: "g1", name: "Monitoring Hardware", sort: 0 },
    { id: "g2", name: "Network Infrastructure", sort: 1 },
    { id: "g3", name: "Software", sort: 2 },
  ],
  lines: [
    { id: "ql1", group_id: "g1", product_id: "p1", supplier_id: "s4", sort: 0, description: "EnviroSentry Pro Unit", quantity: 12, buy_price: 145, sell_price: 275, fulfilment_route: "stock" },
    { id: "ql2", group_id: "g1", product_id: "p10", supplier_id: "s1", sort: 1, description: "EnviroSentry CO2 Sensor Head", quantity: 12, buy_price: 42, sell_price: 85, fulfilment_route: "stock" },
    { id: "ql3", group_id: "g2", product_id: "p4", supplier_id: "s2", sort: 0, description: "24-Port PoE Managed Switch", quantity: 2, buy_price: 310, sell_price: 435, fulfilment_route: "deliver_to_site" },
    { id: "ql4", group_id: "g2", product_id: "p6", supplier_id: "s3", sort: 1, description: "Cat6A Cable 305m Box", quantity: 3, buy_price: 165, sell_price: 225, fulfilment_route: "deliver_to_site" },
    { id: "ql5", group_id: "g2", product_id: "p9", supplier_id: "s3", sort: 2, description: "Cat6A Patch Lead 1m", quantity: 24, buy_price: 2.8, sell_price: 5.5, fulfilment_route: "stock" },
    { id: "ql6", group_id: "g3", product_id: "p8", supplier_id: null, sort: 0, description: "Home Assistant Pro License (Annual)", quantity: 1, buy_price: 0, sell_price: 65, fulfilment_route: "drop_ship" },
  ]
}];

const STAGE_CFG = { prospecting: { label: "Prospecting", color: "#6366f1", bg: "#eef2ff" }, proposal: { label: "Proposal", color: "#d97706", bg: "#fffbeb" }, won: { label: "Won", color: "#059669", bg: "#ecfdf5" }, lost: { label: "Lost", color: "#dc2626", bg: "#fef2f2" } };
const Q_STATUS = { draft: { label: "Draft", color: "#6b7280", bg: "#f3f4f6" }, sent: { label: "Sent", color: "#2563eb", bg: "#eff6ff" }, accepted: { label: "Accepted", color: "#059669", bg: "#ecfdf5" }, declined: { label: "Declined", color: "#dc2626", bg: "#fef2f2" }, expired: { label: "Expired", color: "#9ca3af", bg: "#f9fafb" } };
const ROUTE_CFG = { drop_ship: { label: "Drop Ship", color: "#7c3aed" }, deliver_to_site: { label: "Deliver to Site", color: "#2563eb" }, stock: { label: "Into Stock", color: "#059669" } };
const QT_CFG = { business: { label: "Business", color: "#1e293b", bg: "#f1f5f9" }, education: { label: "Education", color: "#7c3aed", bg: "#f5f3ff" }, charity: { label: "Charity", color: "#059669", bg: "#ecfdf5" }, public_sector: { label: "Public Sector", color: "#2563eb", bg: "#eff6ff" } };

// --- UI Primitives ---
const Badge = ({ label, color, bg }) => <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, color, background: bg, lineHeight: "20px" }}>{label}</span>;
const Btn = ({ children, onClick, variant = "default", size = "md", disabled, style: s }) => {
  const vs = { default: { background: "#f1f5f9", color: "#334155" }, primary: { background: "#1e293b", color: "#fff" }, success: { background: "#059669", color: "#fff" }, danger: { background: "#fee2e2", color: "#dc2626" }, ghost: { background: "transparent", color: "#64748b" }, blue: { background: "#2563eb", color: "#fff" } };
  return <button style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: disabled ? "default" : "pointer", fontWeight: 500, borderRadius: 8, opacity: disabled ? 0.5 : 1, fontSize: size === "sm" ? 12 : 14, padding: size === "sm" ? "5px 12px" : "8px 18px", ...vs[variant], ...s }} onClick={disabled ? undefined : onClick}>{children}</button>;
};
const Inp = ({ label, value, onChange, type = "text", placeholder, style: s, textarea }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, ...s }}>
    {label && <label style={{ fontSize: 12, fontWeight: 500, color: "#64748b" }}>{label}</label>}
    {textarea ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", resize: "vertical", fontFamily: "inherit" }} />
    : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff" }} />}
  </div>
);
const Sel = ({ label, value, onChange, options, placeholder, style: s }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, ...s }}>
    {label && <label style={{ fontSize: 12, fontWeight: 500, color: "#64748b" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Tbl = ({ columns, data, onRowClick }) => (
  <div style={{ overflowX: "auto", border: "1px solid #e9ecef", borderRadius: 10 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead><tr>{columns.map(c => <th key={c.key} style={{ padding: "10px 14px", textAlign: c.align || "left", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", borderBottom: "2px solid #e9ecef", background: "#f8fafc", whiteSpace: "nowrap" }}>{c.label}</th>)}</tr></thead>
      <tbody>{data.map((row, i) => <tr key={row.id || i} onClick={() => onRowClick && onRowClick(row)} style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: "1px solid #f1f5f9" }}>{columns.map(c => <td key={c.key} style={{ padding: "10px 14px", textAlign: c.align || "left", whiteSpace: c.nowrap ? "nowrap" : "normal", color: "#334155" }}>{c.render ? c.render(row) : row[c.key]}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
const Stat = ({ label, value, sub, accent = "#1e293b" }) => (
  <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e9ecef", flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: accent, letterSpacing: -0.5, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
  </div>
);
const Modal = ({ title, onClose, children, width = 600 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
    <div style={{ background: "#fff", borderRadius: 16, width: "90%", maxWidth: width, maxHeight: "85vh", overflow: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #e9ecef", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", borderRadius: "16px 16px 0 0", zIndex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1e293b" }}>{title}</h3>
        <Btn variant="ghost" onClick={onClose}>X</Btn>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

// --- Drag handle ---
const DragHandle = () => <span style={{ cursor: "grab", color: "#cbd5e1", fontSize: 16, userSelect: "none", padding: "0 4px" }}>{"\u2630"}</span>;


// --- User Avatar ---
const Avatar = ({ user, size = 28 }) => {
  if (!user) return null;
  return <div title={user.first_name+" "+user.last_name} style={{ width: size, height: size, borderRadius: "50%", background: user.color, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size*0.4, fontWeight: 700, flexShrink: 0 }}>{user.initials}</div>;
};
const AvatarGroup = ({ userIds, size = 26 }) => {
  const us = userIds.map(id => USERS.find(u=>u.id===id)).filter(Boolean);
  return <div style={{ display: "flex" }}>{us.map((u,i) => <div key={u.id} style={{ marginLeft: i>0?-8:0, zIndex: us.length-i }}><Avatar user={u} size={size} /></div>)}</div>;
};

function AttributionEditor({ attributions, onChange }) {
  const salesUsers = USERS.filter(u => u.role === "sales");
  const totalPct = attributions.reduce((s,a)=>s+a.split_pct,0);
  const addA = () => { const used = attributions.map(a=>a.user_id); const av = salesUsers.find(u => !used.includes(u.id)); if (av) onChange([...attributions, { user_id: av.id, type: "involvement", split_pct: 0 }]); };
  const upd = (idx, f, v) => onChange(attributions.map((a,i) => i===idx ? {...a, [f]: f==="split_pct"?parseInt(v)||0:v} : a));
  const rm = (idx) => onChange(attributions.filter((_,i)=>i!==idx));
  return (
    <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16, border: "1px solid #e9ecef" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Sales Attribution</div>
        <Btn size="sm" onClick={addA} disabled={attributions.length >= salesUsers.length}>+ Add Person</Btn>
      </div>
      {attributions.map((a, i) => {
        const u = USERS.find(x=>x.id===a.user_id);
        return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, background: "#fff", padding: "8px 12px", borderRadius: 8, border: "1px solid #e9ecef" }}>
          <Avatar user={u} size={28} />
          <select value={a.user_id} onChange={e => upd(i, "user_id", e.target.value)} style={{ fontSize: 13, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 4, flex: 1 }}>
            {salesUsers.map(su => <option key={su.id} value={su.id}>{su.first_name} {su.last_name}</option>)}
          </select>
          <select value={a.type} onChange={e => upd(i, "type", e.target.value)} style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 4, width: 120 }}>
            <option value="direct">Direct</option>
            <option value="involvement">Involvement</option>
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="number" value={a.split_pct} onChange={e => upd(i, "split_pct", e.target.value)} min="0" max="100" style={{ width: 55, textAlign: "center", padding: "4px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 13 }} />
            <span style={{ fontSize: 12, color: "#64748b" }}>%</span>
          </div>
          {attributions.length > 1 && <Btn variant="ghost" size="sm" onClick={() => rm(i)} style={{ color: "#dc2626", padding: "4px 8px" }}>X</Btn>}
        </div>);
      })}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
        <span style={{ color: totalPct===100?"#059669":"#dc2626", fontWeight: 600 }}>Total: {totalPct}%</span>
        {totalPct !== 100 && <span style={{ color: "#dc2626" }}>Must equal 100%</span>}
      </div>
    </div>
  );
}

function AttributionDisplay({ attributions }) {
  if (!attributions || !attributions.length) return null;
  return (<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    {attributions.map((a, i) => { const u = USERS.find(x=>x.id===a.user_id); if (!u) return null;
      return (<div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: a.type==="direct"?"#ecfdf5":"#f8fafc", padding: "3px 10px 3px 5px", borderRadius: 20, border: "1px solid "+(a.type==="direct"?"#bbf7d0":"#e9ecef") }}>
        <Avatar user={u} size={20} />
        <span style={{ fontSize: 12, fontWeight: 500 }}>{u.first_name}</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>{a.split_pct}%</span>
        <span style={{ fontSize: 9, color: a.type==="direct"?"#059669":"#94a3b8", fontWeight: 700 }}>{a.type==="direct"?"DIRECT":"INV"}</span>
      </div>); })}
  </div>);
}
// ============================================================================
// PAGES
// ============================================================================

function DashboardPage({ data }) {
  const { opportunities: opps, quotes, companies } = data;
  const pv = opps.filter(o => o.stage !== "lost").reduce((s, o) => s + o.estimated_value, 0);
  const wv = opps.filter(o => !["lost","won"].includes(o.stage)).reduce((s, o) => s + o.estimated_value * o.probability / 100, 0);
  const qOut = quotes.filter(q => q.status === "sent").length;
  const qVal = quotes.filter(q => q.status === "sent").reduce((s, q) => { const sub = q.lines.reduce((a, l) => a + l.sell_price * l.quantity, 0); return s + sub * 1.2; }, 0);
  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#1e293b" }}>Dashboard</h2>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#94a3b8" }}>Sales pipeline overview</p>
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat label="Pipeline Value" value={fmt(pv)} sub={opps.filter(o => !["lost","won"].includes(o.stage)).length + " active"} />
        <Stat label="Weighted Value" value={fmt(wv)} sub="Based on probability" accent="#6366f1" />
        <Stat label="Quotes Out" value={qOut} sub={fmt(qVal) + " total"} accent="#d97706" />
        <Stat label="Active Customers" value={companies.filter(c => c.is_active).length} accent="#059669" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Pipeline by Stage</h3>
          {["prospecting", "proposal"].map(stage => {
            const cfg = STAGE_CFG[stage]; const os = opps.filter(o => o.stage === stage);
            const val = os.reduce((s, o) => s + o.estimated_value, 0);
            return (<div key={stage} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{cfg.label} ({os.length})</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{fmt(val)}</span>
              </div>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3 }}><div style={{ height: "100%", width: (pv > 0 ? val/pv*100 : 0)+"%", background: cfg.color, borderRadius: 3 }} /></div>
            </div>);
          })}
        </div>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Recent Opportunities</h3>
          {opps.slice(0, 5).map(o => {
            const co = companies.find(c => c.id === o.company_id); const cfg = STAGE_CFG[o.stage];
            return (<div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{o.title}</div><div style={{ fontSize: 12, color: "#94a3b8" }}>{co && co.name}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(o.estimated_value)}</span><Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /></div>
            </div>);
          })}
        </div>
      </div>
    </div>
  );
}

function CompaniesPage({ data, setData, navigate }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", account_number: "", city: "", postcode: "", phone: "", email: "", payment_terms: "30" });
  const filtered = data.companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const save = () => { setData(d => ({ ...d, companies: [...d.companies, { ...form, id: uid(), payment_terms: parseInt(form.payment_terms)||30, is_active: true }] })); setShowForm(false); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Companies</h2><p style={{ margin: "4px 0 0", fontSize: 14, color: "#94a3b8" }}>{data.companies.length} accounts</p></div>
        <Btn variant="primary" onClick={() => setShowForm(true)}>+ New Company</Btn>
      </div>
      <Inp placeholder="Search companies..." value={search} onChange={setSearch} style={{ maxWidth: 320, marginBottom: 16 }} />
      <Tbl columns={[
        { key: "account_number", label: "Account", nowrap: true },
        { key: "name", label: "Company", render: r => <b>{r.name}</b> },
        { key: "city", label: "City" }, { key: "postcode", label: "Postcode" }, { key: "phone", label: "Phone" },
        { key: "payment_terms", label: "Terms", align: "center", render: r => r.payment_terms+" days" },
        { key: "contacts", label: "Contacts", align: "center", render: r => data.contacts.filter(c => c.company_id===r.id).length },
      ]} data={filtered} onRowClick={r => navigate("company-detail", r.id)} />
      {showForm && <Modal title="New Company" onClose={() => setShowForm(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Inp label="Company Name *" value={form.name} onChange={v => setForm(f=>({...f,name:v}))} style={{ gridColumn: "1/-1" }} />
          <Inp label="Account Number" value={form.account_number} onChange={v => setForm(f=>({...f,account_number:v}))} />
          <Inp label="Payment Terms" type="number" value={form.payment_terms} onChange={v => setForm(f=>({...f,payment_terms:v}))} />
          <Inp label="City" value={form.city} onChange={v => setForm(f=>({...f,city:v}))} />
          <Inp label="Postcode" value={form.postcode} onChange={v => setForm(f=>({...f,postcode:v}))} />
          <Inp label="Phone" value={form.phone} onChange={v => setForm(f=>({...f,phone:v}))} />
          <Inp label="Email" value={form.email} onChange={v => setForm(f=>({...f,email:v}))} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}><Btn onClick={() => setShowForm(false)}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={!form.name}>Save</Btn></div>
      </Modal>}
    </div>
  );
}

function CompanyDetail({ data, companyId, navigate }) {
  const co = data.companies.find(c => c.id===companyId);
  if (!co) return <div>Not found</div>;
  const cts = data.contacts.filter(c => c.company_id===companyId);
  const ops = data.opportunities.filter(o => o.company_id===companyId);
  return (
    <div>
      <Btn variant="ghost" onClick={() => navigate("companies")}>&larr; Companies</Btn>
      <h2 style={{ margin: "12px 0 4px", fontSize: 24, fontWeight: 700 }}>{co.name}</h2>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#94a3b8" }}>{co.account_number} &middot; {co.city}, {co.postcode}</p>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Stat label="Contacts" value={cts.length} />
        <Stat label="Opportunities" value={ops.length} sub={fmt(ops.reduce((s,o)=>s+o.estimated_value,0))+" pipeline"} accent="#6366f1" />
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Contacts</h3>
        <Tbl columns={[
          { key: "n", label: "Name", render: r => <b>{r.first_name} {r.last_name}</b> },
          { key: "job_title", label: "Title" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
          { key: "is_primary", label: "Primary", align: "center", render: r => r.is_primary ? <Badge label="Primary" color="#059669" bg="#ecfdf5" /> : "" },
        ]} data={cts} />
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", padding: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Opportunities</h3>
        <Tbl columns={[
          { key: "title", label: "Title", render: r => <b>{r.title}</b> },
          { key: "stage", label: "Stage", render: r => <Badge {...STAGE_CFG[r.stage]} /> },
          { key: "estimated_value", label: "Value", align: "right", render: r => fmt(r.estimated_value), nowrap: true },
          { key: "probability", label: "Prob.", align: "center", render: r => r.probability+"%" },
        ]} data={ops} onRowClick={r => navigate("opp-detail", r.id)} />
      </div>
    </div>
  );
}

function PipelinePage({ data, navigate }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>Pipeline</h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8" }}>{data.opportunities.length} opportunities</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {["prospecting", "proposal"].map(stage => {
          const cfg = STAGE_CFG[stage]; const opps = data.opportunities.filter(o => o.stage===stage);
          return (<div key={stage} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "3px solid "+cfg.color }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{opps.length} &middot; {fmt(opps.reduce((s,o)=>s+o.estimated_value,0))}</div>
            </div>
            <div style={{ padding: 8 }}>{opps.map(o => {
              const co = data.companies.find(c => c.id===o.company_id);
              const ow = USERS.find(u=>u.id===o.assigned_to); return (<div key={o.id} onClick={() => navigate("opp-detail", o.id)} style={{ padding: "12px 14px", margin: "4px 0", borderRadius: 8, border: "1px solid #f1f5f9", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{o.title}</span><Avatar user={ow} size={22} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
                  <span>{co && co.name}</span><span style={{ fontWeight: 600, color: "#334155" }}>{fmt(o.estimated_value)}</span>
                </div>
              </div>);
            })}</div>
          </div>);
        })}
      </div>
    </div>
  );
}

function OppDetail({ data, oppId, navigate }) {
  const opp = data.opportunities.find(o => o.id===oppId);
  if (!opp) return <div>Not found</div>;
  const co = data.companies.find(c => c.id===opp.company_id);
  const ct = data.contacts.find(c => c.id===opp.contact_id);
  const qs = data.quotes.filter(q => q.opportunity_id===opp.id);
  const cfg = STAGE_CFG[opp.stage];
  return (
    <div>
      <Btn variant="ghost" onClick={() => navigate("pipeline")}>&larr; Pipeline</Btn>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>{opp.title}</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>{co && co.name} &middot; {ct && (ct.first_name+" "+ct.last_name)}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", padding: "6px 12px", borderRadius: 8, border: "1px solid #e9ecef" }}>
            {(() => { const ow = USERS.find(u=>u.id===opp.assigned_to); return ow ? <><Avatar user={ow} size={24} /><span style={{ fontSize: 13, fontWeight: 500 }}>{ow.first_name}</span></> : null; })()}
          </div>
          <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
          <Btn variant="primary" size="sm" onClick={() => navigate("quote-builder", null, { opportunity: opp })}>+ New Quote</Btn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Value" value={fmt(opp.estimated_value)} />
        <Stat label="Probability" value={opp.probability+"%"} accent="#6366f1" />
        <Stat label="Weighted" value={fmt(opp.estimated_value*opp.probability/100)} accent="#059669" />
        <Stat label="Close Date" value={opp.expected_close_date} accent="#d97706" />
      </div>
      {opp.notes && <div style={{ background: "#fffbeb", borderRadius: 10, padding: "14px 18px", marginBottom: 20, border: "1px solid #fde68a", fontSize: 14, color: "#92400e" }}><b>Notes:</b> {opp.notes}</div>}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", padding: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Quotes ({qs.length})</h3>
        {qs.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 14 }}>No quotes yet.</p> :
        <Tbl columns={[
          { key: "quote_number", label: "Quote #", render: r => <b>{r.quote_number}</b> },
          { key: "owner", label: "Owner", render: r => { const u = USERS.find(x=>x.id===r.assigned_to); return u ? <Avatar user={u} size={24} /> : ""; } },
          { key: "attr", label: "Attribution", render: r => <AttributionDisplay attributions={r.attributions} /> },
          { key: "type", label: "Type", render: r => { const t = QT_CFG[r.quote_type]; return t ? <Badge label={t.label} color={t.color} bg={t.bg} /> : ""; } },
          { key: "status", label: "Status", render: r => <Badge {...Q_STATUS[r.status]} /> },
          { key: "lines", label: "Lines", align: "center", render: r => r.lines.length },
          { key: "total", label: "Total (inc VAT)", align: "right", nowrap: true, render: r => { const sub = r.lines.reduce((s,l)=>s+l.sell_price*l.quantity,0); return <b>{fmt(sub*(1+r.vat_rate/100))}</b>; } },
        ]} data={qs} onRowClick={r => navigate("quote-detail", r.id)} />}
      </div>
    </div>
  );
}

function QuoteDetail({ data, setData, quoteId, navigate }) {
  const [showSend, setShowSend] = useState(false);
  const [showPortal, setShowPortal] = useState(false);
  const q = data.quotes.find(x => x.id===quoteId);
  if (!q) return <div>Not found</div>;
  const co = data.companies.find(c => c.id===q.company_id);
  const ct = data.contacts.find(c => c.id===q.contact_id);
  const opp = data.opportunities.find(o => o.id===q.opportunity_id);
  const groups = (q.groups || []).sort((a,b)=>a.sort-b.sort);
  const ungrouped = q.lines.filter(l => !l.group_id);
  const sub = q.lines.reduce((s,l)=>s+l.sell_price*l.quantity,0);
  const cost = q.lines.reduce((s,l)=>s+l.buy_price*l.quantity,0);
  const margin = sub - cost; const mp = sub > 0 ? margin/sub*100 : 0;
  const vat = sub * q.vat_rate / 100;
  const owner = USERS.find(u=>u.id===q.assigned_to);
  const th = { padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: 0.4, textTransform: "uppercase", borderBottom: "2px solid #e9ecef", whiteSpace: "nowrap", background: "#f8fafc" };
  const portalUrl = "https://quotes.psdgroup.co.uk/q/" + (q.portal_token || "token");

  const markSent = () => { setData(d => ({...d, quotes: d.quotes.map(x => x.id===q.id ? {...x, status: "sent", portal_token: q.portal_token || uid()} : x)})); setShowSend(false); };

  const renderLines = (lines) => lines.sort((a,b)=>a.sort-b.sort).map(l => {
    const p = data.products.find(x=>x.id===l.product_id);
    const s = data.suppliers.find(x=>x.id===l.supplier_id);
    const lt = l.sell_price*l.quantity;
    const ma = (l.sell_price-l.buy_price)*l.quantity;
    const mpp = l.sell_price>0?((l.sell_price-l.buy_price)/l.sell_price)*100:0;
    const rc = ROUTE_CFG[l.fulfilment_route];
    return (<tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
      <td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 500 }}>{l.description}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{p && p.sku}</div></td>
      <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 500, color: rc.color, background: rc.color+"18", padding: "2px 8px", borderRadius: 4 }}>{rc.label}</span></td>
      <td style={{ padding: "10px 14px", color: "#64748b" }}>{s ? s.name : "\u2014"}</td>
      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 500 }}>{l.quantity}</td>
      <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748b" }}>{fmt(l.buy_price)}</td>
      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 500 }}>{fmt(l.sell_price)}</td>
      <td style={{ padding: "10px 14px", textAlign: "right", color: ma>=0?"#059669":"#dc2626", fontWeight: 500 }}>{fmt(ma)}</td>
      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: mpp>=30?"#059669":mpp>=15?"#d97706":"#dc2626" }}>{pct(mpp)}</td>
      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{fmt(lt)}</td>
    </tr>);
  });

  return (
    <div>
      <Btn variant="ghost" onClick={() => navigate("opp-detail", q.opportunity_id)}>&larr; {opp ? opp.title : "Back"}</Btn>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>{q.quote_number}</h2>
            <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>{co && co.name} &middot; v{q.version}</p>
          </div>
          {q.quote_type && QT_CFG[q.quote_type] && <Badge label={QT_CFG[q.quote_type].label} color={QT_CFG[q.quote_type].color} bg={QT_CFG[q.quote_type].bg} />}
        </div>
        <Badge {...Q_STATUS[q.status]} />
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "10px 16px", borderRadius: 10, border: "1px solid #e9ecef" }}>
          <Avatar user={owner} size={28} />
          <div><div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>ASSIGNED TO</div><div style={{ fontSize: 14, fontWeight: 600 }}>{owner && (owner.first_name+" "+owner.last_name)}</div></div>
        </div>
        <div style={{ flex: 1, background: "#f8fafc", padding: "10px 16px", borderRadius: 10, border: "1px solid #e9ecef" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 6 }}>SALES ATTRIBUTION</div>
          <AttributionDisplay attributions={q.attributions} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Subtotal" value={fmt(sub)} />
        <Stat label={"VAT ("+q.vat_rate+"%)"} value={fmt(vat)} accent="#64748b" />
        <Stat label="Total" value={fmt(sub+vat)} accent="#059669" />
        <Stat label="Margin" value={fmt(margin)} sub={pct(mp)} accent={mp>=30?"#059669":mp>=15?"#d97706":"#dc2626"} />
      </div>
      {q.customer_notes && <div style={{ background: "#f0f9ff", borderRadius: 10, padding: "14px 18px", marginBottom: 20, border: "1px solid #bae6fd", fontSize: 14, color: "#0c4a6e" }}><b>Customer Notes:</b> {q.customer_notes}</div>}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e9ecef" }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Quote Lines</h3></div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>
              <th style={{...th, textAlign:"left"}}>Product</th><th style={{...th, textAlign:"left"}}>Route</th>
              <th style={{...th, textAlign:"left"}}>Supplier</th><th style={{...th, textAlign:"center"}}>Qty</th>
              <th style={{...th, textAlign:"right"}}>Buy</th><th style={{...th, textAlign:"right"}}>Sell</th>
              <th style={{...th, textAlign:"right"}}>Margin</th><th style={{...th, textAlign:"right"}}>M%</th><th style={{...th, textAlign:"right"}}>Total</th>
            </tr></thead>
            <tbody>
              {groups.map(g => {
                const gl = q.lines.filter(l => l.group_id === g.id);
                const gt = gl.reduce((s,l)=>s+l.sell_price*l.quantity,0);
                return [
                  <tr key={"gh-"+g.id} style={{ background: "#f8fafc" }}>
                    <td colSpan={8} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, color: "#334155", borderBottom: "2px solid #e2e8f0" }}>{g.name}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 13, color: "#334155", borderBottom: "2px solid #e2e8f0" }}>{fmt(gt)}</td>
                  </tr>,
                  ...renderLines(gl)
                ];
              })}
              {ungrouped.length > 0 && groups.length > 0 && <tr style={{ background: "#f8fafc" }}><td colSpan={9} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, color: "#334155", borderBottom: "2px solid #e2e8f0" }}>Other Items</td></tr>}
              {renderLines(ungrouped)}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f8fafc" }}><td colSpan={7}></td><td style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Subtotal</td><td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{fmt(sub)}</td></tr>
              <tr style={{ background: "#f8fafc" }}><td colSpan={7}></td><td style={{ padding: "6px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>VAT ({q.vat_rate}%)</td><td style={{ padding: "6px 14px", textAlign: "right" }}>{fmt(vat)}</td></tr>
              <tr style={{ background: "#1e293b" }}><td colSpan={7}></td><td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#fff" }}>TOTAL</td><td style={{ padding: "12px 14px", textAlign: "right", fontSize: 15, fontWeight: 700, color: "#fff" }}>{fmt(sub+vat)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      {q.status === "sent" && q.portal_token && <div style={{ background: "#f0f9ff", borderRadius: 10, padding: "14px 18px", marginBottom: 20, border: "1px solid #bae6fd" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 13, fontWeight: 600, color: "#0c4a6e" }}>Customer Portal Link</div><div style={{ fontSize: 13, color: "#0369a1", fontFamily: "monospace", marginTop: 4 }}>{portalUrl}</div></div>
          <Btn variant="blue" size="sm" onClick={() => setShowPortal(true)}>Preview Portal</Btn>
        </div>
      </div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn onClick={() => alert("PDF download would generate here")}>Download PDF</Btn>
        {q.status === "draft" && <Btn variant="primary" onClick={() => setShowSend(true)}>Send to Customer</Btn>}
        {q.status === "sent" && <><Btn variant="success">Accept Quote</Btn><Btn variant="danger">Decline</Btn></>}
        {q.status === "accepted" && <Btn variant="primary">Create Sales Order</Btn>}
      </div>

      {showSend && <Modal title="Send Quote to Customer" onClose={() => setShowSend(false)} width={550}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#334155", margin: "0 0 12px" }}>This will email {ct ? ct.first_name+" "+ct.last_name : "the contact"} at <b>{ct && ct.email}</b> with:</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 8, padding: 12, border: "1px solid #e9ecef" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{"\u{1F4CE}"}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>PDF Attachment</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{q.quote_number}.pdf</div>
            </div>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 8, padding: 12, border: "1px solid #e9ecef" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{"\u{1F517}"}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Portal Link</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>View &amp; accept online</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>The customer can accept the quote via the portal by entering their PO number.</p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><Btn onClick={() => setShowSend(false)}>Cancel</Btn><Btn variant="primary" onClick={markSent}>Send Quote</Btn></div>
      </Modal>}

      {showPortal && <Modal title="Customer Portal Preview" onClose={() => setShowPortal(false)} width={700}>
        <CustomerPortalPreview quote={q} company={co} contact={ct} data={data} />
      </Modal>}
    </div>
  );
}

function CustomerPortalPreview({ quote, company, contact, data }) {
  const [po, setPo] = useState("");
  const [accepted, setAccepted] = useState(false);
  const q = quote;
  const groups = (q.groups || []).sort((a,b)=>a.sort-b.sort);
  const sub = q.lines.reduce((s,l)=>s+l.sell_price*l.quantity,0);
  const vat = sub * q.vat_rate / 100;

  if (accepted) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{"\u2705"}</div>
      <h3 style={{ margin: "0 0 8px", color: "#059669" }}>Quote Accepted</h3>
      <p style={{ color: "#64748b", fontSize: 14 }}>Thank you. Your PO number <b>{po}</b> has been recorded. PSD Group will be in touch to confirm your order.</p>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 12, padding: "24px 28px", marginBottom: 20, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>PSD Group</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Quote {q.quote_number}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>Prepared for</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{company && company.name}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{contact && (contact.first_name+" "+contact.last_name)}</div>
          </div>
        </div>
      </div>

      {q.customer_notes && <div style={{ background: "#fffbeb", borderRadius: 8, padding: "12px 16px", marginBottom: 16, border: "1px solid #fde68a", fontSize: 13, color: "#92400e" }}>{q.customer_notes}</div>}

      {groups.map(g => {
        const gl = q.lines.filter(l => l.group_id===g.id).sort((a,b)=>a.sort-b.sort);
        const gt = gl.reduce((s,l)=>s+l.sell_price*l.quantity,0);
        return (<div key={g.id} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", padding: "8px 0", borderBottom: "2px solid #1e293b", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span>{g.name}</span><span>{fmt(gt)}</span>
          </div>
          {gl.map(l => (<div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
            <div style={{ flex: 1 }}>{l.description}</div>
            <div style={{ width: 50, textAlign: "center" }}>{l.quantity}</div>
            <div style={{ width: 80, textAlign: "right" }}>{fmt(l.sell_price)}</div>
            <div style={{ width: 90, textAlign: "right", fontWeight: 600 }}>{fmt(l.sell_price*l.quantity)}</div>
          </div>))}
        </div>);
      })}

      <div style={{ borderTop: "2px solid #1e293b", paddingTop: 12, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 40, fontSize: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#64748b", marginBottom: 4 }}>Subtotal: <b style={{ color: "#1e293b" }}>{fmt(sub)}</b></div>
            <div style={{ color: "#64748b", marginBottom: 4 }}>VAT ({q.vat_rate}%): <b style={{ color: "#1e293b" }}>{fmt(vat)}</b></div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Total: {fmt(sub+vat)}</div>
          </div>
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, marginTop: 24, border: "1px solid #e9ecef" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>Accept this Quote</h4>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>To accept, please enter your Purchase Order number below.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Inp placeholder="Enter your PO number *" value={po} onChange={setPo} style={{ flex: 1 }} />
          <Btn variant="success" disabled={!po.trim()} onClick={() => setAccepted(true)} style={{ alignSelf: "flex-end" }}>Accept Quote</Btn>
        </div>
      </div>
    </div>
  );
}

function QuoteBuilder({ data, setData, navigate, context }) {
  const opp = context && context.opportunity;
  const co = opp && data.companies.find(c => c.id===opp.company_id);
  const [groups, setGroups] = useState([{ id: uid(), name: "General", sort: 0 }]);
  const [lines, setLines] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [addToGroup, setAddToGroup] = useState(null);
  const [psearch, setPsearch] = useState("");
  const [notes, setNotes] = useState("");
  const [quoteType, setQuoteType] = useState("business");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [dragItem, setDragItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  const addGroup = () => { if (!newGroupName.trim()) return; setGroups(prev => [...prev, { id: uid(), name: newGroupName, sort: prev.length }]); setNewGroupName(""); setShowGroupForm(false); };
  const removeGroup = (gid) => { setLines(prev => prev.map(l => l.group_id===gid ? {...l, group_id: groups[0].id} : l)); setGroups(prev => prev.filter(g => g.id!==gid)); };

  const add = (p) => {
    const gid = addToGroup || groups[0].id;
    const groupLines = lines.filter(l => l.group_id===gid);
    setLines(prev => [...prev, { id: uid(), group_id: gid, product_id: p.id, supplier_id: "", sort: groupLines.length, description: p.name, quantity: 1, buy_price: p.default_buy_price||0, sell_price: p.default_sell_price||0, fulfilment_route: p.is_stocked?"stock":"deliver_to_site" }]);
    setShowPicker(false); setAddToGroup(null);
  };
  const upd = (id, f, v) => setLines(prev => prev.map(l => l.id===id ? {...l, [f]: ["quantity","buy_price","sell_price"].includes(f)?parseFloat(v)||0:v} : l));
  const rm = (id) => setLines(prev => prev.filter(l=>l.id!==id));

  const handleDragStart = (lineId) => setDragItem(lineId);
  const handleDragOver = (e, lineId) => { e.preventDefault(); setDragOverItem(lineId); };
  const handleDrop = (targetId, targetGroupId) => {
    if (!dragItem || dragItem===targetId) { setDragItem(null); setDragOverItem(null); return; }
    setLines(prev => {
      const updated = prev.map(l => l.id===dragItem ? {...l, group_id: targetGroupId} : l);
      const groupLines = updated.filter(l => l.group_id===targetGroupId);
      const dragIdx = groupLines.findIndex(l => l.id===dragItem);
      const targetIdx = groupLines.findIndex(l => l.id===targetId);
      if (dragIdx < 0 || targetIdx < 0) return updated;
      const [moved] = groupLines.splice(dragIdx, 1);
      groupLines.splice(targetIdx, 0, moved);
      const sorted = groupLines.map((l,i) => ({...l, sort: i}));
      return updated.map(l => { const s = sorted.find(x=>x.id===l.id); return s || l; });
    });
    setDragItem(null); setDragOverItem(null);
  };
  const handleGroupDragStart = (gid) => setDragItem("g-"+gid);
  const handleGroupDrop = (targetGid) => {
    if (!dragItem || !dragItem.startsWith("g-")) { setDragItem(null); return; }
    const srcGid = dragItem.replace("g-","");
    setGroups(prev => {
      const arr = [...prev];
      const si = arr.findIndex(g=>g.id===srcGid);
      const ti = arr.findIndex(g=>g.id===targetGid);
      const [moved] = arr.splice(si,1);
      arr.splice(ti,0,moved);
      return arr.map((g,i)=>({...g, sort: i}));
    });
    setDragItem(null);
  };

  const sub = lines.reduce((s,l)=>s+l.sell_price*l.quantity,0);
  const cost = lines.reduce((s,l)=>s+l.buy_price*l.quantity,0);
  const mg = sub-cost; const mp = sub>0?mg/sub*100:0;

  const save = () => {
    const nq = { id: uid(), quote_number: "Q-2026-"+String(data.quotes.length+1).padStart(4,"0"), opportunity_id: opp.id, company_id: opp.company_id, contact_id: opp.contact_id, status: "draft", version: 1, valid_until: "", vat_rate: 20, quote_type: quoteType, notes: "", customer_notes: notes, portal_token: uid(), groups: groups, lines: lines };
    setData(d => ({...d, quotes: [...d.quotes, nq]}));
    navigate("quote-detail", nq.id);
  };

  const fp = data.products.filter(p => p.name.toLowerCase().includes(psearch.toLowerCase()) || p.sku.toLowerCase().includes(psearch.toLowerCase()));

  return (
    <div>
      <Btn variant="ghost" onClick={() => opp ? navigate("opp-detail", opp.id) : navigate("pipeline")}>&larr; Back</Btn>
      <h2 style={{ margin: "12px 0 4px", fontSize: 24, fontWeight: 700 }}>New Quote</h2>
      {opp && <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8" }}>{opp.title} &middot; {co && co.name}</p>}

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Sel label="Quote Type" value={quoteType} onChange={setQuoteType} options={QUOTE_TYPES} style={{ minWidth: 180 }} />
      </div>

      {lines.length > 0 && <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <Stat label="Subtotal" value={fmt(sub)} /><Stat label="Cost" value={fmt(cost)} accent="#64748b" />
        <Stat label="Margin" value={fmt(mg)} sub={pct(mp)} accent={mp>=30?"#059669":mp>=15?"#d97706":"#dc2626"} />
      </div>}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e9ecef", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Quote Lines ({lines.length})</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn size="sm" onClick={() => setShowGroupForm(true)}>+ Group</Btn>
            <Btn variant="primary" size="sm" onClick={() => { setAddToGroup(groups[0].id); setShowPicker(true); }}>+ Add Product</Btn>
          </div>
        </div>

        {lines.length === 0 && groups.length <= 1 ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>Click "Add Product" to start building the quote.</div> :
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#f8fafc" }}>
              {["","Product","Route","Supplier","Qty","Buy","Sell","Margin","Total",""].map((h,i) => <th key={i} style={{ padding: "10px 12px", textAlign: ["Qty"].includes(h)?"center":["Buy","Sell","Margin","Total"].includes(h)?"right":"left", fontSize: 11, fontWeight: 600, color: "#64748b", borderBottom: "2px solid #e9ecef", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {groups.sort((a,b)=>a.sort-b.sort).map(g => {
                const gl = lines.filter(l=>l.group_id===g.id).sort((a,b)=>a.sort-b.sort);
                const gt = gl.reduce((s,l)=>s+l.sell_price*l.quantity,0);
                return [
                  <tr key={"gh-"+g.id} draggable onDragStart={()=>handleGroupDragStart(g.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>handleGroupDrop(g.id)}
                    style={{ background: "#eef2ff", cursor: "grab" }}>
                    <td style={{ padding: "8px 12px", width: 30 }}><DragHandle /></td>
                    <td colSpan={7} style={{ padding: "8px 14px", fontWeight: 700, fontSize: 13, color: "#334155" }}>
                      {g.name}
                      {groups.length > 1 && <Btn variant="ghost" size="sm" onClick={() => removeGroup(g.id)} style={{ marginLeft: 8, color: "#dc2626", fontSize: 11 }}>remove</Btn>}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>{fmt(gt)}</td>
                    <td style={{ padding: "8px 12px" }}><Btn variant="ghost" size="sm" onClick={() => { setAddToGroup(g.id); setShowPicker(true); }} style={{ fontSize: 16 }}>+</Btn></td>
                  </tr>,
                  ...gl.map(l => {
                    const p = data.products.find(x=>x.id===l.product_id);
                    const ma = (l.sell_price-l.buy_price)*l.quantity;
                    const mpp = l.sell_price>0?((l.sell_price-l.buy_price)/l.sell_price)*100:0;
                    return (<tr key={l.id} draggable onDragStart={()=>handleDragStart(l.id)} onDragOver={e=>handleDragOver(e,l.id)} onDrop={()=>handleDrop(l.id,g.id)}
                      style={{ borderBottom: "1px solid #f1f5f9", background: dragOverItem===l.id ? "#eef2ff" : "transparent" }}>
                      <td style={{ padding: "8px 12px", width: 30 }}><DragHandle /></td>
                      <td style={{ padding: "8px 12px", minWidth: 160 }}><div style={{ fontWeight: 500 }}>{l.description}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{p&&p.sku}</div></td>
                      <td style={{ padding: "8px 12px" }}><select value={l.fulfilment_route} onChange={e=>upd(l.id,"fulfilment_route",e.target.value)} style={{ fontSize: 12, padding: "4px", border: "1px solid #e2e8f0", borderRadius: 4 }}>{Object.entries(ROUTE_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></td>
                      <td style={{ padding: "8px 12px" }}><select value={l.supplier_id} onChange={e=>upd(l.id,"supplier_id",e.target.value)} style={{ fontSize: 12, padding: "4px", border: "1px solid #e2e8f0", borderRadius: 4, maxWidth: 120 }}><option value="">--</option>{data.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                      <td style={{ padding: "8px 12px" }}><input type="number" value={l.quantity} onChange={e=>upd(l.id,"quantity",e.target.value)} min="1" style={{ width: 55, textAlign: "center", padding: "4px", border: "1px solid #e2e8f0", borderRadius: 4 }} /></td>
                      <td style={{ padding: "8px 12px" }}><input type="number" step="0.01" value={l.buy_price} onChange={e=>upd(l.id,"buy_price",e.target.value)} style={{ width: 75, textAlign: "right", padding: "4px", border: "1px solid #e2e8f0", borderRadius: 4 }} /></td>
                      <td style={{ padding: "8px 12px" }}><input type="number" step="0.01" value={l.sell_price} onChange={e=>upd(l.id,"sell_price",e.target.value)} style={{ width: 75, textAlign: "right", padding: "4px", border: "1px solid #e2e8f0", borderRadius: 4 }} /></td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: ma>=0?"#059669":"#dc2626", fontWeight: 600 }}>{fmt(ma)}<div style={{ fontSize: 10 }}>{pct(mpp)}</div></td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(l.sell_price*l.quantity)}</td>
                      <td style={{ padding: "8px 12px" }}><Btn variant="ghost" size="sm" onClick={()=>rm(l.id)} style={{ color: "#dc2626" }}>X</Btn></td>
                    </tr>);
                  })
                ];
              })}
            </tbody>
          </table>
        </div>}
      </div>

      <Inp label="Customer Notes" value={notes} onChange={setNotes} placeholder="Visible to customer on the quote..." textarea style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn onClick={() => navigate("opp-detail", opp&&opp.id)}>Cancel</Btn>
        <Btn variant="primary" onClick={save} disabled={lines.length===0 || attributions.reduce((s,a)=>s+a.split_pct,0)!==100}>Save as Draft</Btn>
      </div>

      {showPicker && <Modal title="Add Product" onClose={()=>{setShowPicker(false);setPsearch("");setAddToGroup(null);}} width={650}>
        <div style={{ marginBottom: 12, fontSize: 13, color: "#64748b" }}>Adding to group: <b style={{ color: "#1e293b" }}>{(groups.find(g=>g.id===addToGroup)||{}).name}</b></div>
        <Inp placeholder="Search by name or SKU..." value={psearch} onChange={setPsearch} style={{ marginBottom: 16 }} />
        <div style={{ maxHeight: 400, overflow: "auto" }}>{fp.map(p => {
          const cat = data.categories.find(c=>c.id===p.category_id);
          return (<div key={p.id} onClick={()=>add(p)} style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid #f1f5f9", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
            <div><div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 12, color: "#94a3b8" }}>{p.sku} &middot; {cat&&cat.name}</div></div>
            <div style={{ textAlign: "right" }}>{p.default_sell_price!=null && <div style={{ fontWeight: 600 }}>{fmt(p.default_sell_price)}</div>}{p.default_buy_price!=null && <div style={{ fontSize: 11, color: "#94a3b8" }}>Buy: {fmt(p.default_buy_price)}</div>}</div>
          </div>);
        })}</div>
      </Modal>}

      {showGroupForm && <Modal title="Add Group" onClose={() => setShowGroupForm(false)} width={400}>
        <Inp label="Group Name" value={newGroupName} onChange={setNewGroupName} placeholder="e.g. Hardware, Cabling, Software..." />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}><Btn onClick={() => setShowGroupForm(false)}>Cancel</Btn><Btn variant="primary" onClick={addGroup} disabled={!newGroupName.trim()}>Add Group</Btn></div>
      </Modal>}
    </div>
  );
}

function ProductsPage({ data }) {
  const [search, setSearch] = useState(""); const [cat, setCat] = useState("");
  const f = data.products.filter(p => (p.name.toLowerCase().includes(search.toLowerCase())||p.sku.toLowerCase().includes(search.toLowerCase())) && (!cat||p.category_id===cat));
  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>Products</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8" }}>{data.products.length} in catalogue</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}><Inp placeholder="Search..." value={search} onChange={setSearch} style={{ flex: 1, maxWidth: 300 }} /><Sel placeholder="All Categories" value={cat} onChange={setCat} options={data.categories.map(c=>({value:c.id,label:c.name}))} /></div>
      <Tbl columns={[
        { key: "sku", label: "SKU", render: r => <span style={{ fontSize: 12, fontWeight: 500 }}>{r.sku}</span> },
        { key: "name", label: "Product", render: r => <b>{r.name}</b> },
        { key: "cat", label: "Category", render: r => { const c = data.categories.find(x=>x.id===r.category_id); return c?c.name:"\u2014"; } },
        { key: "manufacturer", label: "Mfr" },
        { key: "buy", label: "Buy", align: "right", render: r => r.default_buy_price!=null?fmt(r.default_buy_price):"\u2014", nowrap: true },
        { key: "sell", label: "Sell", align: "right", render: r => r.default_sell_price!=null?fmt(r.default_sell_price):"\u2014", nowrap: true },
        { key: "flags", label: "Flags", render: r => <div style={{ display: "flex", gap: 4 }}>{r.is_serialised && <Badge label="Serialised" color="#7c3aed" bg="#f5f3ff" />}{r.is_stocked && <Badge label="Stocked" color="#059669" bg="#ecfdf5" />}</div> },
      ]} data={f} />
    </div>
  );
}

function SuppliersPage({ data }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>Suppliers</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8" }}>{data.suppliers.length} suppliers</p>
      <Tbl columns={[
        { key: "account_number", label: "Account" }, { key: "name", label: "Supplier", render: r => <b>{r.name}</b> },
        { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
      ]} data={data.suppliers} />
    </div>
  );
}

// ============================================================================
// APP
// ============================================================================
const NAV = [
  { key: "dashboard", label: "Dashboard", ico: "\u{1F3E0}" },
  { key: "companies", label: "Companies", ico: "\u{1F3E2}" },
  { key: "pipeline", label: "Pipeline", ico: "\u{1F4C8}" },
  { key: "quotes", label: "Quotes", ico: "\u{1F4C4}" },
  { key: "products", label: "Products", ico: "\u{1F3F7}" },
  { key: "suppliers", label: "Suppliers", ico: "\u{1F4E6}" },
  { divider: true },
  { key: "orders", label: "Sales Orders", ico: "\u{1F4CB}" },
  { key: "stock", label: "Stock", ico: "\u{1F4E6}" },
  { key: "jobs", label: "Jobs", ico: "\u{1F527}" },
  { divider: true },
  { key: "team", label: "Team", ico: "\u{1F465}" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [detailId, setDetailId] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("u1");
  const currentUser = USERS.find(u=>u.id===currentUserId);
  const [data, setData] = useState({ companies: COMPANIES, contacts: CONTACTS, categories: CATEGORIES, products: PRODUCTS, suppliers: SUPPLIERS, opportunities: OPPS, quotes: INIT_QUOTES });
  const nav = useCallback((pg, id, c) => { setPage(pg); setDetailId(id||null); setCtx(c||null); }, []);

  const render = () => {
    switch(page) {
      case "dashboard": return <DashboardPage data={data} />;
      case "companies": return <CompaniesPage data={data} setData={setData} navigate={nav} />;
      case "company-detail": return <CompanyDetail data={data} companyId={detailId} navigate={nav} />;
      case "pipeline": return <PipelinePage data={data} navigate={nav} />;
      case "opp-detail": return <OppDetail data={data} oppId={detailId} navigate={nav} />;
      case "quote-detail": return <QuoteDetail data={data} setData={setData} quoteId={detailId} navigate={nav} />;
      case "quote-builder": return <QuoteBuilder data={data} setData={setData} navigate={nav} context={ctx} />;
      case "products": return <ProductsPage data={data} />;
      case "suppliers": return <SuppliersPage data={data} />;
      case "team": return (<div>
        <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>Team</h2>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8" }}>{USERS.length} members</p>
        <Tbl columns={[
          { key: "av", label: "", render: r => <Avatar user={r} size={32} /> },
          { key: "name", label: "Name", render: r => <b>{r.first_name} {r.last_name}</b> },
          { key: "email", label: "Email" },
          { key: "role", label: "Role", render: r => { const rc = ROLE_CFG[r.role]; return <Badge label={rc.label} color={rc.color} bg={rc.bg} />; } },
        ]} data={USERS} />
      </div>);
      case "quotes": return (<div>
        <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 700 }}>All Quotes</h2>
        <Tbl columns={[
          { key: "quote_number", label: "Quote #", render: r => <b>{r.quote_number}</b> },
          { key: "co", label: "Company", render: r => { const c = data.companies.find(x=>x.id===r.company_id); return c?c.name:""; } },
          { key: "owner", label: "Owner", render: r => { const u = USERS.find(x=>x.id===r.assigned_to); return u ? <Avatar user={u} size={24} /> : ""; } },
          { key: "attr", label: "Attribution", render: r => <AttributionDisplay attributions={r.attributions} /> },
          { key: "type", label: "Type", render: r => { const t = QT_CFG[r.quote_type]; return t ? <Badge label={t.label} color={t.color} bg={t.bg} /> : ""; } },
          { key: "status", label: "Status", render: r => <Badge {...Q_STATUS[r.status]} /> },
          { key: "lines", label: "Lines", align: "center", render: r => r.lines.length },
          { key: "total", label: "Total", align: "right", nowrap: true, render: r => fmt(r.lines.reduce((s,l)=>s+l.sell_price*l.quantity,0)*(1+r.vat_rate/100)) },
        ]} data={data.quotes} onRowClick={r => nav("quote-detail", r.id)} />
      </div>);
      default: return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}><div style={{ fontSize: 48, marginBottom: 16 }}>{"\u{1F6A7}"}</div><h3 style={{ color: "#334155" }}>Coming Soon</h3><p>The {page} module will be built next.</p></div>;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f5f6f8", color: "#334155" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*{font-family:'DM Sans',-apple-system,sans-serif;box-sizing:border-box;margin:0}body{margin:0}`}</style>
      <div style={{ width: collapsed?60:230, background: "#0f172a", color: "#94a3b8", display: "flex", flexDirection: "column", transition: "width 0.2s", flexShrink: 0, overflow: "hidden" }}>
        <div style={{ padding: collapsed?"18px 12px":"18px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: 60 }} onClick={() => setCollapsed(!collapsed)}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>P</span></div>
          {!collapsed && <div><div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", whiteSpace: "nowrap" }}>PSD Group</div><div style={{ fontSize: 10, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase" }}>Sales Lifecycle</div></div>}
        </div>
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          {NAV.map((item, i) => {
            if (item.divider) return <div key={"d"+i} style={{ height: 1, background: "#1e293b", margin: "10px 8px" }} />;
            const active = page===item.key || page.startsWith(item.key.replace(/s$/,""));
            return <div key={item.key} onClick={()=>nav(item.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: active?"#1e293b":"transparent", color: active?"#f8fafc":"#64748b", justifyContent: collapsed?"center":"flex-start" }}>
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.ico}</span>
              {!collapsed && <span style={{ fontSize: 14, fontWeight: active?600:400, whiteSpace: "nowrap" }}>{item.label}</span>}
            </div>;
          })}
        </nav>
        {!collapsed && <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b" }}>
          <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Logged in as</div>
          <select value={currentUserId} onChange={e => setCurrentUserId(e.target.value)} style={{ width: "100%", fontSize: 12, padding: "6px 8px", border: "1px solid #334155", borderRadius: 6, background: "#1e293b", color: "#f8fafc", outline: "none" }}>
            {USERS.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>)}
          </select>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>SLM v4.0</div>
        </div>}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 28 }}><div style={{ maxWidth: 1200, margin: "0 auto" }}>{render()}</div></div>
    </div>
  );
}
