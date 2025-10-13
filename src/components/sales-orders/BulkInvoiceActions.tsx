import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText } from 'lucide-react';

interface BulkInvoiceActionsProps {
  selectedOrders: string[];
  onComplete: () => void;
}

export function BulkInvoiceActions({ selectedOrders, onComplete }: BulkInvoiceActionsProps) {
  const [isCreating, setIsCreating] = useState(false);
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
      const { data, error } = await supabase.rpc('batch_create_invoices_from_orders' as any, {
        p_sales_order_ids: selectedOrders,
        p_invoice_date: new Date().toISOString().split('T')[0],
        p_due_days: 30,
      }) as { data: Array<{ sales_order_id: string; invoice_id: string | null; success: boolean; error_message: string | null }> | null; error: any };

      if (error) throw error;

      const results = data || [];
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      toast({
        title: "Invoices Created",
        description: `${successful} invoices created successfully${failed > 0 ? `, ${failed} failed` : ''}`,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      onComplete();
    } catch (error: any) {
      toast({
        title: "Error Creating Invoices",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
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
  );
}
