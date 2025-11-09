import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  FileText,
  Package,
  DollarSign,
  Play,
  Pause
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthProfile } from '@/hooks/useAuthProfile';

interface SyncStatus {
  organization_id: string;
  organization_name: string;
  connection_active: boolean;
  last_sync_at: string;
  qbo_token_expires_at: string;
  token_status: 'valid' | 'expiring_soon' | 'expired';
  pending_jobs: number;
  processing_jobs: number;
  failed_jobs: number;
  last_successful_sync: string;
}

interface SyncQueue {
  id: string;
  sync_endpoint: string;
  direction: string;
  priority: string;
  status: string;
  created_at: string;
  started_at: string;
  error_message: string;
}

interface EntityStats {
  items: { total: number; synced: number; pending: number };
  customers: { total: number; synced: number; pending: number };
  invoices: { total: number; synced: number; pending: number };
  payments: { total: number; synced: number; pending: number };
}

const entityIcons = {
  items: Package,
  customers: Users,
  invoices: FileText,
  payments: DollarSign,
};

const entityLabels = {
  items: 'Items',
  customers: 'Customers',
  invoices: 'Invoices',
  payments: 'Payments',
};

export function SyncDashboard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncQueue, setSyncQueue] = useState<SyncQueue[]>([]);
  const [entityStats, setEntityStats] = useState<EntityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingEntity, setSyncingEntity] = useState<string | null>(null);
  const { toast } = useToast();
  const { profile } = useAuthProfile();

  useEffect(() => {
    if (!profile?.organization_id) return;
    loadSyncStatus();
    loadSyncQueue();
    loadEntityStats();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadSyncStatus();
      loadSyncQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [profile]);

  const loadSyncStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('qbo_sync_status')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .single();

      if (error) throw error;
      setSyncStatus(data);
    } catch (error) {
      console.error('Error loading sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('qbo_sync_queue')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSyncQueue(data || []);
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  };

  const loadEntityStats = async () => {
    if (!profile?.organization_id) return;

    try {
      // Load stats for each entity type
      const [itemsData, customersData, invoicesData, paymentsData] = await Promise.all([
        supabase
          .from('item_record')
          .select('id, qbo_id')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('customer_profile')
          .select('id, qbo_id')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('invoice_record')
          .select('id, qbo_id')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('invoice_payment')
          .select('id, qbo_id')
          .eq('organization_id', profile.organization_id),
      ]);

      const stats: EntityStats = {
        items: {
          total: itemsData.data?.length || 0,
          synced: itemsData.data?.filter(i => i.qbo_id).length || 0,
          pending: itemsData.data?.filter(i => !i.qbo_id).length || 0,
        },
        customers: {
          total: customersData.data?.length || 0,
          synced: customersData.data?.filter(c => c.qbo_id).length || 0,
          pending: customersData.data?.filter(c => !c.qbo_id).length || 0,
        },
        invoices: {
          total: invoicesData.data?.length || 0,
          synced: invoicesData.data?.filter(i => i.qbo_id).length || 0,
          pending: invoicesData.data?.filter(i => !i.qbo_id).length || 0,
        },
        payments: {
          total: paymentsData.data?.length || 0,
          synced: paymentsData.data?.filter(p => p.qbo_id).length || 0,
          pending: paymentsData.data?.filter(p => !p.qbo_id).length || 0,
        },
      };

      setEntityStats(stats);
    } catch (error) {
      console.error('Error loading entity stats:', error);
    }
  };

  const triggerSync = async (entityType: string, direction: 'pull' | 'push' | 'both') => {
    if (!profile?.organization_id) return;

    setSyncingEntity(entityType);
    try {
      const { data, error } = await supabase.rpc('trigger_qbo_sync', {
        p_organization_id: profile.organization_id,
        p_entity_type: entityType,
        p_direction: direction,
        p_priority: 'urgent',
      });

      if (error) throw error;

      toast({
        title: 'Sync Queued',
        description: `${entityLabels[entityType]} sync has been queued with high priority.`,
      });

      // Refresh queue
      await loadSyncQueue();
    } catch (error: any) {
      console.error('Error triggering sync:', error);
      toast({
        title: 'Error',
        description: error.message || `Failed to queue ${entityLabels[entityType]} sync`,
        variant: 'destructive',
      });
    } finally {
      setSyncingEntity(null);
    }
  };

  const triggerFullSync = async () => {
    if (!profile?.organization_id) return;

    setSyncingEntity('all');
    try {
      // Queue all entity syncs
      const entities = ['items', 'customers', 'invoices', 'payments'];

      for (const entity of entities) {
        await supabase.rpc('trigger_qbo_sync', {
          p_organization_id: profile.organization_id,
          p_entity_type: entity,
          p_direction: 'both',
          p_priority: 'high',
        });
      }

      toast({
        title: 'Full Sync Queued',
        description: 'All entity types have been queued for synchronization.',
      });

      await loadSyncQueue();
    } catch (error: any) {
      console.error('Error triggering full sync:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to queue full sync',
        variant: 'destructive',
      });
    } finally {
      setSyncingEntity(null);
    }
  };

  const getTokenStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'text-green-600 bg-green-100';
      case 'expiring_soon':
        return 'text-yellow-600 bg-yellow-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.connection_active ? 'Active' : 'Inactive'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Token: <span className={`font-medium ${getTokenStatusColor(syncStatus?.token_status || 'valid')}`}>
                {syncStatus?.token_status?.replace('_', ' ')}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStatus?.pending_jobs || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Waiting to be processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStatus?.processing_jobs || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently syncing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{syncStatus?.failed_jobs || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entity Sync Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Entity Sync Controls</CardTitle>
              <CardDescription>Manage synchronization for each entity type</CardDescription>
            </div>
            <Button
              onClick={triggerFullSync}
              disabled={syncingEntity === 'all'}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncingEntity === 'all' ? 'animate-spin' : ''}`} />
              Sync All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(entityStats || {}).map(([entityType, stats]) => {
              const Icon = entityIcons[entityType];
              const isSyncing = syncingEntity === entityType;

              return (
                <Card key={entityType} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-blue-600" />
                      <Badge variant="outline" className="text-xs">
                        {stats.synced}/{stats.total}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{entityLabels[entityType]}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">{stats.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Synced</span>
                        <span className="font-medium text-green-600">{stats.synced}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-medium text-orange-600">{stats.pending}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => triggerSync(entityType, 'pull')}
                        disabled={isSyncing}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        Pull
                      </Button>
                      <Button
                        onClick={() => triggerSync(entityType, 'push')}
                        disabled={isSyncing}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        Push
                      </Button>
                      <Button
                        onClick={() => triggerSync(entityType, 'both')}
                        disabled={isSyncing}
                        size="sm"
                        className="flex-1"
                      >
                        {isSyncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Both'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sync Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sync Queue</CardTitle>
          <CardDescription>Jobs currently pending or processing</CardDescription>
        </CardHeader>
        <CardContent>
          {syncQueue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No jobs in queue</p>
            </div>
          ) : (
            <div className="space-y-3">
              {syncQueue.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      job.status === 'processing' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {job.status === 'processing' ? (
                        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {job.sync_endpoint.replace('qbo-sync-', '').toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.direction} • {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(job.priority)}>
                      {job.priority}
                    </Badge>
                    <Badge variant={job.status === 'processing' ? 'default' : 'secondary'}>
                      {job.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Sync Time */}
      {syncStatus?.last_successful_sync && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Last successful sync</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(syncStatus.last_successful_sync).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SyncDashboard;
