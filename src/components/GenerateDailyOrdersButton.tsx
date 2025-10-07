import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, startOfDay } from "date-fns";
import { CalendarClock, Loader2, AlertCircle, Users } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

export function GenerateDailyOrdersButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const { toast } = useToast();
  const { profile } = useAuthProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const organizationId = profile?.organization_id;

  // Fetch active customer templates to show preview
  const { data: templates = [] } = useQuery({
    queryKey: ["active-templates", organizationId],
    queryFn: async () => {
      // Get active templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("customer_templates")
        .select("id, customer_id, name")
        .eq("organization_id", organizationId)
        .eq("is_active", true);

      if (templatesError) {
        console.error("Error fetching templates:", templatesError);
        throw templatesError;
      }

      if (!templatesData || templatesData.length === 0) {
        return [];
      }

      // Get customer details
      const customerIds = [...new Set(templatesData.map(t => t.customer_id))];
      const { data: customersData, error: customersError } = await supabase
        .from("customer_profile")
        .select("id, company_name")
        .in("id", customerIds);

      if (customersError) {
        console.error("Error fetching customers:", customersError);
        return templatesData.map(t => ({ ...t, customer_profile: { company_name: "Unknown" } }));
      }

      // Merge data
      const customerMap = new Map(customersData?.map(c => [c.id, c]) || []);
      return templatesData.map(t => ({
        ...t,
        customer_profile: customerMap.get(t.customer_id) || { id: t.customer_id, company_name: "Unknown" }
      }));
    },
    enabled: !!organizationId && isOpen,
  });

  // Check for existing orders on selected date
  const { data: existingOrders = [] } = useQuery({
    queryKey: ["existing-orders-check", selectedDate, selectedCustomerId],
    queryFn: async () => {
      const targetDate = format(selectedDate, "yyyy-MM-dd");
      
      let query = supabase
        .from("sales_order")
        .select("customer_id, order_number, status")
        .eq("organization_id", organizationId)
        .eq("delivery_date", targetDate);

      if (selectedCustomerId !== "all") {
        query = query.eq("customer_id", selectedCustomerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && isOpen,
  });

  // Filter templates based on customer selection
  const filteredTemplates = useMemo(() => {
    if (selectedCustomerId === "all") {
      return templates;
    }
    return templates.filter(t => t.customer_id === selectedCustomerId);
  }, [templates, selectedCustomerId]);

  // Calculate preview counts
  const previewCounts = useMemo(() => {
    const existingCustomerIds = new Set(existingOrders.map(o => o.customer_id));
    const willGenerate = filteredTemplates.filter(t => !existingCustomerIds.has(t.customer_id));
    const willSkip = filteredTemplates.filter(t => existingCustomerIds.has(t.customer_id));
    
    return {
      total: filteredTemplates.length,
      willGenerate: willGenerate.length,
      willSkip: willSkip.length,
      skippedOrders: existingOrders,
    };
  }, [filteredTemplates, existingOrders]);

  const generateMutation = useMutation({
    mutationFn: async (targetDate: string) => {
      console.log("=== Generating orders for date:", targetDate);
      
      const body: any = { target_date: targetDate };
      if (selectedCustomerId !== "all") {
        body.customer_id = selectedCustomerId;
      }

      const { data, error } = await supabase.functions.invoke("generate-daily-orders", {
        body,
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
      const targetDate = format(selectedDate, "yyyy-MM-dd");
      
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
      
      // Auto-select the generated date in the filter
      navigate(`/sales-orders?date=${targetDate}`);
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
    
    // Validation: Don't allow past dates
    if (isPast(startOfDay(selectedDate)) && !isToday(selectedDate)) {
      toast({
        title: "Invalid date",
        description: "Cannot generate orders for dates in the past.",
        variant: "destructive",
      });
      return;
    }

    // Validation: Check if there are templates to generate from
    if (previewCounts.willGenerate === 0) {
      toast({
        title: "No orders to generate",
        description: previewCounts.total === 0 
          ? "No active customer templates found." 
          : "All customers already have orders for this date.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate(targetDate);
  };

  const isToday = (date: Date) => {
    const today = startOfDay(new Date());
    return startOfDay(date).getTime() === today.getTime();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <CalendarClock className="h-4 w-4 mr-2" />
          Generate Orders
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Generate Sales Orders from Templates</DialogTitle>
          <DialogDescription>
            Select a delivery date to generate sales orders from active customer templates.
            Orders will use the quantities configured for the selected day of the week.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Customer Filter (Optional)</label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers ({templates.length})</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.customer_id} value={template.customer_id}>
                    {template.customer_profile.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Delivery Date</label>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => isPast(startOfDay(date)) && !isToday(date)}
                initialFocus
                className={cn("rounded-md border")}
              />
            </div>
          </div>
          
          {/* Selected Date Display */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-1">Selected Delivery Date:</div>
            <div className="text-lg font-semibold text-primary">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </div>
          </div>

          {/* Preview Counts */}
          {previewCounts.total > 0 && (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Generation Preview:</div>
                <div className="text-sm space-y-1">
                  <div>✓ Will generate <strong>{previewCounts.willGenerate}</strong> new order(s)</div>
                  {previewCounts.willSkip > 0 && (
                    <div className="text-yellow-700 dark:text-yellow-400">
                      ⚠ Will skip <strong>{previewCounts.willSkip}</strong> customer(s) - orders already exist
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* No templates warning */}
          {previewCounts.total === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No active customer templates found. Create customer templates first.
              </AlertDescription>
            </Alert>
          )}

          {/* Info Note */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex gap-2">
              <div className="text-blue-600 dark:text-blue-400 text-sm">
                <strong>Note:</strong> Orders will be created with status "pending" and can be reviewed before invoicing.
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
            disabled={generateMutation.isPending || previewCounts.willGenerate === 0}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4 mr-2" />
                Generate {previewCounts.willGenerate} Order(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
