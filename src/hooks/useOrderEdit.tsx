import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export const useOrderEdit = (orderId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(0);

  // Update line item quantity (only quantity, not price)
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ lineItemId, quantity }: { lineItemId: string; quantity: number }) => {
      console.log('=== Updating line item quantity ===');
      console.log('Line item ID:', lineItemId);
      console.log('New quantity:', quantity);

      // CRITICAL: Only update quantity - database triggers handle amount calculation
      const { error: updateError } = await supabase
        .from('invoice_line_item' as any)
        .update({ quantity }) // ✅ Only updating quantity
        .eq('id', lineItemId);

      if (updateError) {
        console.error('Error updating quantity:', updateError);
        throw new Error(`Failed to update quantity: ${updateError.message}`);
      }

      console.log('=== Quantity updated successfully ===');
      return { success: true, quantity };
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orderId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', orderId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      toast({
        title: 'Success',
        description: 'Quantity updated successfully',
      });

      setEditingQuantity(null);
    },
    onError: (error: Error) => {
      console.error('Mutation error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete line item
  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      const { error } = await supabase
        .from('invoice_line_item' as any)
        .delete()
        .eq('id', lineItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orderId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', orderId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      toast({
        title: 'Success',
        description: 'Item removed from order',
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

  // Add line item to order
  const addLineItemMutation = useMutation({
    mutationFn: async ({ 
      itemId, 
      quantity, 
      unitPrice,
      organizationId 
    }: { 
      itemId: string; 
      quantity: number; 
      unitPrice: number;
      organizationId: string;
    }) => {
      if (!orderId) throw new Error('Order ID is required');

      const { error } = await supabase
        .from('invoice_line_item' as any)
        .insert({
          invoice_id: orderId,
          item_id: itemId,
          quantity,
          unit_price: unitPrice,
          organization_id: organizationId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orderId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', orderId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      toast({
        title: 'Success',
        description: 'Item added to order',
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

  const handleQuantityEdit = (lineItemId: string, currentQuantity: number) => {
    setEditingQuantity(lineItemId);
    setTempQuantity(currentQuantity);
  };

  const handleQuantitySave = (lineItemId: string) => {
    if (tempQuantity < 0) {
      toast({
        title: 'Invalid Quantity',
        description: 'Quantity cannot be negative',
        variant: 'destructive',
      });
      return;
    }

    updateQuantityMutation.mutate({ lineItemId, quantity: tempQuantity });
  };

  const handleQuantityCancel = () => {
    setEditingQuantity(null);
    setTempQuantity(0);
  };

  return {
    editingQuantity,
    tempQuantity,
    setTempQuantity,
    handleQuantityEdit,
    handleQuantitySave,
    handleQuantityCancel,
    updateQuantityMutation,
    deleteLineItemMutation,
    addLineItemMutation,
  };
};
