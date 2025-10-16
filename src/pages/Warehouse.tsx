import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Plus, Search, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { InvoicePreviewDialog } from '@/components/InvoicePreviewDialog';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  status: string;
  customer_profile?: {
    display_name: string;
    company_name: string;
  };
}

export default function Warehouse() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInvoicesForDate();
  }, [selectedDate]);

  const loadInvoicesForDate = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('invoice_record')
        .select(`
          id, 
          invoice_number, 
          invoice_date,
          total,
          status,
          customer_profile:customer_id (
            display_name,
            company_name
          )
        `)
        .eq('invoice_date', dateStr)
        .order('invoice_number', { ascending: true });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAll = () => {
    toast({
      title: "Printing",
      description: `Printing ${invoices.length} pick lists...`,
    });
    // Print functionality would be implemented here
  };

  const handlePrintInvoice = (invoiceId: string) => {
    toast({
      title: "Printing",
      description: "Opening pick list for printing...",
    });
    // Individual print functionality
  };

  const handleViewInvoice = (invoiceId: string) => {
    setPreviewInvoiceId(invoiceId);
    setShowPreviewDialog(true);
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'default';
      case 'sent':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warehouse Pick Lists</h1>
          <p className="text-muted-foreground mt-1">
            View and print pick lists for {format(selectedDate, 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="lg">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(selectedDate, 'MMM dd, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={() => setShowInvoiceDialog(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pick Lists</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-xs text-muted-foreground">
              For {format(selectedDate, 'MMMM d')}
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <span className="text-lg">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${invoices.reduce((sum, inv) => sum + (inv.total || 0), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Combined order value
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handlePrintAll} 
              className="w-full"
              disabled={invoices.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print All
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pick Lists Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Pick Lists for {format(selectedDate, 'MMMM d, yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading pick lists...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pick Lists Found</h3>
              <p className="text-muted-foreground mb-4">
                No invoices scheduled for {format(selectedDate, 'MMMM d, yyyy')}
              </p>
              <Button onClick={() => setShowInvoiceDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <Card 
                  key={invoice.id}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card"
                  onClick={() => handleViewInvoice(invoice.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">
                            {invoice.customer_profile?.company_name || 
                             invoice.customer_profile?.display_name || 
                             'Unknown Customer'}
                          </h3>
                          <Badge variant={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-mono">{invoice.invoice_number}</span>
                          <span>•</span>
                          <span className="font-semibold text-foreground">
                            ${(invoice.total || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintInvoice(invoice.id);
                          }}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Print
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InvoiceDialog 
        open={showInvoiceDialog} 
        onOpenChange={setShowInvoiceDialog}
        onSuccess={() => {
          loadInvoicesForDate();
          setShowInvoiceDialog(false);
        }}
      />

      {previewInvoiceId && (
        <InvoicePreviewDialog
          invoiceId={previewInvoiceId}
          open={showPreviewDialog}
          onOpenChange={setShowPreviewDialog}
        />
      )}
    </div>
  );
}
