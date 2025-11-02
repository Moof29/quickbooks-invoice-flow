import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthProfile } from '@/hooks/useAuthProfile';

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportProgress {
  id: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: any; // Json type from database
}

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImport, setCurrentImport] = useState<ImportProgress | null>(null);
  const { toast } = useToast();
  const { profile } = useAuthProfile();

  // Poll for progress updates
  useEffect(() => {
    if (!currentImport || currentImport.status === 'completed' || currentImport.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('csv_import_progress')
        .select('*')
        .eq('id', currentImport.id)
        .single();

      if (data) {
        setCurrentImport(data as ImportProgress);
        
        if (data.total_rows > 0) {
          setProgress((data.processed_rows / data.total_rows) * 100);
        }

        if (data.status === 'completed') {
          toast({
            title: 'Import Complete',
            description: `Successfully imported ${data.successful_rows} records. ${data.failed_rows} failed.`,
          });
          setImporting(false);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else if (data.status === 'failed') {
          toast({
            title: 'Import Failed',
            description: 'The import process failed. Check the errors below.',
            variant: 'destructive',
          });
          setImporting(false);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [currentImport, toast]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dataType: 'items' | 'customers' | 'invoices') => {
    const file = event.target.files?.[0];
    if (!file || !profile?.organization_id) return;

    setImporting(true);
    setProgress(0);
    setCurrentImport(null);

    try {
      // 1. Create progress record
      const { data: progressRecord, error: progressError } = await supabase
        .from('csv_import_progress')
        .insert({
          organization_id: profile.organization_id,
          file_name: file.name,
          file_path: `${profile.organization_id}/${dataType}/${Date.now()}_${file.name}`,
          data_type: dataType,
          status: 'uploading',
        })
        .select()
        .single();

      if (progressError) throw progressError;

      setCurrentImport(progressRecord as ImportProgress);

      // 2. Upload file to storage
      const filePath = `${profile.organization_id}/${dataType}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('csv-imports')
        .upload(filePath, file, {
          contentType: 'text/csv',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      console.log(`File uploaded to storage: ${filePath}`);

      // 3. Trigger background processing
      const { error: functionError } = await supabase.functions.invoke('import-csv-data', {
        body: { 
          filePath, 
          dataType,
          progressId: progressRecord.id,
        },
      });

      if (functionError) throw functionError;

      toast({
        title: 'Import Started',
        description: `Processing ${file.name} in background. This may take a few minutes for large files.`,
      });

    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import CSV data',
        variant: 'destructive',
      });
      setImporting(false);
      setCurrentImport(null);
    }
  };

  const getStatusIcon = () => {
    if (!currentImport) return null;
    
    switch (currentImport.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Existing QBO Data</DialogTitle>
          <DialogDescription>
            Upload CSV files exported from QuickBooks Online. Supports large files (100MB+).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {importing && currentImport && (
            <div className="space-y-4">
              <Alert>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {currentImport.status === 'uploading' && 'Uploading file...'}
                        {currentImport.status === 'processing' && 'Processing data...'}
                        {currentImport.status === 'completed' && 'Import completed!'}
                        {currentImport.status === 'failed' && 'Import failed'}
                      </div>
                      {currentImport.total_rows > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {currentImport.processed_rows} of {currentImport.total_rows} rows processed
                          ({currentImport.successful_rows} successful, {currentImport.failed_rows} failed)
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </Alert>

              {currentImport.total_rows > 0 && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    {Math.round(progress)}%
                  </p>
                </div>
              )}

              {currentImport.errors && currentImport.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Errors encountered:</p>
                      <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                        {currentImport.errors.slice(0, 10).map((err, idx) => (
                          <li key={idx}>Row {err.row}: {err.error}</li>
                        ))}
                        {currentImport.errors.length > 10 && (
                          <li>...and {currentImport.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
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
                  Upload in order: Items → Customers → Invoices. Large files supported (up to 500MB). 
                  Existing records will be updated based on QuickBooks ID.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
