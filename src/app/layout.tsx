import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
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
  title: "Idées de Business",
  description: "Partage ton idée de business, la communauté vote et commente, l'IA l'améliore automatiquement.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSession();
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <Header user={user} />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-neutral-200 py-6 text-center text-sm text-neutral-500">
          Idées de Business — un espace pour partager, voter et améliorer des idées avec l&apos;IA.
        </footer>
      </body>
    </html>
  );
}
