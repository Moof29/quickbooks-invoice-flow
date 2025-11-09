# CSV Import Feature Enhancements - Lovable Instructions

## Overview
This document provides detailed, actionable instructions for enhancing the existing CSV import feature in the QuickBooks Invoice Flow application. Each enhancement is designed to be implemented independently.

---

## Enhancement 1: CSV Template Downloads

### Goal
Add downloadable CSV templates for each data type (Items, Customers, Invoices, Invoice Line Items) to help users format their data correctly.

### Current Files to Modify
- `src/components/ImportCSVDialog.tsx`

### Implementation Steps

1. **Add Template Data Constants**
   - Create a new file: `src/lib/csv-templates.ts`
   - Define template headers for each data type:
   ```typescript
   export const CSV_TEMPLATES = {
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

   export function downloadCSVTemplate(dataType: keyof typeof CSV_TEMPLATES, fileName: string) {
     const template = CSV_TEMPLATES[dataType];
     const csvContent = [
       template.headers.join(','),
       template.sampleRow.join(',')
     ].join('\n');

     const blob = new Blob([csvContent], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = fileName;
     link.click();
     window.URL.revokeObjectURL(url);
   }
   ```

2. **Update ImportCSVDialog.tsx**
   - Import the template utility: `import { downloadCSVTemplate } from '@/lib/csv-templates';`
   - Add download button to each upload section (before the upload button):
   ```tsx
   <Button
     variant="ghost"
     size="sm"
     onClick={() => downloadCSVTemplate('items', 'items_template.csv')}
     className="w-full"
   >
     <Download className="h-4 w-4 mr-2" />
     Download Template
   </Button>
   ```
   - Import Download icon: `import { Download } from 'lucide-react';`
   - Repeat for all 4 data types (items, customers, invoices, invoice_line_items)

3. **Add Helper Text**
   - Below each download button, add:
   ```tsx
   <p className="text-xs text-muted-foreground">
     Download a sample CSV template with proper formatting
   </p>
   ```

---

## Enhancement 2: CSV Preview & Validation

### Goal
Show a preview of the first 10 rows and validate data before starting the import.

### Database Changes Required
- None (uses existing csv_import_progress table)

### Files to Create
- `src/components/CSVPreviewDialog.tsx`
- `src/lib/csv-parser.ts`
- `src/lib/csv-validator.ts`

### Implementation Steps

1. **Create CSV Parser Utility** (`src/lib/csv-parser.ts`)
   ```typescript
   export interface ParsedCSV {
     headers: string[];
     rows: Record<string, string>[];
     totalRows: number;
   }

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
   ```

2. **Create CSV Validator** (`src/lib/csv-validator.ts`)
   ```typescript
   export interface ValidationResult {
     isValid: boolean;
     errors: string[];
     warnings: string[];
   }

   const REQUIRED_FIELDS = {
     items: ['id', 'name'],
     customers: ['id', 'display_name'],
     invoices: ['id', 'customer_ref_name', 'txn_date'],
     invoice_line_items: ['invoice_id', 'item_id', 'quantity', 'unit_price']
   };

   export function validateCSV(
     headers: string[],
     rows: Record<string, string>[],
     dataType: keyof typeof REQUIRED_FIELDS
   ): ValidationResult {
     const errors: string[] = [];
     const warnings: string[] = [];
     const requiredFields = REQUIRED_FIELDS[dataType];

     // Check for required headers
     const missingHeaders = requiredFields.filter(field => !headers.includes(field));
     if (missingHeaders.length > 0) {
       errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
     }

     // Check for empty required fields in sample rows
     rows.forEach((row, index) => {
       requiredFields.forEach(field => {
         if (!row[field] || row[field].trim() === '') {
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
   ```

