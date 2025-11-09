import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { useImportHistory, downloadErrorReport } from '@/hooks/useImportHistory';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ImportHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportHistoryDialog({ open, onOpenChange }: ImportHistoryDialogProps) {
  const { data: history, isLoading } = useImportHistory();
  const { toast } = useToast();

  const handleDownloadErrors = async (importId: string, fileName: string) => {
    try {
      await downloadErrorReport(importId, fileName);
      toast({
        title: 'Download Started',
        description: 'Error report is being downloaded',
      });
    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      completed: { variant: 'default', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
      processing: { variant: 'secondary', icon: Loader2 },
      uploading: { variant: 'secondary', icon: Clock },
      cancelled: { variant: 'outline', icon: XCircle },
    };

    const config = variants[status] || variants.processing;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import History</DialogTitle>
          <DialogDescription>
            View past CSV imports and download error reports
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : history && history.length > 0 ? (
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {record.file_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.data_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">{record.total_rows}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {record.successful_rows}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {record.failed_rows}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.failed_rows > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadErrors(record.id, record.file_name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No import history</p>
            <p className="text-sm text-muted-foreground">
              Your CSV import history will appear here
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
