
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  Send
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { ModernPageHeader } from '@/components/ModernPageHeader';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  status: string;
  customer_profile?: {
    display_name: string;
    email: string;
  };
}

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInvoices();
  }, [searchTerm]);

  const loadInvoices = async () => {
    try {
      let query = supabase
        .from('invoice_record')
        .select(`
          id, 
          invoice_number, 
          invoice_date, 
          due_date, 
          total, 
          status,
          customer_profile:customer_id (
            display_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`invoice_number.ilike.%${searchTerm}%,customer_profile.display_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

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

      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ModernPageHeader
        title="Invoices"
        description="Manage and track all your invoices"
        showSearch
        searchPlaceholder="Search invoices by number or customer..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      >
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button onClick={() => setShowInvoiceDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </ModernPageHeader>

      <div className="page-content">
        {/* Invoices List */}
        <Card className="card-data-table">
          <CardHeader className="table-header-enhanced">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">All Invoices</CardTitle>
                <CardDescription className="text-sm text-muted-foreground mt-1">
                  {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-medium">
                {invoices.length} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                    <svg className="h-8 w-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No invoices found</h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                  {searchTerm ? 'Try adjusting your search criteria to find what you\'re looking for' : 'Get started by creating your first invoice to track payments'}
                </p>
                <Button onClick={() => setShowInvoiceDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice #</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Due Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-blue-600">
                            {invoice.invoice_number}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {invoice.customer_profile?.display_name || 'Unknown Customer'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {invoice.customer_profile?.email || ''}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-900">
                          {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-gray-900">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">
                            ${invoice.total?.toLocaleString() || '0.00'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status || 'draft'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end space-x-1">
                            <Button variant="ghost" size="sm" title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Send">
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Delete"
                              onClick={() => handleDeleteInvoice(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <InvoiceDialog 
        open={showInvoiceDialog} 
        onOpenChange={setShowInvoiceDialog}
        onSuccess={loadInvoices}
      />
    </div>
  );
};

export default Invoices;
