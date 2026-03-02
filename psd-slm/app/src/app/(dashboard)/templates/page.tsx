import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { TemplatesTable } from './templates-table'
import { TemplatesPageActions } from './templates-page-actions'

export default async function TemplatesPage() {
  await requirePermission('templates', 'view')
  const supabase = await createClient()

  const { data: templates } = await supabase
    .from('quote_templates')
    .select(`
      *,
      users:created_by(id, first_name, last_name, initials, color),
      quote_template_groups(id),
      quote_template_lines(id)
    `)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="Quote Templates"
        subtitle={`${templates?.length || 0} templates`}
        actions={<TemplatesPageActions />}
      />
      <TemplatesTable templates={templates || []} />
    </div>
  )
}
