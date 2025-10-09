# Generate Daily Orders - Technical Specification

## Overview

The `generate-daily-orders` edge function is a Deno-based serverless function that automatically generates sales orders based on pre-configured customer templates. It supports batch processing across multiple dates and customers, making it ideal for recurring order workflows in distribution and wholesale businesses.

**Runtime:** Deno (Supabase Edge Functions)  
**Language:** TypeScript  
**Authentication:** JWT-based (Supabase Auth)  
**Database:** PostgreSQL via Supabase Client

---

## Purpose

This function automates the creation of sales orders by:
- Reading customer-specific order templates
- Applying day-of-week quantity rules
- Preventing duplicate orders
- Creating complete sales orders with line items
- Maintaining proper data isolation per organization

---

## Architecture

### Request Flow

```
Client Request (HTTP POST)
    ↓
CORS Preflight Check
    ↓
JWT Authentication & User Verification
    ↓
Organization ID Resolution
    ↓
Request Payload Parsing
    ↓
[For Each Target Date]
    ↓
    Fetch Active Templates (filtered by customer if specified)
    ↓
    Fetch Customer Profile Data
    ↓
    [For Each Template]
        ↓
        Check for Duplicate Orders
        ↓
        Calculate Day-of-Week Quantities
        ↓
        Create Sales Order Header
        ↓
        Create Line Items (if quantities > 0)
        ↓
        Database Triggers Update Totals
    ↓
Response with Summary
```

---

## Request Specification

