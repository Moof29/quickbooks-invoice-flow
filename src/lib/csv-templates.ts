export interface CSVTemplate {
  headers: string[];
  sampleRow: string[];
}

export const CSV_TEMPLATES: Record<string, CSVTemplate> = {
  items: {
    headers: ['id', 'name', 'sku', 'description', 'unit_price', 'type', 'active'],
    sampleRow: ['1', 'Sample Item', 'SKU-001', 'Sample Description', '99.99', 'Service', 'true']
  },
  customers: {
    headers: ['id', 'display_name', 'company_name', 'email', 'bill_addr_line1', 'bill_addr_city', 'bill_addr_state', 'bill_addr_postal_code', 'balance', 'active'],
    sampleRow: ['1', 'John Doe', 'Doe Inc', 'john@example.com', '123 Main St', 'New York', 'NY', '10001', '0', 'true']
  },
  invoices: {
    headers: ['id', 'doc_number', 'customer_ref_name', 'txn_date', 'due_date', 'total_amt', 'balance', 'customer_memo'],
    sampleRow: ['1', 'INV-001', 'John Doe', '2024-01-01', '2024-01-31', '1000.00', '500.00', 'Sample invoice']
  },
  invoice_line_items: {
    headers: ['invoice_id', 'item_id', 'description', 'quantity', 'unit_price', 'discount_amount', 'tax_rate'],
    sampleRow: ['1', '1', 'Sample Service', '2', '500.00', '0', '0']
  }
};

/**
 * Downloads a CSV template file with headers and sample row
 * @param dataType - The type of data template to download
 * @param fileName - The name for the downloaded file
 */
export function downloadCSVTemplate(
  dataType: keyof typeof CSV_TEMPLATES, 
  fileName: string
): void {
  const template = CSV_TEMPLATES[dataType];
  
  if (!template) {
    throw new Error(`Template not found for data type: ${dataType}`);
  }

  const csvContent = [
    template.headers.join(','),
    template.sampleRow.join(',')
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
}
