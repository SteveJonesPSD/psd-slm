import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 70,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  // --- Header ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  logo: {
    marginBottom: 8,
    objectFit: 'contain',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 3,
  },
  brandInfo: {
    textAlign: 'right',
    fontSize: 8,
    color: '#64748b',
    marginTop: 1,
  },
  brandName: {
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#1e293b',
    marginTop: 8,
  },
  // --- Info grid ---
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  infoBox: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  infoDetail: {
    fontSize: 9,
    color: '#64748b',
    lineHeight: 1.4,
  },
  // --- Section ---
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  // --- Status badge ---
  statusBadge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    backgroundColor: '#059669',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  // --- Timeline ---
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  timelineLabel: {
    width: 120,
    fontSize: 9,
    color: '#64748b',
  },
  timelineValue: {
    flex: 1,
    fontSize: 9,
    color: '#1e293b',
  },
  // --- Notes ---
  noteItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 3,
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
  },
  noteAuthor: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  noteTime: {
    fontSize: 7,
    color: '#94a3b8',
    marginLeft: 6,
  },
  noteText: {
    fontSize: 9,
    color: '#1e293b',
    marginTop: 3,
    lineHeight: 1.4,
  },
  // --- Completion ---
  completionBox: {
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 16,
  },
  completionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  completionText: {
    fontSize: 9,
    color: '#166534',
    lineHeight: 1.5,
  },
  followUpBox: {
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 16,
  },
  followUpText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#92400e',
  },
  // --- Parts table ---
  partsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  partsHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  partsRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  partsColName: { flex: 3, paddingRight: 8 },
  partsColQty: { width: 40, textAlign: 'right' },
  partsColSerial: { flex: 2, paddingLeft: 8 },
  // --- Photos ---
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoContainer: {
    width: 160,
    height: 120,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoCaption: {
    fontSize: 7,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
    width: 160,
  },
  // --- Validation ---
  validationBox: {
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  validationLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  validationText: {
    fontSize: 9,
    color: '#1e40af',
    lineHeight: 1.4,
  },
  // --- Signatures ---
  signaturesGrid: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  signatureBox: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  signatureLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 6,
  },
  signatureImage: {
    width: 180,
    height: 60,
    objectFit: 'contain',
  },
  customerNotPresent: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  customerNotPresentText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#92400e',
  },
  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface JobReportProps {
  job: {
    job_number: string
    title: string
    description: string | null
    scheduled_date: string | null
    scheduled_time: string | null
    estimated_duration_minutes: number
    status: string
    priority: string
    completion_notes: string | null
    follow_up_required: boolean
    travel_started_at: string | null
    arrived_at: string | null
    completed_at: string | null
    validated_at: string | null
    validation_notes: string | null
  }
  company: {
    name: string
    address_line1: string | null
    address_line2: string | null
    city: string | null
    county: string | null
    postcode: string | null
  } | null
  contact: {
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    mobile: string | null
    job_title: string | null
  } | null
  engineer: {
    first_name: string
    last_name: string
  } | null
  validatedBy: {
    first_name: string
    last_name: string
  } | null
  jobType: {
    name: string
    color: string
  } | null
  brand: {
    name: string
    legal_entity: string | null
    logo_path: string | null
    logo_width: number
    phone: string | null
    fax: string | null
    email: string | null
    website: string | null
    footer_text: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    county: string | null
    postcode: string | null
    company_reg_number: string | null
    vat_number: string | null
  } | null
  notes: {
    note: string
    created_at: string
    user: { first_name: string; last_name: string } | null
  }[]
  photos: {
    file_name: string
    caption: string | null
    signedUrl: string | null
  }[]
  parts: {
    description: string
    quantity: number
    serial_numbers: string[] | null
    product: { name: string; sku: string | null } | null
  }[]
  tasks?: {
    description: string
    is_required: boolean
    is_completed: boolean
    completed_at: string | null
    notes: string | null
    response_type: string
    response_value: string | null
  }[]
  signatures?: {
    engineerSignatureUrl: string | null
    engineerSignatureName: string | null
    customerSignatureUrl: string | null
    customerSignatureName: string | null
    customerNotPresent: boolean
  } | null
}

