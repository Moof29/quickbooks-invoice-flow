import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  unit_price: number;
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
  purchase_cost?: number;
}

interface PortalTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: CustomerTemplate | null;
  customerId: string;
  onSuccess: () => void;
}

export function PortalTemplateDialog({ 
  open, 
  onOpenChange, 
  template,
  customerId,
  onSuccess 
}: PortalTemplateDialogProps) {
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { data: allItems } = useQuery<Item[]>({
    queryKey: ['portal-all-items'],
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

  const filteredAvailableItems = allItems
    ?.filter(item => !itemRows.some(row => row.item_id === item.id))
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    || [];

  useEffect(() => {
    if (!open || !template) return;
    loadTemplateItems(template.id);
  }, [template, open]);

  const loadTemplateItems = async (templateId: string) => {
    if (!allItems) return;
    
    try {
      const { data: templateItemsData, error } = await supabase
        .from('customer_template_items')
        .select('*')
        .eq('template_id', templateId);

      if (error) throw error;

      const rows: ItemRow[] = templateItemsData.map(ti => {
        const item = allItems.find(i => i.id === ti.item_id);
        return {
          item_id: ti.item_id,
          item_name: item?.name || 'Unknown Item',
          unit_price: ti.unit_price,
          sunday_qty: ti.sunday_qty || 0,
          monday_qty: ti.monday_qty || 0,
          tuesday_qty: ti.tuesday_qty || 0,
          wednesday_qty: ti.wednesday_qty || 0,
          thursday_qty: ti.thursday_qty || 0,
          friday_qty: ti.friday_qty || 0,
          saturday_qty: ti.saturday_qty || 0,
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
    return calculateWeeklyTotal(row) * row.unit_price;
  };

  const addItem = () => {
    if (!selectedItemId || !allItems) return;
    
    if (itemRows.some(row => row.item_id === selectedItemId)) {
      toast({
        title: "Item already added",
        description: "This item is already in the template",
        variant: "destructive",
      });
      return;
    }

    const item = allItems.find(i => i.id === selectedItemId);
    if (!item) return;

    const newRow: ItemRow = {
      item_id: item.id,
      item_name: item.name,
      unit_price: item.purchase_cost || 0,
      sunday_qty: 0,
      monday_qty: 0,
      tuesday_qty: 0,
      wednesday_qty: 0,
      thursday_qty: 0,
      friday_qty: 0,
      saturday_qty: 0,
    };

    setItemRows([...itemRows, newRow]);
    setSelectedItemId('');
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeItem = (itemId: string) => {
    setItemRows(itemRows.filter(row => row.item_id !== itemId));
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    
    if (!draggedItemId || draggedItemId === targetItemId) {
      setDraggedItemId(null);
      return;
    }

    const draggedIndex = itemRows.findIndex(row => row.item_id === draggedItemId);
    const targetIndex = itemRows.findIndex(row => row.item_id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItemId(null);
      return;
    }

    const newRows = [...itemRows];
    const [draggedItem] = newRows.splice(draggedIndex, 1);
    newRows.splice(targetIndex, 0, draggedItem);

    setItemRows(newRows);
    setDraggedItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  const handleSave = async () => {
    if (!template) return;

    setLoading(true);

    try {
      const { data: profile } = await supabase
        .from('customer_profile')
        .select('organization_id')
        .eq('id', customerId)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Delete existing template items
      await supabase
        .from('customer_template_items')
        .delete()
        .eq('template_id', template.id);

      // Save all items
      if (itemRows.length > 0) {
        const itemsToInsert = itemRows.map(row => ({
          template_id: template.id,
          item_id: row.item_id,
          unit_measure: 'EA',
          unit_price: row.unit_price,
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
        description: "Template updated successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Failed to update template",
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
          <DialogTitle>Edit Order Template: {template?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex gap-2 items-end border rounded-md p-4 bg-muted/30">
            <div className="flex-1 relative" ref={dropdownRef}>
              <Label>Add Item to Template</Label>
              <Input
                placeholder="Search items by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full"
              />
              {showDropdown && searchQuery && filteredAvailableItems.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-[300px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {filteredAvailableItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setSearchQuery(item.name);
                        setShowDropdown(false);
                      }}
                    >
                      <span className="flex-1">{item.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ${(item.purchase_cost || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={addItem} disabled={!selectedItemId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <ScrollArea className="flex-1 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="w-[100px]">Price</TableHead>
                  <TableHead className="w-[80px]">Sun</TableHead>
                  <TableHead className="w-[80px]">Mon</TableHead>
                  <TableHead className="w-[80px]">Tue</TableHead>
                  <TableHead className="w-[80px]">Wed</TableHead>
                  <TableHead className="w-[80px]">Thu</TableHead>
                  <TableHead className="w-[80px]">Fri</TableHead>
                  <TableHead className="w-[80px]">Sat</TableHead>
                  <TableHead className="w-[100px]">Weekly Qty</TableHead>
                  <TableHead className="w-[120px]">Weekly Total</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemRows.map((row) => (
                  <TableRow
                    key={row.item_id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, row.item_id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, row.item_id)}
                    onDragEnd={handleDragEnd}
                    className={draggedItemId === row.item_id ? 'opacity-50' : ''}
                  >
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    </TableCell>
                    <TableCell className="font-medium">{row.item_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      ${row.unit_price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.sunday_qty}
                        onChange={(e) => updateItemRow(row.item_id, 'sunday_qty', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.monday_qty}
                        onChange={(e) => updateItemRow(row.item_id, 'monday_qty', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.tuesday_qty}
                        onChange={(e) => updateItemRow(row.item_id, 'tuesday_qty', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.wednesday_qty}
                        onChange={(e) => updateItemRow(row.item_id, 'wednesday_qty', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.thursday_qty}
                        onChange={(e) => updateItemRow(row.item_id, 'thursday_qty', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.friday_qty}
                        onChange={(e) => updateItemRow(row.item_id, 'friday_qty', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.saturday_qty}
                        onChange={(e) => updateItemRow(row.item_id, 'saturday_qty', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {calculateWeeklyTotal(row)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${calculateWeeklyAmount(row).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(row.item_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
