import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { format, parseISO, isToday, isTomorrow, isFuture, isPast, addDays } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
  Search,
  Lock,
  Ban,
  ChevronDown,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BulkInvoiceActions } from "@/components/sales-orders/BulkInvoiceActions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date: string;
  status: string;
  total: number;
  customer_profile: {
    company_name: string;
  };
  invoice_line_item: { count: number }[];
}

export function ModernSalesOrdersList() {
  const { profile } = useAuthProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Calculate 7-day delivery dates
  const deliveryDates = useMemo(() => {
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const date = addDays(new Date(), i);
      dates.push({
        date: format(date, 'yyyy-MM-dd'),
        label: i === 1 ? 'Tomorrow' : format(date, 'EEEE M/d')
      });
    }
    return dates;
  }, []);

  // Get date filter from URL params or default to tomorrow
  const [deliveryDateFilter, setDeliveryDateFilter] = useState<string>(() => {
    const dateParam = searchParams.get('date');
    return dateParam || deliveryDates[0].date;
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [isBatchInvoicing, setIsBatchInvoicing] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [showNoOrdersDialog, setShowNoOrdersDialog] = useState(false);
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [allPagesPendingCount, setAllPagesPendingCount] = useState(0);

  const organizationId = profile?.organization_id;

  // Fetch orders with pagination
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["sales-orders", organizationId, deliveryDateFilter, statusFilter, selectedDates, currentPage],
    queryFn: async () => {
      console.log('🔍 Fetching sales orders...');
      
      // Calculate offset for pagination
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Build base query - explicit any to avoid TS deep instantiation
      let query: any = supabase
        .from("invoice_record")
        .select('*', { count: 'exact' })
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .range(from, to); // Pagination

      // Filter by delivery_date based on selection
      if (selectedDates.length > 0) {
        // Multiple dates selected
        const dateStrings = selectedDates.map(date => format(date, "yyyy-MM-dd"));
        query = query.in("delivery_date", dateStrings);
      } else if (deliveryDateFilter !== "all") {
        // Single date selected (legacy support)
        query = query.eq("delivery_date", deliveryDateFilter);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Fetch paginated orders
      const { data, error, count } = await query;
      if (error) throw error;

      console.log(`📊 Fetched ${data?.length || 0} orders (Page ${currentPage}, Total: ${count})`);

      // Show dialog if no orders for specific date
      if (deliveryDateFilter !== "all" && (!data || data.length === 0)) {
        setShowNoOrdersDialog(true);
      }

      // Fetch customer names and line item counts separately
      const ordersWithDetails = await Promise.all(
        (data || []).map(async (order: any) => {
          const { data: customer } = await supabase
            .from('customer_profile')
            .select('company_name')
            .eq('id', order.customer_id)
            .single();
          
          const { count: itemCount } = await supabase
            .from('invoice_line_item')
            .select('*', { count: 'exact', head: true })
            .eq('invoice_id', order.id);

          return {
            ...order,
            customer_profile: { company_name: customer?.company_name || 'Unknown' },
            invoice_line_item: [{ count: itemCount || 0 }]
          };
        })
      );

      return { orders: ordersWithDetails as SalesOrder[], totalCount: count || 0 };
    },
    enabled: !!organizationId,
    staleTime: 0, // Always fetch fresh data
  });

  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Delete mutation (only for non-invoiced orders)
  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Double-check order is not invoiced/cancelled
      const { data: order } = await supabase
        .from("invoice_record")
        .select("status")
        .eq("id", orderId)
        .single();
      
      if (order && ['invoiced', 'cancelled'].includes(order.status)) {
        throw new Error("Cannot delete invoiced or cancelled orders");
      }

      const { error } = await supabase.from("invoice_record").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast({ title: "Order deleted successfully" });
      setDeleteOrderId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel order mutation (cancels pending invoice)
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Call the cancel edge function which handles status update and NO ORDER line item
      const { data, error } = await supabase.functions.invoke(
        "convert-order-to-invoice",
        { body: { invoiceId: orderId, action: 'cancel' } }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to cancel order");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast({
        title: "Order canceled",
        description: "A 'No Order Today' invoice has been created",
      });
      setCancelOrderId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error canceling order",
        description: error.message,
        variant: "destructive",
      });
      setCancelOrderId(null);
    },
  });

  // Removed old batchInvoiceMutation - now using BulkInvoiceActions component

  // Batch delete mutation
  const batchDeleteMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      // Process in chunks to avoid URL length limits (max ~50 IDs per request)
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        chunks.push(orderIds.slice(i, i + CHUNK_SIZE));
      }

      let totalDeleted = 0;
      let totalInvoiced = 0;
      const allInvoicedOrderNumbers: string[] = [];

      // Process each chunk
      for (const chunk of chunks) {
        // Check which orders are invoiced/cancelled
        const { data: ordersToCheck, error: checkError } = await supabase
          .from("invoice_record")
          .select("id, status, invoice_number")
          .in("id", chunk);
        
        if (checkError) throw checkError;
        
        const invoicedOrders = (ordersToCheck || []).filter((o: any) => ['invoiced', 'cancelled'].includes(o.status));
        const deletableOrders = (ordersToCheck || []).filter((o: any) => !['invoiced', 'cancelled'].includes(o.status));
        
        // Delete non-invoiced orders
        if (deletableOrders.length > 0) {
          const { error: deleteError } = await supabase
            .from("invoice_record")
            .delete()
            .in("id", deletableOrders.map((o: any) => o.id));
          
          if (deleteError) throw deleteError;
          totalDeleted += deletableOrders.length;
        }
        
        totalInvoiced += invoicedOrders.length;
        allInvoicedOrderNumbers.push(...invoicedOrders.map((o: any) => o.invoice_number));
      }
      
      return {
        deleted: totalDeleted,
        invoiced: totalInvoiced,
        invoicedOrderNumbers: allInvoicedOrderNumbers,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      setSelectedOrders(new Set());
      
      if (result.invoiced > 0) {
        toast({
          title: "Batch delete completed with warnings",
          description: `Deleted ${result.deleted} order(s). ${result.invoiced} invoiced order(s) skipped and must be handled from Invoice module.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Batch delete complete",
          description: `${result.deleted} order(s) deleted successfully`,
        });
      }
      setIsBatchDeleting(false);
      setShowBatchDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Batch delete failed",
        description: error.message,
        variant: "destructive",
      });
      setIsBatchDeleting(false);
      setShowBatchDeleteDialog(false);
    },
  });

  // Filter orders by search query and sort
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    // Filter by search query
    let filtered = orders;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = orders.filter(order => 
        order.order_number?.toLowerCase().includes(query) ||
        order.customer_profile?.company_name?.toLowerCase().includes(query) ||
        order.total?.toString().includes(query)
      );
    }
    
    const statusOrder = { 'pending': 1, 'invoiced': 2, 'cancelled': 3 };
    
    // Sort logic depends on filter selection
    if (deliveryDateFilter === 'all') {
      // When viewing all dates: sort by delivery date first (nearest first), then by status
      return [...filtered].sort((a, b) => {
        // First compare delivery dates (nearest first)
        const dateCompare = new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        
        // Within same date, sort by status
        const statusA = statusOrder[a.status as keyof typeof statusOrder] || 999;
        const statusB = statusOrder[b.status as keyof typeof statusOrder] || 999;
        return statusA - statusB;
      });
    } else {
      // When viewing specific date: sort by status only
      return [...filtered].sort((a, b) => {
        const statusA = statusOrder[a.status as keyof typeof statusOrder] || 999;
        const statusB = statusOrder[b.status as keyof typeof statusOrder] || 999;
        return statusA - statusB;
      });
    }
  }, [orders, searchQuery, deliveryDateFilter]);

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
  };

  // Group orders by delivery date (always enabled when viewing all dates)
  const groupedByDate = useMemo(() => {
    if (deliveryDateFilter !== 'all' && selectedDates.length === 0) {
      return null;
    }

    const grouped = new Map<string, SalesOrder[]>();
    filteredOrders.forEach(order => {
      const dateKey = order.delivery_date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(order);
    });

    // Sort dates
    return Array.from(grouped.entries()).sort((a, b) => 
      new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [deliveryDateFilter, filteredOrders]);

  // Group orders by customer (optional when viewing all dates)
  const groupedByCustomer = useMemo(() => {
    if (!groupByCustomer || (deliveryDateFilter !== 'all' && selectedDates.length === 0)) {
      return null;
    }

    const grouped = new Map<string, SalesOrder[]>();
    filteredOrders.forEach(order => {
      const customerKey = order.customer_profile?.company_name || 'Unknown Customer';
      if (!grouped.has(customerKey)) {
        grouped.set(customerKey, []);
      }
      grouped.get(customerKey)!.push(order);
    });

    // Sort by customer name
    return Array.from(grouped.entries()).sort((a, b) => 
      a[0].localeCompare(b[0])
    );
  }, [groupByCustomer, deliveryDateFilter, filteredOrders]);

  // Determine which grouping to use
  const finalGrouping = groupByCustomer ? groupedByCustomer : groupedByDate;

  // Initialize expanded groups when grouping changes
  useEffect(() => {
    if (finalGrouping) {
      const allKeys = new Set(finalGrouping.map(([key]) => key));
      setExpandedGroups(allKeys);
    }
  }, [finalGrouping]);

  // Check if all groups are expanded
  const allExpanded = finalGrouping ? 
    finalGrouping.every(([key]) => expandedGroups.has(key)) : 
    false;

  // Toggle expand/collapse all groups
  const toggleAllGroups = () => {
    if (finalGrouping) {
      if (allExpanded) {
        setExpandedGroups(new Set());
      } else {
        const allKeys = new Set(finalGrouping.map(([key]) => key));
        setExpandedGroups(allKeys);
      }
    }
  };

  // Toggle individual group
  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const pendingCount = filteredOrders?.filter(o => o.status === "pending").length || 0;

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, label: "Pending", icon: Clock, className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
      invoiced: { variant: "default" as const, label: "Invoiced", icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
      cancelled: { variant: "destructive" as const, label: "Cancelled", icon: XCircle, className: "" },
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getDeliveryBadge = (deliveryDate: string) => {
    const date = parseISO(deliveryDate);
    if (isToday(date))
      return <Badge variant="default">Today</Badge>;
    if (isTomorrow(date))
      return <Badge variant="secondary">Tomorrow</Badge>;
    if (isPast(date))
      return <Badge variant="destructive">Past Due</Badge>;
    if (isFuture(date))
      return <Badge variant="outline">Upcoming</Badge>;
    return null;
  };

  // Removed handleBatchInvoice - now using BulkInvoiceActions component

  const handleBatchDelete = () => {
    const orderIds = Array.from(selectedOrders);
    setIsBatchDeleting(true);
    batchDeleteMutation.mutate(orderIds);
  };

  const handleSelectAll = () => {
    const selectableOrders = filteredOrders?.filter((o) => o.status === 'pending') || [];
    const newSelected = new Set(selectedOrders);
    const allSelected = selectableOrders.every((o) => newSelected.has(o.id));

    if (allSelected) {
      selectableOrders.forEach((o) => newSelected.delete(o.id));
      setSelectAllPages(false);
      setAllPagesPendingCount(0);
    } else {
      selectableOrders.forEach((o) => newSelected.add(o.id));
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAllPages = async () => {
    if (!organizationId) return;
    
      // Fetch ALL pending order IDs matching current filters
      let query: any = supabase
        .from("invoice_record")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("status", "pending"); // Only pending orders

    // Apply same filters as main query
    if (selectedDates.length > 0) {
      const dateStrings = selectedDates.map(date => format(date, "yyyy-MM-dd"));
      query = query.in("delivery_date", dateStrings);
    } else if (deliveryDateFilter !== "all") {
      query = query.eq("delivery_date", deliveryDateFilter);
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    
    if (error) {
      toast({
        title: "Error selecting all",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const allSelectableIds = data?.map(o => o.id) || [];
    const pendingCount = data?.filter(o => o.status === "pending").length || 0;
    
    setSelectedOrders(new Set(allSelectableIds));
    setSelectAllPages(true);
    setAllPagesPendingCount(pendingCount);
  };

  const handleSelectAllPending = () => {
    const pendingOrders = filteredOrders?.filter((o) => o.status === "pending") || [];
    const newSelected = new Set(selectedOrders);
    const allSelected = pendingOrders.every((o) => newSelected.has(o.id));

    if (allSelected) {
      pendingOrders.forEach((o) => newSelected.delete(o.id));
    } else {
      pendingOrders.forEach((o) => newSelected.add(o.id));
    }
    setSelectedOrders(newSelected);
  };

  const selectedPendingCount = selectAllPages 
    ? allPagesPendingCount 
    : Array.from(selectedOrders).filter(id => 
        filteredOrders?.find(o => o.id === id && o.status === "pending")
      ).length;

  console.log(`🎯 Rendering component with ${filteredOrders?.length || 0} orders`);
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">Loading orders...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Filter Orders</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[240px] justify-start text-left font-normal",
                      selectedDates.length === 0 && deliveryDateFilter === "all" && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDates.length > 0
                      ? `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected`
                      : deliveryDateFilter === "all" || deliveryDateFilter === "custom"
                        ? "All Dates" 
                        : format(parseISO(deliveryDateFilter), "PPP")
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b flex justify-between items-center gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start"
                      onClick={() => {
                        setDeliveryDateFilter("all");
                        setSelectedDates([]);
                        setSearchParams({ date: "all" });
                      }}
                    >
                      All Dates
                    </Button>
                    {selectedDates.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDates([]);
                          setDeliveryDateFilter("all");
                          setSearchParams({ date: "all" });
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <CalendarComponent
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => {
                      if (dates) {
                        setSelectedDates(dates);
                        if (dates.length > 0) {
                          setDeliveryDateFilter("custom");
                        } else {
                          setDeliveryDateFilter("all");
                          setSearchParams({ date: "all" });
                        }
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders, customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[250px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bulk Actions */}
      {selectedOrders.size > 0 && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedOrders.size} order(s) selected
                  {selectedPendingCount > 0 && ` • ${selectedPendingCount} pending`}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrders(new Set());
                      setSelectAllPages(false);
                      setAllPagesPendingCount(0);
                    }}
                  >
                    Clear Selection
                  </Button>
                <BulkInvoiceActions
                  selectedOrders={Array.from(selectedOrders)}
                  onComplete={() => {
                    setSelectedOrders(new Set());
                    setIsBatchInvoicing(false);
                  }}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBatchDeleteDialog(true)}
                  disabled={isBatchDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isBatchDeleting ? "Deleting..." : "Delete Selected"}
                </Button>
              </div>
            </div>
            
            {/* Select All Pages Banner */}
            {!selectAllPages && selectedOrders.size > 0 && totalCount > filteredOrders.length && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-md border">
                <span className="text-sm">
                  All {filteredOrders.filter(o => o.status === 'pending').length} orders on this page are selected.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleSelectAllPages}
                  className="h-auto p-0 text-primary font-semibold"
                >
                  Select all {totalCount} orders matching filters
                </Button>
              </div>
            )}
            {selectAllPages && (
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-md border border-primary/20">
                <span className="text-sm font-medium">
                  All {selectedOrders.size} orders matching filters are selected.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSelectedOrders(new Set());
                    setSelectAllPages(false);
                    setAllPagesPendingCount(0);
                  }}
                  className="h-auto p-0 text-primary font-semibold"
                >
                  Clear selection
                </Button>
              </div>
            )}
          </div>
          </CardContent>
        </Card>
      )}

      {/* Orders for selected delivery date */}
      {!filteredOrders || filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {searchQuery ? "No orders match your search." : "No orders found for this delivery date."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>
                    {selectedDates.length > 0
                      ? `${selectedDates.length} Date${selectedDates.length > 1 ? 's' : ''} Selected`
                      : deliveryDateFilter === "all" || deliveryDateFilter === "custom"
                        ? "All Orders" 
                        : format(parseISO(deliveryDateFilter), "EEEE, MMMM d, yyyy")
                    }
                  </CardTitle>
                   <p className="text-sm text-muted-foreground mt-1">
                    {filteredOrders.length} order(s)
                    {pendingCount > 0 && ` • ${pendingCount} ready to invoice`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {deliveryDateFilter !== "all" && deliveryDateFilter !== "custom" && selectedDates.length === 0 && getDeliveryBadge(deliveryDateFilter)}
                {(deliveryDateFilter === "all" || selectedDates.length > 0) && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-accent/50">
                      <Switch
                        id="group-by-customer"
                        checked={groupByCustomer}
                        onCheckedChange={setGroupByCustomer}
                      />
                      <Label htmlFor="group-by-customer" className="text-sm font-medium cursor-pointer">
                        Group by Customer
                      </Label>
                    </div>
                    {finalGrouping && finalGrouping.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleAllGroups}
                        className="gap-2"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
                        {allExpanded ? 'Collapse All' : 'Expand All'}
                      </Button>
                    )}
                  </>
                )}
                {filteredOrders.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-accent/50">
                    <Checkbox
                      checked={filteredOrders
                        .filter((o) => o.status === 'draft')
                        .every((o) => selectedOrders.has(o.id))}
                      onCheckedChange={() => handleSelectAll()}
                    />
                    <span className="text-sm font-medium">Select All</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {finalGrouping ? (
              // Grouped view (by customer or by date)
              finalGrouping.map(([groupKey, orders]) => (
                <Collapsible 
                  key={groupKey} 
                  open={expandedGroups.has(groupKey)}
                  onOpenChange={() => toggleGroup(groupKey)}
                  className="space-y-3"
                >
                  <CollapsibleTrigger className="group flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-all duration-200 w-full data-[state=closed]:bg-muted/50 data-[state=closed]:border-border/50">
                    <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=closed]:rotate-0 group-data-[state=open]:rotate-180 text-muted-foreground group-hover:text-foreground" />
                    {groupByCustomer ? (
                      <>
                        <h3 className="font-semibold text-lg">{groupKey}</h3>
                        <span className="text-sm text-muted-foreground ml-auto">
                          {orders.length} order(s)
                        </span>
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-lg">
                          {format(parseISO(groupKey), "EEEE, MMMM d, yyyy")}
                        </h3>
                        {getDeliveryBadge(groupKey)}
                        <span className="text-sm text-muted-foreground ml-auto">
                          {orders.length} order(s)
                        </span>
                      </>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3">
                    {orders.map((order) => (
              <Card 
                key={order.id} 
                className="border shadow-sm cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/sales-orders/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {order.status === 'draft' && (
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedOrders);
                            if (checked) {
                              newSelected.add(order.id);
                            } else {
                              newSelected.delete(order.id);
                            }
                            setSelectedOrders(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-base">{order.customer_profile.company_name}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.order_number} • Created: {format(parseISO(order.order_date), "MMM dd")} • <span className="font-semibold text-foreground">Delivery: {format(parseISO(order.delivery_date), "MMM dd")}</span> • {order.invoice_line_item?.[0]?.count || 0} items • $
                          {order.total.toFixed(2)}
                        </div>
                      </div>
                    </div>

                     {/* Actions */}
                    <div className="flex items-center gap-2">
                      {order.status === "pending" && !selectedOrders.has(order.id) && (
                        <Button
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const { data, error } = await supabase.functions.invoke(
                                "create-invoice-from-order",
                                { body: { order_id: order.id } }
                              );
                              if (error) throw error;
                              if (!data?.success) throw new Error(data?.error?.message || 'Failed to create invoice');
                              
                              queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
                              toast({ 
                                title: "Invoice created successfully",
                                description: `Invoice ${data.invoice_number} created`
                              });
                            } catch (error: any) {
                              toast({
                                title: "Error creating invoice",
                                description: error.message,
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Receipt className="h-4 w-4 mr-1" />
                          Create Invoice
                        </Button>
                      )}
                      
                      {/* Cancel Order Button (for pending only) */}
                      {order.status === "pending" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelOrderId(order.id);
                                }}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel Order</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Delete Button with Tooltip */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                const canDelete = order.status === 'pending';
                                if (canDelete) {
                                  setDeleteOrderId(order.id);
                                }
                              }}
                              disabled={order.status !== 'pending'}
                              className={order.status !== 'pending' ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {order.status !== 'pending' ? "Cannot delete invoiced orders" : "Delete order"}
                        </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))
            ) : (
              // Non-grouped view
              filteredOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className="border shadow-sm cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/sales-orders/${order.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {order.status === 'draft' && (
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedOrders);
                              if (checked) {
                                newSelected.add(order.id);
                              } else {
                                newSelected.delete(order.id);
                              }
                              setSelectedOrders(newSelected);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-base">{order.customer_profile.company_name}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.order_number} • Created: {format(parseISO(order.order_date), "MMM dd")} • <span className="font-semibold text-foreground">Delivery: {format(parseISO(order.delivery_date), "MMM dd")}</span> • {order.invoice_line_item?.[0]?.count || 0} items • $
                            {order.total.toFixed(2)}
                          </div>
                        </div>
                      </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                        {order.status === "pending" && !selectedOrders.has(order.id) && (
                          <Button
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const { data, error } = await supabase.functions.invoke(
                                  "create-invoice-from-order",
                                  { body: { order_id: order.id } }
                                );
                                if (error) throw error;
                                if (!data?.success) throw new Error(data?.error?.message || 'Failed to create invoice');
                                
                                queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
                                toast({ 
                                  title: "Invoice created successfully",
                                  description: `Invoice ${data.invoice_number} created`
                                });
                              } catch (error: any) {
                                toast({
                                  title: "Error creating invoice",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Create Invoice
                          </Button>
                        )}
                        
                        {/* Cancel Order Button (for pending only) */}
                        {order.status === "pending" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCancelOrderId(order.id);
                                  }}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cancel Order</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Delete Button with Tooltip */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  if (order.status === 'pending') {
                                    setDeleteOrderId(order.id);
                                  }
                                }}
                                disabled={order.status !== 'pending'}
                                className={order.status !== 'pending' ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {order.status !== 'pending' ? "Cannot delete invoiced orders" : "Delete order"}
                          </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOrderId && deleteMutation.mutate(deleteOrderId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={!!cancelOrderId} onOpenChange={() => setCancelOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This will create a "No Order Today" invoice for tracking purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelOrderId && cancelOrderMutation.mutate(cancelOrderId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrders.size} order(s)? 
              {" "}Invoiced orders will be skipped and must be handled from the Invoice module. 
              This action cannot be undone for non-invoiced orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBatchDeleting ? "Deleting..." : "Delete Orders"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No Orders Dialog */}
      <AlertDialog open={showNoOrdersDialog} onOpenChange={setShowNoOrdersDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Orders Found</AlertDialogTitle>
            <AlertDialogDescription>
              There are no orders for the selected delivery date
              {selectedDates.length > 0 
                ? ` (${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected)`
                : deliveryDateFilter !== "all" && deliveryDateFilter !== "custom"
                  ? ` (${format(parseISO(deliveryDateFilter), "MMMM d, yyyy")})`
                  : ""
              }.
              {" "}You can create a new order using the "New Order" button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowNoOrdersDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Card className="border-0 shadow-sm mt-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} orders
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
