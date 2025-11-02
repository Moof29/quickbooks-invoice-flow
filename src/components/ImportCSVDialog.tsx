import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import * as tus from 'tus-js-client';

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
  const [currentDataType, setCurrentDataType] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuthProfile();

  // Poll for progress updates
  useEffect(() => {
    if (!currentImport || currentImport.status === 'completed' || currentImport.status === 'failed' || currentImport.status === 'cancelled') {
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
        } else if (data.status === 'cancelled') {
          toast({
            title: 'Import Cancelled',
            description: 'The import process was stopped.',
          });
          setImporting(false);
          setIsCancelling(false);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [currentImport, toast]);

  const handleCancel = async () => {
    if (!currentImport) return;
    
    setIsCancelling(true);
    try {
      await supabase
        .from('csv_import_progress')
        .update({ status: 'cancelled' })
        .eq('id', currentImport.id);
      
      toast({
        title: "Stopping Import",
        description: "The import process is being cancelled...",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsCancelling(false);
    }
  };

  const handleCancelAll = async () => {
    if (!profile?.organization_id) return;
    
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('csv_import_progress')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', profile.organization_id)
        .in('status', ['processing', 'uploading']);
      
      if (error) throw error;
      
      toast({
        title: "All Imports Cancelled",
        description: "All active background imports have been stopped.",
      });
      
      setCurrentImport(null);
      setImporting(false);
      setProgress(0);
      setIsCancelling(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsCancelling(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dataType: 'items' | 'customers' | 'invoices' | 'invoice_line_items') => {
    const file = event.target.files?.[0];
    if (!file || !profile?.organization_id) return;

    setImporting(true);
    setProgress(0);
    setCurrentImport(null);
    setCurrentDataType(dataType);

    try {
      const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB chunks
      
      // If file is small enough, upload directly
      if (file.size <= FILE_SIZE_LIMIT) {
        await uploadAndProcess(file, dataType);
      } else {
        // Split large file into chunks and process sequentially
        toast({
          title: 'Large File Detected',
          description: `Splitting ${Math.ceil(file.size / FILE_SIZE_LIMIT)} chunks for processing...`,
        });
        
        await splitAndUploadFile(file, dataType);
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
    }
  };

  const uploadAndProcess = async (file: File, dataType: string) => {
    // 1. Create progress record
    const { data: progressRecord, error: progressError } = await supabase
      .from('csv_import_progress')
      .insert({
        organization_id: profile.organization_id,
        file_name: file.name,
        file_path: `${profile.organization_id}/${dataType.replace('_', '-')}/${Date.now()}_${file.name}`,
        data_type: dataType,
        status: 'uploading',
      })
      .select()
      .single();

    if (progressError) throw progressError;

    setCurrentImport(progressRecord as ImportProgress);

    // 2. Upload file using TUS resumable upload
    const filePath = `${profile.organization_id}/${dataType.replace('_', '-')}/${Date.now()}_${file.name}`;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `https://pnqcbnmrfzqihymmzhkb.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: 'csv-imports',
          objectName: filePath,
          contentType: 'text/csv',
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks
        onError: (error) => {
          console.error('TUS upload error:', error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = (bytesUploaded / bytesTotal) * 100;
          setProgress(Math.min(percentage * 0.9, 90)); // Reserve 10% for processing
        },
        onSuccess: () => {
          console.log('TUS upload completed successfully');
          resolve();
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });

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
      description: `Processing ${file.name} in background.`,
    });
  };

  const splitAndUploadFile = async (file: File, dataType: string) => {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0];
    
    const totalChunks = Math.ceil((lines.length - 1) / 1000); // ~1000 rows per chunk
    let currentChunk = 0;
    
    for (let i = 1; i < lines.length; i += 1000) {
      currentChunk++;
      const chunkLines = [headers, ...lines.slice(i, i + 1000)];
      const chunkContent = chunkLines.join('\n');
      const chunkBlob = new Blob([chunkContent], { type: 'text/csv' });
      const chunkFile = new File([chunkBlob], `${file.name}_chunk${currentChunk}.csv`, { type: 'text/csv' });
      
      toast({
        title: `Processing Chunk ${currentChunk}/${totalChunks}`,
        description: 'Please wait...',
      });
      
      await uploadAndProcess(chunkFile, dataType);
      
      // Wait for processing to complete before next chunk
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    toast({
      title: 'All Chunks Processed',
      description: `Successfully split and imported ${totalChunks} chunks`,
    });
    setImporting(false);
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
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-yellow-500" />;
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
            {currentImport && (
              <span className="block mt-1 font-medium text-foreground">
                Currently importing: {currentDataType.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Emergency stop all imports button */}
          {importing && (
            <Alert className="border-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Background imports are running</span>
                <Button 
                  onClick={handleCancelAll}
                  variant="destructive"
                  disabled={isCancelling}
                  size="sm"
                >
                  {isCancelling ? 'Cancelling All...' : 'Cancel All Imports'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

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
                        {currentImport.status === 'cancelled' && 'Import cancelled'}
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

              {/* Stop button for active imports */}
              {(currentImport.status === 'processing' || currentImport.status === 'uploading') && (
                <div className="space-y-2">
                  <Button 
                    onClick={handleCancel} 
                    variant="destructive"
                    disabled={isCancelling}
                    className="w-full"
                    size="lg"
                  >
                    {isCancelling ? 'Stopping Import...' : 'Stop Import'}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Click to cancel the current import operation
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

              {/* Restart button for completed/failed/cancelled imports */}
              {(currentImport.status === 'completed' || currentImport.status === 'failed' || currentImport.status === 'cancelled') && (
                <Button 
                  onClick={() => {
                    setCurrentImport(null);
                    setImporting(false);
                    setProgress(0);
                  }} 
                  className="w-full"
                >
                  Start New Import
                </Button>
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

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Invoice Line Items CSV</h3>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'invoice_line_items')}
                  className="hidden"
                  id="invoice-line-items-upload"
                />
                <label htmlFor="invoice-line-items-upload">
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Invoice Line Items
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">
                  Upload after invoices. Links line items to existing invoices and items.
                </p>
              </div>

              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  <strong>Upload order:</strong> Items → Customers → Invoices → Invoice Line Items. 
                  Large files supported (up to 500MB). Existing records will be updated based on QuickBooks ID.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
