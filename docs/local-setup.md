# Local setup

The short path is in the [README quickstart](../README.md#quickstart): `pnpm run setup`, then `pnpm dev`, then `pnpm stop`. This page is the long version. It lists what those commands check and the same steps by hand.

`pnpm setup` without `run` is a built in pnpm command. It does not set up Cleat. `make setup`, `make dev`, and `make stop` run the same scripts.

No Supabase project, Vercel project, Expo account, or API key is required. Leave `OPENAI_API_KEY` unset. Expo Go is enough. An Apple Developer account is not required.

## What setup checks

`pnpm run setup` checks these and prints a `Fix:` command for anything missing. It stops before install when a check fails. Run the fix, then run `pnpm run setup` again.

| Check | Fix |
| --- | --- |
| Command Line Tools missing (`xcode-select -p` fails) | `xcode-select --install` |
| Command Line Tools missing or outdated (`brew doctor` says so) | `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install` |
| Node.js missing or older than 22 | `brew install node@22` (or `nvm install && nvm use` when nvm is installed) |
| pnpm is missing or is not the `packageManager` version | `corepack enable && corepack prepare pnpm@10.33.3 --activate` |
| Corepack is missing | `brew install node@22 && corepack enable && corepack prepare pnpm@10.33.3 --activate` |
| Docker is not installed | `brew install --cask docker && open -a Docker`, then `docker info` |
| Docker is not running | Open Docker Desktop, wait until it says running, then `docker info`. The setup command prints the same sentence as the seed guard. |
| Supabase CLI is not installed | `brew install supabase/tap/supabase` |

Command Line Tools are a Mac check. On other systems that line says it was skipped.

The destructive Command Line Tools reinstall runs only when `brew doctor` reports that the tools are missing or outdated. If `xcode-select -p` already prints a path and brew does not report that problem, setup leaves the tools installed.

## What setup runs

After the checks pass, setup:

1. Runs `pnpm install`.
2. Runs `supabase start` in `packages/db`. If the stack is already up, it keeps going.
3. Runs `supabase migration up --local` so pending migrations apply. It does not run `supabase db reset`.
4. Reads `supabase status -o env` and writes `apps/web/.env.local` and `apps/mobile/.env`.
5. Runs `pnpm seed`, passing `DB_URL` from that status as `DATABASE_URL` when it is present.

The web file keeps `127.0.0.1` for the API URL. The service role is written only there, as `SUPABASE_SERVICE_ROLE`. It is not written to `apps/mobile/.env`, and it is not prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

The mobile Supabase URL swaps a loopback host for this computer's LAN address so a phone on the same Wi-Fi can reach the API. Desk URLs in the mobile file use that same address and port 3000. Set `CLEAT_LAN_IP` to force the host: `10.0.2.2` for the Android emulator, or `127.0.0.1` for the iOS Simulator.

Local secrets already in `apps/web/.env.local` are kept: `ICS_FEED_SIGNING_SECRET`, `OPENAI_API_KEY`, `INBOX_UNANSWERED_HOURS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_CLIENT_APP_URL`. A missing ICS secret becomes `cleat-demo-ics-secret`. That is a demo value. Change it before any use outside this local stack.

Running setup again is safe. It refreshes Supabase keys, reapplies pending migrations, and seeds again. `pnpm seed` clears this demo org's sessions, messages, inbox items, drafts, audits, nudges, and workout logs, then restores the same counts.

## What dev and stop do

`pnpm dev` requires the env files from setup. When the web URL is loopback, it runs `docker info` and prints the seed guard sentence if Docker is not running.

The desk listens on all interfaces (`next dev -H 0.0.0.0`) so a phone can reach it. Expo runs in the foreground of the same terminal so the QR code stays usable. Desk logs go to `.cleat/web.log`. Scan the QR code with Expo Go on the same Wi-Fi.

If port 3000 is taken, dev binds the next free port from 3001 through 3099, prints that port, and updates `EXPO_PUBLIC_DESK_URL` and `EXPO_PUBLIC_WEB_URL`. Sign in redirects in `packages/db/supabase/config.toml` allow port 3000. Free port 3000 when you need email sign in on the desk.

`pnpm stop` stops the desk and Expo started by `pnpm dev`. Running it again prints that dev is not running. Quitting Expo also stops the desk.

## Before you start, by hand

1. Command Line Tools: check first. Run `xcode-select -p`, then `brew doctor` or `softwareupdate --list`. Only when brew reports that the Command Line Tools are missing or outdated, run `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install`, finish the installer, and verify with `xcode-select -p`. It should print a path. Outdated tools make brew refuse to install the Supabase CLI. If brew does not report that problem, leave the tools installed.
2. Docker Desktop: run `brew install --cask docker && open -a Docker`, wait until it says running, then verify with `docker info`. It should print server details. Docker must stay running while you use the local stack.
3. Node.js 22 or newer (`.nvmrc`). Enable pnpm with Corepack: `corepack enable && corepack prepare pnpm@10.33.3 --activate`.
4. Supabase CLI: `brew install supabase/tap/supabase`.

## Manual steps

```sh
pnpm install
docker info
cd packages/db && supabase start && supabase migration up --local && supabase status -o env && cd ../..
```

`docker info` comes before `supabase start`. Docker must be running. `supabase start` applies `supabase/migrations`, then `supabase/seed.sql`. `supabase migration up --local` applies any migration that landed after the stack was already up.

Write the env files before you start the desk. `supabase status` prints the anon key and the service_role key. Put the anon key in both apps. Map the service_role key to `SUPABASE_SERVICE_ROLE` in `apps/web/.env.local` only. Do not put that key in `apps/mobile/.env`, and do not prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

`apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
NEXT_PUBLIC_CLIENT_APP_URL=http://localhost:8081
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE=<service_role key from supabase status>
ICS_FEED_SIGNING_SECRET=cleat-demo-ics-secret
```

`apps/mobile/.env` for the iOS Simulator. A physical phone needs the computer LAN address. The Android emulator uses `10.0.2.2`.

iOS Simulator:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
EXPO_PUBLIC_DESK_URL=http://127.0.0.1:3000
EXPO_PUBLIC_WEB_URL=http://127.0.0.1:3000
```

Android Emulator (the host machine is `10.0.2.2`):

```
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
EXPO_PUBLIC_DESK_URL=http://10.0.2.2:3000
EXPO_PUBLIC_WEB_URL=http://10.0.2.2:3000
```

Physical iPhone or Android phone, same Wi-Fi. Replace `LAN` with the computer address (`ipconfig getifaddr en0` on a Mac). Docker publishes `54321`. The desk must listen on `0.0.0.0`. `pnpm run setup` writes this block for you.

```
EXPO_PUBLIC_SUPABASE_URL=http://LAN:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
EXPO_PUBLIC_DESK_URL=http://LAN:3000
EXPO_PUBLIC_WEB_URL=http://LAN:3000
```

Leave `OPENAI_API_KEY` unset so the seed and the desk share the offline embedder. Leave the Google vars empty.

Then seed, and start the desk so a phone can reach it:

```sh
pnpm seed
pnpm --filter @cleat/web exec next dev -H 0.0.0.0
```

In a second terminal, from `apps/mobile`:

```sh
npx expo start
```

`pnpm dev` does both of those in one terminal and keeps the Expo QR code in front. Prefer that unless you want two terminals.

On a local stack, read the sign-in code from Mailpit at http://127.0.0.1:54324. A hosted project sends a real email code instead.

`pnpm seed` reads `DATABASE_URL` when it is set. Otherwise it uses `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Docker is required only for that default local URL (`127.0.0.1:54322` or `localhost:54322`). A hosted database or another port does not need Docker. If Docker is required and it is not running, seed exits and tells you to open Docker Desktop. It does not read `SUPABASE_SERVICE_ROLE`.

From `packages/db`, `supabase db reset` drops the local database, reapplies the migrations, and runs `seed.sql`. Run `pnpm seed` after that so the embeddings exist. That is the fully clean slate. `pnpm run setup` does not reset.

The auth redirect allow list is `additional_redirect_urls` in `packages/db/supabase/config.toml`:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback`
- `http://localhost:8081/auth/callback`
- `http://127.0.0.1:8081/auth/callback`
- `exp://**` for Expo Go (`exp://<metro-host>/--/auth/callback`)
- `cleat://**` for the `cleat` scheme (`cleat://auth/callback`). Expo Go does not open `cleat://`.

`0001_init.sql` runs `create extension vector`. The Supabase database image already includes pgvector. On plain Postgres 16, install `postgresql-16-pgvector` before `pnpm --filter @cleat/db test:rls`.