export function JobReportDocument({ job, company, contact, engineer, validatedBy, jobType, brand, notes, photos, parts, tasks, signatures }: JobReportProps) {
  const brandAddressLines = brand
    ? [brand.address_line1, brand.address_line2, [brand.city, brand.county, brand.postcode].filter(Boolean).join(', ')].filter(Boolean)
    : []

  const logoWidth = brand?.logo_width ? Math.min(brand.logo_width, 200) : 160

  const siteAddress = company
    ? [company.address_line1, company.address_line2, company.city, company.county, company.postcode].filter(Boolean).join(', ')
    : null

  const durationH = Math.floor(job.estimated_duration_minutes / 60)
  const durationM = job.estimated_duration_minutes % 60
  const durationStr = durationH > 0 ? `${durationH}h${durationM > 0 ? ` ${durationM}m` : ''}` : `${durationM}m`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header: Logo / JOB REPORT title */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {brand?.logo_path && (
              <Image src={brand.logo_path} style={[styles.logo, { width: logoWidth }]} />
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>JOB REPORT</Text>
            <Text style={styles.subtitle}>{job.job_number}</Text>
            <Text style={styles.subtitle}>{job.title}</Text>
            <Text style={styles.brandName}>{brand?.name || 'PSD Group'}</Text>
            {brand?.legal_entity && <Text style={styles.brandInfo}>{brand.legal_entity}</Text>}
            {brandAddressLines.map((line, i) => (
              <Text key={i} style={styles.brandInfo}>{line}</Text>
            ))}
            {brand?.phone && <Text style={styles.brandInfo}>Tel: {brand.phone}</Text>}
            {brand?.email && <Text style={styles.brandInfo}>{brand.email}</Text>}
          </View>
        </View>

        {/* Info Grid: Customer / Site / Schedule / Engineer */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Customer</Text>
            {company && <Text style={styles.infoValue}>{company.name}</Text>}
            {contact && (
              <Text style={styles.infoDetail}>
                {contact.first_name} {contact.last_name}
                {contact.job_title ? ` — ${contact.job_title}` : ''}
              </Text>
            )}
            {(contact?.phone || contact?.mobile) && (
              <Text style={styles.infoDetail}>{contact.mobile || contact.phone}</Text>
            )}
            {contact?.email && (
              <Text style={styles.infoDetail}>{contact.email}</Text>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Site Address</Text>
            {siteAddress ? (
              <Text style={styles.infoDetail}>{siteAddress}</Text>
            ) : (
              <Text style={styles.infoDetail}>—</Text>
            )}
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Schedule</Text>
            <Text style={styles.infoValue}>{formatDate(job.scheduled_date)}</Text>
            {job.scheduled_time && (
              <Text style={styles.infoDetail}>Start: {job.scheduled_time.substring(0, 5)}</Text>
            )}
            <Text style={styles.infoDetail}>Duration: {durationStr}</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Engineer</Text>
            {engineer ? (
              <Text style={styles.infoValue}>{engineer.first_name} {engineer.last_name}</Text>
            ) : (
              <Text style={styles.infoDetail}>Unassigned</Text>
            )}
            {jobType && (
              <Text style={styles.infoDetail}>Type: {jobType.name}</Text>
            )}
            <Text style={styles.infoDetail}>Priority: {job.priority}</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {job.travel_started_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Travel Started</Text>
              <Text style={styles.timelineValue}>{formatDateTime(job.travel_started_at)}</Text>
            </View>
          )}
          {job.arrived_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Arrived on Site</Text>
              <Text style={styles.timelineValue}>{formatDateTime(job.arrived_at)}</Text>
            </View>
          )}
          {job.completed_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Completed</Text>
              <Text style={styles.timelineValue}>{formatDateTime(job.completed_at)}</Text>
            </View>
          )}
          {job.validated_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Validated</Text>
              <Text style={styles.timelineValue}>
                {formatDateTime(job.validated_at)}
                {validatedBy ? ` by ${validatedBy.first_name} ${validatedBy.last_name}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        {job.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Description</Text>
            <Text style={{ fontSize: 9, color: '#475569', lineHeight: 1.5 }}>{job.description}</Text>
          </View>
        )}

        {/* Task Checklist */}
        {tasks && tasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Task Checklist ({tasks.filter(t => t.is_completed).length}/{tasks.length})
            </Text>
            <View style={styles.partsHeader}>
              <Text style={[styles.partsHeaderText, { flex: 3, paddingRight: 8 }]}>Task</Text>
              <Text style={[styles.partsHeaderText, { width: 50, textAlign: 'center' }]}>Required</Text>
              <Text style={[styles.partsHeaderText, { width: 60, textAlign: 'center' }]}>Status</Text>
              <Text style={[styles.partsHeaderText, { flex: 2, paddingLeft: 8 }]}>Response</Text>
            </View>
            {tasks.map((task, i) => (
              <View key={i} style={styles.partsRow}>
                <Text style={[{ fontSize: 9, flex: 3, paddingRight: 8 }, task.is_completed ? { color: '#94a3b8' } : { color: '#1e293b' }]}>
                  {task.description}
                </Text>
                <Text style={{ fontSize: 9, width: 50, textAlign: 'center', color: task.is_required ? '#d97706' : '#94a3b8' }}>
                  {task.is_required ? 'Yes' : 'No'}
                </Text>
                <Text style={{ fontSize: 9, width: 60, textAlign: 'center', color: task.is_completed ? '#059669' : '#dc2626' }}>
                  {task.is_completed ? 'Yes' : 'No'}
                </Text>
                <Text style={{ fontSize: 8, flex: 2, paddingLeft: 8, color: '#64748b' }}>
                  {task.response_type === 'yes_no'
                    ? (task.notes || '—')
                    : (task.response_value || task.notes || '—')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Completion Notes */}
        {job.completion_notes && (
          <View style={styles.completionBox}>
            <Text style={styles.completionLabel}>Completion Notes</Text>
            <Text style={styles.completionText}>{job.completion_notes}</Text>
          </View>
        )}

        {/* Follow-up Required */}
        {job.follow_up_required && (
          <View style={styles.followUpBox}>
            <Text style={styles.followUpText}>Follow-up Required</Text>
          </View>
        )}

        {/* Validation Notes */}
        {job.validation_notes && (
          <View style={styles.validationBox}>
            <Text style={styles.validationLabel}>Validation Notes</Text>
            <Text style={styles.validationText}>{job.validation_notes}</Text>
          </View>
        )}

        {/* Parts Used */}
        {parts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parts / Materials</Text>
            <View style={styles.partsHeader}>
              <Text style={[styles.partsHeaderText, styles.partsColName]}>Item</Text>
              <Text style={[styles.partsHeaderText, styles.partsColQty]}>Qty</Text>
              <Text style={[styles.partsHeaderText, styles.partsColSerial]}>Serial Numbers</Text>
            </View>
            {parts.map((part, i) => (
              <View key={i} style={styles.partsRow}>
                <View style={styles.partsColName}>
                  <Text style={{ fontSize: 9 }}>{part.product?.name || part.description}</Text>
                  {part.product?.sku && <Text style={{ fontSize: 7, color: '#94a3b8' }}>{part.product.sku}</Text>}
                </View>
                <Text style={[{ fontSize: 9 }, styles.partsColQty]}>{part.quantity}</Text>
                <Text style={[{ fontSize: 8, color: '#64748b' }, styles.partsColSerial]}>
                  {part.serial_numbers?.join(', ') || '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Engineer Notes */}
        {notes.length > 0 && (
          <View style={styles.section} break={notes.length > 5}>
            <Text style={styles.sectionTitle}>Engineer Notes ({notes.length})</Text>
            {notes.map((n, i) => (
              <View key={i} style={styles.noteItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.noteAuthor}>
                    {n.user ? `${n.user.first_name} ${n.user.last_name}` : 'Unknown'}
                  </Text>
                  <Text style={styles.noteTime}>{formatDateTime(n.created_at)}</Text>
                </View>
                <Text style={styles.noteText}>{n.note}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Photos */}
        {photos.filter(p => p.signedUrl).length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Photos ({photos.filter(p => p.signedUrl).length})</Text>
            <View style={styles.photosGrid}>
              {photos.filter(p => p.signedUrl).map((photo, i) => (
                <View key={i}>
                  <View style={styles.photoContainer}>
                    <Image src={photo.signedUrl!} style={styles.photoImage} />
                  </View>
                  {photo.caption && <Text style={styles.photoCaption}>{photo.caption}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Signatures */}
        {signatures && (signatures.engineerSignatureUrl || signatures.customerSignatureUrl || signatures.customerNotPresent) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signatures</Text>
            <View style={styles.signaturesGrid}>
              {signatures.engineerSignatureUrl && (
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Engineer</Text>
                  <Text style={styles.signatureName}>{signatures.engineerSignatureName || '—'}</Text>
                  <Image src={signatures.engineerSignatureUrl} style={styles.signatureImage} />
                </View>
              )}
              {signatures.customerNotPresent ? (
                <View style={styles.customerNotPresent}>
                  <Text style={styles.signatureLabel}>Customer</Text>
                  <Text style={styles.customerNotPresentText}>Customer not present</Text>
                </View>
              ) : signatures.customerSignatureUrl ? (
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Customer</Text>
                  <Text style={styles.signatureName}>{signatures.customerSignatureName || '—'}</Text>
                  <Image src={signatures.customerSignatureUrl} style={styles.signatureImage} />
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {brand?.footer_text || `${brand?.name || 'PSD Group'} — Job Report ${job.job_number}`}
          </Text>
          {(brand?.company_reg_number || brand?.vat_number) && (
            <Text style={styles.footerText}>
              {brand.company_reg_number ? `Company Reg: ${brand.company_reg_number}` : ''}
              {brand.company_reg_number && brand.vat_number ? '  |  ' : ''}
              {brand.vat_number ? `VAT Reg: ${brand.vat_number}` : ''}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  )
}
