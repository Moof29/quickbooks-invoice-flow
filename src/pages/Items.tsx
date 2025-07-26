import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Package, Search } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Items & Products</h1>
          <p className="text-muted-foreground">
            Manage your inventory items and sync with QuickBooks
          </p>
        </div>
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

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items by name, SKU, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                  </div>
                  {getStatusBadge(item)}
                </div>
                {item.sku && (
                  <CardDescription>SKU: {item.sku}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Type: {item.item_type || 'Not specified'}
                    </span>
                    {item.purchase_cost && (
                      <span className="text-sm font-semibold">
                        ${item.purchase_cost.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Last synced: {new Date(item.last_sync_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredItems.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items found</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm ? 
                'No items match your search criteria. Try adjusting your search terms.' :
                'Get started by syncing items from QuickBooks or adding them manually.'
              }
            </p>
            {!searchTerm && (
              <Button 
                className="mt-4"
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}