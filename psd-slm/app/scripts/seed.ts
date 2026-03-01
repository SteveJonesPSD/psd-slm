import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ljxlfftbinfususycgtf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqeGxmZnRiaW5mdXN1c3ljZ3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjY2NDQsImV4cCI6MjA4Nzk0MjY0NH0.CirhSlBYG_5J83jiTaOiOWjyarAobE_L4G5epXlsZ0k'
)

const ORG_ID = '7c12d3bd-f92b-48be-aab4-32b70cba77f4'

async function seed() {
  console.log('Seeding database...')

  // --- Users ---
  const usersData = [
    { org_id: ORG_ID, first_name: 'Steve', last_name: 'Dixon', email: 'steve@psdgroup.co.uk', role: 'admin', initials: 'SD', color: '#6366f1' },
    { org_id: ORG_ID, first_name: 'Mark', last_name: 'Reynolds', email: 'mark@psdgroup.co.uk', role: 'sales', initials: 'MR', color: '#059669' },
    { org_id: ORG_ID, first_name: 'Rachel', last_name: 'Booth', email: 'rachel@psdgroup.co.uk', role: 'sales', initials: 'RB', color: '#d97706' },
    { org_id: ORG_ID, first_name: 'Jake', last_name: 'Parry', email: 'jake@psdgroup.co.uk', role: 'sales', initials: 'JP', color: '#dc2626' },
    { org_id: ORG_ID, first_name: 'Lisa', last_name: 'Greenwood', email: 'lisa@psdgroup.co.uk', role: 'admin', initials: 'LG', color: '#2563eb' },
    { org_id: ORG_ID, first_name: 'Dan', last_name: 'Whittle', email: 'dan@psdgroup.co.uk', role: 'tech', initials: 'DW', color: '#7c3aed' },
    { org_id: ORG_ID, first_name: 'Sam', last_name: 'Hartley', email: 'sam@psdgroup.co.uk', role: 'tech', initials: 'SH', color: '#0891b2' },
  ]
  const { data: users, error: usersErr } = await supabase.from('users').insert(usersData).select()
  if (usersErr) { console.error('Users error:', usersErr); return }
  console.log(`  ✓ ${users.length} users`)

  const userMap = Object.fromEntries(users.map((u: { email: string; id: string }) => [u.email, u.id]))

  // --- Customers ---
  const customersData = [
    { org_id: ORG_ID, name: 'Meridian Academy Trust', account_number: 'ACC-001', customer_type: 'education', city: 'Manchester', postcode: 'M1 4BT', phone: '0161 234 5678', email: 'procurement@meridianmat.ac.uk', payment_terms: 30 },
    { org_id: ORG_ID, name: 'Northern Health NHS Trust', account_number: 'ACC-002', customer_type: 'business', city: 'Leeds', postcode: 'LS1 3EX', phone: '0113 456 7890', email: 'estates@northernhealth.nhs.uk', payment_terms: 60 },
    { org_id: ORG_ID, name: 'Hartwell Commercial Properties', account_number: 'ACC-003', customer_type: 'business', city: 'Birmingham', postcode: 'B3 2DJ', phone: '0121 789 0123', email: 'facilities@hartwellprop.co.uk', payment_terms: 30 },
    { org_id: ORG_ID, name: 'Pennine Leisure Group', account_number: 'ACC-004', customer_type: 'business', city: 'Rochdale', postcode: 'OL11 5EF', phone: '01706 345 6789', email: 'ops@pennineleisure.co.uk', payment_terms: 45 },
  ]
  const { data: customers, error: customersErr } = await supabase.from('customers').insert(customersData).select()
  if (customersErr) { console.error('Customers error:', customersErr); return }
  console.log(`  ✓ ${customers.length} customers`)

  const coMap = Object.fromEntries(customers.map((c: { name: string; id: string }) => [c.name, c.id]))

  // --- Contacts ---
  const contactsData = [
    { customer_id: coMap['Meridian Academy Trust'], first_name: 'Sarah', last_name: 'Mitchell', job_title: 'Head of IT', email: 's.mitchell@meridianmat.ac.uk', phone: '0161 234 5679', is_primary: true },
    { customer_id: coMap['Meridian Academy Trust'], first_name: 'David', last_name: 'Chen', job_title: 'Facilities Manager', email: 'd.chen@meridianmat.ac.uk', phone: '0161 234 5680', is_primary: false },
    { customer_id: coMap['Northern Health NHS Trust'], first_name: 'James', last_name: 'Whitworth', job_title: 'Estates Director', email: 'j.whitworth@northernhealth.nhs.uk', phone: '0113 456 7891', is_primary: true },
    { customer_id: coMap['Hartwell Commercial Properties'], first_name: 'Emma', last_name: 'Richardson', job_title: 'Property Manager', email: 'e.richardson@hartwellprop.co.uk', phone: '0121 789 0124', is_primary: true },
    { customer_id: coMap['Pennine Leisure Group'], first_name: 'Tom', last_name: 'Bradley', job_title: 'Operations Director', email: 't.bradley@pennineleisure.co.uk', phone: '01706 345 6790', is_primary: true },
  ]
  const { data: contacts, error: contactsErr } = await supabase.from('contacts').insert(contactsData).select()
  if (contactsErr) { console.error('Contacts error:', contactsErr); return }
  console.log(`  ✓ ${contacts.length} contacts`)

  const ctMap = Object.fromEntries(contacts.map((c: { email: string; id: string }) => [c.email, c.id]))

  // --- Product Categories ---
  const catsData = [
    { org_id: ORG_ID, name: 'Environmental Sensors', sort_order: 0 },
    { org_id: ORG_ID, name: 'Networking', sort_order: 1 },
    { org_id: ORG_ID, name: 'Access Control', sort_order: 2 },
    { org_id: ORG_ID, name: 'Cabling & Infrastructure', sort_order: 3 },
    { org_id: ORG_ID, name: 'Software & Licensing', sort_order: 4 },
  ]
  const { data: cats, error: catsErr } = await supabase.from('product_categories').insert(catsData).select()
  if (catsErr) { console.error('Categories error:', catsErr); return }
  console.log(`  ✓ ${cats.length} categories`)

  const catMap = Object.fromEntries(cats.map((c: { name: string; id: string }) => [c.name, c.id]))

  // --- Suppliers ---
  const suppliersData = [
    { org_id: ORG_ID, name: 'Sensirion AG', account_number: 'SUP-001', email: 'orders@sensirion.com', phone: '+41 44 306 40 00' },
    { org_id: ORG_ID, name: 'Ubiquiti Networks', account_number: 'SUP-002', email: 'trade@ui.com', phone: '0800 123 4567' },
    { org_id: ORG_ID, name: 'Excel Networking', account_number: 'SUP-003', email: 'sales@excel-networking.com', phone: '0121 326 7557' },
    { org_id: ORG_ID, name: 'RS Components', account_number: 'SUP-004', email: 'orders@rs-online.com', phone: '01onal 403 2000' },
    { org_id: ORG_ID, name: 'Farnell', account_number: 'SUP-005', email: 'sales@farnell.com', phone: '0113 263 6311' },
  ]
  const { data: suppliers, error: suppliersErr } = await supabase.from('suppliers').insert(suppliersData).select()
  if (suppliersErr) { console.error('Suppliers error:', suppliersErr); return }
  console.log(`  ✓ ${suppliers.length} suppliers`)

  const supMap = Object.fromEntries(suppliers.map((s: { name: string; id: string }) => [s.name, s.id]))

  // --- Products ---
  const productsData = [
    { org_id: ORG_ID, category_id: catMap['Environmental Sensors'], sku: 'ES-SENTRY-PRO', name: 'EnviroSentry Pro Unit', manufacturer: 'Innov8iv Labs', default_buy_price: 145, default_sell_price: 285, is_serialised: true, is_stocked: true },
    { org_id: ORG_ID, category_id: catMap['Environmental Sensors'], sku: 'ES-SENTRY-EDU', name: 'EnviroSentry SmartClass', manufacturer: 'Innov8iv Labs', default_buy_price: 110, default_sell_price: 220, is_serialised: true, is_stocked: true },
    { org_id: ORG_ID, category_id: catMap['Environmental Sensors'], sku: 'SEN-SEN55', name: 'Sensirion SEN55 Module', manufacturer: 'Sensirion', default_buy_price: 28.5, default_sell_price: null, is_serialised: false, is_stocked: true },
    { org_id: ORG_ID, category_id: catMap['Networking'], sku: 'NET-SW24-POE', name: '24-Port PoE Managed Switch', manufacturer: 'Ubiquiti', default_buy_price: 325, default_sell_price: 445, is_serialised: true, is_stocked: false },
    { org_id: ORG_ID, category_id: catMap['Networking'], sku: 'NET-AP-AC', name: 'WiFi 6 Access Point', manufacturer: 'Ubiquiti', default_buy_price: 129, default_sell_price: 195, is_serialised: true, is_stocked: false },
    { org_id: ORG_ID, category_id: catMap['Cabling & Infrastructure'], sku: 'CAB-CAT6A-305', name: 'Cat6A Cable 305m Box', manufacturer: 'Excel', default_buy_price: 165, default_sell_price: 225, is_serialised: false, is_stocked: true },
    { org_id: ORG_ID, category_id: catMap['Access Control'], sku: 'AC-READER-BLE', name: 'IngressaEdge BLE Reader', manufacturer: 'Innov8iv Labs', default_buy_price: 85, default_sell_price: 165, is_serialised: true, is_stocked: true },
    { org_id: ORG_ID, category_id: catMap['Software & Licensing'], sku: 'SW-HA-PRO', name: 'Home Assistant Pro License', manufacturer: 'Nabu Casa', default_buy_price: 0, default_sell_price: 65, is_serialised: false, is_stocked: false },
    { org_id: ORG_ID, category_id: catMap['Cabling & Infrastructure'], sku: 'CAB-PATCH-1M', name: 'Cat6A Patch Lead 1m', manufacturer: 'Excel', default_buy_price: 2.8, default_sell_price: 5.5, is_serialised: false, is_stocked: true },
    { org_id: ORG_ID, category_id: catMap['Environmental Sensors'], sku: 'ES-HEAD-CO2', name: 'EnviroSentry CO2 Sensor Head', manufacturer: 'Innov8iv Labs', default_buy_price: 42, default_sell_price: 89, is_serialised: false, is_stocked: true },
  ]
  const { data: products, error: productsErr } = await supabase.from('products').insert(productsData).select()
  if (productsErr) { console.error('Products error:', productsErr); return }
  console.log(`  ✓ ${products.length} products`)

  // --- Opportunities ---
  const oppsData = [
    { org_id: ORG_ID, customer_id: coMap['Meridian Academy Trust'], contact_id: ctMap['s.mitchell@meridianmat.ac.uk'], assigned_to: userMap['mark@psdgroup.co.uk'], title: 'SmartClass rollout - 8 schools', stage: 'proposal', estimated_value: 48000, probability: 65, expected_close_date: '2026-03-15', notes: 'Phase 1: 4 schools. Phase 2: remaining 4' },
    { org_id: ORG_ID, customer_id: coMap['Northern Health NHS Trust'], contact_id: ctMap['j.whitworth@northernhealth.nhs.uk'], assigned_to: userMap['rachel@psdgroup.co.uk'], title: 'Ward environmental monitoring', stage: 'prospecting', estimated_value: 22000, probability: 30, expected_close_date: '2026-04-30', notes: 'Pilot ward first, then rollout' },
    { org_id: ORG_ID, customer_id: coMap['Hartwell Commercial Properties'], contact_id: ctMap['e.richardson@hartwellprop.co.uk'], assigned_to: userMap['mark@psdgroup.co.uk'], title: 'Exchange Tower IAQ system', stage: 'proposal', estimated_value: 15500, probability: 80, expected_close_date: '2026-02-28', notes: 'Existing HVAC integration required' },
    { org_id: ORG_ID, customer_id: coMap['Pennine Leisure Group'], contact_id: ctMap['t.bradley@pennineleisure.co.uk'], assigned_to: userMap['jake@psdgroup.co.uk'], title: 'Hotel vape detection system', stage: 'prospecting', estimated_value: 8500, probability: 45, expected_close_date: '2026-05-15', notes: '3 hotels, bedrooms and public areas' },
  ]
  const { data: opps, error: oppsErr } = await supabase.from('opportunities').insert(oppsData).select()
  if (oppsErr) { console.error('Opportunities error:', oppsErr); return }
  console.log(`  ✓ ${opps.length} opportunities`)

  const oppMap = Object.fromEntries(opps.map((o: { title: string; id: string }) => [o.title, o.id]))
  const prodMap = Object.fromEntries(products.map((p: { sku: string; id: string }) => [p.sku, p.id]))

  // --- Quote for Hartwell Exchange Tower ---
  const { data: quote, error: quoteErr } = await supabase.from('quotes').insert({
    org_id: ORG_ID,
    opportunity_id: oppMap['Exchange Tower IAQ system'],
    customer_id: coMap['Hartwell Commercial Properties'],
    contact_id: ctMap['e.richardson@hartwellprop.co.uk'],
    assigned_to: userMap['mark@psdgroup.co.uk'],
    quote_number: 'Q-2026-0001',
    status: 'sent',
    version: 1,
    quote_type: 'business',
    valid_until: '2026-03-15',
    vat_rate: 20,
    customer_notes: 'All equipment installed within 2 weeks of order.',
    sent_at: new Date().toISOString(),
  }).select().single()
  if (quoteErr) { console.error('Quote error:', quoteErr); return }
  console.log('  ✓ 1 quote')

  // Quote groups
  const { data: groups, error: groupsErr } = await supabase.from('quote_groups').insert([
    { quote_id: quote.id, name: 'Monitoring Hardware', sort_order: 0 },
    { quote_id: quote.id, name: 'Network Infrastructure', sort_order: 1 },
    { quote_id: quote.id, name: 'Software', sort_order: 2 },
  ]).select()
  if (groupsErr) { console.error('Groups error:', groupsErr); return }
  console.log(`  ✓ ${groups.length} quote groups`)

  const grpMap = Object.fromEntries(groups.map((g: { name: string; id: string }) => [g.name, g.id]))

  // Quote lines
  const linesData = [
    { quote_id: quote.id, group_id: grpMap['Monitoring Hardware'], product_id: prodMap['ES-SENTRY-PRO'], supplier_id: supMap['RS Components'], sort_order: 0, description: 'EnviroSentry Pro Unit', quantity: 12, buy_price: 145, sell_price: 275, fulfilment_route: 'from_stock' },
    { quote_id: quote.id, group_id: grpMap['Monitoring Hardware'], product_id: prodMap['ES-HEAD-CO2'], supplier_id: supMap['Sensirion AG'], sort_order: 1, description: 'EnviroSentry CO2 Sensor Head', quantity: 12, buy_price: 42, sell_price: 85, fulfilment_route: 'from_stock' },
    { quote_id: quote.id, group_id: grpMap['Network Infrastructure'], product_id: prodMap['NET-SW24-POE'], supplier_id: supMap['Ubiquiti Networks'], sort_order: 0, description: '24-Port PoE Managed Switch', quantity: 2, buy_price: 310, sell_price: 435, fulfilment_route: 'from_stock' },
    { quote_id: quote.id, group_id: grpMap['Network Infrastructure'], product_id: prodMap['CAB-CAT6A-305'], supplier_id: supMap['Excel Networking'], sort_order: 1, description: 'Cat6A Cable 305m Box', quantity: 3, buy_price: 165, sell_price: 225, fulfilment_route: 'from_stock' },
    { quote_id: quote.id, group_id: grpMap['Network Infrastructure'], product_id: prodMap['CAB-PATCH-1M'], supplier_id: supMap['Excel Networking'], sort_order: 2, description: 'Cat6A Patch Lead 1m', quantity: 24, buy_price: 2.8, sell_price: 5.5, fulfilment_route: 'from_stock' },
    { quote_id: quote.id, group_id: grpMap['Software'], product_id: prodMap['SW-HA-PRO'], supplier_id: null, sort_order: 0, description: 'Home Assistant Pro License (Annual)', quantity: 1, buy_price: 0, sell_price: 65, fulfilment_route: 'drop_ship' },
  ]
  const { data: lines, error: linesErr } = await supabase.from('quote_lines').insert(linesData).select()
  if (linesErr) { console.error('Quote lines error:', linesErr); return }
  console.log(`  ✓ ${lines.length} quote lines`)

  // Quote attributions
  const { data: attrs, error: attrsErr } = await supabase.from('quote_attributions').insert([
    { quote_id: quote.id, user_id: userMap['mark@psdgroup.co.uk'], attribution_type: 'direct', split_pct: 80 },
    { quote_id: quote.id, user_id: userMap['rachel@psdgroup.co.uk'], attribution_type: 'involvement', split_pct: 20 },
  ]).select()
  if (attrsErr) { console.error('Attributions error:', attrsErr); return }
  console.log(`  ✓ ${attrs.length} attributions`)

  console.log('\nSeed complete!')
}

seed().catch(console.error)
