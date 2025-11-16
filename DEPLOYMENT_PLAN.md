# Batchly ERP - Step-by-Step Deployment Plan

**Plan Date**: 2025-11-11
**Target**: Internal Production Deployment (10-20 users)
**Timeline**: 4-6 weeks
**Strategy**: Phased rollout with critical fixes first

---

## DEPLOYMENT STRATEGY OVERVIEW

This plan follows a **4-phase approach** to get Batchly ERP production-ready for internal use:

1. **Phase 1 (Week 1-2)**: Critical Security & Infrastructure
2. **Phase 2 (Week 2-3)**: Core Features & Testing
3. **Phase 3 (Week 4-5)**: Performance & UX
4. **Phase 4 (Week 5-6)**: Final Testing & Launch

Each phase has clear success criteria and must be completed before moving to the next.

---

## PRE-DEPLOYMENT PREPARATION

### Step 0: Environment Setup (Day 0 - Before Starting)

#### 0.1 Create Staging Environment
```bash
# 1. Create new Supabase project for staging
# Go to: https://supabase.com/dashboard
# Click "New Project"
# Name: batchly-staging
# Region: Same as production
# Plan: Free tier (for testing)

# 2. Update local environment
cp .env.example .env.staging

# 3. Configure staging variables
VITE_SUPABASE_URL=https://[staging-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[staging-anon-key]
```

#### 0.2 Set Up Error Monitoring
```bash
# 1. Create Sentry account
# Go to: https://sentry.io/signup/

# 2. Create new project
# Name: batchly-erp
# Platform: React

# 3. Install Sentry
npm install --save @sentry/react @sentry/vite-plugin

# 4. Get DSN from Sentry dashboard
# Add to .env:
VITE_SENTRY_DSN=https://[your-sentry-dsn]
```

#### 0.3 Set Up Project Tracking
```bash
# 1. Create GitHub Project board
# Go to your repo → Projects → New Project
# Template: "Feature development"

# 2. Create milestones
- Milestone 1: Security Fixes
- Milestone 2: Core Features
- Milestone 3: Performance & UX
- Milestone 4: Production Launch

# 3. Create issues from checklist (see Phase sections below)
```

#### 0.4 Back Up Current Production Data
```bash
# 1. Export database schema
npx supabase db dump --file=backup-schema.sql --db-url=[prod-db-url]

# 2. Export data (if any exists)
npx supabase db dump --file=backup-data.sql --data-only --db-url=[prod-db-url]

# 3. Store backups securely
# Upload to secure location (Google Drive, S3, etc.)
```

**Checklist**:
- [ ] Staging environment created
- [ ] Sentry account set up
- [ ] GitHub project board ready
- [ ] Production data backed up
- [ ] Team has access to all tools

**Time Required**: 2-3 hours

---

## PHASE 1: CRITICAL SECURITY & INFRASTRUCTURE

**Timeline**: Week 1-2 (Days 1-10)
**Goal**: Fix security vulnerabilities and set up monitoring
**Owner**: Senior Developer
**Risk**: HIGH if skipped

### Week 1, Day 1-2: Security Vulnerability Fixes

#### Task 1.1: Add Organization Validation to Edge Functions
**Priority**: CRITICAL 🔴
**Estimated Time**: 6 hours

**Files to Modify**:
```
supabase/functions/qbo-oauth-initiate/index.ts
supabase/functions/qbo-token-refresh/index.ts
supabase/functions/qbo-sync-customers/index.ts
supabase/functions/qbo-sync-items/index.ts
supabase/functions/qbo-sync-payments/index.ts
supabase/functions/batch-invoice-orders/index.ts
supabase/functions/generate-daily-orders/index.ts
supabase/functions/import-csv-data/index.ts
```

**Implementation Steps**:

1. Create shared validation helper:
```bash
# Create new file
touch supabase/functions/_shared/validateOrganization.ts
```

```typescript
// supabase/functions/_shared/validateOrganization.ts
import { createClient } from '@supabase/supabase-js';

export async function validateUserOrganization(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  requestedOrgId: string
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Failed to fetch user profile:', error);
    return false;
  }

  return data.organization_id === requestedOrgId;
}
```

2. Update each edge function to use validation:
```typescript
// Example: qbo-oauth-initiate/index.ts
import { validateUserOrganization } from '../_shared/validateOrganization.ts';

// After getting user from JWT
const user = ... // existing code

// Add validation
const { organizationId } = await req.json();
const isValid = await validateUserOrganization(
  supabaseUrl,
  supabaseServiceRoleKey,
  user.id,
  organizationId
);

if (!isValid) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized: You do not have access to this organization' }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Continue with existing logic
```

3. Test validation:
```bash
# Deploy to staging
supabase functions deploy qbo-oauth-initiate --project-ref [staging-project-id]

# Test with unauthorized org ID (should fail with 403)
curl -X POST https://[staging-url]/functions/v1/qbo-oauth-initiate \
  -H "Authorization: Bearer [user-token]" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"wrong-org-id-here"}'

# Expected: 403 Unauthorized
```

4. Deploy to all functions:
```bash
# Deploy all functions
supabase functions deploy --project-ref [staging-project-id]
```

**Testing**:
- [ ] Validation works with correct org ID
- [ ] Validation blocks wrong org ID
- [ ] Error message is clear
- [ ] All 8 functions updated

**Commit Message**: `security: add organization validation to all edge functions`

---

#### Task 1.2: Add Explicit Organization Filters in Dashboard
**Priority**: CRITICAL 🔴
**Estimated Time**: 2 hours

**File to Modify**: `src/pages/Dashboard.tsx`

