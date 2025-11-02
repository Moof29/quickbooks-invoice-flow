import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RefreshCw,
  Download,
  Package,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Box,
  Plus,
  Star,
  Upload
} from "lucide-react";
import { format } from 'date-fns';
import { Input } from "@/components/ui/input";
import { MobileFAB } from "@/components/MobileFAB";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImportCSVDialog } from "@/components/ImportCSVDialog";

interface Item {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  item_type?: string;
  is_active: boolean;
  purchase_cost?: number;
  qbo_id?: string;
  sync_status: string;
  last_sync_at?: string;
  unit_price?: number;
  quantity_on_hand?: number;
  updated_at?: string;
}

export default function Items() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Fetch items
  const { data: items = [], isLoading, error } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_record')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Sync with QuickBooks
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.auth.getUser();
      if (!profile.user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', profile.user.id)
        .single();

      if (!userProfile) throw new Error('User profile not found');

      const { data, error } = await supabase.functions.invoke('qbo-sync-items', {
        body: {
          organizationId: userProfile.organization_id,
          direction: 'pull'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: "Sync completed",
        description: `Successfully synced ${data.results.pulled} items from QuickBooks`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (item: Item) => {
    if (item.qbo_id && item.sync_status === 'synced') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Synced</Badge>;
    }
    if (item.sync_status === 'pending') {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
    return <Badge variant="outline">Local</Badge>;
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedItems(prev =>
      prev.length === filteredItems.length ? [] : filteredItems.map(i => i.id)
    );
  };

  const totalValue = filteredItems.reduce((sum, item) => sum + (item.unit_price || 0) * (item.quantity_on_hand || 0), 0);
  const totalItems = filteredItems.length;
  const lowStockItems = filteredItems.filter(item => (item.quantity_on_hand || 0) < 10).length;

  return (
    <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Products</h2>
          <p className="text-sm md:text-base text-muted-foreground">Manage your inventory and product catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setImportDialogOpen(true)}
            variant="outline"
            size={isMobile ? "sm" : "default"}
          >
            <Upload className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Import CSV</span>
          </Button>
          <Button 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            variant="outline"
            size={isMobile ? "sm" : "default"}
            className="flex-1 md:flex-none"
          >
            {syncMutation.isPending ? (
              <RefreshCw className="h-4 w-4 md:mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 md:mr-2" />
            )}
            <span className="hidden md:inline">Sync from QB</span>
            <span className="md:hidden">Sync</span>
          </Button>
          <Button size={isMobile ? "sm" : "default"} className="hidden md:flex">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-lg md:text-2xl font-bold">${totalValue.toFixed(0)}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+20.1%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Products</p>
                <p className="text-lg md:text-2xl font-bold">{totalItems}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Box className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+5.02</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Orders</p>
                <p className="text-lg md:text-2xl font-bold">$4,530</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+33%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-lg md:text-2xl font-bold">{lowStockItems}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <span className="text-red-600 font-medium">-3.58%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 md:h-auto"
        />
      </div>

      {/* Products List - Desktop Table / Mobile Cards */}
      {isLoading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-8">
            <div className="animate-pulse space-y-3 md:space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 md:h-12 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 md:p-16">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                {searchTerm
                  ? 'Try adjusting your search criteria'
                  : 'Sync with QuickBooks to load your inventory'}
              </p>
              <Button 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Sync from QuickBooks
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="border-0 shadow-sm hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleItem(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {item.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {item.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(item.unit_price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.item_type || 'General'}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={
                          (item.quantity_on_hand || 0) > 10 
                            ? 'text-green-600 font-medium' 
                            : (item.quantity_on_hand || 0) > 0 
                              ? 'text-orange-600 font-medium' 
                              : 'text-red-600 font-medium'
                        }>
                          {item.quantity_on_hand || 0}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.sku || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span>4.65</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => (
              <Card key={item.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="mt-1"
                    />
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {item.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description || 'No description'}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Price:</span>
                          <span className="ml-1 font-semibold">${(item.unit_price || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Stock:</span>
                          <span className={`ml-1 font-semibold ${
                            (item.quantity_on_hand || 0) > 10 
                              ? 'text-green-600' 
                              : (item.quantity_on_hand || 0) > 0 
                                ? 'text-orange-600' 
                                : 'text-red-600'
                          }`}>
                            {item.quantity_on_hand || 0}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">SKU:</span>
                          <span className="ml-1 font-mono">{item.sku || '-'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <Badge variant="outline" className="text-xs">
                          {item.item_type || 'General'}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
                            <span className="text-xs">4.65</span>
                          </div>
                          {getStatusBadge(item)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Mobile FAB */}
      <MobileFAB onClick={() => {}} label="Add Product" />
      
      {/* Import CSV Dialog */}
      <ImportCSVDialog 
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}