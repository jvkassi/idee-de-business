import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import "./globals.css";

// Deux voix, deux familles : Bricolage pour ce que l'humain écrit (titres,
// idées), Instrument pour l'interface et tout ce que la machine produit.
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

const SITE_URL = "https://idee-de-business.vercel.app";
const DESCRIPTION =
  "Partage ton idée de business, la communauté vote et commente, l'IA la structure, la note et l'illustre automatiquement.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Idées de Business", template: "%s · Idées de Business" },
  description: DESCRIPTION,
  openGraph: {
    title: "Idées de Business",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Idées de Business",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/og-cover.jpg", width: 1376, height: 768, alt: "Idées de Business" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Idées de Business",
    description: DESCRIPTION,
    images: ["/og-cover.jpg"],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSession();
  return (
    <html lang="fr" className={`${bricolage.variable} ${instrument.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Header user={user} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-line py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-display font-bold text-ink-2">Idées de Business</span> — une idée brute, une
              fiche, un vote. Fiches et illustrations générées par Gemini. La communauté a le dernier mot.
            </p>
            <nav aria-label="Pied de page" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                Comment ça marche
              </Link>
              <Link href="/ideas" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                Toutes les idées
              </Link>
              <Link href="/faq" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                FAQ
              </Link>
              <Link href="/ideas/new" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                Proposer une idée
              </Link>
            </nav>
          </div>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
