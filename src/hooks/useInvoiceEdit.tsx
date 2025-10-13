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
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<string>('');

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

  // Update line item quantity mutation
  const updateLineItemMutation = useMutation({
    mutationFn: async ({ lineItemId, quantity, unit_price }: { lineItemId: string; quantity: number; unit_price: number }) => {
      const { error } = await supabase
        .from('invoice_line_item')
        .update({ 
          quantity,
          unit_price,
        })
        .eq('id', lineItemId);

      if (error) throw error;
      return { success: true, quantity, unit_price };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      onDataChange?.();
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
    mutationFn: async (newItem: { item_id: string; quantity: number; organization_id: string }) => {
      // Get item details first
      const { data: itemData, error: itemError } = await supabase
        .from('item_record')
        .select('name, unit_price: purchase_cost')
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
          unit_price: itemData.unit_price || 0,
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

  const handleQuantityEdit = (lineItemId: string, currentQuantity: number) => {
    setEditingQuantity(lineItemId);
    setTempQuantity(currentQuantity.toString());
  };

  const handleQuantitySave = async (lineItemId: string, unit_price: number) => {
    const quantity = parseFloat(tempQuantity);
    if (isNaN(quantity) || quantity < 0) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    await updateLineItemMutation.mutateAsync({ lineItemId, quantity, unit_price });
    setEditingQuantity(null);
    setTempQuantity('');
  };

  const handleQuantityCancel = () => {
    setEditingQuantity(null);
    setTempQuantity('');
  };

  const handleInvoiceSave = async (formData: InvoiceDetails) => {
    await updateInvoiceMutation.mutateAsync(formData);
  };

  return {
    editMode,
    setEditMode,
    editingQuantity,
    tempQuantity,
    setTempQuantity,
    handleQuantityEdit,
    handleQuantitySave,
    handleQuantityCancel,
    handleInvoiceSave,
    updateInvoiceMutation,
    updateLineItemMutation,
    deleteLineItemMutation,
    addLineItemMutation,
  };
};
