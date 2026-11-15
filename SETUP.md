# Setup (one time, about 15 minutes)

> **Updating from v1?** Do only these three things:
> 1. In the SQL Editor, run `supabase/migrations/002_editable_plan.sql`.
> 2. Go to **Authentication**, then **Sign In / Providers**, then **Email**, and turn **Confirm email** off (see step 2 below for why).
> 3. Paste the new `supabase/functions/ask-mochi/index.ts` into the `ask-mochi` function and deploy again.

You need: the Supabase project (already created), a free Gemini key from Google AI Studio, and this repo on GitHub.

## 1. Create the database

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Paste the whole of `supabase/migrations/001_init.sql` and press **Run**.
3. Do the same with `supabase/migrations/002_editable_plan.sql`.
4. You should see "Success. No rows returned" each time.

## 2. Point sign-in emails at the app

In Supabase, go to **Authentication**, then **URL Configuration**:

- **Site URL:** `https://roshanrehman079-png.github.io/step1-companion/`
- **Redirect URLs:** add the same address.

Then go to **Authentication**, then **Sign In / Providers**, then **Email**, and turn **Confirm email** off.

Supabase's free email service only sends to members of your Supabase team, so confirmation emails never reach family. With confirmation off, new accounts work straight away. Guests can't use this to see anything: they also need Azka's private invite link.

Password reset emails have the same limit. If someone forgets their password, set a new one under **Authentication**, then **Users**.

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
3. To add family, Azka opens **Settings**, then **People following along**, types a name, and taps **Create invite**. She sends the link on WhatsApp. The person opens it, creates an account, and sees the guest view. Each link works once.

## If "Ask Dr. Mochi" doesn't answer

Open the app at `#/debug` and tap **Test Ask**. It shows the exact error:

- **HTTP 404:** the function isn't deployed, or isn't named exactly `ask-mochi`.
- **HTTP 401:** turn off **Verify JWT** for the function.
- **"not-configured":** the `GEMINI_API_KEY` secret is missing.
- **"API key not valid":** create a new key in AI Studio and update the secret.
- **"location is not supported":** the app already asks Supabase to run the function in the US. Check that the function was redeployed with the new code.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the two values
npm run dev                  # http://localhost:5173
npm run check                # type check + tests
```

End-to-end QA (Chrome + a local Postgres + PostgREST with the real migrations): see `qa/e2e_real.py`.

Database permission tests (needs a local Postgres):

```bash
psql -d test -f supabase/tests/00_local_stub.sql
psql -d test -f supabase/migrations/001_init.sql
psql -d test -f supabase/tests/01_permissions.sql
```
