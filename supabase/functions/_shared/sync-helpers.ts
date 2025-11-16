/**
 * Common Sync Helper Functions
 *
 * Utilities for QB sync operations:
 * - Pagination
 * - Batch operations
 * - Data mapping
 * - Progress tracking
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

/**
 * Pagination state for QB API queries
 */
export interface PaginationState {
  startPosition: number;
  maxResults: number;
  totalCount: number;
  hasMore: boolean;
}

/**
 * QB API Query Response wrapper
 */
export interface QBQueryResponse<T> {
  QueryResponse: {
    [key: string]: T[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
  time: string;
}

/**
 * Initialize pagination state
 */
export function initPagination(maxResults: number = 1000): PaginationState {
  return {
    startPosition: 1,
    maxResults,
    totalCount: 0,
    hasMore: true
  };
}

/**
 * Update pagination state based on QB response
 */
export function updatePagination(
  state: PaginationState,
  response: QBQueryResponse<any>
): PaginationState {
  const queryResponse = response.QueryResponse;
  const returnedCount = Object.keys(queryResponse)
    .filter(key => Array.isArray(queryResponse[key]))
    .reduce((count, key) => count + queryResponse[key].length, 0);

  const totalCount = queryResponse.totalCount || returnedCount;
  const maxResults = queryResponse.maxResults || state.maxResults;

  return {
    startPosition: state.startPosition + returnedCount,
    maxResults: state.maxResults,
    totalCount,
    hasMore: state.startPosition + returnedCount < totalCount
  };
}

/**
 * Build QB API query with pagination
 */
export function buildQBQuery(
  entityType: string,
  whereClause: string = '',
  pagination: PaginationState
): string {
  let query = `SELECT * FROM ${entityType}`;

  if (whereClause) {
    query += ` WHERE ${whereClause}`;
  }

  query += ` STARTPOSITION ${pagination.startPosition} MAXRESULTS ${pagination.maxResults}`;

  return query;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * Log sync progress
 */
export function logProgress(
  entityType: string,
  current: number,
  total: number,
  batchSize: number
): void {
  const percentage = calculateProgress(current, total);
  console.log(`[Sync Progress] ${entityType}: ${current}/${total} (${percentage}%) - Batch size: ${batchSize}`);
}

/**
 * Batch upsert records to Supabase
 *
 * @param supabase - Supabase client
 * @param tableName - Table to upsert into
 * @param records - Records to upsert
 * @param conflictColumns - Columns to use for conflict resolution
 * @param batchSize - Size of each batch (default: 500)
 * @returns Number of successfully upserted records
 */
export async function batchUpsert(
  supabase: SupabaseClient,
  tableName: string,
  records: any[],
  conflictColumns: string,
  batchSize: number = 500
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  let successCount = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      const { error, count } = await supabase
        .from(tableName)
        .upsert(batch, {
          onConflict: conflictColumns,
          ignoreDuplicates: false,
          count: 'exact'
        });

      if (error) {
        console.error(`[Batch Upsert] Error in batch ${i / batchSize + 1}:`, error);
        // Continue with next batch instead of failing completely
        continue;
      }

      successCount += count || batch.length;
      console.log(`[Batch Upsert] ${tableName}: Upserted ${batch.length} records (batch ${i / batchSize + 1})`);

    } catch (error: any) {
      console.error(`[Batch Upsert] Exception in batch ${i / batchSize + 1}:`, error.message);
      // Continue with next batch
    }
  }

  return successCount;
}

/**
 * Create lookup maps for efficient foreign key resolution
 *
 * @param supabase - Supabase client
 * @param tableName - Table to query
 * @param qboIds - Array of QB IDs to look up
 * @param selectColumns - Columns to select (default: 'id, qbo_id')
 * @returns Map of qbo_id -> record
 */
export async function createLookupMap<T extends { qbo_id: string; id: string }>(
  supabase: SupabaseClient,
  tableName: string,
  qboIds: string[],
  selectColumns: string = 'id, qbo_id'
): Promise<Map<string, T>> {
  if (qboIds.length === 0) {
    return new Map();
  }

  // Remove duplicates
  const uniqueIds = [...new Set(qboIds)];

  const { data, error } = await supabase
    .from(tableName)
    .select(selectColumns)
    .in('qbo_id', uniqueIds);

  if (error) {
    console.error(`[Lookup Map] Error fetching ${tableName}:`, error);
    return new Map();
  }

  const map = new Map<string, T>();
  data?.forEach((record: T) => {
    map.set(record.qbo_id, record);
  });

  console.log(`[Lookup Map] Created map for ${tableName}: ${map.size} records`);
  return map;
}

/**
 * Extract unique QB IDs from nested data structures
 *
 * @param data - Array of objects
 * @param path - Dot-notation path to QB ID (e.g., 'CustomerRef.value')
 * @returns Array of unique QB IDs
 */
export function extractQBIds(data: any[], path: string): string[] {
  const ids = data
    .map(item => {
      // Navigate nested path (e.g., 'CustomerRef.value')
      const parts = path.split('.');
      let value = item;

      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return null;
        }
      }

      return value;
    })
    .filter(id => id !== null && id !== undefined);

  // Remove duplicates
  return [...new Set(ids)];
}

/**
 * Format QB timestamp to ISO string
 */
export function formatQBTimestamp(qbTimestamp: string | null | undefined): string | null {
  if (!qbTimestamp) return null;

  try {
    return new Date(qbTimestamp).toISOString();
  } catch {
    return null;
  }
}

/**
 * Safe numeric conversion for QB amounts
 */
export function parseQBAmount(value: any): number | null {
  if (value === null || value === undefined) return null;

  const num = parseFloat(value.toString());
  return isNaN(num) ? null : num;
}

/**
 * Safe integer conversion for QB sync tokens
 */
export function parseQBInt(value: any): number | null {
  if (value === null || value === undefined) return null;

  const num = parseInt(value.toString(), 10);
  return isNaN(num) ? null : num;
}

/**
 * Create Supabase client (helper for edge functions)
 */
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get QB API base URL based on environment
 */
export function getQBApiBaseUrl(environment: string): string {
  return environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}
