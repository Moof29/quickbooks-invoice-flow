
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  FileText, 
  Users, 
  TrendingUp,
  Plus,
  Eye,
  Edit,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Calendar,
  Clock,
  Download
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
  monthlyGrowth: number;
  salesCount: number;
  returningRate: number;
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
    pendingInvoices: 0,
    monthlyGrowth: 12,
    salesCount: 0,
    returningRate: 85
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
          pendingInvoices,
          monthlyGrowth: 12,
          salesCount: invoicesResult.data.filter(inv => inv.status === 'paid').length,
          returningRate: 85
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Business Dashboard</h1>
            <Badge variant="secondary" className="text-xs">
              09 Jul 2025 - 05 Aug 2025
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button onClick={() => setShowCustomerDialog(true)} variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
            <Button onClick={() => setShowInvoiceDialog(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Hero Stats Section */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Congratulations Card */}
          <Card className="md:col-span-2 lg:col-span-1 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl">🎉</div>
                <div>
                  <CardTitle className="text-lg">Congratulations!</CardTitle>
                  <p className="text-sm text-muted-foreground">Best seller of the month</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mb-3">+{stats.monthlyGrowth}% from last month</p>
              <Button variant="outline" size="sm" className="h-8">
                View Sales
              </Button>
            </CardContent>
          </Card>

          {/* Revenue Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                <div className="flex items-center text-sm text-green-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+{stats.monthlyGrowth}%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
              <div className="h-8 flex items-end space-x-1 mt-2">
                {[4, 8, 6, 10, 7, 12, 9, 15, 11, 8, 14, 16].map((height, i) => (
                  <div
                    key={i}
                    className="bg-primary/20 rounded-sm flex-1"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sales Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sales</CardTitle>
                <div className="flex items-center text-sm text-red-600">
                  <ArrowDownRight className="h-4 w-4" />
                  <span>-17%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.salesCount}K</div>
              <div className="h-8 flex items-end space-x-1 mt-2">
                {[12, 8, 6, 14, 7, 4, 9, 6, 11, 8, 5, 3].map((height, i) => (
                  <div
                    key={i}
                    className="bg-muted rounded-sm flex-1"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* New Customers Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">New Customers</CardTitle>
                <div className="flex items-center text-sm text-green-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+36.5%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
              <div className="h-8 flex items-end space-x-1 mt-2">
                {[6, 10, 8, 12, 14, 16, 11, 18, 15, 12, 20, 22].map((height, i) => (
                  <div
                    key={i}
                    className="bg-green-200 rounded-sm flex-1"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Total Revenue Detailed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <p className="text-xs text-muted-foreground">Income in the last 28 days</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Desktop</span>
                  <span className="font-medium">24,828</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Mobile</span>
                  <span className="font-medium">25,010</span>
                </div>
              </div>
              <div className="mt-4 h-32 bg-gradient-to-t from-primary/20 to-primary/5 rounded-md flex items-end p-2">
                <div className="w-full grid grid-cols-6 gap-1 h-full items-end">
                  {[40, 60, 45, 80, 55, 95].map((height, i) => (
                    <div
                      key={i}
                      className="bg-primary rounded-sm"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Returning Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Returning Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">${(stats.totalRevenue * 0.42).toLocaleString()}</div>
              <div className="flex items-center text-sm text-green-600 mb-4">
                <span>+2.5%</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-sm">February</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-muted"></div>
                  <span className="text-sm">March</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-primary/60"></div>
                  <span className="text-sm">April</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Card */}
          <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                <Button variant="ghost" size="sm">
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={() => setShowInvoiceDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => setShowCustomerDialog(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  View Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Invoice Activity</CardTitle>
                <CardDescription>
                  Your latest business transactions and payments
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                View All →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first invoice to get started with your business!</p>
                  <Button onClick={() => setShowInvoiceDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Invoice
                  </Button>
                </div>
              ) : (
                recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.customer_profile?.display_name || 'Unknown Customer'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">${invoice.total?.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'pending' ? 'secondary' : 'outline'}>
                        {invoice.status || 'draft'}
                      </Badge>
                      <div className="flex gap-1">
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
