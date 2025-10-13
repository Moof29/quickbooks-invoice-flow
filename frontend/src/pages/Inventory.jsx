import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Plus, Download, Package, AlertCircle } from 'lucide-react';

const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const products = [
    { id: 'PRD-001', name: 'Premium Widget', category: 'Electronics', stock: 150, price: '$299.00', status: 'in-stock' },
    { id: 'PRD-002', name: 'Standard Package', category: 'Accessories', stock: 45, price: '$149.00', status: 'low-stock' },
    { id: 'PRD-003', name: 'Elite Bundle', category: 'Electronics', stock: 0, price: '$599.00', status: 'out-of-stock' },
    { id: 'PRD-004', name: 'Starter Kit', category: 'Starter Packs', stock: 230, price: '$99.00', status: 'in-stock' },
    { id: 'PRD-005', name: 'Pro Suite', category: 'Software', stock: 89, price: '$399.00', status: 'in-stock' },
    { id: 'PRD-006', name: 'Basic Tool', category: 'Tools', stock: 12, price: '$49.00', status: 'low-stock' },
    { id: 'PRD-007', name: 'Advanced Module', category: 'Electronics', stock: 67, price: '$449.00', status: 'in-stock' },
    { id: 'PRD-008', name: 'Mini Pack', category: 'Accessories', stock: 156, price: '$79.00', status: 'in-stock' },
  ];

  const getStockBadge = (status) => {
    switch (status) {
      case 'in-stock':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">In Stock</Badge>;
      case 'low-stock':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Low Stock</Badge>;
      case 'out-of-stock':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Out of Stock</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockCount = products.filter((p) => p.status === 'low-stock').length;
  const outOfStockCount = products.filter((p) => p.status === 'out-of-stock').length;
  const totalValue = products.reduce((sum, p) => sum + p.stock * parseFloat(p.price.replace('$', '')), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50" data-testid="inventory-page">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Inventory Management</h1>
          <p className="text-gray-600">Track and manage your product inventory</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{products.length}</div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Inventory Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">${totalValue.toLocaleString()}</div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Low Stock</span>
                  <Badge className="bg-amber-100 text-amber-700">{lowStockCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Out of Stock</span>
                  <Badge className="bg-red-100 text-red-700">{outOfStockCount}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-lg" data-testid="inventory-table-card">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold">Products</CardTitle>
                <CardDescription>Manage your product inventory and stock levels</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" data-testid="export-btn">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                  data-testid="add-product-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search products by name, ID, or category..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-input"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product, index) => (
                  <TableRow key={product.id} className="hover:bg-gray-50" data-testid={`product-row-${index}`}>
                    <TableCell className="font-mono text-sm">{product.id}</TableCell>
                    <TableCell className="font-semibold">{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-right">
                      <span className={product.stock < 50 ? 'text-amber-600 font-semibold' : ''}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{product.price}</TableCell>
                    <TableCell>{getStockBadge(product.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No products found matching your search.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Inventory;