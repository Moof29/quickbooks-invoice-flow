import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
} from '@/components/ui/alert-dialog';
import { FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const navigate = useNavigate();
  const { toast } = useToast();

  const convertMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-invoice-from-order', {
        body: { order_id: salesOrderId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create invoice');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      toast({
        title: 'Invoice created successfully',
        description: `Invoice ${data.invoice?.invoice_number} created for ${data.invoice?.customer_name}`,
      });
      
      setOpen(false);
      onConversion?.();
      
      // Navigate to invoice detail page if invoice ID is available
      if (data.invoice?.id) {
        navigate(`/invoices/${data.invoice.id}`);
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to create invoice';
      toast({
        title: 'Error creating invoice',
        description: errorMessage,
        variant: 'destructive',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => convertMutation.mutate()}
          >
            Retry
          </Button>
        ),
      });
    },
  });

  const handleInvoiceClick = () => {
    // If pending, show confirmation dialog
    if (currentStatus === 'pending') {
      setOpen(true);
    } else {
      // If reviewed, proceed directly
      convertMutation.mutate();
    }
  };

  // Show button for pending OR reviewed orders (not already invoiced)
  if (currentStatus !== 'pending' && currentStatus !== 'reviewed') {
    return null;
  }

  return (
    <>
      <Button 
        onClick={handleInvoiceClick}
        disabled={convertMutation.isPending}
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        {convertMutation.isPending ? 'Creating Invoice...' : 'Create Invoice'}
      </Button>

      {/* Confirmation dialog for pending orders */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip Review Step?</AlertDialogTitle>
            <AlertDialogDescription>
              This order is still pending. Do you want to skip the review step and create an invoice now?
              <br /><br />
              Normally, orders should be reviewed before invoicing.
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
              {convertMutation.isPending ? 'Creating...' : 'Yes, Invoice Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}