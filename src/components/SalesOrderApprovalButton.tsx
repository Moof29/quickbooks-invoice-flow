import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { useOrderLifecycle } from '@/hooks/useOrderLifecycle';
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
  const { convertOrder, isConverting } = useOrderLifecycle();

  const handleApproval = async () => {
    if (!profile?.id) {
      toast({ 
        title: 'Authentication required',
        description: 'Please log in to approve orders',
        variant: 'destructive'
      });
      return;
    }

    try {
      await convertOrder({ invoiceId: salesOrderId, action: 'invoice' });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      toast({ 
        title: 'Sales order approved',
        description: 'This order is now approved and ready for delivery.'
      });
      setOpen(false);
      onApproval?.();
    } catch (error: any) {
      toast({ 
        title: 'Failed to approve order',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

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
          disabled={isConverting}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isConverting ? 'Confirming...' : 'Confirm Order'}
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
          <AlertDialogCancel disabled={isConverting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleApproval}
            disabled={isConverting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isConverting ? 'Confirming...' : 'Confirm Order'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}