3. **Create Preview Dialog Component** (`src/components/CSVPreviewDialog.tsx`)
   ```typescript
   import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
   import { Button } from '@/components/ui/button';
   import { Alert, AlertDescription } from '@/components/ui/alert';
   import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
   import { ScrollArea } from '@/components/ui/scroll-area';
   import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
   import { ParsedCSV } from '@/lib/csv-parser';
   import { ValidationResult } from '@/lib/csv-validator';

   interface CSVPreviewDialogProps {
     open: boolean;
     onOpenChange: (open: boolean) => void;
     csvData: ParsedCSV | null;
     validation: ValidationResult | null;
     onConfirm: () => void;
     fileName: string;
     dataType: string;
   }

   export function CSVPreviewDialog({
     open,
     onOpenChange,
     csvData,
     validation,
     onConfirm,
     fileName,
     dataType
   }: CSVPreviewDialogProps) {
     if (!csvData || !validation) return null;

     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Preview CSV Import</DialogTitle>
             <DialogDescription>
               File: {fileName} • Type: {dataType} • {csvData.totalRows} total rows
             </DialogDescription>
           </DialogHeader>

           <div className="space-y-4">
             {/* Validation Status */}
             {validation.errors.length > 0 && (
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertDescription>
                   <p className="font-medium">Validation Errors:</p>
                   <ul className="mt-2 space-y-1">
                     {validation.errors.map((error, idx) => (
                       <li key={idx} className="text-sm">• {error}</li>
                     ))}
                   </ul>
                 </AlertDescription>
               </Alert>
             )}

             {validation.warnings.length > 0 && validation.errors.length === 0 && (
               <Alert>
                 <AlertTriangle className="h-4 w-4" />
                 <AlertDescription>
                   <p className="font-medium">Warnings (first 10):</p>
                   <ul className="mt-2 space-y-1">
                     {validation.warnings.map((warning, idx) => (
                       <li key={idx} className="text-sm">• {warning}</li>
                     ))}
                   </ul>
                 </AlertDescription>
               </Alert>
             )}

             {validation.errors.length === 0 && validation.warnings.length === 0 && (
               <Alert>
                 <CheckCircle2 className="h-4 w-4" />
                 <AlertDescription>
                   CSV validation passed! Ready to import.
                 </AlertDescription>
               </Alert>
             )}

             {/* Preview Table */}
             <div className="border rounded-lg">
               <div className="bg-muted px-4 py-2">
                 <h3 className="font-medium">Preview (first 10 rows)</h3>
               </div>
               <ScrollArea className="h-[400px]">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead className="w-12">#</TableHead>
                       {csvData.headers.map((header, idx) => (
                         <TableHead key={idx}>{header}</TableHead>
                       ))}
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {csvData.rows.map((row, rowIdx) => (
                       <TableRow key={rowIdx}>
                         <TableCell className="font-medium">{rowIdx + 1}</TableCell>
                         {csvData.headers.map((header, cellIdx) => (
                           <TableCell key={cellIdx} className="max-w-xs truncate">
                             {row[header] || <span className="text-muted-foreground italic">empty</span>}
                           </TableCell>
                         ))}
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </ScrollArea>
             </div>
           </div>

           <DialogFooter>
             <Button variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button
               onClick={onConfirm}
               disabled={validation.errors.length > 0}
             >
               {validation.errors.length > 0 ? 'Fix Errors First' : 'Confirm Import'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     );
   }
   ```

