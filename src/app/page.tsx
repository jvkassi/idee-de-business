import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { getCategories, getSiteStats, listFeaturedIdeas } from "@/lib/ideas";
import { KIT_SCORE_THRESHOLD } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { loginHref, plural } from "@/lib/format";
import { categoryStyle } from "@/lib/categoryColor";
import { AiTag } from "@/components/AiBadge";
import BeforeAfter from "@/components/BeforeAfter";
import IdeaCard from "@/components/IdeaCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Idées de Business — le GitHub des idées de business, en Côte d'Ivoire" },
  description:
    "Raconte ton idée à voix haute en 30 secondes. L'IA la structure et la note sur 100, la communauté vote et réagit, et au-dessus de 70/100 tu débloques ton dossier de démarrage : landing page, architecture, flyer. Gratuit.",
};

/* ---------------------------------------------------------------------------
   Copie et données statiques de la page
   ------------------------------------------------------------------------- */

type Who = "toi" | "ia" | "eux";

const STEPS: { who: Who; title: string; text: string; time: string }[] = [
  {
    who: "toi",
    title: "Tu la racontes à voix haute",
    text: "Trente secondes, en français, comme à un ami. Pas de business plan, pas de formulaire de douze pages. L'écrit reste possible si tu préfères.",
    time: "30 s",
  },
  {
    who: "ia",
    title: "La machine la structure et la note",
    text: "Cible, proposition de valeur, modèle de revenus, risques, premiers pas : une fiche complète, une note sur 100 et une illustration. Sous la minute.",
    time: "~45 s",
  },
  {
    who: "eux",
    title: "La communauté tranche",
    text: "Votes, réactions, versions reprises. Tout est public : c'est là qu'une idée se confronte au réel — et que tu croises peut-être ton futur associé.",
    time: "en continu",
  },
  {
    who: "toi",
    title: "Tu débloques ton dossier de démarrage",
    text: `À partir de ${KIT_SCORE_THRESHOLD}/100 : landing page de démo, architecture système, périmètre MVP et flyer, générés d'un clic. Gratuit.`,
    time: "~3 min",
  },
];

const KIT_ITEMS: { title: string; text: string; icon: string }[] = [
  {
    icon: "🖥️",
    title: "Landing page de démo",
    text: "Une vraie page web à ton nom : titre, promesse, arguments, FAQ. Cliquable, partageable, prête à être montrée.",
  },
  {
    icon: "🧩",
    title: "Architecture système",
    text: "Les briques techniques à assembler, expliquées en clair, avec une stack suggérée pour parler aux développeurs.",
  },
  {
    icon: "🎯",
    title: "Périmètre MVP",
    text: "Les quelques fonctionnalités à construire d'abord et le premier jalon à viser. Pas la version idéale, la version qui démarre.",
  },
  {
    icon: "📣",
    title: "Flyer",
    text: "Une affiche générée pour ton projet, à envoyer sur WhatsApp, poster sur Instagram ou imprimer pour le quartier.",
  },
];

const WHY_PUBLIC: { title: string; text: string }[] = [
  {
    title: "Une idée cachée ne rapporte rien.",
    text: "Ce qui compte, c'est l'exécution — et l'exécution commence par en parler. Publier, c'est prendre date, récolter des avis vrais et trouver des alliés.",
  },
  {
    title: "Faire sa propre version.",
    text: "N'importe qui peut reprendre une idée à sa façon, à voix haute : l'IA note la nouvelle version, l'originale reste inchangée et signée de son auteur.",
  },
  {
    title: "Une note honnête.",
    text: "La note IA mesure la clarté et la cohérence de ta présentation, pas le marché. Le marché, c'est la communauté — puis tes premiers clients.",
  },
];

const CITIES = ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo", "Daloa", "Man", "Grand-Bassam"];

/* ---------------------------------------------------------------------------
   Petits composants de présentation
   ------------------------------------------------------------------------- */

/** Qui agit à cette étape : l'humain en soleil, la machine en encre, la foule en trait. */
function WhoTag({ who }: { who: Who }) {
  if (who === "ia") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
        <AiTag /> la machine
      </span>
    );
  }
  if (who === "eux") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
        <span className="inline-flex h-[18px] items-center rounded-[5px] border border-ink px-1.5 font-display text-[10px] font-bold leading-none tracking-wide">
          +1
        </span>
        la communauté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
      <span className="inline-flex h-[18px] items-center rounded-[5px] border border-ink bg-sun px-1.5 font-display text-[10px] font-bold leading-none tracking-wide">
        TOI
      </span>
      toi
    </span>
  );
}

