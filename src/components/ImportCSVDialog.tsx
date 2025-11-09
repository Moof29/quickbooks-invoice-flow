import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, AlertCircle, Loader2, CheckCircle2, XCircle, Download, History, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { downloadCSVTemplate } from '@/lib/csv-templates';
import { parseCSVFile, ParsedCSV } from '@/lib/csv-parser';
import { validateCSV, ValidationResult } from '@/lib/csv-validator';
import { ColumnMapping, applyColumnMapping } from '@/lib/column-mapper';
import { CSVPreviewDialog } from '@/components/CSVPreviewDialog';
import { ImportHistoryDialog } from '@/components/ImportHistoryDialog';
import { ColumnMappingDialog } from '@/components/ColumnMappingDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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

interface ImportOptions {
  dryRun: boolean;
  duplicateStrategy: 'skip' | 'update' | 'error';
  dateFormat: 'auto' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  batchSize: number;
}

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImport, setCurrentImport] = useState<ImportProgress | null>(null);
  const [currentDataType, setCurrentDataType] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelledRef = useRef(false); // Ref for immediate cancellation check
  
  // Column mapping state
  const [showMapping, setShowMapping] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedCSV | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; dataType: string } | null>(null);
  
  // History state
  const [showHistory, setShowHistory] = useState(false);
  
  // Advanced options state
  const [showOptions, setShowOptions] = useState(false);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    dryRun: false,
    duplicateStrategy: 'update',
    dateFormat: 'auto',
    batchSize: 10,
  });
  
  const { toast } = useToast();
  const { profile } = useAuthProfile();

  // Check for active background imports when dialog opens
  useEffect(() => {
    if (!open || !profile?.organization_id) return;

    const checkActiveImports = async () => {
      const { data } = await supabase
        .from('csv_import_progress')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .in('status', ['processing', 'uploading'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setCurrentImport(data as ImportProgress);
        setImporting(true);
        if (data.total_rows > 0) {
          setProgress((data.processed_rows / data.total_rows) * 100);
        }
      }
    };

    checkActiveImports();
  }, [open, profile?.organization_id]);

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
    cancelledRef.current = true; // Set ref immediately for synchronous checks
    
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
      cancelledRef.current = false;
    }
  };

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

    // Reset file input
    event.target.value = '';
  };

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

      const validation = validateCSV(mappedPreview.headers, mappedRows, pendingFile.dataType as any);

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

  const handleConfirmImport = async () => {
    if (!pendingFile || !profile?.organization_id) return;

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

    // 3. Trigger background processing with options
    const { error: functionError } = await supabase.functions.invoke('import-csv-data', {
      body: { 
        filePath, 
        dataType,
        progressId: progressRecord.id,
        options: importOptions,
        columnMappings: columnMappings.length > 0 ? columnMappings : undefined,
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
      // Check ref for immediate cancellation (synchronous)
      if (cancelledRef.current) {
        toast({
          title: 'Upload Stopped',
          description: `Stopped at chunk ${currentChunk}/${totalChunks}`,
        });
        setImporting(false);
        setIsCancelling(false);
        cancelledRef.current = false;
        return;
      }

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
          <div className="flex items-center justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
            >
              <History className="h-4 w-4 mr-2" />
              View Import History
            </Button>
          </div>
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
              {/* Advanced Options Section */}
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

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Items CSV</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadCSVTemplate('items', 'items_template.csv')}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <p className="text-xs text-muted-foreground">
                  Download a sample CSV template with proper formatting
                </p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadCSVTemplate('customers', 'customers_template.csv')}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <p className="text-xs text-muted-foreground">
                  Download a sample CSV template with proper formatting
                </p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadCSVTemplate('invoices', 'invoices_template.csv')}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <p className="text-xs text-muted-foreground">
                  Download a sample CSV template with proper formatting
                </p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadCSVTemplate('invoice_line_items', 'invoice_line_items_template.csv')}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <p className="text-xs text-muted-foreground">
                  Download a sample CSV template with proper formatting
                </p>
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

        <CSVPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          csvData={previewData}
          validation={validationResult}
          onConfirm={handleConfirmImport}
          fileName={pendingFile?.file.name || ''}
          dataType={pendingFile?.dataType || ''}
        />

        <ColumnMappingDialog
          open={showMapping}
          onOpenChange={setShowMapping}
          csvHeaders={csvHeaders}
          dataType={pendingFile?.dataType as any || 'items'}
          onConfirm={handleMappingConfirm}
        />

        <ImportHistoryDialog
          open={showHistory}
          onOpenChange={setShowHistory}
        />
      </DialogContent>
    </Dialog>
  );
}
