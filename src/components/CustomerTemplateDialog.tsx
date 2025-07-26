import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface CustomerTemplate {
  id: string;
  customer_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface TemplateItem {
  id?: string;
  item_id: string;
  item_name: string;
  unit_measure: string;
  unit_price: number;
  monday_qty: number;
  tuesday_qty: number;
  wednesday_qty: number;
  thursday_qty: number;
  friday_qty: number;
  saturday_qty: number;
  sunday_qty: number;
}

interface Item {
  id: string;
  name: string;
  purchase_cost?: number;
}

interface Customer {
  id: string;
  company_name: string;
}

interface CustomerTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: CustomerTemplate | null;
  onSuccess: () => void;
}

export function CustomerTemplateDialog({ 
  open, 
  onOpenChange, 
  template, 
  onSuccess 
}: CustomerTemplateDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    customer_id: '',
    description: '',
    is_active: true
  });
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fetch customers with explicit typing
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profile')
        .select('id, company_name')
        .order('company_name');
      
      if (error) throw error;
      return data as Customer[];
    }
  });

  // Fetch items with explicit typing - using available columns
  const { data: items } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name, purchase_cost')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Item[];
    }
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        customer_id: template.customer_id,
        description: template.description || '',
        is_active: template.is_active
      });
      setTemplateItems([]);
    } else {
      setFormData({
        name: '',
        customer_id: '',
        description: '',
        is_active: true
      });
      setTemplateItems([]);
    }
  }, [template, open]);

  const addTemplateItem = () => {
    if (!items || items.length === 0) return;
    
    const firstItem = items[0];
    setTemplateItems([...templateItems, {
      item_id: firstItem.id,
      item_name: firstItem.name,
      unit_measure: 'EA',
      unit_price: firstItem.purchase_cost || 0,
      monday_qty: 0,
      tuesday_qty: 0,
      wednesday_qty: 0,
      thursday_qty: 0,
      friday_qty: 0,
      saturday_qty: 0,
      sunday_qty: 0
    }]);
  };

  const removeTemplateItem = (index: number) => {
    setTemplateItems(templateItems.filter((_, i) => i !== index));
  };

  const updateTemplateItem = (index: number, field: keyof TemplateItem, value: any) => {
    const updated = [...templateItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Update item details if item_id changed
    if (field === 'item_id' && items) {
      const selectedItem = items.find(item => item.id === value);
      if (selectedItem) {
        updated[index].item_name = selectedItem.name;
        updated[index].unit_measure = 'EA';
        updated[index].unit_price = selectedItem.purchase_cost || 0;
      }
    }
    
    setTemplateItems(updated);
  };

  const calculateTotalQty = (item: TemplateItem) => {
    return item.monday_qty + item.tuesday_qty + item.wednesday_qty + 
           item.thursday_qty + item.friday_qty + item.saturday_qty + item.sunday_qty;
  };

  const calculateExtPrice = (item: TemplateItem) => {
    return calculateTotalQty(item) * item.unit_price;
  };

  const handleSave = async () => {
    if (!formData.name || !formData.customer_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // For now, just show success - actual save functionality will be implemented once tables are created
      toast({
        title: "Success",
        description: `Template functionality coming soon - template "${formData.name}" would be ${template ? 'updated' : 'created'}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${template ? 'update' : 'create'} template`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Customer Template' : 'Create Customer Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter template name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select 
                value={formData.customer_id} 
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active Template</Label>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Template Items</CardTitle>
              <Button onClick={addTemplateItem} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>U/M</TableHead>
                      <TableHead>Unit Price($)</TableHead>
                      <TableHead>Mon</TableHead>
                      <TableHead>Tue</TableHead>
                      <TableHead>Wed</TableHead>
                      <TableHead>Thu</TableHead>
                      <TableHead>Fri</TableHead>
                      <TableHead>Sat</TableHead>
                      <TableHead>Sun</TableHead>
                      <TableHead>Total Qty</TableHead>
                      <TableHead>Ext. Price($)</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="min-w-[200px]">
                          <Select
                            value={item.item_id}
                            onValueChange={(value) => updateTemplateItem(index, 'item_id', value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {items?.map((catalogItem) => (
                                <SelectItem key={catalogItem.id} value={catalogItem.id}>
                                  {catalogItem.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{item.unit_measure}</TableCell>
                        <TableCell>{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.monday_qty}
                            onChange={(e) => updateTemplateItem(index, 'monday_qty', parseInt(e.target.value) || 0)}
                            className="w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.tuesday_qty}
                            onChange={(e) => updateTemplateItem(index, 'tuesday_qty', parseInt(e.target.value) || 0)}
                            className="w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.wednesday_qty}
                            onChange={(e) => updateTemplateItem(index, 'wednesday_qty', parseInt(e.target.value) || 0)}
                            className="w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.thursday_qty}
                            onChange={(e) => updateTemplateItem(index, 'thursday_qty', parseInt(e.target.value) || 0)}
                            className="w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.friday_qty}
                            onChange={(e) => updateTemplateItem(index, 'friday_qty', parseInt(e.target.value) || 0)}
                            className="w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.saturday_qty}
                            onChange={(e) => updateTemplateItem(index, 'saturday_qty', parseInt(e.target.value) || 0)}
                            className="w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.sunday_qty}
                            onChange={(e) => updateTemplateItem(index, 'sunday_qty', parseInt(e.target.value) || 0)}
                            className="w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>{calculateTotalQty(item)}</TableCell>
                        <TableCell>{calculateExtPrice(item).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTemplateItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {templateItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          No items added. Click "Add Item" to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}