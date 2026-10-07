# CoachLoop

Expo (iOS and Android) + Next.js trainer web on Vercel, Supabase (Auth, Postgres, Realtime, Storage, pgvector) as the backend, OpenAI for the LLM, and calendar via ICS subscribe/export with optional Google Calendar OAuth.

This repo is the Ticket 0 scaffold: an empty app you can install and run. Auth, programs, chat, AI, the inbox, and calendar are the next tickets. Full stack notes are in [docs/architecture.md](docs/architecture.md).

## Layout

```
apps/web        Next.js trainer desk (Vercel)
apps/mobile     Expo client (iOS and Android, one project)
packages/api    Typed Supabase helpers (stub)
packages/db     SQL migrations and RLS notes
packages/domain Zod schemas (stubs)
packages/ai     Retrieval, confidence, refusals (stubs)
```

## Prerequisites

- Node.js 22 or newer (`.nvmrc`). Vercel's default Node 24 is fine.
- pnpm 10 (`packageManager` in the root `package.json`; Corepack will pick it up)

No Supabase project, Vercel project, Expo account, or API keys are required to clone and run.

## Install

```sh
pnpm install
```

## Trainer web

```sh
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000). The health route is [http://localhost:3000/api/health](http://localhost:3000/api/health) and returns HTTP 200:

```json
{ "status": "ok", "service": "coachloop-web" }
```

Production build from the repo root:

```sh
pnpm build
pnpm --filter @coachloop/web start
```

## Client app (iOS and Android)

One Expo app targets both platforms. From the repo root:

```sh
pnpm dev:mobile
```

Metro prints a QR code and the Expo dev tools.

| Target | How |
| --- | --- |
| iOS Simulator | On a Mac with Xcode: in the Metro terminal, press `i`. Or `pnpm --filter @coachloop/mobile ios`. |
| Android Emulator | With an Android Studio emulator running: press `a`. Or `pnpm --filter @coachloop/mobile android`. |
| iPhone (Expo Go) | Install Expo Go from the App Store, then scan the QR code. |
| Android phone (Expo Go) | Install Expo Go from the Play Store, then scan the QR code. |

The native splash is the CoachLoop mark on a dark background. The first screen is the client shell and shows whether you are on iOS or Android. An Apple Developer account is not required for Expo Go. Store submission is later.

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

## Supabase (when you create a project)

Not required to run the scaffold.

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy the project URL, anon key, and service role into `.env` using the names in `.env.example`.
3. When product migrations exist, apply `packages/db/supabase/migrations` with the Supabase CLI or the SQL editor. Ticket 0 only enables `pgcrypto` and `pgvector`.
4. Read [packages/db/supabase/RLS.md](packages/db/supabase/RLS.md) before adding tables. Every later table turns on row level security in the same migration.

## Vercel (hobby)

Not required to run locally. To deploy the trainer web app:

1. Import `jaysinghcodes/coachloop` in the Vercel dashboard.
2. Framework preset: Next.js.
3. Root Directory: `apps/web`.
4. Install command: leave the default (`pnpm install` from the workspace root). Vercel uses the root lockfile.
5. Node.js 22 or newer.
6. Add environment variables from `.env.example` when later tickets need them. The health route does not read secrets.
7. After deploy, `GET /api/health` returns 200.

## Checks

```sh
pnpm lint
pnpm typecheck
```

GitHub Actions runs both on pull requests (`.github/workflows/ci.yml`).

## What comes next

Ticket 1 is auth, orgs, and the trainer web and client mobile shells. Product screens are not in this repo yet.
