'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import type { ScheduleConflict, SmartScheduleSuggestion, TeamMemberAvailability } from '@/lib/scheduling/conflict'

interface SmartScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  engineerId: string
  engineerName: string
  conflicts: ScheduleConflict[]
  proposedJobAddress: string
  proposedJobDurationMinutes: number
  targetDate: string
  proposedStart: string
  proposedEnd: string
  onApply: (engineerId: string, suggestedStart: string, suggestedEnd: string) => void
}

export function SmartScheduleModal({
  isOpen, onClose, engineerId, engineerName, conflicts,
  proposedJobAddress, proposedJobDurationMinutes, targetDate,
  proposedStart, proposedEnd, onApply,
}: SmartScheduleModalProps) {
  const [loading, setLoading] = useState(true)
  const [primarySuggestion, setPrimarySuggestion] = useState<SmartScheduleSuggestion | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [teamSuggestions, setTeamSuggestions] = useState<TeamMemberAvailability[]>([])
  const [showTeam, setShowTeam] = useState(false)
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamLoaded, setTeamLoaded] = useState(false)
  const [overrideConfirm, setOverrideConfirm] = useState<string | null>(null)

  // Find the latest-ending conflict to use as the anchor
  const latestConflict = conflicts.reduce<ScheduleConflict | null>((latest, c) => {
    const end = 'conflictingEnd' in c ? c.conflictingEnd : ''
    const latestEnd = latest && 'conflictingEnd' in latest ? latest.conflictingEnd : ''
    return !latest || end > latestEnd ? c : latest
  }, null)

  const conflictEnd = latestConflict && 'conflictingEnd' in latestConflict ? latestConflict.conflictingEnd : proposedEnd
  const conflictAddress = latestConflict && 'address' in latestConflict ? (latestConflict as any).address : null

  const fetchPrimary = useCallback(async () => {
    setLoading(true)
    try {
      const payload = {
        engineerId,
        conflictEnd,
        conflictAddress,
        proposedJobAddress,
        proposedJobDurationMinutes,
        targetDate,
        includeTeam: false,
      }
      console.log('[smart-schedule-modal] Request:', JSON.stringify(payload))
      const res = await fetch('/api/scheduling/smart-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      console.log('[smart-schedule-modal] Response:', JSON.stringify(data))
      if (data.error) {
        console.error('[smart-schedule-modal] API error:', data.error)
        setApiError(data.error)
      } else {
        setApiError(null)
      }
      setPrimarySuggestion(data.primarySuggestion || null)
    } catch (err) {
      console.error('[smart-schedule-modal] Fetch error:', err)
      setApiError(String(err))
      setPrimarySuggestion(null)
    } finally {
      setLoading(false)
    }
  }, [engineerId, conflictEnd, conflictAddress, proposedJobAddress, proposedJobDurationMinutes, targetDate])

  useEffect(() => {
    if (isOpen) {
      fetchPrimary()
      setShowTeam(false)
      setTeamLoaded(false)
      setTeamSuggestions([])
      setOverrideConfirm(null)
    }
  }, [isOpen, fetchPrimary])

  async function fetchTeam() {
    if (teamLoaded) {
      setShowTeam(true)
      return
    }
    setTeamLoading(true)
    setShowTeam(true)
    try {
      const res = await fetch('/api/scheduling/smart-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerId,
          conflictEnd,
          conflictAddress,
          proposedJobAddress,
          proposedJobDurationMinutes,
          targetDate,
          includeTeam: true,
          proposedStart,
          proposedEnd,
        }),
      })
      const data = await res.json()
      setTeamSuggestions(data.teamSuggestions || [])
      setTeamLoaded(true)
    } catch {
      setTeamSuggestions([])
    } finally {
      setTeamLoading(false)
    }
  }

  function handleApply(engId: string, start: string | null, end: string | null) {
    if (!start || !end) return
    onApply(engId, start, end)
    onClose()
  }

  function handleOverrideApply(engId: string, start: string | null, end: string | null) {
    if (overrideConfirm === engId) {
      handleApply(engId, start, end)
    } else {
      setOverrideConfirm(engId)
    }
  }

  if (!isOpen) return null

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  function getSuggestionIcon(reason: string) {
    switch (reason) {
      case 'ok': return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">&#10003;</span>
      case 'end_overruns_eod': return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs">!</span>
      case 'after_eod': return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">&#10007;</span>
      case 'no_route': return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs">?</span>
      default: return null
    }
  }

  function getDotColor(reason: string) {
    switch (reason) {
      case 'ok': return 'bg-green-400'
      case 'end_overruns_eod': return 'bg-amber-400'
      case 'after_eod': return 'bg-red-400'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Smart Schedule</h2>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              Smart
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Primary Engineer Suggestion */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Suggested Time for {engineerName}
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                <span className="ml-3 text-sm text-slate-500">Calculating travel time...</span>
              </div>
            ) : primarySuggestion ? (
              <div className={`rounded-lg border p-4 ${
                primarySuggestion.reason === 'ok' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
                primarySuggestion.reason === 'end_overruns_eod' || primarySuggestion.reason === 'no_route' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' :
                'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              }`}>
                <div className="flex items-start gap-3">
                  {getSuggestionIcon(primarySuggestion.reason)}
                  <div className="flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{primarySuggestion.reasonDetail}</p>
                    {primarySuggestion.suggestedStart && (
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        Suggested start: {formatTime(primarySuggestion.suggestedStart)}
                        {primarySuggestion.suggestedEnd && ` - ${formatTime(primarySuggestion.suggestedEnd)}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  {primarySuggestion.reason === 'ok' || primarySuggestion.reason === 'no_route' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApply(engineerId, primarySuggestion.suggestedStart, primarySuggestion.suggestedEnd)}
                    >
                      Use This Time
                    </Button>
                  ) : primarySuggestion.reason === 'end_overruns_eod' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApply(engineerId, primarySuggestion.suggestedStart, primarySuggestion.suggestedEnd)}
                    >
                      Use This Time Anyway
                    </Button>
                  ) : (
                    <>
                      {overrideConfirm === engineerId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 dark:text-red-400">This is outside working hours. Confirm?</span>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleApply(engineerId, primarySuggestion.suggestedStart, primarySuggestion.suggestedEnd)}
                          >
                            Confirm Override
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setOverrideConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleOverrideApply(engineerId, primarySuggestion.suggestedStart, primarySuggestion.suggestedEnd)}
                        >
                          Override & Use This Time
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Could not calculate a suggestion. Please schedule manually.
                {apiError && <div className="mt-2 text-xs text-red-500">Error: {apiError}</div>}
              </div>
            )}
          </div>

          {/* Section 2: Team Availability */}
          <div>
            {!showTeam ? (
              <button
                type="button"
                onClick={fetchTeam}
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Check other engineers
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Other Engineers Available {targetDate}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowTeam(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Hide
                  </button>
                </div>

                {teamLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                    <span className="ml-3 text-sm text-slate-500">Checking team availability...</span>
                  </div>
                ) : teamSuggestions.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    No other engineers available for this date.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamSuggestions.map(tm => (
                      <div
                        key={tm.engineerId}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            tm.suggestion ? getDotColor(tm.suggestion.reason) : 'bg-gray-400'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{tm.engineerName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {!tm.hasConflict
                                ? 'No conflicts today'
                                : tm.suggestion?.reasonDetail || 'Has conflicts'}
                            </p>
                            {tm.suggestion?.suggestedStart && (
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                Suggested: {formatTime(tm.suggestion.suggestedStart)}
                                {tm.suggestion.suggestedEnd && ` - ${formatTime(tm.suggestion.suggestedEnd)}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-3">
                          {tm.suggestion?.reason === 'after_eod' ? (
                            overrideConfirm === tm.engineerId ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleApply(tm.engineerId, tm.suggestion!.suggestedStart, tm.suggestion!.suggestedEnd)}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => setOverrideConfirm(null)}
                                >
                                  No
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleOverrideApply(tm.engineerId, tm.suggestion!.suggestedStart, tm.suggestion!.suggestedEnd)}
                              >
                                Assign Anyway
                              </Button>
                            )
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApply(tm.engineerId, tm.suggestion?.suggestedStart || null, tm.suggestion?.suggestedEnd || null)}
                              disabled={!tm.suggestion?.suggestedStart}
                            >
                              Assign
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-slate-700">
          <div className="flex justify-end">
            <Button variant="default" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
