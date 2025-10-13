import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Package, ShoppingCart, Users, DollarSign, ArrowUpRight } from 'lucide-react';

const Dashboard = () => {
  const stats = [
    {
      title: 'Total Revenue',
      value: '$45,231.89',
      change: '+20.1%',
      trend: 'up',
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Orders',
      value: '2,345',
      change: '+12.5%',
      trend: 'up',
      icon: ShoppingCart,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Products',
      value: '1,234',
      change: '+5.3%',
      trend: 'up',
      icon: Package,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Customers',
      value: '8,456',
      change: '-2.4%',
      trend: 'down',
      icon: Users,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const recentOrders = [
    { id: 'ORD-001', customer: 'John Doe', product: 'Premium Widget', amount: '$299.00', status: 'completed' },
    { id: 'ORD-002', customer: 'Jane Smith', product: 'Standard Package', amount: '$149.00', status: 'processing' },
    { id: 'ORD-003', customer: 'Bob Johnson', product: 'Elite Bundle', amount: '$599.00', status: 'pending' },
    { id: 'ORD-004', customer: 'Alice Brown', product: 'Starter Kit', amount: '$99.00', status: 'completed' },
    { id: 'ORD-005', customer: 'Charlie Wilson', product: 'Pro Suite', amount: '$399.00', status: 'processing' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'processing':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'pending':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50" data-testid="dashboard-page">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your business today.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            const TrendIcon = stat.trend === 'up' ? TrendingUp : TrendingDown;
            return (
              <Card
                key={index}
                className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                data-testid={`stat-card-${index}`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                  <div className="flex items-center gap-1">
                    <TrendIcon
                      className={`w-4 h-4 ${
                        stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">from last month</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-lg" data-testid="recent-orders-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">Recent Orders</CardTitle>
                  <CardDescription>Latest transactions from your store</CardDescription>
                </div>
                <Button variant="outline" size="sm" data-testid="view-all-orders-btn">
                  View All
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order, index) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                    data-testid={`order-item-${index}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{order.customer}</p>
                        <p className="text-sm text-gray-500">{order.id} • {order.product}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-gray-900">{order.amount}</p>
                      <Badge className={getStatusColor(order.status)} data-testid={`order-status-${index}`}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg" data-testid="quick-actions-card">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Quick Actions</CardTitle>
              <CardDescription>Manage your business efficiently</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline" data-testid="add-product-btn">
                <Package className="w-4 h-4 mr-2" />
                Add New Product
              </Button>
              <Button className="w-full justify-start" variant="outline" data-testid="create-order-btn">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Create Order
              </Button>
              <Button className="w-full justify-start" variant="outline" data-testid="add-customer-btn">
                <Users className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
              <Button
                className="w-full justify-start bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0"
                data-testid="generate-report-btn"
              >
                Generate Report
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;