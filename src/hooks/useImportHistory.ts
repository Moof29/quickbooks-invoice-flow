import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthProfile } from './useAuthProfile';

export interface ImportHistoryRecord {
  id: string;
  file_name: string;
  data_type: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: any;
  error_file_path: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Hook to fetch import history for the current organization
 * @param limit - Maximum number of records to fetch (default: 50)
 */
export function useImportHistory(limit: number = 50) {
  const { profile } = useAuthProfile();

  return useQuery({
    queryKey: ['import-history', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('csv_import_progress')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as ImportHistoryRecord[];
    },
    enabled: !!profile?.organization_id,
  });
}

/**
 * Downloads an error report as CSV for a failed import
 * @param importId - The ID of the import record
 * @param fileName - Original file name for naming the error report
 */
export async function downloadErrorReport(importId: string, fileName: string) {
  const { data, error } = await supabase
    .from('csv_import_progress')
    .select('errors')
    .eq('id', importId)
    .single();

  if (error) throw error;

  // Type guard to ensure errors is an array
  const errors = Array.isArray(data.errors) ? data.errors : [];

  if (errors.length === 0) {
    throw new Error('No errors found for this import');
  }

  // Convert errors to CSV
  const csvContent = [
    'Row Number,Error Message',
    ...errors.map((err: any) => `${err.row},"${err.error.replace(/"/g, '""')}"`)
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}_errors.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
}
