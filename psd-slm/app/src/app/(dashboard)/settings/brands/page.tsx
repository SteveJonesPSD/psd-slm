import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { BrandsList } from './brands-list'
import Link from 'next/link'
import type { Brand } from '@/types/database'

export default async function BrandsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: brands } = await supabase
    .from('brands')
    .select('*')
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Trading identities used on quotes and documents"
        actions={
          <Link href="/settings/brands/new">
            <Button size="sm" variant="primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Brand
            </Button>
          </Link>
        }
      />
      <BrandsList brands={(brands || []) as Brand[]} />
    </div>
  )
}
