import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Card, 
  Table, 
  TableHead, 
  TableHeaderCell, 
  TableBody, 
  TableRow, 
  TableCell,
  Badge,
  BadgeDelta,
  Button,
  TextInput,
  Select,
  SelectItem,
  Title,
  Text,
  Flex,
  Grid,
  Metric,
  Icon
} from '@tremor/react';
import { CalendarIcon, MagnifyingGlassIcon, DocumentTextIcon, CurrencyDollarIcon, PlusIcon, PencilIcon, EyeIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CreateSalesOrderDialog } from '@/components/CreateSalesOrderDialog';

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total: number;
  memo: string | null;
  customer_id: string;
  customer_name: string;
  created_at: string;
}

export function SalesOrdersList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleCreateSalesOrder = () => {
    setCreateDialogOpen(true);
  };

  // Fetch sales orders with customer names
  const { data: salesOrders, isLoading, error } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_order')
        .select(`
          id,
          order_number,
          order_date,
          status,
          total,
          memo,
          customer_id,
          created_at,
          customer_profile!inner(
            company_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales orders:', error);
        throw error;
      }

      return (data || []).map(order => ({
        ...order,
        customer_name: order.customer_profile?.company_name || 'Unknown Customer'
      })) as SalesOrder[];
    },
  });

  // Filter sales orders based on search and status
  const filteredOrders = salesOrders?.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.memo && order.memo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string): "gray" | "red" | "yellow" | "green" | "blue" | "indigo" | "purple" | "pink" => {
    switch (status) {
      case 'template_generated':
        return 'blue';
      case 'draft':
        return 'gray';
      case 'open':
        return 'yellow';
      case 'approved':
        return 'indigo';
      case 'shipped':
        return 'purple';
      case 'invoiced':
        return 'green';
      case 'closed':
        return 'gray';
      case 'canceled':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Calculate metrics for dashboard
  const currentMonth = new Date();
  const lastMonth = subMonths(currentMonth, 1);
  const currentMonthStart = startOfMonth(currentMonth);
  const currentMonthEnd = endOfMonth(currentMonth);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);

  const currentMonthOrders = salesOrders?.filter(order => {
    const orderDate = new Date(order.order_date);
    return orderDate >= currentMonthStart && orderDate <= currentMonthEnd;
  }) || [];

  const lastMonthOrders = salesOrders?.filter(order => {
    const orderDate = new Date(order.order_date);
    return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
  }) || [];

  const totalRevenue = currentMonthOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const revenueGrowth = lastMonthRevenue > 0 ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  const pendingOrders = salesOrders?.filter(order => 
    ['draft', 'open', 'approved', 'template_generated'].includes(order.status)
  ) || [];
  const lastMonthPendingOrders = lastMonthOrders.filter(order => 
    ['draft', 'open', 'approved', 'template_generated'].includes(order.status)
  );
  const pendingGrowth = lastMonthPendingOrders.length > 0 ? 
    ((pendingOrders.length - lastMonthPendingOrders.length) / lastMonthPendingOrders.length) * 100 : 0;

  const completedOrders = salesOrders?.filter(order => 
    ['shipped', 'invoiced', 'closed'].includes(order.status)
  ) || [];
  const totalOrders = salesOrders?.length || 0;
  const completionRate = totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0;

  const ordersGrowth = lastMonthOrders.length > 0 ? 
    ((currentMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100 : 0;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'template_generated':
        return 'Auto-Generated';
      case 'draft':
        return 'Draft';
      case 'open':
        return 'Open';
      case 'approved':
        return 'Approved';
      case 'shipped':
        return 'Shipped';
      case 'invoiced':
        return 'Invoiced';
      case 'closed':
        return 'Closed';
      case 'canceled':
        return 'Canceled';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-full">
        <Flex alignItems="center" justifyContent="center" className="h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-full">
        <div className="text-center p-8">
          <Text className="text-red-600">Failed to load sales orders. Please try again.</Text>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Dashboard Cards */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
        {/* Total Revenue Card */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 shadow-sm">
          <Flex alignItems="start" justifyContent="between" className="p-6 md:p-8">
            <div className="space-y-3 md:space-y-4">
              <Text className="text-green-700 font-medium text-base md:text-lg">Total Revenue</Text>
              <Metric className="text-green-900 text-2xl md:text-3xl lg:text-4xl font-bold">
                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Metric>
              <div className="flex items-center space-x-3">
                <BadgeDelta 
                  deltaType={revenueGrowth >= 0 ? "increase" : "decrease"} 
                  size="sm"
                  className="text-sm md:text-base"
                >
                  {Math.abs(revenueGrowth).toFixed(1)}%
                </BadgeDelta>
                <Text className="text-green-600 text-sm md:text-base">vs last month</Text>
              </div>
            </div>
            <Icon 
              icon={CurrencyDollarIcon} 
              className="h-10 w-10 md:h-12 md:w-12 text-green-600 bg-green-100 p-2 md:p-2.5 rounded-lg" 
            />
          </Flex>
        </Card>

        {/* Pending Orders Card */}
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 shadow-sm">
          <Flex alignItems="start" justifyContent="between" className="p-6 md:p-8">
            <div className="space-y-3 md:space-y-4">
              <Text className="text-orange-700 font-medium text-base md:text-lg">Pending Orders</Text>
              <Metric className="text-orange-900 text-2xl md:text-3xl lg:text-4xl font-bold">
                {pendingOrders.length}
              </Metric>
              <div className="flex items-center space-x-3">
                <BadgeDelta 
                  deltaType={pendingGrowth >= 0 ? "increase" : "decrease"} 
                  size="sm"
                  className="text-sm md:text-base"
                >
                  {Math.abs(pendingGrowth).toFixed(1)}%
                </BadgeDelta>
                <Text className="text-orange-600 text-sm md:text-base">orders pending</Text>
              </div>
            </div>
            <Icon 
              icon={ClockIcon} 
              className="h-10 w-10 md:h-12 md:w-12 text-orange-600 bg-orange-100 p-2 md:p-2.5 rounded-lg" 
            />
          </Flex>
        </Card>

        {/* Completed Orders Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-sm">
          <Flex alignItems="start" justifyContent="between" className="p-6 md:p-8">
            <div className="space-y-3 md:space-y-4">
              <Text className="text-blue-700 font-medium text-base md:text-lg">Completed Orders</Text>
              <Metric className="text-blue-900 text-2xl md:text-3xl lg:text-4xl font-bold">
                {completedOrders.length}
              </Metric>
              <div className="flex items-center space-x-3">
                <Badge color="blue" size="sm" className="text-sm md:text-base font-medium">
                  {completionRate.toFixed(1)}% rate
                </Badge>
                <Text className="text-blue-600 text-sm md:text-base">completed</Text>
              </div>
            </div>
            <Icon 
              icon={CheckCircleIcon} 
              className="h-10 w-10 md:h-12 md:w-12 text-blue-600 bg-blue-100 p-2 md:p-2.5 rounded-lg" 
            />
          </Flex>
        </Card>

        {/* Growth Metrics Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 shadow-sm">
          <Flex alignItems="start" justifyContent="between" className="p-6 md:p-8">
            <div className="space-y-3 md:space-y-4">
              <Text className="text-purple-700 font-medium text-base md:text-lg">Growth Metrics</Text>
              <Metric className="text-purple-900 text-2xl md:text-3xl lg:text-4xl font-bold">
                {ordersGrowth >= 0 ? '+' : ''}{ordersGrowth.toFixed(1)}%
              </Metric>
              <div className="flex items-center space-x-3">
                <Icon 
                  icon={ordersGrowth >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon}
                  className={`h-5 w-5 md:h-6 md:w-6 ${ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}
                />
                <Text className="text-purple-600 text-sm md:text-base">orders volume</Text>
              </div>
            </div>
            <Icon 
              icon={ArrowTrendingUpIcon} 
              className="h-10 w-10 md:h-12 md:w-12 text-purple-600 bg-purple-100 p-2 md:p-2.5 rounded-lg" 
            />
          </Flex>
        </Card>
      </Grid>

      {/* Header Section - iPad Optimized */}
      <Card className="shadow-sm border-0 bg-white">
        <Flex alignItems="center" justifyContent="between" className="p-6 md:p-8 border-b border-gray-100">
          <div className="space-y-2">
            <Title className="text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900">Sales Orders</Title>
            <Text className="text-gray-600 text-base md:text-lg">View and manage sales orders generated from customer templates</Text>
          </div>
          <Button
            onClick={handleCreateSalesOrder}
            icon={PlusIcon}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 md:px-8 md:py-4 rounded-lg shadow-sm text-base md:text-lg touch-target"
          >
            Create Sales Order
          </Button>
        </Flex>

        {/* Filters & Search - iPad Optimized */}
        <div className="p-6 md:p-8 border-b border-gray-100">
          <Flex alignItems="center" justifyContent="start" className="gap-4 md:gap-6">
            <div className="flex-1 max-w-md md:max-w-lg">
              <TextInput
                icon={MagnifyingGlassIcon}
                placeholder="Search orders, customers, or notes..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="bg-gray-50 border-gray-200 h-12 md:h-14 text-base ipad-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter} className="w-56 md:w-64 h-12 md:h-14">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="template_generated">Auto-Generated</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </Select>
          </Flex>
        </div>

        {/* Summary Metrics - Simplified */}
        {filteredOrders.length > 0 && (
          <div className="p-6 border-b border-gray-100">
            <Grid numItems={1} numItemsSm={3} className="gap-4">
              <Card className="bg-gray-50 border border-gray-200">
                <Flex alignItems="center" justifyContent="start" className="space-x-3 p-4">
                  <Icon icon={DocumentTextIcon} className="h-6 w-6 text-gray-600" />
                  <div>
                    <Text className="text-gray-600 font-medium text-sm">Filtered Results</Text>
                    <Metric className="text-gray-900 text-lg">{filteredOrders.length}</Metric>
                  </div>
                </Flex>
              </Card>
              <Card className="bg-gray-50 border border-gray-200">
                <Flex alignItems="center" justifyContent="start" className="space-x-3 p-4">
                  <Icon icon={CurrencyDollarIcon} className="h-6 w-6 text-gray-600" />
                  <div>
                    <Text className="text-gray-600 font-medium text-sm">Filtered Value</Text>
                    <Metric className="text-gray-900 text-lg">
                      ${filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Metric>
                  </div>
                </Flex>
              </Card>
              <Card className="bg-gray-50 border border-gray-200">
                <Flex alignItems="center" justifyContent="start" className="space-x-3 p-4">
                  <Icon icon={CalendarIcon} className="h-6 w-6 text-gray-600" />
                  <div>
                    <Text className="text-gray-600 font-medium text-sm">Auto-Generated</Text>
                    <Metric className="text-gray-900 text-lg">
                      {filteredOrders.filter(order => order.status === 'template_generated').length}
                    </Metric>
                  </div>
                </Flex>
              </Card>
            </Grid>
          </div>
        )}
      </Card>

      {/* Main Data Table - iPad Optimized */}
      <Card className="shadow-sm border-0 bg-white">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 md:py-20">
            <Icon icon={DocumentTextIcon} className="h-20 w-20 md:h-24 md:w-24 mx-auto text-gray-300 mb-6" />
            <Title className="text-gray-900 mb-4 text-xl md:text-2xl">No sales orders found</Title>
            <Text className="text-gray-600 text-base md:text-lg">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search criteria'
                : 'Create customer templates to automatically generate sales orders'
              }
            </Text>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-h-96">
              <TableHead>
                <TableRow className="border-b border-gray-200 bg-gray-50 h-16 md:h-20">
                  <TableHeaderCell className="py-4 md:py-6 px-4 md:px-6">
                    <input 
                      type="checkbox" 
                      className="h-5 w-5 md:h-6 md:w-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 touch-target"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(filteredOrders.map(o => o.id));
                        } else {
                          setSelectedOrders([]);
                        }
                      }}
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell className="text-left font-semibold text-gray-900 text-base md:text-lg">Order Number</TableHeaderCell>
                  <TableHeaderCell className="text-left font-semibold text-gray-900 text-base md:text-lg">Customer</TableHeaderCell>
                  <TableHeaderCell className="text-left font-semibold text-gray-900 text-base md:text-lg">Date</TableHeaderCell>
                  <TableHeaderCell className="text-left font-semibold text-gray-900 text-base md:text-lg">Status</TableHeaderCell>
                  <TableHeaderCell className="text-right font-semibold text-gray-900 text-base md:text-lg">Total</TableHeaderCell>
                  <TableHeaderCell className="text-left font-semibold text-gray-900 text-base md:text-lg">Notes</TableHeaderCell>
                  <TableHeaderCell className="text-center font-semibold text-gray-900 text-base md:text-lg min-w-[140px] md:min-w-[180px]">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 border-b border-gray-100 h-16 md:h-20">
                    <TableCell className="py-4 md:py-6 px-4 md:px-6">
                      <input 
                        type="checkbox" 
                        className="h-5 w-5 md:h-6 md:w-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 touch-target"
                        checked={selectedOrders.includes(order.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrders([...selectedOrders, order.id]);
                          } else {
                            setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium text-gray-900 text-base md:text-lg">
                      {order.order_number}
                    </TableCell>
                    <TableCell className="text-gray-900 font-medium text-base md:text-lg">
                      {order.customer_name}
                    </TableCell>
                    <TableCell className="text-gray-600 text-base md:text-lg">
                      {format(new Date(order.order_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge color={getStatusColor(order.status)} size="sm" className="font-medium text-sm md:text-base px-3 py-1">
                        {getStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-gray-900 text-base md:text-lg">
                      ${(order.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-gray-600 text-sm md:text-base">
                      {order.memo || '—'}
                    </TableCell>
                    <TableCell>
                      <Flex alignItems="center" justifyContent="center" className="gap-2 md:gap-3">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={EyeIcon}
                          onClick={() => navigate(`/sales-orders/${order.id}`)}
                          className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base touch-target"
                        >
                          View
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          icon={PencilIcon}
                          onClick={() => navigate(`/sales-orders/${order.id}/edit`)}
                          className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base touch-target"
                        >
                          Edit
                        </Button>
                      </Flex>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer - iPad Optimized */}
        {filteredOrders.length > 0 && (
          <div className="px-6 md:px-8 py-4 md:py-6 border-t border-gray-200 bg-gray-50">
            <Flex alignItems="center" justifyContent="between" className="flex-col md:flex-row gap-4 md:gap-0">
              <Text className="text-sm md:text-base text-gray-600">
                Showing {filteredOrders.length} of {salesOrders?.length || 0} orders
                {selectedOrders.length > 0 && ` • ${selectedOrders.length} selected`}
              </Text>
              <div className="flex items-center space-x-3 md:space-x-4">
                <Button variant="light" size="xs" className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base touch-target">Previous</Button>
                <Button variant="light" size="xs" className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-blue-600 text-white touch-target">1</Button>
                <Button variant="light" size="xs" className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base touch-target">Next</Button>
              </div>
            </Flex>
          </div>
        )}
      </Card>

      <CreateSalesOrderDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
