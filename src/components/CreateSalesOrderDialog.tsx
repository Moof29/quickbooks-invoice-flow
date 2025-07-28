
import { useState } from 'react';
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
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CreateSalesOrderData {
  customer_id: string;
  order_date: string;
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
  const [requestedShipDate, setRequestedShipDate] = useState<Date>();
  const [promisedShipDate, setPromisedShipDate] = useState<Date>();
  const queryClient = useQueryClient();
  const { profile } = useAuthProfile();

  const form = useForm<CreateSalesOrderData>({
    defaultValues: {
      order_date: format(new Date(), 'yyyy-MM-dd'),
      customer_po_number: '',
      shipping_method: '',
      shipping_terms: '',
      memo: '',
      message: '',
      terms: '',
    },
  });

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

  // Create sales order mutation
  const createSalesOrderMutation = useMutation({
    mutationFn: async (data: CreateSalesOrderData) => {
      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      const { error } = await supabase
        .from('sales_order')
        .insert({
          organization_id: profile.organization_id,
          customer_id: data.customer_id,
          order_date: data.order_date,
          customer_po_number: data.customer_po_number || null,
          requested_ship_date: data.requested_ship_date || null,
          promised_ship_date: data.promised_ship_date || null,
          shipping_method: data.shipping_method || null,
          shipping_terms: data.shipping_terms || null,
          memo: data.memo || null,
          message: data.message || null,
          terms: data.terms || null,
          status: 'draft',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Sales order created successfully');
      onOpenChange(false);
      form.reset();
      setRequestedShipDate(undefined);
      setPromisedShipDate(undefined);
    },
    onError: (error: any) => {
      toast.error(`Failed to create sales order: ${error.message}`);
    },
  });

  const onSubmit = (data: CreateSalesOrderData) => {
    const submitData = {
      ...data,
      requested_ship_date: requestedShipDate ? format(requestedShipDate, 'yyyy-MM-dd') : undefined,
      promised_ship_date: promisedShipDate ? format(promisedShipDate, 'yyyy-MM-dd') : undefined,
    };
    createSalesOrderMutation.mutate(submitData);
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
            {/* Customer Selection */}
            <FormField
              control={form.control}
              name="customer_id"
              rules={{ required: 'Customer is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer *</FormLabel>
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
