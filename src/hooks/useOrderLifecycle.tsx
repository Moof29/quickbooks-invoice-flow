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
      
      if (action === 'cancel') {
        // Keep using RPC for cancel (has complex audit logic)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        const { data, error } = await supabase.rpc('cancel_invoice_order', {
          p_invoice_id: invoiceId,
          p_cancelled_by: user.id
        });
        
        if (error) throw new Error(error.message || 'Failed to cancel order');
        return data;
      }
      
      // Direct database update for 'invoice' action (2-3x faster)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Fetch invoice to get delivery_date and validate status
      const { data: invoice, error: fetchError } = await supabase
        .from('invoice_record')
        .select('id, delivery_date, status, invoice_number')
        .eq('id', invoiceId)
        .single();
      
      if (fetchError) throw new Error('Invoice not found');
      if (invoice.status !== 'pending') throw new Error('Invoice is not in pending status');
      
      // Update invoice status directly
      const { data: updateData, error: updateError } = await supabase
        .from('invoice_record')
        .update({
          status: 'invoiced',
          invoice_date: invoice.delivery_date,
          due_date: invoice.delivery_date,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          updated_by: user.id,
        })
        .eq('id', invoiceId)
        .eq('status', 'pending') // Safety check for race conditions
        .select()
        .single();
      
      if (updateError) throw new Error(updateError.message || 'Failed to update invoice');
      if (!updateData) throw new Error('Invoice already converted or not found');
      
      return {
        success: true,
        invoice_number: invoice.invoice_number,
      };
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

  return {
    convertOrder: convertOrderMutation.mutate,
    isConverting: convertOrderMutation.isPending,
    convertingInvoiceId,
  };
};
