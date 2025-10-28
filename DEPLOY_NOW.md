# Batchly - Deploy in 1 Day (Absolute Minimum)

**Goal:** Get Batchly running for your business TODAY
**Time Required:** 3-4 hours total
**Philosophy:** Ship fast, fix as you go

---

## Hour 1: Deploy & Access (60 min)

### Step 1: Deploy App (15 min)
```
1. Go to: https://lovable.dev/projects/3274bdad-c9e4-429c-9ae4-5beb2ed291db
2. Click "Share" → "Publish"
3. Copy your production URL
4. Bookmark it
```

**Test:** Can you load the URL and see the login page?

---

### Step 2: Create Account (5 min)
```
1. Click "Sign Up"
2. Enter your email and password
3. Verify email (check inbox)
4. Login
```

**Test:** You should see the dashboard

---

### Step 3: Verify Supabase is Working (10 min)
```
1. Check Supabase project dashboard
2. Go to Table Editor
3. Verify you see: organizations, customer_profiles, items, etc.
4. Check Authentication → Users → You should see your user
```

**Test:** Your account exists in database

---

### Step 4: Add Your Team (Optional - 10 min)
```
1. Go to Settings → Team
2. Click "Invite User"
3. Enter email, select role (Admin/Manager/User)
4. Send invitation
5. Team member checks email and signs up
```

**Test:** Team member can login

**Skip if:** You're the only user for now

---

### Step 5: Set Up Monitoring (20 min)
```
1. Sign up for UptimeRobot (free): https://uptimerobot.com
2. Add monitor for your production URL
3. Set alert email to yours
4. Test: Verify you get email when you pause monitor
```

**Why:** You'll know immediately if site goes down

**Skip if:** You're checking the app daily anyway (just check manually)

---

## Hour 2: Import Your Data (60 min)

### Step 6: Add Items/Products (20 min)

**Option A - Manual Entry (Fastest for <20 items):**
```
1. Navigate to "Items"
2. Click "New Item"
3. Enter: SKU, Name, Description, Price
4. Repeat for your top 10-20 items
```

**Option B - QuickBooks Sync (Best if using QB):**
```
Skip for now, do in Step 8
```

**Test:** You have items in the system

---

### Step 7: Add Customers (20 min)

**Option A - Manual Entry (Fastest for <10 customers):**
```
1. Navigate to "Customers"
2. Click "New Customer"
3. Enter: Name, Email, Phone, Address
4. Repeat for 5-10 key customers
```

**Option B - QuickBooks Sync (Best if using QB):**
```
Skip for now, do in Step 8
```

**Option C - Bulk Import (If you have many customers):**
```
1. Export customers from current system to CSV
2. Open Supabase → Table Editor → customer_profiles
3. Use CSV import feature
4. Map columns: name, email, phone, billing_address, etc.
5. Import
```

**Test:** You have customers in the system

---

### Step 8: Connect QuickBooks (20 min)

**If you use QuickBooks Online:**
```
1. Navigate to "QuickBooks" in Batchly
2. Click "Connect to QuickBooks"
3. Login with your QuickBooks account
4. Click "Authorize"
5. You'll be redirected back to Batchly
6. Click "Sync Customers" (pulls customers from QB)
7. Click "Sync Items" (pulls items from QB)
8. Wait for sync to complete (1-2 minutes)
9. Check Customers and Items - did they import?
```

**If you don't use QuickBooks:**
```
Skip this step entirely
```

**Test:** Your QuickBooks data appears in Batchly

---

## Hour 3: Test Core Workflow (60 min)

### Step 9: Create Your First Order (15 min)
```
1. Navigate to "Orders"
2. Click "New Order"
3. Select customer (dropdown)
4. Set delivery date (today or tomorrow)
5. Add line items:
   - Search for item
   - Enter quantity
   - Price should auto-populate
   - Click "Add"
6. Review totals at bottom (subtotal, tax, total)
7. Click "Save Draft"
```

**Test:** Order appears in orders list

---

### Step 10: Approve Order (5 min)
```
1. Find your order in the list
2. Click on it to open
3. Click "Approve" button
4. Status changes to "Approved"
```

**Test:** Order status = Approved

---

### Step 11: Create Invoice (10 min)
```
1. Navigate to "Invoices"
2. Click "Invoice Orders" button
3. Select date range (today)
4. System shows approved orders
5. Select your order (checkbox)
6. Click "Create Invoices"
7. Wait for processing (5-10 seconds)
8. Invoice appears in invoices list
```

**Test:** Invoice created with sequential invoice number (e.g., INV-0001)

---

