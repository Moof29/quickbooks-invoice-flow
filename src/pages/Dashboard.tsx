import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  FileText,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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

const salesData = [
  { name: 'Jan', sales: 4000, revenue: 2400 },
  { name: 'Feb', sales: 3000, revenue: 1398 },
  { name: 'Mar', sales: 2000, revenue: 9800 },
  { name: 'Apr', sales: 2780, revenue: 3908 },
  { name: 'May', sales: 1890, revenue: 4800 },
  { name: 'Jun', sales: 2390, revenue: 3800 },
  { name: 'Jul', sales: 3490, revenue: 4300 },
];

const revenueData = [
  { month: 'Jan', revenue: 12400 },
  { month: 'Feb', revenue: 11398 },
  { month: 'Mar', revenue: 19800 },
  { month: 'Apr', revenue: 13908 },
  { month: 'May', revenue: 14800 },
  { month: 'Jun', revenue: 13800 },
];

const Dashboard = () => {
  const { user, profile, organization, loading: authLoading } = useAuthProfile();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalInvoices: 0,
    totalCustomers: 0,
    pendingInvoices: 0,
    monthlyGrowth: 12.5,
    salesCount: 0,
    returningRate: 85,
    avgOrderValue: 0,
    conversionRate: 3.2
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [invoicesResult, customersResult] = await Promise.all([
        supabase.from('invoice_record').select('total, status'),
        supabase.from('customer_profile').select('id'),
      ]);

      if (invoicesResult.data) {
        const totalRevenue = invoicesResult.data.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const pendingInvoices = invoicesResult.data.filter(inv => inv.status === 'pending').length;

        setStats({
          totalRevenue,
          totalInvoices: invoicesResult.data.length,
          totalCustomers: customersResult.data?.length || 0,
          pendingInvoices,
          monthlyGrowth: 12.5,
          salesCount: invoicesResult.data.filter(inv => inv.status === 'paid').length,
          returningRate: 85,
          avgOrderValue: totalRevenue / Math.max(invoicesResult.data.length, 1),
          conversionRate: 3.2
        });
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

  const StatCard = ({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    iconBg,
    iconColor
  }: {
    title: string;
    value: string;
    change: number;
    changeLabel: string;
    icon: any;
    iconBg: string;
    iconColor: string;
  }) => (
    <Card className="relative overflow-hidden border-border/40 hover:border-border/60 transition-all hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-full p-2 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center text-xs mt-1">
          {change >= 0 ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-600 mr-1" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
          )}
          <span className={change >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
            {Math.abs(change)}%
          </span>
          <span className="text-muted-foreground ml-1">{changeLabel}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {profile?.first_name || 'there'}! Here's what's happening with your business today.
            </p>
          </div>
          <Button>
            Download Report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          change={stats.monthlyGrowth}
          changeLabel="from last month"
          icon={DollarSign}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Sales Orders"
          value={stats.totalInvoices.toString()}
          change={8.2}
          changeLabel="from last month"
          icon={ShoppingCart}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Active Customers"
          value={stats.totalCustomers.toString()}
          change={5.4}
          changeLabel="from last month"
          icon={Users}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Avg Order Value"
          value={`$${stats.avgOrderValue.toFixed(2)}`}
          change={stats.conversionRate}
          changeLabel="from last month"
          icon={TrendingUp}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-600"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full lg:col-span-4 border-border/40">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>
              Your revenue performance over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-full lg:col-span-3 border-border/40">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest updates from your business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-500/10 p-2 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Order #1234 completed</p>
                  <p className="text-xs text-muted-foreground">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-500/10 p-2 mt-0.5">
                  <Package className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">New shipment created</p>
                  <p className="text-xs text-muted-foreground">15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-500/10 p-2 mt-0.5">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">3 new customers added</p>
                  <p className="text-xs text-muted-foreground">1 hour ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-orange-500/10 p-2 mt-0.5">
                  <FileText className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Invoice #5678 sent</p>
                  <p className="text-xs text-muted-foreground">3 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-500/10 p-2 mt-0.5">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Payment pending review</p>
                  <p className="text-xs text-muted-foreground">5 hours ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>Sales Performance</CardTitle>
            <CardDescription>
              Sales and revenue comparison
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem'
                  }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>
              Best performing products this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Product A', sales: 234, revenue: '$12,400', color: 'bg-emerald-500' },
                { name: 'Product B', sales: 189, revenue: '$9,800', color: 'bg-blue-500' },
                { name: 'Product C', sales: 156, revenue: '$8,200', color: 'bg-purple-500' },
                { name: 'Product D', sales: 134, revenue: '$7,100', color: 'bg-orange-500' },
                { name: 'Product E', sales: 98, revenue: '$5,400', color: 'bg-amber-500' },
              ].map((product, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg ${product.color}/10 flex items-center justify-center`}>
                    <Package className={`h-5 w-5 ${product.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sales} sales</p>
                  </div>
                  <div className="text-sm font-semibold">{product.revenue}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
