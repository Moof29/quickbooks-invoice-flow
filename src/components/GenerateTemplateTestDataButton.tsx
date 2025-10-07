import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Database, Loader2 } from 'lucide-react';
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

export function GenerateTemplateTestDataButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const generateTestData = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-template-test-data');
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customer-templates'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(
        `Successfully created ${data.templates_created} templates with ${data.items_created} items and ${data.orders_generated} sales orders`
      );
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
          <Database className="h-4 w-4" />
          Fill Templates
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate Template Test Data</AlertDialogTitle>
          <AlertDialogDescription>
            This will create customer templates with realistic item quantities for each day of the week,
            then generate today's sales orders from those templates. This gives you real-world data to test with.
            <br /><br />
            <strong>What will be created:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Customer templates for each customer</li>
              <li>5-10 items per template with varying daily quantities</li>
              <li>Sales orders generated from the templates for today</li>
            </ul>
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
                <Database className="h-4 w-4 mr-2" />
                Generate Data
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
