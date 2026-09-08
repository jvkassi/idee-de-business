import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Idées de Business", template: "%s · Idées de Business" },
  description:
    "Partage ton idée de business, la communauté vote et commente, l'IA la structure, la note et l'illustre automatiquement.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSession();
  return (
    <html lang="fr" className={`${jakarta.variable} ${grotesk.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Header user={user} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-line py-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 text-xs text-ink-3 sm:flex-row">
            <p>
              <span className="font-display font-semibold text-ink-2">Idées de Business</span> — partage,
              vote, améliore avec l&apos;IA.
            </p>
            <p>
              Illustrations et analyses générées par Gemini ·{" "}
              <Link href="/ideas/new" className="text-ink-2 hover:text-ink">
                Proposer une idée
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
