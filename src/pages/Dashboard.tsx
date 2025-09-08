
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DollarSign, 
  FileText, 
  Users, 
  TrendingUp,
  Eye,
  Edit,
  ShoppingCart,
  Target,
  MoreHorizontal
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthProfile } from '@/hooks/useAuthProfile';
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
  const { user, profile, organization, loading: authLoading } = useAuthProfile();
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

  if (loading || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-8 pb-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Overview of your business performance
          </p>
        </div>
        
        {/* User Profile Section */}
        {user && (
          <div className="bg-muted/5 rounded-lg p-4 flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {profile?.first_name?.[0]}{profile?.last_name?.[0] || user.email?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate" title={user.email}>
                {user.email}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{profile?.role || 'User'}</span>
                {organization?.name && (
                  <>
                    <span>•</span>
                    <span className="truncate">{organization.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Page content */}
      <div className="space-y-8">
        {/* KPI Cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold tracking-tight">${stats.totalRevenue.toLocaleString()}</p>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">+{stats.monthlyGrowth}%</span>
                      <span className="text-muted-foreground">from last month</span>
                    </div>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Sales Orders</p>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold tracking-tight">{stats.totalInvoices}</p>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-600 font-medium">+8.2%</span>
                      <span className="text-muted-foreground">from last month</span>
                    </div>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Customers</p>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold tracking-tight">{stats.totalCustomers}</p>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <span className="text-purple-600 font-medium">+23.1%</span>
                      <span className="text-muted-foreground">from last month</span>
                    </div>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Avg Order Value</p>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold tracking-tight">${Math.round(stats.avgOrderValue)}</p>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-600 font-medium">+{stats.conversionRate}%</span>
                      <span className="text-muted-foreground">from last month</span>
                    </div>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  <Target className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Recent Activity</CardTitle>
                <CardDescription className="mt-1">
                  Latest updates and transactions
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">No recent activity</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Your recent invoices will appear here</p>
                </div>
              ) : (
                recentInvoices.map((invoice) => (
                  <div 
                    key={invoice.id} 
                    className="group flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-border hover:shadow-sm transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{invoice.invoice_number}</p>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs px-2 py-0.5 ${getStatusColor(invoice.status)}`}
                          >
                            {invoice.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {invoice.customer_profile?.display_name || 'Unknown Customer'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">${invoice.total?.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
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
