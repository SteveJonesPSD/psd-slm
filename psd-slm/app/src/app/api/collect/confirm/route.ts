import { NextResponse } from 'next/server'
import { confirmCollection } from '@/lib/collections/actions'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, confirmedLines, notes, gps, engineerSignature, engineerName, engineerInitials } = body

    if (!token || !confirmedLines || !Array.isArray(confirmedLines)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    if (!engineerName?.trim() || !engineerInitials?.trim()) {
      return NextResponse.json({ error: 'Engineer name and initials are required.' }, { status: 400 })
    }

    if (!engineerSignature) {
      return NextResponse.json({ error: 'Engineer signature is required.' }, { status: 400 })
    }

    // Upload signature to storage
    let signaturePath: string | null = null
    try {
      // Extract base64 data from data URL
      const match = engineerSignature.match(/^data:image\/png;base64,(.+)$/)
      if (match) {
        const buffer = Buffer.from(match[1], 'base64')
        const supabase = createAdminClient()

        // Look up collection ID from token for the storage path
        const { data: col } = await supabase
          .from('job_collections')
          .select('id')
          .eq('slip_token', token)
          .single()

        if (col) {
          const path = `collections/${col.id}/engineer.png`
          const { error: uploadErr } = await supabase.storage
            .from('job-signatures')
            .upload(path, buffer, {
              contentType: 'image/png',
              upsert: true,
            })

          if (!uploadErr) {
            signaturePath = path
          } else {
            console.error('[collect/confirm] Signature upload error:', uploadErr.message)
          }
        }
      }
    } catch (sigErr) {
      // Signature upload is best-effort — don't block confirmation
      console.error('[collect/confirm] Signature processing error:', sigErr)
    }

    const result = await confirmCollection(
      token,
      confirmedLines,
      notes,
      gps,
      {
        signaturePath,
        engineerName: engineerName.trim(),
        engineerInitials: engineerInitials.trim().toUpperCase(),
      }
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, status: result.status })
  } catch (err) {
    console.error('[collect/confirm]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
