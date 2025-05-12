import type { Metadata } from "next";
import { Roboto } from "next/font/google"; // Changed from Inter to Roboto
import "./globals.css";
import Link from "next/link";
import ArrowIfNotHome from './components/ArrowIfNotHome';
import SessionProvider from './components/SessionProvider';
import { usePathname } from 'next/navigation';

// Instantiate Roboto with desired weights and subsets
const roboto = Roboto({
  weight: ['400', '500', '700'], // Common weights: regular, medium, bold
  subsets: ["latin"],
  display: 'swap', // Ensures text remains visible during font loading
  variable: '--font-roboto' // Optional: if you want to use it as a CSS variable
});

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
    <html lang="en" className={`${roboto.variable} font-sans`}> {/* Added roboto.variable and font-sans for Tailwind */} 
      <body className={`${roboto.className} bg-gray-900 text-gray-100 min-h-screen`}> {/* Applied roboto.className */} 
        <SessionProvider>
          <ArrowIfNotHome />
          <main>{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
