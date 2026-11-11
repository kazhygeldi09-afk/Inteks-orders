# Curtain Orders

A web app for tracking customer orders. It works on phones and computers, in
Kazakh, Russian and English (each person picks their language at the top of the
page). Money is shown in tenge (₸).

## Who can do what

| Role | Sees | Can do |
|---|---|---|
| **Designer** | Only orders assigned to them, plus new unassigned online orders | Add orders; take online orders; edit their orders (a reason is required and saved in the history); add payments; delete a payment (with a reason) |
| **Call center** | Only orders they entered, without money | Add online orders (client name, phone, address, notes); fix them until a designer takes them |
| **Manager**, **Owner** | Everything | Edit, assign and delete any order; reports by month and year; export to Google Sheets; add and manage staff. Only the owner can create or change owners. |

The database enforces these rules itself (Postgres Row-Level Security plus
checked functions), so they hold even if someone bypasses the screens.

Each order has a payment list (deposit, then further payments). **Paid** is the
sum of payments, and **Remaining** is total cost minus paid. Both are
calculated automatically. Every change is logged in the order's history: who
made it, when, old → new value, and the reason.

## Set up (about 20 minutes)

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**.
   Choose a region close to Kazakhstan (for example Frankfurt) and save the
   database password somewhere safe.
2. Open **SQL Editor**, paste the whole of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   and click **Run**.
3. Open **Authentication → Sign In / Providers → Email** and turn **off**
   "Allow new users to sign up". Staff accounts are created from the app's
   Staff page instead. (Even if sign-up stays on, a self-registered account
   gets no access.)

### 2. Create the owner account

1. **Authentication → Users → Add user → Create new user**: enter the owner's
   email and a password, and tick **Auto Confirm User**.
2. In **SQL Editor**, run this with your own email and name:

   ```sql
   update public.profiles
      set role = 'owner', full_name = 'Owner Name'
    where email = 'owner@example.com';
   ```

### 3. Connect the app

Copy `.env.local.example` to `.env.local` and fill it in from
**Project Settings → API Keys** (the project URL is under **Connect** or
**Project Settings → Data API**):

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable key (older projects call it the anon key)
- `SUPABASE_SECRET_KEY`: the secret key (older projects call it the service_role key). Keep it private. Only the server uses it, on the Staff page.

### 4. Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000 and sign in as the owner.

### 5. Put it online

The simplest option is [Vercel](https://vercel.com):

1. Push this folder to a GitHub repository, then import it in Vercel.
2. Add the same three variables from `.env.local` under **Settings → Environment Variables**.
3. Deploy. Staff open the Vercel address on their phone or computer. On a
   phone they can use **Add to Home Screen** to get an app icon.

### 6. Add your staff

Sign in as the owner, open **Staff**, and add each person with their role and a
temporary password. Give them the password; they can change it under
**Account**. When someone leaves, untick **Active**: they can no longer sign
in, and their orders and history stay.

## Everyday notes

- **Export to Google Sheets:** on **Orders**, set any filters and click
  **Export for Google Sheets**. This downloads a CSV file. In Google Sheets,
  use **File → Import → Upload**, choose the file, and pick **Replace current
  sheet** or **Insert new sheet**.
- **Reports:** "Sales" is the cost of orders dated in that month or year
  (cancelled orders excluded). "Collected" is payments received in that
  period. "Still owed" is the unpaid part of that period's orders.
- **Forgotten password:** a manager or the owner sets a new one on the Staff
  page. No email setup is needed.
- **Wording:** all screen text is in
  [`lib/i18n/dictionaries.ts`](lib/i18n/dictionaries.ts). Have a native
  speaker check the Kazakh text.
- **Supabase plan:** free projects are paused after a period of inactivity
  and have limited backups. For a business, the paid plan is worth it; check
  Supabase's current pricing.

## For developers

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, with Supabase Auth and Postgres
- `supabase/migrations/0001_init.sql`: tables, access rules (RLS), and the
  functions all writes go through
- `scripts/test-db.mjs`: tests the migration and its access rules against an
  in-memory Postgres (`npm run test:db`)
- `app/(app)/orders`: order list, new, detail, edit, and CSV export
- `app/(app)/reports`, `app/(app)/staff`, `app/(app)/account`
- `lib/`: Supabase clients, sign-in check, translations, formatting
- `proxy.ts`: refreshes the session and sends signed-out visitors to /login
