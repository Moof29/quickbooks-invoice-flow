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
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase.rpc('approve_sales_order', {
        p_sales_order_id: salesOrderId,
        p_approved_by: profile.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      toast.success('Sales order approved successfully');
      setOpen(false);
      onApproval?.();
    },
    onError: (error: any) => {
      toast.error(`Failed to approve sales order: ${error.message}`);
    },
  });

  // Only show approval button for pending orders
  if (currentStatus !== 'pending') {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="default" 
          className="flex items-center gap-2"
          disabled={approveMutation.isPending}
        >
          <CheckCircle className="h-4 w-4" />
          {approveMutation.isPending ? 'Approving...' : 'Approve Order'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve Sales Order</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to approve this sales order? Once approved, it can be converted to an invoice and synced to QuickBooks.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={approveMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}