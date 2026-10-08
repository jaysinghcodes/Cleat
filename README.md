# Cleat

Formerly CoachLoop.

Expo (iOS and Android) + Next.js trainer web on Vercel, Supabase (Auth, Postgres, Realtime, Storage, pgvector) as the backend, OpenAI for the LLM, and calendar via ICS subscribe/export with optional Google Calendar OAuth.

Trainers sign in on the web desk. Clients accept an invite and sign in on the Expo app. Programs, chat, AI, the inbox, and calendar are later tickets. Full stack notes are in [docs/architecture.md](docs/architecture.md).

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

Copy `API_URL` and `ANON_KEY` into the app env files. Leave the service role key out of both apps.

`apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
NEXT_PUBLIC_CLIENT_APP_URL=http://localhost:8081
```

`apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
```

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

The native splash is the Cleat mark on a dark background. After sign-in, the client lands on tabs: Today, Program, Chat, Book, and Me. An Apple Developer account is not required for Expo Go. Store submission is later. The iOS bundle id and Android package are `com.jaysinghcodes.cleat`.

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

Leave the values blank until a later ticket needs them. `.env.example` lists:

- Supabase URL, anon key, and service role (service role is server-only)
- `EXPO_PUBLIC_` and `NEXT_PUBLIC_` copies of the URL and anon key
- `OPENAI_API_KEY` (server-only)
- `ICS_FEED_SIGNING_SECRET` (server-only)
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
3. Leave `SUPABASE_SERVICE_ROLE` in server env only. Do not prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. The web and mobile apps do not read it.
4. Apply `packages/db/supabase/migrations` with the Supabase CLI (`supabase db reset` from `packages/db`) or the SQL editor. `0001_init.sql` enables `pgcrypto` and `pgvector`. `0002_tenancy.sql` adds orgs, profiles, memberships, invites, and row level security. `0003_programs.sql` adds programs, set logs, nudge events, and the client weight unit. `0004_chat.sql` adds threads, messages, and push token storage.
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

This applies the migrations with psql and asserts that a trainer cannot read another org and a client cannot read another client's profile. The script stubs `auth.uid()` with `tests/plain_postgres_auth_stub.sql` so the assertions do not call GoTrue. The apps use `supabase start` from [Run locally](#run-locally), which runs real GoTrue.

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
2. Run `packages/db/supabase/migrations/0001_init.sql`, `0002_tenancy.sql`, `0003_programs.sql`, and `0004_chat.sql` in the SQL editor.
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

## What comes next

Programs, the priority inbox, AI, and calendar booking are later tickets. Chat is live on the trainer desk and the client Chat tab. The other desk links and client tabs are placeholders. Design decisions and the final wireframe screenshots are in [docs/design](docs/design).
