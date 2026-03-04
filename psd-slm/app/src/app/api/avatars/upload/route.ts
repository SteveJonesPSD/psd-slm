import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const formData = await request.formData()
    const supabase = await createClient()

    const type = formData.get('type') as string // 'agent' | 'user'
    const targetId = formData.get('targetId') as string

    // Permission checks
    if (type === 'agent') {
      if (!['super_admin', 'admin'].includes(user.role.name)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    } else if (type === 'user') {
      // Users can upload their own avatar, or admin can upload for anyone
      const isSelf = targetId === user.id
      const isAdmin = ['super_admin', 'admin'].includes(user.role.name)
      if (!isSelf && !isAdmin) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Handle delete-only request
    const deleteOnly = formData.get('delete')
    const oldPath = formData.get('oldPath') as string | null

    if (deleteOnly && oldPath) {
      await deleteOldAvatar(supabase, oldPath)
      return NextResponse.json({ success: true })
    }

    // Handle file upload
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use PNG, JPG, or WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 2MB.' }, { status: 400 })
    }

    // Delete old avatar if replacing
    if (oldPath) {
      await deleteOldAvatar(supabase, oldPath)
    }

    // Generate path
    const ext = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const folder = type === 'agent' ? 'agents' : 'users'
    const storagePath = `${user.orgId}/${folder}/${targetId}-${timestamp}.${ext}`

    // Upload
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath)

    return NextResponse.json({ url: publicUrl })
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}

async function deleteOldAvatar(supabase: Awaited<ReturnType<typeof createClient>>, publicUrl: string) {
  try {
    const marker = '/storage/v1/object/public/avatars/'
    const idx = publicUrl.indexOf(marker)
    if (idx >= 0) {
      const path = publicUrl.substring(idx + marker.length)
      await supabase.storage.from('avatars').remove([path])
    }
  } catch {
    console.error('[avatar-upload] Failed to delete old avatar')
  }
}
