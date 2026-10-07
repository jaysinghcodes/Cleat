# Cleat Design Decisions

*Final · Oct 7 2026 · Owner: Jay Singh · Status: approved by Jay Oct 7 2026; wireframes are the build spec*

## 1. Product

**Cleat** is trainer and client fitness accountability with **confidence-gated AI** and a **priority inbox**. Clients log workouts and chat on an **Expo iOS/Android** app. Trainers run their roster from a **Next.js web desk**. The AI answers only when it's confident and sources match. Anything injury/medical, ambiguous or low-confidence is escalated to the trainer, and every action is audited.

## 2. Name

- **Cleat** (formerly *CoachLoop*).
- Renamed because of an **App Store naming conflict** with "CoachLoop".
- Risk read: **low to medium**. **Trademark not yet cleared by counsel.** Clear it before public launch.

## 3. Logo

- Mark: **segmented apricot cleat**, angled, peeking in from the **top-right corner** of the tile.
- **Primary icon: the charcoal-background version** (`app-icon-charcoal-angled.jpg`; UI crop `assets/cleat-mark-charcoal.png`). It's used in the sidebar, auth, landing and index.
- Website lockup = cleat mark + **"Cleat"** wordmark.
- The cream/peach tile icon is retired from the UI.

## 4. Palette

**Brand accent: Soft Apricot `#E8A87C`.** It's the single accent, used only for the primary button, active nav, AI dots and the confidence fill. Cream chip fill `#FFEDD5` is for rare small chips only.

### Dark · Warm mist (default)

| Token | Hex | Use |
|---|---|---|
| Sidebar | `#211F1E` | Nav column, code blocks |
| Page | `#262423` | App background |
| Card | `#312E2C` | Surfaces |
| Raised | `#3C3936` | Hover, active row, inputs-on-card, avatars |
| Border | `rgba(255,255,255,0.08)` | Hairlines (6% soft, 14% strong) |
| Text 1 / 2 / 3 | `#F3F0EC` / `#B5AFA9` / `#9D9791` | Primary / secondary / tertiary |
| Accent | `#E8A87C` | Fill + accent text |
| CTA label | `#1C1917` | Text on apricot |
| Success / Warn / Error | `#7CC79F` / `#DCBC72` / `#EE9088` | Dots and tinted text; 14 to 15% tint fills |

### Light · Grey + white cards

| Token | Hex | Use |
|---|---|---|
| Sidebar | `#FAFAFA` | Nav column |
| Page | `#F4F4F5` | App background (cool grey, no cream flood) |
| Card | `#FFFFFF` | Surfaces, soft shadow |
| Border | `#D4D4D8` | Hairlines (`#E4E4E7` soft) |
| Text 1 / 2 / 3 | `#1C1917` / `#57534E` / `#6B6B74` | Primary / secondary / tertiary |
| Accent fill | `#E8A87C` | Buttons, active nav, AI dots |
| Accent text | `#9A5B2F` | Apricot-family text on light |
| Success / Warn / Error | `#15803D` / `#9E6007` / `#B91C1C` | Dots and tinted text; 7 to 9% tint fills |

> Warn was nudged from `#A16207` to `#9E6007` (visually identical) so it passes AA on the grey page too, not just on white cards.

## 5. Contrast (WCAG AA, 4.5:1 for body text)

| Pair | Dark: page / card | Light: page / card |
|---|---:|---:|
| Primary text | 13.60 / 11.87 ✅ | 15.91 / 17.49 ✅ |
| Secondary | 7.12 / 6.21 ✅ | 6.94 / 7.63 ✅ |
| Tertiary | 5.35 / 4.67 ✅ | 4.80 / 5.28 ✅ |
| Accent text | 7.60 / 6.63 ✅ (`#E8A87C`) | 4.88 / 5.37 ✅ (`#9A5B2F`) |
| Success | 7.75 / 6.76 ✅ | 4.56 / 5.02 ✅ |
| Warning | 8.45 / 7.37 ✅ | 4.63 / 5.08 ✅ |
| Error | 6.61 / 5.76 ✅ | 5.89 / 6.47 ✅ |
| Charcoal `#1C1917` on apricot | 8.60 ✅ | 8.60 ✅ |

**Rules**
- **Never put white text on apricot** (2.03:1 ❌). Button labels on apricot are always charcoal `#1C1917`.
- **Never use apricot `#E8A87C` as text on light** (2.03:1 on white ❌). Use `#9A5B2F`.
- Dark tertiary text goes on page or card only. On *raised* it drops to 3.97:1, so use secondary there.

## 6. Hierarchy & UI rules

