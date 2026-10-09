# Cleat

The product name is Cleat. The repo is named `coachloop`.

A coach runs the web desk. A client uses the Expo app on iOS or Android. A fresh clone plus `pnpm seed` is a two role demo: the phone in Expo Go, the trainer desk in the browser.

Expo (iOS and Android) plus Next.js trainer web on Vercel. Supabase (Auth, Postgres, Realtime, Storage, pgvector) is the backend. OpenAI is optional for the LLM. Calendar is ICS subscribe and export, with optional Google Calendar OAuth.

Full stack notes are in [docs/architecture.md](docs/architecture.md). The phone plus desk beats are in [docs/demo-script.md](docs/demo-script.md).

## Layout

```
apps/web        Next.js trainer desk (Vercel)
apps/mobile     Expo client (iOS and Android, one project)
packages/api    Typed Supabase helpers
packages/db     SQL migrations and RLS notes
packages/domain Zod schemas
packages/ai     Retrieval, confidence, refusals (stubs)
packages/theme  @cleat/theme tokens
```

## Architecture

One coach is one org. Clients belong to that org. Postgres row level security keeps every row inside it.

| Surface | What it does |
| --- | --- |
| Expo app | Today, program, chat, book, and Me. iOS and Android from one project. |
| Next.js desk | Clients, programs, knowledge base, accountability board, priority inbox, audit log, calendar. |
| Supabase | Auth (email code, no passwords), Postgres, Realtime, Storage, pgvector. |
| Desk server | Retrieval, confidence, refusals, audit writes, ICS feeds. Holds `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE`. |
| Calendar | ICS subscribe and export. Google stays off until its server env is set. |

The phone talks to Supabase with the anon key for rows the policies allow. Chat replies and booking go through the desk so the service role and the OpenAI key never ship in the Expo bundle. The diagram and the refusal rules are in [docs/architecture.md](docs/architecture.md).

## Cuts

Cleat is not Everfit and it is not Trainerize. Those products ship nutrition plans, wearable sync, habit games, white label store listings, and a payments marketplace. Cleat does not.

v1 leaves out nutrition, wearables, white label apps, a payments marketplace, gamification, camera form checks, and franchise roles. The loop that ships is logging, a who needs a nudge board, and a confidence gated reply that refuses injury, medication, and emergencies.

## Ten minute cold demo

From a fresh clone, with Docker and the Supabase CLI installed:

```sh
pnpm install
cd packages/db && supabase start && supabase status && cd ../..
pnpm seed
pnpm dev:web
```

In a second terminal, from `apps/mobile`:

```sh
npx expo start
```

`supabase start` applies the migrations and `supabase/seed.sql`. `pnpm seed` runs that file again (it is idempotent) and writes the knowledge base embeddings. Run `pnpm seed` a second time. The printed counts stay the same.

Copy `API_URL` and `ANON_KEY` from `supabase status` into the app env files below. Copy `SERVICE_ROLE` into `apps/web/.env.local` only. Leave `OPENAI_API_KEY` unset so the seed and the desk share the offline embedder. Leave the Google vars empty. Beat 5 is ICS only.

Sign in codes on a local stack are `424242` for the seeded addresses (`packages/db/supabase/config.toml`). The cast, the five beats, and the iOS, Android, and physical phone env blocks are in [docs/demo-script.md](docs/demo-script.md).

