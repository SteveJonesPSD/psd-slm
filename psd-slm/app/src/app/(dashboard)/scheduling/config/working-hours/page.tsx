import { requirePermission } from '@/lib/auth'
import { WorkingHoursForm } from './working-hours-form'

export default async function WorkingHoursPage() {
  await requirePermission('scheduling', 'admin')
  return <WorkingHoursForm />
}
