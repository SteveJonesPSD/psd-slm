/**
 * Shared job number generation — used by both scheduling and visit-scheduling actions.
 */

export function formatJobNumber(year: number, seq: number): string {
  return `JOB-${year}-${String(seq).padStart(4, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateJobNumber(supabase: any, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `JOB-${year}-`

  const { data } = await supabase
    .from('jobs')
    .select('job_number')
    .eq('org_id', orgId)
    .like('job_number', `${prefix}%`)
    .order('job_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (data && data.length > 0) {
    const last = data[0].job_number
    const num = parseInt(last.replace(prefix, ''), 10)
    if (!isNaN(num)) seq = num + 1
  }

  return formatJobNumber(year, seq)
}
