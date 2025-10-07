import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface CustomerTemplate {
  id: string;
  customer_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface ItemRow {
  item_id: string;
  item_name: string;
  list_price: number;
  custom_price: number;
  sunday_qty: number;
  monday_qty: number;
  tuesday_qty: number;
  wednesday_qty: number;
  thursday_qty: number;
  friday_qty: number;
  saturday_qty: number;
}

interface Item {
  id: string;
  name: string;
  list_price?: number;
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
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fetch customers
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

  // Fetch ALL items - every item available in the system
  const { data: allItems } = useQuery<Item[]>({
    queryKey: ['all-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name, purchase_cost')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data.map(item => ({
        id: item.id,
        name: item.name,
        list_price: item.purchase_cost || 0
      })) as Item[];
    }
  });

  // Initialize item rows when dialog opens or items load
  useEffect(() => {
    if (!open || !allItems) return;

    if (template) {
      // Editing existing template
      setFormData({
        name: template.name,
        customer_id: template.customer_id,
        description: template.description || '',
        is_active: template.is_active
      });
      loadTemplateItems(template.id);
    } else {
      // New template - show all items with zero quantities
      setFormData({
        name: '',
        customer_id: '',
        description: '',
        is_active: true
      });
      initializeItemRows();
    }
  }, [template, open, allItems]);

  const initializeItemRows = () => {
    if (!allItems) return;
    
    const rows: ItemRow[] = allItems.map(item => ({
      item_id: item.id,
      item_name: item.name,
      list_price: item.list_price || 0,
      custom_price: item.list_price || 0,
      sunday_qty: 0,
      monday_qty: 0,
      tuesday_qty: 0,
      wednesday_qty: 0,
      thursday_qty: 0,
      friday_qty: 0,
      saturday_qty: 0,
    }));
    
    setItemRows(rows);
  };

  const loadTemplateItems = async (templateId: string) => {
    if (!allItems) return;
    
    try {
      const { data: templateItemsData, error } = await supabase
        .from('customer_template_items')
        .select('*')
        .eq('template_id', templateId);

      if (error) throw error;

      // Create a map of template items for quick lookup
      const templateItemsMap = new Map(
        templateItemsData.map(ti => [ti.item_id, ti])
      );

      // Create rows for ALL items, with saved quantities if they exist
      const rows: ItemRow[] = allItems.map(item => {
        const savedItem = templateItemsMap.get(item.id);
        return {
          item_id: item.id,
          item_name: item.name,
          list_price: item.list_price || 0,
          custom_price: savedItem?.unit_price || item.list_price || 0,
          sunday_qty: savedItem?.sunday_qty || 0,
          monday_qty: savedItem?.monday_qty || 0,
          tuesday_qty: savedItem?.tuesday_qty || 0,
          wednesday_qty: savedItem?.wednesday_qty || 0,
          thursday_qty: savedItem?.thursday_qty || 0,
          friday_qty: savedItem?.friday_qty || 0,
          saturday_qty: savedItem?.saturday_qty || 0,
        };
      });

      setItemRows(rows);
    } catch (error) {
      console.error('Error loading template items:', error);
    }
  };

  const updateItemRow = (itemId: string, field: keyof ItemRow, value: any) => {
    setItemRows(rows => 
      rows.map(row => 
        row.item_id === itemId 
          ? { ...row, [field]: typeof value === 'string' ? parseFloat(value) || 0 : value }
          : row
      )
    );
  };

  const calculateWeeklyTotal = (row: ItemRow) => {
    return row.sunday_qty + row.monday_qty + row.tuesday_qty + 
           row.wednesday_qty + row.thursday_qty + row.friday_qty + row.saturday_qty;
  };

  const calculateWeeklyAmount = (row: ItemRow) => {
    return calculateWeeklyTotal(row) * row.custom_price;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No user found');
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      
      if (profileError || !profile?.organization_id) {
        throw new Error('No organization found for user');
      }

      const templateData = {
        name: formData.name,
        customer_id: formData.customer_id,
        description: formData.description,
        is_active: formData.is_active,
        organization_id: profile.organization_id
      };

      let savedTemplate;
      if (template) {
        const { data, error } = await supabase
          .from('customer_templates')
          .update(templateData)
          .eq('id', template.id)
          .select()
          .single();
        
        if (error) throw error;
        savedTemplate = data;
      } else {
        const { data, error } = await supabase
          .from('customer_templates')
          .insert(templateData)
          .select()
          .single();
        
        if (error) throw error;
        savedTemplate = data;
      }

      // Delete existing template items if updating
      if (template) {
        await supabase
          .from('customer_template_items')
          .delete()
          .eq('template_id', template.id);
      }

      // Save only items with quantities > 0
      const itemsWithQuantities = itemRows.filter(row => 
        calculateWeeklyTotal(row) > 0
      );

      if (itemsWithQuantities.length > 0) {
        const itemsToInsert = itemsWithQuantities.map(row => ({
          template_id: savedTemplate.id,
          item_id: row.item_id,
          unit_measure: 'EA',
          unit_price: row.custom_price,
          sunday_qty: row.sunday_qty,
          monday_qty: row.monday_qty,
          tuesday_qty: row.tuesday_qty,
          wednesday_qty: row.wednesday_qty,
          thursday_qty: row.thursday_qty,
          friday_qty: row.friday_qty,
          saturday_qty: row.saturday_qty,
          organization_id: profile.organization_id
        }));

        const { error: itemsError } = await supabase
          .from('customer_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: `Template "${formData.name}" ${template ? 'updated' : 'created'} successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
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
      <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Customer Template' : 'Create Customer Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active Template</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Spreadsheet-style table */}
          <div className="flex-1 border rounded-md overflow-hidden">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[250px] sticky left-0 bg-background z-20">Item Name</TableHead>
                    <TableHead className="w-[100px]">List Price</TableHead>
                    <TableHead className="w-[100px]">Custom Price</TableHead>
                    <TableHead className="w-[80px] text-center">Sun</TableHead>
                    <TableHead className="w-[80px] text-center">Mon</TableHead>
                    <TableHead className="w-[80px] text-center">Tue</TableHead>
                    <TableHead className="w-[80px] text-center">Wed</TableHead>
                    <TableHead className="w-[80px] text-center">Thu</TableHead>
                    <TableHead className="w-[80px] text-center">Fri</TableHead>
                    <TableHead className="w-[80px] text-center">Sat</TableHead>
                    <TableHead className="w-[100px] text-center">Week Total</TableHead>
                    <TableHead className="w-[120px] text-right">Week Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemRows.map((row) => (
                    <TableRow key={row.item_id}>
                      <TableCell className="font-medium sticky left-0 bg-background">
                        {row.item_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ${row.list_price.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.custom_price}
                          onChange={(e) => updateItemRow(row.item_id, 'custom_price', e.target.value)}
                          className="w-20 h-8 text-sm"
                          min="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.sunday_qty}
                          onChange={(e) => updateItemRow(row.item_id, 'sunday_qty', e.target.value)}
                          className="w-16 h-8 text-sm text-center"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.monday_qty}
                          onChange={(e) => updateItemRow(row.item_id, 'monday_qty', e.target.value)}
                          className="w-16 h-8 text-sm text-center"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.tuesday_qty}
                          onChange={(e) => updateItemRow(row.item_id, 'tuesday_qty', e.target.value)}
                          className="w-16 h-8 text-sm text-center"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.wednesday_qty}
                          onChange={(e) => updateItemRow(row.item_id, 'wednesday_qty', e.target.value)}
                          className="w-16 h-8 text-sm text-center"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.thursday_qty}
                          onChange={(e) => updateItemRow(row.item_id, 'thursday_qty', e.target.value)}
                          className="w-16 h-8 text-sm text-center"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.friday_qty}
                          onChange={(e) => updateItemRow(row.item_id, 'friday_qty', e.target.value)}
                          className="w-16 h-8 text-sm text-center"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.saturday_qty}
                          onChange={(e) => updateItemRow(row.item_id, 'saturday_qty', e.target.value)}
                          className="w-16 h-8 text-sm text-center"
                          min="0"
                        />
                      </TableCell>
                      <TableCell className="text-center font-medium bg-muted/30">
                        {calculateWeeklyTotal(row)}
                      </TableCell>
                      <TableCell className="text-right font-medium bg-muted/30">
                        ${calculateWeeklyAmount(row).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {itemRows.filter(row => calculateWeeklyTotal(row) > 0).length} items with quantities
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
