"use client";

import { APP_NAME } from "@cleat/domain";
import type { InputHTMLAttributes, ReactNode } from "react";
import { ThemeCycle } from "./theme";

export function BrandLockup() {
  return (
    <div className="lockup">
      <img src="/cleat-mark-charcoal.png" alt="" width={32} height={32} />
      <span>{APP_NAME}</span>
    </div>
  );
}

export function AuthFrame({
  title,
  lede,
  children,
  foot,
}: {
  title: string;
  lede: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <BrandLockup />
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        {children}
        {foot ? <div className="auth-foot">{foot}</div> : null}
        <ThemeCycle />
      </div>
    </div>
  );
}

export function FullPageStatus({ body }: { body: string }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <BrandLockup />
        <p className="lede">{body}</p>
        <ThemeCycle />
      </div>
    </div>
  );
}

export function Unconfigured() {
  return <FullPageStatus body="Add the Supabase URL and anon key to the environment, then reload." />;
}

export function TextField({
  label,
  id,
  ...props
}: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </div>
  );
}

export function Banner({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return <div className={tone === "error" ? "banner banner-error" : "banner banner-ok"}>{children}</div>;
}
