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
          invoice_id: invoiceId,
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
    onMutate: async ({ invoiceId, action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sales-orders'] });
      
      // Snapshot previous value
      const previousOrders = queryClient.getQueryData(['sales-orders']);
      
      // Optimistically update - remove order from list immediately
      queryClient.setQueryData(['sales-orders'], (old: any) => {
        if (!old) return old;
        return old.filter((order: any) => order.id !== invoiceId);
      });
      
      // Return context with snapshot for rollback
      return { previousOrders };
    },
    onError: (error: Error, variables, context: any) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['sales-orders'], context.previousOrders);
      }
      
      console.error('Order conversion error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: (data, variables) => {
      // Refresh from server in background
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-stats'] });

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