### Endpoint
```
POST /functions/v1/generate-daily-orders
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```typescript
interface GenerateOrdersRequest {
  target_date?: string;        // Single date (ISO format: YYYY-MM-DD)
  target_dates?: string[];     // Multiple dates (batch processing)
  customer_id?: string;        // Single customer UUID
  customer_ids?: string[];     // Multiple customer UUIDs
}
```

### Examples

**Single Date, All Customers:**
```json
{
  "target_date": "2025-10-15"
}
```

**Multiple Dates, Specific Customers:**
```json
{
  "target_dates": ["2025-10-15", "2025-10-16", "2025-10-17"],
  "customer_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Default (Today, All Customers):**
```json
{}
```

---

## Data Model

### Key Tables Involved

1. **customer_templates**
   - Stores which customers have order templates
   - Fields: `id`, `customer_id`, `organization_id`, `is_active`, `name`

2. **customer_template_items**
   - Stores items and day-specific quantities
   - Fields: `template_id`, `item_id`, `unit_price`, `monday_qty` through `sunday_qty`

3. **sales_order**
   - Generated order headers
   - Fields: `id`, `customer_id`, `delivery_date`, `status`, `subtotal`, `total`, etc.

4. **sales_order_line_item**
   - Individual line items per order
   - Fields: `sales_order_id`, `item_id`, `quantity`, `unit_price`, `amount`
   - **Note:** `amount` is a GENERATED column (quantity × unit_price)

---

## Processing Logic

### 1. Authentication & Authorization
```typescript
// Verify JWT token
const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

// Fetch organization context
const { data: profile } = await supabaseClient
  .from('profiles')
  .select('organization_id')
  .eq('id', user.id)
  .single();
```

**Security:** All database queries are scoped to the user's organization via RLS policies.

### 2. Template Retrieval
```typescript
// Fetch active templates, optionally filtered by customer IDs
let templatesQuery = supabaseClient
  .from('customer_templates')
  .select('id, customer_id, name')
  .eq('organization_id', organizationId)
  .eq('is_active', true);

if (customerIdsFilter) {
  templatesQuery = templatesQuery.in('customer_id', customerIdsFilter);
}
```

### 3. Duplicate Order Prevention
```typescript
// Call database function to check for existing orders
const { data: duplicateCheck } = await supabaseClient.rpc('check_duplicate_orders', {
  p_customer_id: template.customer_id,
  p_delivery_date: targetDate,
  p_organization_id: organizationId,
});

if (duplicateCheck?.has_duplicate) {
  continue; // Skip this template
}
```

**Database Function:**
```sql
CREATE FUNCTION check_duplicate_orders(
  p_customer_id UUID,
  p_delivery_date DATE,
  p_organization_id UUID
) RETURNS JSON ...
```

### 4. Day-of-Week Quantity Calculation
```typescript
// Map JavaScript day (0-6) to quantity columns
const dayOfWeek = new Date(targetDate).getDay(); // 0=Sunday, 6=Saturday
const dayColumns = [
  'sunday_qty', 'monday_qty', 'tuesday_qty', 
  'wednesday_qty', 'thursday_qty', 'friday_qty', 'saturday_qty'
];
const dayColumn = dayColumns[dayOfWeek];

// Fetch items with quantity for this specific day
const { data: templateItems } = await supabaseClient
  .from('customer_template_items')
  .select(`id, item_id, unit_price, ${dayColumn}`)
  .eq('template_id', template.id);

// Filter to only items with quantity > 0
const itemsWithQuantity = templateItems?.filter(item => item[dayColumn] > 0);
```

### 5. Sales Order Creation
```typescript
// Create order header with initial zero totals
const { data: newOrder } = await supabaseClient
  .from('sales_order')
  .insert({
    organization_id: organizationId,
    customer_id: template.customer_id,
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: targetDate,
    status: 'pending',
    subtotal: 0,  // Triggers will update this
    total: 0,     // Triggers will update this
    is_no_order_today: itemsWithQuantity.length === 0,
    invoiced: false,
    memo: `Auto-generated from template: ${template.name}`,
  })
  .select()
  .single();
```

### 6. Line Item Creation
```typescript
// Create line items only if quantities exist
if (itemsWithQuantity.length > 0) {
  const lineItems = itemsWithQuantity.map(item => ({
    organization_id: organizationId,
    sales_order_id: newOrder.id,
    item_id: item.item_id,
    quantity: item[dayColumn],
    unit_price: item.unit_price,
    // amount is auto-calculated by database (GENERATED column)
  }));

  await supabaseClient
    .from('sales_order_line_item')
    .insert(lineItems);
}
```

### 7. Database Triggers Update Totals
After line items are inserted, PostgreSQL triggers automatically:
- Calculate `amount` for each line item (quantity × unit_price)
- Sum all line item amounts
- Update the sales_order `subtotal` and `total` fields

**Relevant Triggers:**
- `trigger_calculate_line_item_amount()` - Calculates line amounts
- `trigger_update_sales_order_totals()` - Updates order totals

---

## Response Specification

### Success Response (200)
```json
{
  "success": true,
  "orders_created": 230,
  "dates_processed": ["2025-10-15", "2025-10-16"],
  "orders": [
    {
      "order_id": "uuid-1",
      "order_number": "SO-2025-001",
      "customer_id": "uuid-customer-1",
      "customer_name": "ABC Distribution",
      "delivery_date": "2025-10-15",
      "total": 1250.50,
      "is_no_order_today": false,
      "line_items_count": 8
    },
    // ... more orders
  ],
  "errors": []
}
```

### Error Response (401, 404, 500)
```json
{
  "error": "Unauthorized"
}
```

---

## Performance Characteristics

### Batch Processing
- **230 orders generated in ~5 seconds** (actual production data)
- Processes multiple dates sequentially
- Processes templates in parallel within each date

### Database Efficiency
- Single query to fetch all templates per date
- Single query to fetch all customer data
- Batch insert for line items (all items for one order inserted together)
- Automatic total recalculation via triggers (no round-trip queries)

### Optimization Strategies
1. **Customer Data Prefetching:** Fetches all customer profiles in one query using `IN` clause
2. **Map-Based Lookup:** Uses JavaScript `Map` for O(1) customer data lookup
3. **Minimal Round Trips:** Creates orders and line items, then reads back final totals in one query

---

## Error Handling

### Per-Template Error Isolation
```typescript
try {
  // Process template
} catch (error) {
  errors.push({ 
    template_id: template.id, 
    date: targetDate, 
    error: error.message 
  });
  continue; // Don't fail entire batch
}
```

**Result:** One failed template doesn't prevent other orders from being created.

### Error Categories
1. **Authentication Errors (401):** Invalid or missing JWT
2. **Authorization Errors (404):** User profile not found
3. **Duplicate Order Errors:** Silently skipped (logged but not returned as error)
4. **Database Errors:** Captured per-template and returned in `errors` array

---

## Security & Multi-Tenancy

### Row-Level Security (RLS)
All queries automatically filtered by organization:
```sql
CREATE POLICY org_access ON customer_templates
FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));
```

### Organization Isolation
- User's `organization_id` fetched from `profiles` table
- All INSERT operations include `organization_id`
- All SELECT queries filtered by `organization_id`
- Cross-organization data access is **impossible** via RLS

### Authentication Flow
1. Client sends JWT in `Authorization` header
2. Edge function validates JWT via `supabaseClient.auth.getUser()`
3. User's org ID resolved from `profiles` table
4. All subsequent queries scoped to that org

---

## Logging & Observability

### Console Logging Strategy
```typescript
console.log('=== Processing date: 2025-10-15 ===');
console.log('Found 10 active templates for 2025-10-15');
console.log('Processing template <id> for customer <id> on 2025-10-15');
console.log('Creating order: 8 items, no_order: false');
console.log('Order created: <order_id>');
console.log('Created 8 line items');
console.log('=== Generation Complete ===');
console.log('Orders created: 230');
console.log('Errors: 0');
```

**Log Visibility:** Accessible via Supabase Edge Function Logs dashboard.

---

## CORS Configuration

Allows cross-origin requests from web applications:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

---

## Business Rules

### "No Order Today" Flag
- Set to `true` if template has **no items with quantity > 0** for the target day
- Still creates sales order (for tracking/reporting)
- Order total will be $0

### Order Status Lifecycle
1. **Created:** `status = 'pending'`
2. **Reviewed:** Updated manually or via approval workflow
3. **Invoiced:** `invoiced = true`, cannot be deleted

### Duplicate Prevention
- One order per customer per delivery date
- Checked via `check_duplicate_orders()` function
- Existing orders are **skipped**, not updated

---

## Limitations & Constraints

1. **Sequential Date Processing:** Dates processed one at a time (not parallel)
2. **No Partial Rollback:** If order creation fails, successful orders remain
3. **Template Requirement:** Customers must have active templates
4. **Day-of-Week Only:** No support for date-specific overrides (e.g., holidays)
5. **Single Organization:** Cannot generate orders across multiple organizations in one call

---

## Future Enhancement Opportunities

1. **Parallel Date Processing:** Use `Promise.all()` for concurrent date handling
2. **Webhook Notifications:** Trigger events when orders are created
3. **Validation Rules:** Price limits, quantity limits, customer credit checks
4. **Holiday Calendar:** Skip or adjust orders for holidays
5. **Retry Logic:** Automatic retry for transient database errors
6. **Rate Limiting:** Prevent abuse via rate limiting middleware

---

## Example Usage Scenarios

### Scenario 1: Daily Batch Generation
**Use Case:** Run nightly at 11 PM to generate tomorrow's orders for all customers.

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-daily-orders \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target_date": "2025-10-16"}'
```

### Scenario 2: Weekly Advance Planning
**Use Case:** Generate orders for the next 7 days every Monday morning.

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-daily-orders \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_dates": [
      "2025-10-15", "2025-10-16", "2025-10-17",
      "2025-10-18", "2025-10-19", "2025-10-20", "2025-10-21"
    ]
  }'
```

### Scenario 3: Specific Customer Orders
**Use Case:** Generate orders for VIP customers only.

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-daily-orders \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_date": "2025-10-15",
    "customer_ids": ["uuid-1", "uuid-2", "uuid-3"]
  }'
