import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Package, Search, MoreHorizontal } from "lucide-react";
import { format } from 'date-fns';
import { Input } from "@/components/ui/input";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      return <Badge variant="default">Synced</Badge>;
    }
    if (item.sync_status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="outline">Local</Badge>;
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="page-header">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="page-title">Items & Products</h1>
              <p className="page-description">
                Manage your inventory items and sync with QuickBooks
              </p>
            </div>
            <Button 
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="btn-text"
            >
              {syncMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Sync from QuickBooks
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-3 mb-8">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items by name, SKU, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md text-body"
          />
        </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="layout-grid-auto">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="card-modern animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No items found</h3>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            {searchTerm ? 'Try adjusting your search criteria to find what you\'re looking for' : 'Sync with QuickBooks to load your inventory items or add items manually'}
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
      ) : (
        <div className="page-content">
          <div className="layout-grid-auto">
            {filteredItems.map((item) => (
              <Card key={item.id} className="card-product">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-lg mb-2 truncate">{item.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.description || 'No description available'}</p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">SKU:</span>
                          <Badge variant="outline" className="text-xs font-mono">
                            {item.sku || 'N/A'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Price</div>
                            <span className="text-xl font-bold text-foreground">
                              ${(item.unit_price || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground mb-1">Stock</div>
                            <div className={`text-lg font-bold ${
                              (item.quantity_on_hand || 0) > 10 
                                ? 'text-green-600' 
                                : (item.quantity_on_hand || 0) > 0 
                                  ? 'text-orange-600' 
                                  : 'text-red-600'
                            }`}>
                              {item.quantity_on_hand || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="sm" className="ml-3 flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div className="flex items-center space-x-2">
                      <Badge variant={item.is_active ? "default" : "secondary"} className="text-xs">
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {getStatusBadge(item)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.updated_at ? `Updated ${format(new Date(item.updated_at), 'MMM dd')}` : 'No update date'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {filteredItems.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No items found</h3>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            {searchTerm ? 
              'No items match your search criteria. Try adjusting your search terms.' :
              'Get started by syncing items from QuickBooks or adding them manually.'
            }
          </p>
          {!searchTerm && (
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
          )}
        </div>
      )}
      </div>
    </div>
  );
}