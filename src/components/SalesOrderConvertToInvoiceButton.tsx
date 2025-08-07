import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';

interface SalesOrderConvertToInvoiceButtonProps {
  salesOrderId: string;
  currentStatus: string;
  onConversion?: () => void;
}

export function SalesOrderConvertToInvoiceButton({ 
  salesOrderId, 
  currentStatus, 
  onConversion 
}: SalesOrderConvertToInvoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { profile } = useAuthProfile();

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !profile?.organization_id) {
        throw new Error('User not authenticated or missing organization');
      }

      // First, get the sales order details
      const { data: salesOrder, error: salesOrderError } = await supabase
        .from('sales_order')
        .select(`
          *,
          customer_profile:customer_id(*)
        `)
        .eq('id', salesOrderId)
        .single();

      if (salesOrderError || !salesOrder) {
        throw new Error('Sales order not found');
      }

      // Create the invoice record
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoice_record')
        .insert({
          organization_id: profile.organization_id,
          customer_id: salesOrder.customer_id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          subtotal: salesOrder.subtotal || 0,
          tax_total: salesOrder.tax_total || 0,
          total: salesOrder.total || 0,
          balance_due: salesOrder.total || 0,
          status: 'sent',
          memo: `Converted from Sales Order ${salesOrder.order_number}`
          // Remove created_by since it's causing FK constraint issues
        })
        .select()
        .single();

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      if (!invoice) {
        throw new Error('Failed to create invoice: No data returned');
      }

      // Get sales order line items
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('sales_order_line_item')
        .select('*')
        .eq('sales_order_id', salesOrder.id);

      if (lineItemsError) {
        throw new Error('Failed to fetch line items');
      }

      // Create invoice line items
      if (lineItems && lineItems.length > 0) {
        const invoiceLineItems = lineItems.map(item => ({
          invoice_id: invoice.id,
          item_id: item.item_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount || 0,
          tax_rate: item.tax_rate || 0,
          position: item.position,
          organization_id: salesOrder.organization_id,
        }));

        const { error: lineItemError } = await supabase
          .from('invoice_line_item')
          .insert(invoiceLineItems);

        if (lineItemError) {
          console.error('Line item creation error:', lineItemError);
          throw new Error(`Failed to create invoice line items: ${lineItemError.message}`);
        }
      }

      // Create the sales order to invoice link
      const { error: linkError } = await supabase
        .from('sales_order_invoice_link')
        .insert({
          organization_id: profile.organization_id,
          sales_order_id: salesOrderId,
          invoice_id: invoice.id,
          created_by: profile.id
        });

      if (linkError) {
        throw new Error('Failed to link sales order to invoice');
      }

      // Finally, update the sales order status to 'invoiced'
      const { error: updateError } = await supabase
        .from('sales_order')
        .update({ status: 'invoiced' })
        .eq('id', salesOrderId);

      if (updateError) {
        throw new Error('Failed to update sales order status');
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Sales order converted to invoice and line items copied successfully');
      setOpen(false);
      onConversion?.();
    },
    onError: (error: any) => {
      toast.error(`Failed to convert to invoice: ${error.message}`);
    },
  });

  // Only show convert button for approved orders
  if (currentStatus !== 'approved') {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={convertMutation.isPending}
        >
          <FileText className="h-4 w-4" />
          {convertMutation.isPending ? 'Converting...' : 'Convert to Invoice'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convert to Invoice</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to convert this approved sales order to an invoice? This action will create a new invoice and update the sales order status to 'invoiced'.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={convertMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
          >
            {convertMutation.isPending ? 'Converting...' : 'Convert to Invoice'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}