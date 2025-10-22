import { useState, useEffect } from 'react';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Download, Send, Trash2, FileText, X } from 'lucide-react';

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
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoiceData();
    }
  }, [open, invoiceId]);

  // Generate PDF blob URL when invoice data is loaded
  useEffect(() => {
    if (!invoice || lineItems.length === 0) {
      return;
    }

    let isCancelled = false;

    const generatePdfUrl = async () => {
      try {
        console.log('Generating PDF blob...');
        const blob = await pdf(<InvoicePDF invoice={invoice} lineItems={lineItems} />).toBlob();
        
        if (!isCancelled) {
          const url = URL.createObjectURL(blob);
          console.log('PDF blob URL created:', url);
          setPdfUrl(url);
        }
      } catch (error) {
        console.error('Error generating PDF:', error);
        toast({
          title: "Error",
          description: "Failed to generate PDF preview",
          variant: "destructive",
        });
      }
    };

    generatePdfUrl();

    return () => {
      isCancelled = true;
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [invoice, lineItems]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen sm:h-[85vh] w-full max-w-full sm:w-[65.7vh] sm:max-w-[65.7vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Professional Header */}
        <DialogHeader className="px-4 sm:px-5 py-3 border-b bg-gradient-to-r from-background to-muted/20 shrink-0">
          <div className="sr-only">
            <DialogTitle>Invoice Preview</DialogTitle>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-semibold tracking-tight">
                  {invoice?.invoice_number || 'Invoice Preview'}
                </div>
                {invoice && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                      {invoice.customer_profile?.company_name || invoice.customer_profile?.display_name}
                    </span>
                    <Separator orientation="vertical" className="h-3 sm:h-4" />
                    <Badge variant={getStatusVariant(invoice.status)} className="text-xs">
                      {invoice.status}
                    </Badge>
                    {invoice.total && (
                      <>
                        <Separator orientation="vertical" className="h-3 sm:h-4" />
                        <span className="text-xs sm:text-sm font-semibold">
                          ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 rounded-full hover:bg-muted shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        {/* Native PDF Viewer with built-in pinch-to-zoom */}
        <div className="flex-1 min-h-0 overflow-hidden bg-muted/30 p-2">
          <div className="h-full rounded-lg shadow-xl bg-background border overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading invoice...</p>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#view=FitH`}
                className="w-full h-full border-0"
                title="Invoice PDF"
                style={{ 
                  touchAction: 'manipulation',
                  backgroundColor: '#525659'
                }}
              />
            ) : invoice && lineItems.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating PDF...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <FileText className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No invoice data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Professional Action Bar */}
        <div className="shrink-0 border-t bg-gradient-to-r from-background to-muted/20 px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Primary Actions */}
            <div className="flex flex-1 gap-2">
              <Button 
                variant="default" 
                size="sm"
                onClick={handleEdit} 
                className="flex-1 sm:flex-initial font-medium shadow-sm hover:shadow-md transition-all"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleDownloadPDF} 
                className="flex-1 sm:flex-initial font-medium shadow-sm hover:shadow-md transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleSendToCustomer} 
                className="flex-1 sm:flex-initial font-medium shadow-sm hover:shadow-md transition-all"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
            
            {/* Separator for desktop */}
            <Separator orientation="vertical" className="hidden sm:block h-8" />
            
            {/* Destructive Action */}
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDelete} 
              className="font-medium shadow-sm hover:shadow-md transition-all"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
