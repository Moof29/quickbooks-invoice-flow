# Batchly ERP - Phase 2 Implementation Plan

**Document Version**: 1.0
**Created**: 2025-11-16
**Phase 1 Completion**: 85% (pending cron activation)
**Phase 2 Timeline**: 6-8 weeks
**Phase 2 Goal**: Production-ready enterprise features + bidirectional sync

---

## EXECUTIVE SUMMARY

Phase 2 builds on the solid foundation from Phase 1 to add:
1. **Bidirectional Sync** - Push invoices/payments to QuickBooks
2. **Token Encryption** - Secure OAuth token storage
3. **Delta Sync** - Efficient incremental syncs
4. **Conflict Resolution** - Handle concurrent QB + Batchly edits
5. **Advanced Observability** - Real-time monitoring dashboards
6. **Invoice Push** - Critical missing feature for full workflow
7. **Testing** - Comprehensive test coverage

---

## PHASE 1 COMPLETION CHECKLIST

Before starting Phase 2, ensure Phase 1 is 100% complete:

- [ ] **Cron Jobs Active**: Either app.settings configured OR hardcoded migration deployed
- [ ] **Manual Sync Tests Pass**: All 6 tests in `manual-sync-test.md` successful
- [ ] **First Automated Sync**: Token refresh job runs successfully
- [ ] **Data Validation**: Customer/Item/Payment data syncing correctly from QB
- [ ] **Dashboard Verified**: `get_qb_sync_status()` returns accurate data
- [ ] **No Critical Errors**: Zero 500s or auth failures in edge function logs

**Estimated Phase 1 Completion**: By end of Week 1 (Nov 22, 2025)

---

## PHASE 2 FEATURE BREAKDOWN

### **Track 1: Bidirectional Sync (Weeks 1-3)**
**Priority**: 🔴 Critical (blocking full workflow)

#### 2.1: Invoice Push to QuickBooks (Week 1-2)
**What**: Push invoices created in Batchly to QuickBooks

**Current State**:
- ✅ Pull invoices from QB → Batchly works
- ❌ Push invoices from Batchly → QB missing

**Technical Design**:

```typescript
// New edge function: qbo-sync-invoices
// File: supabase/functions/qbo-sync-invoices/index.ts

interface InvoicePayload {
  organizationId: string;
  direction: 'pull' | 'push';
  invoiceIds?: string[];  // Optional: specific invoices to push
  deltaSyncMode?: boolean;
}

// QB Invoice API Mapping
QB_Invoice = {
  CustomerRef: { value: customer.qbo_id },
  Line: invoice_line_items.map(item => ({
    DetailType: "SalesItemLineDetail",
    Amount: item.amount,
    SalesItemLineDetail: {
      ItemRef: { value: item.qbo_id },
      Qty: item.quantity,
      UnitPrice: item.unit_price
    }
  })),
  BillEmail: { Address: customer.email },
  DueDate: invoice.due_date,
  TxnDate: invoice.invoice_date
}
```

**Implementation Steps**:

1. **Create Invoice Push Function** (4-6 hours)
   ```bash
   supabase functions new qbo-sync-invoices
   ```
   - Implement QB Invoice Create API call
   - Map Batchly invoice → QB Invoice format
   - Handle SyncToken for updates
   - Add to rate limiter & retry logic

2. **Add Invoice Line Item Sync** (3-4 hours)
   - Query `invoice_line_item` table
   - Join with `item_record` to get `qbo_id`
   - Validate all items have QB IDs before pushing
   - Handle partial line item updates

3. **Implement SyncToken Handling** (2-3 hours)
   - Store QB SyncToken in `invoice_record.qbo_sync_token`
   - Use for conflict detection on updates
   - Add migration:
     ```sql
     ALTER TABLE invoice_record
     ADD COLUMN IF NOT EXISTS qbo_sync_token INTEGER;
     ```

