'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Customer {
  id: string
  name: string
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  is_primary: boolean
  job_title: string | null
}

export function PortalPreviewClient() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string>('')
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced customer search
  useEffect(() => {
    if (search.length < 2) {
      setCustomers([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(search)}`)
        if (res.ok) {
          const data = await res.json()
          setCustomers(data.customers || [])
        }
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Load contacts when customer is selected
  useEffect(() => {
    if (!selectedCustomer) return
    setLoadingContacts(true)
    setContacts([])
    setSelectedContactId('')
    setError(null)

    fetch(`/api/customers/${selectedCustomer.id}/contacts`)
      .then((res) => res.json())
      .then((data) => {
        const list: Contact[] = data.contacts || []
        setContacts(list)
        // Default to primary contact
        const primary = list.find((c) => c.is_primary)
        if (primary) {
          setSelectedContactId(primary.id)
        } else if (list.length > 0) {
          setSelectedContactId(list[0].id)
        }
        if (list.length === 0) {
          setError('No contacts found for this customer.')
        }
      })
      .catch(() => setError('Failed to load contacts'))
      .finally(() => setLoadingContacts(false))
  }, [selectedCustomer])

  function handleSelectCustomer(customer: Customer) {
    setSelectedCustomer(customer)
    setSearch('')
    setCustomers([])
  }

  async function handleLaunch() {
    if (!selectedCustomer || !selectedContactId) return
    setLaunching(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          contactId: selectedContactId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create impersonation session')
        return
      }

      // Set the portal_sid cookie and open in new tab
      document.cookie = `portal_sid=${data.token}; path=/portal; max-age=3600; samesite=lax`
      window.open('/portal/dashboard', '_blank')
    } catch {
      setError('Failed to launch portal')
    } finally {
      setLaunching(false)
    }
  }

  const selectedContact = contacts.find((c) => c.id === selectedContactId)

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Step 1: Select customer */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-8">
        <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold">1</span>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Select Customer</h2>
          </div>
        </div>
        <div className="p-5">
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-sm font-semibold">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedCustomer.name}</span>
              </div>
              <Button size="sm" onClick={() => { setSelectedCustomer(null); setContacts([]); setSelectedContactId(''); setError(null) }}>
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
              {customers.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg max-h-60 overflow-y-auto">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Select contact */}
      {selectedCustomer && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-8">
          <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold">2</span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Select Contact</h2>
            </div>
          </div>
          <div className="p-5">
            {loadingContacts ? (
              <div className="text-center text-sm text-slate-400 py-4">Loading contacts...</div>
            ) : contacts.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-4">No contacts found</div>
            ) : (
              <div>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.is_primary ? ' (Primary)' : ''}
                      {c.email ? ` — ${c.email}` : ''}
                      {c.job_title ? ` · ${c.job_title}` : ''}
                    </option>
                  ))}
                </select>

                {selectedContact && (
                  <div className="mt-4 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {selectedContact.first_name} {selectedContact.last_name}
                      {selectedContact.is_primary && (
                        <span className="ml-2 inline-block rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[11px] font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                    {selectedContact.job_title && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedContact.job_title}</div>
                    )}
                    {selectedContact.email && (
                      <div className="text-xs text-slate-400 mt-0.5">{selectedContact.email}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Launch button */}
      {selectedCustomer && selectedContactId && (
        <div className="mb-8">
          <Button
            size="sm"
            variant="primary"
            onClick={handleLaunch}
            disabled={launching}
          >
            {launching ? 'Launching...' : 'Launch Portal Preview'}
          </Button>
        </div>
      )}

      {/* Info note */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <strong>Note:</strong> The portal will open in a new tab with a 1-hour impersonation session.
        An amber banner will be visible at the top to indicate you are previewing as this customer.
        If the contact doesn&apos;t have portal access yet, it will be granted automatically.
      </div>
    </div>
  )
}
