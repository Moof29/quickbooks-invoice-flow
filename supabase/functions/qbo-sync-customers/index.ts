import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import {
  createSyncSession,
  getSyncSession,
  updateSyncSession,
  completeSyncSession,
} from "../_shared/sync-session.ts";
import { qbApiCall } from "../_shared/qb-api-logger.ts";
import QBRateLimiter from "../_shared/qb-rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;
const MAX_EXECUTION_TIME = 120000;

interface SyncRequest {
  organizationId: string;
  sessionId?: string;
  offset?: number;
  direction?: "push" | "pull" | "both";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const {
      organizationId,
      sessionId,
      offset = 0,
      direction = "pull",
    }: SyncRequest = await req.json();

    let session;
    if (sessionId) {
      session = await getSyncSession(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      session = await createSyncSession(
        organizationId,
        "customer",
        direction === "push" ? "push" : "pull",
        BATCH_SIZE
      );
    }

    const { data: connections, error: connectionError } = await supabase.rpc(
      "get_qbo_connection_for_sync",
      { p_organization_id: organizationId }
    );

    if (connectionError || !connections || connections.length === 0) {
      await completeSyncSession(
        session.id,
        false,
        "Active QuickBooks connection not found"
      );
      throw new Error("Active QuickBooks connection not found");
    }

    const connection = connections[0];
    await refreshTokenIfNeeded(supabase, connection);

    let syncResults = { processed: 0, isComplete: false, nextOffset: offset };

    if (direction === "pull" || direction === "both") {
      syncResults = await pullCustomersFromQB(
        supabase,
        connection,
        session,
        offset,
        startTime
      );
    }

    const isComplete = syncResults.isComplete;

    await updateSyncSession(session.id, {
      total_processed: session.total_processed + syncResults.processed,
      current_offset: syncResults.nextOffset,
      status: isComplete ? "completed" : "in_progress",
      last_chunk_at: new Date().toISOString(),
      completed_at: isComplete ? new Date().toISOString() : undefined,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        processed: syncResults.processed,
        currentOffset: syncResults.nextOffset,
        isComplete,
        nextOffset: isComplete ? null : syncResults.nextOffset,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in qbo-sync-customers:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

async function refreshTokenIfNeeded(supabase: any, connection: any) {
  const expiresAt = new Date(connection.qbo_token_expires_at);
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  if (expiresAt <= oneHourFromNow) {
    console.log("Token expires soon, refreshing...");

    const { error: refreshError } = await supabase.functions.invoke(
      "qbo-token-refresh",
      {
        body: { organizationId: connection.organization_id },
      }
    );

    if (refreshError) {
      throw new Error(`Failed to refresh token: ${refreshError.message}`);
    }

    const { data: updatedConnection } = await supabase
      .from("qbo_connection")
      .select("*")
      .eq("organization_id", connection.organization_id)
      .eq("is_active", true)
      .single();

    if (updatedConnection) {
      connection.qbo_access_token = updatedConnection.qbo_access_token;
      connection.qbo_token_expires_at = updatedConnection.qbo_token_expires_at;
    }
  }
}

async function pullCustomersFromQB(
  supabase: any,
  connection: any,
  session: any,
  offset: number,
  startTime: number
): Promise<{ processed: number; isComplete: boolean; nextOffset: number }> {
  console.log(
    `Pulling customers from QuickBooks (offset: ${offset}, batch: ${BATCH_SIZE})`
  );

  const baseUrl =
    connection.environment === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks-api.intuit.com";
  const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/query`;
  const query = `SELECT * FROM Customer STARTPOSITION ${offset + 1} MAXRESULTS ${BATCH_SIZE}`;

  await QBRateLimiter.checkLimit(connection.organization_id);

  const response = await qbApiCall(
    connection.organization_id,
    "GET",
    `${qbApiUrl}?query=${encodeURIComponent(query)}`,
    connection.qbo_access_token
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const customers = data.QueryResponse?.Customer || [];
  const totalCount = data.QueryResponse?.totalCount || customers.length;

  if (offset === 0 && session.total_expected === null) {
    await updateSyncSession(session.id, { total_expected: totalCount });
  }

  let processed = 0;
  for (const customer of customers) {
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      console.log(`Timeout approaching, stopping at ${processed} records`);
      break;
    }

    await processCustomer(supabase, customer, connection.organization_id);
    processed++;
  }

  const newOffset = offset + processed;
  const isComplete = newOffset >= totalCount;

  console.log(
    `Processed ${processed} customers, total: ${newOffset}/${totalCount}`
  );

  return { processed, isComplete, nextOffset: newOffset };
}

async function processCustomer(
  supabase: any,
  qbCustomer: any,
  organizationId: string
): Promise<void> {
  const customerData = {
    organization_id: organizationId,
    qbo_id: qbCustomer.Id.toString(),
    display_name: qbCustomer.DisplayName,
    company_name: qbCustomer.CompanyName,
    first_name: qbCustomer.GivenName,
    last_name: qbCustomer.FamilyName,
    email: qbCustomer.PrimaryEmailAddr?.Address,
    phone: qbCustomer.PrimaryPhone?.FreeFormNumber,
    address_line1: qbCustomer.BillAddr?.Line1,
    address_line2: qbCustomer.BillAddr?.Line2,
    city: qbCustomer.BillAddr?.City,
    state: qbCustomer.BillAddr?.CountrySubDivisionCode,
    postal_code: qbCustomer.BillAddr?.PostalCode,
    country: qbCustomer.BillAddr?.Country,
    is_active: qbCustomer.Active !== false,
    qbo_sync_token: qbCustomer.SyncToken
      ? parseInt(qbCustomer.SyncToken)
      : null,
    last_sync_at: new Date().toISOString(),
    qbo_created_at: qbCustomer.MetaData?.CreateTime,
    qbo_updated_at: qbCustomer.MetaData?.LastUpdatedTime,
  };

  const { error } = await supabase
    .from("customer_profile")
    .upsert(customerData, {
      onConflict: "organization_id,qbo_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error(`Failed to save customer ${qbCustomer.Id}:`, error);
  }
}

serve(handler);