1. **Single accent.** Apricot marks the one primary action per view, the active nav item, AI dots and the confidence fill. Secondary actions are neutral buttons.
2. **Chips:** neutral pill (5% fill) + **small colored status dot** + tinted text. Only *urgent/injury* chips get a tinted fill.
3. **Rails:** a 3px colored left rail **only on urgent/injury** items. No apricot, yellow or green rails. "Current" items get a soft apricot ring instead.
4. **Confidence bar:** thin neutral track, **apricot fill** for the review band, muted red for low and muted green for high. The number is in primary text. No bright yellow.
5. **Borders:** hairline. White 8% on dark, `#D4D4D8` on light. No heavy stone lines.
6. **Elevation by lightness:** sidebar < page < card < raised, roughly 4 to 5 OKLCH lightness points per step. Shadows are minimal in dark mode.
7. **Avatars** are neutral. Only urgent/needs-nudge avatars take the error tint.
8. **Stats** use neutral numbers with a status dot in the label, not big colored numerals.
9. **Copy rules:** No dash punctuation in product copy (no em dash, en dash, or spaced hyphen used as punctuation). Hyphenated words like check-in or sign-up are fine. Locked marketing copy: hero "Your coaching. Never a guess."; hero subline "Cleat keeps clients logging on iOS and Android, shows you who skipped and who needs a nudge, and answers routine questions from your own programs only when it's sure. Everything else comes to you."; AI section "It answers when it's sure. You answer the rest."; accountability section "Every rep logged. Every skip seen."

## 7. Theme behavior

- **Follows the OS** light/dark setting by default.
- **Manual toggle:** System → Dark → Light (remembered per device).
- Wireframes: `?theme=dark` / `?theme=light` previews any screen.

## 8. Decision log

| Date (2026) | Decision |
|---|---|
| Oct 7 | Name change CoachLoop → **Cleat** (App Store conflict; TM not yet cleared by counsel). |
| Oct 7 | Palette explorations: **teal** and **lilac** rejected. **Soft Apricot `#E8A87C`** chosen as the brand accent. |
| Oct 7 | Logo: segmented apricot cleat, angled top-right corner-peek; cream and charcoal app icons. |
| Oct 7 | Pass 1: cream/peach-flood UI. Too peachy (later partly walked back). |
| Oct 7 | Pass 2: charcoal-heavy `#141210`. **Too dark.** |
| Oct 7 | Pass 3: soft charcoal `#1C1917` (logo bg) + a grey/light-cards variant. Still dark, flat and murky: brown-stone surfaces too close in lightness, heavy borders, too many colored rails and chips. |
| Oct 7 | Compare: **3 darks** (Graphite, Slate dusk, Warm mist) + **2 lights** (Grey, Paper) on the trainer inbox, with hierarchy fixes. |
| Oct 7 | **Locked: Dark = Warm mist, Light = Grey + white cards; charcoal-background logo is primary.** Rolled across all wireframes. |
| Oct 7 | **Copy rule:** no dash punctuation in product text. Marketing tagline TBD / placeholder. |
| Oct 7 | **Tagline locked:** hero "Your coaching. Never a guess."; AI section "It answers when it's sure. You answer the rest."; accountability "Every rep logged. Every skip seen." |

## 9. Screen inventory (23)

| Area | Screen | Purpose |
|---|---|---|
| Hub | `index` | Wireframe index + theme notes |
| Marketing | `landing` | Marketing home: value prop, CTA, product preview |
| Auth | `auth-trainer-signup` | Create trainer + org account |
| Auth | `auth-trainer-login` | Trainer sign-in |
| Auth | `auth-client-invite` | Client accepts trainer invite link |
| Auth | `auth-client-login` | Mobile-first client sign-in |
| Trainer | `trainer-inbox` | Priority inbox: injury, AI escalations, missed workouts |
| Trainer | `trainer-accountability` | Done / skipped / needs-nudge board |
| Trainer | `trainer-clients` | Roster + client detail pane |
| Trainer | `trainer-programs` | Program builder, templates, assign |
| Trainer | `trainer-chat` | Client chat + held AI draft, confidence, sources |
| Trainer | `trainer-kb` | Knowledge / FAQ base (RAG sources) |
| Trainer | `trainer-calendar` | Bookings, availability, ICS sync |
| Trainer | `trainer-ai-settings` | Confidence threshold, hard refuses, voice |
| Trainer | `trainer-audit` | Reconstructible audit of every AI action |
| Trainer | `trainer-org` | Org, settings, billing (stub) |
| Client | `client-today` | Today's workout, log sets |
| Client | `client-log` | Focused set logging |
| Client | `client-program` | Week overview |
| Client | `client-chat` | Chat, high-confidence AI auto-reply |
| Client | `client-chat-escalated` | Chat, escalated "trainer will reply" |
| Client | `client-book` | Book / cancel sessions |
| Client | `client-profile` | Profile, theme, account |

Screenshots: `final/dark/<screen>.png`, `final/light/<screen>.png`, overviews `final/overview-dark.png` / `final/overview-light.png`.

## 10. Next steps

1. Done: Jay confirmed this doc and the final screenshots on Oct 7 2026.
2. **Forge builds the UI from these wireframes** (Expo client app + Next.js trainer desk), implementing these tokens as the theme source of truth.
3. **Rename the repo `coachloop` → `cleat`** (packages, bundle IDs, app display name).
4. Trademark clearance for "Cleat" by counsel before public launch.
