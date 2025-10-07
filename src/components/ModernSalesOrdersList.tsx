import { useState, useMemo } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date: string;
  status: string;
  total: number;
  is_no_order_today: boolean;
  invoiced: boolean;
  customer_profile: {
    company_name: string;
  };
  sales_order_line_item: { count: number }[];
}

export function ModernSalesOrdersList() {
  const { profile } = useAuthProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const [deliveryDateFilter, setDeliveryDateFilter] = useState<string>(deliveryDates[0].date);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [isBatchInvoicing, setIsBatchInvoicing] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const organizationId = profile?.organization_id;

  // Fetch orders for selected delivery date, auto-generate if none exist
  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-orders", organizationId, deliveryDateFilter, statusFilter],
    queryFn: async () => {
      // First, check if orders exist for this date
      let query = supabase
        .from("sales_order")
        .select(
          `
          id,
          order_number,
          order_date,
          delivery_date,
          status,
          total,
          is_no_order_today,
          invoiced,
          customer_profile!inner(company_name),
          sales_order_line_item(count)
        `
        )
        .eq("organization_id", organizationId)
        .eq("delivery_date", deliveryDateFilter)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // If no orders exist for this date, auto-generate from templates
      if (!data || data.length === 0) {
        console.log(`No orders found for ${deliveryDateFilter}, auto-generating...`);
        
        const { data: generateResult, error: generateError } = await supabase.functions.invoke(
          "generate-daily-orders",
          {
            body: {
              target_date: deliveryDateFilter,
            },
          }
        );

        if (generateError) {
          console.error("Error auto-generating orders:", generateError);
          return data as SalesOrder[]; // Return empty array if generation fails
        }

        console.log(`Auto-generated ${generateResult?.orders_created || 0} orders`);

        // Fetch the newly created orders
        const { data: newData, error: newError } = await query;
        if (newError) throw newError;
        return newData as SalesOrder[];
      }

      return data as SalesOrder[];
    },
    enabled: !!organizationId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from("sales_order").delete().eq("id", orderId);
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

  // Batch invoice mutation
  const batchInvoiceMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const { data, error } = await supabase.functions.invoke("batch-invoice-orders", {
        body: { order_ids: orderIds },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      setSelectedOrders(new Set());
      toast({
        title: "Batch invoicing complete",
        description: `${data.successful_count} orders invoiced, ${data.failed_count} failed`,
      });
      setIsBatchInvoicing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Batch invoicing failed",
        description: error.message,
        variant: "destructive",
      });
      setIsBatchInvoicing(false);
    },
  });

  // Review order mutation
  const reviewMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("sales_order")
        .update({ status: "reviewed", approved_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast({ title: "Order reviewed successfully" });
    },
  });

  // Filter orders by search query (no grouping needed now)
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!searchQuery.trim()) return orders;
    
    const query = searchQuery.toLowerCase().trim();
    return orders.filter(order => 
      order.order_number?.toLowerCase().includes(query) ||
      order.customer_profile?.company_name?.toLowerCase().includes(query) ||
      order.total?.toString().includes(query)
    );
  }, [orders, searchQuery]);

  const reviewedCount = filteredOrders?.filter(o => o.status === "reviewed" && !o.invoiced).length || 0;

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, label: "Pending", icon: Clock },
      reviewed: { variant: "default" as const, label: "Reviewed", icon: CheckCircle2 },
      invoiced: { variant: "default" as const, label: "Invoiced", icon: FileText },
      canceled: { variant: "destructive" as const, label: "Canceled", icon: XCircle },
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
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

  const handleBatchInvoice = () => {
    const orderIds = Array.from(selectedOrders);
    setIsBatchInvoicing(true);
    batchInvoiceMutation.mutate(orderIds);
  };

  const handleSelectAll = () => {
    const reviewedOrders = filteredOrders?.filter((o) => o.status === "reviewed" && !o.invoiced) || [];
    const newSelected = new Set(selectedOrders);
    const allSelected = reviewedOrders.every((o) => newSelected.has(o.id));

    if (allSelected) {
      reviewedOrders.forEach((o) => newSelected.delete(o.id));
    } else {
      reviewedOrders.forEach((o) => newSelected.add(o.id));
    }
    setSelectedOrders(newSelected);
  };

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
              <Select value={deliveryDateFilter} onValueChange={setDeliveryDateFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deliveryDates.map((dateOption) => (
                    <SelectItem key={dateOption.date} value={dateOption.date}>
                      {dateOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
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
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedOrders.size} order(s) selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedOrders(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  size="sm"
                  onClick={handleBatchInvoice}
                  disabled={isBatchInvoicing}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isBatchInvoicing ? "Processing..." : "Batch Invoice"}
                </Button>
              </div>
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
                  <CardTitle>{format(parseISO(deliveryDateFilter), "EEEE, MMMM d, yyyy")}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filteredOrders.length} order(s)
                    {reviewedCount > 0 && ` • ${reviewedCount} ready to invoice`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getDeliveryBadge(deliveryDateFilter)}
                {reviewedCount > 0 && (
                  <Checkbox
                    checked={filteredOrders
                      .filter((o) => o.status === "reviewed" && !o.invoiced)
                      .every((o) => selectedOrders.has(o.id))}
                    onCheckedChange={() => handleSelectAll()}
                  />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredOrders.map((order) => (
              <Card 
                key={order.id} 
                className="border shadow-sm cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/sales-orders/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {order.status === "reviewed" && !order.invoiced && (
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
                          {order.is_no_order_today && (
                            <Badge variant="outline" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              No Order Today
                            </Badge>
                          )}
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.order_number} • {order.sales_order_line_item?.[0]?.count || 0} items • $
                          {order.total.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {order.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            reviewMutation.mutate(order.id);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      )}
                      {order.status === "reviewed" && !order.invoiced && (
                        <Button
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { data, error } = await supabase.functions.invoke(
                              "create-invoice-from-order",
                              { body: { order_id: order.id } }
                            );
                            if (error) {
                              toast({
                                title: "Error",
                                description: error.message,
                                variant: "destructive",
                              });
                            } else {
                              queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
                              toast({ title: "Invoice created successfully" });
                            }
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Invoice
                        </Button>
                      )}
                      {!order.invoiced && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteOrderId(order.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
    </div>
  );
}
