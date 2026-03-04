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
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  logo: { marginBottom: 8, objectFit: 'contain' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  dnInfo: { textAlign: 'right', fontSize: 9, color: '#64748b', marginTop: 3 },
  companyNameRight: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#1e293b', textAlign: 'right', marginTop: 8 },
  addressRow: { flexDirection: 'row', marginBottom: 20, gap: 24 },
  addressBlock: { flex: 1, padding: 12, backgroundColor: '#f8fafc', borderRadius: 4 },
  addressLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  addressName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  addressLine: { fontSize: 9, color: '#64748b', lineHeight: 1.4 },
  shippingRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  shippingBlock: { padding: 12, backgroundColor: '#f0f9ff', borderRadius: 4 },
  shippingLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  shippingValue: { fontSize: 9, color: '#1e293b' },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  colDescription: { flex: 3, paddingRight: 8 },
  colSku: { width: 80, paddingRight: 8 },
  colQty: { width: 50, textAlign: 'center' },
  colSerials: { flex: 2, paddingLeft: 8 },
  serialText: { fontSize: 7, color: '#64748b', fontFamily: 'Courier' },
  notesSection: { marginTop: 24, padding: 12, backgroundColor: '#fefce8', borderRadius: 4 },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#a16207', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 9, color: '#854d0e', lineHeight: 1.4 },
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  signatureRow: { flexDirection: 'row', gap: 40, marginTop: 12 },
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

interface DnPdfLine {
  id: string
  description: string
  quantity: number
  sku: string | null
  serialNumbers: string[]
}

interface BrandPdf {
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
}

interface DnPdfDocumentProps {
  dn: {
    dn_number: string
    created_at: string
    carrier: string | null
    tracking_reference: string | null
    notes: string | null
    delivery_address_line1: string | null
    delivery_address_line2: string | null
    delivery_city: string | null
    delivery_postcode: string | null
  }
  soNumber: string | null
  customerName: string | null
  lines: DnPdfLine[]
  brand: BrandPdf | null
}

export function DnPdfDocument({ dn, soNumber, customerName, lines, brand }: DnPdfDocumentProps) {
  const formattedDate = new Date(dn.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const brandAddressLines = brand
    ? [brand.address_line1, brand.address_line2, [brand.city, brand.county, brand.postcode].filter(Boolean).join(', ')].filter(Boolean)
    : []

  const deliveryAddress = [dn.delivery_address_line1, dn.delivery_address_line2, dn.delivery_city, dn.delivery_postcode]
    .filter(Boolean)

  const logoWidth = brand?.logo_width ? Math.min(brand.logo_width, 200) : 160

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {brand?.logo_path && (
              <Image src={brand.logo_path} style={[styles.logo, { width: logoWidth }]} />
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>DELIVERY NOTE</Text>
            <Text style={styles.dnInfo}>{dn.dn_number}</Text>
            <Text style={styles.dnInfo}>Date: {formattedDate}</Text>
            {soNumber && <Text style={styles.dnInfo}>SO Ref: {soNumber}</Text>}
            <Text style={styles.companyNameRight}>{brand?.name || 'PSD Group'}</Text>
            {brand?.legal_entity && <Text style={styles.dnInfo}>{brand.legal_entity}</Text>}
            {brandAddressLines.map((line, i) => (
              <Text key={i} style={styles.dnInfo}>{line}</Text>
            ))}
            {brand?.phone && <Text style={styles.dnInfo}>Tel: {brand.phone}</Text>}
            {brand?.email && <Text style={styles.dnInfo}>{brand.email}</Text>}
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Deliver To</Text>
            {customerName && <Text style={styles.addressName}>{customerName}</Text>}
            {deliveryAddress.map((line, i) => (
              <Text key={i} style={styles.addressLine}>{line}</Text>
            ))}
          </View>
        </View>

        {/* Carrier & Tracking */}
        {(dn.carrier || dn.tracking_reference) && (
          <View style={styles.shippingRow}>
            {dn.carrier && (
              <View style={styles.shippingBlock}>
                <Text style={styles.shippingLabel}>Carrier</Text>
                <Text style={styles.shippingValue}>{dn.carrier}</Text>
              </View>
            )}
            {dn.tracking_reference && (
              <View style={styles.shippingBlock}>
                <Text style={styles.shippingLabel}>Tracking Reference</Text>
                <Text style={[styles.shippingValue, { fontFamily: 'Courier', fontSize: 8 }]}>{dn.tracking_reference}</Text>
              </View>
            )}
          </View>
        )}

        {/* Line items — NO pricing */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.colSku]}>SKU</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colSerials]}>Serial Numbers</Text>
        </View>

        {lines.map((line) => (
          <View key={line.id} style={styles.tableRow}>
            <Text style={styles.colDescription}>{line.description}</Text>
            <Text style={[styles.colSku, { fontSize: 8, color: '#94a3b8' }]}>{line.sku || '\u2014'}</Text>
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

        {/* Notes */}
        {dn.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{dn.notes}</Text>
          </View>
        )}

        {/* Signature block for recipient */}
        <View style={styles.signatureSection}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#475569' }}>
            Received By
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Print Name</Text>
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
            {brand?.footer_text || `${brand?.name || 'PSD Group'} | Delivery Note`}
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
