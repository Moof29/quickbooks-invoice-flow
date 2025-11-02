import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { addDays } from "date-fns";

interface LineItem {
  id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
}

export default function NewSalesOrder() {
  const navigate = useNavigate();
  const { profile } = useAuthProfile();
  const organizationId = profile?.organization_id;
  const queryClient = useQueryClient();
  
  const [customerId, setCustomerId] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState<string>(
    addDays(new Date(), 1).toISOString().split('T')[0]
  );
  const [memo, setMemo] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profile')
        .select('id, company_name')
        .eq('organization_id', organizationId)
        .order('company_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch items
  const { data: items = [] } = useQuery({
    queryKey: ['items', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name, purchase_cost')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) {
        throw new Error('Please select a customer');
      }

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // Generate invoice number
      const { data: invoiceNumber, error: rpcError } = await supabase.rpc('get_next_invoice_number', {
        p_organization_id: organizationId
      });

      if (rpcError) throw rpcError;

      // Get current user for audit trail
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create pending invoice (sales order replacement)
      const { data: order, error: orderError } = await supabase
        .from('invoice_record')
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          invoice_date: orderDate,
          delivery_date: deliveryDate,
          status: 'pending', // New orders start as pending
          subtotal,
          total: subtotal,
          memo,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create line items if any
      if (lineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('invoice_line_item')
          .insert(
            lineItems.map(item => ({
              organization_id: organizationId,
              invoice_id: order.id,
              item_id: item.item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
            }))
          );

        if (lineItemsError) throw lineItemsError;
      }

      return order;
    },
    onSuccess: (order) => {
      toast.success('Order created successfully');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/orders/${order.id}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create order: ${error.message}`);
    },
  });

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        item_id: '',
        quantity: 1,
        unit_price: 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // Auto-fill unit price when item is selected
        if (field === 'item_id' && value) {
          const selectedItem = items.find(i => i.id === value);
          if (selectedItem) {
            updated.unit_price = selectedItem.purchase_cost || 0;
          }
        }
        
        return updated;
      }
      return item;
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate();
  };

  const customerOptions = customers
    .filter(c => c.company_name) // Filter out null/undefined names
    .map(c => ({
      value: c.id,
      label: c.company_name,
    }));

  const itemOptions = items
    .filter(i => i.name) // Filter out null/undefined names
    .map(i => ({
      value: i.id,
      label: i.name,
    }));

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/orders')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Order</h1>
            <p className="text-muted-foreground mt-1">
              Create a new order for next-day delivery
            </p>
          </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Order Details Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>Basic information about the order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Combobox
                    options={customerOptions}
                    value={customerId}
                    onValueChange={setCustomerId}
                    placeholder="Select customer..."
                    searchPlaceholder="Search customers..."
                    emptyText="No customers found."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orderDate">Order Date</Label>
                  <Input
                    id="orderDate"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Delivery Date</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memo">Memo</Label>
                <Textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Optional notes about this order..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Add items to this order</CardDescription>
                </div>
                <Button type="button" onClick={addLineItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items added yet. Click "Add Item" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {lineItems.map((lineItem) => (
                    <div key={lineItem.id} className="flex gap-4 items-start border-b pb-4 last:border-0">
                      <div className="flex-1 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Item</Label>
                          <Combobox
                            options={itemOptions}
                            value={lineItem.item_id}
                            onValueChange={(value) => updateLineItem(lineItem.id, 'item_id', value)}
                            placeholder="Select item..."
                            searchPlaceholder="Search items..."
                            emptyText="No items found."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={lineItem.quantity}
                            onChange={(e) => updateLineItem(lineItem.id, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={lineItem.unit_price}
                            onChange={(e) => updateLineItem(lineItem.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(lineItem.id)}
                        className="mt-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4 border-t">
                    <div className="text-right space-y-1">
                      <div className="text-sm text-muted-foreground">Subtotal</div>
                      <div className="text-2xl font-bold">${subtotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/orders')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending || !customerId}
            >
              {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
