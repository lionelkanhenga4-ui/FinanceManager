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

In the Supabase Dashboard, open SQL Editor and run [supabase-schema.sql](supabase-schema.sql) once. It creates or updates the shared `accounts` and `transactions` tables, enables row-level security, and restricts reads and writes to the signed-in user's rows. The migration also converts transaction dates from the earlier website schema to epoch milliseconds used by both apps.

Both clients share transaction fields: `title`, `amount`, `type`, `income`, `category_name`, optional `account_id`, `user_id`, and `date` (epoch milliseconds). Transactions can be added without an account. Both clients use the same Supabase Auth email/password accounts, so an account created in either client can be used in the other, subject to your Supabase email-confirmation settings.

If you use a different Supabase project, update the URL and anon key in [supabase-config.js](supabase-config.js) and the matching constants in the Android app's `SupabaseClient`.

## Run it

Open the file directly in a browser:

- file:///C:/Users/Thinkpad/Downloads/FinanceManager-fixed/website/index.html

You can also serve the folder with a simple local static server if you prefer.
