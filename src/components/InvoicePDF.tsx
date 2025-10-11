import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';

interface InvoiceLineItem {
  id: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  item_record?: {
    name: string;
    sku: string;
  };
}

interface InvoicePDFProps {
  invoice: {
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    total: number;
    subtotal: number;
    tax_total: number;
    status: string;
    memo?: string;
    customer_profile?: {
      display_name: string;
      company_name: string;
      email: string;
      phone: string;
    };
  };
  lineItems: InvoiceLineItem[];
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 15,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  invoiceNumber: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 3,
  },
  value: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '2px solid #000',
    paddingBottom: 8,
    marginBottom: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottom: '1px solid #e5e7eb',
  },
  colQty: {
    width: '10%',
  },
  colItem: {
    width: '45%',
  },
  colPrice: {
    width: '20%',
    textAlign: 'right',
  },
  colAmount: {
    width: '25%',
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    marginLeft: 'auto',
    width: '40%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    fontSize: 10,
  },
  totalLabel: {
    color: '#6b7280',
  },
  totalValue: {
    fontWeight: 'bold',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTop: '2px solid #000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  memoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  memoText: {
    fontSize: 9,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    fontSize: 9,
    textTransform: 'uppercase',
  },
});

export const InvoicePDF = ({ invoice, lineItems }: InvoicePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.invoiceTitle}>INVOICE</Text>
        <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
      </View>

      {/* Invoice Info & Customer Info */}
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.value}>
            {invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'N/A'}
          </Text>
          {invoice.customer_profile?.email && (
            <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
              {invoice.customer_profile.email}
            </Text>
          )}
          {invoice.customer_profile?.phone && (
            <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
              {invoice.customer_profile.phone}
            </Text>
          )}
        </View>

        <View style={styles.column}>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.label}>Invoice Date</Text>
            <Text style={styles.value}>
              {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'MMM d, yyyy') : 'N/A'}
            </Text>
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.label}>Due Date</Text>
            <Text style={styles.value}>
              {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'N/A'}
            </Text>
          </View>
          <View>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.statusBadge}>{invoice.status || 'draft'}</Text>
          </View>
        </View>
      </View>

      {/* Line Items Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colItem}>Item</Text>
          <Text style={styles.colPrice}>Price</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {lineItems.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <View style={styles.colItem}>
              <Text style={{ fontWeight: 'bold' }}>{item.item_record?.name || 'Unknown Item'}</Text>
              {item.description && (
                <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>
                  {item.description}
                </Text>
              )}
            </View>
            <Text style={styles.colPrice}>${item.unit_price?.toFixed(2)}</Text>
            <Text style={styles.colAmount}>${item.amount?.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal:</Text>
          <Text style={styles.totalValue}>${invoice.subtotal?.toFixed(2) || '0.00'}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax:</Text>
          <Text style={styles.totalValue}>${invoice.tax_total?.toFixed(2) || '0.00'}</Text>
        </View>
        <View style={styles.grandTotal}>
          <Text>Total:</Text>
          <Text>${invoice.total?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>

      {/* Memo */}
      {invoice.memo && (
        <View style={styles.memo}>
          <Text style={styles.memoLabel}>Notes</Text>
          <Text style={styles.memoText}>{invoice.memo}</Text>
        </View>
      )}
    </Page>
  </Document>
);