### Step 12: Sync Invoice to QuickBooks (10 min)

**If using QuickBooks:**
```
1. From invoices list, find your invoice
2. Click "Sync to QuickBooks" button
3. Wait for sync (5-10 seconds)
4. Open QuickBooks in another tab
5. Navigate to Sales → Invoices
6. Find your invoice (search by invoice number)
7. Verify data matches Batchly
```

**If not using QuickBooks:**
```
Skip this step
```

**Test:** Invoice exists in QuickBooks with correct data

---

### Step 13: Test PDF Export (Optional - 10 min)
```
1. From invoices list, click on your invoice
2. Click "Download PDF" button
3. PDF downloads to your computer
4. Open PDF
5. Review formatting and data
```

**Test:** PDF looks professional and has correct data

---

### Step 14: End-to-End Test (10 min)
```
Run through the full workflow one more time:
1. Create order → 2 min
2. Approve order → 30 sec
3. Create invoice → 1 min
4. Sync to QB (optional) → 1 min
Total: ~5 minutes per order

Time yourself. This is your baseline.
```

**Test:** You can complete the workflow confidently

---

## Hour 4: Production Ready (60 min)

### Step 15: Set Up Customer Templates (30 min)

**If you have recurring orders:**
```
1. Navigate to "Customers"
2. Click on a customer
3. Go to "Templates" tab
4. Click "New Template"
5. Name it (e.g., "Weekly Standard Order")
6. Add items:
   - Search for item
   - Set quantities for each day of week
     - Monday: 10
     - Tuesday: 10
     - Wednesday: 0 (no order)
     - Thursday: 10
     - Friday: 15
     - Saturday: 0
     - Sunday: 0
   - Set price
   - Click "Add Item"
7. Repeat for all items
8. Toggle "Active" = ON
9. Save template
10. Repeat for 2-3 more customers
```

**Test:** Run "Generate Daily Orders" - orders created with correct quantities

**If you don't have recurring orders:**
```
Skip this step - just create orders manually
```

---

### Step 16: Test Batch Operations (20 min)

**If you process 10+ orders per day:**
```
1. Create 10 test orders (manually or via templates)
2. Approve all 10 (use bulk select)
3. Navigate to Invoices → "Invoice Orders"
4. Select all 10 orders
5. Click "Create Invoices"
6. Verify all 10 invoices created
7. Check invoice numbers are sequential (no gaps)
8. Sync all to QuickBooks (optional)
```

**Test:** Batch processing works for your volume

**If you process <10 orders per day:**
```
Skip batch testing - process orders one by one
```

---

### Step 17: Document Your Workflow (10 min)
```
Write down your daily process:
1. 8:00 AM - Generate daily orders (if using templates)
2. 8:05 AM - Review generated orders, adjust quantities
3. 8:15 AM - Approve all orders
4. 8:20 AM - Create invoices from approved orders
5. 8:25 AM - Sync invoices to QuickBooks
6. 8:30 AM - Done!

Save this in Google Doc or email to yourself
```

---

## You're Live! 🚀

### Checklist Before Going Live:
- [x] App deployed and accessible
- [x] You can login
- [x] Items imported (at least top 10-20)
- [x] Customers imported (at least 5-10)
- [x] QuickBooks connected (if using)
- [x] Created test order → invoice → QB sync successfully
- [x] Understand daily workflow
- [x] Uptime monitoring configured (or checking daily)

### Start Using It:
- **Tomorrow:** Process 1-5 real orders
- **Day 2:** Process all orders through Batchly
- **Week 1:** Use exclusively, note issues and improvements
- **Week 2-4:** Iterate on pain points
- **Month 2:** Ready to show others

---

## What to Do When Things Break

### Site is Down:
1. Check UptimeRobot alert (if configured)
2. Check Supabase status: https://status.supabase.com
3. Check Lovable status (if deployed there)
4. Fallback: Use spreadsheet, enter orders later

### QuickBooks Sync Fails:
1. Check QuickBooks connection status (Settings → QuickBooks)
2. Try disconnecting and reconnecting
3. Check Supabase logs for error messages
4. Fallback: Manually enter in QuickBooks

### Batch Invoice Creation Fails:
1. Check browser console for errors (F12)
2. Try invoicing orders one-by-one
3. Check Supabase logs
4. Fallback: Manual invoicing

### Data Loss:
1. Go to Supabase → Database → Backups
2. Restore from latest backup
3. Re-enter any data from after backup timestamp
4. Future: Export CSV weekly

---

## Emergency Contacts & Resources

**Supabase Issues:**
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs
- Status: https://status.supabase.com

