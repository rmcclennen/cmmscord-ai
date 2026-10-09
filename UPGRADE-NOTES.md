# Upgrade notes — read before deploying

This release turns Asset Care Connect into an installable, offline-capable app with
company isolation, an audit log, PM completion tracking, and push notifications. It also
fixes several security problems (listed first, because they matter most).

## 1. Security fixes (please read)

- **Privilege escalation in the team functions (fixed).** Any signed-in user could call the
  server functions to grant themselves admin, change other people's roles, or delete users.
  Every team function now checks the caller's role (`src/lib/authz.ts`, tested).
  _If this app was ever live with users you don't fully trust, review `user_roles` and the
  Team page for roles nobody assigned, and rotate anything an admin could reach._
- **Company separation did not exist before.** The earlier code that looked like workspace
  separation was never wired up (and only stored a name in the browser). Real isolation is
  now enforced by the database (restrictive row-level-security policies on 12 tables plus
  people tables), covered by tests in `tests/db/company-isolation.test.ts`.
- **A pre-existing infinite-recursion bug** in the `team_directory` row-level-security policy
  is fixed in the isolation migration.
- **SSRF guard.** Manual/document downloads by link could be pointed at internal addresses.
  All such fetches now go through `safeFetch` (`src/lib/url-guard.ts`, 29 tests).
- Push endpoints are allow-listed to the real push services before the server will call them.

## 2. Apply the database migrations (in order)

Run `supabase db push` (or paste each file into the SQL editor), in filename order:

| File               | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `20261008120000_…` | Companies, memberships, company isolation, new `team_directory` policy |
| `20261008120100_…` | Audit log + triggers (approvers of the same company can read it)       |
| `20261008120200_…` | `pm_completions`, `complete_pm()`, `generate_due_pm_work_orders()`     |
| `20261008120300_…` | `push_subscriptions` (server-only access)                              |

Everything that exists today is placed in one default company, **"Sioux City Plant
Operations"**, and every existing user becomes a member, so nothing disappears on upgrade.
Rename the company or add more from the **Company** page. New signups are _not_ added to a
company automatically — a manager adds them from the Team page (they see a notice until then).

`src/integrations/supabase/types.ts` was updated by hand to match. If Lovable regenerates it
from your database after you apply the migrations, that is fine and expected.

## 3. Environment variables (push notifications)

Run `npm run vapid` once and set the three values on the server:

```
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…      # secret
VAPID_SUBJECT=mailto:you@yourplant.org
```

Without them everything else works; Settings → Push shows "isn't set up yet".
On iPhone/iPad push only works after the app is added to the Home Screen (iOS 16.4+).

## 4. Optional: nightly PM work orders

The PM Due page has a **Generate work orders** button. To also run it nightly, in the
Supabase SQL editor (pg_cron must be enabled):

```sql
select cron.schedule('generate-pm-work-orders', '0 5 * * *',
                     $$select public.generate_due_pm_work_orders(7)$$);
```

Work orders created this way notify the assignee in-app (bell) but do not send a push or
email — only alerts created from the app do.

## 5. What's new

- **Installable app (PWA)** with icons, offline page, install prompt, mobile bottom bar.
- **QR scanner** (`/scan`): opens the asset from any printed label, using the camera.
- **Offline mode:** pages you've opened stay readable. Work orders, PM completions,
  equipment-down reports and asset photos made offline are saved on the device and sent
  automatically, in order, when you're back online (duplicates are prevented). A banner shows
  what's waiting; rejected items can be retried or discarded.
- **PM completion:** hours, parts used and notes are recorded per completion; the open work
  order is closed; the next due date respects seasonal windows.
- **Audit log** (`/audit-log`, managers/supervisors).
- **Pagination:** lists no longer stop silently at 1,000 rows.
- **Tests + CI:** `npm test` (94 tests incl. database migrations in an in-process Postgres),
  `.github/workflows/ci.yml` runs lint, typecheck, tests and build.

## 6. Known limits

- **Not verified against a live backend.** Everything was checked with type-checking, lint,
  94 automated tests (including the migrations replayed in Postgres) and a browser load of
  the sign-in page. I could not sign in to a real project, so please click through the main
  flows (sign in, scan, create a work order offline then reconnect, complete a PM) on a
  staging copy first.
- Roles are still global (a manager is a manager in every company). Storage buckets
  (photos, manuals) are not separated per company; table rows are.
- Multi-company users: new top-level records go to their first company; there is no
  company switcher yet.
- "Add asset by photo" and bulk import need a connection (they create the asset itself).
- Service worker caching is disabled in dev and inside iframes (e.g. the Lovable preview).
- `bun.lock` is out of date with `package.json` (new dependencies). Run `bun install` (or
  `npm install`) once to refresh it.
- Still-large files that were not split: `team.tsx` (68 KB), `parts-lookup-dialog.tsx`,
  `assets.index.tsx`, `equipment-down.tsx`. The 130 KB asset page was split into 12 files
  under `src/components/asset-detail/`.
