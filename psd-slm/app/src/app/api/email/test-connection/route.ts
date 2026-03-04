// =============================================================================
// POST /api/email/test-connection
// Tests Graph API credentials by acquiring a token and listing 1 message.
// Accepts either raw credentials OR a connectionId to read from DB.
// Authenticated: requires admin/super_admin role.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { GraphClient } from '@/lib/email/graph-client'
import type { MailConnection } from '@/lib/email/types'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (!['super_admin', 'admin'].includes(user.role.name)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { tenantId, clientId, clientSecret, connectionId, mailbox } = body

    if (!mailbox) {
      return NextResponse.json({ error: 'mailbox is required' }, { status: 400 })
    }

    let testConnection: MailConnection

    if (connectionId && !clientSecret) {
      // Read real credentials from DB for saved connections
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('mail_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('org_id', user.orgId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      }

      testConnection = {
        ...data,
        // Allow overriding tenant/client ID from form if changed
        tenant_id: tenantId || data.tenant_id,
        client_id: clientId || data.client_id,
      } as MailConnection
    } else {
      // Use raw credentials from form (new connection or new secret entered)
      if (!tenantId || !clientId || !clientSecret) {
        return NextResponse.json(
          { error: 'tenantId, clientId, and clientSecret are required' },
          { status: 400 }
        )
      }

      testConnection = {
        id: 'test',
        org_id: user.orgId,
        name: 'Test',
        provider: 'microsoft_graph',
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        is_active: true,
        last_token_at: null,
        last_error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

    const client = new GraphClient(testConnection)
    const result = await client.testConnection(mailbox)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[email/test-connection]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Test failed' },
      { status: 500 }
    )
  }
}
