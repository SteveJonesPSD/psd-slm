'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, requirePermission, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

const ALLOWED_TYPES = [
  'application/pdf',
  'message/rfc822',
  'application/vnd.ms-outlook',
  'application/octet-stream', // .msg files often arrive as this
  'image/png',
  'image/jpeg',
]

const ALLOWED_EXTENSIONS = ['pdf', 'eml', 'msg', 'png', 'jpg', 'jpeg']

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// --- Upload ---

export async function uploadAttachment(dealRegId: string, formData: FormData) {
  const user = await requireAuth()
  const canUpload =
    hasPermission(user, 'deal_registrations', 'create') ||
    hasPermission(user, 'deal_registrations', 'edit_all') ||
    hasPermission(user, 'deal_registrations', 'edit_own')
  if (!canUpload) return { error: 'Permission denied' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'No file provided' }

  // Validate file extension
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: 'File type not allowed. Accepted: PDF, email (.eml, .msg), PNG, JPEG.' }
  }

  // Validate MIME type (allow octet-stream for .msg files)
  if (!ALLOWED_TYPES.includes(file.type) && ext !== 'msg') {
    return { error: 'File type not allowed. Accepted: PDF, email (.eml, .msg), PNG, JPEG.' }
  }

  if (file.size > MAX_FILE_SIZE) return { error: 'File too large. Maximum size is 10 MB.' }

  const supabase = await createClient()

  // Verify the deal reg exists
  const { data: dealReg } = await supabase
    .from('deal_registrations')
    .select('id, title')
    .eq('id', dealRegId)
    .single()

  if (!dealReg) return { error: 'Deal registration not found' }

  // Generate unique storage path
  const storagePath = `${user.orgId}/${dealRegId}/${crypto.randomUUID()}.${ext}`

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('deal-reg-attachments')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` }

  // Insert database record
  const { data: attachment, error: dbError } = await supabase
    .from('deal_registration_attachments')
    .insert({
      deal_reg_id: dealRegId,
      org_id: user.orgId,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      content_type: file.type,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (dbError) {
    // Roll back: remove the uploaded file
    await supabase.storage.from('deal-reg-attachments').remove([storagePath])
    return { error: dbError.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration_attachment',
    entityId: attachment.id,
    action: 'uploaded',
    details: { deal_reg_id: dealRegId, file_name: file.name, file_size: file.size },
  })

  revalidatePath(`/deal-registrations/${dealRegId}`)
  return { data: attachment }
}

// --- Delete ---

export async function deleteAttachment(attachmentId: string) {
  const user = await requireAuth()
  const canDelete =
    hasPermission(user, 'deal_registrations', 'edit_all') ||
    hasPermission(user, 'deal_registrations', 'delete')
  if (!canDelete) return { error: 'Permission denied' }

  const supabase = await createClient()

  const { data: attachment } = await supabase
    .from('deal_registration_attachments')
    .select('id, deal_reg_id, storage_path, file_name')
    .eq('id', attachmentId)
    .single()

  if (!attachment) return { error: 'Attachment not found' }

  // Delete from Storage
  await supabase.storage
    .from('deal-reg-attachments')
    .remove([attachment.storage_path])

  // Delete database record
  const { error: dbError } = await supabase
    .from('deal_registration_attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) return { error: dbError.message }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration_attachment',
    entityId: attachmentId,
    action: 'deleted',
    details: { deal_reg_id: attachment.deal_reg_id, file_name: attachment.file_name },
  })

  revalidatePath(`/deal-registrations/${attachment.deal_reg_id}`)
  return { success: true }
}

// --- Download (signed URL) ---

export async function getAttachmentUrl(attachmentId: string) {
  await requirePermission('deal_registrations', 'view')
  const supabase = await createClient()

  const { data: attachment } = await supabase
    .from('deal_registration_attachments')
    .select('storage_path, file_name')
    .eq('id', attachmentId)
    .single()

  if (!attachment) return { error: 'Attachment not found' }

  const { data, error } = await supabase.storage
    .from('deal-reg-attachments')
    .createSignedUrl(attachment.storage_path, 60, {
      download: attachment.file_name,
    })

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
