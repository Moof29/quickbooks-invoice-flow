import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { CustomerDialog } from '@/components/CustomerDialog';
import { DashboardCards, QuickStats } from '@/components/dashboard/DashboardCards';
import { SalesOverview, RevenueChart, CategoryBreakdown } from '@/components/dashboard/SalesChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { RecentOrders } from '@/components/dashboard/RecentOrders';

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
        {/* Dashboard Cards */}
        <DashboardCards />
        
        {/* Quick Stats */}
        <QuickStats />
        
        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SalesOverview />
          <RevenueChart />
          <CategoryBreakdown />
        </div>
        
        {/* Activity and Orders */}
        <div className="grid gap-4 md:grid-cols-4">
          <RecentActivity />
          <RecentOrders />
        </div>
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