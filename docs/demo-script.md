# Cleat demo script

Two roles. The coach uses the web desk. The client uses the Expo app on a phone, a simulator, or an emulator. A fresh clone plus `pnpm seed` is the starting point. Push is not part of this demo.

Local sign in code for every seeded address is `424242` (`packages/db/supabase/config.toml`). A hosted project sends a real email code instead. Mailpit on a local stack is [http://127.0.0.1:54324](http://127.0.0.1:54324).

| Role | Email | What you should see |
| --- | --- | --- |
| Coach | alex.rivera@cleat.demo | Alex Rivera · Coach, org Rivera Strength |
| Client | sam.lee@cleat.demo | Foundation 3-day, today already logged |
| Client | morgan.patel@cleat.demo | Hypertrophy 4-day, today already logged |
| Client | jordan.kim@cleat.demo | Today skipped, note Travel day |
| Client | casey.torres@cleat.demo | Partial log, plus the knee pain thread |
| Client | riley.wong@cleat.demo | Hypertrophy 4-day, nothing logged yet |
| Invite | none yet | One unused invite on Clients |

Auto send is on for Rivera Strength only. Slots are 45 minutes. Leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty.

## Beat 1. Client logs a workout

1. On the phone, open Cleat in Expo Go.
2. Choose Log in. Email `riley.wong@cleat.demo`. Choose Email me a code. Enter `424242` on a local stack, or the code from the email on a hosted project.
3. Open Today. The program is Hypertrophy 4-day.
4. Choose Continue logging. Enter a weight and reps for each set. Choose Save sets.
5. Repeat until every exercise on that day says Logged. Today shows the session as done.

## Beat 2. Accountability board shows the nudge

1. On the computer, open [http://localhost:3000/login](http://localhost:3000/login).
2. Sign in as `alex.rivera@cleat.demo` with the same code.
3. The sidebar reads Alex Rivera · Coach and Org: Rivera Strength.
4. Open Accountability. Sam Lee and Morgan Patel are Done. Jordan Kim is Skipped, with Soft nudge, and the note Travel day. Riley Wong still needs a nudge for the missed day before today, even after beat 1.
5. Choose Send nudge or Soft nudge. The client Today tab shows the nudge banner. This demo does not send a phone push.

## Beat 3. High confidence FAQ auto answer

The desk server needs `SUPABASE_SERVICE_ROLE` in `apps/web/.env.local` so it can write the reply. Do not put that key in `apps/mobile/.env`. Leave `OPENAI_API_KEY` unset. The seed and the server then share the offline embedder.

1. On the phone, open Chat.
2. Send `What is on my program today?`
3. The reply is an AI message. It quotes the coach note and shows Sources: What is on my program today.
4. On the desk, open Chat for that client. The same reply is there.
5. Open Audit log. The row is an auto send.

Sam Lee's thread already contains this turn if you want to show it before sending a new one.

## Beat 4. Knee pain is hard refused

1. On the desk, open Priority inbox.
2. Casey Torres has an open Injury item at P0. The preview is `Sharp pain in my knee on lunges, what should I do?`
3. Open it. The safety reply is already in the thread. There is no held draft. The template is medical safety.
4. Optional live pass: sign in on the phone as `casey.torres@cleat.demo` and send that same sentence. The client sees the fixed safety reply immediately. A P0 item is on the desk. The model does not write that reply.

## Beat 5. Book a session and subscribe with ICS

Do this with Google env vars empty. Booking must not call Google.

1. On the desk, open Calendar. The slot pill says 45 min slots. Sam Lee already has a session at 9:00 tomorrow in America/Chicago.
2. Choose Sync ICS. Copy the subscribe URL. It ends in `.ics`.
3. On the phone, open Book. Pick a later open slot on any day and choose Book.
4. Fetch the subscribe URL again. The new session is in the file. A calendar app may keep the previous file for up to 60 seconds (`Cache-Control: public, max-age=60`).
5. The desk week view lists the new session after a refresh.

## Phone plus web steps for the device checklist

Use these on iOS and again on Android. The desk stays on the computer.

1. `pnpm install`
2. From `packages/db`, `supabase start`, then `supabase status`.
3. `apps/web/.env.local` (browser and server on the computer):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
NEXT_PUBLIC_CLIENT_APP_URL=http://localhost:8081
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE=<SERVICE_ROLE from supabase status>
ICS_FEED_SIGNING_SECRET=cleat-demo-ics-secret
```

`SUPABASE_SERVICE_ROLE` and `ICS_FEED_SIGNING_SECRET` stay in this file. Do not prefix them with `NEXT_PUBLIC_`. Do not copy the service role into the Expo env.

4. `pnpm seed` from the repo root. Run it again. The printed counts stay the same.
5. Start the desk so a phone can reach it: `pnpm --filter @cleat/web exec next dev -H 0.0.0.0`
6. `apps/mobile/.env` depends on the target.

iOS Simulator (localhost works):

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
EXPO_PUBLIC_DESK_URL=http://127.0.0.1:3000
EXPO_PUBLIC_WEB_URL=http://127.0.0.1:3000
```

Android Emulator (the host machine is `10.0.2.2`):

```
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
EXPO_PUBLIC_DESK_URL=http://10.0.2.2:3000
EXPO_PUBLIC_WEB_URL=http://10.0.2.2:3000
```

Physical iPhone or Android phone, same Wi-Fi. Replace `LAN` with the computer address. Docker publishes `54321`. The desk must be listening on `0.0.0.0`.

```
EXPO_PUBLIC_SUPABASE_URL=http://LAN:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
EXPO_PUBLIC_DESK_URL=http://LAN:3000
EXPO_PUBLIC_WEB_URL=http://LAN:3000
```

7. From `apps/mobile`, `npx expo start`. iOS Simulator: press `i`. Android Emulator: press `a`. Physical phone: install Expo Go from the App Store or Play Store and scan the QR code. Use `npx expo start --tunnel` only when the phone is not on the same Wi-Fi as Metro. The Supabase and desk URLs still have to be reachable from the phone.
8. Run beats 1 to 5 above. Beat 5 needs no Google vars.
9. Repeat steps 6 to 8 on the other platform.

Expo Go is enough. An Apple Developer account is not required. Store submission is later.
