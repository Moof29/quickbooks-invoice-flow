import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, LogOut, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date: string;
  status: string;
  total: number;
}

export default function PortalOrders() {
  const { customerProfile, loading: authLoading, signOut } = usePortalAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !customerProfile) {
      navigate('/portal/login');
    }
  }, [authLoading, customerProfile, navigate]);

  useEffect(() => {
    if (customerProfile) {
      fetchOrders();
    }
  }, [customerProfile]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_order')
        .select('id, order_number, order_date, delivery_date, status, total')
        .eq('customer_id', customerProfile!.id)
        .order('order_date', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      reviewed: "default",
      template_generated: "outline",
    };
    return variants[status] || "default";
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/portal/login');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-muted/40 p-8">
        <Skeleton className="h-12 w-64" />
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
              <h1 className="text-xl font-bold">{customerProfile?.company_name}</h1>
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
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/portal/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h2 className="text-3xl font-bold tracking-tight mt-4">Your Orders</h2>
            <p className="text-muted-foreground">View all your sales orders</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No orders found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{order.order_number}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Order Date: {format(new Date(order.order_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Delivery Date</div>
                      <div className="text-muted-foreground">
                        {format(new Date(order.delivery_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Total</div>
                      <div className="text-muted-foreground">
                        ${order.total.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Status</div>
                      <div className="text-muted-foreground capitalize">
                        {order.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
