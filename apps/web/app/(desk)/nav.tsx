"use client";

import { screenCopy, type Membership } from "@cleat/domain";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import { useOnline } from "../online";
import { OfflineBanner, ScreenState } from "../screen-state";
import { useSession } from "../session";
import { ThemeCycle } from "../theme";
import { shouldHoldDynamicDeskNav } from "./nav-offline";

export const DESK_NAV = [
  { href: "/accountability", label: "Accountability" },
  { href: "/inbox", label: "Priority inbox" },
  { href: "/clients", label: "Clients" },
  { href: "/programs", label: "Programs" },
  { href: "/chat", label: "Chat" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/calendar", label: "Calendar" },
  { href: "/ai-settings", label: "AI settings" },
  { href: "/audit", label: "Audit log" },
  { href: "/org", label: "Org / Billing" },
] as const;

export function DeskShell({
  membership,
  children,
  activeHref,
}: {
  membership: Membership;
  children: ReactNode;
  activeHref?: string;
}) {
  const currentPath = usePathname();
  const pathname = activeHref ?? currentPath;
  const router = useRouter();
  const { signOut } = useSession();
  const online = useOnline();
  const [heldOffline, setHeldOffline] = useState(false);
  const showOffline = !online || heldOffline;

  async function openDynamic(href: string) {
    const browserOnline = typeof navigator === "undefined" ? online : navigator.onLine;
    let fetchThrew = false;
    if (browserOnline) {
      try {
        await fetch(href, { cache: "no-store" });
      } catch {
        fetchThrew = true;
      }
    }
    if (shouldHoldDynamicDeskNav(href, browserOnline, fetchThrew)) {
      setHeldOffline(true);
      return;
    }
    setHeldOffline(false);
    router.push(href);
  }

  function onNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (href !== "/inbox" && href !== "/org") {
      setHeldOffline(false);
      return;
    }
    event.preventDefault();
    void openDynamic(href);
  }

  return (
    <div className="desk">
      <aside className="sidebar">
        <Link className="brand" href="/accountability">
          <span className="brand-mark">
            <img src="/cleat-mark-charcoal.png" alt="" />
          </span>
          Cleat
        </Link>
        <nav className="nav" aria-label="Desk">
          {DESK_NAV.map((item) => {
            const active =
              item.href === "/chat"
                ? pathname === "/chat" || pathname.startsWith("/chat/")
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={(event) => onNavClick(event, item.href)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">
          <div>
            {membership.displayName} · Coach
            <br />
            Org: {membership.orgName}
          </div>
          <ThemeCycle />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Log out"
            onClick={() => {
              void signOut().then(() => router.replace("/login"));
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        {showOffline ? <OfflineBanner message={screenCopy.offline} /> : null}
        {heldOffline ? <ScreenState kind="offline" title={screenCopy.offline} /> : children}
      </main>
    </div>
  );
}
