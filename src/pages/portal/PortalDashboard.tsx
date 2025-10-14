import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, FileText, ShoppingCart, LogOut, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PortalDashboard() {
  const { customerProfile, loading: authLoading, signOut } = usePortalAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalInvoices: 0,
    unpaidInvoices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerProfile && !authLoading) {
      // Check if we're in impersonation mode
      const impersonationData = sessionStorage.getItem('portal_impersonation');
      if (!impersonationData) {
        navigate('/portal/login');
      }
    }
  }, [authLoading, customerProfile, navigate]);

  useEffect(() => {
    if (customerProfile) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [customerProfile]);

  const fetchStats = async () => {
    try {
      const [ordersRes, invoicesRes] = await Promise.all([
        supabase
          .from('sales_order')
          .select('id, status', { count: 'exact' })
          .eq('customer_id', customerProfile!.id),
        supabase
          .from('invoice_record')
          .select('id, status, amount_due', { count: 'exact' })
          .eq('customer_id', customerProfile!.id),
      ]);

      const totalOrders = ordersRes.count || 0;
      const pendingOrders = ordersRes.data?.filter(o => o.status === 'pending').length || 0;
      const totalInvoices = invoicesRes.count || 0;
      const unpaidInvoices = invoicesRes.data?.filter(i => i.amount_due && i.amount_due > 0).length || 0;

      setStats({
        totalOrders,
        pendingOrders,
        totalInvoices,
        unpaidInvoices,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const impersonationData = sessionStorage.getItem('portal_impersonation');
    
    if (impersonationData) {
      // Clear impersonation and close tab
      sessionStorage.removeItem('portal_impersonation');
      window.close();
    } else {
      // Normal sign out
      await signOut();
      navigate('/portal/login');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-muted/40 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{customerProfile?.company_name || 'Demo Customer'}</h1>
              <p className="text-sm text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back, {customerProfile?.display_name || 'Demo User'}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.pendingOrders} pending
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.unpaidInvoices} unpaid
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unpaidInvoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires payment
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Access your orders and invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/portal/orders')}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Orders
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/portal/invoices')}>
                <FileText className="h-4 w-4 mr-2" />
                View Invoices
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/portal/templates')}>
                <Package className="h-4 w-4 mr-2" />
                Manage Templates
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm font-medium">Email</div>
                <div className="text-sm text-muted-foreground">{customerProfile?.email || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Phone</div>
                <div className="text-sm text-muted-foreground">{customerProfile?.phone || 'Not provided'}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
