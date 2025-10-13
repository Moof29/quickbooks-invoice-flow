import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuthProfile } from '@/hooks/useAuthProfile';

interface BatchJob {
  id: string;
  job_type: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  errors: any; // JSONB field from database
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  can_cancel: boolean;
}

export function BatchJobStatusBar() {
  const [activeJobs, setActiveJobs] = useState<BatchJob[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const { profile } = useAuthProfile();
  const { toast } = useToast();
  const completedJobsRef = useRef<Set<string>>(new Set());

  const fetchActiveJobs = useCallback(async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('batch_job_queue')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setActiveJobs(data);
    }
  }, [profile?.organization_id]);

  const handleCancelJob = async (jobId: string) => {
    try {
      const { error } = await supabase.rpc('cancel_batch_job', {
        p_job_id: jobId,
        p_cancelled_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;

      toast({
        title: 'Job Cancelled',
        description: 'The batch job has been cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleErrorExpansion = (jobId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!profile?.organization_id) return;

    fetchActiveJobs();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('batch-jobs-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_job_queue',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedJob = payload.new as BatchJob;
            
            // If job completed and not already notified
            if (updatedJob.status === 'completed' && !completedJobsRef.current.has(updatedJob.id)) {
              completedJobsRef.current.add(updatedJob.id);
              toast({
                title: 'Batch Job Completed',
                description: `${updatedJob.successful_items} of ${updatedJob.total_items} invoices created successfully`,
              });
            }

            setActiveJobs(prev => {
              if (updatedJob.status === 'completed' || updatedJob.status === 'failed' || updatedJob.status === 'cancelled') {
                return prev.filter(j => j.id !== updatedJob.id);
              }
              
              const existingIndex = prev.findIndex(j => j.id === updatedJob.id);
              if (existingIndex >= 0) {
                const newJobs = [...prev];
                newJobs[existingIndex] = updatedJob;
                return newJobs;
              }
              return [...prev, updatedJob];
            });
          } else if (payload.eventType === 'INSERT') {
            const newJob = payload.new as BatchJob;
            if (newJob.status === 'pending' || newJob.status === 'processing') {
              setActiveJobs(prev => [...prev, newJob]);
            }
          }
        }
      )
      .subscribe();

    // Fallback polling every 5 seconds in case realtime fails
    const pollInterval = setInterval(fetchActiveJobs, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [profile?.organization_id, toast, fetchActiveJobs]);

  const handleDismiss = async (jobId: string) => {
    try {
      // Cancel the job in the database so it doesn't reappear
      const { error } = await supabase
        .from('batch_job_queue')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', jobId);

      if (error) throw error;

      // Remove from local state
      setActiveJobs(prev => prev.filter(j => j.id !== jobId));
      
      toast({
        title: 'Job Dismissed',
        description: 'The batch job has been cancelled',
      });
    } catch (error: any) {
      console.error('Error dismissing job:', error);
      // Still remove from UI even if database update fails
      setActiveJobs(prev => prev.filter(j => j.id !== jobId));
    }
  };

  const getJobTitle = (jobType: string) => {
    switch (jobType) {
      case 'bulk_invoice_generation':
      case 'invoice_generation':
        return 'Creating Invoices';
      default:
        return 'Processing Batch';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
    }
  };

  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {activeJobs.map((job) => (
        <Card key={job.id} className="border-0 shadow-lg animate-in slide-in-from-right-5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(job.status)}
                <div>
                  <p className="font-semibold text-sm">{getJobTitle(job.job_type)}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.status === 'pending' ? 'Queued' : 'Processing'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDismiss(job.id)}
                className="h-6 w-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {job.status === 'processing' ? (
              <>
                <Progress 
                  value={(job.processed_items / job.total_items) * 100} 
                  className="h-2 mb-2"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    {job.processed_items} / {job.total_items} processed
                  </span>
                  <span className="font-medium">
                    {Math.round((job.processed_items / job.total_items) * 100)}%
                  </span>
                </div>
                
                {job.failed_items > 0 && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="destructive" className="text-xs">
                        {job.failed_items} Failed
                      </Badge>
                      {job.errors && job.errors.length > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => toggleErrorExpansion(job.id)}
                        >
                          {expandedErrors.has(job.id) ? 'Hide errors' : 'Show errors'}
                        </Button>
                      )}
                    </div>
                    
                    {expandedErrors.has(job.id) && job.errors && (
                      <div className="space-y-1 mt-2">
                        {job.errors.slice(0, 5).map((err, idx) => (
                          <div key={idx} className="text-xs text-destructive flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="break-words">
                              <span className="font-mono">{err.order_id.slice(0, 8)}</span>: {err.message}
                            </span>
                          </div>
                        ))}
                        {job.errors.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            + {job.errors.length - 5} more errors
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {job.can_cancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelJob(job.id)}
                      className="text-xs h-7"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Waiting to start... ({job.total_items} items)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
