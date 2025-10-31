import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText } from 'lucide-react';
import { BatchJobProgressDialog } from '@/components/BatchJobProgressDialog';

interface BulkInvoiceActionsProps {
  selectedOrders: string[];
  onComplete: () => void;
}

export function BulkInvoiceActions({ selectedOrders, onComplete }: BulkInvoiceActionsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: any[];
    alreadyInvoiced: any[];
    notReviewed: any[];
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const validateOrders = async () => {
    if (selectedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to create invoices",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // For large selections, validate in chunks to avoid URL length limits
      const chunkSize = 100;
      let allValid: any[] = [];
      let allAlreadyInvoiced: any[] = [];
      let allNotReviewed: any[] = [];

      for (let i = 0; i < selectedOrders.length; i += chunkSize) {
        const chunk = selectedOrders.slice(i, i + chunkSize);
        
        const { data: orders, error } = await supabase
          .from('invoice_record')  // Changed from sales_order
          .select('id, invoice_number, status')
          .in('id', chunk);

        if (error) throw error;

        const valid = orders?.filter(o => o.status === 'pending') || [];  // Changed: pending is ready to invoice
        const alreadyInvoiced = orders?.filter(o => o.status === 'invoiced' || o.status === 'cancelled') || [];
        const notReviewed: any[] = [];  // No longer needed - all pending orders are ready

        allValid = [...allValid, ...valid];
        allAlreadyInvoiced = [...allAlreadyInvoiced, ...alreadyInvoiced];
        allNotReviewed = [...allNotReviewed, ...notReviewed];
      }

      setValidationResult({ 
        valid: allValid, 
        alreadyInvoiced: allAlreadyInvoiced, 
        notReviewed: allNotReviewed 
      });

      if (allValid.length === 0) {
        toast({
          title: "No Valid Orders",
          description: `${allAlreadyInvoiced.length} already invoiced, ${allNotReviewed.length} not reviewed`,
          variant: "destructive",
        });
        setIsCreating(false);
        return;
      }

      if (allAlreadyInvoiced.length > 0 || allNotReviewed.length > 0) {
        setShowValidation(true);
        setIsCreating(false);
        return;
      }

      // All orders valid, proceed directly
      await createBatchJob(allValid.map(o => o.id));
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.message,
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  const createBatchJob = async (orderIds: string[]) => {

    setIsCreating(true);
    try {
      const requestBody = {
        invoice_ids: orderIds,  // Changed from sales_order_ids
        invoice_date: new Date().toISOString().split('T')[0],
        due_days: 30,
      };
      
      console.log('Sending batch invoice request:', {
        orderCount: orderIds.length,
        body: requestBody
      });

      // Call the batch-invoice-orders edge function
      const { data, error } = await supabase.functions.invoke('batch-invoice-orders', {
        body: requestBody,
      });

      if (error) throw error;

      if (data?.success && data?.job_id) {
        setJobId(data.job_id);
        setShowValidation(false);
        setShowProgressDialog(true);
        toast({
          title: "Batch Job Started",
          description: `Processing ${orderIds.length} orders.`,
        });
      } else {
        throw new Error('Failed to start batch job');
      }
    } catch (error: any) {
      toast({
        title: "Error Starting Batch Job",
        description: error.message,
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  const handleDialogClose = () => {
    setShowProgressDialog(false);
    setIsCreating(false);
    setJobId(null);
    
    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    
    onComplete();
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={validateOrders}
        disabled={isCreating || selectedOrders.length === 0}
        className="gap-2"
      >
        {isCreating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Create {selectedOrders.length} Invoice{selectedOrders.length !== 1 ? 's' : ''}
          </>
        )}
      </Button>

      {showValidation && validationResult && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className="text-sm space-y-2">
              <p className="font-semibold">Order Validation Results:</p>
              <div className="space-y-1 text-muted-foreground">
                <p>✓ <span className="text-green-600 dark:text-green-400 font-medium">{validationResult.valid.length}</span> orders ready to invoice</p>
                {validationResult.alreadyInvoiced.length > 0 && (
                  <p>⚠ <span className="text-amber-600 dark:text-amber-400 font-medium">{validationResult.alreadyInvoiced.length}</span> already invoiced (will skip)</p>
                )}
                {validationResult.notReviewed.length > 0 && (
                  <p>⚠ <span className="text-amber-600 dark:text-amber-400 font-medium">{validationResult.notReviewed.length}</span> not reviewed (will skip)</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => createBatchJob(validationResult.valid.map(o => o.id))}
              disabled={validationResult.valid.length === 0}
              size="sm"
            >
              Proceed with {validationResult.valid.length} order{validationResult.valid.length !== 1 ? 's' : ''}
            </Button>
            <Button
              onClick={() => {
                setShowValidation(false);
                setValidationResult(null);
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <BatchJobProgressDialog
        jobId={jobId}
        open={showProgressDialog}
        onOpenChange={handleDialogClose}
        title="Creating Invoices"
        description="Processing selected orders and creating invoices..."
      />
    </div>
  );
}
