import { APP_NAME } from "@coachloop/domain";
import { ThemeCycle } from "./theme";

export default function HomePage() {
  return (
    <main>
      <p className="kicker">Trainer desk</p>
      <h1>{APP_NAME}</h1>
      <p>
        Empty scaffold for the trainer web app. Clients, programs, accountability,
        inbox, audit, and calendar arrive in later tickets.
      </p>
      <p>
        Health check: <a href="/api/health">/api/health</a>
      </p>
      <ThemeCycle />
    </main>
  );
}
