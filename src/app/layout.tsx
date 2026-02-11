import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VP Dashboard | Vendingpreneurs",
  description:
    "Vendingpreneurs operational dashboard - onboarding, clients, leads, revenue, and quality tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <div className="min-h-screen relative">
          {/* Ambient background orbs — layout level */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/[0.07] blur-[120px]" />
            <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-purple-600/[0.07] blur-[120px]" />
            <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-emerald-600/[0.05] blur-[120px]" />
          </div>

          <Header />
          <main className="relative z-10 w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-8 overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
