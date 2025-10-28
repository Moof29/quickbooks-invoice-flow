# QuickBooks Sync: Edge Functions vs. Node.js Service

**TL;DR: Stick with Supabase Edge Functions. You're already 45% done, and they're perfect for your use case.**

---

## Quick Recommendation

### Use Supabase Edge Functions ✅

**Why:**
1. You're already 45% done with Edge Functions (OAuth, customer/item sync working)
2. Simpler architecture = faster to launch
3. Perfect for your scale (internal use + small customer base)
4. Seamless database access (no extra auth needed)
5. One deployment platform (everything in Supabase)
6. Can handle 500+ invoices easily (well within 6-min timeout)

**When to consider Node.js:**
- If you need to sync 10,000+ invoices at once
- If you're hitting the 6-minute Edge Function timeout regularly
- If you need npm packages not available in Deno
- If you're scaling to 1000s of organizations with heavy sync load

**Bottom line:** You can always migrate to Node.js later if needed. Start simple.

---

## Detailed Comparison

### 1. Current State Analysis

**What You Already Have (Edge Functions):**
```
✅ OAuth flow working (qbo-oauth-initiate, qbo-oauth-callback)
✅ Token refresh working (qbo-token-refresh)
✅ Customer sync working - partial (qbo-sync-customers)
✅ Item sync working - partial (qbo-sync-items)
✅ Database schema complete (90%)
✅ Security and RLS policies in place
✅ Deployment pipeline (Supabase CLI)

📊 Estimated completion: 45%
⏱️ Time invested: ~30-40 hours
```

**If You Switch to Node.js:**
- Throw away 45% of completed work
- Start from scratch with new infrastructure
- Add 2-3 weeks to timeline
- Increase complexity significantly

**Verdict:** Don't throw away working code unless there's a compelling reason.

---

### 2. Architecture Comparison

#### Option A: Supabase Edge Functions (Deno)

```
┌─────────────────────────────────────────┐
│         BATCHLY FRONTEND (React)        │
│                                         │
└───────────────┬─────────────────────────┘
                │
                │ HTTP/GraphQL
                │
┌───────────────▼─────────────────────────┐
│         SUPABASE PLATFORM               │
│  ┌─────────────────────────────────┐   │
│  │  PostgreSQL Database (RLS)      │   │
│  │  - All tables                   │   │
│  │  - Row-level security           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Edge Functions (Deno)          │   │
│  │  - qbo-oauth-initiate           │   │
│  │  - qbo-oauth-callback           │   │
│  │  - qbo-sync-customers           │   │
│  │  - qbo-sync-items               │   │
│  │  - qbo-sync-invoices (TODO)     │   │
│  │  - qbo-sync-payments (TODO)     │   │
│  │  - qbo-sync-processor (TODO)    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Scheduled Jobs (pg_cron)       │   │
│  │  - Daily payment sync (2 AM)    │   │
│  │  - Daily item sync (4 AM)       │   │
│  └─────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │
                │ QuickBooks API
                │
┌───────────────▼─────────────────────────┐
│      QUICKBOOKS ONLINE API              │
│  - Create invoices                      │
│  - Get payment status                   │
│  - Get customers, items                 │
└─────────────────────────────────────────┘
```

**Pros:**
- ✅ Single platform (Supabase) for everything
- ✅ Direct database access (no extra auth)
- ✅ Built-in authentication (Supabase Auth)
- ✅ Easy deployment (`supabase functions deploy`)
- ✅ No separate hosting costs
- ✅ TypeScript native (Deno)
- ✅ RLS policies work seamlessly
- ✅ Service role access for edge functions
- ✅ Built-in environment variables (secrets)
- ✅ Logging integrated (Supabase dashboard)
- ✅ pg_cron for scheduled jobs (already in DB)

**Cons:**
- ⚠️ 6-minute timeout (usually not an issue)
- ⚠️ Deno ecosystem (not Node.js) - some packages incompatible
- ⚠️ Cold starts (~100-500ms)
- ⚠️ Less control over execution environment
- ⚠️ Harder to debug locally (but improving)

**Performance:**
- Sync 500 invoices: ~2-4 minutes ✅
- Sync 1000 customers: ~3-5 minutes ✅
- Payment status check (100 invoices): ~30-60 seconds ✅

---

