import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Activity, Users, Lock, Eye, Database, Key } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SecurityAuditLog {
  id: string;
  accessed_table: string;
  access_type: string;
  ip_address: string | null;
  timestamp: string;
  sensitive_data_accessed: boolean;
  user_id?: string;
}

interface SecurityMetrics {
  totalSecurityEvents: number;
  sensitiveDataAccesses: number;
  failedAuthAttempts: number;
  adminActions: number;
  recentEvents: SecurityAuditLog[];
}

export function SecurityDashboard() {
  const { organization, profile, isAdmin } = useAuthProfile();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization && isAdmin) {
      loadSecurityMetrics();
    }
  }, [organization, isAdmin]);

  const loadSecurityMetrics = async () => {
    if (!organization) return;

    try {
      // Get security audit logs for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: auditLogs } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('timestamp', thirtyDaysAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);

      if (auditLogs) {
        const sensitiveAccesses = auditLogs.filter(log => log.sensitive_data_accessed);
        const failedAuth = auditLogs.filter(log => log.access_type === 'FAILED_AUTH');
        const adminActions = auditLogs.filter(log => log.access_type.includes('ADMIN'));

        setMetrics({
          totalSecurityEvents: auditLogs.length,
          sensitiveDataAccesses: sensitiveAccesses.length,
          failedAuthAttempts: failedAuth.length,
          adminActions: adminActions.length,
          recentEvents: auditLogs.slice(0, 20) as SecurityAuditLog[]
        });
      }
    } catch (error) {
      console.error('Error loading security metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You need admin privileges to view the security dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="h-8 bg-muted/40 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted/40 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEventIcon = (accessType: string) => {
    if (accessType.includes('FAILED') || accessType.includes('ERROR')) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (accessType.includes('ADMIN')) {
      return <Shield className="h-4 w-4 text-blue-500" />;
    }
    if (accessType.includes('AUTH')) {
      return <Key className="h-4 w-4 text-green-500" />;
    }
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const getEventBadgeVariant = (accessType: string) => {
    if (accessType.includes('FAILED') || accessType.includes('ERROR')) return 'destructive';
    if (accessType.includes('ADMIN')) return 'default';
    if (accessType.includes('SUCCESS')) return 'default';
    return 'secondary';
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor security events and access patterns for your organization
        </p>
      </div>

      {/* Security Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSecurityEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sensitive Data Access</CardTitle>
            <Eye className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.sensitiveDataAccesses || 0}</div>
            <p className="text-xs text-muted-foreground">OAuth tokens, PII</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Auth</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.failedAuthAttempts || 0}</div>
            <p className="text-xs text-muted-foreground">Authentication failures</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Actions</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.adminActions || 0}</div>
            <p className="text-xs text-muted-foreground">Privileged operations</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted mb-6">
          <TabsTrigger value="events" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
            Recent Events
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Latest security-related activities in your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.recentEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No security events recorded yet</p>
                  </div>
                ) : (
                  metrics?.recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getEventIcon(event.access_type)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{event.accessed_table}</p>
                            <Badge variant={getEventBadgeVariant(event.access_type)}>
                              {event.access_type}
                            </Badge>
                            {event.sensitive_data_accessed && (
                              <Badge variant="outline" className="text-amber-600 border-amber-600">
                                Sensitive
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            IP: {event.ip_address || 'Unknown'} • {formatTimestamp(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-5 w-5" />
                  <span>Security Recommendations</span>
                </CardTitle>
                <CardDescription>
                  Actions to improve your organization's security posture
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Enable Leaked Password Protection:</strong> Enable this in your Supabase Auth settings to prevent users from using compromised passwords.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Configure OTP Expiry:</strong> Consider reducing OTP expiry time to 5 minutes or less in your Supabase Auth settings.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Upgrade PostgreSQL:</strong> Update your PostgreSQL version in Supabase to get the latest security patches.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Regular Access Reviews:</strong> Regularly review user roles and permissions, especially for admin users.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}