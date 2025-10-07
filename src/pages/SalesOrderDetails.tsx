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

  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");
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
      setEditingLineItemId(null);
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

  const handleSaveQuantity = (lineItemId: string) => {
    const quantity = parseFloat(editQuantity);
    if (isNaN(quantity) || quantity < 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }
    updateQuantityMutation.mutate({ lineItemId, quantity });
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{order.order_number}</h1>
              {getStatusBadge(order.status)}
              {order.is_no_order_today && (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No Order Today
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {order.customer_profile.company_name}
            </p>
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
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {!order.invoiced && <TableHead className="w-[100px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_record.name}</TableCell>
                  <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {editingLineItemId === item.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          className="w-20 h-8 text-right"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveQuantity(item.id);
                            if (e.key === "Escape") setEditingLineItemId(null);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveQuantity(item.id)}
                          disabled={updateQuantityMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingLineItemId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!order.invoiced) {
                            setEditingLineItemId(item.id);
                            setEditQuantity(item.quantity.toString());
                          }
                        }}
                        className={`text-right w-full hover:bg-muted/50 px-2 py-1 rounded ${
                          !order.invoiced ? "cursor-pointer" : "cursor-default"
                        }`}
                        disabled={order.invoiced}
                      >
                        {item.quantity}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${item.amount.toFixed(2)}
                  </TableCell>
                  {!order.invoiced && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
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
                <TableRow>
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
                  <TableCell className="text-right text-muted-foreground">
                    $0.00
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => addLineItemMutation.mutate()}
                        disabled={!newItem.item_id || addLineItemMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingItem(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* Empty State */}
              {lineItems.length === 0 && !addingItem && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
