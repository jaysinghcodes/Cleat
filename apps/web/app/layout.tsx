import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@cleat/domain";
import { themeStylesheet } from "@cleat/theme";
import "./globals.css";
import { themeBootScript } from "./theme-boot";
import { ThemeProvider } from "./theme";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: "Cleat trainer desk.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStylesheet }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
