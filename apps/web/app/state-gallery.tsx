import {
  aiCopy,
  chatCopy,
  copy,
  inboxCopy,
  programCopy,
  screenCopy,
} from "@cleat/domain";
import { OfflineBanner, ScreenState } from "./screen-state";

const ROUTES: { route: string; title: string; emptyTitle: string; emptyBody: string; loading: string }[] = [
  {
    route: "/accountability",
    title: "Accountability",
    emptyTitle: "No clients yet",
    emptyBody: programCopy.emptyBoard,
    loading: screenCopy.loadingBoard,
  },
  {
    route: "/inbox",
    title: "Priority inbox",
    emptyTitle: inboxCopy.empty,
    emptyBody: inboxCopy.empty,
    loading: screenCopy.loadingInbox,
  },
  {
    route: "/clients",
    title: "Clients",
    emptyTitle: "No clients yet",
    emptyBody: copy.noClients,
    loading: screenCopy.loadingClients,
  },
  {
    route: "/programs",
    title: "Programs",
    emptyTitle: "No clients yet",
    emptyBody: programCopy.emptyClients,
    loading: screenCopy.loadingPrograms,
  },
  {
    route: "/chat",
    title: "Chat",
    emptyTitle: "No messages yet",
    emptyBody: chatCopy.emptyThread,
    loading: screenCopy.loadingChat,
  },
  {
    route: "/knowledge",
    title: "Knowledge",
    emptyTitle: "No articles yet",
    emptyBody: aiCopy.noArticles,
    loading: screenCopy.loadingKnowledge,
  },
  {
    route: "/calendar",
    title: "Calendar",
    emptyTitle: screenCopy.emptyCalendarTitle,
    emptyBody: screenCopy.emptyCalendarBody,
    loading: screenCopy.loadingCalendar,
  },
  {
    route: "/ai-settings",
    title: "AI settings",
    emptyTitle: screenCopy.emptySettingsTitle,
    emptyBody: screenCopy.emptySettingsBody,
    loading: screenCopy.loadingSettings,
  },
  {
    route: "/audit",
    title: "Audit log",
    emptyTitle: "No AI actions yet",
    emptyBody: aiCopy.noAudits,
    loading: screenCopy.loadingAudit,
  },
  {
    route: "/org",
    title: "Org / Billing",
    emptyTitle: screenCopy.emptyOrgTitle,
    emptyBody: screenCopy.emptyOrgBody,
    loading: screenCopy.loadingOrg,
  },
];

export const STATE_ROUTES = ROUTES.map((item) => item.route);

export function StateGallery() {
  return (
    <main>
      {ROUTES.map((item) => (
        <section key={item.route} data-route={item.route} aria-label={item.title}>
          <h1>{item.title}</h1>
          <ScreenState kind="loading" title={item.loading} />
          <ScreenState kind="empty" title={item.emptyTitle} body={item.emptyBody} />
          <ScreenState
            kind="error"
            title={screenCopy.couldNotLoad}
            body="JWT expired: PGRST301"
            onRetry={() => undefined}
          />
          <OfflineBanner message={screenCopy.offline} />
        </section>
      ))}
    </main>
  );
}
