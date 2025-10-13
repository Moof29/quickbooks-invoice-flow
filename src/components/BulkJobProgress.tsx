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
      const { data, error } = await supabase
        .from('batch_job_queue')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      
      // Calculate progress percentage
      const progressPercentage = data.total_items > 0 
        ? Math.round((data.processed_items / data.total_items) * 100)
        : 0;
      
      return {
        ...data,
        progress_percentage: progressPercentage,
        processed_count: data.processed_items,
        successful_count: data.successful_items,
        failed_count: data.failed_items,
        total_orders: data.total_items,
        error_summary: data.errors,
      };
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
      const { error } = await supabase
        .from('batch_job_queue')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', jobId);
      
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

  const getStatusLabel = () => {
    switch (status.status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      case 'processing':
        return 'Processing';
      default:
        return 'Pending';
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          <span>Bulk Invoice Creation - {getStatusLabel()}</span>
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
            <div className="text-2xl font-bold">{status.processed_count}</div>
            <div className="text-sm text-muted-foreground">Processed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{status.successful_count}</div>
            <div className="text-sm text-muted-foreground">Successful</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{status.failed_count}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Total Orders: {status.total_orders}
        </div>

        {status.status === 'processing' && (
          <Button onClick={handleCancel} variant="destructive" size="sm">
            Cancel Job
          </Button>
        )}

        {status.failed_count > 0 && status.error_summary && (
          <div className="text-sm text-red-600">
            <div className="font-semibold mb-1">Errors:</div>
            <div className="max-h-32 overflow-y-auto">
              {Array.isArray(status.error_summary) && status.error_summary.slice(0, 5).map((err: any, i: number) => (
                <div key={i} className="text-xs mb-1">
                  Order {err.order_id}: {err.error}
                </div>
              ))}
              {Array.isArray(status.error_summary) && status.error_summary.length > 5 && (
                <div className="text-xs mt-1 font-medium">
                  ... and {status.error_summary.length - 5} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {status.status === 'completed' && (
          <div className="text-sm text-green-600 font-medium">
            ✓ All invoices created successfully!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
