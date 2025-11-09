import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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

export function ClearDatabaseButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const clearDatabase = useMutation({
    mutationFn: async () => {
      const results = {
        invoices: 0,
        items: 0,
        customers: 0,
      };

      // Clear items first (no dependencies)
      const { data: itemData, error: itemError } = await supabase.functions.invoke('clear-items');
      if (itemError) throw new Error(`Failed to clear items: ${itemError.message}`);
      results.items = itemData?.deleted_count || 0;

      // Clear customers (this will also clear invoices and sales orders due to foreign keys)
      const { data: customerData, error: customerError } = await supabase.functions.invoke('clear-customers');
      if (customerError) throw new Error(`Failed to clear customers: ${customerError.message}`);
      results.customers = customerData?.deleted_count || 0;

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(
        `Database cleared: ${data.items} items, ${data.customers} customers (and all related data) deleted`
      );
      setOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to clear database: ${error.message}`);
      console.error('Database clearing error:', error);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Clear Database
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear All Data</AlertDialogTitle>
          <AlertDialogDescription>
            <div>
              This will permanently delete ALL of the following from your organization:
              <ul className="list-disc list-inside mt-2 space-y-1 font-semibold">
                <li>All products/items</li>
                <li>All customers and customer templates</li>
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                Note: Invoices are not deleted by this action. Use the separate invoice clearing function if needed.
              </p>
              <br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearDatabase.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => clearDatabase.mutate()}
            disabled={clearDatabase.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {clearDatabase.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
