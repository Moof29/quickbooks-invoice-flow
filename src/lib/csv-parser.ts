export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/**
 * Parses a CSV file and returns the first N rows
 * @param file - The CSV file to parse
 * @param previewRows - Number of rows to preview (default: 10)
 * @returns Parsed CSV data with headers and preview rows
 */
export async function parseCSVFile(file: File, previewRows: number = 10): Promise<ParsedCSV> {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  const rowCount = Math.min(previewRows, lines.length - 1);
  for (let i = 1; i <= rowCount; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    totalRows: lines.length - 1
  };
}

/**
 * Parses a single CSV line, handling quoted values and commas
 * @param line - The CSV line to parse
 * @returns Array of values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ''));
  return values;
}
