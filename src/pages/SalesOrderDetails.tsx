import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { format, parseISO } from "date-fns";
import { Combobox } from "@/components/ui/combobox";
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
  Lock,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { SalesOrderApprovalButton } from "@/components/SalesOrderApprovalButton";

interface SalesOrder {
  id: string;
  invoice_number: string;
  order_date: string;
  delivery_date: string;
  status: string;
  customer_id: string;
  subtotal: number;
  total: number;
  is_no_order: boolean;
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [showSaveToTemplateDialog, setShowSaveToTemplateDialog] = useState(false);
  const [pendingTemplateItem, setPendingTemplateItem] = useState<{ item_id: string; item_name: string } | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const organizationId = profile?.organization_id;

  // Fetch order
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["invoice", salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_record")
        .select(`
          id,
          invoice_number,
          order_date,
          delivery_date,
          status,
          customer_id,
          subtotal,
          total,
          is_no_order,
          memo,
          customer_profile!inner(company_name)
        `)
        .eq("id", salesOrderId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!salesOrderId && !!organizationId,
  });

  // Fetch line items
  const { data: lineItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["invoice-line-items", salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_item")
        .select(`
          id,
          item_id,
          quantity,
          unit_price,
          amount,
          item_record!inner(name)
        `)
        .eq("invoice_id", salesOrderId)
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

  // Fetch customer template items
  const { data: templateItems = [] } = useQuery({
    queryKey: ["customer-template-items", order?.customer_id],
    queryFn: async () => {
      if (!order?.customer_id) return [];

      // First get the active template for this customer
      const { data: template, error: templateError } = await supabase
        .from("customer_templates")
        .select("id")
        .eq("customer_id", order.customer_id)
        .eq("is_active", true)
        .single();

      if (templateError || !template) return [];

      // Then get the items in this template
      const { data, error } = await supabase
        .from("customer_template_items")
        .select("item_id")
        .eq("template_id", template.id);

      if (error) return [];
      return data.map(item => item.item_id);
    },
    enabled: !!order?.customer_id && !!organizationId,
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

  // Check for duplicate orders when delivery_date or customer_id changes
  useEffect(() => {
    const checkDuplicates = async () => {
      if (!order || !organizationId) return;

      try {
        const { data: duplicateCheck } = await supabase.rpc('check_duplicate_orders', {
          p_customer_id: order.customer_id,
          p_delivery_date: order.delivery_date,
          p_organization_id: organizationId,
          p_exclude_order_id: order.id,
        });

        // Type assertion for RPC response
        const result = duplicateCheck as any;
        
        if (result?.has_duplicate && result?.existing_order) {
          setDuplicateWarning(result.existing_order);
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error('Error checking duplicates:', error);
        setDuplicateWarning(null);
      }
    };

    checkDuplicates();
  }, [order?.customer_id, order?.delivery_date, order?.id, organizationId]);

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ lineItemId, quantity }: { lineItemId: string; quantity: number }) => {
      const { error } = await supabase
        .from("invoice_line_item")
        .update({ quantity })
        .eq("id", lineItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-line-items", salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice", salesOrderId] });
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
        .from("invoice_line_item")
        .delete()
        .eq("id", lineItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-line-items", salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice", salesOrderId] });
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
      const { error } = await supabase.from("invoice_line_item").insert({
        invoice_id: salesOrderId,
        item_id: item.id,
        quantity,
        unit_price: 0,
        organization_id: organizationId,
      });

      if (error) throw error;

