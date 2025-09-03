import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { SalesOrdersList } from "@/components/SalesOrdersList";
import { ModernPageHeader } from "@/components/ModernPageHeader";
import { Button } from "@/components/ui/button";
import { GenerateTestDataButton } from "@/components/GenerateTestDataButton";
import { CreateSalesOrderDialog } from "@/components/CreateSalesOrderDialog";
import { FileText, BarChart, CheckCircle, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Sample data for charts - in production, this would come from your API
const salesOverTimeData = [
  { name: 'Jan', orders: 15 },
  { name: 'Feb', orders: 25 },
  { name: 'Mar', orders: 32 },
  { name: 'Apr', orders: 40 },
  { name: 'May', orders: 55 },
  { name: 'Jun', orders: 48 },
  { name: 'Jul', orders: 65 },
  { name: 'Aug', orders: 70 },
];

const regionData = [
  { name: 'North America', value: 400 },
  { name: 'Europe', value: 300 },
  { name: 'Asia', value: 300 },
  { name: 'South America', value: 200 },
];

const PIE_CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function SalesOrders() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch sales order metrics
  const { data: metrics } = useQuery({
    queryKey: ['sales-order-metrics'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('sales_order')
        .select('total, order_date, status, created_at');

      if (error) throw error;

      const totalOrders = orders?.length || 0;
      const today = new Date().toDateString();
      const salesToday = orders
        ?.filter(order => new Date(order.created_at).toDateString() === today)
        ?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

      const pendingCount = orders?.filter(order => order.status === 'pending_approval').length || 0;
      const approvedCount = orders?.filter(order => order.status === 'approved').length || 0;

      return {
        totalOrders,
        salesToday,
        pendingCount,
        approvedCount,
      };
    },
  });

  const metricsData = [
    {
      title: 'Total Sales Orders',
      value: metrics?.totalOrders?.toString() || '0',
      icon: FileText,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      title: 'Sales Today',
      value: `$${(metrics?.salesToday || 0).toFixed(2)}`,
      icon: BarChart,
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50',
    },
    {
      title: 'Pending / Approved',
      value: `${metrics?.pendingCount || 0} / ${metrics?.approvedCount || 0}`,
      icon: CheckCircle,
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
    },
  ];

  return (
    <div className="page-container">
      {/* Enhanced Header with Actions */}
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage sales orders generated from customer templates
          </p>
        </div>
        <div className="flex space-x-3">
          <GenerateTestDataButton />
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="shadow-sm"
          >
            Create Sales Order
          </Button>
        </div>
      </div>

      <div className="page-content">
        <Tabs defaultValue="orders" className="w-full">
          {/* Enhanced Tab List */}
          <div className="flex space-x-1 border-b border-border pb-2 mb-8">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px] h-auto p-1 bg-muted/50">
              <TabsTrigger 
                value="orders" 
                className="nav-item data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Sales Orders
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="nav-item data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Customer Templates
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="orders" className="space-y-8">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {metricsData.map((metric, index) => (
                <Card key={index} className="card-modern hover:shadow-lg transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {metric.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${metric.bgClass}`}>
                      <metric.icon className={`h-5 w-5 ${metric.colorClass}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Sales Orders Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesOverTimeData}>
                        <XAxis 
                          dataKey="name" 
                          stroke="hsl(var(--muted-foreground))" 
                          tickLine={false} 
                          axisLine={false}
                          className="text-xs"
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))" 
                          tickLine={false} 
                          axisLine={false}
                          className="text-xs"
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="orders" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={3}
                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-secondary" />
                    Orders by Region
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={regionData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80} 
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {regionData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sales Orders List */}
            <SalesOrdersList />
          </TabsContent>
          
          <TabsContent value="templates" className="mt-8">
            <CustomerTemplates />
          </TabsContent>
        </Tabs>
      </div>

      <CreateSalesOrderDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}