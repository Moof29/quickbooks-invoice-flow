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
import { Combobox } from '@/components/ui/combobox';

interface InvoiceLineItem {
  id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  isNew?: boolean;
  isTemplate?: boolean;
}

interface AvailableItem {
  id: string;
  name: string;
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
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        invoice_date: initialData.invoice_date,
        due_date: initialData.due_date,
        status: initialData.status,
        memo: initialData.memo || '',
      });
      loadTemplateItemsAndMerge();
      loadAvailableItems();
    }
  }, [open, initialData, initialLineItems]);

  const loadAvailableItems = async () => {
    try {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAvailableItems(data || []);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const loadTemplateItemsAndMerge = async () => {
    try {
      // Get invoice's customer_id
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoice_record')
        .select('customer_id')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Get customer's active template
      const { data: template, error: templateError } = await supabase
        .from('customer_templates')
        .select('id')
        .eq('customer_id', invoiceData.customer_id)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
        setLineItems(initialLineItems);
        return;
      }

      // ✅ FIX: Get template items - just IDs and prices
      const { data: templateItems, error: itemsError } = await supabase
        .from('customer_template_items')
        .select('item_id, unit_price')
        .eq('template_id', template.id);

      if (itemsError) throw itemsError;

      // ✅ FIX: Get item details separately
      const itemIds = templateItems?.map(ti => ti.item_id).filter(Boolean) || [];
      
      let itemDetails: { id: string; name: string }[] = [];
      if (itemIds.length > 0) {
        const { data: items, error: itemsDetailError } = await supabase
          .from('item_record')
          .select('id, name')
          .in('id', itemIds);
        
        if (itemsDetailError) throw itemsDetailError;
        itemDetails = items || [];
      }

      // Merge template items with existing invoice line items
      const mergedItems: InvoiceLineItem[] = [];
      const existingItemIds = new Set(initialLineItems.map(li => li.item_id));

      // Add existing invoice line items
      initialLineItems.forEach(item => {
        mergedItems.push(item);
      });

      // Add template items that aren't in the invoice yet (with 0 qty)
      templateItems?.forEach(ti => {
        if (ti.item_id && !existingItemIds.has(ti.item_id)) {
          const itemDetail = itemDetails.find(item => item.id === ti.item_id);
          mergedItems.push({
            id: `template-${ti.item_id}`,
            item_id: ti.item_id,
            description: itemDetail?.name || '',
            quantity: 0,
            unit_price: ti.unit_price,
            amount: 0,
            isNew: true,
            isTemplate: true,
          });
        }
      });

      setLineItems(mergedItems);
    } catch (error) {
      console.error('Error loading template items:', error);
      setLineItems(initialLineItems);
    }
  };

  const addLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: `new-${Date.now()}`,
      item_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0,
      isNew: true,
      isTemplate: false,
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
        
        // If selecting an item from dropdown, populate name only
        if (field === 'item_id' && value) {
          const selectedItem = availableItems.find(i => i.id === value);
          if (selectedItem) {
            updated.description = selectedItem.name;
          }
        }
        
        if (field === 'quantity' || field === 'unit_price') {
          updated.amount = updated.quantity * updated.unit_price;
        }
        
        // Remove template flag when editing
        if (item.isTemplate && (field === 'quantity' || field === 'description')) {
          updated.isTemplate = false;
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
      // Validate date order
      if (formData.due_date && formData.due_date < formData.invoice_date) {
        toast({
          title: 'Validation Error',
          description: 'Due date cannot be before invoice date',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate that at least one line item exists (excluding template items with 0 qty)
      const validItems = lineItems.filter(item => 
        item.description.trim() !== '' && 
        item.quantity > 0 && 
        !item.isTemplate
      );
      if (validItems.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please add at least one line item with quantity greater than 0',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate that all non-template items have positive quantities and prices
      const invalidItem = validItems.find(item => 
        !item.quantity || item.quantity <= 0 || !item.unit_price || item.unit_price <= 0
      );
      if (invalidItem) {
        toast({
          title: 'Validation Error',
          description: 'All line items must have quantity and price greater than 0',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      // Get existing line item IDs
      const existingIds = initialLineItems.map(item => item.id);
      const currentIds = lineItems.filter(item => !item.isNew).map(item => item.id);
      
      // STEP 1: Delete removed line items first
      const deletedIds = existingIds.filter(id => !currentIds.includes(id));
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('invoice_line_item')
          .delete()
          .in('id', deletedIds);

        if (deleteError) throw deleteError;
      }

      // STEP 2: Update existing line items
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

      // STEP 3: Insert new line items (excluding template items with 0 qty)
      const newItems = lineItems.filter(item => 
        item.isNew && 
        item.description.trim() !== '' && 
        item.quantity > 0 && 
        !item.isTemplate
      );
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

      // STEP 4: Calculate totals from database (line items have generated amount column)
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('invoice_line_item')
        .select('amount')
        .eq('invoice_id', invoiceId);

      if (lineItemsError) throw lineItemsError;

      const calculatedTotal = lineItemsData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

      // Get current user for audit trail
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // STEP 5: Get current payment info to recalculate amount_due
      const { data: currentInvoice } = await supabase
        .from('invoice_record')
        .select('amount_paid')
        .eq('id', invoiceId)
        .single();

      const amountPaid = currentInvoice?.amount_paid || 0;
      const amountDue = calculatedTotal - amountPaid;

      // STEP 6: Update invoice header with calculated totals and payment tracking
      const { error: invoiceError } = await supabase
        .from('invoice_record')
        .update({
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          status: formData.status,
          memo: formData.memo || null,
          subtotal: calculatedTotal,
          total: calculatedTotal,
          amount_due: amountDue,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

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
              {/* Column Headers */}
              <div className="grid grid-cols-12 gap-2 items-center mb-2 px-1">
                <div className="col-span-2 text-xs font-medium text-muted-foreground">Qty</div>
                <div className="col-span-4 text-xs font-medium text-muted-foreground">Item</div>
                <div className="col-span-2 text-xs font-medium text-muted-foreground">Price</div>
                <div className="col-span-3 text-xs font-medium text-muted-foreground">Amount</div>
                <div className="col-span-1"></div>
              </div>
              
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {lineItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`grid grid-cols-12 gap-2 items-center ${
                      item.isTemplate && item.quantity === 0 
                        ? 'opacity-40 hover:opacity-100 transition-opacity' 
                        : ''
                    }`}
                  >
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4">
                      <Combobox
                        options={availableItems.map(i => ({ value: i.id, label: i.name }))}
                        value={item.item_id || ''}
                        onValueChange={(value) => updateLineItem(item.id, 'item_id', value)}
                        placeholder="Select item..."
                        searchPlaceholder="Search items..."
                        emptyText="No items found"
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
                        placeholder="0.00"
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
