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
      // Use the unified clear-all-data function for better reliability and performance
      const { data, error } = await supabase.functions.invoke('clear-all-data');
      if (error) throw new Error(`Failed to clear data: ${error.message}`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      
      const counts = data?.deletionCounts || {};
      toast.success(
        `Database cleared successfully: ${counts.items || 0} items, ${counts.customers || 0} customers, ${counts.invoices || 0} invoices deleted`
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
                <li>All invoices, payments, and related records</li>
                <li>All estimates, credit memos, and sales receipts</li>
                <li>All customer messages and payment methods</li>
              </ul>
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
