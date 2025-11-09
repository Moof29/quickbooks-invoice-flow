export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  items: ['id', 'name'],
  customers: ['id', 'display_name'],
  invoices: ['id', 'customer_ref_name', 'txn_date'],
  invoice_line_items: ['invoice_id', 'item_id', 'quantity', 'unit_price']
};

/**
 * Validates CSV data against required fields for the data type
 * @param headers - CSV column headers
 * @param rows - Sample rows from the CSV
 * @param dataType - Type of data being imported
 * @returns Validation result with errors and warnings
 */
export function validateCSV(
  headers: string[],
  rows: Record<string, string>[],
  dataType: keyof typeof REQUIRED_FIELDS
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredFields = REQUIRED_FIELDS[dataType];

  if (!requiredFields) {
    errors.push(`Unknown data type: ${dataType}`);
    return { isValid: false, errors, warnings };
  }

  // Check for required headers
  const missingHeaders = requiredFields.filter(field => !headers.includes(field));
  if (missingHeaders.length > 0) {
    errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  // Check for empty required fields in sample rows
  rows.forEach((row, index) => {
    requiredFields.forEach(field => {
      if (headers.includes(field) && (!row[field] || row[field].trim() === '')) {
        warnings.push(`Row ${index + 1}: Missing value for ${field}`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.slice(0, 10) // Only show first 10 warnings
  };
}
