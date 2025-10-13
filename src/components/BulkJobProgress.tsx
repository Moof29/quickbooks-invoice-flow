import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BulkJobProgressProps {
  jobId: string;
  onComplete?: () => void;
}

export function BulkJobProgress({ jobId, onComplete }: BulkJobProgressProps) {
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery({
    queryKey: ['bulk-job-status', jobId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_bulk_invoice_job_status', {
        p_job_id: jobId,
      });
      
      if (error) throw error;
      return data?.[0];
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when completed, failed, or cancelled
      if (data?.status && ['completed', 'failed', 'cancelled'].includes(data.status)) {
        if (data.status === 'completed' && onComplete) {
          onComplete();
        }
        return false;
      }
      return 2000; // Poll every 2 seconds while processing
    },
  });

  const handleCancel = async () => {
    try {
      const { error } = await supabase.rpc('cancel_bulk_invoice_job', {
        p_job_id: jobId,
      });
      
      if (error) throw error;
      
      toast({ 
        title: 'Job Cancelled', 
        description: 'Invoice creation stopped' 
      });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  if (isLoading) return <div>Loading job status...</div>;
  if (!status) return <div>Job not found</div>;

  const getStatusIcon = () => {
    switch (status.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          <span>Bulk Invoice Creation</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span>{status.progress_percentage}%</span>
          </div>
          <Progress value={status.progress_percentage} />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{status.processed_items || 0}</div>
            <div className="text-sm text-muted-foreground">Processed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{status.successful_items || 0}</div>
            <div className="text-sm text-muted-foreground">Successful</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{status.failed_items || 0}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <div>Total Orders: {status.total_items}</div>
          {status.actual_duration_seconds && (
            <div>Duration: {formatDuration(status.actual_duration_seconds)}</div>
          )}
        </div>

        {status.status === 'processing' && (
          <Button onClick={handleCancel} variant="destructive" size="sm" className="w-full">
            Cancel Job
          </Button>
        )}

        {status.failed_items > 0 && status.errors && (
          <div className="text-sm">
            <div className="font-semibold mb-2 text-red-600">
              Errors ({status.failed_items}):
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 bg-muted p-2 rounded">
              {Array.isArray(status.errors) && (status.errors as any[]).slice(0, 10).map((err: any, i: number) => (
                <div key={i} className="text-xs font-mono">
                  <span className="text-red-600">Order:</span> {err.order_id?.slice(0, 8)}...
                  <br />
                  <span className="text-muted-foreground">{err.error}</span>
                </div>
              ))}
              {Array.isArray(status.errors) && (status.errors as any[]).length > 10 && (
                <div className="text-xs text-muted-foreground">
                  ... and {(status.errors as any[]).length - 10} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {status.status === 'completed' && status.failed_items === 0 && (
          <div className="text-sm text-green-600 font-medium">
            ✓ All invoices created successfully!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
