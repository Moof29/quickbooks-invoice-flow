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
import { CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SalesOrderApprovalButtonProps {
  salesOrderId: string;
  currentStatus: string;
  onApproval?: () => void;
}

export function SalesOrderApprovalButton({ 
  salesOrderId, 
  currentStatus, 
  onApproval 
}: SalesOrderApprovalButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { profile } = useAuthProfile();
  const { toast } = useToast();

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) {
        throw new Error('User not authenticated');
      }

      // Call the convert-order-to-invoice edge function to convert pending -> invoiced
      const { data, error } = await supabase.functions.invoke(
        "convert-order-to-invoice",
        { body: { invoiceId: salesOrderId, action: 'approve' } }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to approve order');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      toast({ 
        title: 'Sales order approved',
        description: 'This order is now approved and ready for delivery.'
      });
      setOpen(false);
      onApproval?.();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to approve order',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Only show confirm button for draft orders
  if (currentStatus !== 'draft') {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="default" 
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          disabled={reviewMutation.isPending}
        >
          <CheckCircle2 className="h-4 w-4" />
          {reviewMutation.isPending ? 'Confirming...' : 'Confirm Order'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Order</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to confirm this order? Once confirmed, it will be ready for delivery and fulfillment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reviewMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => reviewMutation.mutate()}
            disabled={reviewMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {reviewMutation.isPending ? 'Confirming...' : 'Confirm Order'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}