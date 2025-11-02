import * as React from 'react';
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
  const [convertingInvoiceId, setConvertingInvoiceId] = React.useState<string | null>(null);

  const convertOrderMutation = useMutation({
    mutationFn: async ({ invoiceId, action }: ConvertOrderParams) => {
      setConvertingInvoiceId(invoiceId);
      
      const { data, error } = await supabase.functions.invoke('convert-order-to-invoice', {
        body: {
          invoice_id: invoiceId,
          action,
        },
      });

      if (error) throw new Error(error.message || 'Failed to convert invoice');
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onMutate: async ({ invoiceId, action }) => {
      // Just mark as converting, no optimistic updates (faster)
      setConvertingInvoiceId(invoiceId);
      return { invoiceId };
    },
    onError: (error: Error) => {
      setConvertingInvoiceId(null);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: (data, variables) => {
      setConvertingInvoiceId(null);
      
      // Defer invalidation to not block next request
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
        queryClient.invalidateQueries({ queryKey: ['sales-orders-stats'] });
      }, 100);
      
      toast({
        title: variables.action === 'invoice' ? 'Invoice Created' : 'Order Cancelled',
        description: variables.action === 'invoice' 
          ? `Converted to ${data.invoice_number}` 
          : 'No-order invoice created',
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
    convertingInvoiceId,
    updateOrderStatus: updateOrderStatusMutation.mutate,
    isUpdatingStatus: updateOrderStatusMutation.isPending,
  };
};
