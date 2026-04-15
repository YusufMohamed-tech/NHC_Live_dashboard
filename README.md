# NHC Mystery Shopper Dashboard

Production-oriented React + Supabase dashboard for:

- Super Admin management
- Admin operations (shoppers, visits, reports, points)
- Shopper workflows (assigned visits, completion flow, reports)

## Tech Stack

- React 18 + Vite
- Supabase (Postgres + Realtime)
- Tailwind CSS
- Recharts + jsPDF

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project with SQL Editor access

## Environment Variables

Create `.env` from `.env.example` and fill values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPERADMIN_EMAIL`
- `VITE_SUPERADMIN_PASSWORD`
- `VITE_SUPERADMIN_NAME`

## Database Setup (Required)

Run migrations in this order inside Supabase SQL Editor:

1. `supabase/migrations/20260409_add_visit_files.sql`
2. `supabase/migrations/20260410_add_global_app_state.sql`
3. `supabase/migrations/20260411_finalize_production_schema.sql`
4. `supabase/migrations/20260411_storage_and_static_seed.sql`
5. `supabase/migrations/20260415_add_shopper_personal_email.sql`
6. `supabase/migrations/20260415_connect_ops_and_shopper_phones.sql`
7. `supabase/migrations/20260416_remove_visit_attachments.sql`

Notes:

- Migrations are written to be idempotent and safe for repeated runs.
- Latest migration removes visit attachments (`visits.file_urls`) and storage policies/bucket.

## Local Development

Install dependencies:

```bash
npm install
```

Windows PowerShell note: if execution policy blocks npm.ps1, use:

```bash
npm.cmd install
npm.cmd run dev
```

Run app:

```bash
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## Deployment Checklist

Before handing to client:

1. Ensure all migrations are executed in production Supabase.
2. Verify `.env` in hosting platform contains all required variables.
3. Run `npm run lint` and `npm run build` with zero errors.
4. Verify these flows manually:
   - super admin login
   - add/edit/delete admin
   - add/edit/delete shopper
   - add/edit/delete visit
   - shopper completes visit and points update
   - export PDF report

## Security Note

Current database policies preserve compatibility with custom frontend auth and anon key access.
For stricter enterprise security, migrate authentication to Supabase Auth and tighten RLS policies to role/owner-based checks.
