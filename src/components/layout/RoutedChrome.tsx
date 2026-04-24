"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

/**
 * The home page ("/") renders the Claude Design dashboard shell with its own
 * TopBar + SubBar. Every other route uses the classic Header nav.
 */
export default function RoutedChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen relative">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#1F6E2C]/[0.13] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-[#F4C71A]/[0.08] blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-[#2E8B3B]/[0.1] blur-[120px]" />
      </div>
      <Header />
      <main className="relative z-10 w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
