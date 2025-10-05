import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, FileText, Package, Truck, Activity, Plus, X, CreditCard as Edit2, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SalesOrderApprovalButton } from '@/components/SalesOrderApprovalButton';
import { SalesOrderConvertToInvoiceButton } from '@/components/SalesOrderConvertToInvoiceButton';

interface SalesOrderDetails {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date: string;
  status: string;
  customer_id: string;
  customer_po_number: string | null;
  shipping_method: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  total: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
  customer_profile: {
    company_name: string;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_postal_code: string | null;
  };
}

interface LineItem {
  id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  description: string | null;
  item_record: {
    name: string;
    sku: string | null;
  };
}

export default function SalesOrderDetails() {
  const { id: salesOrderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('details');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<SalesOrderDetails>>({});
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const { data: salesOrder, isLoading } = useQuery({
    queryKey: ['sales-order', salesOrderId],
    queryFn: async () => {
      if (!salesOrderId) return null;

      const { data, error } = await supabase
        .from('sales_order')
        .select(`
          *,
          customer_profile!inner(
            company_name,
            billing_address_line1,
            billing_address_line2,
            billing_city,
            billing_state,
            billing_postal_code
          )
        `)
        .eq('id', salesOrderId)
        .maybeSingle();

      if (error) throw error;
      return data as SalesOrderDetails;
    },
    enabled: !!salesOrderId,
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['sales-order-line-items', salesOrderId],
    queryFn: async () => {
      if (!salesOrderId) return [];

      const { data, error } = await supabase
        .from('sales_order_line_item')
        .select(`
          *,
          item_record!inner(
            name,
            sku
          )
        `)
        .eq('sales_order_id', salesOrderId)
        .order('created_at');

      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!salesOrderId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profile')
        .select('id, company_name, display_name')
        .order('company_name');

      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (salesOrder) {
      setFormData(salesOrder);
    }
  }, [salesOrder]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SalesOrderDetails>) => {
      if (!salesOrderId) return;

      const { error } = await supabase
        .from('sales_order')
        .update(data)
        .eq('id', salesOrderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      toast.success('Sales order saved successfully');
      setEditMode(false);
    },
    onError: (error) => {
      toast.error('Failed to save sales order', {
        description: error.message,
      });
    },
  });

  const handleSave = useCallback(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    saveMutation.mutate(formData);
  }, [formData, autoSaveTimeout]);

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(() => {
      saveMutation.mutate({ ...formData, [field]: value });
    }, 30000);

    setAutoSaveTimeout(timeout);
  }, [formData, autoSaveTimeout]);

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'draft': return 'outline';
      case 'pending': return 'secondary';
      case 'approved': return 'default';
      case 'fulfilled': return 'default';
      case 'shipped': return 'default';
      case 'invoiced': return 'default';
      case 'closed': return 'outline';
      case 'canceled': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Draft',
      pending: 'Pending Approval',
      approved: 'Approved',
      fulfilled: 'Fulfilled',
      shipped: 'Shipped',
      invoiced: 'Invoiced',
      closed: 'Closed',
      canceled: 'Canceled',
      template_generated: 'Auto-Generated'
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sales order...</p>
        </div>
      </div>
    );
  }

  if (!salesOrder) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Sales order not found</p>
            <Button onClick={() => navigate('/sales-orders')} className="mt-4">
              Back to Sales Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customerOptions = customers.map(c => ({
    value: c.id,
    label: c.company_name || c.display_name || 'Unknown'
  }));

  const itemOptions = items.map(i => ({
    value: i.id,
    label: `${i.name} ${i.sku ? `(${i.sku})` : ''}`
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{salesOrder.order_number}</h1>
              <Badge variant={getStatusVariant(salesOrder.status)}>
                {getStatusLabel(salesOrder.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Created {format(new Date(salesOrder.created_at), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => {
                setEditMode(false);
                setFormData(salesOrder);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <SalesOrderApprovalButton
                salesOrderId={salesOrder.id}
                currentStatus={salesOrder.status}
              />
              <SalesOrderConvertToInvoiceButton
                salesOrderId={salesOrder.id}
                currentStatus={salesOrder.status}
              />
              <Button variant="outline" onClick={() => setEditMode(true)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Order
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="details">
            <FileText className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="lineitems">
            <Package className="h-4 w-4 mr-2" />
            Line Items
          </TabsTrigger>
          <TabsTrigger value="fulfillment">
            <Truck className="h-4 w-4 mr-2" />
            Fulfillment
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  {editMode ? (
                    <Combobox
                      options={customerOptions}
                      value={formData.customer_id}
                      onValueChange={(value) => handleFieldChange('customer_id', value)}
                      placeholder="Select customer..."
                      searchPlaceholder="Search customers..."
                    />
                  ) : (
                    <div className="text-sm font-medium">{salesOrder.customer_profile.company_name}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="po_number">Customer PO Number</Label>
                  {editMode ? (
                    <Input
                      id="po_number"
                      value={formData.customer_po_number || ''}
                      onChange={(e) => handleFieldChange('customer_po_number', e.target.value)}
                      placeholder="Enter PO number..."
                    />
                  ) : (
                    <div className="text-sm">{salesOrder.customer_po_number || '—'}</div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium mb-2">Billing Address</h4>
                  <div className="text-sm text-muted-foreground">
                    <div>{salesOrder.customer_profile.billing_address_line1 || '—'}</div>
                    {salesOrder.customer_profile.billing_address_line2 && (
                      <div>{salesOrder.customer_profile.billing_address_line2}</div>
                    )}
                    <div>
                      {salesOrder.customer_profile.billing_city && `${salesOrder.customer_profile.billing_city}, `}
                      {salesOrder.customer_profile.billing_state} {salesOrder.customer_profile.billing_postal_code}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Shipping Address</h4>
                  {editMode ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Address Line 1"
                        value={formData.shipping_address_line1 || ''}
                        onChange={(e) => handleFieldChange('shipping_address_line1', e.target.value)}
                      />
                      <Input
                        placeholder="Address Line 2"
                        value={formData.shipping_address_line2 || ''}
                        onChange={(e) => handleFieldChange('shipping_address_line2', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="City"
                          value={formData.shipping_city || ''}
                          onChange={(e) => handleFieldChange('shipping_city', e.target.value)}
                        />
                        <Input
                          placeholder="State"
                          value={formData.shipping_state || ''}
                          onChange={(e) => handleFieldChange('shipping_state', e.target.value)}
                        />
                      </div>
                      <Input
                        placeholder="Postal Code"
                        value={formData.shipping_postal_code || ''}
                        onChange={(e) => handleFieldChange('shipping_postal_code', e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <div>{salesOrder.shipping_address_line1 || '—'}</div>
                      {salesOrder.shipping_address_line2 && (
                        <div>{salesOrder.shipping_address_line2}</div>
                      )}
                      <div>
                        {salesOrder.shipping_city && `${salesOrder.shipping_city}, `}
                        {salesOrder.shipping_state} {salesOrder.shipping_postal_code}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Order Date</Label>
                  {editMode ? (
                    <DatePicker
                      date={formData.order_date ? new Date(formData.order_date) : undefined}
                      onDateChange={(date) => handleFieldChange('order_date', date?.toISOString())}
                    />
                  ) : (
                    <div className="text-sm">{format(new Date(salesOrder.order_date), 'PPP')}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Delivery Date</Label>
                  {editMode ? (
                    <DatePicker
                      date={formData.delivery_date ? new Date(formData.delivery_date) : undefined}
                      onDateChange={(date) => handleFieldChange('delivery_date', date?.toISOString())}
                    />
                  ) : (
                    <div className="text-sm">{format(new Date(salesOrder.delivery_date), 'PPP')}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memo">Internal Memo</Label>
                {editMode ? (
                  <Textarea
                    id="memo"
                    value={formData.memo || ''}
                    onChange={(e) => handleFieldChange('memo', e.target.value)}
                    placeholder="Add internal notes..."
                    rows={3}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">{salesOrder.memo || '—'}</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${salesOrder.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">${salesOrder.tax_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">${salesOrder.shipping_total.toFixed(2)}</span>
              </div>
              {salesOrder.discount_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium text-green-600">-${salesOrder.discount_total.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold pt-2">
                <span>Total</span>
                <span>${salesOrder.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lineitems" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                {editMode && (
                  <Button size="sm">
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
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {editMode && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={editMode ? 6 : 5} className="text-center text-muted-foreground h-24">
                        No line items yet. Add items to this order.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.item_record.name}
                          {item.item_record.sku && (
                            <div className="text-xs text-muted-foreground">{item.item_record.sku}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${item.amount.toFixed(2)}</TableCell>
                        {editMode && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fulfillment" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                Fulfillment features coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                Activity tracking coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
