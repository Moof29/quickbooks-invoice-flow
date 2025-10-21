import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PDFViewer } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Download, Send, Trash2 } from 'lucide-react';

interface InvoicePreviewDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

interface Invoice {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  subtotal: number;
  tax_total: number;
  status: string;
  memo?: string;
  customer_profile?: {
    display_name: string;
    company_name: string;
    email: string;
    phone: string;
  };
}

export const InvoicePreviewDialog = ({ invoiceId, open, onOpenChange }: InvoicePreviewDialogProps) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoiceData();
    }
  }, [open, invoiceId]);

  const loadInvoiceData = async () => {
    if (!invoiceId) return;

    try {
      setLoading(true);

      // Fetch invoice details
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoice_record')
        .select(`
          invoice_number,
          invoice_date,
          due_date,
          total,
          subtotal,
          tax_total,
          status,
          memo,
          customer_profile:customer_id (
            display_name,
            company_name,
            email,
            phone
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

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
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });

      if (lineItemsError) throw lineItemsError;

      setInvoice(invoiceData);
      setLineItems(lineItemsData || []);
    } catch (error) {
      console.error('Error loading invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (invoiceId) {
      window.location.href = `/invoices/${invoiceId}`;
    }
  };

  const handleDownloadPDF = () => {
    toast({
      title: "Download PDF",
      description: "PDF download functionality coming soon",
    });
  };

  const handleSendToCustomer = () => {
    toast({
      title: "Send to Customer",
      description: "Email functionality coming soon",
    });
  };

  const handleDelete = async () => {
    if (!invoiceId || !confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('invoice_record')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen sm:h-[85vh] md:h-[90vh] w-full max-w-full sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <DialogTitle className="text-base sm:text-lg md:text-xl">
            Invoice {invoice?.invoice_number && `${invoice.invoice_number}`}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-hidden bg-muted/10">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoice ? (
            <PDFViewer width="100%" height="100%" className="border-0">
              <InvoicePDF invoice={invoice} lineItems={lineItems} />
            </PDFViewer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No invoice data available
            </div>
          )}
        </div>

        {/* Responsive action buttons - stacked on mobile, row on tablet+ */}
        <div className="shrink-0 border-t bg-background p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" size="sm" onClick={handleEdit} className="w-full sm:flex-1 md:flex-initial md:w-auto">
              <Edit className="h-4 w-4 mr-2" />
              <span>Edit Invoice</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="w-full sm:flex-1 md:flex-initial md:w-auto">
              <Download className="h-4 w-4 mr-2" />
              <span>Download PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendToCustomer} className="w-full sm:flex-1 md:flex-initial md:w-auto">
              <Send className="h-4 w-4 mr-2" />
              <span>Send to Customer</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} className="w-full sm:flex-1 md:flex-initial md:w-auto">
              <Trash2 className="h-4 w-4 mr-2" />
              <span>Delete Invoice</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
