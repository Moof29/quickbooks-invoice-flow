
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Zap, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Settings,
  AlertTriangle,
  ExternalLink,
  Key
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
  qbo_token_expires_at: string;
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
  const [showCredentials, setShowCredentials] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
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
    const initialSync = urlParams.get('initial_sync');
    const error = urlParams.get('error');
    
    if (success === 'true') {
      toast({
        title: "Connected Successfully",
        description: initialSync === 'true' 
          ? "QuickBooks connected! Starting initial data sync..." 
          : "Your QuickBooks Online account has been connected.",
      });
      
      // Trigger initial sync for new connections
      if (initialSync === 'true') {
        console.log('New connection detected - starting initial sync');
        startInitialSync();
      }
      
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
    checkCredentials();
  }, [profile]);

  const checkCredentials = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('qbo-oauth-initiate', {
        body: { organizationId: profile?.organization_id, checkOnly: true }
      });
      
      if (!error && data) {
        setCredentialsConfigured(true);
      }
    } catch (error) {
      console.log('Credentials not yet configured');
    }
  };

  const saveCredentials = async () => {
    if (!clientId || !clientSecret) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both Client ID and Client Secret",
        variant: "destructive"
      });
      return;
    }

    setSavingCredentials(true);
    try {
      // Save credentials as secrets
      const { error: clientIdError } = await supabase.functions.invoke('save-secret', {
        body: { 
          name: 'QB_CLIENT_ID',
          value: clientId
        }
      });

      if (clientIdError) throw clientIdError;

      const { error: clientSecretError } = await supabase.functions.invoke('save-secret', {
        body: { 
          name: 'QB_CLIENT_SECRET',
          value: clientSecret
        }
      });

      if (clientSecretError) throw clientSecretError;

      setCredentialsConfigured(true);
      setShowCredentials(false);
      toast({
        title: "Credentials Saved",
        description: "QuickBooks credentials have been securely stored. You can now connect.",
      });
    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast({
        title: "Error Saving Credentials",
        description: error.message || "Failed to save credentials. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSavingCredentials(false);
    }
  };

  const loadConnectionStatus = async () => {
    try {
      console.log('Loading connection status for profile:', profile);
      // Use the safe view which handles RLS and doesn't expose tokens
      const { data, error } = await supabase
        .from('qbo_connection_safe' as any)
        .select('*')
        .maybeSingle();

      console.log('Connection query result:', { data, error });
      if (error) throw error;
      
      // Check if token is expired (view includes qbo_token_expires_at)
      if (data && (data as any).qbo_token_expires_at) {
        const isExpired = new Date((data as any).qbo_token_expires_at) < new Date();
        if (isExpired) {
          console.log('Token expired, marking connection as inactive');
          (data as any).is_active = false;
        }
      }
      
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

  const handleReactivate = async () => {
    if (!profile?.organization_id) {
      toast({
        title: "Error",
        description: "Organization not found.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('reactivate_qbo_connection', {
        p_organization_id: profile.organization_id
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Success",
          description: "QuickBooks connection reactivated successfully.",
        });
        await loadConnectionStatus();
      } else {
        toast({
          title: "Error",
          description: "Failed to reactivate connection. Token may be expired.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error reactivating connection:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!credentialsConfigured) {
      setShowCredentials(true);
      toast({
        title: "Credentials Required",
        description: "Please configure your QuickBooks credentials first",
      });
      return;
    }

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
    if (!confirm('Are you sure you want to disconnect from QuickBooks? This will stop all automatic syncing.')) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('qbo-disconnect', {
        body: { organizationId: profile?.organization_id }
      });

      if (error) throw error;

      toast({
        title: "Disconnected Successfully",
        description: "Your QuickBooks Online connection has been deactivated.",
      });

      // Reload connection status
      await loadConnectionStatus();
      await loadSyncHistory();
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect from QuickBooks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const startInitialSync = async () => {
    if (!profile?.organization_id) {
      console.error('No organization ID available for initial sync');
      return;
    }

    setSyncing(true);
    try {
      console.log('Starting initial sync for organization:', profile.organization_id);
      
      const response = await supabase.functions.invoke('qbo-initial-sync', {
        body: { 
          organizationId: profile.organization_id,
          entityTypes: ['customer', 'item', 'invoice', 'payment']
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Initial Sync Complete",
        description: "All QuickBooks data has been imported into Batchly!",
      });

      // Reload everything
      await loadConnectionStatus();
      await loadSyncHistory();
    } catch (error: any) {
      console.error('Error during initial sync:', error);
      toast({
        title: "Initial Sync Error",
        description: error.message || "Failed to import QuickBooks data",
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
              {!credentialsConfigured && (
                <Button onClick={() => setShowCredentials(true)} variant="outline" className="w-full sm:w-auto">
                  <Key className="w-4 h-4 mr-2" />
                  Configure Credentials
                </Button>
              )}
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
              ) : connection && (connection as any).has_access_token ? (
                <>
                  <Button 
                    onClick={handleReactivate} 
                    disabled={loading}
                    variant="default"
                    className="w-full sm:w-auto"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {loading ? 'Reactivating...' : 'Reactivate Connection'}
                  </Button>
                  <Button onClick={handleDisconnect} variant="outline" className="w-full sm:w-auto">
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect} className="w-full sm:w-auto" disabled={!credentialsConfigured}>
                  <Zap className="w-4 h-4 mr-2" />
                  Connect to QuickBooks
                </Button>
            )}
          </div>
        </div>
      </div>

      {/* Credentials Configuration */}
      {showCredentials && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="w-5 h-5" />
              QuickBooks API Credentials
            </CardTitle>
            <CardDescription>
              Enter your QuickBooks Online app credentials from the Intuit Developer Portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                type="text"
                placeholder="Enter your QuickBooks Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder="Enter your QuickBooks Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={saveCredentials} 
                disabled={savingCredentials}
              >
                {savingCredentials ? 'Saving...' : 'Save Credentials'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCredentials(false)}
              >
                Cancel
              </Button>
            </div>
            <Alert>
              <AlertDescription>
                Get your credentials from the{' '}
                <a 
                  href="https://developer.intuit.com/app/developer/myapps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Intuit Developer Portal
                  <ExternalLink className="h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

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
