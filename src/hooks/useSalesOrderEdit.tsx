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

  // Update line item quantity with automatic total recalculation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ lineItemId, quantity, salesOrder }: { 
      lineItemId: string; 
      quantity: number; 
      salesOrder: SalesOrderDetails;
    }) => {
      console.log('Starting line item quantity update...', { lineItemId, quantity });
      
      // First, get the line item details
      const { data: lineItem, error: lineItemFetchError } = await supabase
        .from('sales_order_line_item')
        .select('unit_price')
        .eq('id', lineItemId)
        .single();

      if (lineItemFetchError) {
        console.error('Failed to fetch line item:', lineItemFetchError);
        throw lineItemFetchError;
      }

      const newAmount = quantity * lineItem.unit_price;
      console.log('Calculated new amount:', { quantity, unitPrice: lineItem.unit_price, newAmount });

      // Update the line item
      const { error: updateError } = await supabase
        .from('sales_order_line_item')
        .update({ 
          quantity,
          amount: newAmount
        })
        .eq('id', lineItemId);

      if (updateError) {
        console.error('Line item update error:', updateError);
        throw updateError;
      }

      // Fetch all line items to recalculate totals
      const { data: allLineItems, error: lineItemsError } = await supabase
        .from('sales_order_line_item')
        .select('amount')
        .eq('sales_order_id', salesOrderId);

      if (lineItemsError) {
        console.error('Failed to fetch all line items:', lineItemsError);
        throw lineItemsError;
      }

      const newSubtotal = allLineItems.reduce((sum, item) => sum + item.amount, 0);
      const newTotal = newSubtotal + 
                      (salesOrder.tax_total || 0) + 
                      (salesOrder.shipping_total || 0) - 
                      (salesOrder.discount_total || 0);

      console.log('Recalculated totals:', { 
        newSubtotal, 
        taxTotal: salesOrder.tax_total || 0,
        shippingTotal: salesOrder.shipping_total || 0,
        discountTotal: salesOrder.discount_total || 0,
        newTotal 
      });

      // Update sales order totals
      const { error: totalsUpdateError } = await supabase
        .from('sales_order')
        .update({ 
          subtotal: newSubtotal,
          total: newTotal 
        })
        .eq('id', salesOrderId);

      if (totalsUpdateError) {
        console.error('Sales order totals update error:', totalsUpdateError);
        throw totalsUpdateError;
      }

      console.log('Line item and totals updated successfully');
    },
    onSuccess: () => {
      console.log('Quantity update completed successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-order-line-items', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({
        title: 'Success',
        description: 'Quantity updated and totals recalculated',
      });
      setEditingQuantity(null);
      setTempQuantity('');
    },
    onError: (error: any) => {
      console.error('Quantity update error:', error);
      toast({
        title: 'Error',
        description: `Failed to update quantity: ${error.message}`,
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

  const handleQuantitySave = useCallback((lineItemId: string, salesOrder: SalesOrderDetails) => {
    const quantity = parseFloat(tempQuantity);
    if (isNaN(quantity) || quantity < 0) {
      toast({
        title: 'Invalid Quantity',
        description: 'Please enter a valid positive number or zero',
        variant: 'destructive',
      });
      return;
    }
    
    updateQuantityMutation.mutate({ lineItemId, quantity, salesOrder });
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