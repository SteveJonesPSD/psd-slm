import { getCustomersForSelect, getBrandsForSelect } from '../actions'
import { ReportsView } from './reports-view'

export default async function ReportsPage() {
  const [customers, brands] = await Promise.all([
    getCustomersForSelect(),
    getBrandsForSelect(),
  ])

  return <ReportsView customers={customers} brands={brands} />
}
