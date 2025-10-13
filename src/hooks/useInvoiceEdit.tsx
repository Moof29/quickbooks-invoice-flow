import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InvoiceDetails {
  invoice_date: string;
  due_date: string;
  status: string;
  memo?: string;
}

interface LineItem {
  id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export const useInvoiceEdit = (invoiceId: string, onDataChange?: () => void) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);

  // Update invoice header mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async (formData: InvoiceDetails) => {
      const { error } = await supabase
        .from('invoice_record')
        .update({
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          status: formData.status,
          memo: formData.memo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;
      return formData;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Invoice updated successfully',
      });
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onDataChange?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update invoice',
        variant: 'destructive',
      });
    },
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ lineItemId, quantity, unitPrice }: { 
      lineItemId: string; 
      quantity: number;
      unitPrice: number;
    }) => {
      const { error } = await supabase
        .from('invoice_line_item')
        .update({ quantity, unit_price: unitPrice })
        .eq('id', lineItemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Quantity updated successfully' });
      onDataChange?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating quantity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete line item mutation
  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      const { error } = await supabase
        .from('invoice_line_item')
        .delete()
        .eq('id', lineItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Line item deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      onDataChange?.();
    },
  });

  // Add line item mutation
  const addLineItemMutation = useMutation({
    mutationFn: async (newItem: { item_id: string; quantity: number; unit_price: number; organization_id: string }) => {
      // Get item details first
      const { data: itemData, error: itemError } = await supabase
        .from('item_record')
        .select('name')
        .eq('id', newItem.item_id)
        .single();

      if (itemError) throw itemError;

      const { error } = await supabase
        .from('invoice_line_item')
        .insert({
          invoice_id: invoiceId,
          organization_id: newItem.organization_id,
          item_id: newItem.item_id,
          description: itemData.name,
          quantity: newItem.quantity,
          unit_price: newItem.unit_price,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Item added successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      onDataChange?.();
    },
  });

  const handleInvoiceSave = async (formData: InvoiceDetails) => {
    await updateInvoiceMutation.mutateAsync(formData);
  };

  return {
    editMode,
    setEditMode,
    handleInvoiceSave,
    updateInvoiceMutation,
    updateQuantityMutation,
    deleteLineItemMutation,
    addLineItemMutation,
  };
};