#### Option B: Node.js Service (Separate)

```
┌─────────────────────────────────────────┐
│         BATCHLY FRONTEND (React)        │
│                                         │
└───────────────┬─────────────────────────┘
                │
                │ HTTP
                │
┌───────────────▼─────────────────────────┐
│         SUPABASE (Database Only)        │
│  ┌─────────────────────────────────┐   │
│  │  PostgreSQL Database (RLS)      │   │
│  │  - All tables                   │   │
│  └─────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │
                │ Service Role Connection
                │
┌───────────────▼─────────────────────────┐
│    NODE.JS SYNC SERVICE (Separate)      │
│  ┌─────────────────────────────────┐   │
│  │  Express/Fastify API            │   │
│  │  - POST /sync/customers         │   │
│  │  - POST /sync/invoices          │   │
│  │  - POST /sync/payments          │   │
│  │  - POST /oauth/callback         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Worker Queues (BullMQ/Redis)   │   │
│  │  - Invoice sync queue           │   │
│  │  - Payment sync queue           │   │
│  │  - Retry logic                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Cron Jobs (node-cron)          │   │
│  │  - Scheduled syncs              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Hosted on:                             │
│  - AWS Lambda (serverless)              │
│  - Google Cloud Run (containers)        │
│  - Digital Ocean App Platform           │
│  - Heroku / Render                      │
└───────────────┬─────────────────────────┘
                │
                │ QuickBooks API
                │
┌───────────────▼─────────────────────────┐
│      QUICKBOOKS ONLINE API              │
└─────────────────────────────────────────┘

PLUS:
┌─────────────────────────────────────────┐
│    REDIS (for BullMQ queues)            │
│  - Hosted on Redis Cloud or Upstash    │
│  - Additional $10-30/month              │
└─────────────────────────────────────────┘
```

**Pros:**
- ✅ Full npm ecosystem (any package works)
- ✅ No timeout limits (can run for hours if needed)
- ✅ Mature tooling (Jest, debugging, etc.)
- ✅ More control over execution
- ✅ Worker queues (BullMQ) for reliability
- ✅ Easier local development
- ✅ Can use Node.js best practices

**Cons:**
- ❌ Separate infrastructure to manage
- ❌ Separate hosting costs ($10-50/month)
- ❌ Need to manage Supabase service role key securely
- ❌ Need to set up database connection pooling
- ❌ Additional deployment complexity (Docker, env vars)
- ❌ Need Redis for job queues (extra $10-30/month)
- ❌ More moving parts (Node.js service + Redis + Supabase)
- ❌ Additional security considerations (API key management)
- ❌ RLS policies don't apply (need manual checks)
- ❌ More code to write (auth, DB connection, error handling)

**Performance:**
- Same as Edge Functions (API calls to QB are the bottleneck)
- Slightly faster cold starts (if using containers)
- Better for very large batches (10,000+ invoices)

---

### 3. Scalability Analysis

#### Your Use Case (Internal + Small Customer Base)

**Expected Load:**
- Organizations: 1-10 (internal first, then expand)
- Invoices per day: 10-500 per org
- Sync frequency: Real-time (invoices) + Daily (payments)
- Concurrent syncs: 1-5 max

**Edge Functions Capacity:**
- Max execution time: 6 minutes
- Max payload: 6MB
- Max concurrent executions: 100+ (Supabase scales automatically)

**Can Edge Functions Handle This?**
```
Sync 500 invoices:
  - QB API rate limit: 500 requests/minute
  - Each invoice = 1 API call
  - 500 invoices = 500 calls = ~60 seconds API time
  - Plus processing: ~30-60 seconds
  - Total: ~2-3 minutes ✅ Well under 6-min limit

Sync 100 customers:
  - 100 API calls = ~12 seconds API time
  - Plus processing: ~10-20 seconds
  - Total: ~30 seconds ✅

Daily payment sync (100 invoices):
  - 100 API calls to check invoice status
  - ~12-15 seconds API time
  - Plus DB updates: ~10-20 seconds
  - Total: ~30-45 seconds ✅
```

**Verdict:** Edge Functions are PERFECT for your scale.

---

#### When Node.js Becomes Necessary

**Scenarios where you'd need Node.js:**
1. **Massive batch syncs:**
   - Syncing 10,000+ invoices at once
   - Would exceed 6-minute timeout
   - Solution: Batch into smaller chunks OR use Node.js

