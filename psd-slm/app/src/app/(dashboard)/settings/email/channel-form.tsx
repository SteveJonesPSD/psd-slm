'use client'

import { useState } from 'react'
import { Input, Select } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { saveMailChannel } from '@/lib/email/actions'
import type { MailChannel } from '@/lib/email/types'

const HANDLER_OPTIONS = [
  { value: 'helpdesk', label: 'Helpdesk' },
  { value: 'purchasing', label: 'Purchasing (coming soon)' },
  { value: 'sales', label: 'Sales (coming soon)' },
]

interface Props {
  channel: MailChannel | null
  connectionId: string
  onClose: () => void
  onSaved: () => void
}

export function ChannelForm({ channel, connectionId, onClose, onSaved }: Props) {
  const [mailboxAddress, setMailboxAddress] = useState(channel?.mailbox_address || '')
  const [handler, setHandler] = useState<string>(channel?.handler || 'helpdesk')
  const [displayName, setDisplayName] = useState(channel?.display_name || '')
  const [pollInterval, setPollInterval] = useState(String(channel?.poll_interval_seconds || 60))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!mailboxAddress) {
      setError('Mailbox address is required')
      return
    }

    setSaving(true)
    setError(null)

    const result = await saveMailChannel(
      {
        connection_id: connectionId,
        mailbox_address: mailboxAddress.toLowerCase().trim(),
        handler: handler as 'helpdesk' | 'purchasing' | 'sales',
        display_name: displayName || undefined,
        poll_interval_seconds: parseInt(pollInterval, 10) || 60,
      },
      channel?.id
    )

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl">
        <div className="border-b border-gray-100 dark:border-slate-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {channel ? 'Edit Channel' : 'Add Mail Channel'}
          </h3>
        </div>

        <div className="space-y-4 p-6">
          <Input
            label="Mailbox Address"
            type="email"
            value={mailboxAddress}
            onChange={setMailboxAddress}
            placeholder="devhelpdesk@psdgroup.co.uk"
          />
          <Select
            label="Handler"
            value={handler}
            onChange={setHandler}
            options={HANDLER_OPTIONS}
          />
          <Input
            label="Display Name (optional)"
            value={displayName}
            onChange={setDisplayName}
            placeholder="Helpdesk Inbox"
          />
          <Input
            label="Poll Interval (seconds)"
            type="number"
            value={pollInterval}
            onChange={setPollInterval}
            placeholder="60"
          />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : channel ? 'Save Changes' : 'Add Channel'}
          </Button>
        </div>
      </div>
    </div>
  )
}
