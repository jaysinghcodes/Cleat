import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MARKETING_SUBLINE, MARKETING_TITLE } from "../../components/marketing/landing";

function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { absolute: MARKETING_TITLE },
  description: MARKETING_SUBLINE,
  openGraph: {
    title: MARKETING_TITLE,
    description: MARKETING_SUBLINE,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Cleat hero and accountability preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: MARKETING_TITLE,
    description: MARKETING_SUBLINE,
    images: ["/og.png"],
  },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return children;
}
