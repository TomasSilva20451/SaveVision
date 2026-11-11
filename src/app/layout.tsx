import type { Metadata, Viewport } from "next";
import { ViewTransition, type ReactNode } from "react";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SessionResume } from "@/components/auth/session-resume";
import { ThemeBootstrap } from "@/components/shell/theme-bootstrap";
import "./globals.css";

const isProduction = process.env.NODE_ENV === "production";

const geistSans = localFont({
  src: "./fonts/geist-sans.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

const geistMono = localFont({
  src: "./fonts/geist-mono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "FinTwin",
  description: "Gestão financeira privada",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script src="/privacy-bootstrap.js?v=3" defer />
        <ThemeBootstrap />
        <SessionResume />
        <ViewTransition default="app-route">{children}</ViewTransition>
        {isProduction ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
