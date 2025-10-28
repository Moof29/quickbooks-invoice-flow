# Batchly Quick Reference Card

**Print this and keep it by your desk!**

---

## Daily Workflow (15 min)

```
1. Generate Orders      → Orders > Generate Daily Orders > Select Date > Generate
2. Review Orders        → Orders > Filter by delivery date > Adjust quantities
3. Approve Orders       → Select all > Bulk Approve
4. Create Invoices      → Invoices > Invoice Orders > Select Date > Create Invoices
5. Sync QuickBooks      → Click "Sync to QuickBooks" button
6. Done! ☕️
```

---

## Common Tasks

### Create Manual Order
```
Orders > New Order
  → Select customer
  → Set delivery date
  → Add line items (search item, enter qty)
  → Save Draft
  → Review
  → Approve
```

### Create Invoice from Order
```
Invoices > Invoice Orders
  → Select date range
  → Check orders to invoice
  → Create Invoices
```

### Add New Customer
```
Customers > New Customer
  → Name, Email, Phone, Address
  → Save
```

### Add New Item
```
Items > New Item
  → SKU, Name, Description, Price
  → Save
```

### Create Customer Template
```
Customers > Click Customer > Templates Tab > New Template
  → Name template
  → Add items with day-of-week quantities
  → Set Active = ON
  → Save
```

### Sync QuickBooks
```
QuickBooks Page
  → Sync Customers (pull from QB)
  → Sync Items (pull from QB)
  → Sync Invoices (push to QB)
```

---

## Keyboard Shortcuts (Future Enhancement)

```
Ctrl+N      New Order
Ctrl+S      Save
Ctrl+A      Select All
Ctrl+F      Search
Esc         Close Dialog
```

---

## Status Meanings

### Order Statuses:
- **Draft** = Not yet approved, can edit
- **Approved** = Ready to invoice, cannot edit
- **Invoiced** = Converted to invoice

### Invoice Statuses:
- **Draft** = Not sent to customer
- **Sent** = Sent to customer, unpaid
- **Paid** = Payment received
- **Partial** = Partially paid
- **Overdue** = Past due date
- **Cancelled** = Voided

---

## Troubleshooting

### Order not generating from template?
- Check: Template Active = ON
- Check: Customer Active = ON
- Check: Items Active = ON
- Check: Today matches day-of-week with qty > 0

### QuickBooks sync failing?
- Check: QuickBooks connected (Settings > QuickBooks)
- Try: Disconnect and reconnect
- Check: QuickBooks credentials not expired

### Invoice numbers skipping?
- This is normal if invoice creation failed
- Sequential numbers guaranteed, but gaps OK

### Can't edit approved order?
- By design! Approved orders are locked
- Option: Duplicate order, edit copy

### Totals look wrong?
- Check: Quantities correct?
- Check: Prices correct?
- Check: Tax rate configured?
- Note: Subtotal + Tax - Discount = Total

---

## Support & Resources

**Production URL:** [Your URL Here]

**Supabase Dashboard:** https://supabase.com/dashboard

**QuickBooks:** https://qbo.intuit.com

**Documentation:** Check repo for detailed docs

**Emergency Contact:** [Your contact info]

---

## Best Practices

✅ **DO:**
- Generate orders in morning (8-9 AM)
- Review before approving
- Bulk approve/invoice when possible
- Export data weekly (backup)
- Note bugs and feature requests

❌ **DON'T:**
- Edit approved orders (duplicate instead)
- Delete customers with historical orders
- Forget to sync QuickBooks
- Skip backups

---

## Performance Benchmarks

**Target Times:**
- Create order: 1-2 min
- Approve 10 orders: 30 sec
- Invoice 50 orders: 3-5 min
- Daily workflow: 15-30 min total

**If slower, investigate:**
- Internet connection
- Supabase status
- Browser performance (try Chrome)

---

## Weekly Checklist

### Monday:
- [ ] Generate orders for week
- [ ] Review and adjust quantities
- [ ] Approve and invoice

### Daily:
- [ ] Generate daily orders
- [ ] Approve and invoice
- [ ] Sync to QuickBooks

### Friday:
- [ ] Export data to CSV (backup)
- [ ] Review week's orders and invoices
- [ ] Note any issues for improvement

---

## Monthly Checklist

### End of Month:
- [ ] Review total orders processed
- [ ] Review total revenue
- [ ] Check for outstanding invoices (overdue)
- [ ] Calculate time saved vs. old process
- [ ] List top 3 improvements needed
- [ ] Export month's data (CSV backup)

---

## Feature Requests & Bugs

**Keep a running list:**
```
BUGS:
1. [Description of bug]
2. [Description of bug]

FEATURE REQUESTS:
1. [Feature you want]
2. [Feature you want]

IMPROVEMENTS:
1. [Process improvement idea]
2. [Process improvement idea]
```

**Review monthly and prioritize**

---

## Data Export (Manual Backup)

**Weekly Backup Process:**
```
1. Customers: Customers page > Export to CSV
2. Items: Items page > Export to CSV
3. Orders: Orders page > Filter by date > Export to CSV
4. Invoices: Invoices page > Filter by date > Export to CSV

Save to Google Drive / Dropbox / Email to yourself
```

---

## Key Metrics to Track

**Efficiency Metrics:**
- Orders processed per day
- Time spent on order processing
- Errors per 100 orders
- Time saved vs. old process

**Business Metrics:**
- Total orders (MTD, YTD)
- Total revenue (MTD, YTD)
- Average order value
- Top customers by revenue
- Top items by quantity

**Quality Metrics:**
- Order accuracy rate
- Invoice accuracy rate
- Customer complaints
- QuickBooks sync success rate

---

## Expansion Readiness Checklist

**Ready to show others when:**
- [ ] Used internally for 1+ month
- [ ] No critical bugs for 2+ weeks
- [ ] Team uses confidently
- [ ] Documented time/cost savings
- [ ] 5+ customer templates working
- [ ] QuickBooks sync reliable
- [ ] Processed 100+ orders successfully

---

**Version:** 1.0
**Last Updated:** October 28, 2025
**For:** Internal Use
