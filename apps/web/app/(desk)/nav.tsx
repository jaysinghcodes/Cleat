"use client";

import type { Membership } from "@cleat/domain";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "../session";
import { ThemeCycle } from "../theme";

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
}: {
  membership: Membership;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useSession();

  return (
    <div className="desk">
      <aside className="sidebar">
        <Link className="brand" href="/accountability">
          <span className="brand-mark">
            <img src="/cleat-mark-charcoal.png" alt="" />
          </span>
          Cleat
        </Link>
        <nav className="nav">
          {DESK_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "active" : undefined}
            >
              {item.label}
            </Link>
          ))}
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
            onClick={() => {
              void signOut().then(() => router.replace("/login"));
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
