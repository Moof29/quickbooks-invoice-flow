import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Loader2, Search, X, CheckCircle, XCircle, Clock, DollarSign, Ban, AlertCircle, CalendarIcon } from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { MobileFAB } from "@/components/MobileFAB";
import { useOrderLifecycle } from "@/hooks/useOrderLifecycle";
import { GenerateDailyOrdersButton } from "@/components/GenerateDailyOrdersButton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type OrderStatus = 'pending' | 'invoiced' | 'cancelled' | 'all';

// Helper to get default delivery dates based on current day of week
const getDefaultDeliveryDates = () => {
  const today = startOfDay(new Date());
  const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
  
  const dates: Date[] = [];
  
  if (dayOfWeek === 5) {
    // Friday: Show Saturday, Sunday, Monday
    dates.push(addDays(today, 1)); // Saturday
    dates.push(addDays(today, 2)); // Sunday
    dates.push(addDays(today, 3)); // Monday
  } else if (dayOfWeek === 6) {
    // Saturday: Show Sunday, Monday
    dates.push(addDays(today, 1)); // Sunday
    dates.push(addDays(today, 2)); // Monday
  } else if (dayOfWeek === 0) {
    // Sunday: Show Monday
    dates.push(addDays(today, 1)); // Monday
  } else {
    // Monday-Thursday: Show tomorrow
    dates.push(addDays(today, 1)); // Tomorrow
  }
  
  return dates;
};

