import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Package2,
  ShoppingBag,
  Users2,
  DollarSign,
  Activity,
  MoreVertical,
  Download,
  Filter,
} from 'lucide-react';

const DashboardV2 = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const metrics = [
    {
      label: 'Revenue',
      value: '$124,563',
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Orders',
      value: '3,842',
      change: '+8.2%',
      trend: 'up',
      icon: ShoppingBag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Customers',
      value: '12,456',
      change: '+23.1%',
      trend: 'up',
      icon: Users2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Inventory',
      value: '856',
      change: '-3.2%',
      trend: 'down',
      icon: Package2,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  const topProducts = [
    { name: 'Premium Widget Pro', sold: 1245, revenue: 124500, growth: 32 },
    { name: 'Enterprise Suite', sold: 892, revenue: 356800, growth: 28 },
    { name: 'Starter Pack Plus', sold: 2341, revenue: 93640, growth: 45 },
    { name: 'Advanced Module', sold: 567, revenue: 85050, growth: 18 },
    { name: 'Basic Tool Kit', sold: 3421, revenue: 68420, growth: 56 },
  ];

  const recentActivity = [
    { type: 'order', user: 'Sarah Johnson', action: 'placed order #3421', time: '2 min ago', amount: '$599' },
    { type: 'product', user: 'Mike Chen', action: 'updated inventory', time: '15 min ago', amount: null },
    { type: 'customer', user: 'Emma Wilson', action: 'registered account', time: '1 hour ago', amount: null },
    { type: 'order', user: 'David Brown', action: 'placed order #3420', time: '2 hours ago', amount: '$299' },
    { type: 'payment', user: 'Lisa Anderson', action: 'payment received', time: '3 hours ago', amount: '$1,299' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-amber-50" data-testid="dashboard-v2-page">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Business Overview</h1>
            <p className="text-gray-600">Monitor your business performance in real-time</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="filter-btn">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm" data-testid="export-btn">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              size="sm"
              data-testid="generate-report-btn"
            >
              Generate Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            const TrendIcon = metric.trend === 'up' ? ArrowUpRight : ArrowDownRight;
            return (
              <Card key={index} className="border-none shadow-md hover:shadow-lg transition-shadow" data-testid={`metric-card-${index}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${metric.bgColor}`}>
                      <Icon className={`w-6 h-6 ${metric.color}`} />
                    </div>
                    <Badge
                      variant="secondary"
                      className={`${
                        metric.trend === 'up'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : 'bg-red-100 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      <TrendIcon className="w-3 h-3 mr-1" />
                      {metric.change}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-white">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Top Products</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-md" data-testid="revenue-card">
                <CardHeader>
                  <CardTitle className="text-xl">Revenue Breakdown</CardTitle>
                  <CardDescription>Performance by category this month</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Electronics</span>
                      <span className="text-sm font-bold">$52,430 (42%)</span>
                    </div>
                    <Progress value={42} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Software</span>
                      <span className="text-sm font-bold">$38,650 (31%)</span>
                    </div>
                    <Progress value={31} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Accessories</span>
                      <span className="text-sm font-bold">$21,340 (17%)</span>
                    </div>
                    <Progress value={17} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Other</span>
                      <span className="text-sm font-bold">$12,143 (10%)</span>
                    </div>
                    <Progress value={10} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md" data-testid="targets-card">
                <CardHeader>
                  <CardTitle className="text-xl">Monthly Targets</CardTitle>
                  <CardDescription>Progress towards goals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Sales Target</span>
                      <span className="text-sm font-bold">$124K / $150K</span>
                    </div>
                    <Progress value={83} className="h-2" />
                    <p className="text-xs text-gray-500 mt-1">83% completed</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">New Customers</span>
                      <span className="text-sm font-bold">856 / 1000</span>
                    </div>
                    <Progress value={86} className="h-2" />
                    <p className="text-xs text-gray-500 mt-1">86% completed</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Product Launch</span>
                      <span className="text-sm font-bold">12 / 15</span>
                    </div>
                    <Progress value={80} className="h-2" />
                    <p className="text-xs text-gray-500 mt-1">80% completed</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products">
            <Card className="border-none shadow-md" data-testid="top-products-card">
              <CardHeader>
                <CardTitle className="text-xl">Best Selling Products</CardTitle>
                <CardDescription>Top 5 products by revenue this month</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Growth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((product, index) => (
                      <TableRow key={index} data-testid={`product-row-${index}`}>
                        <TableCell className="font-semibold">{product.name}</TableCell>
                        <TableCell className="text-right">{product.sold.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">${product.revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={product.growth} className="h-1.5 w-16" />
                            <span className="text-sm font-medium text-green-600">+{product.growth}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="border-none shadow-md" data-testid="activity-card">
              <CardHeader>
                <CardTitle className="text-xl">Recent Activity</CardTitle>
                <CardDescription>Latest updates and transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg bg-white border hover:border-orange-200 transition-colors"
                      data-testid={`activity-item-${index}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{activity.user}</p>
                          <p className="text-sm text-gray-600">{activity.action}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {activity.amount && (
                          <p className="font-bold text-gray-900 mb-1">{activity.amount}</p>
                        )}
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DashboardV2;