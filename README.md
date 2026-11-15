# Study Space: Azka's Step 1 Companion

A calm daily guide for USMLE Step 1, with a study buddy cat who is always a doctor ("Dr. Mochi", or whatever she names it). Every day is check in, then do one numbered list, then wrap up. Family can follow along with read-only access.

Setup steps are in **[SETUP.md](SETUP.md)**.

## Where to change things

| You want to change | Edit this file |
|---|---|
| Colours and fonts | `src/styles/index.css` (the `@theme` block at the top) |
| What the cat says | `src/content/mochi.ts` |
| Default to-do list and durations for each type of day, and the editor's quick-add buttons | `src/content/tasks.ts` |
| Labels, moods, cheers, the three rules | `src/content/strings.ts` |
| The 45-day plan (new accounts) | `src/data/plan.json` |
| Points and growth stages | `src/lib/growth.ts` (`POINTS`, `STAGES`) |
| How mood shrinks a goal | `src/lib/planner.ts` (`MOOD_MULTIPLIER`) |
| The cat drawing | `src/components/catArt.ts` (generated from the design sheet) |
| AI answer style or daily limit | `supabase/functions/ask-mochi/index.ts` |

## How it's built

- **App:** React, TypeScript and Vite, styled with Tailwind. Phone layout has a tab bar; desktop has a side rail.
- **Data:** Supabase (Postgres) with row-level security. Every action is saved as an event (`events` table), and every number on screen is worked out from those events. A retried save never counts twice, and an undo marks the entry void instead of deleting it.
- **Guests:** they never read Azka's tables. They call `get_supporter_summary()`, which returns only the fields she switched on and re-checks access on every call.
- **Ask Dr. Mochi:** a Supabase Edge Function calls Gemini with a server-side key, capped at 30 questions a day.

```
src/
  content/     wording, cat lines, task lists  (no code knowledge needed)
  lib/         pure logic + tests (planner, progress, growth, dates)
  state/       AppContext: loading data and every database write
  components/  shared UI (cat, buttons, layout)
  features/    one folder per screen
supabase/
  migrations/  database setup
  functions/   ask-mochi
  tests/       permission tests
```

## Debugging

- Open `#/debug` in the app. It shows the version, who is signed in, data counts, the last 30 events, and a **Void** button for a wrong entry.
- Every database write goes through `src/state/AppContext.tsx`. Errors show as a banner and are logged to the browser console.
- Run `npm run check` before pushing. GitHub runs it too, and won't publish if it fails.

## Rules the app keeps

- Azka controls the plan: she can edit, add, remove or swap days, change times and tasks, and move or let go of pending items. Every change is logged and can be undone, and guests can see the list of changes.

- Reading days and practice days never mix. Mood changes how big the day is, never what kind of day it is.
- Missed work never piles onto tomorrow. Catch-up goes only where there's real room, and only if Azka agrees.
- The app never predicts passing or failing, and never moves exam dates by itself.
- The cat never gets sad or sick, and never grows from question volume.