```

---

## Dependencies

### Runtime Dependencies
- **Supabase JS Client:** `@supabase/supabase-js@2.50.5`
- **Deno Runtime:** Latest stable

### Database Dependencies
- **Functions:** `check_duplicate_orders()`, `get_user_organization_id()`
- **Triggers:** `trigger_update_sales_order_totals()`, `trigger_calculate_line_item_amount()`
- **Policies:** RLS policies on all referenced tables

---

## Testing Recommendations

### Unit Tests
- Mock Supabase client responses
- Test day-of-week calculation logic
- Validate duplicate detection logic

### Integration Tests
- Test with real database (Supabase local dev)
- Verify trigger execution
- Confirm RLS policy enforcement

### Load Tests
- Generate 1000+ orders to measure performance
- Test concurrent requests (multiple users)
- Monitor database connection pool

---

## Deployment

### Automatic Deployment
Edge functions are automatically deployed when code is pushed to the repository (via Supabase CLI or Git integration).

### Environment Variables Required
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: Public anon key (for client creation)

### Monitoring
- Check Edge Function Logs in Supabase Dashboard
- Monitor execution time and error rates
- Set up alerts for failures

---

## Contact & Support

For questions about this function, refer to:
- **Project Documentation:** `/docs`
- **Database Schema:** `/supabase/migrations`
- **Edge Functions:** `/supabase/functions/generate-daily-orders`

---

**Version:** 1.0  
**Last Updated:** 2025-10-09  
**Maintained By:** Batchly Development Team
