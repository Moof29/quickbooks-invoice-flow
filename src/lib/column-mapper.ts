export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export interface FieldDefinition {
  name: string;
  label: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'boolean';
  description?: string;
}

export const FIELD_DEFINITIONS: Record<string, FieldDefinition[]> = {
  items: [
    { name: 'id', label: 'QuickBooks ID', required: true, type: 'text', description: 'Unique ID from QuickBooks' },
    { name: 'name', label: 'Item Name', required: true, type: 'text' },
    { name: 'sku', label: 'SKU', required: false, type: 'text' },
    { name: 'description', label: 'Description', required: false, type: 'text' },
    { name: 'unit_price', label: 'Unit Price', required: false, type: 'number' },
    { name: 'type', label: 'Item Type', required: false, type: 'text', description: 'e.g., Service, NonInventory' },
    { name: 'active', label: 'Active Status', required: false, type: 'boolean' },
  ],
  customers: [
    { name: 'id', label: 'QuickBooks ID', required: true, type: 'text' },
    { name: 'display_name', label: 'Display Name', required: true, type: 'text' },
    { name: 'company_name', label: 'Company Name', required: false, type: 'text' },
    { name: 'email', label: 'Email', required: false, type: 'text' },
    { name: 'bill_addr_line1', label: 'Billing Address Line 1', required: false, type: 'text' },
    { name: 'bill_addr_city', label: 'City', required: false, type: 'text' },
    { name: 'bill_addr_state', label: 'State', required: false, type: 'text' },
    { name: 'bill_addr_postal_code', label: 'Postal Code', required: false, type: 'text' },
    { name: 'balance', label: 'Balance', required: false, type: 'number' },
    { name: 'active', label: 'Active Status', required: false, type: 'boolean' },
  ],
  invoices: [
    { name: 'id', label: 'QuickBooks ID', required: true, type: 'text' },
    { name: 'doc_number', label: 'Invoice Number', required: false, type: 'text' },
    { name: 'customer_ref_name', label: 'Customer Name', required: true, type: 'text' },
    { name: 'txn_date', label: 'Invoice Date', required: true, type: 'date' },
    { name: 'due_date', label: 'Due Date', required: false, type: 'date' },
    { name: 'total_amt', label: 'Total Amount', required: false, type: 'number' },
    { name: 'balance', label: 'Balance', required: false, type: 'number' },
    { name: 'customer_memo', label: 'Memo', required: false, type: 'text' },
  ],
  invoice_line_items: [
    { name: 'invoice_id', label: 'Invoice ID', required: true, type: 'text' },
    { name: 'item_id', label: 'Item ID', required: true, type: 'text' },
    { name: 'description', label: 'Description', required: false, type: 'text' },
    { name: 'quantity', label: 'Quantity', required: true, type: 'number' },
    { name: 'unit_price', label: 'Unit Price', required: true, type: 'number' },
    { name: 'discount_amount', label: 'Discount', required: false, type: 'number' },
    { name: 'tax_rate', label: 'Tax Rate', required: false, type: 'number' },
  ],
};

/**
 * Automatically maps CSV headers to target fields using fuzzy matching
 * @param csvHeaders - Headers from the CSV file
 * @param targetFields - Expected field definitions for the data type
 * @returns Array of column mappings
 */
export function autoMapColumns(
  csvHeaders: string[],
  targetFields: FieldDefinition[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  targetFields.forEach(field => {
    // Try exact match first (case-insensitive)
    let matchedHeader = csvHeaders.find(h =>
      h.toLowerCase() === field.name.toLowerCase()
    );

    // Try fuzzy match if no exact match
    if (!matchedHeader) {
      matchedHeader = csvHeaders.find(h =>
        h.toLowerCase().includes(field.name.toLowerCase()) ||
        field.name.toLowerCase().includes(h.toLowerCase()) ||
        field.label.toLowerCase().includes(h.toLowerCase())
      );
    }

    if (matchedHeader) {
      mappings.push({
        sourceColumn: matchedHeader,
        targetField: field.name,
      });
    }
  });

  return mappings;
}

/**
 * Applies column mappings to a data row
 * @param row - Original row data with CSV headers
 * @param mappings - Column mappings to apply
 * @returns Transformed row with target field names
 */
export function applyColumnMapping(
  row: Record<string, string>,
  mappings: ColumnMapping[]
): Record<string, string> {
  const mappedRow: Record<string, string> = {};

  mappings.forEach(mapping => {
    if (row[mapping.sourceColumn] !== undefined) {
      mappedRow[mapping.targetField] = row[mapping.sourceColumn];
    }
  });

  return mappedRow;
}
