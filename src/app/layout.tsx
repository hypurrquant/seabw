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
  title: "DefiPilot — Put your stablecoins to work.",
  description:
    "A stablecoin robo-advisor. Hold USDC, USDT, or DAI? Pick a risk profile, get a tier-compliant DeFi plan — lending, LP, only the swaps it needs — and sign every step from your own wallet.",
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
