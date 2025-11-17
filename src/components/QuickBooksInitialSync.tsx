import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Clock, Database } from 'lucide-react';

interface SyncProgress {
  entity_type: string;
  total_processed: number;
  total_expected: number | null;
  status: 'in_progress' | 'completed' | 'failed';
  started_at: string;
}

interface QuickBooksInitialSyncProps {
  organizationId: string;
  onComplete?: () => void;
}

export function QuickBooksInitialSync({ organizationId, onComplete }: QuickBooksInitialSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<Record<string, SyncProgress>>({});
  const [selectedEntities, setSelectedEntities] = useState({
    customer: true,
    item: true,
    invoice: true,
    payment: true
  });
  const [syncResult, setSyncResult] = useState<any>(null);
  const { toast } = useToast();

  const entityLabels = {
    customer: 'Customers',
    item: 'Items',
    invoice: 'Invoices',
    payment: 'Payments'
  };

  const startInitialSync = async () => {
    setSyncing(true);
    setProgress({});
    setSyncResult(null);

    const entityTypes = Object.entries(selectedEntities)
      .filter(([_, selected]) => selected)
      .map(([type, _]) => type);

    if (entityTypes.length === 0) {
      toast({
        title: 'No entities selected',
        description: 'Please select at least one entity type to sync',
        variant: 'destructive'
      });
      setSyncing(false);
      return;
    }

    try {
      // Start the sync
      const { data, error } = await supabase.functions.invoke('qbo-initial-sync', {
        body: {
          organizationId,
          entityTypes,
          batchSize: 50
        }
      });

      if (error) throw error;

      setSyncResult(data);
      
      toast({
        title: 'Initial sync complete!',
        description: `Successfully synced ${data.summary.total_records} records`,
      });

      if (onComplete) onComplete();

    } catch (error: any) {
      console.error('Initial sync error:', error);
      toast({
        title: 'Sync failed',
        description: error.message || 'An error occurred during sync',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      completed: 'default',
      failed: 'destructive',
      in_progress: 'secondary'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const calculateProgress = (processed: number, expected: number | null) => {
    if (!expected) return 0;
    return Math.round((processed / expected) * 100);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Initial QuickBooks Sync
        </CardTitle>
        <CardDescription>
          Import your existing QuickBooks data into Batchly. This is a one-time operation 
          that can take 10-60 minutes depending on data volume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Before you start</AlertTitle>
          <AlertDescription className="text-sm space-y-2">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Ensure stable internet connection</li>
              <li>Keep this browser tab open during sync</li>
              <li>Large datasets (5000+ invoices) may take 1-2 hours</li>
              <li>Sync is resumable if interrupted</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="font-medium">Select entities to sync:</div>
          <div className="grid gap-3">
            {Object.entries(entityLabels).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={selectedEntities[key as keyof typeof selectedEntities]}
                  onCheckedChange={(checked) =>
                    setSelectedEntities(prev => ({ ...prev, [key]: checked === true }))
                  }
                  disabled={syncing}
                />
                <label
                  htmlFor={key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={startInitialSync}
          disabled={syncing}
          className="w-full"
        >
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            'Start Initial Sync'
          )}
        </Button>

        {Object.keys(progress).length > 0 && (
          <div className="space-y-4">
            <div className="font-medium">Sync Progress</div>
            {Object.entries(progress).map(([entityType, prog]) => (
              <div key={entityType} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(prog.status)}
                    <span className="font-medium">{entityLabels[entityType as keyof typeof entityLabels]}</span>
                  </div>
                  {getStatusBadge(prog.status)}
                </div>
                {prog.total_expected && (
                  <>
                    <Progress value={calculateProgress(prog.total_processed, prog.total_expected)} />
                    <div className="text-sm text-muted-foreground">
                      {prog.total_processed} / {prog.total_expected} records
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {syncResult && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>Sync Complete</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                <div className="font-medium">Summary:</div>
                <ul className="text-sm space-y-1">
                  {syncResult.results.map((result: any) => (
                    <li key={result.entity_type}>
                      {entityLabels[result.entity_type as keyof typeof entityLabels]}: 
                      <span className="font-medium ml-2">{result.pulled || 0}</span> synced
                      {result.status === 'failed' && (
                        <span className="text-red-600 ml-2">({result.error})</span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="text-sm font-medium mt-3">
                  Total Records: {syncResult.summary.total_records}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
