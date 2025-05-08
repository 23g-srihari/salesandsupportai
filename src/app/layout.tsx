import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import ArrowIfNotHome from './components/ArrowIfNotHome';
import SessionProvider from './components/SessionProvider';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sales and Support AI",
  description: "AI-powered sales and support assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-gray-100 min-h-screen`}>
        <SessionProvider>
          <ArrowIfNotHome />
          <main>{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
