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
  poNumber: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  poLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  poMeta: { fontSize: 9, color: '#64748b', marginTop: 2 },
  companyNameRight: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#1e293b', textAlign: 'right', marginTop: 8 },
  companyDetail: { textAlign: 'right', fontSize: 9, color: '#64748b', marginTop: 1 },
  addressRow: { flexDirection: 'row', marginBottom: 20, gap: 24 },
  addressBlock: { flex: 1, padding: 12, backgroundColor: '#f8fafc', borderRadius: 4 },
  addressLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  addressName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  addressLine: { fontSize: 9, color: '#64748b', lineHeight: 1.5 },
  shipToBlock: { flex: 1, padding: 12, backgroundColor: '#eff6ff', borderRadius: 4, borderWidth: 1, borderColor: '#bfdbfe' },
  shipToLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  colDescription: { flex: 3, paddingRight: 8 },
  colSku: { width: 80, paddingRight: 8 },
  colQty: { width: 40, textAlign: 'right' },
  colPrice: { width: 70, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },
  totalsBlock: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 200, paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: '#64748b' },
  totalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 2,
  },
  grandTotalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  notesSection: { marginTop: 24, padding: 12, backgroundColor: '#eff6ff', borderRadius: 4 },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 9, color: '#1e40af', lineHeight: 1.4 },
  instructionSection: { marginTop: 16, padding: 12, backgroundColor: '#f8fafc', borderRadius: 4 },
  instructionLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  instructionText: { fontSize: 9, color: '#64748b', lineHeight: 1.4 },
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

interface PoPdfLine {
  id: string
  description: string
  quantity: number
  unit_cost: number
  sku: string | null
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

interface SupplierPdf {
  name: string
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
}

export interface PoPdfDocumentProps {
  po: {
    po_number: string
    created_at: string
    sent_at: string | null
    delivery_cost: number | null
    notes: string | null
    delivery_destination: string
    delivery_address_line1: string | null
    delivery_address_line2: string | null
    delivery_city: string | null
    delivery_postcode: string | null
  }
  supplier: SupplierPdf | null
  soNumber: string | null
  lines: PoPdfLine[]
  brand: BrandPdf | null
}

export function PoPdfDocument({ po, supplier, soNumber, lines, brand }: PoPdfDocumentProps) {
  const goodsTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)
  const deliveryCost = po.delivery_cost || 0
  const subtotal = goodsTotal + deliveryCost
  const vatRate = 20
  const vatAmount = subtotal * (vatRate / 100)
  const poTotal = subtotal + vatAmount

  const dateStr = po.sent_at || po.created_at
  const formattedDate = new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const brandAddressLines = brand
    ? [brand.address_line1, brand.address_line2, [brand.city, brand.county, brand.postcode].filter(Boolean).join(', ')].filter(Boolean)
    : []

  const supplierAddressLines = supplier
    ? [supplier.address_line1, supplier.address_line2, [supplier.city, supplier.county, supplier.postcode].filter(Boolean).join(', ')].filter(Boolean)
    : []

  const poDeliveryLines = [po.delivery_address_line1, po.delivery_address_line2, [po.delivery_city, po.delivery_postcode].filter(Boolean).join(', ')].filter(Boolean)
  // Fall back to company (brand) address when delivering to warehouse and no explicit address set
  // Always include company name for warehouse deliveries so the supplier knows who to address it to
  const isWarehouse = po.delivery_destination === 'psd_office'
  const rawDeliveryLines = poDeliveryLines.length > 0 ? poDeliveryLines : brandAddressLines
  const deliveryAddressLines = isWarehouse
    ? [brand?.name || 'PSD Group', ...rawDeliveryLines]
    : rawDeliveryLines

  const logoWidth = brand?.logo_width ? Math.min(brand.logo_width, 200) : 160

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header: PO number top-left, brand info top-right */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {brand?.logo_path && (
              <Image src={brand.logo_path} style={[styles.logo, { width: logoWidth }]} />
            )}
            <Text style={styles.poLabel}>Purchase Order</Text>
            <Text style={styles.poNumber}>{po.po_number}</Text>
            <Text style={styles.poMeta}>Date: {formattedDate}</Text>
            {soNumber && <Text style={styles.poMeta}>Sales Order Ref: {soNumber}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.companyNameRight}>{brand?.name || 'PSD Group'}</Text>
            {brand?.legal_entity && <Text style={styles.companyDetail}>{brand.legal_entity}</Text>}
            {brandAddressLines.map((line, i) => (
              <Text key={i} style={styles.companyDetail}>{line}</Text>
            ))}
            {brand?.phone && <Text style={styles.companyDetail}>Tel: {brand.phone}</Text>}
            {brand?.email && <Text style={styles.companyDetail}>{brand.email}</Text>}
            {brand?.website && <Text style={styles.companyDetail}>{brand.website}</Text>}
            {deliveryAddressLines.length > 0 && (
              <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#cbd5e1' }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right', marginBottom: 3 }}>Ship To:</Text>
                {deliveryAddressLines.map((line, i) => (
                  <Text key={i} style={styles.companyDetail}>{line}</Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Supplier & Shipping Address */}
        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Supplier</Text>
            {supplier && (
              <>
                <Text style={styles.addressName}>{supplier.name}</Text>
                {supplierAddressLines.map((line, i) => (
                  <Text key={i} style={styles.addressLine}>{line}</Text>
                ))}
                {supplier.phone && <Text style={[styles.addressLine, { marginTop: 4 }]}>Tel: {supplier.phone}</Text>}
                {supplier.email && <Text style={styles.addressLine}>{supplier.email}</Text>}
              </>
            )}
          </View>
        </View>

        {/* Line items */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.colSku]}>SKU</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit Cost</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>Line Total</Text>
        </View>

        {lines.map((line) => (
          <View key={line.id} style={styles.tableRow}>
            <Text style={styles.colDescription}>{line.description}</Text>
            <Text style={[styles.colSku, { fontSize: 8, color: '#94a3b8' }]}>{line.sku || '\u2014'}</Text>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <Text style={styles.colPrice}>{formatCurrency(line.unit_cost)}</Text>
            <Text style={styles.colTotal}>{formatCurrency(line.quantity * line.unit_cost)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Goods Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(goodsTotal)}</Text>
          </View>
          {deliveryCost > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery</Text>
              <Text style={styles.totalValue}>{formatCurrency(deliveryCost)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT ({vatRate}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(poTotal)}</Text>
          </View>
        </View>

        {/* Delivery instructions */}
        <View style={styles.instructionSection}>
          <Text style={styles.instructionLabel}>Important</Text>
          <Text style={styles.instructionText}>
            Please quote {po.po_number} on all correspondence and delivery documentation.
          </Text>
          {deliveryAddressLines.length > 0 && (
            <Text style={[styles.instructionText, { marginTop: 4 }]}>
              Deliver to: {deliveryAddressLines.join(', ')}
            </Text>
          )}
        </View>

        {/* Notes */}
        {po.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{po.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {brand?.footer_text || `${brand?.name || 'PSD Group'} | Purchase Order`}
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