2. **Complex background jobs:**
   - Jobs running for 30+ minutes
   - Multi-step workflows with long waits
   - Solution: Node.js with worker queues

3. **High concurrency:**
   - 100+ organizations syncing simultaneously
   - Thousands of sync requests per minute
   - Solution: Node.js with horizontal scaling

4. **Specific npm packages:**
   - Need a package that only works in Node.js
   - Not available in Deno
   - Solution: Port to Deno OR use Node.js

**Your Current Reality:**
- ❌ Not syncing 10,000+ invoices
- ❌ Not running 30-minute jobs
- ❌ Not handling 100+ concurrent orgs (yet)
- ❌ Not blocked by Deno compatibility

**Verdict:** You don't need Node.js yet.

---

### 4. Development Experience

#### Edge Functions (Deno)

**Local Development:**
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase (includes edge functions runtime)
supabase start

# Run function locally
supabase functions serve qbo-sync-invoices

# Test function
curl -X POST http://localhost:54321/functions/v1/qbo-sync-invoices \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"organization_id": "123"}'

# View logs
supabase functions logs qbo-sync-invoices
```

**Deployment:**
```bash
# Deploy single function
supabase functions deploy qbo-sync-invoices

# Deploy all functions
supabase functions deploy

# View production logs
supabase functions logs --project-ref YOUR_PROJECT_ID
```

**Pros:**
- Simple CLI commands
- Built-in local runtime
- Fast deployment (30-60 seconds)
- Integrated logging

**Cons:**
- Debugging is harder (limited breakpoint support)
- TypeScript-only (no plain JS)
- Deno import maps (different from package.json)

---

#### Node.js Service

**Local Development:**
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run development server
npm run dev

# Debug with breakpoints (VS Code)
F5

# Run tests
npm test

# Build production bundle
npm run build
```

**Deployment:**
```bash
# Build Docker image
docker build -t qbo-sync-service .

# Push to registry
docker push your-registry/qbo-sync-service

# Deploy to Cloud Run
gcloud run deploy qbo-sync-service \
  --image your-registry/qbo-sync-service \
  --platform managed

# View logs
gcloud logging read "resource.type=cloud_run_revision"

# Or deploy to AWS Lambda, Heroku, etc.
# (Different commands for each platform)
```

**Pros:**
- Full debugging support (breakpoints, step-through)
- Familiar npm ecosystem
- Can use JavaScript or TypeScript
- Rich tooling (Jest, Prettier, ESLint)

**Cons:**
- More setup (Docker, deployment configs)
- Slower deployment (2-5 minutes)
- Need to manage infrastructure
- More moving parts

---

### 5. Cost Comparison

#### Edge Functions (Supabase)

**Supabase Pro Plan:** $25/month
- 500,000 function invocations included
- 1,000 function hours included
- No extra costs for most use cases

**Your Expected Usage:**
```
Daily syncs:
  - Invoice sync: 1-10 per day (on-demand)
  - Payment sync: 1 per day (scheduled)
  - Customer sync: 1-5 per day (on-demand)
  - Item sync: 1 per day (scheduled)
  - Queue processor: 288 per day (every 5 min)

Total per day: ~300 invocations
Total per month: ~9,000 invocations

Function hours:
  - Avg execution: 30 seconds
  - 9,000 invocations × 0.0083 hours = ~75 function hours/month

Cost: $25/month ✅ (well within Pro plan limits)
```

---

#### Node.js Service

**Hosting Options:**

**Option 1: AWS Lambda (Serverless)**
- $0.20 per million requests
- $0.0000166667 per GB-second
- Expected: ~$5-15/month
- Plus Redis: $10-20/month (for BullMQ)
- **Total: $15-35/month**

**Option 2: Google Cloud Run (Containers)**
- $0.40 per million requests
- $0.00002400 per GB-second
- Expected: ~$10-20/month
- Plus Redis: $10-20/month
- **Total: $20-40/month**

**Option 3: Heroku / Render (Simple)**
- Heroku Eco: $5/month (basic dyno)
- Redis: $15/month (Heroku Redis)
- **Total: $20/month**

**Option 4: Digital Ocean App Platform**
- Basic: $5/month
- Managed Redis: $15/month
- **Total: $20/month**

