# Guide: Deleting Obsolete Supabase Functions

## Quick Method (Using the Script)

1. Make sure you have the Supabase CLI installed locally
2. Run the deletion script:
   ```bash
   ./delete-obsolete-functions.sh
   ```

## Manual Method (Using Supabase CLI)

If you prefer to delete functions manually, run these commands:

```bash
# Set your project reference
PROJECT_REF="pnqcbnmrfzqihymmzhkb"

# Delete each obsolete function
supabase functions delete qbo-oauth --project-ref $PROJECT_REF
supabase functions delete qbo-webhook --project-ref $PROJECT_REF
supabase functions delete createInvoice --project-ref $PROJECT_REF
supabase functions delete deleteInvoice --project-ref $PROJECT_REF
supabase functions delete getInvoice --project-ref $PROJECT_REF
supabase functions delete listInvoices --project-ref $PROJECT_REF
supabase functions delete syncInvoice --project-ref $PROJECT_REF
supabase functions delete updateInvoice --project-ref $PROJECT_REF
supabase functions delete generate-test-sales-orders --project-ref $PROJECT_REF
supabase functions delete batch-processor --project-ref $PROJECT_REF
supabase functions delete process-batch-jobs --project-ref $PROJECT_REF
supabase functions delete trigger-batch-processing --project-ref $PROJECT_REF
supabase functions delete convert-order-to-invoice --project-ref $PROJECT_REF
supabase functions delete create-invoice-from-order --project-ref $PROJECT_REF
supabase functions delete clear-sales-orders --project-ref $PROJECT_REF
```

## Alternative: Using Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/pnqcbnmrfzqihymmzhkb/functions
2. Click on each function below and delete it:
   - qbo-oauth
   - qbo-webhook
   - createInvoice
   - deleteInvoice
   - getInvoice
   - listInvoices
   - syncInvoice
   - updateInvoice
   - generate-test-sales-orders
   - batch-processor
   - process-batch-jobs
   - trigger-batch-processing
   - convert-order-to-invoice
   - create-invoice-from-order
   - clear-sales-orders

## Why These Functions Are Being Deleted

These 15 functions are obsolete because:
- Their source code has been removed from the repository
- They have been replaced by newer, improved functions
- They are duplicates of existing functionality
- They use outdated APIs that have been refactored

## Remaining Active Functions (25)

After deletion, you'll have these 25 active functions:
1. qbo-oauth-callback
2. qbo-oauth-initiate
3. qbo-sync-customers
4. qbo-sync-items
5. qbo-sync-invoices
6. qbo-sync-payments
7. qbo-token-refresh
8. qbo-webhook-handler
9. qbo-disconnect
10. qbo-continue-sync-sessions
11. qbo-initial-sync
12. batch-invoice-orders
13. generate-test-orders
14. generate-daily-orders
15. generate-template-test-data
16. import-csv-data
17. clear-pending-orders
18. clear-customers
19. clear-items
20. clear-invoices
21. clear-all-data
22. send-portal-invitation
23. create-impersonation-token
24. validate-impersonation-token
25. save-secret

## Next Steps

After deleting these functions, consider:
1. Fixing the webhook signature validation in `qbo-webhook-handler`
2. Fixing or removing the `save-secret` function (it doesn't persist secrets properly)
3. Adding production safeguards to the `clear-*` functions