**Implementation**:
```typescript
// BEFORE (lines 42-46)
const [invoices, customers, orders, items] = await Promise.all([
  supabase.from('invoice_record').select('total, status'),
  supabase.from('customer_profile').select('id'),
  // ...
]);

// AFTER
const [invoices, customers, orders, items] = await Promise.all([
  supabase
    .from('invoice_record')
    .select('total, status')
    .eq('organization_id', organization.id), // ✅ ADD THIS

  supabase
    .from('customer_profile')
    .select('id')
    .eq('organization_id', organization.id), // ✅ ADD THIS
  // ... repeat for all queries
]);
```

**Testing**:
- [ ] Dashboard loads correctly
- [ ] Queries include organization_id filter
- [ ] No data from other organizations visible
- [ ] Performance not degraded

**Commit Message**: `security: add explicit organization_id filters in dashboard`

---

### Week 1, Day 3: Error Monitoring Implementation

#### Task 1.3: Set Up Sentry
**Priority**: CRITICAL 🔴
**Estimated Time**: 3 hours

**Implementation Steps**:

1. Install Sentry:
```bash
npm install --save @sentry/react @sentry/vite-plugin
```

2. Configure Vite plugin:
```typescript
// vite.config.ts
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  // ... existing config
  plugins: [
    // ... existing plugins
    sentryVitePlugin({
      org: "your-org",
      project: "batchly-erp",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: true, // Important for error tracking
  },
});
```

3. Initialize Sentry in app:
```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // 'production' or 'development'
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ["localhost", /^https:\/\/.*\.supabase\.co/],
    }),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
});
```

4. Test error reporting:
```typescript
// Add temporary test button in Dashboard
<Button onClick={() => { throw new Error("Test Sentry error"); }}>
  Test Error
</Button>

// Click button → Check Sentry dashboard for error
```

**Testing**:
- [ ] Sentry receives test error
- [ ] Source maps work (shows actual code line)
- [ ] User context captured
- [ ] Session replay works

**Commit Message**: `feat: implement Sentry error monitoring`

---

#### Task 1.4: Add Error Boundary
**Priority**: CRITICAL 🔴
**Estimated Time**: 2 hours

**Implementation Steps**:

1. Create ErrorBoundary component:
```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              We've been notified and will look into it. Please try refreshing the page.
            </p>
            <div className="space-x-2">
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

2. Wrap app with ErrorBoundary:
```typescript
// src/App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* existing app code */}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

3. Test error boundary:
```typescript
// Create test component that throws error
const BuggyComponent = () => {
  throw new Error('Test ErrorBoundary');
  return <div>Should not render</div>;
};

// Add to a route temporarily
<Route path="/test-error" element={<BuggyComponent />} />

// Navigate to /test-error → Should show error boundary UI
```

**Testing**:
- [ ] Error boundary catches component errors
- [ ] Fallback UI displays correctly
- [ ] Error sent to Sentry
- [ ] Refresh button works

**Commit Message**: `feat: add ErrorBoundary for graceful error handling`

---

#### Task 1.5: Add Unhandled Rejection Handler
**Priority**: CRITICAL 🔴
**Estimated Time**: 30 minutes

**Implementation**:
```typescript
// src/main.tsx
// Add after Sentry initialization

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  Sentry.captureException(event.reason, {
    contexts: {
      unhandled: {
        type: 'unhandledrejection',
        handled: false,
      },
    },
  });
});

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  Sentry.captureException(event.error, {
    contexts: {
      unhandled: {
        type: 'error',
        handled: false,
      },
    },
  });
});
```

**Testing**:
```typescript
// Test unhandled rejection
Promise.reject(new Error('Test unhandled rejection'));

// Check Sentry dashboard for error
```

**Commit Message**: `feat: add global error handlers for unhandled rejections`

---

### Week 1, Day 4-5: Testing Infrastructure Setup

#### Task 1.6: Install Testing Dependencies
**Priority**: HIGH 🟡
**Estimated Time**: 2 hours

**Implementation**:
```bash
# Install Vitest and testing libraries
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Install Playwright for E2E
npm install --save-dev @playwright/test

# Initialize Playwright
npx playwright install
```

