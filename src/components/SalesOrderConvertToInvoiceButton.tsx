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
      if (!profile?.id) {
        throw new Error('User not authenticated');
      }

      // For now, we'll manually handle the conversion since the function doesn't exist yet
      const { error } = await supabase
        .from('sales_order')
        .update({ status: 'invoiced' })
        .eq('id', salesOrderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Sales order converted to invoice successfully');
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