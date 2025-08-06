import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TestTube, Loader2 } from 'lucide-react';
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

export function GenerateTestDataButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const generateTestData = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-test-sales-orders');
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(`Successfully created ${data.orders} test sales orders with ${data.lineItems} line items`);
      setOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to generate test data: ${error.message}`);
      console.error('Test data generation error:', error);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <TestTube className="h-4 w-4" />
          Generate Test Data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate Test Sales Orders</AlertDialogTitle>
          <AlertDialogDescription>
            This will create 20 fake sales orders with random data for testing purposes. 
            The orders will be distributed across different statuses (pending, approved, invoiced) 
            and will include line items from your existing items catalog.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={generateTestData.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => generateTestData.mutate()}
            disabled={generateTestData.isPending}
          >
            {generateTestData.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Generate Test Data
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}