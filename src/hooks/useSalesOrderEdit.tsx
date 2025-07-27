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
      try {
        console.log('=== Starting line item quantity update ===');
        console.log('Input:', { lineItemId, quantity, salesOrderId });
        
        // First, get the line item details to verify it exists
        console.log('Fetching line item details...');
        const { data: lineItem, error: lineItemFetchError } = await supabase
          .from('sales_order_line_item')
          .select('unit_price, sales_order_id, organization_id')
          .eq('id', lineItemId)
          .single();

        if (lineItemFetchError) {
          console.error('Failed to fetch line item:', lineItemFetchError);
          throw new Error(`Failed to fetch line item: ${lineItemFetchError.message}`);
        }

        if (!lineItem) {
          throw new Error('Line item not found');
        }

        console.log('Line item found:', lineItem);

        // Verify the line item belongs to the current sales order
        if (lineItem.sales_order_id !== salesOrderId) {
          throw new Error('Line item does not belong to this sales order');
        }

        const expectedAmount = quantity * lineItem.unit_price;
        console.log('Expected new amount:', { quantity, unitPrice: lineItem.unit_price, expectedAmount });

        // Update only the quantity - database should auto-calculate amount
        console.log('Updating line item quantity...');
        const { error: updateError } = await supabase
          .from('sales_order_line_item')
          .update({ quantity })
          .eq('id', lineItemId);

        if (updateError) {
          console.error('Line item update failed:', updateError);
          throw new Error(`Failed to update line item: ${updateError.message}`);
        }

        console.log('Line item quantity updated successfully');

        // Wait a moment for any database triggers to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Fetch all updated line items to recalculate totals
        console.log('Fetching all line items for total calculation...');
        const { data: allLineItems, error: lineItemsError } = await supabase
          .from('sales_order_line_item')
          .select('amount')
          .eq('sales_order_id', salesOrderId);

        if (lineItemsError) {
          console.error('Failed to fetch all line items:', lineItemsError);
          throw new Error(`Failed to fetch line items: ${lineItemsError.message}`);
        }

        if (!allLineItems || allLineItems.length === 0) {
          console.warn('No line items found for sales order:', salesOrderId);
        }

        console.log('Fetched line items for calculation:', allLineItems);

        const newSubtotal = allLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxTotal = salesOrder.tax_total || 0;
        const shippingTotal = salesOrder.shipping_total || 0;
        const discountTotal = salesOrder.discount_total || 0;
        const newTotal = newSubtotal + taxTotal + shippingTotal - discountTotal;

        console.log('Calculated totals:', { 
          newSubtotal, 
          taxTotal,
          shippingTotal,
          discountTotal,
          newTotal,
          lineItemCount: allLineItems.length
        });

        // Update sales order totals
        console.log('Updating sales order totals...');
        const { error: totalsUpdateError } = await supabase
          .from('sales_order')
          .update({ 
            subtotal: newSubtotal,
            total: newTotal 
          })
          .eq('id', salesOrderId);

        if (totalsUpdateError) {
          console.error('Failed to update sales order totals:', totalsUpdateError);
          throw new Error(`Failed to update order totals: ${totalsUpdateError.message}`);
        }

        console.log('=== Quantity update completed successfully ===');

        return { newSubtotal, newTotal, lineItemCount: allLineItems.length };

      } catch (error: any) {
        console.error('=== Quantity update failed ===');
        console.error('Error details:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Mutation onSuccess:', data);
      queryClient.invalidateQueries({ queryKey: ['sales-order-line-items', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({
        title: 'Success',
        description: `Quantity updated. New total: $${data.newTotal.toFixed(2)}`,
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