function SectionHeading({ label, title, lede }: { label: string; title: ReactNode; lede?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="label">{label}</p>
      <h2 className="mt-2 font-display text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl">{title}</h2>
      {lede && <p className="mt-4 text-base leading-relaxed text-ink-2">{lede}</p>}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="skeleton h-8 w-16" />
          <div className="skeleton mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Compteurs réels, lus en base au moment de la requête : l'élan, pas des promesses. */
async function LiveStats() {
  const s = await getSiteStats();
  if (s.ideas === 0) return null;
  const tiles: { value: number; label: string; human?: boolean }[] = [
    { value: s.ideas, label: s.ideas > 1 ? "idées publiées" : "idée publiée" },
    { value: s.votes, label: s.votes > 1 ? "votes de soutien" : "vote de soutien", human: true },
    { value: s.comments + s.forks, label: "réactions & versions", human: true },
    { value: s.validated, label: `au-dessus de ${KIT_SCORE_THRESHOLD}/100` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card p-4">
          <p className="font-display text-3xl font-bold leading-none tracking-tight tabular-nums sm:text-4xl">
            {t.human ? <span className="hl">{t.value}</span> : t.value}
          </p>
          <p className="mt-2 text-xs font-medium text-ink-2">{t.label}</p>
        </div>
      ))}
      <p className="col-span-2 text-xs text-ink-3 sm:col-span-4">
        Chiffres en direct. {plural(s.users, "membre")} ont déjà un pseudo
        {s.kits > 0 && <> · {plural(s.kits, "dossier de démarrage généré", "dossiers de démarrage générés")}</>}.
      </p>
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card flex gap-4 p-4">
          <div className="skeleton h-20 w-20 shrink-0 rounded-xl sm:h-28 sm:w-40" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton h-6 w-3/4" />
            <div className="skeleton h-3.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Trois idées réelles du fil, les plus soutenues : la preuve par l'exemple. */
async function FeaturedIdeas({ loggedIn }: { loggedIn: boolean }) {
  const ideas = await listFeaturedIdeas(3);
  if (ideas.length === 0) {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center">
        <div className="mat mb-4 grid h-16 w-16 place-items-center rounded-2xl text-3xl" aria-hidden>
          💡
        </div>
        <h3 className="font-display text-xl font-bold">Le fil est vide, à toi d&apos;ouvrir</h3>
        <p className="mt-1 max-w-sm text-sm text-ink-2">
          La première idée publiée aura sa fiche, sa note et son illustration en moins d&apos;une minute.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} loggedIn={loggedIn} />
      ))}
    </div>
  );
}

