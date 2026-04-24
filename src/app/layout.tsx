import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RoutedChrome from "@/components/layout/RoutedChrome";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Modern Amenities · Operator Onboarding",
  description:
    "Live onboarding pipeline tracker for every operator across Close CRM, email validation, Airtable, Mighty Networks, Intercom, and VendHub.",
  icons: {
    icon: "/brand/modern-amenities-mark.svg",
    apple: "/brand/modern-amenities-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <RoutedChrome>{children}</RoutedChrome>
      </body>
    </html>
  );
}