**Configure Vitest**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/components/ui/**', // Exclude shadcn components
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Create test setup**:
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    auth: {
      getUser: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));
```

**Add scripts to package.json**:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Checklist**:
- [ ] Vitest installed and configured
- [ ] Playwright installed
- [ ] Test scripts added
- [ ] Mock setup working

**Commit Message**: `chore: set up testing infrastructure with Vitest and Playwright`

---

#### Task 1.7: Write Critical CSV Validation Tests
**Priority**: HIGH 🟡
**Estimated Time**: 4 hours

**Create test file**:
```typescript
// src/lib/csv-validator.test.ts
import { describe, it, expect } from 'vitest';
import { validateCSV } from './csv-validator';

describe('CSV Validator', () => {
  describe('Required Fields', () => {
    it('should pass validation with all required fields', () => {
      const rows = [
        { name: 'Item 1', sku: 'SKU001', unit_price: '10.00' }
      ];
      const result = validateCSV(rows, 'items');
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation when required field is missing', () => {
      const rows = [
        { name: 'Item 1', unit_price: '10.00' } // missing sku
      ];
      const result = validateCSV(rows, 'items');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('sku');
      expect(result.isValid).toBe(false);
    });

    it('should fail validation when required field is empty', () => {
      const rows = [
        { name: '', sku: 'SKU001', unit_price: '10.00' }
      ];
      const result = validateCSV(rows, 'items');
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Data Type Validation', () => {
    it('should validate numeric fields', () => {
      const rows = [
        { name: 'Item', sku: 'SKU', unit_price: 'not-a-number' }
      ];
      const result = validateCSV(rows, 'items');
      expect(result.errors.some(e => e.field === 'unit_price')).toBe(true);
    });

    it('should validate email fields', () => {
      const rows = [
        { company_name: 'Acme', email: 'invalid-email' }
      ];
      const result = validateCSV(rows, 'customers');
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should validate negative quantities', () => {
      const rows = [
        { name: 'Item', sku: 'SKU', unit_price: '10', quantity: '-5' }
      ];
      const result = validateCSV(rows, 'items');
      expect(result.errors.some(e => e.message.includes('negative'))).toBe(true);
    });
  });

  describe('Special Characters', () => {
    it('should handle special characters in text fields', () => {
      const rows = [
        { name: 'Item "quoted" & special', sku: 'SKU@123', unit_price: '10' }
      ];
      const result = validateCSV(rows, 'items');
      expect(result.isValid).toBe(true);
    });

    it('should handle unicode characters', () => {
      const rows = [
        { name: '物品', sku: 'SKU001', unit_price: '10' }
      ];
      const result = validateCSV(rows, 'items');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Warnings', () => {
    it('should warn on missing optional fields', () => {
      const rows = [
        { name: 'Item', sku: 'SKU', unit_price: '10' } // missing description
      ];
      const result = validateCSV(rows, 'items');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
```

**Run tests**:
```bash
npm test csv-validator
```

**Checklist**:
- [ ] All tests pass
- [ ] Coverage > 90% for csv-validator.ts
- [ ] Edge cases covered
- [ ] Error messages tested

**Commit Message**: `test: add comprehensive CSV validation tests`

---

### Week 2, Day 6-8: QuickBooks Invoice Push Implementation

#### Task 1.8: Implement Invoice Push to QuickBooks
**Priority**: CRITICAL 🔴
**Estimated Time**: 3-5 days

**Create new edge function**:
```bash
supabase functions new qbo-push-invoice
```

**Implementation**:
```typescript
// supabase/functions/qbo-push-invoice/index.ts
import { createClient } from '@supabase/supabase-js';
import { validateUserOrganization } from '../_shared/validateOrganization.ts';

interface InvoicePushRequest {
  organizationId: string;
  invoiceId: string;
}

Deno.serve(async (req) => {
  try {
    // 1. Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Parse request
    const { organizationId, invoiceId }: InvoicePushRequest = await req.json();

    // 3. Validate organization access
    const isValid = await validateUserOrganization(
      supabaseUrl,
      supabaseServiceRoleKey,
      user.id,
      organizationId
    );

    if (!isValid) {
      return new Response('Unauthorized: Invalid organization', { status: 403 });
    }

    // 4. Get QB connection
    const { data: connection, error: connError } = await supabase
      .rpc('get_qbo_connection_for_sync', { org_id: organizationId });

    if (connError || !connection) {
      throw new Error('QuickBooks not connected');
    }

    // 5. Check token expiration and refresh if needed
    const expiresAt = new Date(connection.qbo_token_expires_at);
    const now = new Date();
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000 / 60;

    if (minutesUntilExpiry < 10) {
      // Token refresh logic (reuse from qbo-token-refresh)
      // ... implement token refresh
    }

    // 6. Fetch invoice data with line items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoice_record')
      .select(`
        *,
        customer:customer_profile (
          qbo_id,
          company_name,
          email
        ),
        line_items:invoice_line_item (
          *,
          item:item_record (
            qbo_id,
            name
          )
        )
      `)
      .eq('id', invoiceId)
      .eq('organization_id', organizationId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // 7. Check if customer exists in QB
    if (!invoice.customer.qbo_id) {
      throw new Error('Customer not synced to QuickBooks');
    }

    // 8. Check if line items exist in QB
    const missingItems = invoice.line_items.filter((li: any) => !li.item?.qbo_id);
    if (missingItems.length > 0) {
      throw new Error(`${missingItems.length} items not synced to QuickBooks`);
    }

    // 9. Map invoice to QB format
    const qbInvoice = {
      CustomerRef: {
        value: invoice.customer.qbo_id
      },
      TxnDate: invoice.invoice_date,
      DueDate: invoice.due_date,
      DocNumber: invoice.invoice_number,
      Line: invoice.line_items.map((item: any) => ({
        DetailType: 'SalesItemLineDetail',
        Amount: parseFloat(item.amount),
        SalesItemLineDetail: {
          ItemRef: {
            value: item.item.qbo_id
          },
          Qty: parseFloat(item.quantity),
          UnitPrice: parseFloat(item.unit_price)
        },
        Description: item.description || item.item.name
      })),
      CustomerMemo: invoice.memo ? {
        value: invoice.memo
      } : undefined
    };

    // 10. Push to QuickBooks
    const qbUrl = connection.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

    let qbResponse;

    if (invoice.qbo_id) {
      // Update existing invoice
      qbResponse = await fetch(
        `${qbUrl}/v3/company/${connection.qbo_realm_id}/invoice/${invoice.qbo_id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${connection.qbo_access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            ...qbInvoice,
            Id: invoice.qbo_id,
            SyncToken: invoice.qbo_sync_token
          })
        }
      );
    } else {
      // Create new invoice
      qbResponse = await fetch(
        `${qbUrl}/v3/company/${connection.qbo_realm_id}/invoice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${connection.qbo_access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(qbInvoice)
        }
      );
    }

    if (!qbResponse.ok) {
      const errorText = await qbResponse.text();
      console.error('QB API Error:', errorText);
      throw new Error(`QuickBooks API error: ${errorText}`);
    }

    const qbData = await qbResponse.json();
    const qbInvoiceData = qbData.Invoice;

    // 11. Update local invoice with QB IDs
    await supabase
      .from('invoice_record')
      .update({
        qbo_id: qbInvoiceData.Id,
        qbo_sync_token: qbInvoiceData.SyncToken,
        qbo_sync_status: 'synced',
        last_sync_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    // 12. Log success
    console.log(`Invoice ${invoice.invoice_number} pushed to QB: ${qbInvoiceData.Id}`);

    return new Response(
      JSON.stringify({
        success: true,
        qbo_id: qbInvoiceData.Id,
        qbo_invoice_number: qbInvoiceData.DocNumber
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error pushing invoice:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
```

**Add database fields**:
```sql
-- Add QB sync fields to invoice_record if not exists
ALTER TABLE invoice_record
ADD COLUMN IF NOT EXISTS qbo_id TEXT,
ADD COLUMN IF NOT EXISTS qbo_sync_token INTEGER,
ADD COLUMN IF NOT EXISTS qbo_sync_status TEXT DEFAULT 'not_synced',
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint
ALTER TABLE invoice_record
ADD CONSTRAINT unique_invoice_qbo_id UNIQUE (organization_id, qbo_id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_invoice_qbo_sync
ON invoice_record(organization_id, qbo_sync_status, last_sync_at);
```

**Add frontend button**:
```typescript
// src/pages/InvoiceDetails.tsx
const pushToQuickBooks = async () => {
  try {
    setIsPushing(true);
    const response = await fetch(
      `${supabaseUrl}/functions/v1/qbo-push-invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: organization.id,
          invoiceId: invoice.id
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to push invoice');
    }

    toast({
      title: 'Success',
      description: 'Invoice pushed to QuickBooks'
    });

    refetch(); // Reload invoice data
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive'
    });
  } finally {
    setIsPushing(false);
  }
};

// Add button to UI
<Button onClick={pushToQuickBooks} disabled={isPushing}>
  {isPushing ? 'Pushing...' : 'Push to QuickBooks'}
</Button>
```

**Testing Checklist**:
- [ ] Creates new invoice in QB
- [ ] Updates existing invoice in QB
- [ ] Handles token refresh
- [ ] Validates customer exists in QB
- [ ] Validates items exist in QB
- [ ] Updates local invoice with QB IDs
- [ ] Shows user-friendly error messages
- [ ] Prevents duplicate invoices

**Commit Message**: `feat: implement invoice push to QuickBooks`

---

### Week 2, Day 9-10: Fix Customer Pull & Testing

#### Task 1.9: Fix Customer Pull to Store Data
**Priority**: HIGH 🟡
**Estimated Time**: 3 hours

**File to modify**: `supabase/functions/qbo-sync-customers/index.ts`

**Current code (line 189)**:
```typescript
return customers.length; // Simplified for testing
```

**Replace with**:
```typescript
// Store customers in database
const customersToUpsert = customers.map(customer => ({
  organization_id: connection.organization_id,
  qbo_id: customer.Id,
  company_name: customer.CompanyName || customer.DisplayName,
  email: customer.PrimaryEmailAddr?.Address,
  phone: customer.PrimaryPhone?.FreeFormNumber,
  billing_address_line1: customer.BillAddr?.Line1,
  billing_address_line2: customer.BillAddr?.Line2,
  billing_address_city: customer.BillAddr?.City,
  billing_address_state: customer.BillAddr?.CountrySubDivisionCode,
  billing_address_postal_code: customer.BillAddr?.PostalCode,
  billing_address_country: customer.BillAddr?.Country,
  is_active: customer.Active !== false,
  qbo_sync_token: customer.SyncToken ? parseInt(customer.SyncToken) : null,
  qbo_created_at: customer.MetaData?.CreateTime,
  qbo_updated_at: customer.MetaData?.LastUpdatedTime,
  last_sync_at: new Date().toISOString()
}));

const { data, error } = await supabase
  .from('customer_profile')
  .upsert(customersToUpsert, {
    onConflict: 'organization_id,qbo_id',
    ignoreDuplicates: false
  });

if (error) {
  console.error('Error storing customers:', error);
  throw error;
}

console.log(`Stored ${customersToUpsert.length} customers`);
return customersToUpsert.length;
```

**Testing**:
```bash
# Deploy function
supabase functions deploy qbo-sync-customers

# Test sync
curl -X POST https://[project-url]/functions/v1/qbo-sync-customers \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"[org-id]","direction":"pull"}'

# Verify data in database
# Check customer_profile table for new records with qbo_id
```

**Checklist**:
- [ ] Customers stored in database
- [ ] Upsert handles updates correctly
- [ ] QB fields mapped correctly
- [ ] No duplicate customers created

**Commit Message**: `fix: store customer data in pull sync`

---

### Phase 1 Success Criteria

Before moving to Phase 2, verify:

- [ ] All security vulnerabilities fixed (VULN-001, VULN-002)
- [ ] Sentry error monitoring active
- [ ] ErrorBoundary catches errors
- [ ] Testing infrastructure set up
- [ ] CSV validator tests pass (>90% coverage)
- [ ] Invoice push to QuickBooks working
- [ ] Customer pull stores data correctly
- [ ] All code committed and deployed to staging
- [ ] No critical bugs in staging environment

**Phase 1 Review Meeting**: Schedule 1-hour review with team

---

## PHASE 2: PERFORMANCE & UX IMPROVEMENTS

**Timeline**: Week 3-4 (Days 11-20)
**Goal**: Fix performance issues and improve user experience
**Owner**: Developer + Designer (if available)

### Week 3, Day 11-12: Performance Fixes

#### Task 2.1: Fix N+1 Query in Sales Orders List
**Priority**: HIGH 🟡
**Estimated Time**: 2 hours

**File to modify**: `src/components/ModernSalesOrdersList.tsx`

**BEFORE (lines 172-190)**:
```typescript
const ordersWithDetails = await Promise.all(
  (data || []).map(async (order: any) => {
    const { data: customer } = await supabase  // N+1!
      .from('customer_profile')
      .select('company_name')
      .eq('id', order.customer_id)
      .single();

    const { count: itemCount } = await supabase  // N+1!
      .from('invoice_line_item')
      .select('*', { count: 'exact', head: true })
      .eq('invoice_id', order.id);

    return {
      ...order,
      customer_name: customer?.company_name,
      item_count: itemCount
    };
  })
);
```

**AFTER**:
```typescript
// Use JOIN in initial query
const { data, error } = await supabase
  .from('invoice_record')
  .select(`
    *,
    customer:customer_profile!customer_id (
      company_name
    ),
    line_items:invoice_line_item (
      id
    )
  `)
  .eq('organization_id', organization.id)
  .order('created_at', { ascending: false })
  .range(from, to);

// Transform data
const ordersWithDetails = (data || []).map(order => ({
  ...order,
  customer_name: order.customer?.company_name,
  item_count: order.line_items?.length || 0
}));
```

**Testing**:
```bash
# Before: Time page load
# Open Network tab, load invoices page
# Expected: 100 requests for 50 orders

# After: Time page load
# Expected: 1 request for 50 orders
# Improvement: ~80-90% faster
```

**Commit Message**: `perf: fix N+1 query in sales orders list using JOIN`

---

#### Task 2.2: Optimize RLS Policies
**Priority**: MEDIUM 🟢
**Estimated Time**: 3 hours

**Create migration**:
```sql
-- Replace subquery-based policies with JWT claims

-- 1. Create function to extract org ID from JWT
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'organization_id')::uuid,
    (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );
$$;

-- 2. Update invoice_record policies
DROP POLICY IF EXISTS org_select_invoice_record ON invoice_record;
CREATE POLICY org_select_invoice_record ON invoice_record
FOR SELECT
USING (organization_id = auth.organization_id());

DROP POLICY IF EXISTS org_insert_invoice_record ON invoice_record;
CREATE POLICY org_insert_invoice_record ON invoice_record
FOR INSERT
WITH CHECK (organization_id = auth.organization_id());

-- 3. Repeat for all tables with organization_id
-- ... (customer_profile, sales_order, item_record, etc.)
```

**Note**: JWT doesn't include organization_id by default, so function falls back to profiles table lookup

**Testing**:
```sql
-- Benchmark before
EXPLAIN ANALYZE
SELECT * FROM invoice_record WHERE organization_id = '[org-id]';

-- Apply migration
-- Benchmark after
-- Expected: 20-30% faster on average
```

**Commit Message**: `perf: optimize RLS policies using JWT claims`

---

### Week 3, Day 13-15: Accessibility & UX

#### Task 2.3: Add ARIA Labels
**Priority**: HIGH 🟡
**Estimated Time**: 4 hours

**Files to modify**: All components with icon-only buttons

**Pattern to apply**:
```typescript
// BEFORE
<Button variant="ghost" size="icon">
  <MoreHorizontal className="h-4 w-4" />
</Button>

// AFTER
<Button variant="ghost" size="icon" aria-label="More actions">
  <MoreHorizontal className="h-4 w-4" />
</Button>
```

**Use this script to find all icon buttons**:
```bash
# Find icon-only buttons
grep -r "<Button.*size=\"icon\"" src/ --include="*.tsx" | grep -v "aria-label"

# Add aria-label to each
```

**Common aria-labels needed**:
- Edit icon → `aria-label="Edit"`
- Delete icon → `aria-label="Delete"`
- More icon → `aria-label="More actions"`
- Close icon → `aria-label="Close"`
- Search icon → `aria-label="Search"`
- Filter icon → `aria-label="Filter"`

**Testing**:
```bash
# Install axe DevTools browser extension
# Run accessibility audit
# Should pass WCAG 2.1 Level AA
```

**Checklist**:
- [ ] All icon buttons have aria-label
- [ ] Dropdowns have aria-expanded
- [ ] Forms have proper labels
- [ ] Dynamic content has aria-live
- [ ] axe audit passes

**Commit Message**: `a11y: add ARIA labels to all interactive elements`

---

#### Task 2.4: Add Unsaved Changes Warning
**Priority**: HIGH 🟡
**Estimated Time**: 3 hours

**Create hook**:
```typescript
// src/hooks/useUnsavedChanges.tsx
import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedChanges(isDirty: boolean) {
  // Warn on page leave
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Warn on route change
  const blocker = useBlocker(isDirty);

  return { blocker };
}
```

**Use in forms**:
```typescript
// src/pages/InvoiceDetails.tsx
const [isDirty, setIsDirty] = useState(false);
const { blocker } = useUnsavedChanges(isDirty);

// Track changes
const handleFieldChange = (field: string, value: any) => {
  setIsDirty(true);
  // ... existing onChange logic
};

// Show confirmation dialog
{blocker.state === 'blocked' && (
  <AlertDialog open>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
        <AlertDialogDescription>
          You have unsaved changes. Are you sure you want to leave?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => blocker.reset()}>
          Stay
        </AlertDialogCancel>
        <AlertDialogAction onClick={() => blocker.proceed()}>
          Leave
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

**Checklist**:
- [ ] Warns on browser close/refresh
- [ ] Warns on route navigation
- [ ] Dialog shows clear message
- [ ] Works in all forms
- [ ] Resets after save

**Commit Message**: `feat: add unsaved changes warning to forms`

---

#### Task 2.5: Fix Auth Error Messages
**Priority**: MEDIUM 🟢
**Estimated Time**: 30 minutes

**File to modify**: `src/pages/Auth.tsx`

**BEFORE (lines 72-80)**:
```typescript
if (error.message.includes('User already registered')) {
  toast({
    title: "Account exists",
    description: "An account with this email already exists. Please sign in instead."
  });
}
```

**AFTER**:
```typescript
// Generic message to prevent email enumeration
toast({
  title: "Authentication Error",
  description: "Invalid email or password. Please check your credentials and try again."
});
```

**Commit Message**: `security: prevent email enumeration in auth errors`

---

### Week 4, Day 16-18: Additional Testing

#### Task 2.6: Write Edge Function Tests
**Priority**: HIGH 🟡
**Estimated Time**: 8 hours

**Create test file**:
```typescript
// supabase/functions/tests/qbo-push-invoice.test.ts
import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

Deno.test('qbo-push-invoice: validates organization', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/qbo-push-invoice', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer [test-token]',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      organizationId: 'wrong-org-id',
      invoiceId: 'test-invoice-id'
    })
  });

  assertEquals(response.status, 403);
});

Deno.test('qbo-push-invoice: creates invoice in QB', async () => {
  // ... test implementation
});
```

**Run tests**:
```bash
# Start local Supabase
supabase start

# Run function tests
deno test --allow-net --allow-env supabase/functions/tests/
```

**Checklist**:
- [ ] Organization validation tested
- [ ] Invoice creation tested
- [ ] Invoice update tested
- [ ] Error handling tested
- [ ] Token refresh tested

**Commit Message**: `test: add tests for QuickBooks edge functions`

---

#### Task 2.7: Write E2E Tests
**Priority**: HIGH 🟡
**Estimated Time**: 12 hours

**Create test files**:
```typescript
// tests/e2e/invoice-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Invoice Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password123');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create invoice from order', async ({ page }) => {
    // 1. Navigate to orders
    await page.click('a:has-text("Sales Orders")');
    await expect(page).toHaveURL('/orders');

    // 2. Click convert to invoice
    await page.click('button:has-text("Convert to Invoice")');

    // 3. Wait for invoice creation
    await expect(page.locator('.toast')).toContainText('Invoice created');

    // 4. Verify invoice appears in list
    await page.click('a:has-text("Invoices")');
    await expect(page.locator('table')).toContainText('INV-');
  });

  test('should push invoice to QuickBooks', async ({ page }) => {
    // 1. Navigate to invoice details
    await page.goto('/invoices/[test-invoice-id]');

    // 2. Click push to QB button
    await page.click('button:has-text("Push to QuickBooks")');

    // 3. Wait for success
    await expect(page.locator('.toast')).toContainText('pushed to QuickBooks');

    // 4. Verify QB ID displayed
    await expect(page.locator('text=/QB #\\d+/')).toBeVisible();
  });

  test('should show error if customer not synced', async ({ page }) => {
    // Test error handling
    // ...
  });
});
```

**Run E2E tests**:
```bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode for debugging
npm run test:e2e:ui
```

**Checklist**:
- [ ] Login flow tested
- [ ] Order creation tested
- [ ] Invoice generation tested
- [ ] QB push tested
- [ ] CSV import tested
- [ ] Error scenarios tested

**Commit Message**: `test: add E2E tests for critical workflows`

---

### Phase 2 Success Criteria

Before moving to Phase 3, verify:

- [ ] N+1 query fixed, pages load 5x faster
- [ ] RLS policies optimized
- [ ] All interactive elements have ARIA labels
- [ ] Unsaved changes warning works
- [ ] Auth error messages secure
- [ ] Edge function tests pass
- [ ] E2E tests pass
- [ ] Test coverage > 60%
- [ ] Staging environment stable

**Phase 2 Review Meeting**: Schedule 1-hour review with team

---

## PHASE 3: POLISH & DOCUMENTATION

**Timeline**: Week 5 (Days 21-25)
**Goal**: Final polish and prepare for launch
**Owner**: Full team

### Week 5, Day 21-22: Final Polish

#### Task 3.1: Add Missing Composite Indexes
**Priority**: MEDIUM 🟢
**Estimated Time**: 30 minutes

```sql
-- Migration: add-composite-indexes.sql

-- For sales order queries with multiple filters
CREATE INDEX IF NOT EXISTS idx_sales_order_org_status_delivery
ON sales_order(organization_id, status, delivery_date DESC)
WHERE status = 'pending';

-- For line item queries
CREATE INDEX IF NOT EXISTS idx_invoice_line_item_invoice_created
ON invoice_line_item(invoice_id, created_at DESC);

-- For customer portal queries
CREATE INDEX IF NOT EXISTS idx_customer_portal_links_customer
ON customer_portal_user_links(customer_id, user_id)
WHERE is_active = true;

-- For QB sync queries
CREATE INDEX IF NOT EXISTS idx_invoice_qbo_sync_pending
ON invoice_record(organization_id, qbo_sync_status, updated_at DESC)
WHERE qbo_sync_status = 'pending';
```

**Commit Message**: `perf: add composite indexes for common queries`

---

#### Task 3.2: Implement Inline Form Validation
**Priority**: MEDIUM 🟢
**Estimated Time**: 6 hours

**Use react-hook-form with validation**:
```typescript
// Example: NewSalesOrder form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const orderSchema = z.object({
  customer_id: z.string().uuid('Please select a customer'),
  order_date: z.date({ required_error: 'Order date is required' }),
  delivery_date: z.date({ required_error: 'Delivery date is required' }),
  line_items: z.array(
    z.object({
      item_id: z.string().uuid('Please select an item'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      unit_price: z.number().min(0, 'Price cannot be negative')
    })
  ).min(1, 'At least one line item is required')
});

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
  watch
} = useForm({
  resolver: zodResolver(orderSchema)
});

// Show inline errors
{errors.customer_id && (
  <p className="text-sm text-destructive mt-1">
    {errors.customer_id.message}
  </p>
)}
```

**Commit Message**: `feat: add inline form validation with error messages`

---

### Week 5, Day 23-24: Documentation

#### Task 3.3: Create User Documentation
**Priority**: HIGH 🟡
**Estimated Time**: 6 hours

**Create files**:
```markdown
# docs/USER_GUIDE.md

# Batchly ERP User Guide

## Table of Contents
1. Getting Started
2. Managing Customers
3. Creating Sales Orders
4. Generating Invoices
5. QuickBooks Integration
6. CSV Import
7. Troubleshooting

## 1. Getting Started

### Logging In
1. Navigate to https://app.batchly-erp.com
2. Enter your email and password
3. Click "Sign In"

### Dashboard Overview
- **Total Revenue**: Shows revenue for current month
- **Open Invoices**: Number of unpaid invoices
- **Pending Orders**: Orders awaiting fulfillment
- **Quick Actions**: Create order, invoice, or customer

...
```

```markdown
# docs/ADMIN_GUIDE.md

# Batchly ERP Admin Guide

## User Management
- Adding users
- Assigning roles
- Managing permissions

## QuickBooks Setup
- OAuth connection
- Configuring sync
- Troubleshooting connection

## Data Import
- CSV format requirements
- Column mapping
- Error handling

...
```

**Commit Message**: `docs: add user and admin documentation`

---

#### Task 3.4: Create Technical Documentation
**Priority**: MEDIUM 🟢
**Estimated Time**: 4 hours

```markdown
# docs/TECHNICAL_GUIDE.md

# Batchly ERP Technical Guide

## Architecture Overview
- Frontend: React + Vite + TypeScript
- Backend: Supabase (PostgreSQL + Edge Functions)
- Integration: QuickBooks Online API

## Database Schema
- See [schema.sql](../supabase/migrations/)
- Key tables: ...

## API Documentation
- Edge Functions: ...
- Authentication: ...
- Rate Limits: ...

## Deployment
- See [DEPLOYMENT_PLAN.md](../DEPLOYMENT_PLAN.md)

## Monitoring
- Sentry: https://sentry.io/organizations/[org]/projects/batchly-erp
- Supabase Logs: https://supabase.com/dashboard/project/[project-id]/logs

...
```

**Commit Message**: `docs: add technical documentation`

---

### Week 5, Day 25: Pre-Launch Checklist

#### Task 3.5: Complete Pre-Launch Checklist

**Infrastructure**:
- [ ] Production database backed up
- [ ] Staging environment matches production
- [ ] Environment variables set correctly
- [ ] SSL certificate valid
- [ ] DNS configured
- [ ] CDN enabled (if applicable)

**Security**:
- [ ] All VULN-### issues fixed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] OAuth secrets secure

**Monitoring**:
- [ ] Sentry receiving errors
- [ ] Uptime monitoring configured
- [ ] Database performance monitoring
- [ ] Error alerts configured
- [ ] Backup alerts configured

**Testing**:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Test coverage > 70%
- [ ] Load testing completed

**Features**:
- [ ] Invoice push to QB works
- [ ] Customer sync works (both directions)
- [ ] CSV import works
- [ ] All forms have validation
- [ ] All pages have error handling

**UX**:
- [ ] All ARIA labels added
- [ ] Unsaved changes warning works
- [ ] Loading states visible
- [ ] Error messages helpful
- [ ] Mobile responsive

**Documentation**:
- [ ] User guide complete
- [ ] Admin guide complete
- [ ] Technical docs complete
- [ ] Known issues documented
- [ ] Support contacts listed

---

## PHASE 4: LAUNCH

**Timeline**: Week 6 (Days 26-30)
**Goal**: Deploy to production and monitor
**Owner**: Full team + Stakeholders

### Week 6, Day 26: Soft Launch Preparation

#### Task 4.1: Final Staging Tests
**Time**: 4 hours

**Run full test suite**:
```bash
# Run all tests
npm test
npm run test:e2e

# Check coverage
npm run test:coverage
# Expected: > 70% coverage

# Lighthouse audit
npx lighthouse https://staging.batchly-erp.com --view

# Expected scores:
# Performance: > 90
# Accessibility: > 95
# Best Practices: > 90
# SEO: > 90
```

**Manual testing**:
- [ ] Test all critical workflows
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Test QuickBooks integration end-to-end
- [ ] Test CSV import with real data
- [ ] Test multi-tenant isolation

---

#### Task 4.2: Production Deployment
**Time**: 2 hours

**Deployment steps**:
```bash
# 1. Create production build
npm run build

# 2. Run migrations on production database
npx supabase db push --db-url [production-db-url]

# 3. Deploy edge functions
supabase functions deploy --project-ref [production-project-id]

# 4. Deploy frontend (via Lovable.dev)
# Go to: https://lovable.dev/projects/[project-id]
# Click: Share → Publish

# 5. Verify deployment
curl https://app.batchly-erp.com
# Expected: 200 OK
```

**Post-deployment checks**:
- [ ] App loads without errors
- [ ] Authentication works
- [ ] Database queries work
- [ ] Edge functions respond
- [ ] Sentry receiving data
- [ ] No console errors

---

### Week 6, Day 27-28: Soft Launch (Internal Users)

#### Task 4.3: Invite Initial Users
**Time**: 2 hours

**Create user accounts**:
```sql
-- Create initial users
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES
  ('user1@company.com', crypt('temp-password', gen_salt('bf')), NOW()),
  ('user2@company.com', crypt('temp-password', gen_salt('bf')), NOW()),
  ('user3@company.com', crypt('temp-password', gen_salt('bf')), NOW());

-- Assign to organization
INSERT INTO profiles (id, organization_id, full_name, role)
VALUES
  ('[user1-id]', '[org-id]', 'User One', 'admin'),
  ('[user2-id]', '[org-id]', 'User Two', 'user'),
  ('[user3-id]', '[org-id]', 'User Three', 'user');
```

**Send invitations**:
```
Subject: Welcome to Batchly ERP Beta

Hi [Name],

You've been invited to test Batchly ERP, our new invoice management system with QuickBooks integration.

Login: https://app.batchly-erp.com
Email: [email]
Temporary Password: [password]
(Please change on first login)

User Guide: https://docs.batchly-erp.com/user-guide

Please report any issues to: support@batchly-erp.com

Thanks!
The Batchly Team
```

**Monitoring during soft launch**:
- [ ] Check Sentry dashboard hourly
- [ ] Monitor database performance
- [ ] Watch for error spikes
- [ ] Track user activity
- [ ] Collect user feedback

---

#### Task 4.4: Daily Check-ins
**Time**: 1 hour/day

**Daily review**:
1. Check Sentry for new errors
2. Review user feedback
3. Monitor performance metrics
4. Update issue tracker
5. Plan fixes for critical issues

**Metrics to track**:
- Active users
- Invoices created
- Orders processed
- QB syncs completed
- Errors per user
- Page load times
- User satisfaction

---

### Week 6, Day 29-30: Launch Review & Iteration

#### Task 4.5: Gather Feedback
**Time**: 4 hours

**User interviews** (30 mins each):
- What features do you use most?
- What's confusing?
- What's missing?
- Any bugs encountered?
- How does it compare to previous system?

**Compile feedback**:
```markdown
# Launch Feedback Summary

## Positive Feedback
- Feature X is very helpful
- UI is intuitive
- QB integration saves time

## Issues Reported
1. [BUG] Invoice totals incorrect when... (CRITICAL)
2. [UX] Hard to find customer search (MEDIUM)
3. [FEATURE] Need bulk invoice download (LOW)

## Action Items
- [ ] Fix invoice total calculation
- [ ] Improve customer search visibility
- [ ] Add bulk download to backlog
```

---

#### Task 4.6: Plan Next Iteration
**Time**: 2 hours

**Prioritize backlog**:
1. **Critical Bugs** (fix immediately)
2. **High Priority Features** (next sprint)
3. **UX Improvements** (ongoing)
4. **Nice-to-have** (backlog)

**Create roadmap**:
```markdown
# Batchly ERP Roadmap

## Sprint 1 (Week 7-8)
- Fix critical bugs from launch
- Add QB webhook support
- Implement scheduled sync

## Sprint 2 (Week 9-10)
- Add payment tracking
- Enhance reporting
- Mobile app improvements

## Sprint 3 (Week 11-12)
- Advanced permissions
- Multi-currency support
- API for integrations
```

---

## POST-LAUNCH MAINTENANCE

### Daily Tasks
- [ ] Check Sentry for new errors
- [ ] Monitor database performance
- [ ] Review user feedback
- [ ] Update issue tracker

### Weekly Tasks
- [ ] Review key metrics
- [ ] User check-ins
- [ ] Deploy bug fixes
- [ ] Update documentation

### Monthly Tasks
- [ ] Performance review
- [ ] Security audit
- [ ] Backup verification
- [ ] Feature prioritization

---

## ROLLBACK PLAN

If critical issues arise during launch:

### Rollback Procedure
```bash
# 1. Notify users
# Send email about temporary maintenance

# 2. Roll back frontend
# In Lovable.dev:
# Project Settings → Deployments → Previous Version

# 3. Roll back database (if needed)
psql [connection-string] < backup-schema.sql
psql [connection-string] < backup-data.sql

# 4. Roll back edge functions
supabase functions deploy --project-ref [project-id] [previous-version]

# 5. Verify rollback
curl https://app.batchly-erp.com
# Expected: Previous version working

# 6. Notify users
# Send email: "Issue resolved, app restored"
```

### Rollback Triggers
- Data loss detected
- Security vulnerability discovered
- > 50% users unable to login
- Critical feature completely broken
- Database corruption

---

## SUCCESS METRICS

### Week 1-2 (Internal Alpha)
- **Goal**: Validate core functionality
- **Users**: 3-5
- **Metrics**:
  - Zero data leakage incidents ✅
  - Invoice sync success rate > 95% ✅
  - Users can complete workflows ✅
  - < 5 critical bugs

### Week 3-4 (Internal Beta)
- **Goal**: Expand usage, ensure stability
- **Users**: 10-20
- **Metrics**:
  - < 10 bugs per week ✅
  - Page load times < 2s ✅
  - 99% uptime ✅
  - User satisfaction > 4/5

### Week 5-6 (Soft Launch)
- **Goal**: Production readiness
- **Users**: 20-50
- **Metrics**:
  - 99.5% uptime ✅
  - < 5 support tickets/week ✅
  - Data sync accuracy > 99% ✅
  - User retention > 90%

---

## SUPPORT PLAN

### Support Channels
- **Email**: support@batchly-erp.com
- **Slack**: #batchly-support (internal)
- **Phone**: (for critical issues only)

### Response Times
- **Critical**: 1 hour
- **High**: 4 hours
- **Medium**: 1 business day
- **Low**: 3 business days

### On-Call Rotation
- Week 1-2: Developer + Manager
- Week 3-4: Developer only
- Week 5+: Support team

---

## BUDGET SUMMARY

### One-Time Costs
- Development (Phase 1-3): $19,200 - $43,200
- QA Testing: $0 - $4,800
- **Total One-Time**: $19,200 - $48,000

### Annual Recurring Costs
- Supabase Pro: $300/year
- Sentry: $312/year
- LogRocket: $1,188/year
- Domain + SSL: $50/year
- Support & Maintenance: $28,800/year
- **Total Annual**: $30,650/year

---

## CONCLUSION

This deployment plan provides a structured, 6-week path to production for Batchly ERP. The phased approach ensures:

1. ✅ **Security first** - Critical vulnerabilities fixed in Week 1
2. ✅ **Quality** - Comprehensive testing throughout
3. ✅ **Performance** - Optimizations applied early
4. ✅ **User experience** - Accessibility and UX polish
5. ✅ **Risk mitigation** - Gradual rollout with monitoring

**Key Success Factors**:
- Follow each phase sequentially (don't skip ahead)
- Complete success criteria before advancing
- Monitor closely during soft launch
- Be prepared to roll back if needed
- Gather and act on user feedback

**Next Steps**:
1. Review this plan with stakeholders
2. Get approval and budget
3. Start Phase 1: Security & Infrastructure
4. Schedule weekly review meetings
5. Track progress in GitHub project board

**Questions?** Contact the development team.

---

**Plan Created**: 2025-11-11
**Version**: 1.0
**Owner**: Development Team
**Approved By**: [Pending]
