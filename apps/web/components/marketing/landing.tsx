import { ThemeCycle } from "../../app/theme";

export const MARKETING_TITLE = "Cleat · Your coaching. Never a guess.";

export const MARKETING_PILL = "For independent and online coaches";

export const MARKETING_H1 = "Your coaching. Never a guess.";

export const MARKETING_SUBLINE =
  "Cleat keeps clients logging on iOS and Android, shows you who skipped and who needs a nudge, and answers routine questions from your own programs only when it's sure. Everything else comes to you.";

export const MARKETING_PROOF =
  "iOS and Android client app · Trainer desk on the web · Audit trail on every AI reply";

export const MARKETING_SECTIONS = [
  {
    title: "Every rep logged. Every skip seen.",
    body: "Clients log sets and weights in the Cleat app on iOS and Android. Your desk shows who trained, who skipped and who needs a nudge, before they go quiet.",
  },
  {
    title: "It answers when it's sure. You answer the rest.",
    body: "Routine questions get answers from your own programs and FAQs. Injuries, unclear questions and anything below your confidence threshold land in your priority inbox with a draft and its sources. Every AI reply is logged.",
  },
  {
    title: "Booked on your calendar.",
    body: "Clients pick a slot in the app. Sessions land on your calendar through an ICS feed, or Google if you connect it.",
  },
] as const;

export const MARKETING_DISCLAIMER = "Cleat is coaching software, not medical advice.";

export const GITHUB_URL = "https://github.com/jaysinghcodes/Cleat";

export const TRAINER_SIGNUP_HREF = "/signup";

export const TRAINER_LOGIN_HREF = "/login";

/** Ticket 1 client invite lives on the Expo app, not the trainer desk. */
export function clientInviteHref(): string {
  const configured = process.env.NEXT_PUBLIC_CLIENT_APP_URL?.trim().replace(/\/$/, "");
  return `${configured || "http://localhost:8081"}/invite`;
}

function Mark({ size }: { size: number }) {
  return (
    <img src="/cleat-mark-charcoal.png" alt="Cleat mark" width={size} height={size} />
  );
}

function Status({ tone, children }: { tone: "done" | "nudge" | "ai"; children: string }) {
  return <span className={`mkt-status mkt-${tone}`}>{children}</span>;
}

export function Landing() {
  return (
    <div className="mkt">
      <header className="mkt-nav">
        <a className="mkt-lockup" href="/">
          <Mark size={32} />
          <span>Cleat</span>
        </a>
        <nav className="mkt-links" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href={TRAINER_LOGIN_HREF}>Log in</a>
          <a className="btn btn-primary btn-sm" href={TRAINER_SIGNUP_HREF}>
            Start free
          </a>
          <ThemeCycle />
        </nav>
      </header>
      <main>
        <section className="mkt-hero">
          <div>
            <p className="mkt-pill">{MARKETING_PILL}</p>
            <h1>{MARKETING_H1}</h1>
            <p className="mkt-lede">{MARKETING_SUBLINE}</p>
            <div className="mkt-cta">
              <a className="btn btn-primary btn-lg" href={TRAINER_SIGNUP_HREF}>
                Create trainer account
              </a>
              <a className="btn btn-ghost btn-lg" href={clientInviteHref()}>
                I have an invite
              </a>
            </div>
            <p className="mkt-proof">{MARKETING_PROOF}</p>
          </div>
          <div className="mkt-viz" role="region" aria-label="Accountability preview">
            <div className="mkt-viz-head">
              <div className="name">Today · Accountability</div>
              <div className="mkt-viz-pills">
                <Status tone="done">8 done</Status>
                <Status tone="nudge">2 nudge</Status>
              </div>
            </div>
            <div className="mkt-board">
              <div className="mkt-person">
                <div className="mkt-avatar" aria-hidden="true">
                  SL
                </div>
                <div>
                  <div className="name">Sam Lee</div>
                  <div className="meta">Lower A logged</div>
                </div>
                <Status tone="done">Done</Status>
              </div>
              <div className="mkt-person">
                <div className="mkt-avatar mkt-avatar-nudge" aria-hidden="true">
                  CT
                </div>
                <div>
                  <div className="name">Casey Torres</div>
                  <div className="meta">3 days silent</div>
                </div>
                <Status tone="nudge">Nudge</Status>
              </div>
              <div className="mkt-person">
                <div className="mkt-avatar" aria-hidden="true">
                  MP
                </div>
                <div>
                  <div className="name">Morgan · AI draft held</div>
                  <div className="meta">conf 0.48 · escalate</div>
                </div>
                <Status tone="ai">Review</Status>
              </div>
            </div>
          </div>
        </section>
        <section id="how" className="mkt-sections" aria-label="How it works">
          <div className="mkt-grid">
            {MARKETING_SECTIONS.map((section) => (
              <article className="mkt-card" key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="mkt-footer">
        <div className="mkt-footer-mark">
          <Mark size={28} />
          <span>Cleat</span>
        </div>
        <div className="mkt-footer-links">
          <a href={GITHUB_URL}>GitHub</a>
          <span>{MARKETING_DISCLAIMER}</span>
        </div>
      </footer>
    </div>
  );
}
