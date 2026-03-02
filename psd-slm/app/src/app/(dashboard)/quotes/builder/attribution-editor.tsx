'use client'

import type { QuoteAction, FormAttribution, UserLookup } from './quote-builder-types'
import { Button } from '@/components/ui/button'

interface AttributionEditorProps {
  attributions: FormAttribution[]
  dispatch: React.Dispatch<QuoteAction>
  users: UserLookup[]
}

export function AttributionEditor({ attributions, dispatch, users }: AttributionEditorProps) {
  const total = attributions.reduce((sum, a) => sum + a.split_pct, 0)
  const isValid = Math.abs(total - 100) < 0.01

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-4">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-[15px] font-semibold text-slate-900">Sales Attribution</h3>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${isValid ? 'text-emerald-600' : 'text-red-600'}`}>
            Total: {total.toFixed(1)}%
          </span>
          <Button
            size="sm"
            variant="default"
            onClick={() => dispatch({ type: 'ADD_ATTRIBUTION' })}
          >
            + Add
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">User</th>
              <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Type</th>
              <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-28">Split %</th>
              <th className="px-5 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {attributions.map((attr) => {
              const bgClass =
                attr.attribution_type === 'direct'
                  ? 'bg-emerald-50/50'
                  : attr.attribution_type === 'override'
                  ? 'bg-amber-50/50'
                  : ''

              return (
                <tr key={attr.tempId} className={`border-t border-gray-100 ${bgClass}`}>
                  <td className="px-5 py-2">
                    <select
                      value={attr.user_id}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ATTRIBUTION',
                          tempId: attr.tempId,
                          updates: { user_id: e.target.value },
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="">Select user...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-2">
                    <select
                      value={attr.attribution_type}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ATTRIBUTION',
                          tempId: attr.tempId,
                          updates: { attribution_type: e.target.value as 'direct' | 'involvement' | 'override' },
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="direct">Direct</option>
                      <option value="involvement">Involvement</option>
                      <option value="override">Override</option>
                    </select>
                  </td>
                  <td className="px-5 py-2">
                    <input
                      type="number"
                      value={attr.split_pct}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ATTRIBUTION',
                          tempId: attr.tempId,
                          updates: { split_pct: parseFloat(e.target.value) || 0 },
                        })
                      }
                      min={0}
                      max={100}
                      step={5}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-slate-400"
                    />
                  </td>
                  <td className="px-5 py-2">
                    {attributions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'REMOVE_ATTRIBUTION', tempId: attr.tempId })}
                        className="text-slate-400 hover:text-red-500 text-sm"
                        title="Remove"
                      >
                        &times;
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
