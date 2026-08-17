import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Parcel Delivery | Video Management System for Sellers",
  description:
    "Packing, return and claim video proof linked to every Tracking ID. A secure VMS built for Indian e-commerce sellers.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [{ url: "/favicon-transparent.png", type: "image/png", sizes: "128x128" }],
    shortcut: "/favicon-transparent.png",
    apple: "/brand-logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
