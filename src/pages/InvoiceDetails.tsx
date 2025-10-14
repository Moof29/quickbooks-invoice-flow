import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Download,
  Send,
  Edit,
  Trash2,
  CheckCircle,
  FileText,
  Calendar,
  DollarSign,
  Eye,
  Save,
  X,
  Plus,
  Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { format } from 'date-fns';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/InvoicePDF';
import { useInvoiceEdit } from '@/hooks/useInvoiceEdit';
import { Combobox } from '@/components/ui/combobox';
import { InvoicePaymentTracker } from '@/components/InvoicePaymentTracker';

interface InvoiceLineItem {
  id: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  item_record?: {
    name: string;
    sku: string;
  };
}

interface SalesOrderLink {
  id: string;
  sales_order_id: string;
  sales_order?: {
    order_number: string;
    order_date: string;
    delivery_date: string;
  };
}

interface InvoiceDetails {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  subtotal: number;
  tax_total: number;
  status: string;
  memo?: string;
  amount_paid?: number;
  amount_due?: number;
  customer_profile?: {
    id: string;
    display_name: string;
    company_name: string;
    email: string;
    phone: string;
  };
}

export default function InvoiceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthProfile();
  
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [salesOrderLinks, setSalesOrderLinks] = useState<SalesOrderLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableItems, setAvailableItems] = useState<{ id: string; name: string; unit_price: number }[]>([]);
  const [newItem, setNewItem] = useState({ item_id: '', quantity: '1', unit_price: '0' });
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  
  // Form state for editing
  const [formData, setFormData] = useState({
    invoice_date: '',
    due_date: '',
    status: '',
    memo: '',
  });

  const loadAvailableItems = async () => {
    try {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name, purchase_cost')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAvailableItems((data || []).map(item => ({
        id: item.id,
        name: item.name,
        unit_price: item.purchase_cost || 0
      })));
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const loadInvoiceDetails = async () => {
    try {
      setLoading(true);

      // Fetch invoice header
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoice_record')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          total,
          subtotal,
          tax_total,
          status,
          memo,
          amount_paid,
          amount_due,
          customer_profile:customer_id (
            id,
            display_name,
            company_name,
            email,
            phone
          )
        `)
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);

      // Fetch line items
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('invoice_line_item')
        .select(`
          id,
          item_id,
          description,
          quantity,
          unit_price,
          amount,
          item_record:item_id (
            name,
            sku
          )
        `)
        .eq('invoice_id', id)
        .order('created_at', { ascending: true });

      if (lineItemsError) throw lineItemsError;
      setLineItems(lineItemsData || []);

      // Fetch sales order links
      const { data: linksData, error: linksError } = await supabase
        .from('sales_order_invoice_link')
        .select(`
          id,
          sales_order_id,
          sales_order:sales_order_id (
            order_number,
            order_date,
            delivery_date
          )
        `)
        .eq('invoice_id', id);

      if (linksError) throw linksError;
      setSalesOrderLinks(linksData || []);
      
    } catch (error: any) {
      console.error('Error loading invoice details:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load invoice details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize the invoice edit hook with the loadInvoiceDetails callback
  const {
    editMode,
    setEditMode,
    handleInvoiceSave,
    deleteLineItemMutation,
    addLineItemMutation,
    updateQuantityMutation,
  } = useInvoiceEdit(id || '', loadInvoiceDetails);

  useEffect(() => {
    if (id) {
      loadInvoiceDetails();
      loadAvailableItems();
    }
  }, [id]);

  useEffect(() => {
    if (invoice && !editMode) {
      setFormData({
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        status: invoice.status,
        memo: invoice.memo || '',
      });
    }
  }, [invoice, editMode]);

  // Initialize quantities when line items load
  useEffect(() => {
    if (lineItems.length > 0) {
      const initialQuantities: Record<string, string> = {};
      lineItems.forEach(item => {
        initialQuantities[item.id] = item.quantity.toString();
      });
      setQuantities(initialQuantities);
    }
  }, [lineItems]);

  const handleQuantityChange = (lineItemId: string, value: string) => {
    setQuantities(prev => ({ ...prev, [lineItemId]: value }));
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, lineItemId: string, originalQuantity: number) => {
    if (e.key === "Escape") {
      setQuantities(prev => ({ ...prev, [lineItemId]: originalQuantity.toString() }));
    }
  };

  const handleSaveAll = async () => {
    try {
      // Validate all quantities first
      const updates: Array<{ lineItemId: string; quantity: number; unitPrice: number }> = [];
      for (const item of lineItems) {
        const newQuantity = parseFloat(quantities[item.id] || "0");
        if (isNaN(newQuantity) || newQuantity < 0) {
          toast({
            title: "Invalid quantity",
            description: `Please enter a valid quantity for ${item.item_record?.name || 'item'}`,
            variant: "destructive",
          });
          return;
        }
        
        // Only include if changed
        if (newQuantity !== item.quantity) {
          updates.push({ lineItemId: item.id, quantity: newQuantity, unitPrice: item.unit_price });
        }
      }

      // Save invoice header data
      await handleInvoiceSave(formData);

      // Save all quantity updates
      for (const update of updates) {
        await updateQuantityMutation.mutateAsync(update);
      }

      if (updates.length > 0) {
        toast({
          title: "Success",
          description: `Invoice updated with ${updates.length} quantity change${updates.length !== 1 ? 's' : ''}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoice) return;

    try {
      // Log deletion reason to audit_events
      if (deletionReason.trim()) {
        await supabase
          .from('audit_events')
          .insert({
            organization_id: profile?.organization_id,
            user_id: profile?.id,
            entity_type: 'invoice_record',
            entity_id: invoice.id,
            event_type: 'delete',
            detail: {
              invoice_number: invoice.invoice_number,
              deletion_reason: deletionReason.trim(),
            },
          });
      }

      // Delete the invoice
      const { error } = await supabase
        .from('invoice_record')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      navigate('/invoices');
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletionReason('');
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;

    try {
      const { error } = await supabase
        .from('invoice_record')
        .update({ status: 'paid' })
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice marked as paid",
      });

      loadInvoiceDetails();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice",
        variant: "destructive",
      });
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'default';
      case 'sent':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const calculateDaysUntilDue = () => {
    if (!invoice?.due_date) return null;
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleShowPDF = async () => {
    if (!invoice) return;

    try {
      // Generate the PDF
      const blob = await pdf(
        <InvoicePDF invoice={invoice} lineItems={lineItems} />
      ).toBlob();

      // Create a URL for the blob and open in new tab
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    try {
      // Generate the PDF
      const blob = await pdf(
        <InvoicePDF invoice={invoice} lineItems={lineItems} />
      ).toBlob();

      // Create a download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8">
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex-1 space-y-4 p-8">
        <div className="text-center py-16">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Invoice not found</h3>
          <p className="text-muted-foreground mb-4">The invoice you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const daysUntilDue = calculateDaysUntilDue();

  return (
    <div className="flex-1 space-y-4 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            <p className="text-muted-foreground mt-1">
              Invoice Details
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleShowPDF}>
            <Eye className="h-4 w-4 mr-2" />
            Show PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm">
            <Send className="h-4 w-4 mr-2" />
            Send Email
          </Button>
          {invoice.status?.toLowerCase() !== 'paid' && (
            <Button variant="outline" size="sm" onClick={handleMarkAsPaid}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Paid
            </Button>
          )}
          {!editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleSaveAll}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setEditMode(false);
                // Reset to original values
                setFormData({
                  invoice_date: invoice.invoice_date,
                  due_date: invoice.due_date,
                  status: invoice.status,
                  memo: invoice.memo || '',
                });
                // Reset quantities
                const initialQuantities: Record<string, string> = {};
                lineItems.forEach(item => {
                  initialQuantities[item.id] = item.quantity.toString();
                });
                setQuantities(initialQuantities);
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
          <Button variant="destructive" size="sm" onClick={handleDeleteClick}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Compact Summary with Customer Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          {editMode ? (
            <div className="grid grid-cols-3 gap-4 mb-4">
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
          ) : (
            <div className="flex flex-wrap items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={getStatusVariant(invoice.status)}>
                  {invoice.status || 'draft'}
                </Badge>
                {daysUntilDue !== null && invoice.status?.toLowerCase() !== 'paid' && (
                  <span className="text-xs text-muted-foreground">
                    {daysUntilDue > 0 ? `(Due in ${daysUntilDue} days)` : daysUntilDue === 0 ? '(Due today)' : `(Overdue by ${Math.abs(daysUntilDue)} days)`}
                  </span>
                )}
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  ${invoice.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Invoice:</span>
                  <span className="font-medium">{invoice.invoice_date ? format(new Date(invoice.invoice_date), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Due:</span>
                  <span className="font-medium">{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
          
          <Separator className="my-3" />
          
          {/* Customer Info Inline */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Customer: </span>
              <span className="font-medium">{invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'N/A'}</span>
            </div>
            {invoice.customer_profile?.email && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium">{invoice.customer_profile.email}</span>
                </div>
              </>
            )}
            {invoice.customer_profile?.phone && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="font-medium">{invoice.customer_profile.phone}</span>
                </div>
              </>
            )}
            {invoice.customer_profile?.id && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <Link to={`/customers/${invoice.customer_profile.id}`}>
                  <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                    View Customer →
                  </Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Line Items - Compact Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
              {editMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingItem(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 w-20">Qty</TableHead>
                  <TableHead className="h-9">Item</TableHead>
                  <TableHead className="h-9 text-right w-24">Price</TableHead>
                  <TableHead className="h-9 text-right w-24">Amount</TableHead>
                  {editMode && <TableHead className="h-9 text-center w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="py-2">
                      {editMode ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quantities[item.id] || ''}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          onKeyDown={(e) => handleQuantityKeyDown(e, item.id, item.quantity)}
                          className="w-20 h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      ) : (
                        <span>{item.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.item_record?.name || 'Unknown Item'}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">- {item.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      ${item.unit_price?.toFixed(2)}
                    </TableCell>
                    <TableCell className="py-2 text-right font-medium">
                      ${item.amount?.toFixed(2)}
                    </TableCell>
                    {editMode && (
                      <TableCell className="py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLineItemMutation.mutate(item.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {isAddingItem && editMode && (
                  <TableRow className="hover:bg-muted/50 bg-muted/20">
                    <TableCell className="py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                        className="w-20 h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Combobox
                        options={availableItems.map(item => ({
                          value: item.id,
                          label: item.name
                        }))}
                        value={newItem.item_id}
                        onValueChange={(value) => {
                          const selectedItem = availableItems.find(item => item.id === value);
                          setNewItem({ 
                            ...newItem, 
                            item_id: value,
                            unit_price: selectedItem?.unit_price?.toString() || '0'
                          });
                        }}
                        placeholder="Select item..."
                        searchPlaceholder="Search items..."
                        emptyText="No items found."
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                        className="w-24 h-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="font-medium">
                        ${(parseFloat(newItem.quantity || '0') * parseFloat(newItem.unit_price || '0')).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!newItem.item_id || !newItem.quantity || !newItem.unit_price) {
                              toast({
                                title: 'Error',
                                description: 'Please select an item, enter quantity and price',
                                variant: 'destructive',
                              });
                              return;
                            }
                            await addLineItemMutation.mutateAsync({
                              item_id: newItem.item_id,
                              quantity: parseFloat(newItem.quantity),
                              unit_price: parseFloat(newItem.unit_price),
                              organization_id: profile?.organization_id || '',
                            });
                            setNewItem({ item_id: '', quantity: '1', unit_price: '0' });
                            setIsAddingItem(false);
                            loadInvoiceDetails();
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsAddingItem(false);
                            setNewItem({ item_id: '', quantity: '1', unit_price: '0' });
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="border-t px-6 py-3 bg-muted/20">
            <div className="flex flex-col items-end space-y-1 max-w-xs ml-auto text-sm">
              <div className="flex justify-between w-full">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">
                  ${invoice.subtotal?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between w-full">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">
                  ${invoice.tax_total?.toFixed(2) || '0.00'}
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between w-full font-bold">
                <span>Total:</span>
                <span>
                  ${invoice.total?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memo */}
      {(invoice.memo || editMode) && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Memo</CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Textarea
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                placeholder="Add memo..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.memo}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Tracking */}
      <InvoicePaymentTracker
        invoiceId={invoice.id}
        invoiceTotal={invoice.total}
        amountPaid={invoice.amount_paid || 0}
        onPaymentChange={loadInvoiceDetails}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice {invoice?.invoice_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="deletion-reason" className="text-sm font-medium">
              Reason for deletion (optional)
            </Label>
            <Textarea
              id="deletion-reason"
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              placeholder="Enter reason for deleting this invoice..."
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletionReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
