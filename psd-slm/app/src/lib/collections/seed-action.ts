'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function seedCollectionData() {
  const user = await requirePermission('collections', 'create')
  const supabase = await createClient()
  const orgId = user.orgId

  // Check if already seeded
  const { count } = await supabase
    .from('job_collections')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (count && count > 0) {
    return { error: 'Collection data already seeded. Delete existing collections first to re-seed.' }
  }

  // ======================================================================
  // 1. FIND A JOB TO ATTACH COLLECTIONS TO
  // ======================================================================
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, title, company_id, assigned_to, sales_order_id')
    .eq('org_id', orgId)
    .in('status', ['scheduled', 'unscheduled', 'on_site', 'travelling'])
    .order('created_at', { ascending: false })
    .limit(5)

  if (!jobs || jobs.length === 0) {
    return { error: 'No active jobs found. Please seed scheduling data first.' }
  }

  // ======================================================================
  // 2. FIND A SALES ORDER (optional link)
  // ======================================================================
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, so_number, customer_id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)

  const salesOrder = salesOrders?.[0] || null

  // ======================================================================
  // 3. FIND PRODUCTS FOR LINE ITEMS
  // ======================================================================
  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name')
    .limit(6)

  if (!products || products.length < 2) {
    return { error: 'Need at least 2 active products. Please seed product data first.' }
  }

  // ======================================================================
  // 4. GENERATE SLIP NUMBERS
  // ======================================================================
  const year = new Date().getFullYear()
  const prefix = `COL-${year}-`

  const { data: existing } = await supabase
    .from('job_collections')
    .select('slip_number')
    .eq('org_id', orgId)
    .like('slip_number', `${prefix}%`)
    .order('slip_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const parts = existing[0].slip_number.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  const slipNumber1 = `${prefix}${String(seq).padStart(4, '0')}`
  const slipNumber2 = `${prefix}${String(seq + 1).padStart(4, '0')}`
  const slipNumber3 = `${prefix}${String(seq + 2).padStart(4, '0')}`

  const token1 = crypto.randomUUID()
  const token2 = crypto.randomUUID()
  const token3 = crypto.randomUUID()

  const job1 = jobs[0]
  const job2 = jobs[1] || jobs[0]
  const job3 = jobs[2] || jobs[0]

  // ======================================================================
  // 5. CREATE 3 COLLECTIONS (pending, collected, partial)
  // ======================================================================

  // Collection 1: PENDING — awaiting engineer pickup
  const { data: col1, error: err1 } = await supabase
    .from('job_collections')
    .insert({
      org_id: orgId,
      job_id: job1.id,
      sales_order_id: salesOrder?.id || null,
      slip_number: slipNumber1,
      slip_token: token1,
      status: 'pending',
      prepared_by: user.id,
      prepared_at: new Date().toISOString(),
      notes: '2 boxes + 1 cable reel. Staged on shelf B3.',
    })
    .select('id')
    .single()

  if (err1 || !col1) {
    return { error: `Failed to create collection 1: ${err1?.message}` }
  }

  // Lines for collection 1
  await supabase.from('job_collection_lines').insert([
    {
      collection_id: col1.id,
      product_id: products[0].id,
      description: products[0].name,
      quantity_expected: 2,
      expected_serials: ['SN-DEMO-001', 'SN-DEMO-002'],
      sort_order: 0,
    },
    {
      collection_id: col1.id,
      product_id: products[1].id,
      description: products[1].name,
      quantity_expected: 5,
      sort_order: 1,
    },
    ...(products[2] ? [{
      collection_id: col1.id,
      product_id: products[2].id,
      description: products[2].name,
      quantity_expected: 1,
      expected_serials: ['SN-DEMO-003'],
      sort_order: 2,
    }] : []),
  ])

  // Collection 2: COLLECTED — fully confirmed
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { data: col2, error: err2 } = await supabase
    .from('job_collections')
    .insert({
      org_id: orgId,
      job_id: job2.id,
      sales_order_id: null,
      slip_number: slipNumber2,
      slip_token: token2,
      status: 'collected',
      prepared_by: user.id,
      prepared_at: new Date(Date.now() - 7200000).toISOString(),
      collected_by: job2.assigned_to || user.id,
      collected_at: oneHourAgo,
      collection_latitude: 53.7997,
      collection_longitude: -1.5492,
      collection_accuracy: 12.5,
      notes: 'All items collected. Box slightly damaged but contents OK.',
    })
    .select('id')
    .single()

  if (err2 || !col2) {
    return { error: `Failed to create collection 2: ${err2?.message}` }
  }

  await supabase.from('job_collection_lines').insert([
    {
      collection_id: col2.id,
      product_id: products[0].id,
      description: products[0].name,
      quantity_expected: 3,
      quantity_confirmed: 3,
      is_confirmed: true,
      confirmed_at: oneHourAgo,
      sort_order: 0,
    },
    {
      collection_id: col2.id,
      product_id: products[1].id,
      description: products[1].name,
      quantity_expected: 1,
      quantity_confirmed: 1,
      expected_serials: ['SN-DEMO-010'],
      confirmed_serials: ['SN-DEMO-010'],
      is_confirmed: true,
      confirmed_at: oneHourAgo,
      sort_order: 1,
    },
  ])

  // Collection 3: PARTIAL — some items confirmed, some missing
  const twoHoursAgo = new Date(Date.now() - 7200000).toISOString()
  const { data: col3, error: err3 } = await supabase
    .from('job_collections')
    .insert({
      org_id: orgId,
      job_id: job3.id,
      sales_order_id: null,
      slip_number: slipNumber3,
      slip_token: token3,
      status: 'partial',
      prepared_by: user.id,
      prepared_at: new Date(Date.now() - 10800000).toISOString(),
      collected_by: job3.assigned_to || user.id,
      collected_at: twoHoursAgo,
      notes: 'Missing 1x switch — not on shelf. Rest collected fine.',
    })
    .select('id')
    .single()

  if (err3 || !col3) {
    return { error: `Failed to create collection 3: ${err3?.message}` }
  }

  await supabase.from('job_collection_lines').insert([
    {
      collection_id: col3.id,
      product_id: products[0].id,
      description: products[0].name,
      quantity_expected: 4,
      quantity_confirmed: 4,
      is_confirmed: true,
      confirmed_at: twoHoursAgo,
      sort_order: 0,
    },
    {
      collection_id: col3.id,
      product_id: products[1].id,
      description: products[1].name,
      quantity_expected: 1,
      quantity_confirmed: 0,
      is_confirmed: false,
      notes: 'Not found on shelf — may not have been picked',
      sort_order: 1,
    },
    ...(products[3] ? [{
      collection_id: col3.id,
      product_id: products[3].id,
      description: products[3].name,
      quantity_expected: 10,
      quantity_confirmed: 10,
      is_confirmed: true,
      confirmed_at: twoHoursAgo,
      sort_order: 2,
    }] : []),
  ])

  // ======================================================================
  // 6. LOG ACTIVITY
  // ======================================================================
  await supabase.from('activity_log').insert([
    { org_id: orgId, user_id: user.id, entity_type: 'job', entity_id: job1.id, action: 'collection.created', details: { collection_id: col1.id, slip_number: slipNumber1 } },
    { org_id: orgId, user_id: user.id, entity_type: 'job', entity_id: job2.id, action: 'collection.created', details: { collection_id: col2.id, slip_number: slipNumber2 } },
    { org_id: orgId, user_id: user.id, entity_type: 'job', entity_id: job2.id, action: 'collection.confirmed', details: { collection_id: col2.id } },
    { org_id: orgId, user_id: user.id, entity_type: 'job', entity_id: job3.id, action: 'collection.created', details: { collection_id: col3.id, slip_number: slipNumber3 } },
    { org_id: orgId, user_id: user.id, entity_type: 'job', entity_id: job3.id, action: 'collection.partial', details: { collection_id: col3.id } },
  ])

  revalidatePath('/collections')
  revalidatePath('/scheduling')
  revalidatePath('/')

  return {
    success: true,
    created: {
      collections: 3,
      lines: 'pending(3 items), collected(2 items), partial(3 items)',
      pendingToken: token1,
    },
    message: `Created 3 collections: ${slipNumber1} (pending — scan QR to test), ${slipNumber2} (collected), ${slipNumber3} (partial)`,
  }
}
