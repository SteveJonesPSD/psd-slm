import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 70,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  brandName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  slipLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'right',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrCode: {
    width: 170,
    height: 170,
  },
  customerBox: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  customerName: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  soNumber: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#4f46e5',
    textAlign: 'center',
    marginTop: 4,
  },
  visitDateBox: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 4,
    alignSelf: 'center',
  },
  visitDateLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  visitDateValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#3730a3',
    textAlign: 'center',
    marginTop: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  detailBlock: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 10,
    color: '#1e293b',
    fontFamily: 'Helvetica-Bold',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
    alignItems: 'flex-start',
  },
  checkbox: {
    fontSize: 14,
    marginRight: 10,
    color: '#94a3b8',
    width: 20,
  },
  itemContent: {
    flex: 1,
  },
  itemDesc: {
    fontSize: 10,
    color: '#1e293b',
  },
  serials: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: '#64748b',
    marginTop: 2,
  },
  notesBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fefce8',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#a16207',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: '#854d0e',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerUrl: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

interface SlipLine {
  id: string
  description: string
  quantity_expected: number
  expected_serials: string[] | null
}

interface CollectionSlipPdfProps {
  slipNumber: string
  customerName: string
  soNumber: string | null
  jobNumber: string
  engineerName: string
  date: string
  visitDate: string | null
  itemCount: number
  notes: string | null
  lines: SlipLine[]
  qrDataUrl: string
  magicLinkUrl: string
  brandName: string
}

export function CollectionSlipPdf({
  slipNumber,
  customerName,
  soNumber,
  jobNumber,
  engineerName,
  date,
  visitDate,
  itemCount,
  notes,
  lines,
  qrDataUrl,
  magicLinkUrl,
  brandName,
}: CollectionSlipPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>{brandName}</Text>
          <Text style={styles.slipLabel}>Stock Collection Slip</Text>
        </View>

        {/* QR Code — centred, prominent */}
        <View style={styles.qrContainer}>
          <Image src={qrDataUrl} style={styles.qrCode} />
        </View>

        {/* Customer name + SO number — largest text */}
        <View style={styles.customerBox}>
          <Text style={styles.customerName}>{customerName}</Text>
          {soNumber && (
            <Text style={styles.soNumber}>{soNumber}</Text>
          )}
          {visitDate && (
            <View style={styles.visitDateBox}>
              <Text style={styles.visitDateLabel}>Booked Visit</Text>
              <Text style={styles.visitDateValue}>{visitDate}</Text>
            </View>
          )}
        </View>

        {/* Details row */}
        <View style={styles.detailsRow}>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Slip</Text>
            <Text style={styles.detailValue}>{slipNumber}</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Items</Text>
            <Text style={styles.detailValue}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Job</Text>
            <Text style={styles.detailValue}>{jobNumber}</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Engineer</Text>
            <Text style={styles.detailValue}>{engineerName}</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{date}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Items */}
        {lines.map((line, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.checkbox}>{'\u2610'}</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemDesc}>
                {line.quantity_expected}× {line.description}
              </Text>
              {line.expected_serials && line.expected_serials.length > 0 && (
                <Text style={styles.serials}>
                  S/N: {line.expected_serials.join(', ')}
                </Text>
              )}
            </View>
          </View>
        ))}

        {/* Notes */}
        {notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Scan QR code to confirm collection</Text>
          <Text style={styles.footerUrl}>{magicLinkUrl}</Text>
        </View>
      </Page>
    </Document>
  )
}
