# Finance Manager Website

This is a browser-based version of the Android Finance Manager app, connected to Supabase for authentication and transaction storage.

## Features

- Login and sign-up flow with Supabase Auth
- Dashboard overview with balance, income, and expenses
- Recent transactions list
- Transaction history with filters
- Analytics view with category breakdown
- Add and delete transactions from Supabase
- Local fallback state when not signed in

## Supabase setup

The website and Android app use the same Supabase project and public anon key. The key is intended for client apps; never put a `service_role` key in either client. The Android app stores its signed-in access token locally and sends it with database requests, while the website uses Supabase Auth's browser session.

In the Supabase Dashboard, open SQL Editor and run [supabase-schema.sql](supabase-schema.sql). Run it again after schema updates to apply migrations to existing tables; for example, it adds `budgets.category_name`, `budgets.limit_amount`, and `savings_goals.deadline` for the Android app, copies existing limits from common legacy amount columns when present, and makes those obsolete columns optional for new budgets. It creates or updates the shared `accounts`, `transactions`, and planning tables, enables row-level security, and restricts reads and writes to the signed-in user's rows. The migration also converts transaction dates from the earlier website schema to epoch milliseconds used by both apps.

If the Android app reports that `budgets.limit_amount` or `savings_goals.deadline` is missing, or that a legacy `budgets.amount` or `budgets.period` column cannot be null, run [supabase-budget-migration.sql](supabase-budget-migration.sql) in the SQL Editor for the same Supabase project. It adds the missing columns, preserves existing values from common legacy budget amount columns, makes legacy amount and period columns optional, and asks PostgREST to reload its schema cache. Retry saving the budget or savings goal after the SQL query succeeds.

Both clients share transaction fields: `title`, `amount`, `type`, `income`, `category_name`, optional `account_id`, `user_id`, and `date` (epoch milliseconds). Transactions can be added without an account. Both clients use the same Supabase Auth email/password accounts, so an account created in either client can be used in the other, subject to your Supabase email-confirmation settings.

If you use a different Supabase project, update the URL and anon key in [supabase-config.js](supabase-config.js) and the matching constants in the Android app's `SupabaseClient`.

## Run it

Serve the `website` folder over HTTP instead of opening `index.html` as a `file://` URL. From the repository root, run:

```powershell
py -m http.server 8000 --directory website
```

Then open `http://localhost:8000`. Use the same configured Supabase project URL and anon key in [supabase-config.js](supabase-config.js). Sign-up is email-only. Existing users can log in with either email or a phone number in international format, such as `+260765730952`.
