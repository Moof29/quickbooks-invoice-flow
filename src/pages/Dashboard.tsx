import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { DollarSign, ShoppingCart, Users, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface DashboardStats {
  totalRevenue: number;
  totalInvoices: number;
  totalCustomers: number;
  avgOrderValue: number;
}

interface ChartData {
  month: string;
  revenue: number;
  orders: number;
}

const Dashboard = () => {
  const { user, profile, organization, loading: authLoading } = useAuthProfile();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalInvoices: 0,
    totalCustomers: 0,
    avgOrderValue: 0,
  });
  const [revenueData, setRevenueData] = useState<ChartData[]>([]);
  const [salesData, setSalesData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [invoicesResult, customersResult, invoicesWithDatesResult] = await Promise.all([
        supabase.from('invoice_record').select('total, status'),
        supabase.from('customer_profile').select('id'),
        supabase.from('invoice_record').select('total, invoice_date, created_at'),
      ]);

      // Calculate basic stats
      if (invoicesResult.data) {
        const totalRevenue = invoicesResult.data.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const totalInvoices = invoicesResult.data.length;

        setStats({
          totalRevenue,
          totalInvoices,
          totalCustomers: customersResult.data?.length || 0,
          avgOrderValue: totalRevenue / Math.max(totalInvoices, 1),
        });
      }

      // Calculate chart data for last 6 months
      if (invoicesWithDatesResult.data) {
        const monthlyData: { [key: string]: { revenue: number; orders: number } } = {};
        
        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const monthKey = format(date, 'MMM');
          monthlyData[monthKey] = { revenue: 0, orders: 0 };
        }

        // Aggregate invoice data by month
        invoicesWithDatesResult.data.forEach(invoice => {
          const date = invoice.invoice_date ? new Date(invoice.invoice_date) : new Date(invoice.created_at);
          const monthKey = format(date, 'MMM');
          
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].revenue += invoice.total || 0;
            monthlyData[monthKey].orders += 1;
          }
        });

        // Convert to chart format
        const chartData: ChartData[] = Object.entries(monthlyData).map(([month, data]) => ({
          month,
          revenue: Math.round(data.revenue),
          orders: data.orders,
        }));

        setRevenueData(chartData);
        setSalesData(chartData);
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
    icon: Icon,
    iconBg,
    iconColor
  }: {
    title: string;
    value: string;
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
        <p className="text-xs text-muted-foreground mt-1">Current total</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Welcome back, {profile?.first_name || 'there'}! Here's your business overview.
            </p>
          </div>
        </div>
      </div>

      {/* Responsive grid: 1 col mobile, 2 cols tablet, 4 cols desktop */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices.toString()}
          icon={ShoppingCart}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers.toString()}
          icon={Users}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Avg Order Value"
          value={`$${stats.avgOrderValue.toFixed(2)}`}
          icon={TrendingUp}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-600"
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>
              Monthly revenue for the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {revenueData.length > 0 ? (
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
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>Sales Performance</CardTitle>
            <CardDescription>
              Order volume for the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            {salesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
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
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No sales data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
