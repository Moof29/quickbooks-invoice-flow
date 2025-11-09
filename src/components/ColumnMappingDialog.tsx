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
