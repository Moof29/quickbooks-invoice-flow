import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n');
    const headers = lines[0].replace('﻿', '').split(',').map(h => h.trim());
    
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = values[i];
        });
        return obj;
      });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dataType: 'items' | 'customers' | 'invoices') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);

    try {
      const text = await file.text();
      const csvData = parseCSV(text);
      
      console.log(`Parsed ${csvData.length} rows of ${dataType}`);
      setProgress(20);

      const { data, error } = await supabase.functions.invoke('import-csv-data', {
        body: { csvData, dataType }
      });

      if (error) throw error;

      setProgress(100);
      
      toast({
        title: 'Import Complete',
        description: `✅ ${data.stats.successful} imported, ❌ ${data.stats.failed} failed`,
      });

      if (data.stats.errors.length > 0) {
        console.error('Import errors:', data.stats.errors);
      }

      setTimeout(() => {
        onOpenChange(false);
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error('Import failed:', error);
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Existing QBO Data</DialogTitle>
          <DialogDescription>
            Upload CSV files exported from QuickBooks Online to populate your database with real data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {importing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">Importing data...</p>
            </div>
          )}

          {!importing && (
            <>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Items CSV</h3>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'items')}
                  className="hidden"
                  id="items-upload"
                />
                <label htmlFor="items-upload">
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Items
                    </span>
                  </Button>
                </label>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Customers CSV</h3>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'customers')}
                  className="hidden"
                  id="customers-upload"
                />
                <label htmlFor="customers-upload">
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Customers
                    </span>
                  </Button>
                </label>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Invoices CSV</h3>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'invoices')}
                  className="hidden"
                  id="invoices-upload"
                />
                <label htmlFor="invoices-upload">
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Invoices
                    </span>
                  </Button>
                </label>
              </div>

              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Upload in order: Items → Customers → Invoices. Existing records will be updated based on QuickBooks ID.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
