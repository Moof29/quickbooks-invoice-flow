import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, startOfDay, eachDayOfInterval, addDays } from "date-fns";
import { CalendarClock, Loader2, AlertCircle, Users, X, ChevronDown } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function GenerateDailyOrdersButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
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

  // Check for existing orders on selected dates
  const { data: existingOrders = [] } = useQuery({
    queryKey: ["existing-orders-check", selectedDates, selectedCustomerIds],
    queryFn: async () => {
      const targetDates = selectedDates.map(d => format(d, "yyyy-MM-dd"));
      
      let query = supabase
        .from("sales_order")
        .select("customer_id, order_number, status, delivery_date")
        .eq("organization_id", organizationId)
        .in("delivery_date", targetDates);

      if (selectedCustomerIds.size > 0) {
        query = query.in("customer_id", Array.from(selectedCustomerIds));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && isOpen && selectedDates.length > 0,
  });

  // Filter templates based on customer selection
  const filteredTemplates = useMemo(() => {
    if (selectedCustomerIds.size === 0) {
      return templates;
    }
    return templates.filter(t => selectedCustomerIds.has(t.customer_id));
  }, [templates, selectedCustomerIds]);

  // Calculate preview counts
  const previewCounts = useMemo(() => {
    // If no dates selected, return zeros
    if (selectedDates.length === 0) {
      return {
        total: filteredTemplates.length,
        willGenerate: 0,
        willSkip: 0,
        skippedOrders: [],
      };
    }

    // For each date, count how many orders would be generated
    let totalWillGenerate = 0;
    let totalWillSkip = 0;
    
    selectedDates.forEach(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const existingForDate = existingOrders.filter(o => o.delivery_date === dateStr);
      const existingCustomerIds = new Set(existingForDate.map(o => o.customer_id));
      
      // If no customer filter, use all templates; otherwise use filtered
      const templatesToCheck = selectedCustomerIds.size === 0 ? templates : filteredTemplates;
      
      const willGenerateForDate = templatesToCheck.filter(t => !existingCustomerIds.has(t.customer_id));
      const willSkipForDate = templatesToCheck.filter(t => existingCustomerIds.has(t.customer_id));
      
      totalWillGenerate += willGenerateForDate.length;
      totalWillSkip += willSkipForDate.length;
    });
    
    return {
      total: filteredTemplates.length,
      willGenerate: totalWillGenerate,
      willSkip: totalWillSkip,
      skippedOrders: existingOrders,
    };
  }, [filteredTemplates, templates, existingOrders, selectedDates, selectedCustomerIds]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      console.log("=== Generating orders for dates:", selectedDates);
      
      const targetDates = selectedDates.map(d => format(d, "yyyy-MM-dd"));
      const customerIds = selectedCustomerIds.size > 0 
        ? Array.from(selectedCustomerIds) 
        : undefined;
      
      // SINGLE API CALL for all dates and customers
      const { data, error } = await supabase.functions.invoke("generate-daily-orders", {
        body: { 
          target_dates: targetDates,
          customer_ids: customerIds
        },
      });

      if (error) {
        console.error("Generate orders error:", error);
        throw error;
      }
      
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
          description: `Generated ${orders_created} sales order(s) for ${selectedDates.length} date(s).`,
        });
      }
      
      setIsOpen(false);
      
      // Auto-select the first generated date in the filter
      if (selectedDates.length > 0) {
        navigate(`/sales-orders?date=${format(selectedDates[0], "yyyy-MM-dd")}`);
      }
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
    // Validation: Don't allow past dates
    const hasPastDates = selectedDates.some(date => isPast(startOfDay(date)) && !isToday(date));
    if (hasPastDates) {
      toast({
        title: "Invalid date",
        description: "Cannot generate orders for dates in the past.",
        variant: "destructive",
      });
      return;
    }

    // Validation: Check if dates selected
    if (selectedDates.length === 0) {
      toast({
        title: "No dates selected",
        description: "Please select at least one delivery date.",
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
          : "All selected customers already have orders for the selected dates.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate();
  };

  const isToday = (date: Date) => {
    const today = startOfDay(new Date());
    return startOfDay(date).getTime() === today.getTime();
  };

  const handleDateSelect = (dates: Date[] | undefined) => {
    // Always update with the new dates array (even if empty)
    setSelectedDates(dates || []);
  };

  const handleCustomerToggle = (customerId: string) => {
    const newSet = new Set(selectedCustomerIds);
    if (newSet.has(customerId)) {
      newSet.delete(customerId);
    } else {
      newSet.add(customerId);
    }
    setSelectedCustomerIds(newSet);
  };

  const handleSelectAllCustomers = () => {
    if (selectedCustomerIds.size === templates.length) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(templates.map(t => t.customer_id)));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <CalendarClock className="h-4 w-4 mr-2" />
          Generate Orders
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[95vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Generate Sales Orders from Templates</DialogTitle>
          <DialogDescription>
            Select delivery dates and optionally filter customers to generate sales orders from active templates.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {/* Customer Selection - Compact Multi-Select */}
            <div className="space-y-2">
            <label className="text-sm font-medium">Customer Filter (Optional)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedCustomerIds.size === 0
                    ? `All Customers (${templates.length})`
                    : `${selectedCustomerIds.size} customer(s) selected`}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <div className="p-2 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={handleSelectAllCustomers}
                  >
                    {selectedCustomerIds.size === templates.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {templates.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No active customer templates found
                      </p>
                    ) : (
                      templates.map((template) => {
                        const isChecked = selectedCustomerIds.has(template.customer_id);
                        return (
                          <label
                            key={template.customer_id}
                            className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleCustomerToggle(template.customer_id)}
                            />
                            <span className="text-sm flex-1">
                              {template.customer_profile.company_name}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            {selectedCustomerIds.size > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Array.from(selectedCustomerIds).slice(0, 3).map(customerId => {
                  const template = templates.find(t => t.customer_id === customerId);
                  return template ? (
                    <Badge key={customerId} variant="secondary" className="text-xs">
                      {template.customer_profile.company_name}
                    </Badge>
                  ) : null;
                })}
                {selectedCustomerIds.size > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedCustomerIds.size - 3} more
                  </Badge>
                )}
              </div>
            )}
            </div>

            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Delivery Dates (Click to select multiple)</label>
              <div className="flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={handleDateSelect}
                  disabled={(date) => isPast(startOfDay(date)) && !isToday(date)}
                  initialFocus
                  className={cn("rounded-md border pointer-events-auto")}
                />
              </div>
            </div>
            
            {/* Selected Dates Display */}
            {selectedDates.length > 0 && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {selectedDates.length} Date(s) Selected:
                </div>
                {selectedDates.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDates([])}
                  >
                    Clear All
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDates.map((date, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1"
                  >
                    {format(date, "MMM d, yyyy")}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDates(selectedDates.filter((_, i) => i !== index));
                      }}
                    />
                  </Badge>
                ))}
              </div>
            </div>
            )}

            {/* Preview Counts */}
            {selectedDates.length > 0 && previewCounts.total > 0 && (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Generation Preview:</div>
                  <div className="text-sm space-y-1">
                    <div>✓ Will generate <strong>{previewCounts.willGenerate}</strong> new order(s) across {selectedDates.length} date(s)</div>
                    {previewCounts.willSkip > 0 && (
                      <div className="text-yellow-700 dark:text-yellow-400">
                        ⚠ Will skip <strong>{previewCounts.willSkip}</strong> order(s) - already exist
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* No templates warning */}
            {templates.length === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No active customer templates found. Create customer templates first.
                </AlertDescription>
              </Alert>
            )}

            {/* No dates selected warning */}
            {selectedDates.length === 0 && templates.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please select at least one delivery date to see generation preview.
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
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-4 border-t mt-auto">
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
