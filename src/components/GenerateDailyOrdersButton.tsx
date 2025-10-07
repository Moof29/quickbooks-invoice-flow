import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function GenerateDailyOrdersButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (targetDate: string) => {
      console.log("=== Generating orders for date:", targetDate);
      
      const { data, error } = await supabase.functions.invoke("generate-daily-orders", {
        body: { target_date: targetDate },
      });

      if (error) {
        console.error("Generate orders error:", error);
        throw error;
      }

      console.log("Generate orders response:", data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      
      const { orders_created, errors } = data;
      
      if (errors && errors.length > 0) {
        toast({
          title: "Orders generated with warnings",
          description: `Created ${orders_created} order(s). ${errors.length} error(s) occurred.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Success!",
          description: `Generated ${orders_created} sales order(s) from active customer templates.`,
        });
      }
      
      setIsOpen(false);
    },
    onError: (error: any) => {
      console.error("Generate mutation error:", error);
      toast({
        title: "Error generating orders",
        description: error.message || "Failed to generate orders. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    const targetDate = format(selectedDate, "yyyy-MM-dd");
    generateMutation.mutate(targetDate);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <CalendarClock className="h-4 w-4 mr-2" />
          Generate Orders
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Sales Orders from Templates</DialogTitle>
          <DialogDescription>
            Select a delivery date to generate sales orders from all active customer templates.
            Orders will use the quantities configured for the selected day of the week.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
              className={cn("rounded-md border pointer-events-auto")}
            />
          </div>
          
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-1">Selected Delivery Date:</div>
            <div className="text-lg font-semibold text-primary">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex gap-2">
              <div className="text-blue-600 dark:text-blue-400 text-sm">
                <strong>Note:</strong> This will create orders for all active customer templates. 
                If an order already exists for a customer on this date, it will be skipped.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={generateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4 mr-2" />
                Generate Orders
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
