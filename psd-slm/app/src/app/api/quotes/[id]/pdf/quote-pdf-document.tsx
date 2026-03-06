import { Document, Page, Text, View, Image, Link, StyleSheet } from '@react-pdf/renderer'

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
  companyName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  companyDetail: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  quoteInfo: {
    textAlign: 'right',
    fontSize: 9,
    color: '#64748b',
    marginTop: 3,
  },
  // --- Two-column: From / To ---
  addressRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 24,
  },
  addressBlock: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  addressLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 9,
    color: '#64748b',
    lineHeight: 1.4,
  },
  // --- Line items ---
  groupHeader: {
    backgroundColor: '#f1f5f9',
    padding: '6 10',
    marginTop: 12,
    marginBottom: 2,
    borderRadius: 2,
  },
  groupName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  colDescription: { flex: 3, paddingRight: 8 },
  colQty: { width: 40, textAlign: 'right' },
  colPrice: { width: 70, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },
  // --- Totals ---
  totalsBlock: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: '#64748b',
  },
  totalValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  // --- Notes & Terms ---
  notesSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: '#1e40af',
    lineHeight: 1.4,
  },
  termsSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  termsLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  termsText: {
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.5,
  },
  paymentTermsText: {
    fontSize: 8,
    color: '#475569',
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
  },
  optionalSection: {
    marginTop: 16,
  },
  optionalLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    marginBottom: 4,
  },
  portalSection: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  portalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#166534',
    marginBottom: 4,
  },
  portalText: {
    fontSize: 9,
    color: '#15803d',
    marginBottom: 6,
  },
  portalLink: {
    fontSize: 9,
    color: '#2563eb',
    textDecoration: 'underline',
  },
  contractBadge: {
    fontSize: 7,
    color: '#d97706',
    fontFamily: 'Helvetica-Bold',
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

interface QuotePdfLine {
  id: string
  group_id: string | null
  sort_order: number
  description: string
  quantity: number
  sell_price: number
  is_optional: boolean
  requires_contract: boolean
  is_hidden_service?: boolean
}

interface QuotePdfGroup {
  id: string
  name: string
  sort_order: number
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
  default_terms: string | null
  default_payment_terms_text: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
  company_reg_number: string | null
  vat_number: string | null
}

interface QuotePdfDocumentProps {
  quote: {
    quote_number: string
    title: string | null
    version: number
    vat_rate: number
    valid_until: string | null
    customer_notes: string | null
    sent_at: string | null
    created_at: string
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
  brand?: BrandPdf | null
  groups: QuotePdfGroup[]
  lines: QuotePdfLine[]
  portalUrl?: string | null
}

export function QuotePdfDocument({ quote, customer, contact, brand, groups, lines, portalUrl }: QuotePdfDocumentProps) {
  const sortedGroups = [...groups].sort((a, b) => a.sort_order - b.sort_order)
  // Hide £0 service lines (e.g. absorbed delivery costs) from customer-facing PDF
  const visibleLines = lines.filter((l) => !l.is_hidden_service)
  const nonOptionalLines = visibleLines.filter((l) => !l.is_optional)
  const optionalLines = visibleLines.filter((l) => l.is_optional)

  const subtotal = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
  const vatAmount = subtotal * (quote.vat_rate / 100)
  const grandTotal = subtotal + vatAmount

  const dateStr = quote.sent_at || quote.created_at
  const formattedDate = new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // Brand address lines
  const brandAddressLines = brand
    ? [brand.address_line1, brand.address_line2, [brand.city, brand.county, brand.postcode].filter(Boolean).join(', ')].filter(Boolean)
    : []

  // Clamp logo width for PDF (max ~200pt to keep reasonable)
  const logoWidth = brand?.logo_width ? Math.min(brand.logo_width, 200) : 160

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header: Logo + Company / QUOTATION title */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {brand?.logo_path && (
              <Image src={brand.logo_path} style={[styles.logo, { width: logoWidth }]} />
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>QUOTATION</Text>
            <Text style={styles.quoteInfo}>
              {quote.quote_number}
            </Text>
            {quote.title && (
              <Text style={[styles.quoteInfo, { fontSize: 11, color: '#334155', fontFamily: 'Helvetica-Bold', marginTop: 2 }]}>
                {quote.title}
              </Text>
            )}
            <Text style={styles.quoteInfo}>Date: {formattedDate}</Text>
            {quote.valid_until && (
              <Text style={styles.quoteInfo}>
                Valid until: {new Date(quote.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}
            <View style={{ marginTop: 8 }} />
            <Text style={[styles.quoteInfo, { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#1e293b' }]}>{brand?.name || 'PSD Group'}</Text>
            {brand?.legal_entity && (
              <Text style={styles.quoteInfo}>{brand.legal_entity}</Text>
            )}
            {brandAddressLines.map((line, i) => (
              <Text key={i} style={styles.quoteInfo}>{line}</Text>
            ))}
            {brand?.phone && <Text style={styles.quoteInfo}>Tel: {brand.phone}</Text>}
            {brand?.fax && <Text style={styles.quoteInfo}>Fax: {brand.fax}</Text>}
            {brand?.email && <Text style={styles.quoteInfo}>{brand.email}</Text>}
            {brand?.website && <Text style={styles.quoteInfo}>{brand.website}</Text>}
          </View>
        </View>

        {/* Customer & Contact */}
        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Quotation For</Text>
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
        </View>

        {/* Line Items (grouped for ordering, no group headers shown to customer) */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit Price</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
        </View>

        {sortedGroups.flatMap((group) =>
          nonOptionalLines
            .filter((l) => l.group_id === group.id)
            .sort((a, b) => a.sort_order - b.sort_order)
        ).map((line) => (
          <View key={line.id} style={styles.tableRow}>
            <View style={styles.colDescription}>
              <Text>
                {line.description}
                {line.requires_contract ? ' *' : ''}
              </Text>
              {line.requires_contract && (
                <Text style={styles.contractBadge}>* Contract Required</Text>
              )}
            </View>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <Text style={styles.colPrice}>{formatCurrency(line.sell_price)}</Text>
            <Text style={styles.colTotal}>{formatCurrency(line.quantity * line.sell_price)}</Text>
          </View>
        ))}

        {/* Optional Items */}
        {optionalLines.length > 0 && (
          <View style={styles.optionalSection}>
            <Text style={styles.optionalLabel}>Optional Items (not included in total)</Text>
            {optionalLines.map((line) => (
              <View key={line.id} style={styles.tableRow}>
                <Text style={styles.colDescription}>{line.description}</Text>
                <Text style={styles.colQty}>{line.quantity}</Text>
                <Text style={styles.colPrice}>{formatCurrency(line.sell_price)}</Text>
                <Text style={styles.colTotal}>{formatCurrency(line.quantity * line.sell_price)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT ({quote.vat_rate}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
          </View>
        </View>

        {/* Portal Accept Link */}
        {portalUrl && (
          <View style={styles.portalSection}>
            <Text style={styles.portalLabel}>Ready to proceed?</Text>
            <Text style={styles.portalText}>
              Accept this quote, request changes, or contact us via our online portal:
            </Text>
            <Link src={portalUrl} style={styles.portalLink}>
              Click here to respond to this quote
            </Link>
          </View>
        )}

        {/* Customer Notes */}
        {quote.customer_notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{quote.customer_notes}</Text>
          </View>
        )}

        {/* Terms & Conditions from brand */}
        {brand?.default_terms && (
          <View style={styles.termsSection}>
            <Text style={styles.termsLabel}>Terms & Conditions</Text>
            <Text style={styles.termsText}>{brand.default_terms}</Text>
            {brand.default_payment_terms_text && (
              <Text style={styles.paymentTermsText}>{brand.default_payment_terms_text}</Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {brand?.footer_text || `${brand?.name || 'PSD Group'} | This quote is subject to our standard terms and conditions.`}
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
