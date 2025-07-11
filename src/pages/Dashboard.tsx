
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  FileText, 
  Users, 
  TrendingUp,
  Plus,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { CustomerDialog } from '@/components/CustomerDialog';

interface DashboardStats {
  totalRevenue: number;
  totalInvoices: number;
  totalCustomers: number;
  pendingInvoices: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  status: string;
  customer_profile?: {
    display_name: string;
  };
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalInvoices: 0,
    totalCustomers: 0,
    pendingInvoices: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load dashboard statistics
      const [invoicesResult, customersResult, recentInvoicesResult] = await Promise.all([
        supabase.from('invoice_record').select('total, status'),
        supabase.from('customer_profile').select('id'),
        supabase
          .from('invoice_record')
          .select(`
            id, 
            invoice_number, 
            invoice_date, 
            due_date, 
            total, 
            status,
            customer_profile:customer_id (
              display_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (invoicesResult.data) {
        const totalRevenue = invoicesResult.data.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const pendingInvoices = invoicesResult.data.filter(inv => inv.status === 'pending').length;
        
        setStats({
          totalRevenue,
          totalInvoices: invoicesResult.data.length,
          totalCustomers: customersResult.data?.length || 0,
          pendingInvoices
        });
      }

      if (recentInvoicesResult.data) {
        setRecentInvoices(recentInvoicesResult.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your business.</p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={() => setShowCustomerDialog(true)} variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
              <Button onClick={() => setShowInvoiceDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
              <p className="text-xs text-muted-foreground">
                +3 new this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">
                +2 new this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting payment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>
              Your latest invoice activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No invoices yet. Create your first invoice to get started!</p>
                  <Button onClick={() => setShowInvoiceDialog(true)} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Invoice
                  </Button>
                </div>
              ) : (
                recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-gray-600">
                          {invoice.customer_profile?.display_name || 'Unknown Customer'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium">${invoice.total?.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">
                          Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status || 'draft'}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <InvoiceDialog 
        open={showInvoiceDialog} 
        onOpenChange={setShowInvoiceDialog}
        onSuccess={loadDashboardData}
      />
      <CustomerDialog 
        open={showCustomerDialog} 
        onOpenChange={setShowCustomerDialog}
        onSuccess={loadDashboardData}
      />
    </div>
  );
};

export default Dashboard;
