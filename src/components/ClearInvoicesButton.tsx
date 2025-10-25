import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
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

export function ClearInvoicesButton() {
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const handleClearInvoices = async () => {
    setIsClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('clear-invoices');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Clearing Started',
          description: 'Clearing invoices in background. Refresh the page in a few seconds to see results.',
        });
        
        // Wait 2 seconds before refreshing to allow background task to start
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data?.error || 'Failed to clear invoices');
      }
    } catch (error: any) {
      console.error('Error clearing invoices:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isClearing}>
          {isClearing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Clearing...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Invoices
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all invoices and reset sales orders back to "reviewed" status.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClearInvoices} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Clear All Invoices
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
