import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText } from 'lucide-react';
import { BulkJobProgress } from '@/components/BulkJobProgress';

interface BulkInvoiceActionsProps {
  selectedOrders: string[];
  onComplete: () => void;
}

export function BulkInvoiceActions({ selectedOrders, onComplete }: BulkInvoiceActionsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleBulkCreateInvoices = async () => {
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
      // Call the batch-invoice-orders edge function
      const { data, error } = await supabase.functions.invoke('batch-invoice-orders', {
        body: {
          sales_order_ids: selectedOrders,
          invoice_date: new Date().toISOString().split('T')[0],
          due_days: 30,
        },
      });

      if (error) throw error;

      if (data?.success && data?.job_id) {
        setJobId(data.job_id);
        toast({
          title: "Batch Job Started",
          description: `Processing ${selectedOrders.length} orders. You can monitor the progress below.`,
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

  const handleJobComplete = () => {
    setIsCreating(false);
    setJobId(null);
    
    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    
    toast({
      title: "Batch Complete",
      description: "All invoices have been processed",
    });
    
    onComplete();
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleBulkCreateInvoices}
        disabled={isCreating || selectedOrders.length === 0}
        className="gap-2"
      >
        {isCreating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating {selectedOrders.length} Invoices...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Create {selectedOrders.length} Invoice{selectedOrders.length !== 1 ? 's' : ''}
          </>
        )}
      </Button>

      {jobId && (
        <BulkJobProgress jobId={jobId} onComplete={handleJobComplete} />
      )}
    </div>
  );
}