4. **Update ImportCSVDialog.tsx**
   - Add state for preview:
   ```typescript
   const [showPreview, setShowPreview] = useState(false);
   const [previewData, setPreviewData] = useState<ParsedCSV | null>(null);
   const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
   const [pendingFile, setPendingFile] = useState<{ file: File; dataType: string } | null>(null);
   ```

   - Import utilities:
   ```typescript
   import { parseCSVFile } from '@/lib/csv-parser';
   import { validateCSV } from '@/lib/csv-validator';
   import { CSVPreviewDialog } from '@/components/CSVPreviewDialog';
   ```

   - Modify `handleFileUpload` to show preview first:
   ```typescript
   const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dataType: 'items' | 'customers' | 'invoices' | 'invoice_line_items') => {
     const file = event.target.files?.[0];
     if (!file) return;

     try {
       // Parse and validate
       const parsed = await parseCSVFile(file, 10);
       const validation = validateCSV(parsed.headers, parsed.rows, dataType);

       setPreviewData(parsed);
       setValidationResult(validation);
       setPendingFile({ file, dataType });
       setShowPreview(true);
     } catch (error: any) {
       toast({
         title: 'Parse Error',
         description: error.message,
         variant: 'destructive',
       });
     }

     // Reset file input
     event.target.value = '';
   };
   ```

   - Add confirm handler:
   ```typescript
   const handleConfirmImport = async () => {
     if (!pendingFile) return;

     setShowPreview(false);
     setImporting(true);
     setProgress(0);
     setCurrentImport(null);
     setCurrentDataType(pendingFile.dataType);

     try {
       const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB chunks

       if (pendingFile.file.size <= FILE_SIZE_LIMIT) {
         await uploadAndProcess(pendingFile.file, pendingFile.dataType);
       } else {
         toast({
           title: 'Large File Detected',
           description: `Splitting ${Math.ceil(pendingFile.file.size / FILE_SIZE_LIMIT)} chunks for processing...`,
         });
         await splitAndUploadFile(pendingFile.file, pendingFile.dataType);
       }
     } catch (error: any) {
       console.error('Import error:', error);
       toast({
         title: 'Import Failed',
         description: error.message || 'Failed to import CSV data',
         variant: 'destructive',
       });
       setImporting(false);
       setCurrentImport(null);
     } finally {
       setPendingFile(null);
       setPreviewData(null);
       setValidationResult(null);
     }
   };
   ```

   - Add preview dialog to render:
   ```tsx
   <CSVPreviewDialog
     open={showPreview}
     onOpenChange={setShowPreview}
     csvData={previewData}
     validation={validationResult}
     onConfirm={handleConfirmImport}
     fileName={pendingFile?.file.name || ''}
     dataType={pendingFile?.dataType || ''}
   />
   ```

---

## Enhancement 3: Import History & Management

### Goal
Track all imports and allow users to view history, download error reports, and retry failed imports.

### Database Changes Required

Create new migration file: `supabase/migrations/[timestamp]_add_import_history_features.sql`

```sql
-- Add error_file_path column to store failed rows CSV
ALTER TABLE public.csv_import_progress
ADD COLUMN IF NOT EXISTS error_file_path TEXT,
ADD COLUMN IF NOT EXISTS import_settings JSONB DEFAULT '{}'::jsonb;

-- Update the check constraint to include 'invoice_line_items'
ALTER TABLE public.csv_import_progress
DROP CONSTRAINT IF EXISTS csv_import_progress_data_type_check;

ALTER TABLE public.csv_import_progress
ADD CONSTRAINT csv_import_progress_data_type_check
CHECK (data_type IN ('items', 'customers', 'invoices', 'invoice_line_items'));

-- Create index for history queries
CREATE INDEX IF NOT EXISTS idx_csv_import_progress_org_created
ON public.csv_import_progress(organization_id, created_at DESC);
```

### Files to Create
- `src/components/ImportHistoryDialog.tsx`
- `src/hooks/useImportHistory.ts`

### Implementation Steps

