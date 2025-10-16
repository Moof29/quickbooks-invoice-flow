import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoiceData();
    } else {
      // Clean up PDF URL when dialog closes
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
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

      // Generate PDF blob
      const blob = await pdf(<InvoicePDF invoice={invoiceData} lineItems={lineItemsData || []} />).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error loading invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Invoice Preview {invoice?.invoice_number && `- ${invoice.invoice_number}`}
          </DialogTitle>
          <DialogDescription>
            View the invoice as a PDF document
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0 rounded"
              title="Invoice PDF"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No invoice data available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
