'use client'

import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import type { SupplierIntegration } from '@/types/database'

interface SupplierIntegrationTabProps {
  integration: SupplierIntegration | null
}

const INTEGRATION_TYPE_CONFIG = {
  manual: { label: 'Manual', color: '#6b7280', bg: '#f3f4f6' },
  api: { label: 'API', color: '#2563eb', bg: '#eff6ff' },
  csv_import: { label: 'CSV Import', color: '#d97706', bg: '#fffbeb' },
} as const

export function SupplierIntegrationTab({ integration }: SupplierIntegrationTabProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission('suppliers', 'edit_all')) return null

  const type = integration?.integration_type || 'manual'
  const cfg = INTEGRATION_TYPE_CONFIG[type]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5">
      <h3 className="text-[15px] font-semibold mb-3">Integration</h3>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Type:</span>
        <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
        {integration?.is_active && (
          <Badge label="Active" color="#059669" bg="#ecfdf5" />
        )}
      </div>
      {integration ? (
        <div className="text-sm text-slate-600 space-y-2">
          {integration.api_base_url && (
            <p><span className="text-slate-400">API URL:</span> {integration.api_base_url}</p>
          )}
          {integration.capabilities && (integration.capabilities as string[]).length > 0 && (
            <p><span className="text-slate-400">Capabilities:</span> {(integration.capabilities as string[]).join(', ')}</p>
          )}
          {integration.notes && (
            <p><span className="text-slate-400">Notes:</span> {integration.notes}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          API integration coming soon. This will allow real-time stock and pricing checks.
        </p>
      )}
    </div>
  )
}
