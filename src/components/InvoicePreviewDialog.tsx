import { useState, useEffect } from 'react';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Download, Trash2, FileText, X, ZoomIn, ZoomOut } from 'lucide-react';

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
  const [zoom, setZoom] = useState(100);
  const { toast } = useToast();

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

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
    if (!pdfUrl) {
      toast({
        title: "Error",
        description: "PDF not ready for download",
        variant: "destructive",
      });
      return;
    }
    
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Invoice-${invoice?.invoice_number || 'draft'}.pdf`;
    link.click();
    
    toast({
      title: "Success",
      description: "Invoice PDF downloaded",
    });
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const handleDelete = async () => {
    if (!invoiceId) return;

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
      setDeleteDialogOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
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
        
        {/* Native PDF Viewer with zoom controls */}
        <div className="flex-1 min-h-0 overflow-hidden bg-muted/30 p-2 relative">
          {/* Zoom Controls */}
          {pdfUrl && (
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 bg-background border rounded-lg shadow-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="h-8 w-8"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetZoom}
                className="h-8 w-8 text-xs font-semibold"
                title="Reset Zoom"
              >
                {zoom}%
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="h-8 w-8"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="h-full rounded-lg shadow-xl bg-background border overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading invoice...</p>
              </div>
            ) : pdfUrl ? (
              <div 
                className="h-full w-full flex items-start justify-center p-4"
                style={{ 
                  transformOrigin: 'top center',
                  minHeight: '100%'
                }}
              >
                <iframe
                  src={`${pdfUrl}#view=FitH`}
                  className="border-0 shadow-lg"
                  title="Invoice PDF"
                  style={{ 
                    touchAction: 'manipulation',
                    backgroundColor: '#525659',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    width: `${100 / (zoom / 100)}%`,
                    height: `${100 / (zoom / 100)}%`,
                    transition: 'transform 0.2s ease-in-out'
                  }}
                />
              </div>
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
            </div>
            
            {/* Separator for desktop */}
            <Separator orientation="vertical" className="hidden sm:block h-8" />
            
            {/* Destructive Action */}
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setDeleteDialogOpen(true)} 
              className="font-medium shadow-sm hover:shadow-md transition-all"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
