
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  display_name: string;
  email: string;
}

interface Item {
  id: string;
  name: string;
  description: string;
}

interface InvoiceLineItem {
  id: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const InvoiceDialog = ({ open, onOpenChange, onSuccess }: InvoiceDialogProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    memo: '',
    terms: '',
  });
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      id: '1',
      item_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0
    }
  ]);
  const { profile } = useAuthProfile();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCustomersAndItems();
    }
  }, [open]);

  const loadCustomersAndItems = async () => {
    try {
      const [customersResult, itemsResult] = await Promise.all([
        supabase.from('customer_profile').select('id, display_name, email').eq('is_active', true),
        supabase.from('item_record').select('id, name, description').eq('is_active', true)
      ]);

      if (customersResult.data) setCustomers(customersResult.data);
      if (itemsResult.data) setItems(itemsResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load customers and items",
        variant: "destructive",
      });
    }
  };

  const addLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: Date.now().toString(),
      item_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.amount = updated.quantity * updated.unit_price;
        }
        return updated;
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!profile?.organization_id) {
        throw new Error('No organization found for user');
      }

      // Generate invoice number (simple increment-based)
      const { data: lastInvoice } = await supabase
        .from('invoice_record')
        .select('invoice_number')
        .order('created_at', { ascending: false })
        .limit(1);

      let invoiceNumber = 'INV-0001';
      if (lastInvoice && lastInvoice.length > 0) {
        const lastNumber = parseInt(lastInvoice[0].invoice_number.split('-')[1]);
        invoiceNumber = `INV-${String(lastNumber + 1).padStart(4, '0')}`;
      }

      const total = calculateTotal();
      
      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoice_record')
        .insert({
          organization_id: profile.organization_id,
          invoice_number: invoiceNumber,
          customer_id: formData.customer_id,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          subtotal: total,
          total: total,
          memo: formData.memo || null,
          terms: formData.terms || null,
          status: 'draft'
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemInserts = lineItems
        .filter(item => item.description.trim() !== '')
        .map(item => ({
          invoice_id: invoice.id,
          organization_id: profile.organization_id,
          item_id: item.item_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount
        }));

      if (lineItemInserts.length > 0) {
        const { error: lineItemError } = await supabase
          .from('invoice_line_item')
          .insert(lineItemInserts);

        if (lineItemError) throw lineItemError;
      }

      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      memo: '',
      terms: '',
    });
    setLineItems([{
      id: '1',
      item_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0
    }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice for your customer. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.display_name} ({customer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date *</Label>
              <Input
                id="invoice_date"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Payment Terms</Label>
              <Input
                id="terms"
                placeholder="Net 30"
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              />
            </div>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Line Items
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label>Description *</Label>
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        value={item.amount.toFixed(2)}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    Total: ${calculateTotal().toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memo */}
          <div className="space-y-2">
            <Label htmlFor="memo">Memo</Label>
            <Textarea
              id="memo"
              placeholder="Additional notes or memo"
              rows={3}
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
