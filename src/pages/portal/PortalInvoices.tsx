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
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="h-8 w-8 md:h-10 md:w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-bold truncate">{customerProfile?.company_name || 'Demo Customer'}</h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden md:block">Customer Portal</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="shrink-0">
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-4 md:space-y-8 pb-20 md:pb-8">
        <div className="space-y-3 md:space-y-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/dashboard')} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="mt-2 md:mt-4">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your Invoices</h2>
            <p className="text-sm md:text-base text-muted-foreground">View and track your invoices</p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 md:p-12 text-center">
              <p className="text-muted-foreground">No invoices found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base md:text-lg truncate">{invoice.invoice_number}</CardTitle>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge 
                      variant={getStatusVariant(invoice.status, invoice.amount_due)}
                      className="shrink-0"
                    >
                      {invoice.amount_due === 0 ? 'Paid' : invoice.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
                    <div>
                      <div className="font-medium text-xs text-muted-foreground mb-1">Due Date</div>
                      <div className="text-sm font-medium">
                        {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-xs text-muted-foreground mb-1">Total</div>
                      <div className="text-sm font-medium">
                        ${invoice.total.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-xs text-muted-foreground mb-1">Paid</div>
                      <div className="text-sm font-medium">
                        ${invoice.amount_paid.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-xs text-muted-foreground mb-1">Due</div>
                      <div className={`text-sm font-semibold ${invoice.amount_due > 0 ? "text-destructive" : ""}`}>
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
