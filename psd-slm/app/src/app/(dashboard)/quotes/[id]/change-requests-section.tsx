'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { resolveChangeRequest } from '../actions'

interface ChangeRequest {
  id: string
  requested_by: string
  request_type: string
  message: string
  status: string
  internal_notes: string | null
  resolved_at: string | null
  created_at: string
  resolved_user: { first_name: string; last_name: string } | null
}

interface ChangeRequestsSectionProps {
  requests: ChangeRequest[]
}

export function ChangeRequestsSection({ requests }: ChangeRequestsSectionProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const handleResolve = async (requestId: string) => {
    const result = await resolveChangeRequest(requestId, notes || null)
    if ('error' in result && result.error) {
      alert(result.error)
    }
    setResolvingId(null)
    setNotes('')
  }

  const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
    pricing: { label: 'Pricing', color: '#d97706', bg: '#fffbeb' },
    specification: { label: 'Specification', color: '#2563eb', bg: '#eff6ff' },
    quantity: { label: 'Quantity', color: '#7c3aed', bg: '#f5f3ff' },
    general: { label: 'General', color: '#6b7280', bg: '#f3f4f6' },
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <h3 className="text-[15px] font-semibold mb-3">
        Change Requests ({requests.length})
      </h3>

      <div className="space-y-3">
        {requests.map((req) => {
          const tc = typeConfig[req.request_type] || typeConfig.general

          return (
            <div key={req.id} className="border border-slate-100 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge label={tc.label} color={tc.color} bg={tc.bg} />
                  <Badge
                    label={req.status === 'pending' ? 'Pending' : 'Resolved'}
                    color={req.status === 'pending' ? '#d97706' : '#059669'}
                    bg={req.status === 'pending' ? '#fffbeb' : '#ecfdf5'}
                  />
                  <span className="text-xs text-slate-400">from {req.requested_by}</span>
                </div>
                <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
              </div>

              <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{req.message}</p>

              {req.internal_notes && (
                <div className="bg-amber-50 rounded p-2 text-xs text-amber-800 mb-2">
                  <strong>Internal notes:</strong> {req.internal_notes}
                </div>
              )}

              {req.resolved_at && req.resolved_user && (
                <div className="text-xs text-slate-400">
                  Resolved by {req.resolved_user.first_name} {req.resolved_user.last_name} on {formatDate(req.resolved_at)}
                </div>
              )}

              {req.status === 'pending' && (
                <div className="mt-2">
                  {resolvingId === req.id ? (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 mb-1 block">Resolution notes (optional)</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400 resize-none"
                        />
                      </div>
                      <Button size="sm" variant="success" onClick={() => handleResolve(req.id)}>
                        Resolve
                      </Button>
                      <Button size="sm" variant="default" onClick={() => setResolvingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="default" onClick={() => setResolvingId(req.id)}>
                      Resolve
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
