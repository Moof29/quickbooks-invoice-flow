
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
  Download,
  Activity,
  CreditCard,
  Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { CustomerDialog } from '@/components/CustomerDialog';
import { ModernPageHeader } from '@/components/ModernPageHeader';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  totalRevenue: number;
  totalInvoices: number;
  totalCustomers: number;
  pendingInvoices: number;
  monthlyGrowth: number;
  salesCount: number;
  returningRate: number;
  avgOrderValue: number;
  conversionRate: number;
}

// Sample data for charts
const revenueData = [
  { month: 'Jan', revenue: 45000, target: 40000 },
  { month: 'Feb', revenue: 52000, target: 45000 },
  { month: 'Mar', revenue: 48000, target: 50000 },
  { month: 'Apr', revenue: 61000, target: 55000 },
  { month: 'May', revenue: 55000, target: 58000 },
  { month: 'Jun', revenue: 67000, target: 62000 },
];

const salesChannelData = [
  { name: 'Direct Sales', value: 45, color: 'hsl(var(--primary))' },
  { name: 'Online Store', value: 30, color: 'hsl(var(--secondary))' },
  { name: 'Partners', value: 15, color: 'hsl(var(--accent))' },
  { name: 'Referrals', value: 10, color: 'hsl(var(--muted))' },
];

const customerActivityData = [
  { day: 'Mon', active: 120, new: 12 },
  { day: 'Tue', active: 132, new: 8 },
  { day: 'Wed', active: 145, new: 15 },
  { day: 'Thu', active: 138, new: 18 },
  { day: 'Fri', active: 156, new: 22 },
  { day: 'Sat', active: 89, new: 5 },
  { day: 'Sun', active: 78, new: 3 },
];

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
    returningRate: 85,
    avgOrderValue: 0,
    conversionRate: 3.2
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
          returningRate: 85,
          avgOrderValue: totalRevenue / Math.max(invoicesResult.data.length, 1),
          conversionRate: 3.2
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
    <div className="page-container">
      <ModernPageHeader
        title="Dashboard"
        description="Overview of your business performance"
      />

      <div className="page-content content-section-loose">
        {/* KPI Cards */}
        <div className="dashboard-kpi-grid">
          <Card className="card-kpi">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                  <p className="text-3xl font-bold text-foreground mt-2">${stats.totalRevenue.toLocaleString()}</p>
                  <div className="flex items-center mt-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-green-600 font-medium">+{stats.monthlyGrowth}%</span>
                    <span className="text-muted-foreground ml-1">from last month</span>
                  </div>
                </div>
                <div className="h-12 w-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-kpi">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Sales Orders</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.totalInvoices}</p>
                  <div className="flex items-center mt-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-blue-500 mr-1" />
                    <span className="text-blue-600 font-medium">+8.2%</span>
                    <span className="text-muted-foreground ml-1">from last month</span>
                  </div>
                </div>
                <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-kpi">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Customers</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.totalCustomers}</p>
                  <div className="flex items-center mt-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-purple-500 mr-1" />
                    <span className="text-purple-600 font-medium">+23.1%</span>
                    <span className="text-muted-foreground ml-1">from last month</span>
                  </div>
                </div>
                <div className="h-12 w-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-kpi">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Avg Order Value</p>
                  <p className="text-3xl font-bold text-foreground mt-2">${Math.round(stats.avgOrderValue)}</p>
                  <div className="flex items-center mt-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-orange-500 mr-1" />
                    <span className="text-orange-600 font-medium">+{stats.conversionRate}%</span>
                    <span className="text-muted-foreground ml-1">from last month</span>
                  </div>
                </div>
                <div className="h-12 w-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="card-stats">
          <CardHeader className="table-header-enhanced">
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Latest updates and transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{invoice.customer_profile?.display_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${invoice.total?.toLocaleString()}</p>
                      <Badge variant="outline" className="text-xs">{invoice.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
