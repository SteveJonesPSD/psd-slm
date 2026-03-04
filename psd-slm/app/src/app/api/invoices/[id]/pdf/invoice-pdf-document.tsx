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
  invoiceInfo: { textAlign: 'right', fontSize: 9, color: '#64748b', marginTop: 3 },
  companyDetail: { textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginTop: 8 },
  addressRow: { flexDirection: 'row', marginBottom: 20, gap: 24 },
  addressBlock: { flex: 1, padding: 12, backgroundColor: '#f8fafc', borderRadius: 4 },
  addressLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  addressName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  addressLine: { fontSize: 9, color: '#64748b', lineHeight: 1.4 },
  groupHeader: { backgroundColor: '#f1f5f9', padding: '6 10', marginTop: 12, marginBottom: 2, borderRadius: 2 },
  groupName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#475569' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4, marginBottom: 4 },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  colDescription: { flex: 3, paddingRight: 8 },
  colQty: { width: 40, textAlign: 'right' },
  colPrice: { width: 70, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },
  totalsBlock: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 200, paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: '#64748b' },
  totalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 200, paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 2 },
  grandTotalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  paymentSection: { marginTop: 20, padding: 12, backgroundColor: '#f8fafc', borderRadius: 4 },
  paymentLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  paymentText: { fontSize: 9, color: '#64748b', lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 25, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#94a3b8', textAlign: 'center' },
  watermark: { position: 'absolute', top: 300, left: 100, fontSize: 72, fontFamily: 'Helvetica-Bold', color: '#e2e8f0', transform: 'rotate(-35deg)', opacity: 0.5 },
  creditHeader: { color: '#d97706' },
  serialLine: { fontSize: 7, color: '#94a3b8', paddingLeft: 4, paddingBottom: 2 },
})

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

interface InvoicePdfLine {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  sort_order: number
  group_name: string | null
  serial_numbers?: string[] | null
  is_hidden_service?: boolean
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
  default_payment_terms_text: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
  company_reg_number: string | null
  vat_number: string | null
}

interface DeliveryAddress {
  delivery_address_line1: string | null
  delivery_address_line2: string | null
  delivery_city: string | null
  delivery_postcode: string | null
}

interface InvoicePdfDocumentProps {
  invoice: {
    invoice_number: string
    invoice_type: string
    status: string
    vat_rate: number
    due_date: string | null
    customer_po: string | null
    payment_terms: number | null
    created_at: string
    sent_at: string | null
  }
  customer: {
    name: string
    address_line1: string | null
    address_line2: string | null
    city: string | null
    postcode: string | null
  } | null
  contact: {
    first_name: string
    last_name: string
  } | null
  brand: BrandPdf | null
  lines: InvoicePdfLine[]
  deliveryAddress?: DeliveryAddress | null
}

