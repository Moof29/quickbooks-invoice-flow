import { useBatchJobProgress } from "@/hooks/useBatchJobProgress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BatchJobProgressDialogProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function BatchJobProgressDialog({
  jobId,
  open,
  onOpenChange,
  title = "Processing Batch Job",
  description = "Please wait while we process your request...",
}: BatchJobProgressDialogProps) {
  const { job, progress } = useBatchJobProgress(jobId, open);

  const canClose = progress?.isComplete || progress?.isFailed || !job;

  const handleClose = () => {
    // Allow closing when complete, failed, or if there's no job data
    if (canClose) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => {
        // Prevent closing by clicking outside while processing
        if (!canClose) {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {progress?.isProcessing && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            )}
            {progress?.isComplete && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {progress?.isFailed && <XCircle className="h-5 w-5 text-red-500" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          {progress && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progress.percentage}%</span>
                </div>
                <Progress value={progress.percentage} className="h-2" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="text-2xl font-bold">{progress.processed}</div>
                  <div className="text-xs text-muted-foreground">Processed</div>
                </div>
                <div className="rounded-lg border bg-green-50 p-3 dark:bg-green-950">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {progress.successful}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    Successful
                  </div>
                </div>
                <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-950">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {progress.failed}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">Failed</div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-center gap-2">
                {progress.isPending && (
                  <div className="text-center space-y-2">
                    <Badge variant="outline" className="gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Starting...
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Initializing batch processor...
                    </p>
                  </div>
                )}
                {progress.isProcessing && (
                  <Badge variant="outline" className="gap-1 bg-blue-50 dark:bg-blue-950">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing in chunks of 50...
                  </Badge>
                )}
                {progress.isComplete && (
                  <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                  </Badge>
                )}
                {progress.isFailed && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Failed
                  </Badge>
                )}
              </div>

              {/* Errors */}
              {progress.failed > 0 && job?.errors && Array.isArray(job.errors) && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <div className="font-medium text-red-900 dark:text-red-100 mb-1">
                        {progress.failed} item(s) failed
                      </div>
                      <div className="space-y-1 text-red-700 dark:text-red-300">
                        {job.errors.slice(0, 3).map((error: any, idx: number) => (
                          <div key={idx} className="text-xs">
                            {error.error?.message || error.message || "Unknown error"}
                          </div>
                        ))}
                        {job.errors.length > 3 && (
                          <div className="text-xs italic">
                            ...and {job.errors.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant={canClose ? "default" : "outline"}
            disabled={!canClose}
          >
            {canClose ? "Close" : "Processing..."}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
