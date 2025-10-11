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
import { useToast } from '@/hooks/use-toast';

interface InvoiceLineItem {
  id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  isNew?: boolean;
}

interface InvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  initialData: {
    invoice_date: string;
    due_date: string;
    status: string;
    memo?: string;
  };
  initialLineItems: InvoiceLineItem[];
  onSuccess: () => void;
}

export const InvoiceEditDialog = ({ 
  open, 
  onOpenChange, 
  invoiceId,
  initialData,
  initialLineItems,
  onSuccess 
}: InvoiceEditDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_date: initialData.invoice_date,
    due_date: initialData.due_date,
    status: initialData.status,
    memo: initialData.memo || '',
  });
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(initialLineItems);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        invoice_date: initialData.invoice_date,
        due_date: initialData.due_date,
        status: initialData.status,
        memo: initialData.memo || '',
      });
      setLineItems(initialLineItems);
    }
  }, [open, initialData, initialLineItems]);

  const addLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: `new-${Date.now()}`,
      item_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0,
      isNew: true,
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
      const total = calculateTotal();
      
      // Update invoice header
      const { error: invoiceError } = await supabase
        .from('invoice_record')
        .update({
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          status: formData.status,
          memo: formData.memo || null,
          subtotal: total,
          total: total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Get existing line item IDs
      const existingIds = initialLineItems.map(item => item.id);
      const currentIds = lineItems.filter(item => !item.isNew).map(item => item.id);
      
      // Delete removed line items
      const deletedIds = existingIds.filter(id => !currentIds.includes(id));
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('invoice_line_item')
          .delete()
          .in('id', deletedIds);

        if (deleteError) throw deleteError;
      }

      // Update existing line items
      for (const item of lineItems.filter(item => !item.isNew)) {
        const { error: updateError } = await supabase
          .from('invoice_line_item')
          .update({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      // Insert new line items
      const newItems = lineItems.filter(item => item.isNew && item.description.trim() !== '');
      if (newItems.length > 0) {
        const { data: invoiceData } = await supabase
          .from('invoice_record')
          .select('organization_id')
          .eq('id', invoiceId)
          .single();

        if (!invoiceData) throw new Error('Invoice not found');

        const { error: insertError } = await supabase
          .from('invoice_line_item')
          .insert(
            newItems.map(item => ({
              invoice_id: invoiceId,
              organization_id: invoiceData.organization_id,
              item_id: item.item_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
            }))
          );

        if (insertError) throw insertError;
      }

      toast({
        title: "Success",
        description: "Invoice updated successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Edit Invoice</DialogTitle>
              <DialogDescription>
                Update invoice details and line items below.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading} form="invoice-edit-form">
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form id="invoice-edit-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-3 gap-4">
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
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex justify-between items-center">
                Line Items
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="Price"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={item.amount.toFixed(2)}
                        readOnly
                        className="bg-muted h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <div className="text-base font-semibold">
                    Total: ${calculateTotal().toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memo */}
          <div className="space-y-2">
            <Label htmlFor="memo" className="text-sm">Memo</Label>
            <Textarea
              id="memo"
              placeholder="Additional notes or memo"
              rows={2}
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              className="text-sm"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
