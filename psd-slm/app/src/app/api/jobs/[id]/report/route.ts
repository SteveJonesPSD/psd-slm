import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { JobReportDocument } from './job-report-document'
import { getJobReportData } from '@/app/(dashboard)/scheduling/actions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await requirePermission('scheduling', 'view')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await getJobReportData(id)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error || 'Job not found' }, { status: 404 })
  }

  const { job, notes, photos, parts, tasks, brand, signatures } = result.data

  const company = job.company as { name: string; address_line1: string | null; address_line2: string | null; city: string | null; county: string | null; postcode: string | null } | null
  const contact = job.contact as { first_name: string; last_name: string; email: string | null; phone: string | null; mobile: string | null; job_title: string | null } | null
  const engineer = job.engineer as { first_name: string; last_name: string } | null
  const validatedBy = job.validated_by_user as { first_name: string; last_name: string } | null
  const jobType = job.job_type as { name: string; color: string } | null

  try {
    const element = React.createElement(JobReportDocument, {
      job: {
        job_number: job.job_number,
        title: job.title,
        description: job.description,
        scheduled_date: job.scheduled_date,
        scheduled_time: job.scheduled_time,
        estimated_duration_minutes: job.estimated_duration_minutes,
        status: job.status,
        priority: job.priority,
        completion_notes: job.completion_notes,
        follow_up_required: job.follow_up_required,
        travel_started_at: job.travel_started_at,
        arrived_at: job.arrived_at,
        completed_at: job.completed_at,
        validated_at: job.validated_at,
        validation_notes: job.validation_notes,
      },
      company,
      contact,
      engineer,
      validatedBy,
      jobType,
      brand,
      notes: notes.map((n: { note: string; created_at: string; user: { first_name: string; last_name: string } | null }) => ({
        note: n.note,
        created_at: n.created_at,
        user: n.user,
      })),
      photos: photos.map((p: { file_name: string; caption: string | null; signedUrl: string | null }) => ({
        file_name: p.file_name,
        caption: p.caption,
        signedUrl: p.signedUrl,
      })),
      parts: parts.map((p: { description: string; quantity: number; serial_numbers: string[] | null; product: { name: string; sku: string | null } | null }) => ({
        description: p.description,
        quantity: p.quantity,
        serial_numbers: p.serial_numbers,
        product: p.product,
      })),
      tasks: (tasks || []).map((t: { description: string; is_required: boolean; is_completed: boolean; completed_at: string | null; notes: string | null; response_type: string; response_value: string | null }) => ({
        description: t.description,
        is_required: t.is_required,
        is_completed: t.is_completed,
        completed_at: t.completed_at,
        notes: t.notes,
        response_type: t.response_type,
        response_value: t.response_value,
      })),
      signatures: signatures || null,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${job.job_number}-report.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[job-report-pdf]', pdfError)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
