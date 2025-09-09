import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, BarChart, CheckCircle, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { SalesOrdersList } from "@/components/SalesOrdersList"
import { CustomerTemplates } from "@/components/CustomerTemplates"
import { GenerateTestDataButton } from "@/components/GenerateTestDataButton"
import { CreateSalesOrderDialog } from "@/components/CreateSalesOrderDialog"

// Sample data for charts - matching original functionality
const salesOverTimeData = [
  { name: "Jan", orders: 15 },
  { name: "Feb", orders: 25 },
  { name: "Mar", orders: 32 },
  { name: "Apr", orders: 40 },
  { name: "May", orders: 55 },
  { name: "Jun", orders: 48 },
  { name: "Jul", orders: 65 },
  { name: "Aug", orders: 70 },
]

const regionData = [
  { name: "North America", value: 400 },
  { name: "Europe", value: 300 },
  { name: "Asia", value: 300 },
  { name: "South America", value: 200 },
]

const PIE_CHART_COLORS = ["#000000", "#404040", "#737373", "#a3a3a3"]

export default function SalesOrders() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Fetch sales order metrics - preserving original functionality
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
      title: "Total Sales Orders",
      value: metrics?.totalOrders?.toString() || "0",
      icon: FileText,
    },
    {
      title: "Sales Today",
      value: `$${(metrics?.salesToday || 0).toFixed(2)}`,
      icon: BarChart,
    },
    {
      title: "Pending / Approved",
      value: `${metrics?.pendingCount || 0} / ${metrics?.approvedCount || 0}`,
      icon: CheckCircle,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* Header with sharp, minimal styling */}
      <div className="border-b bg-white">
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Sales Orders</h1>
            <p className="mt-1 text-sm text-gray-600">View and manage sales orders generated from customer templates</p>
          </div>
          <div className="flex space-x-3">
            <GenerateTestDataButton />
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              Create Sales Order
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="orders" className="w-full">
          {/* Clean tab design */}
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-gray-100 mb-8">
            <TabsTrigger value="orders" className="data-[state=active]:bg-white data-[state=active]:text-gray-900">
              Sales Orders
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-white data-[state=active]:text-gray-900">
              Customer Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-8">
            {/* Metrics Cards with minimal styling */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {metricsData.map((metric, index) => (
                <Card key={index} className="border border-gray-200 bg-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">{metric.title}</CardTitle>
                    <div className="p-2 rounded-lg bg-gray-50">
                      <metric.icon className="h-4 w-4 text-gray-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-2xl font-semibold text-gray-900">{metric.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Analytics Charts with clean styling */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-gray-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    <TrendingUp className="h-4 w-4 text-gray-600" />
                    Sales Orders Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesOverTimeData}>
                        <XAxis dataKey="name" stroke="#6b7280" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis stroke="#6b7280" tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="orders"
                          stroke="#000000"
                          strokeWidth={2}
                          dot={{ fill: "#000000", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: "#000000", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    <BarChart className="h-4 w-4 text-gray-600" />
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
                            <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sales Orders List - preserving original functionality */}
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