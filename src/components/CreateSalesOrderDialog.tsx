
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2, Copy } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LineItem {
  item_id: string;
  quantity: number;
  unit_price: number;
  description?: string;
}

interface CreateSalesOrderData {
  customer_id: string;
  order_date: string;
  delivery_date: string;
  customer_po_number?: string;
  requested_ship_date?: string;
  promised_ship_date?: string;
  shipping_method?: string;
  shipping_terms?: string;
  memo?: string;
  message?: string;
  terms?: string;
}

interface CreateSalesOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSalesOrderDialog({ open, onOpenChange }: CreateSalesOrderDialogProps) {
  const tomorrow = addDays(new Date(), 1);
  const [deliveryDate, setDeliveryDate] = useState<Date>(tomorrow);
  const [requestedShipDate, setRequestedShipDate] = useState<Date>();
  const [promisedShipDate, setPromisedShipDate] = useState<Date>();
  const [lineItems, setLineItems] = useState<LineItem[]>([{ item_id: '', quantity: 1, unit_price: 0 }]);
  const queryClient = useQueryClient();
  const { profile } = useAuthProfile();

  const form = useForm<CreateSalesOrderData>({
    defaultValues: {
      order_date: format(new Date(), 'yyyy-MM-dd'),
      delivery_date: format(tomorrow, 'yyyy-MM-dd'),
      customer_po_number: '',
      shipping_method: '',
      shipping_terms: '',
      memo: '',
      message: '',
      terms: '',
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        const newDate = addDays(deliveryDate, 1);
        setDeliveryDate(newDate);
        form.setValue('delivery_date', format(newDate, 'yyyy-MM-dd'));
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, deliveryDate, form]);

  // Fetch customers for the dropdown
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profile')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch items for the dropdown
  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch yesterday's order for copy functionality
  const { data: yesterdayOrder } = useQuery({
    queryKey: ['yesterday-order', form.watch('customer_id')],
    queryFn: async () => {
      const customerId = form.watch('customer_id');
      if (!customerId) return null;

      const yesterday = addDays(new Date(), -1);
      const { data, error } = await supabase
        .from('sales_order')
        .select(`
          id,
          sales_order_line_item (
            item_id,
            quantity,
            unit_price,
            description
          )
        `)
        .eq('customer_id', customerId)
        .eq('order_date', format(yesterday, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!form.watch('customer_id'),
  });

  // Create sales order mutation
  const createSalesOrderMutation = useMutation({
    mutationFn: async (data: CreateSalesOrderData) => {
      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Validate line items
      const validLineItems = lineItems.filter(item => item.item_id && item.quantity > 0);
      if (validLineItems.length === 0) {
        throw new Error('At least one line item is required');
      }

      // Create sales order first
      const { data: salesOrder, error: orderError } = await supabase
        .from('sales_order')
        .insert({
          organization_id: profile.organization_id,
          customer_id: data.customer_id,
          order_date: data.order_date,
          delivery_date: data.delivery_date,
          customer_po_number: data.customer_po_number || null,
          requested_ship_date: data.requested_ship_date || null,
          promised_ship_date: data.promised_ship_date || null,
          shipping_method: data.shipping_method || null,
          shipping_terms: data.shipping_terms || null,
          memo: data.memo || null,
          message: data.message || null,
          terms: data.terms || null,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create line items
      const lineItemsToInsert = validLineItems.map(item => ({
        organization_id: profile.organization_id,
        sales_order_id: salesOrder.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        description: item.description || null,
      }));

      const { error: lineItemsError } = await supabase
        .from('sales_order_line_item')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      return salesOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Sales order created successfully');
      onOpenChange(false);
      form.reset();
      setDeliveryDate(addDays(new Date(), 1));
      setRequestedShipDate(undefined);
      setPromisedShipDate(undefined);
      setLineItems([{ item_id: '', quantity: 1, unit_price: 0 }]);
    },
    onError: (error: any) => {
      toast.error(`Failed to create sales order: ${error.message}`);
    },
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { item_id: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setLineItems(updatedItems);
  };

  const calculateTotal = () => {
    return lineItems.reduce((total, item) => {
      return total + (item.quantity * item.unit_price);
    }, 0);
  };

  const copyFromYesterday = () => {
    if (yesterdayOrder?.sales_order_line_item) {
      const yesterdayItems = yesterdayOrder.sales_order_line_item.map((item: any) => ({
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        description: item.description || '',
      }));
      setLineItems(yesterdayItems);
      toast.success('Copied line items from yesterday\'s order');
    }
  };

  const onSubmit = (data: CreateSalesOrderData) => {
    const submitData = {
      ...data,
      delivery_date: format(deliveryDate, 'yyyy-MM-dd'),
      requested_ship_date: requestedShipDate ? format(requestedShipDate, 'yyyy-MM-dd') : undefined,
      promised_ship_date: promisedShipDate ? format(promisedShipDate, 'yyyy-MM-dd') : undefined,
    };
    createSalesOrderMutation.mutate(submitData);
  };

  const getDayName = (date: Date) => {
    return format(date, 'EEEE');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sales Order</DialogTitle>
          <DialogDescription>
            Create a new sales order by filling out the form below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Delivery Date - Prominent at top */}
            <div className="bg-primary/5 p-4 rounded-lg border-2 border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-lg font-semibold text-primary">Delivery Date *</label>
                  <p className="text-sm text-muted-foreground">
                    {getDayName(deliveryDate)} Delivery - {format(deliveryDate, 'MMM dd, yyyy')}
                  </p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-64 justify-start text-left font-normal bg-background"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(deliveryDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={(date) => {
                        if (date) {
                          setDeliveryDate(date);
                          form.setValue('delivery_date', format(date, 'yyyy-MM-dd'));
                        }
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tip: Use Ctrl+D to advance delivery date by one day
              </p>
            </div>

            {/* Customer Selection */}
            <FormField
              control={form.control}
              name="customer_id"
              rules={{ required: 'Customer is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer *</FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {yesterdayOrder && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyFromYesterday}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy from Yesterday
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Order Date */}
            <FormField
              control={form.control}
              name="order_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer PO Number */}
            <FormField
              control={form.control}
              name="customer_po_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer PO Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer PO number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Requested Ship Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Requested Ship Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !requestedShipDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {requestedShipDate ? format(requestedShipDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={requestedShipDate}
                      onSelect={setRequestedShipDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Promised Ship Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Promised Ship Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !promisedShipDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {promisedShipDate ? format(promisedShipDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={promisedShipDate}
                      onSelect={setPromisedShipDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Shipping Method */}
              <FormField
                control={form.control}
                name="shipping_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Method</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ground, Express" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Shipping Terms */}
              <FormField
                control={form.control}
                name="shipping_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Terms</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., FOB Origin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Memo */}
            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Memo</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Internal notes about this order" 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Message */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Message to display to customer" 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Terms */}
            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Payment terms and conditions" 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Line Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Line Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {lineItems.map((lineItem, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-4 border rounded-lg">
                  {/* Item Selection */}
                  <div className="col-span-4">
                    <label className="text-sm font-medium">Item *</label>
                    <Select
                      value={lineItem.item_id}
                      onValueChange={(value) => updateLineItem(index, 'item_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Qty *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Unit Price *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={lineItem.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Amount (calculated) */}
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Amount</label>
                    <Input
                      value={`$${(lineItem.quantity * lineItem.unit_price).toFixed(2)}`}
                      disabled
                    />
                  </div>

                  {/* Description */}
                  <div className="col-span-1">
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      placeholder="Optional"
                      value={lineItem.description || ''}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-lg font-medium">
                    Total: ${calculateTotal().toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={createSalesOrderMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createSalesOrderMutation.isPending}
              >
                {createSalesOrderMutation.isPending ? 'Creating...' : 'Create Sales Order'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
