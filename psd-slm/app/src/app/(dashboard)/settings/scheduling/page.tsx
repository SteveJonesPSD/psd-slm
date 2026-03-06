import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSettings } from '../actions'
import { WorkingWeekSettings } from './working-week-settings'

export default async function SchedulingSettingsPage() {
  const user = await requireAuth()
  if (!['super_admin', 'admin'].includes(user.role.name)) redirect('/')

  const result = await getSettings('scheduling')
  const settings = result.data || []

  const workingDaysSetting = settings.find(s => s.setting_key === 'scheduling_working_days')
  let workingDays: number[] = [1, 2, 3, 4, 5] // default Mon-Fri
  if (workingDaysSetting?.setting_value) {
    try {
      workingDays = JSON.parse(workingDaysSetting.setting_value)
    } catch { /* use default */ }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Scheduling</h2>
      <p className="text-sm text-slate-500 mb-8">Configure working week for job and activity scheduling</p>

      <WorkingWeekSettings initialWorkingDays={workingDays} />
    </div>
  )
}
