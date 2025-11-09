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