4. **Add Push Validation** (2 hours)
   - Check customer has `qbo_id` (can't invoice unmapped customer)
   - Check all line items have `qbo_id` (can't reference unknown items)
   - Return helpful errors if validation fails

5. **Testing** (4-6 hours)
   - Unit tests for mapping logic
   - Integration test: Create invoice in Batchly → Push to QB Sandbox
   - Verify invoice appears in QB with correct totals
   - Test update scenario (modify invoice → push again)

**Success Criteria**:
- ✅ Invoice created in Batchly appears in QB within 2 minutes
- ✅ Invoice totals match exactly
- ✅ Line items reference correct QB items
- ✅ Updates to existing invoices sync correctly
- ✅ Errors handled gracefully with rollback

**Database Changes**:
```sql
-- Migration: 20251117_invoice_push_support.sql
ALTER TABLE invoice_record
ADD COLUMN IF NOT EXISTS qbo_sync_token INTEGER,
ADD COLUMN IF NOT EXISTS qbo_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qbo_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qbo_sync_direction TEXT DEFAULT 'pull' CHECK (qbo_sync_direction IN ('pull', 'push', 'bidirectional'));

ALTER TABLE invoice_line_item
ADD COLUMN IF NOT EXISTS qbo_id TEXT,
ADD COLUMN IF NOT EXISTS qbo_sync_status TEXT DEFAULT 'not_synced';
```

---

#### 2.2: Payment Push to QuickBooks (Week 2-3)
**What**: Record payments received in Batchly into QB

**QB API**: `Payment.Create`

**Mapping**:
```typescript
QB_Payment = {
  CustomerRef: { value: payment.customer.qbo_id },
  TotalAmt: payment.amount,
  TxnDate: payment.payment_date,
  PaymentMethodRef: { value: payment_method_mapping[payment.payment_method] },
  Line: [{
    Amount: payment.amount,
    LinkedTxn: [{
      TxnId: invoice.qbo_id,  // Link payment to invoice
      TxnType: "Invoice"
    }]
  }]
}
```

**Implementation**: (12-16 hours)
- Create `qbo-sync-payments` push mode
- Map payment methods (Cash, Check, Credit Card → QB IDs)
- Link payments to invoices via `LinkedTxn`
- Handle unapplied payments

**Success Criteria**:
- Payment recorded in Batchly reduces QB invoice balance
- Payment method correctly mapped
- Payment date preserved

---

#### 2.3: Bidirectional Sync Orchestration (Week 3)
**What**: Coordinate push + pull to avoid conflicts

**Strategy**:
```
1. Pull latest from QB (get SyncTokens)
2. Check for conflicts (SyncToken changed?)
3. If no conflict: Push changes to QB
4. If conflict: Log to qbo_conflict_log, require manual resolution
```

**Implementation**: (8-10 hours)
- Add conflict detection before push
- Create conflict resolution UI/API
- Add `last_push_at` tracking to delta sync
- Test concurrent edit scenarios

---

### **Track 2: Token Encryption (Week 2)**
**Priority**: 🟡 High (security enhancement)

#### 2.4: Implement Supabase Vault Encryption
**What**: Encrypt OAuth tokens using Supabase Vault API instead of pgsodium

**Why Vault over pgsodium**:
- ✅ No permission issues in migrations
- ✅ Managed encryption keys
- ✅ Automatic key rotation
- ✅ Integrated with Supabase auth

**Implementation** (6-8 hours):

1. **Migrate to Vault Storage**:
   ```typescript
   // In qbo-oauth-callback edge function
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient(url, service_role_key);

   // Store encrypted tokens in Vault
   const { data: secretId } = await supabase
     .from('vault.secrets')
     .insert({
       name: `qbo_tokens_${organizationId}`,
       secret: JSON.stringify({
         access_token: tokens.access_token,
         refresh_token: tokens.refresh_token
       })
     });

   // Store only secret ID in qbo_connection
   await supabase
     .from('qbo_connection')
     .update({
       vault_secret_id: secretId,
       qbo_access_token: null,  // Remove plaintext
       qbo_refresh_token: null
     });
   ```

2. **Update get_qbo_connection_for_sync**:
   ```typescript
   // Retrieve from Vault instead of database
   const { data: secret } = await supabase
     .from('vault.secrets')
     .select('secret')
     .eq('id', connection.vault_secret_id)
     .single();

   const tokens = JSON.parse(secret.secret);
   return { ...connection, ...tokens };
   ```

3. **Migration for Existing Tokens** (one-time):
   ```typescript
   // Script: scripts/migrate-tokens-to-vault.ts
   // Read all plaintext tokens, store in Vault, update DB
   ```

**Success Criteria**:
- ✅ No plaintext tokens in `qbo_connection` table
- ✅ Vault secrets encrypted at rest
- ✅ Token retrieval works in sync functions
- ✅ Automatic cleanup of expired secrets

**Database Changes**:
```sql
ALTER TABLE qbo_connection
ADD COLUMN IF NOT EXISTS vault_secret_id UUID;

-- Remove plaintext after migration
-- (manual step, don't automate - requires verification)
```

---

### **Track 3: Delta Sync Implementation (Week 3-4)**
**Priority**: 🟡 High (performance + cost savings)

#### 2.5: Enable Delta Sync in Edge Functions
**What**: Use `last_*_sync_at` timestamps to fetch only changed records

**Current State**:
- ✅ Delta sync columns exist
- ✅ Helper functions (`get_delta_sync_timestamp`) exist
- ❌ Edge functions ignore delta timestamps (always full sync)

**Implementation** (8-12 hours):

1. **Update qbo-sync-customers**:
   ```typescript
   const lastSync = deltaSyncMode
     ? await getLastSyncTimestamp(organizationId, 'customer')
     : null;

   const whereClause = lastSync
     ? `WHERE LastUpdatedTime > '${lastSync.toISOString()}'`
     : '';

   const qbQuery = `SELECT * FROM Customer ${whereClause} MAXRESULTS 500`;
   ```

2. **Update qbo-sync-items, qbo-sync-payments**:
   - Same pattern as customers
   - Use QB `LastUpdatedTime` field

3. **Update Delta Timestamps After Sync**:
   ```typescript
   await updateDeltaSyncTimestamp(organizationId, 'customer', new Date());
   ```

4. **Add Delta Sync to Cron Jobs**:
   ```sql
   -- Update existing jobs to pass deltaSyncMode: true
   body := jsonb_build_object(
     'organizationId', organization_id::text,
     'direction', 'pull',
     'deltaSyncMode', true  -- Enable delta sync
   )
   ```

**Testing**:
- Run full sync: Records all customers
- Modify 1 customer in QB
- Run delta sync: Only fetches modified customer
- Verify `last_customer_sync_at` updated

**Success Criteria**:
- ✅ Delta syncs 10-50x faster than full syncs
- ✅ QB API usage reduced by 90%+
- ✅ No missed updates (delta + occasional full sync for safety)

**Monitoring**:
```sql
-- Track delta vs full sync performance
SELECT
  entity_type,
  AVG(entity_count) FILTER (WHERE metadata->>'deltaSyncMode' = 'true') AS avg_delta_count,
  AVG(entity_count) FILTER (WHERE metadata->>'deltaSyncMode' = 'false') AS avg_full_count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration_seconds
FROM qbo_sync_history
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY entity_type;
```

---

### **Track 4: Conflict Resolution (Week 4-5)**
**Priority**: 🟢 Medium (important for data integrity)

#### 2.6: Conflict Detection & Resolution System

**Conflict Scenarios**:
1. **Concurrent Edit**: User edits customer in Batchly while QB gets external update
2. **Delete Conflict**: Record deleted in QB but modified in Batchly
3. **Validation Conflict**: Batchly data doesn't meet QB validation rules

**Database Schema** (already designed in original spec):
```sql
-- Already have from verification audit
CREATE TABLE qbo_conflict_log (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  qbo_id TEXT,
  conflict_type TEXT,
  local_version JSONB,
  remote_version JSONB,
  resolution TEXT DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);
```

**Implementation** (12-16 hours):

1. **Conflict Detection Logic**:
   ```typescript
   function detectConflict(localRecord, qbRecord) {
     // SyncToken mismatch = concurrent edit
     if (localRecord.qbo_sync_token !== qbRecord.SyncToken) {
       return {
         type: 'concurrent_update',
         localVersion: localRecord,
         remoteVersion: qbRecord
       };
     }

     // Record exists in Batchly but deleted in QB
     if (qbRecord.Active === false && localRecord.is_active) {
       return {
         type: 'delete_conflict',
         localVersion: localRecord,
         remoteVersion: qbRecord
       };
     }

     return null;
   }
   ```

2. **Conflict Logging**:
   ```typescript
   if (conflict) {
     await supabase.from('qbo_conflict_log').insert({
       organization_id: organizationId,
       entity_type: 'customer',
       entity_id: localRecord.id,
       qbo_id: qbRecord.Id,
       conflict_type: conflict.type,
       local_version: conflict.localVersion,
       remote_version: conflict.remoteVersion,
       resolution: 'pending'
     });

     // Skip sync for this record
     return { skipped: true, reason: 'conflict' };
   }
   ```

3. **Conflict Resolution UI** (Dashboard):
   - Show pending conflicts
   - Side-by-side comparison
   - Actions: "Keep Batchly", "Keep QB", "Merge"
   - Update `resolution` + `resolved_at` fields

4. **Automatic Resolution Rules** (optional):
   - QB wins if SyncToken newer
   - Batchly wins for specific fields (e.g., internal notes)
   - Configurable per organization

**Success Criteria**:
- ✅ Conflicts detected before data loss
- ✅ User notified of pending conflicts
- ✅ Resolution actions persist correctly
- ✅ Audit trail of all conflict resolutions

---

### **Track 5: Advanced Observability (Week 5-6)**
**Priority**: 🟢 Medium (ops efficiency)

#### 2.7: Real-Time Monitoring Dashboard

**Features**:
1. **Sync Health Dashboard**:
   - Success rate by entity type (last 24h, 7d, 30d)
   - Average sync duration trends
   - QB API quota usage (approaching 500 req/min limit?)
   - Token expiry warnings

2. **Error Analytics**:
   - Top 10 error types
   - Failed sync details (entity ID, error message, timestamp)
   - Retry success rate

3. **Data Quality Metrics**:
   - % customers with QB ID
   - % invoices pushed to QB
   - Orphaned records (Batchly record references deleted QB entity)

**Implementation** (16-20 hours):

1. **Create Monitoring Views**:
   ```sql
   -- Migration: 20251125_monitoring_views.sql

   CREATE VIEW qbo_sync_health_metrics AS
   SELECT
     entity_type,
     DATE_TRUNC('hour', started_at) AS hour,
     COUNT(*) AS total_syncs,
     COUNT(*) FILTER (WHERE status = 'completed') AS successful,
     COUNT(*) FILTER (WHERE status = 'failed') AS failed,
     AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration_seconds,
     SUM(entity_count) AS total_entities_processed
   FROM qbo_sync_history
   WHERE started_at > NOW() - INTERVAL '7 days'
   GROUP BY entity_type, DATE_TRUNC('hour', started_at);

   CREATE VIEW qbo_error_summary AS
   SELECT
     entity_type,
     error_summary->>'error_type' AS error_type,
     COUNT(*) AS occurrence_count,
     MAX(started_at) AS last_occurred,
     array_agg(DISTINCT id) AS affected_sync_ids
   FROM qbo_sync_history
   WHERE status = 'failed'
     AND created_at > NOW() - INTERVAL '30 days'
   GROUP BY entity_type, error_summary->>'error_type'
   ORDER BY occurrence_count DESC;
   ```

2. **Dashboard UI** (React/shadcn):
   - Page: `/admin/qb-sync-monitoring`
   - Charts: Recharts for trend visualization
   - Real-time updates: Poll every 30 seconds
   - Filters: Entity type, date range, organization

3. **Alerting** (optional):
   - Email if sync fails 3 times in a row
   - Slack webhook for critical errors
   - Token expiry notifications (24h before)

**Success Criteria**:
- ✅ Dashboard loads <2 seconds
- ✅ Admins can identify failing syncs quickly
- ✅ Historical trends visible
- ✅ Actionable error messages

---

### **Track 6: Testing & Quality (Week 6-8)**
**Priority**: 🔴 Critical (before production)

#### 2.8: Comprehensive Test Coverage

**Current State**: 0% test coverage (from Production Readiness Report)

**Target**: 70%+ coverage on critical paths

**Testing Strategy**:

1. **Unit Tests (Week 6)** - 20 hours
   - QB API response mapping
   - Conflict detection logic
   - Delta sync timestamp calculations
   - Token encryption/decryption
   - Validation functions

   **Tools**: Vitest + Testing Library
   ```bash
   npm install -D vitest @testing-library/react happy-dom
   ```

   **Example Test**:
   ```typescript
   // tests/qb-sync/customer-mapping.test.ts
   import { describe, it, expect } from 'vitest';
   import { mapQBCustomerToBatchly } from '../utils/qb-mapping';

   describe('QB Customer Mapping', () => {
     it('maps all required fields', () => {
       const qbCustomer = {
         Id: "123",
         DisplayName: "Acme Corp",
         PrimaryEmailAddr: { Address: "contact@acme.com" },
         BillAddr: { Line1: "123 Main St", City: "NYC" }
       };

       const result = mapQBCustomerToBatchly(qbCustomer, 'org-uuid');

       expect(result.qbo_id).toBe("123");
       expect(result.name).toBe("Acme Corp");
       expect(result.email).toBe("contact@acme.com");
     });
   });
   ```

2. **Integration Tests (Week 7)** - 24 hours
   - Edge function end-to-end
   - Database interactions
   - RLS policy enforcement
   - Cron job execution

   **Tools**: Supabase Local Dev + Deno Test
   ```bash
   supabase start
   supabase functions serve
   ```

   **Test Scenarios**:
   - Customer sync: Call edge function → Verify DB records
   - Invoice push: Create invoice → Verify QB API called correctly
   - Token refresh: Mock QB OAuth → Verify tokens updated

3. **E2E Tests (Week 7-8)** - 20 hours
   - Full user workflows
   - QB OAuth connection flow
   - Invoice creation → QB push → Payment recording

   **Tools**: Playwright
   ```bash
   npm install -D @playwright/test
   ```

   **Critical Paths**:
   - Connect QB → Sync customers → View synced data
   - Create invoice → Push to QB → Verify in sandbox
   - Disconnect QB → Reconnect → Resume syncs

**Success Criteria**:
- ✅ 70%+ code coverage on utils/helpers
- ✅ All edge functions have integration tests
- ✅ E2E tests cover 5 critical workflows
- ✅ CI/CD runs tests on every PR
- ✅ Zero regressions during Phase 2 development

---

## PHASE 2 TIMELINE & MILESTONES

### Week 1-2: Invoice Push Foundation
- **Deliverable**: Invoices push to QB successfully
- **Milestone**: First invoice created in Batchly appears in QB Sandbox

### Week 3: Bidirectional Orchestration
- **Deliverable**: Push + pull coordination working
- **Milestone**: Modify invoice in both systems, conflicts detected

### Week 4: Delta Sync + Conflicts
- **Deliverable**: Delta sync reduces API calls by 90%
- **Milestone**: Conflict resolution system operational

### Week 5-6: Observability & Encryption
- **Deliverable**: Monitoring dashboard + encrypted tokens
- **Milestone**: Dashboard deployed, tokens migrated to Vault

### Week 7-8: Testing & Hardening
- **Deliverable**: 70% test coverage
- **Milestone**: All critical paths tested, zero high-severity bugs

---

## PHASE 2 DEPENDENCIES & RISKS

### Dependencies
1. **Phase 1 Complete**: All cron jobs running successfully
2. **QB Sandbox Access**: For testing push operations
3. **Vault API Access**: For token encryption (Supabase Pro plan required?)

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| QB API rate limits hit during testing | High | Use sandbox, implement backoff, monitor quota |
| Conflict resolution UI too complex | Medium | Start with admin-only, iterate on UX |
| Delta sync misses updates | High | Weekly full sync as safety net |
| Token migration breaks active syncs | Critical | Test thoroughly in staging, have rollback plan |
| Testing takes longer than estimated | Medium | Prioritize critical paths, defer E2E edge cases |

---

## PHASE 2 SUCCESS METRICS

**Technical Metrics**:
- ✅ 100% of invoices push to QB within 2 minutes
- ✅ Delta syncs complete in <5 seconds (vs 30-60s full sync)
- ✅ QB API calls reduced by 85%+
- ✅ Conflict rate <1% of all syncs
- ✅ Zero token compromise incidents
- ✅ 70%+ test coverage

**Business Metrics**:
- ✅ Users can create invoices in Batchly and bill via QB
- ✅ Payment recording workflow fully automated
- ✅ Sync errors resolved without manual intervention 95%+ of time
- ✅ Zero data loss incidents due to sync issues

---

## PHASE 2 RESOURCE REQUIREMENTS

**Development Time**:
- **Full-Time Developer**: 6-8 weeks
- **Part-Time (50%)**: 12-16 weeks

**Breakdown by Skill**:
- Backend/Edge Functions: 50 hours (Invoice push, payment push, delta sync)
- Database/SQL: 20 hours (Migrations, conflict log, monitoring views)
- Frontend/Dashboard: 30 hours (Conflict UI, monitoring dashboard)
- Testing: 64 hours (Unit, integration, E2E)
- DevOps/Security: 16 hours (Token encryption, vault setup, cron monitoring)

**Total**: ~180 hours

**External Dependencies**:
- Supabase support (for Vault setup, if needed)
- QB Sandbox account (free)
- CI/CD setup (GitHub Actions, likely existing)

---

## PHASE 3 PREVIEW (Future)

After Phase 2, consider:
1. **Multi-Company Support**: Sync multiple QB companies per organization
2. **Webhook Integration**: Real-time updates from QB
3. **Advanced Reporting**: Custom QB reports in Batchly
4. **Vendor/Bill Pay**: Expand beyond invoices
5. **Inventory Sync**: Two-way inventory adjustments
6. **QuickBooks Desktop**: Support QBD in addition to QBO

---

## GETTING STARTED WITH PHASE 2

### Immediate Next Steps (This Week):

1. **Complete Phase 1**:
   - [ ] Deploy hardcoded cron migration OR wait for Supabase support
   - [ ] Run all manual sync tests
   - [ ] Verify 24h of successful automated syncs

2. **Set Up Phase 2 Project**:
   - [ ] Create GitHub Project board "Phase 2 - QB Bidirectional Sync"
   - [ ] Break down tasks from this plan into issues
   - [ ] Set milestone dates

3. **Development Environment**:
   - [ ] Set up local Supabase: `supabase start`
   - [ ] Configure QB Sandbox app (separate from production)
   - [ ] Install testing frameworks: Vitest, Playwright

4. **Start with Invoice Push**:
   - [ ] Create branch: `feature/qbo-invoice-push`
   - [ ] Scaffold edge function: `supabase functions new qbo-sync-invoices`
   - [ ] Research QB Invoice API docs thoroughly
   - [ ] Write first test: QB invoice mapping

---

## APPENDIX: REFERENCE DOCS

**QuickBooks API**:
- [Invoice API](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice)
- [Payment API](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/payment)
- [Error Codes](https://developer.intuit.com/app/developer/qbo/docs/develop/troubleshooting/error-codes)
- [Rate Limits](https://developer.intuit.com/app/developer/qbo/docs/develop/explore-the-quickbooks-online-api/rate-limits)

**Supabase**:
- [Vault API](https://supabase.com/docs/guides/database/vault)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)

**Testing**:
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)

---

**Document Owner**: Development Team
**Last Updated**: 2025-11-16
**Next Review**: After Phase 1 completion
