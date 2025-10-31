import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ConvertOrderParams {
  invoiceId: string;  // Changed from orderId
  action: 'invoice' | 'cancel';
}

export const useOrderLifecycle = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const convertOrderMutation = useMutation({
    mutationFn: async ({ invoiceId, action }: ConvertOrderParams) => {
      console.log(`Converting invoice ${invoiceId} with action: ${action}`);
      
      const { data, error } = await supabase.functions.invoke('convert-order-to-invoice', {
        body: {
          invoice_id: invoiceId,  // Changed from order_id
          action,
        },
      });

      if (error) {
        console.error('Error converting invoice:', error);
        throw new Error(error.message || 'Failed to convert invoice');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-stats'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-record', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      if (variables.action === 'invoice') {
        toast({
          title: 'Invoice Created',
          description: `Order successfully converted to invoice ${data.invoice_number}`,
        });
      } else {
        toast({
          title: 'Order Cancelled',
          description: 'No-order invoice created for record keeping',
        });
      }
    },
    onError: (error: Error) => {
      console.error('Order conversion error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from('sales_order' as any)
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', variables.orderId] });
      
      toast({
        title: 'Status Updated',
        description: `Order status changed to ${variables.status}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    convertOrder: convertOrderMutation.mutate,
    isConverting: convertOrderMutation.isPending,
    updateOrderStatus: updateOrderStatusMutation.mutate,
    isUpdatingStatus: updateOrderStatusMutation.isPending,
  };
};
