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

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total: number;
  amount_paid: number;
  amount_due: number;
}

export default function PortalInvoices() {
  const { customerProfile, loading: authLoading, signOut } = usePortalAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerProfile && !authLoading) {
      const impersonationToken = sessionStorage.getItem('portal_impersonation_token');
      if (!impersonationToken) {
        navigate('/portal/login');
      }
    }
  }, [authLoading, customerProfile, navigate]);

  useEffect(() => {
    if (customerProfile) {
      fetchInvoices();
    } else {
      setLoading(false);
    }
  }, [customerProfile]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_record')
        .select('id, invoice_number, invoice_date, due_date, status, total, amount_paid, amount_due')
        .eq('customer_id', customerProfile!.id)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string, amountDue: number) => {
    if (amountDue === 0) return "default";
    if (status === "partial") return "secondary";
    if (status === "overdue") return "destructive";
    return "outline";
  };

  const handleSignOut = async () => {
    const impersonationToken = sessionStorage.getItem('portal_impersonation_token');
    
    if (impersonationToken) {
      sessionStorage.removeItem('portal_impersonation_token');
      window.close();
    } else {
      await signOut();
      navigate('/portal/login');
    }
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
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/portal/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h2 className="text-3xl font-bold tracking-tight mt-4">Your Invoices</h2>
            <p className="text-muted-foreground">View and track your invoices</p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No invoices found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{invoice.invoice_number}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Invoice Date: {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(invoice.status, invoice.amount_due)}>
                      {invoice.amount_due === 0 ? 'Paid' : invoice.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Due Date</div>
                      <div className="text-muted-foreground">
                        {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Total</div>
                      <div className="text-muted-foreground">
                        ${invoice.total.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Amount Paid</div>
                      <div className="text-muted-foreground">
                        ${invoice.amount_paid.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Amount Due</div>
                      <div className={invoice.amount_due > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                        ${invoice.amount_due.toFixed(2)}
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