`pnpm seed` reads `DATABASE_URL` when it is set. Otherwise it uses `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. It does not read `SUPABASE_SERVICE_ROLE`.

## Prerequisites

- Node.js 22 or newer (`.nvmrc`). Vercel's default Node 24 is fine.
- pnpm 10 (`packageManager` in the root `package.json`; Corepack will pick it up)

No Supabase project, Vercel project, Expo account, or API keys are required to clone and run.

## Install

```sh
pnpm install
```

## Run locally

Install Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). From `packages/db`:

```sh
supabase start
```

That starts Postgres, GoTrue, the API on port 54321, and Mailpit. The Mailpit UI is [http://127.0.0.1:54324](http://127.0.0.1:54324). It applies `supabase/migrations`, then `supabase/seed.sql`. The Magic Link template in `packages/db/supabase/templates/magic_link.html` includes `{{ .Token }}`, so the message shows the 6-digit code.

`0001_init.sql` runs `create extension vector`. The Supabase database image already includes pgvector. On plain Postgres 16, install `postgresql-16-pgvector` before `pnpm --filter @cleat/db test:rls`.

```sh
supabase status
```

Copy `API_URL` and `ANON_KEY` into both apps. Put `SERVICE_ROLE` only in `apps/web/.env.local`. That file is read by the Next.js server. Do not put the service role in `apps/mobile/.env`, and do not prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. The anon key is the only Supabase key in the browser bundle and the Expo bundle.

`apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
NEXT_PUBLIC_CLIENT_APP_URL=http://localhost:8081
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE=<SERVICE_ROLE from supabase status>
ICS_FEED_SIGNING_SECRET=cleat-demo-ics-secret
```

`apps/mobile/.env` for the iOS Simulator. Android and a physical phone use different hosts. See [docs/demo-script.md](docs/demo-script.md).

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
EXPO_PUBLIC_DESK_URL=http://127.0.0.1:3000
EXPO_PUBLIC_WEB_URL=http://127.0.0.1:3000
```

Then, from the repo root, `pnpm seed`. Leave `OPENAI_API_KEY` unset.

The auth redirect allow list is `additional_redirect_urls` in `packages/db/supabase/config.toml`. A hosted project needs the same entries:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback`
- `http://localhost:8081/auth/callback`
- `http://127.0.0.1:8081/auth/callback`
- `exp://**` for Expo Go (`exp://<metro-host>/--/auth/callback`)
- `cleat://**` for the `cleat` scheme (`cleat://auth/callback`). Expo Go does not open `cleat://`.

A hosted project also needs `{{ .Token }}` in the Magic Link email template.

Trainer desk, from the repo root:

```sh
pnpm dev:web
```

