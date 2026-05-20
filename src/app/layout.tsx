import type { Metadata } from "next";
import { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { DemoBanner } from "@/components/demo-banner";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DefiPilot — Tell us your DeFi goal. We'll build the plan.",
  description:
    "A DeFi robo-advisor. Pick a risk profile, type an intent in plain English, get a simulated multi-step pipeline you sign with your own wallet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-[100dvh] grid-bg antialiased">
        <Providers>
          <DemoBanner />
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
