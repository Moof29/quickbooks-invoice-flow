import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SyncStatusBadgeProps {
  entityType: string;
  entityId: string;
}

export function SyncStatusBadge({ entityType, entityId }: SyncStatusBadgeProps) {
  const { data: status } = useQuery({
    queryKey: ['qb-sync-status', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_qb_sync_status' as any, {
        p_entity_type: entityType,
        p_entity_id: entityId,
      }) as { data: any; error: any };
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  if (!status) return null;

  const getStatusDisplay = () => {
    if (status.sync_errors) {
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        label: 'Sync Error',
        variant: 'destructive' as const,
        tooltip: status.sync_errors,
      };
    }
    if (status.needs_sync) {
      return {
        icon: <RefreshCw className="h-3 w-3" />,
        label: 'Needs Sync',
        variant: 'secondary' as const,
        tooltip: 'Changes pending sync to QuickBooks',
      };
    }
    if (status.is_synced) {
      return {
        icon: <Cloud className="h-3 w-3" />,
        label: 'Synced',
        variant: 'default' as const,
        tooltip: `Synced ${status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : ''}`,
      };
    }
    return {
      icon: <CloudOff className="h-3 w-3" />,
      label: 'Not Synced',
      variant: 'outline' as const,
      tooltip: 'Not yet synced to QuickBooks',
    };
  };

  const display = getStatusDisplay();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant={display.variant} className="gap-1">
            {display.icon}
            {display.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{display.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
