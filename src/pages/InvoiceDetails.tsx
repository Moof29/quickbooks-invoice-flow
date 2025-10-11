import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [salesOrderLinks, setSalesOrderLinks] = useState<SalesOrderLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadInvoiceDetails();
    }
  }, [id]);

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

  const handleDelete = async () => {
    if (!invoice) return;
    
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`)) {
      return;
    }

    try {
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
          <Button variant="outline" size="sm">
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
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Status Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusVariant(invoice.status)} className="text-base px-3 py-1">
              {invoice.status || 'draft'}
            </Badge>
            {daysUntilDue !== null && invoice.status?.toLowerCase() !== 'paid' && (
              <p className="text-xs text-muted-foreground mt-2">
                {daysUntilDue > 0 ? `Due in ${daysUntilDue} days` : daysUntilDue === 0 ? 'Due today' : `Overdue by ${Math.abs(daysUntilDue)} days`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${invoice.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        {/* Dates Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dates</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Invoice Date:</span>
                <span className="font-medium">{invoice.invoice_date ? format(new Date(invoice.invoice_date), 'MMM d, yyyy') : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span className="font-medium">{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer Information */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-medium">{invoice.customer_profile?.company_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contact Name</p>
              <p className="font-medium">{invoice.customer_profile?.display_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{invoice.customer_profile?.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{invoice.customer_profile?.phone || 'N/A'}</p>
            </div>
            {invoice.customer_profile?.id && (
              <Link to={`/customers/${invoice.customer_profile.id}`}>
                <Button variant="link" size="sm" className="p-0 h-auto">
                  View Customer Details →
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Related Sales Orders */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Related Sales Orders</CardTitle>
            <CardDescription>
              Orders that were invoiced together
            </CardDescription>
          </CardHeader>
          <CardContent>
            {salesOrderLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related sales orders</p>
            ) : (
              <div className="space-y-2">
                {salesOrderLinks.map((link) => (
                  <Link
                    key={link.id}
                    to={`/sales-orders/${link.sales_order_id}`}
                    className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{link.sales_order?.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          Delivery: {link.sales_order?.delivery_date ? format(new Date(link.sales_order.delivery_date), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                      <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} on this invoice
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.item_record?.name || 'Unknown Item'}</div>
                      {item.item_record?.sku && (
                        <div className="text-sm text-muted-foreground">SKU: {item.item_record.sku}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    ${item.unit_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${item.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="border-t p-6">
            <div className="flex flex-col items-end space-y-2 max-w-sm ml-auto">
              <div className="flex justify-between w-full text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">
                  ${invoice.subtotal?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between w-full text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">
                  ${invoice.tax_total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between w-full text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>
                  ${invoice.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memo */}
      {invoice.memo && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Memo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.memo}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
