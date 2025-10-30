import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SalesOrderDetails {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  customer_id: string;
  customer_po_number: string | null;
  requested_ship_date: string | null;
  promised_ship_date: string | null;
  shipping_method: string | null;
  shipping_terms: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  discount_rate: number | null;
  total: number;
  memo: string | null;
  message: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
}

interface LineItem {
  id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  description: string | null;
}

export function useSalesOrderEdit(salesOrderId: string | null) {
  const [editMode, setEditMode] = useState(false);
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update sales order details mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (updates: Partial<SalesOrderDetails>) => {
      if (!salesOrderId) throw new Error('No sales order ID');

      console.log('Updating sales order:', updates);

      const { error } = await supabase
        .from('sales_order')
        .update(updates)
        .eq('id', salesOrderId);

      if (error) {
        console.error('Sales order update error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      toast({
        title: 'Success',
        description: 'Sales order updated successfully',
      });
      setEditMode(false);
    },
    onError: (error: any) => {
      console.error('Order update error:', error);
      toast({
        title: 'Error',
        description: `Failed to update sales order: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update line item quantity - database triggers handle all calculations automatically
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ lineItemId, quantity }: { 
      lineItemId: string; 
      quantity: number; 
    }) => {
      console.log('=== Starting line item quantity update ===');
      console.log('Input:', { lineItemId, quantity, salesOrderId });
      
      // Update only the quantity - database triggers handle amount and totals automatically
      const { error: updateError } = await supabase
        .from('sales_order_line_item')
        .update({ quantity })
        .eq('id', lineItemId);

      if (updateError) {
        console.error('Line item update failed:', updateError);
        throw new Error(`Failed to update quantity: ${updateError.message}`);
      }

      console.log('=== Quantity update completed successfully ===');

      // Return simple success - database triggers have handled all calculations
      return { success: true, quantity };
    },
    onSuccess: (data) => {
      console.log('Mutation onSuccess:', data);
      queryClient.invalidateQueries({ queryKey: ['sales-order-line-items', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({
        title: 'Success',
        description: `Quantity updated to ${data.quantity}`,
      });
      setEditingQuantity(null);
      setTempQuantity('');
    },
    onError: (error: any) => {
      console.error('Mutation onError:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update quantity',
        variant: 'destructive',
      });
      setEditingQuantity(null);
      setTempQuantity('');
    },
  });

  const handleQuantityEdit = useCallback((lineItemId: string, currentQuantity: number) => {
    setEditingQuantity(lineItemId);
    setTempQuantity(currentQuantity.toString());
  }, []);

  const handleQuantitySave = useCallback((lineItemId: string) => {
    const quantity = parseFloat(tempQuantity);
    if (isNaN(quantity) || quantity < 0) {
      toast({
        title: 'Invalid Quantity',
        description: 'Please enter a valid positive number or zero',
        variant: 'destructive',
      });
      return;
    }
    
    updateQuantityMutation.mutate({ lineItemId, quantity });
  }, [tempQuantity, updateQuantityMutation, toast]);

  const handleQuantityCancel = useCallback(() => {
    setEditingQuantity(null);
    setTempQuantity('');
  }, []);

  const handleOrderSave = useCallback((formData: Partial<SalesOrderDetails>) => {
    if (!formData) return;
    
    updateOrderMutation.mutate({
      status: formData.status,
      customer_po_number: formData.customer_po_number,
      requested_ship_date: formData.requested_ship_date,
      promised_ship_date: formData.promised_ship_date,
      shipping_method: formData.shipping_method,
      shipping_terms: formData.shipping_terms,
      shipping_address_line1: formData.shipping_address_line1,
      shipping_address_line2: formData.shipping_address_line2,
      shipping_city: formData.shipping_city,
      shipping_state: formData.shipping_state,
      shipping_postal_code: formData.shipping_postal_code,
      shipping_country: formData.shipping_country,
      memo: formData.memo,
      message: formData.message,
      terms: formData.terms,
    });
  }, [updateOrderMutation]);

  return {
    editMode,
    setEditMode,
    editingQuantity,
    tempQuantity,
    setTempQuantity,
    handleQuantityEdit,
    handleQuantitySave,
    handleQuantityCancel,
    handleOrderSave,
    updateOrderMutation,
    updateQuantityMutation,
  };
}