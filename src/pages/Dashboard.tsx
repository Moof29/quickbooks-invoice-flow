
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
        description="Business overview and key metrics"
        showDateRange
        dateRangeText="Jul 9 - Aug 5, 2025"
      >
        <Button variant="outline" size="sm" className="btn-text-sm">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button onClick={() => setShowCustomerDialog(true)} variant="outline" size="sm" className="btn-text-sm">
          <Users className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
        <Button onClick={() => setShowInvoiceDialog(true)} size="sm" className="btn-text">
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </ModernPageHeader>

      <div className="page-content">
        {/* Enhanced KPI Cards Section */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Revenue Card with Modern Styling */}
          <Card className="card-kpi overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="icon-container success">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="kpi-label">Total Revenue</CardTitle>
                  </div>
                </div>
                <div className="kpi-change positive">
                  <TrendingUp className="h-3 w-3" />
                  <span>+{stats.monthlyGrowth}%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="kpi-value">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-description">
                vs ${(stats.totalRevenue * 0.88).toLocaleString()} last month
              </p>
              <div className="h-12 -mx-6 -mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData.slice(-4)}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--chart-1))" 
                      fillOpacity={1} 
                      fill="url(#revenueGradient)" 
                      strokeWidth={2} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders Card with Modern Styling */}
          <Card className="card-kpi">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="icon-container info">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <CardTitle className="kpi-label">Total Orders</CardTitle>
                </div>
                <div className="kpi-change positive">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>+18%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="kpi-value mb-2">{stats.totalInvoices}</div>
              <p className="text-sm text-muted-foreground mb-4">{stats.pendingInvoices} pending</p>
              <div className="flex items-center gap-3">
                <Progress value={(stats.salesCount / stats.totalInvoices) * 100} className="flex-1 h-2" />
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round((stats.salesCount / stats.totalInvoices) * 100)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Customers Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/20">
                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
                </div>
                <div className="flex items-center text-sm text-green-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+12%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{stats.totalCustomers}</div>
              <p className="text-sm text-muted-foreground">Active customers</p>
              <div className="mt-4 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={customerActivityData}>
                    <Bar dataKey="new" fill="hsl(var(--primary))" radius={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Average Order Value */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900/20">
                    <Target className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order</CardTitle>
                </div>
                <div className="flex items-center text-sm text-green-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+{stats.conversionRate}%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">${Math.round(stats.avgOrderValue).toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Per transaction</p>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((stats.avgOrderValue / 10000) * 100, 100)}%` }}></div>
                </div>
                <span className="text-xs text-muted-foreground">Target: $10K</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Charts Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Trend Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revenue vs Target</CardTitle>
                  <CardDescription>Monthly performance comparison</CardDescription>
                </div>
                <Badge variant="secondary">Last 6 months</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `$${value/1000}K`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 6 }}
                      activeDot={{ r: 8, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="target" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sales Channel Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Channels</CardTitle>
              <CardDescription>Revenue distribution by source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesChannelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {salesChannelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {salesChannelData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Activity & Quick Actions */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Customer Activity */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Customer Activity</CardTitle>
              <CardDescription>Daily active users and new signups</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={customerActivityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="day" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="active" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="Active Users"
                    />
                    <Bar 
                      dataKey="new" 
                      fill="hsl(var(--secondary))" 
                      radius={[4, 4, 0, 0]}
                      name="New Users"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common business tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start h-12" 
                onClick={() => setShowInvoiceDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Create Invoice</div>
                    <div className="text-xs text-muted-foreground">Bill a customer</div>
                  </div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12" 
                onClick={() => setShowCustomerDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/20">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Add Customer</div>
                    <div className="text-xs text-muted-foreground">New client profile</div>
                  </div>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start h-12">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/20">
                    <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Monitor Performance</div>
                    <div className="text-xs text-muted-foreground">Real-time metrics</div>
                  </div>
                </div>
              </Button>
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
