import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { KIT_SCORE_THRESHOLD } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { loginHref } from "@/lib/format";
import { AiTag } from "@/components/AiBadge";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description:
    "Mon idée est-elle protégée ? Que veut dire la note IA ? Qu'y a-t-il dans le dossier de démarrage ? Est-ce gratuit ? Les réponses, sans détour.",
};

type Faq = { q: string; a: ReactNode; plain: string };
type Group = { id: string; label: string; title: string; items: Faq[] };

/**
 * Le texte brut (`plain`) sert au balisage FAQPage (JSON-LD) ; le rendu
 * React (`a`) peut contenir des liens et de la mise en forme.
 */
const GROUPS: Group[] = [
  {
    id: "idee",
    label: "Mon idée",
    title: "Publier, c'est prendre un risque ?",
    items: [
      {
        q: "Mon idée est publique. Quelqu'un peut me la voler ?",
        plain:
          "Oui, techniquement n'importe qui peut la lire — c'est le principe. Mais une idée seule ne vaut presque rien : ce qui fait un business, c'est l'exécution (les clients, le terrain, la persévérance). Publier te donne l'antériorité (date et pseudo affichés), des retours honnêtes et des alliés potentiels. Si ton avantage tient à un secret précis (une formule, un fournisseur exclusif), ne le mets simplement pas dans la description.",
        a: (
          <>
            <p>
              Oui, techniquement n&apos;importe qui peut la lire — c&apos;est le principe. Mais une idée seule ne vaut
              presque rien : ce qui fait un business, c&apos;est l&apos;exécution — les clients, le terrain, la
              persévérance. Ce que publier te donne, c&apos;est l&apos;antériorité (date et pseudo affichés sur la
              fiche), des retours honnêtes et des alliés potentiels.
            </p>
            <p>
              Si ton avantage tient à un secret précis — une formule, un fournisseur exclusif, un contrat — ne le mets
              simplement pas dans la description. Décris le problème, la cible et la promesse ; garde la recette.
            </p>
          </>
        ),
      },
      {
        q: "Est-ce que je peux reprendre l'idée de quelqu'un d'autre à ma façon ?",
        plain:
          "Oui, bouton « Faire ma version » sur la fiche. Tu expliques à voix haute comment TOI tu ferais — pas une copie silencieuse de l'originale. Ça crée une idée indépendante sous ton pseudo, avec un lien visible vers l'idée d'origine et son auteur. L'originale n'est pas modifiée.",
        a: (
          <p>
            Oui : le bouton <strong className="font-semibold text-ink">« Faire ma version »</strong> te demande une
            courte note vocale expliquant comment TOI tu t&apos;y prendrais. Ça crée une idée indépendante sous ton
            pseudo, avec un lien visible vers l&apos;idée d&apos;origine et son auteur — qui, lui, n&apos;est pas
            modifié. La fiche, la note et l&apos;illustration sont générées à partir de{" "}
            <strong className="font-semibold text-ink">ta</strong> version.
          </p>
        ),
      },
      {
        q: "Est-ce que je dois obligatoirement parler à voix haute ?",
        plain:
          "Non, mais c'est le mode par défaut et on te le recommande vivement. À l'oral on donne naturellement plus de contexte et de détails, et l'IA note mieux ce qu'elle comprend bien. Il faut 30 secondes minimum. Tu peux aussi écrire ton idée si tu préfères.",
        a: (
          <p>
            Non. C&apos;est le mode par défaut et on te le recommande vivement : à l&apos;oral, on donne
            naturellement plus de contexte et de détails, et l&apos;IA note mieux ce qu&apos;elle comprend bien. Il
            faut trente secondes minimum. Mais si tu préfères écrire, tu peux — le formulaire texte est toujours là.
          </p>
        ),
      },
      {
        q: "Puis-je supprimer ou modifier mon idée après publication ?",
        plain:
          "Tu peux la préciser (une note vocale complémentaire fusionne avec ta description et relance l'analyse) ou la supprimer définitivement toi-même (bouton sur la fiche de l'idée). La suppression retire aussi les réactions et votes ; les versions reprises par d'autres restent, comme des idées indépendantes.",
        a: (
          <p>
            Tu peux la <strong className="font-semibold text-ink">préciser</strong> : une note vocale complémentaire
            fusionne avec ta description et relance l&apos;analyse. Tu peux aussi la{" "}
            <strong className="font-semibold text-ink">supprimer</strong> définitivement (bouton sur la fiche, réservé à
            l&apos;auteur) — réactions et votes disparaissent avec elle ; les versions reprises par d&apos;autres
            restent, comme des idées indépendantes.
          </p>
        ),
      },
    ],
  },
  {
    id: "note",
    label: "La note IA",
    title: "Que veut vraiment dire ce chiffre sur 100 ?",
    items: [
      {
        q: "La note IA, c'est une validation de marché ?",
        plain:
          "Non. C'est l'estimation d'un modèle de langage (Gemini) sur la qualité de ta présentation : est-ce clair, cohérent, complet ? Y a-t-il une cible, un problème, une façon de gagner de l'argent ? Elle ne sait pas si des gens paieront. Personne ne le sait avant d'avoir essayé. Une note élevée veut dire « bien expliqué », pas « bonne affaire ».",
        a: (
          <>
            <p>
              <strong className="font-semibold text-ink">Non.</strong> C&apos;est l&apos;estimation d&apos;un modèle
              de langage (Gemini) sur la qualité de ta présentation : est-ce clair, cohérent, complet ? Y a-t-il une
              cible, un problème, une façon de gagner de l&apos;argent ? Elle ne sait pas si des gens paieront —
              personne ne le sait avant d&apos;avoir essayé.
            </p>
            <p>
              Une note élevée veut dire « bien expliqué », pas « bonne affaire ». La validation, ce sont les votes,
              les réactions, puis tes premiers clients.
            </p>
          </>
        ),
      },
      {
        q: "Pourquoi ma note est-elle basse alors que mon idée est bonne ?",
        plain:
          "Le plus souvent parce que la description manque d'éléments : pour qui, quel problème, comment ça rapporte, par quoi tu commences. La fiche liste des pistes d'amélioration ; enregistre une précision vocale qui y répond et la note est recalculée.",
        a: (
          <p>
            Le plus souvent parce que la description manque d&apos;éléments : pour qui, quel problème, comment ça
            rapporte, par quoi tu commences. La fiche liste des pistes d&apos;amélioration ; enregistre une précision
            vocale qui y répond et l&apos;analyse est relancée. Une note moyenne n&apos;est pas un verdict, c&apos;est
            un point de départ.
          </p>
        ),
      },
      {
        q: "L'IA peut-elle se tromper ?",
        plain:
          "Oui, régulièrement. Elle peut surnoter une idée bien tournée mais irréaliste, ou sous-noter une idée brillante mal décrite. Prends la fiche comme un premier avis structuré, pas comme une expertise. Tout ce qui est produit par la machine est signalé par le sigle IA.",
        a: (
          <p>
            Oui, régulièrement. Elle peut surnoter une idée bien tournée mais irréaliste, ou sous-noter une idée
            brillante mal décrite. Prends la fiche comme un premier avis structuré, pas comme une expertise. Tout ce
            que produit la machine est signalé par le sigle <AiTag /> — le reste, c&apos;est la voix des humains.
          </p>
        ),
      },
    ],
  },
  {
    id: "kit",
    label: "Le dossier de démarrage",
    title: "Qu'est-ce que je débloque à 70/100 ?",
    items: [
      {
        q: "C'est quoi exactement, le dossier de démarrage (starter kit) ?",
        plain: `Quand ta fiche atteint ${KIT_SCORE_THRESHOLD}/100, tu peux lancer la génération de quatre éléments : une landing page de démonstration, une esquisse d'architecture système avec une stack suggérée, un périmètre MVP (les premières fonctionnalités et le premier jalon) et un flyer. Tout est généré par l'IA à partir de ta fiche, gratuitement, en quelques minutes.`,
        a: (
          <>
            <p>
              Quand ta fiche atteint {KIT_SCORE_THRESHOLD}/100, tu peux lancer la génération de quatre éléments :
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>une landing page de démonstration, hébergée ici, à ton nom ;</li>
              <li>une esquisse d&apos;architecture système, avec une stack suggérée ;</li>
              <li>un périmètre MVP : les premières fonctionnalités et le premier jalon ;</li>
              <li>un flyer (image) pour en parler autour de toi.</li>
            </ul>
            <p>Tout est généré par l&apos;IA à partir de ta fiche, gratuitement, en quelques minutes.</p>
          </>
        ),
      },
      {
        q: "La landing page générée, c'est un vrai site ?",
        plain:
          "C'est une page de démonstration statique : vraie URL, vrai texte, vraie mise en page — mais rien derrière. Pas de base de données, pas de paiement, pas d'inscription réelle : le bouton d'action ne fait rien. C'est une maquette pour montrer et pitcher, pas un produit à mettre en vente.",
        a: (
          <p>
            C&apos;est une page de démonstration <strong className="font-semibold text-ink">statique</strong> : vraie
            URL, vrai texte, vraie mise en page — mais rien derrière. Pas de base de données, pas de paiement, pas
            d&apos;inscription réelle ; le bouton d&apos;action ne fait rien, et la page le dit. C&apos;est une
            maquette pour montrer et pitcher, pas un produit à mettre en vente.
          </p>
        ),
      },
      {
        q: "Qui peut lancer la génération du dossier ?",
        plain:
          "Seulement l'auteur de l'idée, et seulement une fois le seuil atteint (vérifié côté serveur). Une fois généré, le dossier est visible par tout le monde, comme le reste.",
        a: (
          <p>
            Seulement l&apos;auteur de l&apos;idée, et seulement une fois le seuil atteint (vérifié côté serveur, pas
            juste à l&apos;écran). Une fois généré, le dossier est visible par tout le monde, comme le reste de la
            fiche.
          </p>
        ),
      },
    ],
  },
  {
    id: "compte",
    label: "Le compte & le prix",
    title: "Combien ça coûte, et qu'est-ce qu'on sait de moi ?",
    items: [
      {
        q: "C'est gratuit ?",
        plain:
          "Oui, entièrement : publier, voter, commenter, faire sa propre version d'une idée et générer le dossier de démarrage. Pas d'abonnement, pas de version premium, pas de carte bancaire.",
        a: (
          <p>
            Oui, entièrement : publier, voter, commenter, faire sa propre version d&apos;une idée et générer le
            dossier de démarrage. Pas d&apos;abonnement, pas de version premium, pas de carte bancaire.
          </p>
        ),
      },
      {
        q: "Il faut créer un compte ?",
        plain:
          "Juste un pseudo, sans mot de passe ni email. Il signe tes idées, tes votes et tes réactions. Attention : sans mot de passe, quelqu'un qui devine ton pseudo peut l'utiliser — choisis-en un peu évident si ça te gêne.",
        a: (
          <p>
            Juste un pseudo, sans mot de passe ni email. Il signe tes idées, tes votes et tes réactions. Attention :
            sans mot de passe, quelqu&apos;un qui devine ton pseudo peut l&apos;utiliser — c&apos;est le prix de la
            simplicité pour l&apos;instant. Choisis un pseudo peu évident si ça te gêne.
          </p>
        ),
      },
      {
        q: "Que devient ma note vocale ?",
        plain:
          "Elle est transcrite par l'IA puis conservée et rendue publique sur la fiche, comme l'enregistrement d'origine de ton idée. Ne dis rien dans ta note vocale que tu ne mettrais pas par écrit sur la fiche.",
        a: (
          <p>
            Elle est transcrite par l&apos;IA puis conservée et rendue publique sur la fiche, comme
            l&apos;enregistrement d&apos;origine de ton idée. Ne dis donc rien à l&apos;oral que tu ne mettrais pas
            par écrit sur la fiche.
          </p>
        ),
      },
    ],
  },
];

