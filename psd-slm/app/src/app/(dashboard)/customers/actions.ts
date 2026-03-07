'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import {
  encryptContactFields,
  encryptCustomerFields,
} from '@/lib/crypto-helpers'

async function generateAccountNumber(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const prefix = 'ACC-'

  const { data: existing } = await supabase
    .from('customers')
    .select('account_number')
    .eq('org_id', orgId)
    .like('account_number', `${prefix}%`)

  let maxSeq = 0
  if (existing) {
    for (const row of existing) {
      const num = parseInt((row.account_number as string).slice(prefix.length), 10)
      if (!isNaN(num) && num > maxSeq) maxSeq = num
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`
}

export async function createCustomer(formData: FormData) {
  const user = await requirePermission('customers', 'create')
  const supabase = await createClient()

  const accountNumber = await generateAccountNumber(supabase, user.orgId)

  const encryptedCustomer = encryptCustomerFields({
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    address_line1: (formData.get('address_line1') as string) || null,
    address_line2: (formData.get('address_line2') as string) || null,
    postcode: (formData.get('postcode') as string) || null,
  })

  const { data, error } = await supabase
    .from('customers')
    .insert({
      org_id: user.orgId,
      name: formData.get('name') as string,
      customer_type: (formData.get('customer_type') as string) || null,
      dfe_number: (formData.get('dfe_number') as string) || null,
      account_number: accountNumber,
      xero_reference: (formData.get('xero_reference') as string) || null,
      city: (formData.get('city') as string) || null,
      county: (formData.get('county') as string) || null,
      website: (formData.get('website') as string) || null,
      payment_terms: parseInt(formData.get('payment_terms') as string) || 30,
      vat_number: (formData.get('vat_number') as string) || null,
      notes: (formData.get('notes') as string) || null,
      ...encryptedCustomer,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'customer', entityId: data.id, action: 'created', details: { name: data.name } })

  // Create primary contact if provided
  const contactFirstName = (formData.get('contact_first_name') as string)?.trim()
  const contactLastName = (formData.get('contact_last_name') as string)?.trim()
  if (contactFirstName && contactLastName) {
    const contactEmail = (formData.get('contact_email') as string) || null
    const encryptedContact = encryptContactFields({
      email: contactEmail,
      phone: (formData.get('contact_phone') as string) || null,
      mobile: (formData.get('contact_mobile') as string) || null,
    })

    const { data: contactData } = await supabase.from('contacts').insert({
      org_id: user.orgId,
      customer_id: data.id,
      first_name: contactFirstName,
      last_name: contactLastName,
      job_title: (formData.get('contact_job_title') as string) || null,
      is_primary: true,
      is_billing: true,
      ...encryptedContact,
    }).select('id').single()

    if (contactData) {
      // Also insert into junction table
      await supabase.from('contact_customer_links').insert({
        contact_id: contactData.id,
        customer_id: data.id,
        org_id: user.orgId,
        is_primary: true,
      }).select().maybeSingle()

      logActivity({ supabase, user, entityType: 'contact', entityId: contactData.id, action: 'created', details: { customerId: data.id, name: `${contactFirstName} ${contactLastName}` } })
    }
  }

  revalidatePath('/customers')
  return { data }
}

export async function updateCustomer(id: string, formData: FormData) {
  const user = await requirePermission('customers', 'edit_all')
  const supabase = await createClient()

  const encryptedCustomer = encryptCustomerFields({
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    address_line1: (formData.get('address_line1') as string) || null,
    address_line2: (formData.get('address_line2') as string) || null,
    postcode: (formData.get('postcode') as string) || null,
  })

  const { error } = await supabase
    .from('customers')
    .update({
      name: formData.get('name') as string,
      customer_type: (formData.get('customer_type') as string) || null,
      dfe_number: (formData.get('dfe_number') as string) || null,
      account_number: (formData.get('account_number') as string) || null,
      xero_reference: (formData.get('xero_reference') as string) || null,
      city: (formData.get('city') as string) || null,
      county: (formData.get('county') as string) || null,
      website: (formData.get('website') as string) || null,
      payment_terms: parseInt(formData.get('payment_terms') as string) || 30,
      vat_number: (formData.get('vat_number') as string) || null,
      notes: (formData.get('notes') as string) || null,
      ...encryptedCustomer,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'customer', entityId: id, action: 'updated', details: { name: formData.get('name') as string } })

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { success: true }
}

export async function createContact(customerId: string, formData: FormData) {
  const user = await requirePermission('contacts', 'create')
  const supabase = await createClient()

  let isPrimary = formData.get('is_primary') === 'true'
  let isBilling = formData.get('is_billing') === 'true'
  let isShipping = formData.get('is_shipping') === 'true'
  const isPortalUser = formData.get('is_portal_user') === 'true'
  const isPortalAdmin = formData.get('is_portal_admin') === 'true'

  // If this is the first contact for the customer, auto-set primary/billing/shipping
  const { count } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true)

  if (count === 0) {
    isPrimary = true
    isBilling = true
    isShipping = true
  }

  // If setting as primary, unset existing primary contacts for this customer
  if (isPrimary) {
    await supabase
      .from('contacts')
      .update({ is_primary: false })
      .eq('customer_id', customerId)
      .eq('is_primary', true)
  }

  const encryptedFields = encryptContactFields({
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    mobile: (formData.get('mobile') as string) || null,
  })

  const { data, error } = await supabase.from('contacts').insert({
    customer_id: customerId,
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    job_title: (formData.get('job_title') as string) || null,
    is_primary: isPrimary,
    is_billing: isBilling,
    is_shipping: isShipping,
    is_portal_user: isPortalAdmin ? false : isPortalUser,
    is_portal_admin: isPortalAdmin,
    ...encryptedFields,
  }).select('id').single()

  if (error) {
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'contact', entityId: data.id, action: 'created', details: { customerId, name: `${formData.get('first_name')} ${formData.get('last_name')}` } })

  revalidatePath(`/customers/${customerId}`)
  revalidatePath('/customers')
  return { success: true }
}

export async function updateContact(contactId: string, customerId: string, formData: FormData) {
  const user = await requirePermission('contacts', 'edit_all')
  const supabase = await createClient()

  const isPrimary = formData.get('is_primary') === 'true'
  const isBilling = formData.get('is_billing') === 'true'
  const isShipping = formData.get('is_shipping') === 'true'
  const isPortalUser = formData.get('is_portal_user') === 'true'
  const isPortalAdmin = formData.get('is_portal_admin') === 'true'

  if (isPrimary) {
    await supabase
      .from('contacts')
      .update({ is_primary: false })
      .eq('customer_id', customerId)
      .eq('is_primary', true)
  }

  const encryptedFields = encryptContactFields({
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    mobile: (formData.get('mobile') as string) || null,
  })

  const { error } = await supabase
    .from('contacts')
    .update({
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      job_title: (formData.get('job_title') as string) || null,
      is_primary: isPrimary,
      is_billing: isBilling,
      is_shipping: isShipping,
      is_portal_user: isPortalAdmin ? false : isPortalUser,
      is_portal_admin: isPortalAdmin,
      ...encryptedFields,
    })
    .eq('id', contactId)

  if (error) {
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'contact', entityId: contactId, action: 'updated', details: { customerId, name: `${formData.get('first_name')} ${formData.get('last_name')}` } })

  revalidatePath(`/customers/${customerId}`)
  return { success: true }
}

export async function deleteContact(contactId: string, customerId: string) {
  const user = await requirePermission('contacts', 'delete')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)

  if (error) {
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'contact', entityId: contactId, action: 'deleted', details: { customerId } })

  revalidatePath(`/customers/${customerId}`)
  revalidatePath('/customers')
  return { success: true }
}
