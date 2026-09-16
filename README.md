# Deadline Tracker

A shared assignment board for your batch. Plain HTML/CSS/JS frontend, Supabase
for the data, deployed on Vercel.

## What's inside
- `index.html` — the public board everyone sees (read-only)
- `editor.html` — passcode-protected page to add, edit, and delete assignments
- `css/style.css` — styling
- `js/config.js` — your Supabase project URL and public key (fill this in)
- `js/app.js` — shared logic: fetching, sorting, and rendering cards
- `js/editor.js` — editor page logic
- `sql/schema.sql` — run this once in Supabase to set up the database
- `vercel.json` — small config so `/editor` works without the `.html`

## 1. Create a Supabase project
1. Go to supabase.com, sign in, and create a new project. Any name/region is
   fine, and the free tier is enough for this.
2. Wait for it to finish setting up.

## 2. Set up the database
1. In your Supabase project, open the **SQL Editor**.
2. Paste in the entire contents of `sql/schema.sql` and run it.
   This creates the `assignments` table, turns on row-level security so
   direct writes are blocked, and adds functions (`add_assignment`,
   `update_assignment`, `delete_assignment`, `verify_passcode`) that check
   the passcode before doing anything.
3. The passcode is set to **5555** inside these functions. To change it
   later, edit the `'5555'` in each function in the SQL Editor and re-run
   that function's `create or replace` block.

## 3. Connect the frontend to Supabase
1. In Supabase, go to **Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `js/config.js` and paste them in:
   ```js
   const SUPABASE_URL = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
   The anon key is meant to be public — it's fine that it ends up visible in
   your deployed JavaScript. It only allows what your row-level security
   policies and functions allow (reading, plus writes that pass the
   passcode check). Never put your `service_role` key here.

## 4. Deploy to Vercel

**Option A — GitHub (recommended)**
1. Push this folder to a new GitHub repository.
2. Go to vercel.com → Add New → Project → import that repository.
3. Framework preset: **Other**. No build command is needed — leave it blank.
4. Deploy.

**Option B — Vercel CLI**
1. Install the CLI: `npm i -g vercel`
2. From inside this folder, run: `vercel`
3. Accept the defaults for a static project.

## 5. Share it
- Give your batchmates the main link (e.g. `https://your-app.vercel.app`) —
  that's the read-only board.
- Keep the editor link (`https://your-app.vercel.app/editor`) and the
  passcode to yourself and anyone else you trust to manage it.

## How the cards behave
- Sorted with the nearest due date first.
- Once a due date passes, the card sinks below the upcoming ones instead of
  disappearing — it stays there until an editor deletes it.
- If an assignment is marked "Extended," the original date shows struck
  through next to the new date, and the countdown/reminder switches to
  counting down to the new date.

## A note on the passcode
This is meant to keep casual visitors out of the editor, not to be
bank-grade security. The actual check happens inside Supabase (in the SQL
functions), not in the JavaScript, so the real passcode is never shipped to
the browser. But anyone who has the passcode can edit or delete anything on
the board, and it travels over the network in plain text — so don't reuse a
passcode you use elsewhere.
