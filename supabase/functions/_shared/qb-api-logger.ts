import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

interface ApiLogData {
  organization_id: string;
  endpoint: string;
  method: string;
  request_headers?: Record<string, string>;
  request_body?: any;
  response_status?: number;
  response_headers?: Record<string, string>;
  response_body?: any;
  duration_ms: number;
  error_message?: string;
}

async function logApiCall(data: ApiLogData): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { error } = await supabase.from("qbo_api_log").insert(data);
    if (error) {
      console.error("Failed to log API call:", error);
    }
  } catch (error) {
    console.error("Failed to log API call:", error);
  }
}

export async function qbApiCall(
  organizationId: string,
  method: string,
  endpoint: string,
  accessToken: string,
  body?: any
): Promise<Response> {
  const startTime = Date.now();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    let responseBody: any = null;

    try {
      responseBody = await response.clone().json();
    } catch {
      try {
        responseBody = await response.clone().text();
      } catch {
        responseBody = null;
      }
    }

    logApiCall({
      organization_id: organizationId,
      endpoint,
      method,
      request_headers: { ...headers, Authorization: "Bearer [REDACTED]" },
      request_body: body,
      response_status: response.status,
      response_headers: Object.fromEntries(response.headers),
      response_body: responseBody,
      duration_ms: duration,
    });

    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logApiCall({
      organization_id: organizationId,
      endpoint,
      method,
      request_headers: { ...headers, Authorization: "Bearer [REDACTED]" },
      request_body: body,
      response_status: 0,
      duration_ms: duration,
      error_message: error.message,
    });

    throw error;
  }
}
