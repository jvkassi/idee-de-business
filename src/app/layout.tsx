import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Space_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import "./globals.css";

// Trois voix : Bricolage pour ce que l'humain écrit (titres, idées),
// Instrument pour l'interface et la machine, Space Mono pour les chiffres
// et étiquettes (scores, minuteurs, badges de fil).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-spacemono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const SITE_URL = "https://www.djossi.app";
const DESCRIPTION =
  "Djossi : partage ton idée de business, la communauté vote, et trouve un vrai travail parmi les offres vérifiées chaque jour. Gratuit, en français.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Djossi", template: "%s · Djossi" },
  description: DESCRIPTION,
  openGraph: {
    title: "Djossi",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Djossi",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/og-cover.jpg", width: 1376, height: 768, alt: "Djossi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Djossi",
    description: DESCRIPTION,
    images: ["/og-cover.jpg"],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSession();
  return (
    <html lang="fr" className={`${bricolage.variable} ${instrument.variable} ${spaceMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Header user={user} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-line py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-display font-bold text-ink-2">Djossi</span> — une idée brute, une
              fiche, un vote, un vrai travail. Fait avec soin à Abidjan.
            </p>
            <nav aria-label="Pied de page" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {[
                ["/", "Comment ça marche"],
                ["/ideas", "Toutes les idées"],
                ["/faq", "FAQ"],
                ["/ideas/new", "Proposer une idée"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center py-2.5 text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