/** Les domaines, une pastille de couleur chacun, qui mènent au fil filtré. */
async function CategoryRail() {
  const categories = await getCategories();
  return (
    <ul className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <li key={c.slug} style={categoryStyle(c.slug)}>
          <Link href={`/ideas?cat=${c.slug}`} className="chip">
            <span className="cat-dot" aria-hidden /> {c.emoji} {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
   La page
   ------------------------------------------------------------------------- */

export default async function LandingPage() {
  const user = await getSession();
  const submitHref = user ? "/ideas/new" : loginHref("/ideas/new");

  return (
    <div className="-mt-6 sm:-mt-8">
      {/* ------------------------------------------------------------- Hero */}
      <section className="grid items-center gap-10 py-12 md:grid-cols-[1.15fr_1fr] md:gap-12 md:py-20">
        <div>
          <p className="label flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-sun ring-1 ring-ink" aria-hidden />
            Le GitHub des idées de business · Côte d&apos;Ivoire
          </p>
          <h1 className="mt-4 font-display text-[2.6rem] font-bold leading-[1] tracking-tight sm:text-6xl lg:text-[4.25rem]">
            Ton idée mérite mieux qu&apos;une note dans ton téléphone.{" "}
            <span className="hl">Dis-la.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Trente secondes à voix haute. L&apos;IA la transforme en fiche notée sur 100, la communauté vote et
            réagit, et si elle tient la route, tu repars avec ton dossier de démarrage — landing page, architecture,
            flyer. <span className="font-medium text-ink">Gratuit, public, en français.</span>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={submitHref} className="btn btn-sun px-6 py-3.5 text-base">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="7" y="2.5" width="6" height="10" rx="3" />
                <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" strokeLinecap="round" />
              </svg>
              Proposer mon idée
            </Link>
            <Link href="/ideas" className="btn btn-outline px-5 py-3.5 text-base">
              Explorer les idées →
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-3">Juste un pseudo, pas de mot de passe. Rien à installer.</p>
        </div>
        <BeforeAfter />
      </section>

      {/* ------------------------------------------------------- Compteurs */}
      <section aria-label="Chiffres en direct" className="border-t border-line py-8">
        <Suspense fallback={<StatsSkeleton />}>
          <LiveStats />
        </Suspense>
      </section>

      {/* ---------------------------------------------------------- Étapes */}
      <section className="border-t border-line py-14 sm:py-20" aria-labelledby="how-title">
        <SectionHeading
          label="Comment ça marche"
          title={
            <span id="how-title">
              Quatre étapes. <span className="hl">Une seule te demande un effort.</span>
            </span>
          }
          lede="Tu parles, la machine écrit, la communauté juge, et le dossier se génère. Chaque étape a une voix : la tienne en jaune, celle de l'IA en encre."
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={i} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="font-display text-5xl font-bold leading-none tracking-tight text-line-2">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold tabular-nums text-ink-2">
                  {s.time}
                </span>
              </div>
              <div className="mt-5">
                <WhoTag who={s.who} />
              </div>
              <h3 className="mt-2 font-display text-lg font-bold leading-snug">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------- Preuve sociale */}
      <section className="border-t border-line py-14 sm:py-20" aria-labelledby="proof-title">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            label="Déjà dans le fil"
            title={<span id="proof-title">Des idées vraies, notées et soutenues.</span>}
            lede="Pas des exemples inventés : les idées ci-dessous sont celles que la communauté pousse en ce moment. Lis, vote, propose ta version."
          />
          <Link href="/ideas" className="btn btn-ink shrink-0">
            Voir toutes les idées
          </Link>
        </div>
        <div className="mt-8">
          <Suspense fallback={<FeaturedSkeleton />}>
            <FeaturedIdeas loggedIn={!!user} />
          </Suspense>
        </div>
        <div className="mt-8">
          <p className="label mb-3">Par domaine</p>
          <Suspense fallback={<div className="skeleton h-9 w-full max-w-2xl rounded-full" />}>
            <CategoryRail />
          </Suspense>
        </div>
      </section>

      {/* ------------------------------------------------------ Starter kit */}
      <section className="border-t border-line py-14 sm:py-20" aria-labelledby="kit-title">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
          <div>
            <SectionHeading
              label="Le dossier de démarrage"
              title={
                <span id="kit-title">
                  Au-dessus de <span className="hl">{KIT_SCORE_THRESHOLD}/100</span>, ton idée devient un dossier.
                </span>
              }
              lede="Quand la fiche atteint le seuil, tu lances la génération d'un clic. Trois minutes plus tard, tu as de quoi montrer ton projet à un associé, un mentor ou un premier client."
            />
            <div className="mt-6 rounded-2xl border border-dashed border-line-2 bg-surface-2 p-4 text-sm leading-relaxed text-ink-2">
              <p className="mb-1 flex items-center gap-2 font-semibold text-ink">
                <AiTag /> On joue franc jeu
              </p>
              C&apos;est une maquette, pas un produit : rien n&apos;est branché derrière la landing page (ni base de
              données, ni paiement). C&apos;est fait pour montrer, pitcher et convaincre — pas pour vendre. Le vrai
              produit, c&apos;est toi qui le construis.{" "}
              <Link href="/faq#kit" className="font-medium text-ink underline-offset-4 hover:underline">
                En savoir plus
              </Link>
            </div>
            <Link href={submitHref} className="btn btn-sun mt-6 px-5 py-3">
              Je tente les {KIT_SCORE_THRESHOLD}/100
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {KIT_ITEMS.map((k) => (
              <li key={k.title} className="card p-5">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-sun-soft text-2xl" aria-hidden>
                  {k.icon}
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{k.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{k.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------- Pourquoi public */}
      <section className="border-t border-line py-14 sm:py-20" aria-labelledby="public-title">
        <SectionHeading
          label="Pourquoi tout est public"
          title={<span id="public-title">Comme un carnet ouvert : public, signé, réutilisable par tous.</span>}
        />
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {WHY_PUBLIC.map((w) => (
            <div key={w.title} className="border-l-[3px] border-sun pl-4">
              <h3 className="font-display text-lg font-bold leading-snug">{w.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{w.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-ink-2">
          « Et si quelqu&apos;un me vole mon idée ? » — c&apos;est la première question, on y répond sans détour dans la{" "}
          <Link href="/faq" className="font-medium text-ink underline-offset-4 hover:underline">
            FAQ
          </Link>
          .
        </p>
      </section>

      {/* ------------------------------------------------------- Appel final */}
      <section className="pb-6 pt-4 sm:pb-10" aria-labelledby="cta-title">
        <div className="relative overflow-hidden rounded-3xl border border-ink bg-sun px-6 py-12 text-center sm:px-12 sm:py-16">
          <p className="label text-ink/70">
            {CITIES.join(" · ")} · partout où il y a du réseau
          </p>
          <h2 id="cta-title" className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
            Ton idée, en trente secondes de voix. Le reste s&apos;écrit tout seul.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-ink/80">
            Un pseudo suffit. Ta fiche, ta note et ton illustration arrivent avant que tu aies fini ton café.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={submitHref} className="btn btn-ink px-6 py-3.5 text-base">
              Proposer mon idée
            </Link>
            <Link href="/faq" className="btn border-ink/30 bg-transparent px-5 py-3.5 text-base text-ink hover:border-ink">
              Lire la FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