1. **Create Import History Hook** (`src/hooks/useImportHistory.ts`)
   ```typescript
   import { useQuery } from '@tanstack/react-query';
   import { supabase } from '@/integrations/supabase/client';
   import { useAuthProfile } from './useAuthProfile';

   export interface ImportHistoryRecord {
     id: string;
     file_name: string;
     data_type: string;
     status: string;
     total_rows: number;
     processed_rows: number;
     successful_rows: number;
     failed_rows: number;
     errors: any;
     error_file_path: string | null;
     created_at: string;
     completed_at: string | null;
   }

   export function useImportHistory(limit: number = 50) {
     const { profile } = useAuthProfile();

     return useQuery({
       queryKey: ['import-history', profile?.organization_id],
       queryFn: async () => {
         if (!profile?.organization_id) return [];

         const { data, error } = await supabase
           .from('csv_import_progress')
           .select('*')
           .eq('organization_id', profile.organization_id)
           .order('created_at', { ascending: false })
           .limit(limit);

         if (error) throw error;
         return data as ImportHistoryRecord[];
       },
       enabled: !!profile?.organization_id,
     });
   }

   export async function downloadErrorReport(importId: string, fileName: string) {
     const { data, error } = await supabase
       .from('csv_import_progress')
       .select('errors')
       .eq('id', importId)
       .single();

     if (error) throw error;

     if (!data.errors || data.errors.length === 0) {
       throw new Error('No errors found for this import');
     }

     // Convert errors to CSV
     const csvContent = [
       'Row Number,Error Message',
       ...data.errors.map((err: any) => `${err.row},"${err.error.replace(/"/g, '""')}"`)
     ].join('\n');

     const blob = new Blob([csvContent], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `${fileName}_errors.csv`;
     link.click();
     window.URL.revokeObjectURL(url);
   }
   ```

2. **Create Import History Dialog** (`src/components/ImportHistoryDialog.tsx`)
   ```typescript
   import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
   import { Button } from '@/components/ui/button';
   import { Badge } from '@/components/ui/badge';
   import { ScrollArea } from '@/components/ui/scroll-area';
   import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
   import { Download, FileText, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
   import { useImportHistory, downloadErrorReport } from '@/hooks/useImportHistory';
   import { useToast } from '@/hooks/use-toast';
   import { formatDistanceToNow } from 'date-fns';

   interface ImportHistoryDialogProps {
     open: boolean;
     onOpenChange: (open: boolean) => void;
   }

   export function ImportHistoryDialog({ open, onOpenChange }: ImportHistoryDialogProps) {
     const { data: history, isLoading } = useImportHistory();
     const { toast } = useToast();

     const handleDownloadErrors = async (importId: string, fileName: string) => {
       try {
         await downloadErrorReport(importId, fileName);
         toast({
           title: 'Download Started',
           description: 'Error report is being downloaded',
         });
       } catch (error: any) {
         toast({
           title: 'Download Failed',
           description: error.message,
           variant: 'destructive',
         });
       }
     };

     const getStatusBadge = (status: string) => {
       const variants: Record<string, { variant: any; icon: any }> = {
         completed: { variant: 'default', icon: CheckCircle2 },
         failed: { variant: 'destructive', icon: XCircle },
         processing: { variant: 'secondary', icon: Loader2 },
         uploading: { variant: 'secondary', icon: Clock },
         cancelled: { variant: 'outline', icon: XCircle },
       };

       const config = variants[status] || variants.processing;
       const Icon = config.icon;

       return (
         <Badge variant={config.variant} className="gap-1">
           <Icon className="h-3 w-3" />
           {status}
         </Badge>
       );
     };

     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
           <DialogHeader>
             <DialogTitle>Import History</DialogTitle>
             <DialogDescription>
               View past CSV imports and download error reports
             </DialogDescription>
           </DialogHeader>

           {isLoading ? (
             <div className="flex items-center justify-center py-8">
               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
           ) : history && history.length > 0 ? (
             <ScrollArea className="flex-1">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>File</TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Total</TableHead>
                     <TableHead className="text-right">Success</TableHead>
                     <TableHead className="text-right">Failed</TableHead>
                     <TableHead>Date</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {history.map((record) => (
                     <TableRow key={record.id}>
                       <TableCell className="font-medium max-w-xs truncate">
                         <div className="flex items-center gap-2">
                           <FileText className="h-4 w-4 text-muted-foreground" />
                           {record.file_name}
                         </div>
                       </TableCell>
                       <TableCell>
                         <Badge variant="outline">
                           {record.data_type.replace('_', ' ')}
                         </Badge>
                       </TableCell>
                       <TableCell>{getStatusBadge(record.status)}</TableCell>
                       <TableCell className="text-right">{record.total_rows}</TableCell>
                       <TableCell className="text-right text-green-600">
                         {record.successful_rows}
                       </TableCell>
                       <TableCell className="text-right text-red-600">
                         {record.failed_rows}
                       </TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                         {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                       </TableCell>
                       <TableCell className="text-right">
                         {record.failed_rows > 0 && (
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleDownloadErrors(record.id, record.file_name)}
                           >
                             <Download className="h-4 w-4" />
                           </Button>
                         )}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </ScrollArea>
           ) : (
             <div className="flex flex-col items-center justify-center py-12 text-center">
               <FileText className="h-12 w-12 text-muted-foreground mb-4" />
               <p className="text-lg font-medium">No import history</p>
               <p className="text-sm text-muted-foreground">
                 Your CSV import history will appear here
               </p>
             </div>
           )}
         </DialogContent>
       </Dialog>
     );
   }
   ```

3. **Update ImportCSVDialog.tsx**
   - Add state for history dialog:
   ```typescript
   const [showHistory, setShowHistory] = useState(false);
   ```

   - Import the history dialog:
   ```typescript
   import { ImportHistoryDialog } from '@/components/ImportHistoryDialog';
   ```

   - Add history button in the dialog header (after DialogDescription):
   ```tsx
   <div className="flex items-center justify-between mt-2">
     <Button
       variant="outline"
       size="sm"
       onClick={() => setShowHistory(true)}
     >
       <History className="h-4 w-4 mr-2" />
       View Import History
     </Button>
   </div>
   ```

   - Import History icon:
   ```typescript
   import { History } from 'lucide-react';
   ```

   - Add history dialog to render:
   ```tsx
   <ImportHistoryDialog
     open={showHistory}
     onOpenChange={setShowHistory}
   />
   ```

---

## Enhancement 4: Column Mapping Interface

### Goal
Allow users to map their CSV columns to the expected database fields, handling different CSV formats.

### Database Changes Required
```sql
-- Add column_mapping to import_settings
-- (No schema change needed, uses existing import_settings JSONB column)
```

### Files to Create
- `src/components/ColumnMappingDialog.tsx`
- `src/lib/column-mapper.ts`

### Implementation Steps

1. **Create Column Mapper Utility** (`src/lib/column-mapper.ts`)
   ```typescript
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

   export function autoMapColumns(
     csvHeaders: string[],
     targetFields: FieldDefinition[]
   ): ColumnMapping[] {
     const mappings: ColumnMapping[] = [];

     targetFields.forEach(field => {
       // Try exact match first
       let matchedHeader = csvHeaders.find(h =>
         h.toLowerCase() === field.name.toLowerCase()
       );

       // Try fuzzy match
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
   ```

2. **Create Column Mapping Dialog** (`src/components/ColumnMappingDialog.tsx`)
   ```typescript
   import { useState, useEffect } from 'react';
   import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
   import { Button } from '@/components/ui/button';
   import { Label } from '@/components/ui/label';
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
   import { Badge } from '@/components/ui/badge';
   import { ScrollArea } from '@/components/ui/scroll-area';
   import { Alert, AlertDescription } from '@/components/ui/alert';
   import { AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
   import { FIELD_DEFINITIONS, autoMapColumns, ColumnMapping, FieldDefinition } from '@/lib/column-mapper';

   interface ColumnMappingDialogProps {
     open: boolean;
     onOpenChange: (open: boolean) => void;
     csvHeaders: string[];
     dataType: 'items' | 'customers' | 'invoices' | 'invoice_line_items';
     onConfirm: (mappings: ColumnMapping[]) => void;
   }

   export function ColumnMappingDialog({
     open,
     onOpenChange,
     csvHeaders,
     dataType,
     onConfirm,
   }: ColumnMappingDialogProps) {
     const [mappings, setMappings] = useState<ColumnMapping[]>([]);
     const fields = FIELD_DEFINITIONS[dataType] || [];

     useEffect(() => {
       if (open && csvHeaders.length > 0) {
         // Auto-map on open
         const autoMapped = autoMapColumns(csvHeaders, fields);
         setMappings(autoMapped);
       }
     }, [open, csvHeaders]);

     const handleMappingChange = (targetField: string, sourceColumn: string) => {
       setMappings(prev => {
         const existing = prev.filter(m => m.targetField !== targetField);
         if (sourceColumn && sourceColumn !== 'none') {
           return [...existing, { sourceColumn, targetField }];
         }
         return existing;
       });
     };

     const getMappedSource = (targetField: string): string | undefined => {
       return mappings.find(m => m.targetField === targetField)?.sourceColumn;
     };

     const getMissingRequired = (): string[] => {
       const requiredFields = fields.filter(f => f.required);
       return requiredFields
         .filter(f => !mappings.some(m => m.targetField === f.name))
         .map(f => f.label);
     };

     const missingRequired = getMissingRequired();
     const canProceed = missingRequired.length === 0;

     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
           <DialogHeader>
             <DialogTitle>Map CSV Columns</DialogTitle>
             <DialogDescription>
               Match your CSV columns to the required fields for {dataType.replace('_', ' ')}
             </DialogDescription>
           </DialogHeader>

           <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
             {!canProceed && (
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertDescription>
                   Missing required fields: {missingRequired.join(', ')}
                 </AlertDescription>
               </Alert>
             )}

             {canProceed && (
               <Alert>
                 <CheckCircle2 className="h-4 w-4" />
                 <AlertDescription>
                   All required fields are mapped! Optional fields can be left unmapped.
                 </AlertDescription>
               </Alert>
             )}

             <div className="flex items-center justify-between">
               <p className="text-sm text-muted-foreground">
                 {mappings.length} of {fields.length} fields mapped
               </p>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => {
                   const autoMapped = autoMapColumns(csvHeaders, fields);
                   setMappings(autoMapped);
                 }}
               >
                 <Wand2 className="h-4 w-4 mr-2" />
                 Auto-Map
               </Button>
             </div>

             <ScrollArea className="flex-1 border rounded-lg">
               <div className="p-4 space-y-4">
                 {fields.map((field) => (
                   <div key={field.name} className="grid grid-cols-2 gap-4 items-start">
                     <div className="space-y-1">
                       <Label className="flex items-center gap-2">
                         {field.label}
                         {field.required && (
                           <Badge variant="destructive" className="text-xs">Required</Badge>
                         )}
                       </Label>
                       {field.description && (
                         <p className="text-xs text-muted-foreground">{field.description}</p>
                       )}
                     </div>
                     <Select
                       value={getMappedSource(field.name) || 'none'}
                       onValueChange={(value) => handleMappingChange(field.name, value)}
                     >
                       <SelectTrigger>
                         <SelectValue placeholder="Select column" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">
                           <span className="text-muted-foreground italic">None</span>
                         </SelectItem>
                         {csvHeaders.map((header) => (
                           <SelectItem key={header} value={header}>
                             {header}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                 ))}
               </div>
             </ScrollArea>
           </div>

           <DialogFooter>
             <Button variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button
               onClick={() => {
                 onConfirm(mappings);
                 onOpenChange(false);
               }}
               disabled={!canProceed}
             >
               Continue to Preview
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     );
   }
   ```

3. **Update ImportCSVDialog.tsx**
   - Add state:
   ```typescript
   const [showMapping, setShowMapping] = useState(false);
   const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
   const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
   ```

   - Import:
   ```typescript
   import { ColumnMappingDialog } from '@/components/ColumnMappingDialog';
   import { ColumnMapping, applyColumnMapping } from '@/lib/column-mapper';
   ```

   - Update `handleFileUpload` to extract headers and show mapping:
   ```typescript
   const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dataType: 'items' | 'customers' | 'invoices' | 'invoice_line_items') => {
     const file = event.target.files?.[0];
     if (!file) return;

     try {
       // Parse CSV to get headers
       const parsed = await parseCSVFile(file, 10);

       setCsvHeaders(parsed.headers);
       setPendingFile({ file, dataType });
       setShowMapping(true);
     } catch (error: any) {
       toast({
         title: 'Parse Error',
         description: error.message,
         variant: 'destructive',
       });
     }

     event.target.value = '';
   };
   ```

   - Add mapping confirm handler:
   ```typescript
   const handleMappingConfirm = async (mappings: ColumnMapping[]) => {
     if (!pendingFile) return;

     setColumnMappings(mappings);

     try {
       // Re-parse with mappings applied
       const parsed = await parseCSVFile(pendingFile.file, 10);

       // Apply column mappings to preview data
       const mappedRows = parsed.rows.map(row => applyColumnMapping(row, mappings));
       const mappedPreview = {
         ...parsed,
         rows: mappedRows,
         headers: mappings.map(m => m.targetField),
       };

       const validation = validateCSV(mappedPreview.headers, mappedRows, pendingFile.dataType);

       setPreviewData(mappedPreview);
       setValidationResult(validation);
       setShowPreview(true);
     } catch (error: any) {
       toast({
         title: 'Mapping Error',
         description: error.message,
         variant: 'destructive',
       });
     }
   };
   ```

   - Add mapping dialog to render:
   ```tsx
   <ColumnMappingDialog
     open={showMapping}
     onOpenChange={setShowMapping}
     csvHeaders={csvHeaders}
     dataType={pendingFile?.dataType || 'items'}
     onConfirm={handleMappingConfirm}
   />
   ```

---

## Enhancement 5: Advanced Import Options

### Goal
Add options for dry run mode, duplicate handling strategies, and date format selection.

### Files to Modify
- `src/components/ImportCSVDialog.tsx`
- `supabase/functions/import-csv-data/index.ts`

### Database Changes
Already handled in Enhancement 3 (import_settings JSONB column)

### Implementation Steps

1. **Add Import Options State to ImportCSVDialog.tsx**
   ```typescript
   interface ImportOptions {
     dryRun: boolean;
     duplicateStrategy: 'skip' | 'update' | 'error';
     dateFormat: 'auto' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
     batchSize: number;
   }

   const [importOptions, setImportOptions] = useState<ImportOptions>({
     dryRun: false,
     duplicateStrategy: 'update',
     dateFormat: 'auto',
     batchSize: 10,
   });

   const [showOptions, setShowOptions] = useState(false);
   ```

2. **Create Options UI Section**
   - Add a collapsible section before the upload buttons:
   ```tsx
   <Collapsible open={showOptions} onOpenChange={setShowOptions}>
     <CollapsibleTrigger asChild>
       <Button variant="ghost" className="w-full justify-between">
         <span className="flex items-center gap-2">
           <Settings className="h-4 w-4" />
           Advanced Options
         </span>
         {showOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
       </Button>
     </CollapsibleTrigger>
     <CollapsibleContent className="space-y-4 mt-4 p-4 border rounded-lg">
       <div className="space-y-2">
         <div className="flex items-center justify-between">
           <Label htmlFor="dry-run">Dry Run (Test Mode)</Label>
           <Switch
             id="dry-run"
             checked={importOptions.dryRun}
             onCheckedChange={(checked) =>
               setImportOptions(prev => ({ ...prev, dryRun: checked }))
             }
           />
         </div>
         <p className="text-xs text-muted-foreground">
           Validate and preview import without saving to database
         </p>
       </div>

       <div className="space-y-2">
         <Label htmlFor="duplicate-strategy">Duplicate Handling</Label>
         <Select
           value={importOptions.duplicateStrategy}
           onValueChange={(value: any) =>
             setImportOptions(prev => ({ ...prev, duplicateStrategy: value }))
           }
         >
           <SelectTrigger id="duplicate-strategy">
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="skip">Skip duplicates</SelectItem>
             <SelectItem value="update">Update existing (default)</SelectItem>
             <SelectItem value="error">Error on duplicates</SelectItem>
           </SelectContent>
         </Select>
       </div>

       <div className="space-y-2">
         <Label htmlFor="date-format">Date Format</Label>
         <Select
           value={importOptions.dateFormat}
           onValueChange={(value: any) =>
             setImportOptions(prev => ({ ...prev, dateFormat: value }))
           }
         >
           <SelectTrigger id="date-format">
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="auto">Auto-detect</SelectItem>
             <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
             <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
             <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
           </SelectContent>
         </Select>
       </div>
     </CollapsibleContent>
   </Collapsible>
   ```

   - Import required components:
   ```typescript
   import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
   import { Switch } from '@/components/ui/switch';
   import { Settings, ChevronUp, ChevronDown } from 'lucide-react';
   ```

3. **Pass Options to Upload Function**
   - Modify `uploadAndProcess` to include options:
   ```typescript
   const uploadAndProcess = async (file: File, dataType: string) => {
     // ... existing code ...

     // 3. Trigger background processing with options
     const { error: functionError } = await supabase.functions.invoke('import-csv-data', {
       body: {
         filePath,
         dataType,
         progressId: progressRecord.id,
         options: importOptions, // Add this
         columnMappings: columnMappings, // Add this
       },
     });

     // ... rest of code ...
   };
   ```

4. **Update Edge Function to Handle Options**
   - Modify `supabase/functions/import-csv-data/index.ts`:
   ```typescript
   // After line 35, add:
   const { options, columnMappings } = await req.json();

   // Store options in progress record
   await supabaseClient
     .from('csv_import_progress')
     .update({
       status: 'processing',
       started_at: new Date().toISOString(),
       import_settings: {
         options: options || {},
         columnMappings: columnMappings || [],
       }
     })
     .eq('id', progressId);
   ```

   - Update `processBatch` function signature to accept options:
   ```typescript
   async function processBatch(
     supabase: any,
     orgId: string,
     rows: any[],
     dataType: string,
     startIndex: number,
     options?: any,
     columnMappings?: any[]
   ): Promise<...>
   ```

   - Apply column mappings at the start of processBatch:
   ```typescript
   // Apply column mappings if provided
   if (columnMappings && columnMappings.length > 0) {
     rows = rows.map(row => {
       const mappedRow: any = {};
       columnMappings.forEach((mapping: any) => {
         if (row[mapping.sourceColumn] !== undefined) {
           mappedRow[mapping.targetField] = row[mapping.sourceColumn];
         }
       });
       return mappedRow;
     });
   }
   ```

   - Add dry run check before database operations:
   ```typescript
   if (options?.dryRun) {
     // Just validate, don't insert
     successful += items.length;
     processed += items.length;
     return { successful, failed, processed, errors };
   }
   ```

   - Update upsert calls to respect duplicate strategy:
   ```typescript
   const upsertOptions = options?.duplicateStrategy === 'skip'
     ? { onConflict: 'organization_id,qbo_id', ignoreDuplicates: true }
     : { onConflict: 'organization_id,qbo_id', ignoreDuplicates: false };

   const { error } = await supabase
     .from('item_record')
     .upsert(items, upsertOptions);
   ```

---

## Testing Checklist

After implementing each enhancement, test the following:

### Enhancement 1: Templates
- [ ] Download template for each data type
- [ ] Verify headers match expected format
- [ ] Verify sample row has correct data types

### Enhancement 2: Preview & Validation
- [ ] Upload valid CSV - should show preview with green success message
- [ ] Upload CSV with missing required columns - should show errors
- [ ] Upload CSV with empty required fields - should show warnings
- [ ] Confirm import button should be disabled if validation errors exist
- [ ] Preview should show max 10 rows

### Enhancement 3: Import History
- [ ] Complete an import - verify it appears in history
- [ ] Failed import should show download errors button
- [ ] Download error report - should be valid CSV
- [ ] History should show correct status badges
- [ ] History should sort by most recent first

### Enhancement 4: Column Mapping
- [ ] Auto-map should work for standard QuickBooks CSV
- [ ] Manual mapping should update preview correctly
- [ ] Missing required field mappings should prevent proceeding
- [ ] Mapped data should validate correctly

### Enhancement 5: Advanced Options
- [ ] Dry run mode should not save data to database
- [ ] Duplicate handling options should work as expected
- [ ] Date format selection should parse dates correctly
- [ ] Options should be saved in import_settings column

---

## Priority Recommendation

Implement in this order for best user experience:

1. **Enhancement 1: Templates** (Quick win, helps users immediately)
2. **Enhancement 2: Preview & Validation** (Prevents bad imports)
3. **Enhancement 3: Import History** (Better visibility and debugging)
4. **Enhancement 4: Column Mapping** (Maximum flexibility)
5. **Enhancement 5: Advanced Options** (Power user features)

---

## Notes for Lovable

- All UI components use **shadcn/ui** library (Radix UI primitives)
- Use **TypeScript** with proper typing
- Follow existing code patterns in `ImportCSVDialog.tsx`
- Use **react-hook-form** + **zod** for any new forms
- Use **TanStack Query** for data fetching
- Keep edge function code **memory-efficient** (streaming approach)
- Add proper **error handling** with user-friendly toast messages
- Follow **accessibility** best practices (ARIA labels, keyboard navigation)
- Use **Lucide React** for all icons
- Keep **mobile-responsive** design patterns

---

## Additional Features to Consider (Future)

- **Scheduled Imports**: Auto-import from S3/Google Drive on schedule
- **Import Templates Management**: Save/load custom column mappings
- **Bulk Import Operations**: Queue multiple files
- **Real-time Validation API**: Check customer names before import
- **Import Rollback**: Undo an import completely
- **Progress Webhooks**: Notify external systems on completion
- **Custom Field Support**: Map to custom fields in database
- **Import from URLs**: Direct import from Google Sheets/Excel Online

