# BATCHLY PROJECT KNOWLEDGE BASE

## PROJECT OVERVIEW
Batchly is a comprehensive ERP application built with React, TypeScript, Tailwind CSS, and Supabase. It manages sales orders, customer templates, invoices, items, and QuickBooks integration for multi-tenant organizations.

## TECHNOLOGY STACK
- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **State Management**: TanStack Query for server state
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS with HSL semantic tokens
- **UI Components**: shadcn/ui with custom variants

## PROJECT STRUCTURE
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   └── [feature]/      # Feature-specific components
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
├── pages/              # Route-level components
└── lib/                # Utility functions
```

## CRITICAL DATABASE CONSTRAINTS

### Sales Order Line Items
- **NEVER UPDATE `amount` MANUALLY**: The `amount` column is calculated automatically from `quantity * unit_price`
- Use database triggers for calculations, not frontend logic
- Always update quantities through proper mutation patterns
- Validation trigger: `validate_sales_order_totals()` ensures totals match line items

### Organization Isolation
- ALL tables have `organization_id` for multi-tenancy
- RLS policies enforce organization-level data access
- Use `get_user_organization_id(auth.uid())` for RLS policies
- Cross-organization references are blocked by triggers

### Authentication
- Two auth contexts: `useAuth` (basic) and `useAuthProfile` (with profile data)
- User profiles created automatically via `handle_new_user()` trigger
- Organization invitations handled through `organization_invitations` table

## KNOWN CRITICAL ISSUES

### 1. Sales Order Quantity Editing
**Problem**: "Failed to update quantity" errors due to manual total calculations
**Root Cause**: Frontend attempts to manually update `amount` and `total` fields
**Solution**: Let database triggers handle all calculations automatically

### 2. Database Total Validation
**Problem**: `validate_sales_order_totals()` trigger rejects manual total updates
**Solution**: Only update `quantity` and `unit_price`, never `amount` or totals

### 3. RLS Policy Conflicts
**Problem**: Infinite recursion in policies referencing same table
**Solution**: Use SECURITY DEFINER functions for cross-table queries

## DEVELOPMENT PATTERNS

### Database Mutations
```typescript
// ✅ CORRECT: Update only quantities
const { error } = await supabase
  .from('sales_order_line_item')
  .update({ quantity: newQuantity })
  .eq('id', lineItemId);

// ❌ WRONG: Never update amounts manually
const { error } = await supabase
  .from('sales_order_line_item')
  .update({ 
    quantity: newQuantity,
    amount: quantity * unitPrice  // Database will handle this
  });
```

### Error Handling
- Always use try-catch with meaningful error messages
- Log errors to console for debugging
- Show user-friendly toast notifications
- Implement retry mechanisms for transient failures

### State Management
- Use TanStack Query for all server state
- Invalidate queries after mutations using `queryClient.invalidateQueries`
- Implement optimistic updates for better UX
- Use proper loading and error states

## STYLING CONVENTIONS

### Design System
- Use HSL semantic tokens from `index.css`
- Never use direct colors like `text-white` or `bg-black`
- Create component variants instead of inline styles
- Follow shadcn/ui component patterns

### Color Usage
```css
/* ✅ CORRECT: Use semantic tokens */
.button { @apply bg-primary text-primary-foreground; }

/* ❌ WRONG: Direct colors */
.button { @apply bg-blue-500 text-white; }
```

## COMMON PITFALLS

### 1. Manual Total Calculations
- Never calculate totals in frontend code
- Trust database triggers and constraints
- Only update base values (quantity, unit_price)

### 2. Organization Context Missing
- Always ensure `organization_id` is set on inserts
- Use RLS policies to enforce organization isolation
- Check user's organization context before operations

### 3. Auth Context Confusion
- Use `useAuthProfile` for organization-aware operations
- Use `useAuth` only for basic authentication checks
- Ensure user is loaded before accessing organization data

### 4. Query Invalidation
- Always invalidate related queries after mutations
- Use specific query keys for efficient invalidation
- Handle loading states during refetch operations

## DEBUGGING GUIDELINES

### Sales Order Issues
1. Check console for database constraint violations
2. Verify organization_id matches user's organization
3. Ensure line items exist before updating totals
4. Check RLS policies are not blocking operations

### Authentication Issues
1. Verify user session exists in `useAuth`
2. Check organization_id in user profile
3. Ensure RLS policies allow the operation
4. Validate JWT claims and organization context

### Database Errors
1. Check Supabase logs for constraint violations
2. Verify foreign key relationships
3. Check trigger execution order
4. Validate data types and precision

## PERFORMANCE CONSIDERATIONS

### Query Optimization
- Use select() to limit returned columns
- Implement pagination for large datasets
- Use proper indexes on frequently queried columns
- Batch related operations when possible

### Frontend Performance
- Implement proper loading states
- Use React.memo for expensive components
- Debounce user input for search/filter operations
- Cache computed values with useMemo

## INTEGRATION POINTS

### QuickBooks Online
- OAuth flow handled by edge functions
- Sync queue manages bi-directional data flow
- Entity mapping tracks QBO ↔ Batchly relationships
- Webhook handlers process QBO updates

### Customer Portal
- Separate authentication context for customers
- Customer-specific RLS policies
- Payment method management
- Order history and status tracking

## CURRENT PRIORITY AREAS

### Phase 1: Critical Fixes (IN PROGRESS)
- Fix sales order quantity editing system
- Implement proper database triggers for calculations
- Enhance error handling and user feedback

### Phase 2: Core Features (NEXT)
- Complete invoice management system
- Enhance customer template functionality
- Improve item catalog management

### Phase 3: Advanced Features (FUTURE)
- Advanced reporting and analytics
- Mobile responsive improvements
- Automated workflows and notifications

## SUCCESS METRICS
- Zero "Failed to update quantity" errors
- Sub-200ms response times for CRUD operations
- 100% organization data isolation
- Comprehensive error logging and monitoring

## DEBUGGING COMMANDS
```bash
# View sales order related logs
SELECT * FROM postgres_logs WHERE event_message LIKE '%sales_order%' ORDER BY timestamp DESC;

# Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'sales_order_line_item';

# Verify organization isolation
SELECT DISTINCT organization_id FROM sales_order WHERE customer_id = '<customer_id>';
```

---

**Last Updated**: January 2025
**Status**: Active Development - Sales Order System Fix in Progress