export function InvoicePdfDocument({ invoice, customer, contact, brand, lines, deliveryAddress }: InvoicePdfDocumentProps) {
  const isCreditNote = invoice.invoice_type === 'credit_note'
  const isVoid = invoice.status === 'void'
  const title = isCreditNote ? 'CREDIT NOTE' : 'INVOICE'

  // Hide £0 service lines (e.g. absorbed delivery costs) from customer-facing PDF
  const visibleLines = lines.filter((l) => !l.is_hidden_service)

  // Group lines by group_name
  const groupedLines = new Map<string | null, InvoicePdfLine[]>()
  const groupOrder: (string | null)[] = []
  for (const line of [...visibleLines].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!groupedLines.has(line.group_name)) {
      groupedLines.set(line.group_name, [])
      groupOrder.push(line.group_name)
    }
    groupedLines.get(line.group_name)!.push(line)
  }

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const effectiveSubtotal = isCreditNote ? -Math.abs(subtotal) : subtotal
  const vatAmount = effectiveSubtotal * (invoice.vat_rate / 100)
  const grandTotal = effectiveSubtotal + vatAmount

  const dateStr = invoice.sent_at || invoice.created_at
  const formattedDate = new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const brandAddressLines = brand
    ? [brand.address_line1, brand.address_line2, [brand.city, brand.county, brand.postcode].filter(Boolean).join(', ')].filter(Boolean)
    : []

  const logoWidth = brand?.logo_width ? Math.min(brand.logo_width, 200) : 160

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Void watermark */}
        {isVoid && <Text style={styles.watermark}>VOID</Text>}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {brand?.logo_path && (
              <Image src={brand.logo_path} style={[styles.logo, { width: logoWidth }]} />
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.title, isCreditNote ? styles.creditHeader : {}]}>{title}</Text>
            <Text style={styles.invoiceInfo}>{invoice.invoice_number}</Text>
            <Text style={styles.invoiceInfo}>Date: {formattedDate}</Text>
            {invoice.due_date && (
              <Text style={styles.invoiceInfo}>
                Due: {new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}
            {invoice.customer_po && (
              <Text style={styles.invoiceInfo}>Customer PO: {invoice.customer_po}</Text>
            )}
            <Text style={styles.companyDetail}>{brand?.name || 'PSD Group'}</Text>
            {brand?.legal_entity && <Text style={styles.invoiceInfo}>{brand.legal_entity}</Text>}
            {brandAddressLines.map((line, i) => (
              <Text key={i} style={styles.invoiceInfo}>{line}</Text>
            ))}
            {brand?.phone && <Text style={styles.invoiceInfo}>Tel: {brand.phone}</Text>}
            {brand?.email && <Text style={styles.invoiceInfo}>{brand.email}</Text>}
            {brand?.website && <Text style={styles.invoiceInfo}>{brand.website}</Text>}
          </View>
        </View>

        {/* Bill To / Deliver To */}
        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Bill To</Text>
            {customer && (
              <>
                <Text style={styles.addressName}>{customer.name}</Text>
                {customer.address_line1 && <Text style={styles.addressLine}>{customer.address_line1}</Text>}
                {customer.address_line2 && <Text style={styles.addressLine}>{customer.address_line2}</Text>}
                {(customer.city || customer.postcode) && (
                  <Text style={styles.addressLine}>
                    {[customer.city, customer.postcode].filter(Boolean).join(', ')}
                  </Text>
                )}
              </>
            )}
            {contact && (
              <Text style={[styles.addressLine, { marginTop: 4 }]}>
                Attn: {contact.first_name} {contact.last_name}
              </Text>
            )}
          </View>
          {deliveryAddress && deliveryAddress.delivery_address_line1 && (
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>Deliver To</Text>
              {deliveryAddress.delivery_address_line1 && <Text style={styles.addressLine}>{deliveryAddress.delivery_address_line1}</Text>}
              {deliveryAddress.delivery_address_line2 && <Text style={styles.addressLine}>{deliveryAddress.delivery_address_line2}</Text>}
              {(deliveryAddress.delivery_city || deliveryAddress.delivery_postcode) && (
                <Text style={styles.addressLine}>
                  {[deliveryAddress.delivery_city, deliveryAddress.delivery_postcode].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Grouped Lines */}
        {groupOrder.map((groupName) => {
          const groupLines = groupedLines.get(groupName) || []
          return (
            <View key={groupName || '__ungrouped'}>
              {groupName && (
                <View style={styles.groupHeader}>
                  <Text style={styles.groupName}>{groupName}</Text>
                </View>
              )}

              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
                <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
                <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit Price</Text>
                <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
              </View>

              {groupLines.map((line) => (
                <View key={line.id} wrap={false}>
                  <View style={styles.tableRow}>
                    <Text style={styles.colDescription}>{line.description}</Text>
                    <Text style={styles.colQty}>{line.quantity}</Text>
                    <Text style={styles.colPrice}>{formatCurrency(line.unit_price)}</Text>
                    <Text style={styles.colTotal}>{formatCurrency(line.quantity * line.unit_price)}</Text>
                  </View>
                  {line.serial_numbers && line.serial_numbers.length > 0 && (
                    <Text style={styles.serialLine}>
                      Serial Numbers: {line.serial_numbers.join(', ')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )
        })}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(effectiveSubtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT ({invoice.vat_rate}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
          </View>
        </View>

        {/* Payment terms */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentLabel}>Payment</Text>
          {invoice.payment_terms && (
            <Text style={styles.paymentText}>Payment Terms: {invoice.payment_terms} days</Text>
          )}
          {brand?.default_payment_terms_text && (
            <Text style={styles.paymentText}>{brand.default_payment_terms_text}</Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {brand?.footer_text || `${brand?.name || 'PSD Group'} | Thank you for your business.`}
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
