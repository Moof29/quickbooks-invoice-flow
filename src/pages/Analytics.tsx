import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart, ResponsiveContainer, BarChart, Bar } from "recharts";
import { DollarSign, FileText, Users, ShoppingCart, TrendingUp } from "lucide-react";

// Types derived from Supabase generated types (kept loose for safety)
interface InvoiceRow { total: number | null; invoice_date: string | null; created_at: string | null; status: string | null }
interface SalesOrderRow { id: string; status: string | null; order_date: string | null }

function useAnalytics() {
  const invoicesQ = useQuery({
    queryKey: ["analytics", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_record")
        .select("total, status, invoice_date, created_at")
        .order("invoice_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as InvoiceRow[];
    },
  });

  const salesOrdersQ = useQuery({
    queryKey: ["analytics", "sales_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_order")
        .select("id, status, order_date")
        .order("order_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as SalesOrderRow[];
    },
  });

  const customersQ = useQuery({
    queryKey: ["analytics", "customers_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customer_profile")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const computed = useMemo(() => {
    const invoices = invoicesQ.data || [];
    const salesOrders = salesOrdersQ.data || [];

    // Totals
    const totalRevenue = invoices.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalInvoices = invoices.length;
    const totalCustomers = customersQ.data || 0;
    const totalSalesOrders = salesOrders.length;

    // Group revenue by YYYY-MM
    const monthKey = (d: string | null) => {
      const date = d ? new Date(d) : null;
      const iso = (date || new Date()).toISOString().slice(0, 7); // YYYY-MM
      return iso;
    };

    const revenueByMonthMap = new Map<string, number>();
    invoices.forEach((inv) => {
      const key = monthKey(inv.invoice_date || inv.created_at);
      revenueByMonthMap.set(key, (revenueByMonthMap.get(key) || 0) + (inv.total || 0));
    });

    // Last 6 months keys
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }

    const revenueSeries = months.map((m) => ({
      month: m,
      revenue: Math.round((revenueByMonthMap.get(m) || 0) * 100) / 100,
    }));

    // Orders vs Invoices per month (counts)
    const soByMonth = new Map<string, number>();
    salesOrders.forEach((so) => {
      const key = monthKey(so.order_date);
      soByMonth.set(key, (soByMonth.get(key) || 0) + 1);
    });

    const countsSeries = months.map((m) => ({
      month: m,
      invoices: invoices.filter((inv) => monthKey(inv.invoice_date || inv.created_at) === m).length,
      orders: soByMonth.get(m) || 0,
    }));

    return {
      totalRevenue,
      totalInvoices,
      totalCustomers,
      totalSalesOrders,
      revenueSeries,
      countsSeries,
    };
  }, [invoicesQ.data, salesOrdersQ.data, customersQ.data]);

  return { ...computed, invoicesQ, salesOrdersQ, customersQ };
}

export default function Analytics() {
  // SEO
  useEffect(() => {
    document.title = "Analytics Dashboard | Batchly";
    const desc = "Analytics Dashboard for sales orders, invoices, customers, and revenue charts";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    // canonical
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", window.location.href);
  }, []);

  const { totalRevenue, totalInvoices, totalCustomers, totalSalesOrders, revenueSeries, countsSeries, invoicesQ, salesOrdersQ } = useAnalytics();

  const loading = invoicesQ.isLoading || salesOrdersQ.isLoading;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Visualize sales orders, invoices, customers, and revenue</p>
      </header>

      <main className="space-y-6">
        {/* Metric Cards */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10 text-primary"><DollarSign className="h-4 w-4" /></div>
                <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalRevenue.toLocaleString()}</div>
              <CardDescription>Sum of invoice totals</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div>
                <CardTitle className="text-sm text-muted-foreground">Invoices</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalInvoices}</div>
              <CardDescription>Total invoices</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10 text-primary"><Users className="h-4 w-4" /></div>
                <CardTitle className="text-sm text-muted-foreground">Customers</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCustomers}</div>
              <CardDescription>Customer profiles</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10 text-primary"><ShoppingCart className="h-4 w-4" /></div>
                <CardTitle className="text-sm text-muted-foreground">Sales Orders</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalSalesOrders}</div>
              <CardDescription>Total sales orders</CardDescription>
            </CardContent>
          </Card>
        </section>

        {/* Revenue Chart */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revenue Trends</CardTitle>
                  <CardDescription>Last 6 months</CardDescription>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(var(--primary))" } }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${Math.round(v/1000)}k`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Orders vs Invoices */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Orders vs Invoices</CardTitle>
              <CardDescription>Monthly document volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ChartContainer
                  config={{
                    invoices: { label: "Invoices", color: "hsl(var(--primary))" },
                    orders: { label: "Orders", color: "hsl(var(--accent))" },
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countsSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="orders" fill="hsl(var(--accent))" radius={4} />
                      <Bar dataKey="invoices" fill="hsl(var(--primary))" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
