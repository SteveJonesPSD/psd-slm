import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (!['super_admin', 'admin'].includes(user.role.name)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const formData = await request.formData()
    const supabase = await createClient()

    // Handle delete-only request
    const deleteOnly = formData.get('delete')
    const oldPath = formData.get('oldPath') as string | null

    if (deleteOnly && oldPath) {
      await deleteOldLogo(supabase, oldPath)
      return NextResponse.json({ success: true })
    }

    // Handle file upload
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use PNG, JPG, or SVG.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 2MB.' }, { status: 400 })
    }

    // Delete old logo if replacing
    if (oldPath) {
      await deleteOldLogo(supabase, oldPath)
    }

    // Generate path
    const brandId = formData.get('brandId') as string || 'new'
    const ext = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const storagePath = `${user.orgId}/${brandId}/logo-${timestamp}.${ext}`

    // Upload
    const { error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(storagePath)

    return NextResponse.json({ url: publicUrl })
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}

async function deleteOldLogo(supabase: Awaited<ReturnType<typeof createClient>>, publicUrl: string) {
  try {
    // Extract storage path from public URL
    const marker = '/storage/v1/object/public/brand-assets/'
    const idx = publicUrl.indexOf(marker)
    if (idx >= 0) {
      const path = publicUrl.substring(idx + marker.length)
      await supabase.storage.from('brand-assets').remove([path])
    }
  } catch {
    // Non-critical — log and continue
    console.error('[upload-logo] Failed to delete old logo')
  }
}