Open [http://localhost:3000/signup](http://localhost:3000/signup).

Expo web, from `apps/mobile`:

```sh
npx expo start --web --port 8081
```

Open [http://localhost:8081](http://localhost:8081).

## Trainer web

```sh
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000). The health route is [http://localhost:3000/api/health](http://localhost:3000/api/health) and returns HTTP 200:

```json
{ "status": "ok", "service": "cleat-web" }
```

Production build from the repo root:

```sh
pnpm build
pnpm --filter @cleat/web start
```

## Client app (iOS and Android)

One Expo app targets both platforms. From the repo root:

```sh
pnpm dev:mobile
```

Metro prints a QR code and the Expo dev tools.

| Target | How |
| --- | --- |
| iOS Simulator | On a Mac with Xcode: in the Metro terminal, press `i`. Or `pnpm --filter @cleat/mobile ios`. |
| Android Emulator | With an Android Studio emulator running: press `a`. Or `pnpm --filter @cleat/mobile android`. |
| iPhone (Expo Go) | Install Expo Go from the App Store, then scan the QR code. |
| Android phone (Expo Go) | Install Expo Go from the Play Store, then scan the QR code. |

The native splash is the Cleat mark on a dark background. After sign-in, the client lands on tabs: Today, Program, Chat, Book, and Me. The iOS bundle id and Android package are `com.jaysinghcodes.cleat`.

A physical phone cannot use `127.0.0.1`. The iOS Simulator can. The Android Emulator reaches the host at `10.0.2.2`. A phone on the same Wi-Fi needs the computer LAN address, and the desk must listen on all interfaces (`next dev -H 0.0.0.0`). Exact env blocks are in [docs/demo-script.md](docs/demo-script.md).

## Free tier and App Store

Supabase Free, Vercel Hobby, and Expo Go are enough for this demo. OpenAI is pay as you go and optional. Leave `OPENAI_API_KEY` unset and both the seed and `pnpm eval` use the offline hash embedder and canned scorer. No Apple Developer account and no Google Play Console account are required for Expo Go.

App Store and Play submission are later. The posture is general wellness and coaching operations, not a medical device. Injury, medication, and emergency messages get a fixed refusal, not clinical advice. When you submit, it is one Cleat branded app, not a white label listing per gym. Until then, demo with Expo Go. EAS development builds for iOS and Android are optional and use the free build minutes on the Expo plan.

### EAS dev builds (optional)

`eas.json` has development, preview, and production profiles for iOS and Android. Expo Go is enough for this ticket. When you want a dev client:

```sh
cd apps/mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android
```

`eas init` writes the Expo project id into the app config. This repo does not link a live EAS project.

## Environment

```sh
cp .env.example .env
```

`.env.example` lists:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` for server tools
- `SUPABASE_SERVICE_ROLE` for the desk server only. Never prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. Do not put it in `apps/mobile/.env`.
- `DATABASE_URL` for `pnpm seed` only. The web and mobile bundles do not read it.
- `EXPO_PUBLIC_` and `NEXT_PUBLIC_` copies of the URL and the anon key. Those are the only Supabase values that belong in a client bundle.
- `OPENAI_API_KEY` (server only). Never prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
- `ICS_FEED_SIGNING_SECRET` (server only)
- optional `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

Do not commit `.env` or any real key. ICS subscribe/export is the calendar path; Google OAuth is optional and can stay empty.

## Supabase auth

Not required to boot the empty screens. Sign-up, sign-in, and invites need a Supabase project (hosted free tier, or [Run locally](#run-locally)).

There are no passwords. Both roles sign in with an email code or a magic link.

1. Create a free project at [supabase.com](https://supabase.com), or from `packages/db` run `supabase start` when Docker is available. Local mail is captured by Inbucket (the CLI prints the URL, usually port 54324).
2. Copy the project URL and anon key into `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the trainer desk
   - `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the client app
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` for server tools
3. Leave `SUPABASE_SERVICE_ROLE` in server env only (`apps/web/.env.local` or the host env). Do not prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. The browser bundle and the Expo bundle do not read it. The anon key is the only key those bundles get, via `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Apply `packages/db/supabase/migrations` with the Supabase CLI (`supabase db reset` from `packages/db`) or the SQL editor. `0001_init.sql` enables `pgcrypto` and `pgvector`. `0002_tenancy.sql` adds orgs, profiles, memberships, invites, and row level security. `0003_programs.sql` adds programs, set logs, nudge events, and the client weight unit. `0004_chat.sql` adds threads, messages, and push token storage. `0005_booking.sql` adds availability, sessions, ICS tokens, and optional Google credential storage. `0006_rag_audit.sql` adds the knowledge base, embeddings, AI settings, the audit log, held drafts, and in app notices. `0007_inbox.sql` adds the unanswered window, P2 and P3 inbox tiers, and the trainer seed hook.
5. Add these redirect URLs to the Supabase auth redirect allow list:
   - `http://localhost:3000/auth/callback` (trainer desk)
   - `http://localhost:8081/auth/callback` (Expo web)
   - `exp://**` (Expo Go). A magic link opened from the phone uses `exp://<metro-host>/--/auth/callback`.
   - `cleat://**` (the `cleat` scheme in `app.config.ts`). A later dev build uses `cleat://auth/callback`. Expo Go does not open `cleat://`.
6. Read [packages/db/supabase/RLS.md](packages/db/supabase/RLS.md) before adding tables. Every table turns on row level security in the same migration.

`NEXT_PUBLIC_CLIENT_APP_URL` is the origin a trainer copies into an invite link. It defaults to `http://localhost:8081` (Expo web).

### Invite flow

1. Trainer web: `pnpm dev:web`, open [http://localhost:3000/signup](http://localhost:3000/signup), and create a desk with a name, work email, and gym name. Enter the email code, or open the magic link on the same browser. You land on the desk.
2. Open Clients and choose Create invite link. Copy the link. It expires in 7 days and works once.
3. Client app: `pnpm dev:mobile`.
   - Web: press `w`, then open the invite link (or paste it on Join).
   - iPhone or Android in Expo Go: follow [Try it in Expo Go](#try-it-in-expo-go). Paste the copied link on Join. The phone does not need to open `localhost`.
   - iOS Simulator (Mac with Xcode): press `i`. Android emulator: press `a`.
4. On the invite screen, enter a name and email, then the email code. You can also open the sign-in link from that same device. The app opens on the Today tab.
5. Sign in again from Log in with the same email. The session is stored in the browser. On a phone it is stored in AsyncStorage, which ships with Expo Go, so a reload or cold start keeps you signed in.
6. Display name and timezone: trainer desk Org / Billing, or the client Me tab, Edit.

An invite older than 7 days is rejected with "This invite has expired. Ask your coach for a new link."

### Cross tenant check

```sh
pnpm --filter @cleat/db test:rls
```

`test:rls` needs the pgvector extension. `0001_init.sql` runs `create extension vector`. On Postgres 16 install `postgresql-16-pgvector`. Supabase and the Supabase CLI image already include it.

This applies the migrations with psql and asserts that a trainer cannot read another org, a client cannot read another client's profile, and booking rows stay inside the org. The script stubs `auth.uid()` with `tests/plain_postgres_auth_stub.sql` so the assertions do not call GoTrue. The apps use `supabase start` from [Run locally](#run-locally), which runs real GoTrue.

## Vercel (hobby)

Not required to run locally. To deploy the trainer web app:

1. Import [jaysinghcodes/Cleat](https://github.com/jaysinghcodes/Cleat) in the Vercel dashboard.
2. Framework preset: Next.js.
3. Root Directory: `apps/web`.
4. Install command: leave the default (`pnpm install` from the workspace root). Vercel uses the root lockfile.
5. Node.js 22 or newer.
6. Add environment variables from `.env.example` when later tickets need them. The health route does not read secrets.
7. After deploy, `GET /api/health` returns 200.

## Try it in Expo Go

The client stays compatible with Expo Go. It does not use a custom native module or a dev build, and it does not register for push notifications.

1. Create a free Supabase project. Enable the email provider. In the Magic Link email template, keep `{{ .Token }}` so the message includes the code, and `{{ .ConfirmationURL }}` if you also want the link. Add these redirect URLs to the Supabase auth redirect allow list:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:8081/auth/callback`
   - `exp://**` (Expo Go)
   - `cleat://**` (app scheme; Expo Go does not open this)
2. Run `packages/db/supabase/migrations/0001_init.sql`, `0002_tenancy.sql`, `0003_programs.sql`, `0004_chat.sql`, `0005_booking.sql`, `0006_rag_audit.sql`, and `0007_inbox.sql` in the SQL editor.
3. Put the anon key in the app env files. Do not put the service role key in either file.

`apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_CLIENT_APP_URL=http://localhost:8081
```

`apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
EXPO_PUBLIC_DESK_URL=http://localhost:3000
```

4. Start the trainer desk from the repo root: `pnpm dev:web`. Open http://localhost:3000/signup. Enter a name, email, and gym name. Choose Email me a code. Type the code from the email. You land on the desk.
5. Open Clients, choose Create invite link, and copy the link.
6. Install Expo Go from the App Store or Play Store.
7. Start Metro from `apps/mobile`:

```sh
npx expo start --tunnel
```

Use `--tunnel` when the phone is not on the same Wi-Fi as the computer. On the same Wi-Fi, `npx expo start` is enough.

8. Scan the QR code with the iPhone camera, or with Expo Go on Android. The project opens inside Expo Go.
9. On the phone, choose Join instead. Paste the invite link from step 5. Choose Continue. Enter a name and email, then Accept and open app. Type the code from the email. You land on Today. Opening the sign-in link in that email also returns to Expo Go when `exp://**` is allowed.
10. Close Expo Go and open the project again. The session is still there. Later sign-in is Log in, the same email, and a new code.

## Checks

```sh
pnpm lint
pnpm typecheck
```

GitHub Actions runs both on pull requests (`.github/workflows/ci.yml`).

## AI answers

The trainer desk answers a client chat message from the org knowledge base and that client's program. Leave `OPENAI_API_KEY` unset and the server uses a deterministic stand in: hash embeddings (`cleat-hash-embedding`, 1536 dimensions) and a canned scorer (`cleat-canned-scorer`). Tests always use that stand in.

To use OpenAI, set `OPENAI_API_KEY` on the Next.js server only. Do not prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. The server then calls `text-embedding-3-small` and `gpt-4o-mini`. The Expo app never reads the key. Hard refusals stay fixed templates either way. They are not model output.

`SUPABASE_SERVICE_ROLE` is also server only. The AI write path (chunks, audit rows, safety replies, held drafts) does nothing when it is unset. The client message still saves.

New orgs start with auto send off and a threshold of 0.85 (allowed range 0.60 to 0.95). The confidence floor is 0.50 and is not a setting. The reserved demo org `d1000000-0000-4000-8000-000000000001` is the only org `enable_demo_auto_send()` turns on. `pnpm seed` inserts that org and calls the function. The call is server side. The anon and authenticated roles cannot run it.

`pnpm eval` batches [docs/eval-messages.json](docs/eval-messages.json) through the same gate and prints pass or fail per message, plus totals. With `OPENAI_API_KEY` unset it stays offline (`cleat-hash-embedding`, `cleat-canned-scorer`). With the key set on the server, it uses `text-embedding-3-small` and `gpt-4o-mini`.

Escalations show up in the trainer Priority inbox and on the thread.

## Calendar

ICS subscribe and export work with no Google account. Leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty. The desk does not show a Google connect button, and booking does not call Google.

Set `ICS_FEED_SIGNING_SECRET` in `apps/web/.env.local` (16 characters or more). It stays on the server. Also set `EXPO_PUBLIC_WEB_URL` in `apps/mobile/.env` when the client app should call the desk (default `http://localhost:3000`).

A trainer copies a subscribe link from Calendar, Sync ICS. The link looks like `https://<desk>/api/cal/<token>.ics` and returns `text/calendar`. Regenerate revokes the old token (HTTP 410). A tampered token is HTTP 400 and returns no sessions.

The feed is built from the database on each request. The response sets `Cache-Control: public, max-age=60` and `X-PUBLISHED-TTL:PT60S`. A book or cancel is in the next uncached fetch. A cache may keep the previous file for up to 60 seconds. Calendar apps also poll on their own schedule.

Add to calendar downloads the signed in user's sessions from `GET /api/cal/export`. One session is `GET /api/cal/export?session=<id>`.

A second parse uses Python `icalendar`, separate from the `ical.js` tests. CI runs the file checks. Against a running desk, `--feed` fetches the subscribe URL twice and compares those UIDs with an export file.

```sh
python3 -m pip install -r packages/domain/requirements.txt
python3 packages/domain/scripts/verify-ics.py docs/qa/ticket-6/sample-session.ics docs/qa/ticket-6/downloaded-session.ics
python3 packages/domain/scripts/verify-ics.py packages/domain/scripts/fixtures/utf8-fold.ics
python3 packages/domain/scripts/verify-ics.py --feed http://localhost:3000/api/cal/<token>.ics --export docs/qa/ticket-6/sample-session.ics
```

The script checks `VERSION:2.0`, `PRODID`, a `UID` and `DTSTAMP` on every event, `CRLF` line endings, and lines of at most 75 octets.

Slot length defaults to 60 minutes. Client cancel is blocked inside the org cutoff, which defaults to 12 hours. Trainers can cancel any session. Sessions are stored in UTC and shown in the profile timezone.

Google Calendar OAuth is optional and stays off until the server env in [Google Calendar for deploy (#18)](#google-calendar-for-deploy-18) is set. With those vars empty, booking does not call Google.

Push notifications for a booked or cancelled session are a no-op interface in `@cleat/domain` (`deferredPushNotifier`). They are not sent.

## Google Calendar for deploy (#18)

ICS subscribe and export stay the calendar path with no Google account. Live Google verification needs a Google Cloud OAuth client and a public redirect URL from deploy ticket #18.

Set these on the trainer desk server only:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE`

Do not prefix the client secret or the service role with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. The web and mobile bundles do not read them. Leave both Google vars empty and the desk hides Connect Google Calendar.

The OAuth callback route is `GET /api/google/oauth/callback`.

Register that exact path as an authorized redirect URI in the Google Cloud console:

- Local: `http://localhost:3000/api/google/oauth/callback`
- Deployed: `https://<your-vercel-host>/api/google/oauth/callback`

The only scope is `https://www.googleapis.com/auth/calendar.events`. The consent screen can stay in Testing with Jay as a test user.

Connect stores a refresh token and leaves the Google email column null. Org settings then show "Google Calendar connected". Disconnect posts the refresh token to `https://oauth2.googleapis.com/revoke`, then deletes the stored credentials. The ICS feed keeps working and the primary calendar goes back to ICS. Booking creates one event per session. A later sync updates that event. Cancel deletes it. A missing event (HTTP 404 or 410) still clears `google_event_id`.

## What comes next

Chat, programs, calendar booking, knowledge, AI settings, the audit log, and the trainer priority inbox are in the app. The client Chat tab shows an auto sent answer with sources, or a fixed safety reply. A held draft is invisible to the client until a coach sends it, and that send is a coach message. Design decisions and the wireframe screenshots are in [docs/design](docs/design).
