import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { Progress } from '@/components/ui/progress';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!profile?.organization_id) return;

    // Initial fetch
    fetchActiveJobs();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchActiveJobs, 2000);

    // Subscribe to realtime changes
    const channel = supabase
      .channel('batch_job_status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_job_queue',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () => {
          fetchActiveJobs();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [profile?.organization_id]);

  const fetchActiveJobs = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('batch_job_queue')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching batch jobs:', error);
      return;
    }

    setActiveJobs(data || []);
    
    // Reset dismissed state if new jobs appear
    if (data && data.length > 0) {
      setDismissed(false);
    }
  };

  if (dismissed || activeJobs.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            {activeJobs.map((job) => {
              const progress = job.total_items > 0 
                ? (job.processed_items / job.total_items) * 100 
                : 0;
              const isProcessing = job.status === 'processing';

              return (
                <div key={job.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    {isProcessing && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <span className="font-medium">
                      {job.job_type === 'invoice_generation' 
                        ? 'Creating Invoices' 
                        : job.job_type}
                    </span>
                    <span className="text-primary-foreground/80">
                      {job.processed_items} / {job.total_items}
                    </span>
                    {job.failed_items > 0 && (
                      <span className="text-red-300">
                        ({job.failed_items} failed)
                      </span>
                    )}
                  </div>
                  <Progress value={progress} className="h-2 bg-primary-foreground/20" />
                </div>
              );
            })}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="shrink-0 hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
