import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Package, DollarSign, Truck, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface SalesOrderDialogProps {
  salesOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SalesOrderDetails {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  customer_id: string;
  customer_po_number: string | null;
  requested_ship_date: string | null;
  promised_ship_date: string | null;
  shipping_method: string | null;
  shipping_terms: string | null;
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
  discount_rate: number | null;
  total: number;
  memo: string | null;
  message: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
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
  description: string | null;
  item_record: {
    name: string;
    sku: string | null;
  };
}

export function SalesOrderDialog({ salesOrderId, open, onOpenChange }: SalesOrderDialogProps) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<SalesOrderDetails>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sales order details
  const { data: salesOrder, isLoading } = useQuery({
    queryKey: ['sales-order', salesOrderId],
    queryFn: async () => {
      if (!salesOrderId) return null;
      
      const { data, error } = await supabase
        .from('sales_order')
        .select(`
          *,
          customer_profile!inner(
            company_name
          )
        `)
        .eq('id', salesOrderId)
        .single();

      if (error) throw error;
      return data as SalesOrderDetails;
    },
    enabled: !!salesOrderId,
  });

  // Fetch line items
  const { data: lineItems } = useQuery({
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<SalesOrderDetails>) => {
      if (!salesOrderId) throw new Error('No sales order ID');
      
      const { error } = await supabase
        .from('sales_order')
        .update(updates)
        .eq('id', salesOrderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      toast({
        title: 'Success',
        description: 'Sales order updated successfully',
      });
      setEditMode(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update sales order',
        variant: 'destructive',
      });
      console.error('Update error:', error);
    },
  });

  // Initialize form data when sales order loads
  useEffect(() => {
    if (salesOrder) {
      setFormData(salesOrder);
    }
  }, [salesOrder]);

  const handleSave = () => {
    if (!formData) return;
    
    updateMutation.mutate({
      status: formData.status,
      customer_po_number: formData.customer_po_number,
      requested_ship_date: formData.requested_ship_date,
      promised_ship_date: formData.promised_ship_date,
      shipping_method: formData.shipping_method,
      shipping_terms: formData.shipping_terms,
      shipping_address_line1: formData.shipping_address_line1,
      shipping_address_line2: formData.shipping_address_line2,
      shipping_city: formData.shipping_city,
      shipping_state: formData.shipping_state,
      shipping_postal_code: formData.shipping_postal_code,
      shipping_country: formData.shipping_country,
      memo: formData.memo,
      message: formData.message,
      terms: formData.terms,
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'template_generated':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'open':
      case 'approved':
      case 'shipped':
      case 'invoiced':
        return 'default';
      case 'closed':
        return 'secondary';
      case 'canceled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'template_generated':
        return 'Auto-Generated';
      case 'draft':
        return 'Draft';
      case 'open':
        return 'Open';
      case 'approved':
        return 'Approved';
      case 'shipped':
        return 'Shipped';
      case 'invoiced':
        return 'Invoiced';
      case 'closed':
        return 'Closed';
      case 'canceled':
        return 'Canceled';
      default:
        return status;
    }
  };

  if (!salesOrder && !isLoading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <div>
                <div className="text-lg font-semibold">
                  {salesOrder?.order_number || 'Loading...'}
                </div>
                {salesOrder && (
                  <div className="text-sm text-muted-foreground">
                    {salesOrder.customer_profile.company_name}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {salesOrder && (
                <Badge variant={getStatusVariant(salesOrder.status)}>
                  {getStatusLabel(salesOrder.status)}
                </Badge>
              )}
              {editMode ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setEditMode(true)}>
                  Edit
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : salesOrder ? (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Order Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {format(new Date(salesOrder.order_date), 'MMM dd, yyyy')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total Amount
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    ${salesOrder.total?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Subtotal: ${salesOrder.subtotal?.toFixed(2) || '0.00'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Line Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {lineItems?.length || 0} items
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    {editMode ? (
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="invoiced">Invoiced</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="canceled">Canceled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge variant={getStatusVariant(salesOrder.status)}>
                          {getStatusLabel(salesOrder.status)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Customer PO Number</Label>
                    {editMode ? (
                      <Input
                        value={formData.customer_po_number || ''}
                        onChange={(e) => setFormData({ ...formData, customer_po_number: e.target.value })}
                        placeholder="Customer PO number"
                      />
                    ) : (
                      <p className="mt-1 text-sm">{salesOrder.customer_po_number || '-'}</p>
                    )}
                  </div>

                  <div>
                    <Label>Requested Ship Date</Label>
                    {editMode ? (
                      <Input
                        type="date"
                        value={formData.requested_ship_date || ''}
                        onChange={(e) => setFormData({ ...formData, requested_ship_date: e.target.value })}
                      />
                    ) : (
                      <p className="mt-1 text-sm">
                        {salesOrder.requested_ship_date 
                          ? format(new Date(salesOrder.requested_ship_date), 'MMM dd, yyyy')
                          : '-'
                        }
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Promised Ship Date</Label>
                    {editMode ? (
                      <Input
                        type="date"
                        value={formData.promised_ship_date || ''}
                        onChange={(e) => setFormData({ ...formData, promised_ship_date: e.target.value })}
                      />
                    ) : (
                      <p className="mt-1 text-sm">
                        {salesOrder.promised_ship_date 
                          ? format(new Date(salesOrder.promised_ship_date), 'MMM dd, yyyy')
                          : '-'
                        }
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Memo</Label>
                  {editMode ? (
                    <Textarea
                      value={formData.memo || ''}
                      onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                      placeholder="Internal memo"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{salesOrder.memo || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Customer Message</Label>
                  {editMode ? (
                    <Textarea
                      value={formData.message || ''}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Message to customer"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{salesOrder.message || '-'}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shipping Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Shipping Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Shipping Method</Label>
                    {editMode ? (
                      <Input
                        value={formData.shipping_method || ''}
                        onChange={(e) => setFormData({ ...formData, shipping_method: e.target.value })}
                        placeholder="Shipping method"
                      />
                    ) : (
                      <p className="mt-1 text-sm">{salesOrder.shipping_method || '-'}</p>
                    )}
                  </div>

                  <div>
                    <Label>Shipping Terms</Label>
                    {editMode ? (
                      <Input
                        value={formData.shipping_terms || ''}
                        onChange={(e) => setFormData({ ...formData, shipping_terms: e.target.value })}
                        placeholder="Shipping terms"
                      />
                    ) : (
                      <p className="mt-1 text-sm">{salesOrder.shipping_terms || '-'}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Shipping Address</Label>
                  {editMode ? (
                    <div className="space-y-2">
                      <Input
                        value={formData.shipping_address_line1 || ''}
                        onChange={(e) => setFormData({ ...formData, shipping_address_line1: e.target.value })}
                        placeholder="Address Line 1"
                      />
                      <Input
                        value={formData.shipping_address_line2 || ''}
                        onChange={(e) => setFormData({ ...formData, shipping_address_line2: e.target.value })}
                        placeholder="Address Line 2"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={formData.shipping_city || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                          placeholder="City"
                        />
                        <Input
                          value={formData.shipping_state || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                          placeholder="State"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={formData.shipping_postal_code || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_postal_code: e.target.value })}
                          placeholder="Postal Code"
                        />
                        <Input
                          value={formData.shipping_country || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value })}
                          placeholder="Country"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      {salesOrder.shipping_address_line1 ? (
                        <div>
                          <p>{salesOrder.shipping_address_line1}</p>
                          {salesOrder.shipping_address_line2 && <p>{salesOrder.shipping_address_line2}</p>}
                          <p>
                            {salesOrder.shipping_city}, {salesOrder.shipping_state} {salesOrder.shipping_postal_code}
                          </p>
                          {salesOrder.shipping_country && <p>{salesOrder.shipping_country}</p>}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No shipping address specified</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                {lineItems && lineItems.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.item_record.name}
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.item_record.sku || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              ${item.unit_price.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${item.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No line items found</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totals Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Totals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${salesOrder.subtotal?.toFixed(2) || '0.00'}</span>
                  </div>
                  {salesOrder.discount_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-${salesOrder.discount_total.toFixed(2)}</span>
                    </div>
                  )}
                  {salesOrder.tax_total > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>${salesOrder.tax_total.toFixed(2)}</span>
                    </div>
                  )}
                  {salesOrder.shipping_total > 0 && (
                    <div className="flex justify-between">
                      <span>Shipping:</span>
                      <span>${salesOrder.shipping_total.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>${salesOrder.total?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sales order not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}