function slug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export default async function FaqPage() {
  const user = await getSession();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((g) =>
      g.items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.plain },
      })),
    ),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="pb-8">
        <p className="label">FAQ</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Les questions qu&apos;on nous pose. <span className="hl">Les réponses sans détour.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          Idées de Business est gratuit, public et propulsé par une IA qui peut se tromper. Voilà ce que ça
          implique, concrètement.
        </p>
        <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="chip">
              {g.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-12">
        {GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-24" aria-labelledby={`${g.id}-title`}>
            <p className="label">{g.label}</p>
            <h2 id={`${g.id}-title`} className="mt-1 font-display text-2xl font-bold tracking-tight">
              {g.title}
            </h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              {g.items.map((it) => (
                <details key={it.q} id={slug(it.q)} className="group scroll-mt-24 py-1">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-lg px-1 py-3.5 font-display text-[17px] font-bold leading-snug hover:text-ink-2 [&::-webkit-details-marker]:hidden">
                    <span>{it.q}</span>
                    <span
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink text-sm leading-none transition-transform duration-200 group-open:rotate-45 group-open:bg-sun"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <div className="space-y-3 px-1 pb-5 text-[15px] leading-relaxed text-ink-2">{it.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card mt-14 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-bold">Une question qui n&apos;est pas là ?</p>
          <p className="mt-1 text-sm text-ink-2">
            Le plus simple pour comprendre, c&apos;est d&apos;essayer : trente secondes, un pseudo, une fiche.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/ideas" className="btn btn-outline">
            Voir les idées
          </Link>
          <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-sun">
            Proposer mon idée
          </Link>
        </div>
      </div>
    </div>
  );
}
