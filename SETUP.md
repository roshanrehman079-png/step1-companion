# Setup (one time, about 15 minutes)

You need: the Supabase project (already created), a free Gemini key from Google AI Studio, and this repo on GitHub.

## 1. Create the database

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Paste the whole of `supabase/migrations/001_init.sql` and press **Run**.
3. You should see "Success. No rows returned".

## 2. Point sign-in emails at the app

In Supabase, go to **Authentication**, then **URL Configuration**:

- **Site URL:** `https://roshanrehman079-png.github.io/step1-companion/`
- **Redirect URLs:** add the same address.

Without this, the confirmation email links point to the wrong place.

## 3. Add "Ask Dr. Mochi"

1. Get a free key at [aistudio.google.com](https://aistudio.google.com), under **Get API key**. Don't paste it anywhere else.
2. In Supabase, go to **Edge Functions**, then **Secrets**, and add `GEMINI_API_KEY` with your key as the value.
3. Go to **Edge Functions**, then **Deploy a new function**, then **Via editor**. Name it `ask-mochi`, replace the sample code with `supabase/functions/ask-mochi/index.ts`, and deploy.
4. If the chat later replies "Please sign in again", open the function's settings and turn **Verify JWT** off. The function checks the login itself.

Optional: add a `GEMINI_MODEL` secret to choose a different model. The default is `gemini-flash-latest`.

## 4. Publish the website

1. Push this code to `github.com/roshanrehman079-png/step1-companion`.
2. On GitHub, go to **Settings**, then **Pages**, and set **Source** to **GitHub Actions**.
3. Each push to `main` runs the tests and publishes the site. Check the **Actions** tab for progress.

## 5. First use

1. Azka opens the site, creates an account and confirms her email.
2. Setup asks for her name, the cat's name, the exam date, study hours, UWorld count and water goal.
3. To add family, Azka opens **Settings**, then **People following along**, and invites their email. They create an account with that same email and see the guest view.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the two values
npm run dev                  # http://localhost:5173
npm run check                # type check + tests
```

Database permission tests (needs a local Postgres):

```bash
psql -d test -f supabase/tests/00_local_stub.sql
psql -d test -f supabase/migrations/001_init.sql
psql -d test -f supabase/tests/01_permissions.sql
```