**Plus:**
- Development time: +2-3 weeks = +$3,000-6,000 (if outsourced)
- Ongoing maintenance: +2-4 hours/month

**Verdict:**
- Edge Functions: $25/month (all-in-one)
- Node.js Service: $20-40/month + development cost + maintenance

Not a huge difference, but Edge Functions are simpler.

---

### 6. Maintenance & Operations

#### Edge Functions

**Ongoing Tasks:**
- Deploy new functions (5 min)
- Update existing functions (5 min)
- Monitor logs (10 min/week)
- Debug issues (30 min when issues occur)

**Total:** ~1-2 hours/month

---

#### Node.js Service

**Ongoing Tasks:**
- Deploy new code (Docker build + push = 10-15 min)
- Update dependencies (npm audit fix = 10-20 min/month)
- Monitor multiple services (Node.js + Redis + Supabase = 20 min/week)
- Manage infrastructure (scaling, env vars = 30 min/month)
- Debug issues (more complex due to distributed system = 1-2 hours when issues occur)
- Keep Node.js version updated
- Manage database connection pool
- Monitor Redis queue health

**Total:** ~3-5 hours/month

**Verdict:** Edge Functions are lower maintenance.

---

### 7. Risk Analysis

#### Edge Functions Risks

**Risk 1: Hit 6-minute timeout**
- **Likelihood:** Low (your sync batches are small)
- **Mitigation:** Batch into smaller chunks (e.g., 100 invoices per batch)
- **Fallback:** Migrate to Node.js if persistent issue

**Risk 2: Deno package incompatibility**
- **Likelihood:** Low (most packages work via CDN: esm.sh)
- **Current status:** intuit-oauth and fetch already working
- **Mitigation:** Use Deno-compatible libraries or polyfills
- **Fallback:** Migrate to Node.js if critical package needed

**Risk 3: Cold starts slow down sync**
- **Likelihood:** Medium (but acceptable)
- **Impact:** First sync after inactivity takes +500ms
- **Mitigation:** Keep functions warm with scheduled syncs
- **Acceptable:** 500ms extra is not noticeable

**Risk 4: Supabase platform issues**
- **Likelihood:** Low (99.9% uptime SLA)
- **Impact:** All services down (DB + Edge Functions)
- **Mitigation:** Supabase has good track record
- **Same risk applies to Node.js:** DB is on Supabase anyway

**Overall Risk Level:** LOW

---

#### Node.js Service Risks

**Risk 1: Additional infrastructure failures**
- **Likelihood:** Medium (more moving parts)
- **Impact:** Node.js down, or Redis down, or deployment fails
- **Mitigation:** Monitoring, alerts, redundancy
- **Complexity:** Higher than single-platform approach

**Risk 2: Security vulnerabilities**
- **Likelihood:** Medium (npm packages, Docker images)
- **Impact:** Need regular dependency updates
- **Mitigation:** Automated scanning (Snyk, Dependabot)
- **Ongoing effort:** 1-2 hours/month

**Risk 3: Deployment complexity**
- **Likelihood:** Medium (Docker, CI/CD, multiple environments)
- **Impact:** Slower iterations, more room for error
- **Mitigation:** Good DevOps practices
- **Learning curve:** Steeper for team

**Overall Risk Level:** MEDIUM

**Verdict:** Edge Functions have lower operational risk.

---

## Detailed Recommendation

### For Internal Launch: Use Edge Functions ✅

**Timeline Impact:**
- Edge Functions: 1-2 weeks to complete Phase 1
- Node.js: 3-4 weeks to complete Phase 1 (need to rebuild everything)

**Complexity:**
- Edge Functions: Low (single platform)
- Node.js: High (multiple services, deployment pipelines)

**Cost:**
- Edge Functions: $25/month (Supabase Pro)
- Node.js: $20-40/month + development time

**Maintenance:**
- Edge Functions: 1-2 hours/month
- Node.js: 3-5 hours/month

