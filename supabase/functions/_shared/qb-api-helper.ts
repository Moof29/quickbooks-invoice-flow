/**
 * QuickBooks API Helper with Retry Logic
 *
 * Provides retry logic with exponential backoff for QB API calls.
 * Retries on: 429 (rate limit), 500, 502, 503, 504, network errors
 * No retry on: 400, 401, 403, 404 (client errors)
 *
 * Usage:
 *   const response = await retryableQBApiCall(
 *     () => fetch(qbApiUrl, options),
 *     { maxRetries: 3 }
 *   );
 */

interface RetryConfig {
  maxRetries: number;      // Default: 3
  baseDelay: number;       // Default: 1000ms
  maxDelay: number;        // Default: 10000ms
  exponentialBase: number; // Default: 2
  jitter: boolean;         // Default: true
}

interface RetryableError extends Error {
  status?: number;
  response?: Response;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBase: 2,
  jitter: true
};

/**
 * Determine if error is retryable
 */
function isRetryableError(error: RetryableError): boolean {
  // Network errors (no status code)
  if (!error.status) {
    return true;
  }

  // Retry on rate limit and server errors
  const retryableStatuses = [429, 500, 502, 503, 504];
  return retryableStatuses.includes(error.status);
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(config.exponentialBase, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  if (config.jitter) {
    // Add jitter: delay * (0.8 + random(0.4))
    // This spreads out retry attempts to avoid thundering herd
    const jitterFactor = 0.8 + Math.random() * 0.4;
    return Math.floor(cappedDelay * jitterFactor);
  }

  return cappedDelay;
}

/**
 * Make a retryable QB API call with exponential backoff
 *
 * @param apiFn - Function that returns a Promise<Response>
 * @param config - Retry configuration
 * @returns The successful Response
 * @throws Error if all retries exhausted or non-retryable error
 */
export async function retryableQBApiCall(
  apiFn: () => Promise<Response>,
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const finalConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };

  let lastError: RetryableError | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const response = await apiFn();

      // Check if response indicates an error
      if (!response.ok) {
        const error: RetryableError = new Error(`QB API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = response;

        // Don't retry client errors (400, 401, 403, 404)
        if (!isRetryableError(error)) {
          console.error(`[QB API] Non-retryable error (${error.status}):`, error.message);
          throw error;
        }

        lastError = error;

        // If we've exhausted retries, throw
        if (attempt === finalConfig.maxRetries) {
          console.error(`[QB API] Max retries (${finalConfig.maxRetries}) exhausted for status ${error.status}`);
          throw error;
        }

        // Calculate delay for retry
        const delay = calculateDelay(attempt, finalConfig);
        console.log(`[QB API] Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${delay}ms (status: ${error.status})`);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Success!
      if (attempt > 0) {
        console.log(`[QB API] Request succeeded after ${attempt} retries`);
      }

      return response;

    } catch (error: any) {
      // Network error or fetch failure
      lastError = error as RetryableError;

      // If we've exhausted retries, throw
      if (attempt === finalConfig.maxRetries) {
        console.error(`[QB API] Max retries (${finalConfig.maxRetries}) exhausted:`, error.message);
        throw error;
      }

      // Calculate delay for retry
      const delay = calculateDelay(attempt, finalConfig);
      console.log(`[QB API] Network error, retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${delay}ms:`, error.message);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Unexpected error in retryableQBApiCall');
}

/**
 * Wrapper for QB API calls with rate limiting + retry logic
 *
 * @param organizationId - Organization ID for rate limiting
 * @param url - QB API URL
 * @param options - Fetch options
 * @param retryConfig - Optional retry configuration
 * @returns The successful Response
 */
export async function qbApiCallWithRetry(
  organizationId: string,
  url: string,
  options: RequestInit,
  retryConfig?: Partial<RetryConfig>
): Promise<Response> {
  // This will be imported in sync functions
  // For now, just use retryableQBApiCall
  return retryableQBApiCall(() => fetch(url, options), retryConfig);
}

/**
 * Parse QB error response body
 */
export async function parseQBError(response: Response): Promise<string> {
  try {
    const text = await response.text();

    // Try to parse as JSON
    try {
      const json = JSON.parse(text);

      // QB error format: { Fault: { Error: [{ Message, Detail, code }] } }
      if (json.Fault && json.Fault.Error && json.Fault.Error[0]) {
        const error = json.Fault.Error[0];
        return `${error.Message} (${error.code})${error.Detail ? ': ' + error.Detail : ''}`;
      }

      return text;
    } catch {
      // Not JSON, return text
      return text;
    }
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}
