'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { changeDealRegStatus, duplicateDealRegistration, renewDealRegistration, deleteDealRegistration } from '../actions'

interface Props {
  dealRegId: string
  status: string
}

export function DealRegActions({ dealRegId, status }: Props) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [loading, setLoading] = useState('')

  const canEdit = hasPermission('deal_registrations', 'edit_all') || hasPermission('deal_registrations', 'edit_own')
  const canCreate = hasPermission('deal_registrations', 'create')
  const canDelete = hasPermission('deal_registrations', 'delete')

  const handleStatusChange = async (newStatus: string) => {
    setLoading(newStatus)
    const result = await changeDealRegStatus(dealRegId, newStatus)
    setLoading('')
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const handleDuplicate = async () => {
    setLoading('duplicate')
    const result = await duplicateDealRegistration(dealRegId)
    setLoading('')
    if (result.error) {
      alert(result.error)
    } else if (result.data) {
      router.push(`/deal-registrations/${result.data.id}`)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this deal registration? This cannot be undone.')) return
    setLoading('delete')
    const result = await deleteDealRegistration(dealRegId)
    setLoading('')
    if (result.error) {
      alert(result.error)
    } else {
      router.push('/deal-registrations')
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <Link href={`/deal-registrations/${dealRegId}/edit`}>
          <Button size="sm">Edit</Button>
        </Link>
      )}

      {canCreate && (
        <Button size="sm" onClick={handleDuplicate} disabled={loading === 'duplicate'}>
          {loading === 'duplicate' ? 'Duplicating...' : 'Duplicate'}
        </Button>
      )}

      {/* Status action buttons */}
      {canEdit && status === 'pending' && (
        <>
          <Button
            size="sm"
            variant="success"
            onClick={() => handleStatusChange('active')}
            disabled={loading === 'active'}
          >
            {loading === 'active' ? 'Activating...' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleStatusChange('rejected')}
            disabled={loading === 'rejected'}
          >
            {loading === 'rejected' ? 'Rejecting...' : 'Reject'}
          </Button>
        </>
      )}

      {canEdit && status === 'active' && (
        <Button
          size="sm"
          onClick={() => handleStatusChange('expired')}
          disabled={loading === 'expired'}
        >
          {loading === 'expired' ? 'Expiring...' : 'Mark Expired'}
        </Button>
      )}

      {canEdit && status === 'expired' && canCreate && (
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            setLoading('renew')
            const result = await renewDealRegistration(dealRegId)
            setLoading('')
            if (result.error) {
              alert(result.error)
            } else if (result.data) {
              router.push(`/deal-registrations/${result.data.id}`)
            }
          }}
          disabled={loading === 'renew'}
        >
          {loading === 'renew' ? 'Renewing...' : 'Renew'}
        </Button>
      )}

      {canDelete && (
        <Button
          size="sm"
          variant="danger"
          onClick={handleDelete}
          disabled={loading === 'delete'}
        >
          {loading === 'delete' ? 'Deleting...' : 'Delete'}
        </Button>
      )}
    </div>
  )
}