**Scalability:**
- Edge Functions: Perfect for 1-100 organizations
- Node.js: Better for 100+ organizations (but you're not there yet)

**Risk:**
- Edge Functions: Low
- Node.js: Medium

---

### Migration Path (If Needed Later)

**If you hit Edge Function limits:**

```
Phase 1: Edge Functions (Internal Launch)
  - Complete invoice/payment sync
  - Launch internally
  - Serve 1-10 customers
  - Prove product-market fit
  - Timeline: 1-2 weeks

Phase 2: Optimize Edge Functions (Growth)
  - Add batching logic
  - Optimize API calls
  - Improve error handling
  - Serve 10-50 customers
  - Timeline: 2-4 weeks

Phase 3: Migrate to Node.js (Scale)
  - Only if consistently hitting 6-min timeout
  - Only if serving 100+ customers
  - Gradual migration (one function at a time)
  - Timeline: 4-6 weeks

You're in Phase 1. Don't prematurely optimize for Phase 3.
```

---

## Implementation Plan (Edge Functions)

### Week 1: Core Sync Functions

**Day 1-2: Invoice Sync**
```typescript
// supabase/functions/qbo-sync-invoices/index.ts
serve(async (req) => {
  // 1. Get QB connection with token refresh
  const connection = await getQBConnection(organizationId);

  // 2. Fetch pending invoices from qbo_sync_queue
  const pendingInvoices = await getPendingInvoices(organizationId);

  // 3. Validate each invoice (customer synced, items synced)
  const validInvoices = await validateInvoices(pendingInvoices);

  // 4. For each valid invoice:
  for (const invoice of validInvoices) {
    // Build QB payload
    const qbInvoice = buildQBInvoicePayload(invoice);

    // POST to QB API
    const result = await createInvoiceInQB(connection, qbInvoice);

    // Store QB Invoice ID
    await storeQBMapping(invoice.id, result.Invoice.Id);

    // Update sync queue
    await markSyncComplete(invoice.id);
  }

  return { success: true, synced: validInvoices.length };
});
```

**Day 3-4: Sync Queue Processor**
```typescript
// supabase/functions/qbo-sync-processor/index.ts
serve(async (req) => {
  // Runs every 5 minutes via pg_cron

  // 1. Get pending sync items (limit 50)
  const pendingItems = await getPendingFromQueue();

  // 2. Route to appropriate sync function
  for (const item of pendingItems) {
    await markAsProcessing(item.id);

    try {
      switch (item.entity_type) {
        case 'invoice':
          await syncInvoice(item.entity_id);
          break;
        case 'customer':
          await syncCustomer(item.entity_id);
          break;
        case 'payment':
          await syncPayment(item.entity_id);
          break;
      }

      await markAsComplete(item.id);
    } catch (error) {
      await handleSyncError(item.id, error);
    }
  }

  return { processed: pendingItems.length };
});
```

**Day 5-7: Payment Sync**
```typescript
// supabase/functions/qbo-sync-payments/index.ts
serve(async (req) => {
  // Runs daily at 2 AM via pg_cron

  // 1. Get all synced invoices
  const syncedInvoices = await getSyncedInvoices(organizationId);

  // 2. Query QB for payment status
  for (const invoice of syncedInvoices) {
    const qbInvoice = await getInvoiceFromQB(invoice.qbo_id);

    // 3. Calculate payment status
    const amountPaid = qbInvoice.TotalAmt - qbInvoice.Balance;
    const status = calculateInvoiceStatus(qbInvoice, invoice.due_date);

    // 4. Update Batchly invoice
    await updateInvoiceStatus(invoice.id, {
      amount_paid: amountPaid,
      amount_due: qbInvoice.Balance,
      status: status,
      payment_date: qbInvoice.LinkedTxn?.[0]?.TxnDate
    });
  }

  return { updated: syncedInvoices.length };
});
```

---

## Final Answer

**Use Supabase Edge Functions. Here's why:**

1. **You're 45% done already** - Don't throw away working OAuth and sync infrastructure
2. **Simpler = Faster launch** - 1-2 weeks vs. 3-4 weeks with Node.js
3. **Perfect for your scale** - Internal use + small customer base
4. **Lower maintenance** - One platform, less to manage
5. **Lower risk** - Fewer moving parts
6. **Can migrate later** - If you hit scaling issues (unlikely)

**When to reconsider:**
- You consistently hit 6-minute timeout (not expected)
- You're serving 100+ organizations (years away)
- You need a Node.js-only package (rare)

**Next step:** Implement Phase 1 using Edge Functions (1-2 weeks), then launch! 🚀

Want me to start building the invoice sync edge function?