const SalesOrders = () => {
  const { organization } = useAuthProfile();
  const organizationId = organization?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('pending');
  const [searchQuery, setSearchQuery] = useState("");
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, any>>({});
  const [selectedDates, setSelectedDates] = useState<Date[]>(getDefaultDeliveryDates());
  
  const { convertOrder, isConverting, convertingInvoiceId } = useOrderLifecycle();

  // Real-time subscription for order updates (all statuses)
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('sales-order-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoice_record',
          filter: `organization_id=eq.${organizationId}`  // Listen to all status changes
        },
        (payload) => {
          console.log('Order updated in real-time:', payload);
          // Invalidate queries to refresh the data
          queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
          queryClient.invalidateQueries({ queryKey: ['sales-orders-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  // Fetch all orders for stats (from invoice_record)
  const { data: allOrders } = useQuery({
    queryKey: ['sales-orders-stats', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('invoice_record')
        .select('id, status, total')
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'invoiced', 'cancelled']);  // All order statuses

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  }) as any;

  // Calculate stats
  const stats = useMemo(() => {
    if (!allOrders) return { pending: 0, invoiced: 0, cancelled: 0, totalValue: 0 };
    
    return allOrders.reduce((acc, order) => {
      if (order.status === 'pending') acc.pending++;
      if (order.status === 'invoiced') acc.invoiced++;
      if (order.status === 'cancelled') acc.cancelled++;
      acc.totalValue += order.total || 0;
      return acc;
    }, { pending: 0, invoiced: 0, cancelled: 0, totalValue: 0 });
  }, [allOrders]);

  // Fetch sales orders for upcoming deliveries (from invoice_record)
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['sales-orders', organizationId, selectedStatus, selectedDates],
    queryFn: async () => {
      if (!organizationId) return [];

      const dateStrings = selectedDates.map(d => format(d, 'yyyy-MM-dd'));

      let query = supabase
        .from('invoice_record')
        .select(`
          *,
          customer_profile!customer_id (
            id,
            display_name,
            company_name
          ),
          invoice_line_item(*)
        `)
        .eq('organization_id', organizationId)
        .in('delivery_date', dateStrings)
        .order('delivery_date', { ascending: true })
        .order('created_at', { ascending: false });

      // Apply status filter based on selected tab
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      } else {
        // For "All Orders" tab, show all statuses
        query = query.in('status', ['pending', 'invoiced', 'cancelled']);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!organizationId && selectedDates.length > 0,
  }) as any;

  // Check for duplicate orders for each order in the list
  useEffect(() => {
    const checkDuplicates = async () => {
      if (!orders || !organizationId) return;

      const warnings: Record<string, any> = {};

      // Only check for pending orders
      const pendingOrders = orders.filter((order: any) => order.status === 'pending');

      for (const order of pendingOrders) {
        try {
          const { data: duplicateCheck } = await supabase.rpc('check_duplicate_orders', {
            p_customer_id: order.customer_id,
            p_delivery_date: order.delivery_date,
            p_organization_id: organizationId,
            p_exclude_order_id: order.id,
          });

          const result = duplicateCheck as any;

          if (result?.has_duplicate && result?.existing_order) {
            warnings[order.id] = result.existing_order;
          }
        } catch (error) {
          console.error('Error checking duplicates for order:', order.id, error);
        }
      }

      setDuplicateWarnings(warnings);
    };

    checkDuplicates();
  }, [orders, organizationId]);

  // Filter orders based on search query
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!searchQuery.trim()) return orders;
    
    const query = searchQuery.toLowerCase();
    return orders.filter(order => {
      const customerName = order.customer_profile?.company_name || order.customer_profile?.display_name || '';
      const invoiceNumber = order.invoice_number || '';  // Changed from order_number
      
      return customerName.toLowerCase().includes(query) || 
             invoiceNumber.toLowerCase().includes(query);
    });
  }, [orders, searchQuery]);

  const handleClearAllOrders = async () => {
    setIsClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('clear-sales-orders');
      
      if (error) throw error;
      
      toast.success('All orders cleared successfully');
      
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      
      setIsClearDialogOpen(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      toast.error(`Failed to clear orders: ${error.message}`);
      console.error('Clear orders error:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
      pending: { variant: "secondary", label: "Pending Review", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800" },
      invoiced: { variant: "default", label: "Invoiced", className: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800" },
      cancelled: { variant: "destructive", label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800" },
    };
    
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to view orders</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">Orders for upcoming deliveries - temporary staging before invoice creation</p>
      </div>

      {/* Order Stats KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="card-kpi">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="kpi-label">Pending Orders</span>
              <div className="icon-container warning">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <p className="kpi-value">{stats.pending}</p>
          </CardContent>
        </Card>

        <Card className="card-kpi">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="kpi-label">Invoiced</span>
              <div className="icon-container success">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="kpi-value">{stats.invoiced}</p>
          </CardContent>
        </Card>

        <Card className="card-kpi">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="kpi-label">Cancelled</span>
              <div className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800 rounded-lg p-2 w-10 h-10 flex items-center justify-center border">
                <Ban className="h-5 w-5" />
              </div>
            </div>
            <p className="kpi-value">{stats.cancelled}</p>
          </CardContent>
        </Card>

        <Card className="card-kpi">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="kpi-label">Total Value</span>
              <div className="icon-container purple">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="kpi-value">${(stats.totalValue / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex gap-2">
          <GenerateDailyOrdersButton />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDates.length === 1 
                  ? format(selectedDates[0], 'MMM d, yyyy')
                  : `${selectedDates.length} dates selected`
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || getDefaultDeliveryDates())}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Clear All Orders
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Orders?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all pending orders. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleClearAllOrders}
                  disabled={isClearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isClearing ? "Clearing..." : "Clear All"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Button onClick={() => navigate('/orders/new')} size="sm" className="hidden md:flex">
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name or order number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              Found {filteredOrders.length} result{filteredOrders.length !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <Tabs value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as OrderStatus)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800 dark:data-[state=active]:bg-yellow-950/50 dark:data-[state=active]:text-yellow-300">Pending</TabsTrigger>
          <TabsTrigger value="invoiced" className="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-950/50 dark:data-[state=active]:text-green-300">Invoiced</TabsTrigger>
          <TabsTrigger value="cancelled" className="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 data-[state=active]:bg-red-100 data-[state=active]:text-red-800 dark:data-[state=active]:bg-red-950/50 dark:data-[state=active]:text-red-300">Cancelled</TabsTrigger>
          <TabsTrigger value="all">All Orders</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="space-y-4 mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Error loading orders. Please try again.</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  {searchQuery ? 'No matching orders found' : 'No orders for upcoming deliveries'}
                </p>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'Try adjusting your search' : 'Orders appear here 1-3 days before delivery date'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => navigate('/orders/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Order
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">
                            {order.customer_profile?.company_name || order.customer_profile?.display_name || 'Unknown Customer'}
                          </h3>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Order #{order.invoice_number}</span>
                          <span>•</span>
                          <span>Delivery: {format(new Date(order.delivery_date), 'EEE, MMM dd, yyyy')}</span>
                        </div>
                        
                        {/* Duplicate Warning Alert */}
                        {duplicateWarnings[order.id] && (
                          <Alert className="border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-400 mt-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              ⚠️ This customer has another order for this date: <strong>{duplicateWarnings[order.id].invoice_number}</strong> (Status: {duplicateWarnings[order.id].status}, Total: ${duplicateWarnings[order.id].total?.toFixed(2) || '0.00'})
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold">
                              ${order.total?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          {order.status === 'pending' && (
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => convertOrder({ invoiceId: order.id, action: 'invoice' })}
                                disabled={isConverting}
                                className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800"
                              >
                                {convertingInvoiceId === order.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Converting...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Invoice
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => convertOrder({ invoiceId: order.id, action: 'cancel' })}
                                disabled={isConverting}
                                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mobile FAB */}
      <MobileFAB onClick={() => navigate('/orders/new')} />
    </div>
  );
};

export default SalesOrders;
