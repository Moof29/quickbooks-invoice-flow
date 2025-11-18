import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.5/+esm";

interface SyncSession {
  id: string;
  organization_id: string;
  entity_type: string;
  sync_type: "pull" | "push";
  status: "in_progress" | "completed" | "failed";
  total_expected?: number;
  total_processed: number;
  current_offset: number;
  batch_size: number;
  started_at: string;
  completed_at?: string;
  last_chunk_at: string;
  error_message?: string;
  sync_mode: "full" | "delta" | "historical";
  metadata?: Record<string, any>;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function createSyncSession(
  organizationId: string,
  entityType: string,
  syncType: "pull" | "push",
  batchSize: number = 100,
  syncMode: "full" | "delta" | "historical" = "full"
): Promise<SyncSession> {
  const { data, error } = await supabase
    .from("qbo_sync_sessions")
    .insert({
      organization_id: organizationId,
      entity_type: entityType,
      sync_type: syncType,
      batch_size: batchSize,
      sync_mode: syncMode,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSyncSession(
  sessionId: string
): Promise<SyncSession | null> {
  const { data, error } = await supabase
    .from("qbo_sync_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) return null;
  return data;
}

export async function updateSyncSession(
  sessionId: string,
  updates: Partial<SyncSession>
): Promise<void> {
  const { error } = await supabase
    .from("qbo_sync_sessions")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function completeSyncSession(
  sessionId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await updateSyncSession(sessionId, {
    status: success ? "completed" : "failed",
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
  });
}

export async function getActiveSession(
  organizationId: string,
  entityType: string,
  syncType: "pull" | "push"
): Promise<SyncSession | null> {
  const { data, error } = await supabase
    .from("qbo_sync_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("entity_type", entityType)
    .eq("sync_type", syncType)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching active session:", error);
    return null;
  }

  return data;
}
