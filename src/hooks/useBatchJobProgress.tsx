import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface BatchJob {
  id: string;
  job_type: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  errors: any;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function useBatchJobProgress(jobId: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["batch-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data, error } = await supabase
        .from("batch_job_queue")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data as BatchJob;
    },
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data as BatchJob | null;
      // Refetch every 500ms while processing for smoother progress updates
      if (job?.status === "processing" || job?.status === "pending") {
        return 500;
      }
      return false;
    },
  });

  // Subscribe to real-time updates for instant progress
  useEffect(() => {
    if (!jobId || !enabled) return;

    const channel = supabase
      .channel(`batch-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'batch_job_queue',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('📊 Real-time job update:', payload.new);
          // Immediately update the cache with new data
          queryClient.setQueryData(["batch-job", jobId], payload.new as BatchJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, enabled, queryClient]);

  // Invalidate related queries when job completes
  useEffect(() => {
    if (job?.status === "completed") {
      // Invalidate sales orders and invoices
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  }, [job?.status, queryClient]);

  const progress = job
    ? {
        percentage: job.total_items > 0 
          ? Math.round((job.processed_items / job.total_items) * 100)
          : 0,
        processed: job.processed_items,
        successful: job.successful_items,
        failed: job.failed_items,
        total: job.total_items,
        isComplete: job.status === "completed",
        isFailed: job.status === "failed",
        isPending: job.status === "pending",
        isProcessing: job.status === "processing",
      }
    : null;

  return { job, progress, isLoading };
}
