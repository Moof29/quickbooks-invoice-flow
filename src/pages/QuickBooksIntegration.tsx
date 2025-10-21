
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Settings,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthProfile } from '@/hooks/useAuthProfile';

interface QBOConnection {
  id: string;
  is_active: boolean;
  last_connected_at: string;
  last_sync_at: string;
  qbo_company_id: string;
  qbo_realm_id: string;
  environment: string;
}

interface SyncHistory {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string;
  entity_count: number;
  success_count: number;
  failure_count: number;
  error_summary: string;
}

const QuickBooksIntegration = () => {
  const [connection, setConnection] = useState<QBOConnection | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuthProfile();

  useEffect(() => {
    console.log('QuickBooks page useEffect triggered, profile:', profile);
    
    // Only proceed if we have profile data
    if (!profile) {
      console.log('No profile yet, waiting...');
      return;
    }
    
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (success === 'true') {
      toast({
        title: "Connected Successfully",
        description: "Your QuickBooks Online account has been connected.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    loadConnectionStatus();
    loadSyncHistory();
  }, [profile]);

  const loadConnectionStatus = async () => {
    try {
      console.log('Loading connection status for profile:', profile);
      // Use safe view instead of direct table access (using type assertion for new view)
      const { data, error } = await supabase
        .from('qbo_connection_safe' as any)
        .select('*')
        .maybeSingle();

      console.log('Connection query result:', { data, error });
      if (error) throw error;
      setConnection(data as unknown as QBOConnection | null);
    } catch (error) {
      console.error('Error loading connection status:', error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('qbo_sync_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (error) {
      console.error('Error loading sync history:', error);
      toast({
        title: "Error",
        description: "Failed to load sync history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    console.log('Connect button clicked, profile:', profile);
    
    if (!profile?.organization_id) {
      console.error('No organization_id found in profile');
      toast({
        title: "Error",
        description: "Organization not found. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Calling qbo-oauth-initiate with organizationId:', profile.organization_id);
      const response = await supabase.functions.invoke('qbo-oauth-initiate', {
        body: { organizationId: profile.organization_id }
      });

      console.log('OAuth initiate response:', response);

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { authUrl } = response.data;
      console.log('Redirecting to QuickBooks OAuth URL:', authUrl);
      
      // Redirect to QuickBooks OAuth
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('OAuth initiation failed:', error);
      toast({
        title: "Connection Failed", 
        description: error.message || "Failed to initiate QuickBooks connection.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from QuickBooks?')) return;

    try {
      // Note: This will fail due to RLS - only service role can modify qbo_connection
      // Need to create an edge function for disconnect operation
      toast({
        title: "Notice",
        description: "Disconnect feature requires admin approval. Please contact support.",
        variant: "default",
      });
      
      // TODO: Create edge function for disconnect operation
      // const { error } = await supabase.functions.invoke('qbo-disconnect', {
      //   body: { organizationId: profile?.organization_id }
      // });

    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect from QuickBooks",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    if (!connection?.is_active || !profile?.organization_id) {
      toast({
        title: "Error",
        description: "Please connect to QuickBooks first",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      toast({
        title: "Sync Started",
        description: "Data synchronization with QuickBooks has been initiated",
      });

      // Start customer sync
      const response = await supabase.functions.invoke('qbo-sync-customers', {
        body: { 
          organizationId: profile.organization_id,
          direction: "both"
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { results } = response.data;
      
      toast({
        title: "Sync Completed",
        description: `Synced ${results.pulled + results.pushed} records. ${results.errors.length > 0 ? `${results.errors.length} errors occurred.` : ''}`,
        variant: results.errors.length > 0 ? "destructive" : "default",
      });

      // Reload sync history and connection status
      loadSyncHistory();
      loadConnectionStatus();
    } catch (error: any) {
      console.error('Error syncing:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start synchronization",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'running':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading QuickBooks integration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">QuickBooks Integration</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Connect and sync your data with QuickBooks Online</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {connection?.is_active ? (
                <>
                  <Button 
                    onClick={handleSync} 
                    disabled={syncing}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button onClick={handleDisconnect} variant="destructive" className="w-full sm:w-auto">
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect} className="w-full sm:w-auto">
                  <Zap className="w-4 h-4 mr-2" />
                  Connect to QuickBooks
                </Button>
            )}
          </div>
        </div>
      </div>
      {/* Connection Status */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Zap className="w-5 h-5 mr-2" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connection?.is_active ? (
            <div className="space-y-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="font-medium">Connected to QuickBooks Online</span>
                <Badge variant="default" className="ml-2">Active</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <div>
                    <p className="text-sm text-gray-600">Company ID</p>
                    <p className="font-medium">{connection.qbo_company_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Environment</p>
                    <p className="font-medium capitalize">{connection.environment}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Connected</p>
                    <p className="font-medium">
                      {new Date(connection.last_connected_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {connection.last_sync_at && (
                  <div className="pt-2">
                    <p className="text-sm text-gray-600">Last Sync</p>
                    <p className="font-medium">
                      {new Date(connection.last_sync_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Not Connected</h3>
                <p className="text-gray-500 mb-6">
                  Connect to QuickBooks Online to sync your invoices, customers, and items
                </p>
                <Button onClick={handleConnect}>
                  <Zap className="w-4 h-4 mr-2" />
                  Connect to QuickBooks
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Integration Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Customers</CardTitle>
          </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Sync customer profiles between your app and QuickBooks
              </p>
              <div className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span>Automatic sync enabled</span>
              </div>
            </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Invoices</CardTitle>
          </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Create invoices here and sync them to QuickBooks automatically
              </p>
              <div className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span>Automatic sync enabled</span>
              </div>
            </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Items</CardTitle>
          </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Keep your product and service items in sync across platforms
              </p>
              <div className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span>Automatic sync enabled</span>
              </div>
            </CardContent>
        </Card>
      </div>

      {/* Sync History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Sync History</CardTitle>
          <CardDescription>
            Recent synchronization activities with QuickBooks
          </CardDescription>
        </CardHeader>
          <CardContent>
            {syncHistory.length === 0 ? (
              <div className="text-center py-8">
                <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No sync history</h3>
                <p className="text-gray-500">
                  {connection?.is_active ? 
                    'Start your first sync to see the history here' : 
                    'Connect to QuickBooks to start syncing data'
                  }
                </p>
              </div>
          ) : (
            <div className="space-y-4">
              {syncHistory.map((sync) => (
                <div key={sync.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                      <RefreshCw className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{sync.sync_type} Sync</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sync.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="text-left md:text-right">
                      <p className="text-sm">
                        {sync.success_count}/{sync.entity_count} successful
                      </p>
                      {sync.failure_count > 0 && (
                        <p className="text-sm text-red-600">
                          {sync.failure_count} failed
                        </p>
                      )}
                    </div>
                    <Badge className={`${getStatusColor(sync.status)} w-fit`}>
                      {sync.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      {!connection?.is_active && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Setup Required:</strong> To connect with QuickBooks Online, you'll need to:
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Have a QuickBooks Online account</li>
              <li>Authorize this application to access your QuickBooks data</li>
              <li>Configure sync preferences for your data</li>
            </ol>
            <Button variant="link" className="p-0 mt-2" asChild>
              <a href="https://developer.intuit.com/" target="_blank" rel="noopener noreferrer">
                Learn more about QuickBooks API <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default QuickBooksIntegration;
