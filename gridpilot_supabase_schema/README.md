# GridPilot Supabase Database Setup

## How to install

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Click **New Query**.
4. Paste the contents of `gridpilot_supabase_schema_v1.sql`.
5. Click **Run**.
6. (Telemetry feature) Run `gridpilot_supabase_schema_telemetry_flexibility.sql` in a second query to add `daily_flexibility_summaries` and extend `vehicle_snapshots`.

Supabase’s SQL Editor is designed for running SQL directly in the browser, and Supabase projects are full Postgres databases.

## After running the schema

1. Go to **Authentication > Providers**.
2. Enable **Google** if you want Google login.
3. Add your site URL and callback URLs.
4. Log in once with your own account.
5. Promote yourself to admin:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_EMAIL_HERE';
```

## Important security note

This schema enables Row Level Security on the app tables. RLS is important because it restricts row access at the database layer, especially when frontend clients use Supabase directly.

Tesla OAuth tokens should be written/read only from your backend using the Supabase service role key and encrypted before storage.

## Tables created

- profiles
- tesla_connections
- vehicles
- vehicle_snapshots (extended with `provider`, `vehicle_online` after telemetry migration)
- daily_flexibility_summaries (telemetry migration)
- charging_sessions
- behavior_profiles
- participant_preferences
- buyers
- dispatch_requests
- dispatch_events
- reward_ledger
- settlements
- support_requests
- audit_logs

## Dashboard views

- user_dashboard_summary
- admin_network_summary
