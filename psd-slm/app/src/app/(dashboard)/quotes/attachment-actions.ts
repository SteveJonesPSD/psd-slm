'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, requirePermission, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx']

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

// --- Upload ---

export async function uploadQuoteAttachment(quoteId: string, formData: FormData) {
  const user = await requireAuth()
  const canUpload =
    hasPermission(user, 'quotes', 'create') ||
    hasPermission(user, 'quotes', 'edit_all') ||
    hasPermission(user, 'quotes', 'edit_own')
  if (!canUpload) return { error: 'Permission denied' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'No file provided' }

  // Validate file extension
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: 'File type not allowed. Accepted: PDF, images (PNG, JPEG, WebP), Word, Excel.' }
  }

  // Validate MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'File type not allowed. Accepted: PDF, images (PNG, JPEG, WebP), Word, Excel.' }
  }

  if (file.size > MAX_FILE_SIZE) return { error: 'File too large. Maximum size is 20 MB.' }

  const supabase = await createClient()

  // Verify the quote exists
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number')
    .eq('id', quoteId)
    .single()

  if (!quote) return { error: 'Quote not found' }

  // Generate unique storage path
  const storagePath = `${user.orgId}/${quoteId}/${crypto.randomUUID()}.${ext}`

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('quote-attachments')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` }

  // Get label from form if provided
  const label = (formData.get('label') as string) || null

  // Insert database record
  const { data: attachment, error: dbError } = await supabase
    .from('quote_attachments')
    .insert({
      quote_id: quoteId,
      org_id: user.orgId,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
      label,
      source: 'manual',
    })
    .select()
    .single()

  if (dbError) {
    // Roll back: remove the uploaded file
    await supabase.storage.from('quote-attachments').remove([storagePath])
    return { error: dbError.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote_attachment',
    entityId: attachment.id,
    action: 'uploaded',
    details: { quote_id: quoteId, file_name: file.name, file_size: file.size },
  })

  revalidatePath(`/quotes/${quoteId}`)
  return { data: attachment }
}

// --- Delete ---

export async function deleteQuoteAttachment(attachmentId: string) {
  const user = await requireAuth()
  const canDelete =
    hasPermission(user, 'quotes', 'edit_all') ||
    hasPermission(user, 'quotes', 'delete')
  if (!canDelete) return { error: 'Permission denied' }

  const supabase = await createClient()

  const { data: attachment } = await supabase
    .from('quote_attachments')
    .select('id, quote_id, storage_path, file_name')
    .eq('id', attachmentId)
    .single()

  if (!attachment) return { error: 'Attachment not found' }

  // Delete from Storage
  await supabase.storage
    .from('quote-attachments')
    .remove([attachment.storage_path])

  // Delete database record
  const { error: dbError } = await supabase
    .from('quote_attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) return { error: dbError.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote_attachment',
    entityId: attachmentId,
    action: 'deleted',
    details: { quote_id: attachment.quote_id, file_name: attachment.file_name },
  })

  revalidatePath(`/quotes/${attachment.quote_id}`)
  return { success: true }
}

// --- Download (signed URL) ---

export async function getQuoteAttachmentUrl(attachmentId: string) {
  await requirePermission('quotes', 'view')
  const supabase = await createClient()

  const { data: attachment } = await supabase
    .from('quote_attachments')
    .select('storage_path, file_name')
    .eq('id', attachmentId)
    .single()

  if (!attachment) return { error: 'Attachment not found' }

  const { data, error } = await supabase.storage
    .from('quote-attachments')
    .createSignedUrl(attachment.storage_path, 3600, {
      download: attachment.file_name,
    })

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