**QuickBooks Issues:**
- Developer Hub: https://developer.intuit.com
- Support: https://help.developer.intuit.com

**Lovable Issues:**
- Dashboard: https://lovable.dev/projects/3274bdad-c9e4-429c-9ae4-5beb2ed291db
- Support: Via Lovable chat/support

**Batchly Issues:**
- Check GitHub repo for code
- Review documentation in repo
- Debug using browser console (F12)

---

## Performance Expectations

**Your First Day:**
- Creating first order: 10 minutes (learning)
- Creating subsequent orders: 2-3 minutes each
- Bulk invoice 10 orders: 2 minutes

**After 1 Week:**
- Creating order: 1-2 minutes
- Approving orders: 10 seconds each (or bulk: 30 seconds)
- Bulk invoice 50 orders: 3-5 minutes
- Daily workflow: 15-30 minutes total

**Time Savings:**
- Old process: 2-3 hours/day (manual entry)
- New process: 15-30 minutes/day
- **Savings: 1.5-2.5 hours per day** = 7-12 hours per week

---

## First Week Goals

### Day 1 (Today):
- [x] Deploy app
- [x] Import data
- [x] Test core workflow
- [x] Process 1-3 real orders

### Day 2:
- [ ] Process all orders through Batchly (no spreadsheet)
- [ ] Note any issues or confusion
- [ ] Fix critical bugs if found

### Day 3:
- [ ] Set up customer templates (if using)
- [ ] Test daily order generation
- [ ] Process orders end-to-end

### Day 4:
- [ ] Train team member (if applicable)
- [ ] Process orders with team member watching
- [ ] Collect feedback

### Day 5:
- [ ] Review week 1 experience
- [ ] List improvements needed
- [ ] Prioritize top 3 improvements
- [ ] Plan week 2 iteration

---

## Success Indicators

**You're successful if:**
- ✅ You processed real orders through Batchly
- ✅ Orders synced to QuickBooks successfully (if using)
- ✅ No data loss or critical errors
- ✅ You saved time compared to old process
- ✅ Team understands how to use it

**Warning signs:**
- ⚠️ Orders taking longer than before (workflow issue)
- ⚠️ Frequent errors or crashes (stability issue)
- ⚠️ Data doesn't match QuickBooks (sync issue)
- ⚠️ Team resists using it (UX issue)

---

## Quick Reference: Daily Workflow

```
MORNING ROUTINE (15-30 min):

1. Login to Batchly
   ↓
2. Generate Daily Orders (if using templates)
   - Click "Orders" → "Generate Daily Orders"
   - Select today's date
   - Click "Generate"
   ↓
3. Review & Adjust Orders
   - Filter by delivery date = today
   - Check quantities, adjust if needed
   - Add/remove line items as needed
   ↓
4. Approve Orders
   - Select all reviewed orders (checkbox)
   - Click "Bulk Approve"
   ↓
5. Create Invoices
   - Click "Invoices" → "Invoice Orders"
   - Select today's date range
   - Select all orders
   - Click "Create Invoices"
   ↓
6. Sync to QuickBooks (if using)
   - Click "Sync to QuickBooks"
   - Wait for sync to complete
   - Verify in QuickBooks
   ↓
7. Done! ☕️
```

---

## Next Steps After Launch

### Week 2-4: Iterate
- Fix bugs found in week 1
- Add most-requested features
- Optimize workflow based on real use
- Train additional team members

### Month 2: Stabilize
- System is reliable and fast
- Team uses it without asking for help
- No critical issues for 2+ weeks
- Ready to show to others

### Month 3: Expand
- Invite 1-2 friendly beta customers
- Collect their feedback
- Make improvements
- Prepare for broader launch

---

**You got this! Deploy today, iterate tomorrow. 🚀**

---

## Appendix: Common Issues & Fixes

### Issue: Can't login after signup
**Fix:** Check email for verification link, click it, then try login

### Issue: Items not showing in order creation
**Fix:** Check Items page - are they marked as "Active"? Toggle active = ON

### Issue: Orders not generating from templates
**Fix:** Check template is marked as "Active" and customer is "Active"

### Issue: Invoice numbers not sequential
**Fix:** Database function handles this - check Supabase logs for errors

### Issue: QuickBooks sync button missing
**Fix:** Verify QuickBooks is connected (Settings → QuickBooks)

### Issue: Slow performance
**Fix:** Check internet connection, check Supabase status, try different browser

### Issue: Can't see other team member's data
**Fix:** This is expected! Each user sees only their organization's data. Verify you're in the same organization.

---

**Last Updated:** October 28, 2025
**Version:** 1.0 (Internal Launch)
