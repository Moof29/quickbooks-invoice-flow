import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { Progress } from '@/components/ui/progress';
import { X, CheckCircle2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface BatchJob {
  id: string;
  job_type: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  created_at: string;
}

export function BatchJobStatusBar() {
  const { profile } = useAuthProfile();
  const [activeJobs, setActiveJobs] = useState<BatchJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (!profile?.organization_id) return;

    // Initial fetch
    fetchActiveJobs();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('batch_job_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_job_queue',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        (payload) => {
          console.log('Batch job update:', payload);
          fetchActiveJobs();
          
          // Show toast when job completes
          if (payload.eventType === 'UPDATE' && 
              payload.new.status === 'completed' && 
              !completedJobs.has(payload.new.id)) {
            setCompletedJobs(prev => new Set(prev).add(payload.new.id));
            toast({
              title: "Batch Job Complete",
              description: `Successfully processed ${payload.new.successful_items} of ${payload.new.total_items} items`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.organization_id, completedJobs, toast]);

  const fetchActiveJobs = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('batch_job_queue')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Error fetching batch jobs:', error);
      return;
    }

    setActiveJobs(data || []);
  };

  const handleDismiss = (jobId: string) => {
    setActiveJobs(prev => prev.filter(j => j.id !== jobId));
  };

  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {activeJobs.map((job) => {
        const progress = job.total_items > 0 
          ? (job.processed_items / job.total_items) * 100 
          : 0;
        const isProcessing = job.status === 'processing';
        const isPending = job.status === 'pending';

        return (
          <Card 
            key={job.id} 
            className="border-0 shadow-lg animate-in slide-in-from-right-5"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {isProcessing ? (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {job.job_type === 'invoice_generation' 
                          ? 'Creating Invoices' 
                          : job.job_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isPending ? 'Waiting to start...' : 
                         `${job.processed_items} of ${job.total_items} processed`}
                      </p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 -mt-1"
                      onClick={() => handleDismiss(job.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {isProcessing && (
                    <>
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                        <span>{Math.round(progress)}%</span>
                        {job.failed_items > 0 && (
                          <span className="text-destructive">
                            {job.failed_items} failed
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  
                  {isPending && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/30 animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
