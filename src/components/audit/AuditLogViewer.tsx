import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface AuditLogViewerProps {
  entityType: string;
  entityId: string;
}

export function AuditLogViewer({ entityType, entityId }: AuditLogViewerProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log_entries')
        .select('*')
        .eq('table_name', entityType)
        .eq('record_id', entityId)
        .order('change_timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading audit trail...</div>;
  if (!logs || logs.length === 0) return <div>No audit history available</div>;

  const getActionBadge = (operation: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      INSERT: 'default',
      UPDATE: 'secondary',
      DELETE: 'destructive',
    };
    return <Badge variant={variants[operation] || 'default'}>{operation}</Badge>;
  };

  const getChangedFields = (beforeData: any, afterData: any) => {
    if (!beforeData || !afterData) return [];
    
    const changed: string[] = [];
    Object.keys(afterData).forEach((key) => {
      if (beforeData[key] !== afterData[key]) {
        changed.push(key);
      }
    });
    return changed;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => {
            const changedFields = log.operation === 'UPDATE' 
              ? getChangedFields(log.before_data, log.after_data)
              : [];

            return (
              <div key={log.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getActionBadge(log.operation)}
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(log.change_timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Changed by: {log.changed_by || 'System'}
                  </p>
                  {changedFields.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Changed: {changedFields.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
