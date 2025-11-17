#!/bin/bash

# Script to delete obsolete Supabase functions
# Run this script locally where you have the Supabase CLI installed

PROJECT_REF="pnqcbnmrfzqihymmzhkb"

echo "=== Deleting 15 Obsolete Supabase Functions ==="
echo ""

# Array of functions to delete
FUNCTIONS=(
  "qbo-oauth"
  "qbo-webhook"
  "createInvoice"
  "deleteInvoice"
  "getInvoice"
  "listInvoices"
  "syncInvoice"
  "updateInvoice"
  "generate-test-sales-orders"
  "batch-processor"
  "process-batch-jobs"
  "trigger-batch-processing"
  "convert-order-to-invoice"
  "create-invoice-from-order"
  "clear-sales-orders"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

for func in "${FUNCTIONS[@]}"; do
  echo "Deleting function: $func"

  if supabase functions delete "$func" --project-ref "$PROJECT_REF" 2>&1; then
    echo "✓ Successfully deleted: $func"
    ((SUCCESS_COUNT++))
  else
    echo "✗ Failed to delete: $func"
    ((FAIL_COUNT++))
  fi

  echo ""
  sleep 1  # Brief pause between deletions to avoid rate limiting
done

echo "=== Deletion Summary ==="
echo "Successfully deleted: $SUCCESS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""
echo "Note: If some functions failed because they don't exist, that's okay - they may have already been deleted."