      return { item_id: item.id, item_name: item.name };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-line-items", salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice", salesOrderId] });
      toast({ title: "Item added successfully" });
      setAddingItem(false);
      setNewItem({ item_id: "", quantity: "1" });

      // Check if item is NOT in template and should prompt to save
      if (!dontAskAgain && !templateItems.includes(data.item_id)) {
        setPendingTemplateItem({ item_id: data.item_id, item_name: data.item_name });
        setShowSaveToTemplateDialog(true);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error adding item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save item to template mutation
  const saveToTemplateMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!order?.customer_id) throw new Error("No customer found");

      // Get the active template for this customer
      const { data: template, error: templateError } = await supabase
        .from("customer_templates")
        .select("id")
        .eq("customer_id", order.customer_id)
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        throw new Error("No active template found for customer");
      }

      // Add item to template with all quantities set to 0
      const { error } = await supabase
        .from("customer_template_items")
        .insert({
          template_id: template.id,
          item_id: itemId,
          organization_id: organizationId,
          unit_price: 0,
          monday_qty: 0,
          tuesday_qty: 0,
          wednesday_qty: 0,
          thursday_qty: 0,
          friday_qty: 0,
          saturday_qty: 0,
          sunday_qty: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-template-items", order?.customer_id] });
      toast({ 
        title: "Item added to template",
        description: "This item is now part of the customer's template"
      });
      setShowSaveToTemplateDialog(false);
      setPendingTemplateItem(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error saving to template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      if (['confirmed', 'delivered', 'paid'].includes(order?.status || '')) {
        throw new Error("Cannot delete confirmed orders");
      }

      const { error } = await supabase
        .from("invoice_record")
        .delete()
        .eq("id", salesOrderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Order deleted successfully" });
      navigate("/sales-orders");
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      // Update status to cancelled
      const { error: updateError } = await supabase
        .from("invoice_record")
        .update({ status: "cancelled" })
        .eq("id", salesOrderId);
      
      if (updateError) throw updateError;

      // Create "No Order Today" invoice
      const { data, error: invoiceError } = await supabase.functions.invoke(
        "create-invoice-from-order",
        { body: { order_id: salesOrderId } }
      );

      if (invoiceError) throw invoiceError;
      if (!data?.success) throw new Error(data?.error || "Failed to create invoice");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", salesOrderId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Order canceled",
        description: "A 'No Order Today' invoice has been created",
      });
      setShowCancelDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error canceling order",
        description: error.message,
        variant: "destructive",
      });
      setShowCancelDialog(false);
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
      pending: { variant: "secondary" as const, label: "Pending", icon: Clock, className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
      reviewed: { variant: "default" as const, label: "Reviewed", icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
      invoiced: { variant: "outline" as const, label: "Invoiced", icon: Lock, className: "text-muted-foreground" },
      canceled: { variant: "destructive" as const, label: "Canceled", icon: XCircle, className: "" },
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
    <div className="space-y-6 p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {order.customer_profile.company_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">{order.invoice_number}</p>
              {getStatusBadge(order.status)}
              {order.is_no_order && (
                <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700">
                  <AlertCircle className="h-3 w-3" />
                  No Order Today
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SalesOrderApprovalButton
            salesOrderId={order.id}
            currentStatus={order.status}
          />
          
          {/* Cancel Order Button (draft/confirmed only) */}
          {(order.status === "draft" || order.status === "confirmed") && !(['confirmed', 'delivered', 'paid'].includes(order.status)) && (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancel Order
            </Button>
          )}

          {/* Delete Order Button */}
          {!['confirmed', 'delivered', 'paid'].includes(order.status) ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {/* Confirmed Warning Banner */}
      {['confirmed', 'delivered', 'paid'].includes(order.status) && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            This order is confirmed. Handle corrections in the Invoice module.
          </AlertDescription>
        </Alert>
      )}

      {/* Duplicate Order Warning Banner */}
      {duplicateWarning && !['confirmed', 'delivered', 'paid'].includes(order.status) && (
        <Alert className="border-yellow-300 bg-yellow-50 text-yellow-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ This customer has another order for this date: <strong>{duplicateWarning.order_number}</strong> (Status: {duplicateWarning.status}, Total: ${duplicateWarning.total?.toFixed(2) || '0.00'})
          </AlertDescription>
        </Alert>
      )}

      {/* Order Summary */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivery Date</p>
                <p className="text-lg font-semibold">
                  {format(parseISO(order.delivery_date), "MMM dd, yyyy")}
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
            {!['confirmed', 'delivered', 'paid'].includes(order.status) && (
              <Button size="sm" onClick={() => setAddingItem(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop & Tablet Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px] text-center">Quantity</TableHead>
                <TableHead className="w-[80px] text-center">U/M</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
                {!['confirmed', 'delivered', 'paid'].includes(order.status) && <TableHead className="w-[80px]"></TableHead>}
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
                      disabled={['confirmed', 'delivered', 'paid'].includes(order.status)}
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
                  {!['confirmed', 'delivered', 'paid'].includes(order.status) && (
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
                    <Combobox
                      options={availableItems.map(item => ({
                        value: item.id,
                        label: item.name
                      }))}
                      value={newItem.item_id}
                      onValueChange={(value) => setNewItem({ ...newItem, item_id: value })}
                      placeholder="Select item..."
                      searchPlaceholder="Search items..."
                      emptyText="No items found."
                      className="w-full"
                    />
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

      {/* Delete Line Item Confirmation */}
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

      {/* Delete Order Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
              onClick={() => deleteOrderMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order for {order.customer_profile.company_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a "No Order Today" invoice for tracking purposes. The order status will be set to canceled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelOrderMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending ? "Canceling..." : "Cancel Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save to Template Dialog */}
      <AlertDialog open={showSaveToTemplateDialog} onOpenChange={setShowSaveToTemplateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Save {pendingTemplateItem?.item_name} to customer template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This item is not currently part of the customer's template. Would you like to add it for future orders?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex items-center space-x-2 py-4">
            <Checkbox 
              id="dont-ask"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked as boolean)}
            />
            <label
              htmlFor="dont-ask"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Don't ask again for this order
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowSaveToTemplateDialog(false);
                setPendingTemplateItem(null);
              }}
            >
              No, Order Only
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplateItem) {
                  saveToTemplateMutation.mutate(pendingTemplateItem.item_id);
                }
              }}
              disabled={saveToTemplateMutation.isPending}
            >
              {saveToTemplateMutation.isPending ? "Adding..." : "Yes, Add to Template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
