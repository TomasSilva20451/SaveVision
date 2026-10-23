import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { ThemeBootstrap } from "@/components/shell/theme-bootstrap";
import "./globals.css";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeBootstrap />
        {children}
      </body>
    </html>
  );
}
