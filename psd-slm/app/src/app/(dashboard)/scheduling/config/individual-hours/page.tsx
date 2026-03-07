import { requirePermission } from '@/lib/auth'
import { getEngineers, getAllUserWorkingHours, getSchedulingSettings, getWorkingDays } from '../../actions'
import { IndividualHoursManager } from './individual-hours-manager'

export default async function IndividualHoursPage() {
  await requirePermission('scheduling', 'admin')

  const [engineersResult, hoursResult, orgSettings, orgWorkingDays] = await Promise.all([
    getEngineers(),
    getAllUserWorkingHours(),
    getSchedulingSettings(),
    getWorkingDays(),
  ])

  return (
    <IndividualHoursManager
      engineers={engineersResult.data || []}
      allUserHours={hoursResult.data || []}
      orgDefaults={{
        startTime: orgSettings.working_day_start,
        endTime: orgSettings.working_day_end,
        workingDays: orgWorkingDays,
      }}
    />
  )
}
