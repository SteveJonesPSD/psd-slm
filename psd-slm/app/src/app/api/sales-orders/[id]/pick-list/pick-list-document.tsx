import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 70,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  subInfo: { fontSize: 9, color: '#64748b', marginTop: 3 },
  infoRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
  },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 10, color: '#1e293b' },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 4,
    backgroundColor: '#f8fafc',
    padding: 6,
  },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', minHeight: 28 },
  colCheck: { width: 24, alignItems: 'center', justifyContent: 'center' },
  colLocation: { width: 60 },
  colSku: { width: 80 },
  colProduct: { flex: 2, paddingRight: 8 },
  colQty: { width: 50, textAlign: 'right' },
  colSerials: { flex: 1, paddingLeft: 8 },
  checkbox: { width: 12, height: 12, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 2 },
  serialText: { fontSize: 7, color: '#64748b', fontFamily: 'Courier' },
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  signatureRow: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 12,
  },
  signatureBlock: { flex: 1 },
  signatureLabel: { fontSize: 8, color: '#94a3b8', marginBottom: 24 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#94a3b8', textAlign: 'center' },
})

interface PickListLine {
  id: string
  description: string
  sku: string | null
  quantity: number
  location: string
  serialNumbers: string[]
}

interface PickListDocumentProps {
  soNumber: string
  customerName: string | null
  date: string
  lines: PickListLine[]
}

export function PickListDocument({ soNumber, customerName, date, lines }: PickListDocumentProps) {
  const formattedDate = new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PICK LIST</Text>
          <Text style={styles.subInfo}>{soNumber}</Text>
        </View>

        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Sales Order</Text>
            <Text style={styles.infoValue}>{soNumber}</Text>
          </View>
          {customerName && (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>{customerName}</Text>
            </View>
          )}
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formattedDate}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Items</Text>
            <Text style={styles.infoValue}>{lines.length}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colCheck]}></Text>
          <Text style={[styles.tableHeaderText, styles.colLocation]}>Location</Text>
          <Text style={[styles.tableHeaderText, styles.colSku]}>SKU</Text>
          <Text style={[styles.tableHeaderText, styles.colProduct]}>Product</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty to Pick</Text>
          <Text style={[styles.tableHeaderText, styles.colSerials]}>Serial Numbers</Text>
        </View>

        {/* Lines */}
        {lines.map((line) => (
          <View key={line.id} style={styles.tableRow}>
            <View style={styles.colCheck}>
              <View style={styles.checkbox} />
            </View>
            <Text style={styles.colLocation}>{line.location}</Text>
            <Text style={[styles.colSku, { fontSize: 8, color: '#94a3b8' }]}>{line.sku || '\u2014'}</Text>
            <Text style={styles.colProduct}>{line.description}</Text>
            <Text style={[styles.colQty, { fontFamily: 'Helvetica-Bold' }]}>{line.quantity}</Text>
            <View style={styles.colSerials}>
              {line.serialNumbers.length > 0 ? (
                line.serialNumbers.map((sn, i) => (
                  <Text key={i} style={styles.serialText}>{sn}</Text>
                ))
              ) : (
                <Text style={[styles.serialText, { color: '#cbd5e1' }]}>{'\u2014'}</Text>
              )}
            </View>
          </View>
        ))}

        {/* Signature section */}
        <View style={styles.signatureSection}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#475569' }}>
            Picked By
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Name</Text>
              <View style={styles.signatureLine} />
            </View>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Signature</Text>
              <View style={styles.signatureLine} />
            </View>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Date</Text>
              <View style={styles.signatureLine} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Pick List — {soNumber} — Printed {formattedDate}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
