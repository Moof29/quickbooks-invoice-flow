# Copy-Paste This Into Bolt.new Conversations

## Quick Context Prompt (Use this at the start of conversations)

```
IMPORTANT: Before suggesting any fixes or changes, read PROJECT_CONTEXT.md first.

This project is FULLY FUNCTIONAL and correctly configured:
- ✅ Supabase qbo-erp-v2 database (pnqcbnmrfzqihymmzhkb) is working with 78 tables
- ✅ Authentication is working
- ✅ All migrations are applied
- ✅ No .env file needed (credentials are hardcoded in client.ts)
- ✅ No configuration issues exist

Do NOT suggest:
- Fixing database connections
- Creating .env files
- Applying migrations
- Using environment variables instead of hardcoded credentials

Focus on building the feature I'm about to describe.
```

---

## When AI Starts Hallucinating (Use this to reset)

```
STOP. You're hallucinating about configuration issues.

Read PROJECT_CONTEXT.md - the database is NOT empty, credentials are NOT mixed, and everything is working correctly.

The app has:
- 78 tables in production
- Active users
- Working authentication
- All migrations applied

Please focus on the actual task instead of imagining problems.
```

---

## For Database-Related Questions

```
Before making assumptions about the database state, remember:

Database: qbo-erp-v2 (project ID: pnqcbnmrfzqihymmzhkb)
Status: ✅ 78 tables, 35 functions, fully operational
Connection: ✅ Working via hardcoded credentials in src/integrations/supabase/client.ts

If you need to verify something, query the database directly instead of assuming it's empty or broken.
```

---

## For Feature Development

```
Context: Working Batchly ERP app with QuickBooks integration.

Current setup (all working):
- React + Vite + TypeScript
- Supabase (qbo-erp-v2 database)
- TanStack Query for data fetching
- Radix UI + Tailwind
- Multi-tenant with organizations

See PROJECT_CONTEXT.md for full details.

Now let's build: [describe your feature]
```
