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

      const { error } = await supabase
        .from("sales_order")
        .update({ 
          status: "reviewed", 
          approved_at: new Date().toISOString(),
          approved_by: profile.id
        })
        .eq("id", salesOrderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      toast({ 
        title: 'Order marked as reviewed',
        description: 'This order is now ready to be invoiced.'
      });
      setOpen(false);
      onApproval?.();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to review order',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Only show review button for pending orders
  if (currentStatus !== 'pending') {
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
          {reviewMutation.isPending ? 'Reviewing...' : 'Mark as Reviewed'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark Order as Reviewed</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to mark this sales order as reviewed? Once reviewed, it can be converted to an invoice.
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
            {reviewMutation.isPending ? 'Reviewing...' : 'Mark as Reviewed'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}