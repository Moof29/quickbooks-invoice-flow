import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { format } from "date-fns";
import {
  ArrowLeft,
  Save,
  Edit,
  Plus,
  Trash2,
  Check,
  X,
  FileText,
  Calendar,
  User,
  Package,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { SalesOrderApprovalButton } from "@/components/SalesOrderApprovalButton";
import { SalesOrderConvertToInvoiceButton } from "@/components/SalesOrderConvertToInvoiceButton";

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date: string;
  status: string;
  customer_id: string;
  subtotal: number;
  total: number;
  is_no_order_today: boolean;
  invoiced: boolean;
  memo: string | null;
  customer_profile: {
    company_name: string;
  };
}

interface LineItem {
  id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  item_record: {
    name: string;
  };
}

export default function SalesOrderDetails() {
  const { id: salesOrderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthProfile();
  const { toast } = useToast();

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [deleteLineItemId, setDeleteLineItemId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ item_id: "", quantity: "1" });

  const organizationId = profile?.organization_id;

  // Fetch order
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["sales-order", salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_order")
        .select(`
          id,
          order_number,
          order_date,
          delivery_date,
          status,
          customer_id,
          subtotal,
          total,
          is_no_order_today,
          invoiced,
          memo,
          customer_profile!inner(company_name)
        `)
        .eq("id", salesOrderId)
        .single();

      if (error) throw error;
      return data as SalesOrder;
    },
    enabled: !!salesOrderId && !!organizationId,
  });

  // Fetch line items
  const { data: lineItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["sales-order-line-items", salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_order_line_item")
        .select(`
          id,
          item_id,
          quantity,
          unit_price,
          amount,
          item_record!inner(name)
        `)
        .eq("sales_order_id", salesOrderId)
        .order("created_at");

      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!salesOrderId && !!organizationId,
  });

  // Fetch available items
  const { data: availableItems = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_record")
        .select("id, name, description")
        .eq("is_active", true)
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Initialize quantities when line items load
  useEffect(() => {
    if (lineItems.length > 0) {
      const initialQuantities: Record<string, string> = {};
      lineItems.forEach(item => {
        initialQuantities[item.id] = item.quantity.toString();
      });
      setQuantities(initialQuantities);
    }
  }, [lineItems]);

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ lineItemId, quantity }: { lineItemId: string; quantity: number }) => {
      const { error } = await supabase
        .from("sales_order_line_item")
        .update({ quantity })
        .eq("id", lineItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-line-items", salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ["sales-order", salesOrderId] });
      toast({ title: "Quantity updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating quantity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete line item mutation
  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      const { error } = await supabase
        .from("sales_order_line_item")
        .delete()
        .eq("id", lineItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-line-items", salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ["sales-order", salesOrderId] });
      toast({ title: "Line item deleted" });
      setDeleteLineItemId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting line item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add line item mutation
  const addLineItemMutation = useMutation({
    mutationFn: async () => {
      const item = availableItems.find((i) => i.id === newItem.item_id);
      if (!item) throw new Error("Item not found");

      const quantity = parseFloat(newItem.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error("Invalid quantity");
      }

      // Use 0 as default price - user can edit inline after adding
      const { error } = await supabase.from("sales_order_line_item").insert({
        sales_order_id: salesOrderId,
        item_id: item.id,
        quantity,
        unit_price: 0,
        organization_id: organizationId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-line-items", salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ["sales-order", salesOrderId] });
      toast({ title: "Item added successfully" });
      setAddingItem(false);
      setNewItem({ item_id: "", quantity: "1" });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (lineItemId: string, value: string) => {
    setQuantities(prev => ({ ...prev, [lineItemId]: value }));
  };

  const handleQuantityBlur = (lineItemId: string, originalQuantity: number) => {
    const newQuantity = parseFloat(quantities[lineItemId] || "0");
    if (isNaN(newQuantity) || newQuantity < 0) {
      // Reset to original if invalid
      setQuantities(prev => ({ ...prev, [lineItemId]: originalQuantity.toString() }));
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }
    
    // Only update if changed
    if (newQuantity !== originalQuantity) {
      updateQuantityMutation.mutate({ lineItemId, quantity: newQuantity });
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, lineItemId: string, originalQuantity: number) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setQuantities(prev => ({ ...prev, [lineItemId]: originalQuantity.toString() }));
      e.currentTarget.blur();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, label: "Pending" },
      reviewed: { variant: "default" as const, label: "Reviewed" },
      invoiced: { variant: "default" as const, label: "Invoiced" },
      canceled: { variant: "destructive" as const, label: "Canceled" },
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (orderLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Order not found</p>
            <Button onClick={() => navigate("/sales-orders")}>
              Back to Sales Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sales-orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {order.customer_profile.company_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">{order.order_number}</p>
              {getStatusBadge(order.status)}
              {order.is_no_order_today && (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No Order Today
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SalesOrderApprovalButton
            salesOrderId={order.id}
            currentStatus={order.status}
          />
          <SalesOrderConvertToInvoiceButton
            salesOrderId={order.id}
            currentStatus={order.status}
          />
        </div>
      </div>

      {/* Order Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivery Date</p>
                <p className="text-lg font-semibold">
                  {format(new Date(order.delivery_date), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Line Items</p>
                <p className="text-lg font-semibold">{lineItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">${order.total.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>
                Click on quantity to edit. Changes are saved automatically.
              </CardDescription>
            </div>
            {!order.invoiced && (
              <Button size="sm" onClick={() => setAddingItem(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px] text-center">Quantity</TableHead>
                <TableHead className="w-[80px] text-center">U/M</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
                {!order.invoiced && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, index) => (
                <TableRow key={item.id} className="group">
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={quantities[item.id] ?? item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      onBlur={() => handleQuantityBlur(item.id, item.quantity)}
                      onKeyDown={(e) => handleQuantityKeyDown(e, item.id, item.quantity)}
                      className="w-16 h-9 text-center border-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={order.invoiced}
                      tabIndex={index + 1}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground">
                      EA
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{item.item_record.name}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm">${item.unit_price.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono font-semibold">${item.amount.toFixed(2)}</span>
                  </TableCell>
                  {!order.invoiced && (
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setDeleteLineItemId(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {/* Add Item Row */}
              {addingItem && (
                <TableRow className="bg-muted/30">
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      className="w-16 text-center mx-auto"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground">
                      EA
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select value={newItem.item_id} onValueChange={(value) => setNewItem({ ...newItem, item_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm text-muted-foreground">$0.00</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono font-semibold text-muted-foreground">$0.00</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => addLineItemMutation.mutate()}
                        disabled={!newItem.item_id || addLineItemMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setAddingItem(false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* Empty State */}
              {lineItems.length === 0 && !addingItem && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${order.subtotal.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memo */}
      {order.memo && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Memo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{order.memo}</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLineItemId} onOpenChange={() => setDeleteLineItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Line Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this item from the order?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLineItemId && deleteLineItemMutation.mutate(deleteLineItemId)}
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
