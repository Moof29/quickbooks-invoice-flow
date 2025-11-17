# Lovable QuickBooks Integration Analysis – Copyable Reality Check

Use this summary to compare Lovable's report with the current code and to keep follow-up work focused.

## What Lovable got right
1) **Future-dated migration blocks OAuth** – The OAuth state migration (`20251120000000_add_qbo_oauth_state_table.sql`) is timestamped in the future, so Supabase will skip it until it is renamed or re-run. 【F:supabase/migrations/20251120000000_add_qbo_oauth_state_table.sql†L1-L30】
2) **OAuth initiate requires `qbo_oauth_state`** – The initiate function cleans up expired states and inserts a new state token before generating the QuickBooks auth URL; without the table, OAuth cannot start. 【F:supabase/functions/qbo-oauth-initiate/index.ts†L58-L106】

## Where the report is off
1) **Expired tokens already refresh** – Customer sync refreshes when a token expires within an hour (including already expired tokens) and reloads the connection afterward. Expired tokens are not skipped. 【F:supabase/functions/qbo-sync-customers/index.ts†L123-L169】
2) **Refresh endpoint handles expired tokens** – The token-refresh function only short-circuits when a token remains valid for more than ten minutes; expired tokens proceed to refresh. 【F:supabase/functions/qbo-token-refresh/index.ts†L40-L120】
3) **Connection reload already implemented** – After token refresh, sync functions reload the connection from the database to get fresh tokens. 【F:supabase/functions/qbo-sync-customers/index.ts†L158-L169】

## Quick fixes to apply
1) **Rename and run the migration** – Give the migration a past timestamp so Supabase will create `qbo_oauth_state` and unblock OAuth.
   - Current: `20251120000000_add_qbo_oauth_state_table.sql` (Nov 20, 2025 - future)
   - Change to: `20251117120000_add_qbo_oauth_state_table.sql` (Nov 17, 2025 - today)
2) **Standardize refresh thresholds** – Align the one-hour sync helper check with the ten-minute refresh helper guard to avoid confusion across callers.
   - Change `qbo-token-refresh/index.ts:45` from 10 minutes to 1 hour threshold

## Hardening (high-value follow-ups)
1) **Refresh contention guard** – Use a distributed lock (e.g., `pg_advisory_lock`) to prevent parallel refresh attempts when multiple syncs fire.
2) **Retry on auth failures** – Catch 401/403 responses, refresh the token, and retry the QuickBooks request once before failing.
3) **Proactive token health** – Schedule checks for refresh-token expiry and warn users before a connection is marked inactive.
4) **Session-level sync locks** – Use `qbo_sync_sessions` (or similar) to prevent duplicate syncs for the same resource when triggers overlap.

## What NOT to do (from Lovable's report)
1) ❌ **Lovable Phase 2** – "Fix token refresh for expired tokens"
   - **Why skip:** Already works correctly. Tokens expiring within 1 hour (including already-expired) trigger refresh.
   - **Evidence:** `qbo-sync-customers/index.ts:141` checks `if (expiresAt <= oneHourFromNow)` which includes past dates.
2) ❌ **Lovable Phase 3** – "Reload connection after refresh"
   - **Why skip:** Already implemented at lines 158-169 of sync functions.
   - **Evidence:** Code fetches fresh tokens from `qbo_connection` table after refresh completes.
3) ❌ **Lovable Phase 6** – "Add OAuth state validation"
   - **Why skip:** Already exists in callback function with full CSRF protection.
   - **Evidence:** `qbo-oauth-callback/index.ts:108-126` validates state token, checks expiry, prevents reuse.

## Verification steps after quick fixes
After implementing the quick fixes, verify:
- [ ] OAuth flow completes without "table not found" error
- [ ] State token is saved to `qbo_oauth_state` table during OAuth initiate
- [ ] Callback successfully validates state and marks it as consumed
- [ ] Expired token triggers refresh before sync (check logs for "Token expiring soon, refreshing...")
- [ ] Sync with valid token skips refresh (check logs for "Token is still valid")
- [ ] Multiple simultaneous syncs don't crash (Phase 4 hardening needed for guarantee)
- [ ] Fresh tokens are used for QuickBooks API calls after refresh

## Timeline
- **Phase 0:** Documentation ✅ (2 minutes)
- **Phase 1:** Fix migration (5 minutes) - CRITICAL PATH
- **Phase 2:** Align refresh thresholds (15 minutes)
- **Phase 3:** Enhanced user feedback (30 minutes)
- **Phase 4:** Operational hardening (schedule for later sprint)

**Total time to working system:** 20 minutes (Phases 1-2)
**Total time to good UX:** 50 minutes (Phases 1-3)

## Key Files Reference
- Migration: `supabase/migrations/20251120000000_add_qbo_oauth_state_table.sql`
- OAuth Initiate: `supabase/functions/qbo-oauth-initiate/index.ts`
- OAuth Callback: `supabase/functions/qbo-oauth-callback/index.ts`
- Token Refresh: `supabase/functions/qbo-token-refresh/index.ts`
- Customer Sync: `supabase/functions/qbo-sync-customers/index.ts`
- Items Sync: `supabase/functions/qbo-sync-items/index.ts`
- Invoices Sync: `supabase/functions/qbo-sync-invoices/index.ts`
- Payments Sync: `supabase/functions/qbo-sync-payments/index.ts`

---

**Document Created:** 2025-11-17
**Status:** Active implementation guide
**Last Updated:** 2025-11-17
