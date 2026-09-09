import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getIdea, getComments } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import { formatDateTime, loginHref, plural, timeAgo } from "@/lib/format";
import { categoryStyle } from "@/lib/categoryColor";
import { retryCoverAction } from "@/app/actions";
import VoteButton from "@/components/VoteButton";
import AiBadge from "@/components/AiBadge";
import AiPanel from "@/components/AiPanel";
import Avatar from "@/components/Avatar";
import AutoRefresh from "@/components/AutoRefresh";
import CoverImage from "@/components/CoverImage";
import RetryButton from "@/components/RetryButton";
import ShareButton from "@/components/ShareButton";
import ForkButton from "@/components/ForkButton";
import ValidationGate from "@/components/ValidationGate";
import CommentForm from "./CommentForm";

export const dynamic = "force-dynamic";
// Les Server Actions "réessayer"/"valider" planifient des appels Gemini via
// after() : le dossier de démarrage (texte + flyer) peut prendre jusqu'à
// ~3 min, on laisse à la fonction le temps de le terminer.
export const maxDuration = 180;

type Params = Promise<{ id: string }>;

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ideaId = parseId((await params).id);
  const idea = ideaId ? await getIdea(ideaId) : null;
  if (!idea) return { title: "Idée introuvable" };
  const description = (idea.aiSummary || idea.pitch).slice(0, 160);
  return {
    title: idea.title,
    description,
    // Chaque idée a déjà sa propre illustration IA : on la réutilise comme
    // aperçu de lien plutôt que l'image générique du site.
    openGraph: idea.coverImage
      ? { title: idea.title, description, images: [{ url: idea.coverImage }] }
      : undefined,
    twitter: idea.coverImage
      ? { card: "summary_large_image", title: idea.title, description, images: [idea.coverImage] }
      : undefined,
  };
}

export default async function IdeaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, getSession()]);
  const ideaId = parseId(id);
  if (!ideaId) notFound();

  const [idea, comments] = await Promise.all([getIdea(ideaId, user?.id), getComments(ideaId)]);
  if (!idea) notFound();

  const processing =
    idea.aiStatus === "pending" || idea.coverStatus === "pending" || idea.kitStatus === "pending";
  const justPublished = sp.new === "1";
  const isOwner = user?.id === idea.authorId;

  return (
    <article className="mx-auto max-w-3xl space-y-7" style={categoryStyle(idea.categorySlug)}>
      {processing && <AutoRefresh />}

      {justPublished && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            processing ? "border-ink bg-sun-soft" : "border-ok/40 bg-ok-soft"
          }`}
        >
          <span className="text-lg leading-none" aria-hidden>
            {processing ? "✍️" : "✅"}
          </span>
          <div>
            <p className="font-semibold">C&apos;est publié.</p>
            <p className="text-ink-2">
              {processing
                ? "Ta fiche s'écrit et ton illustration se dessine (~30 s). Pas besoin de rafraîchir, ça apparaît ici."
                : "Fiche et illustration terminées. Partage-la pour récolter des votes."}
            </p>
          </div>
        </div>
      )}

      {/* En-tête : la voix humaine */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-3">
          <Link
            href={`/ideas?cat=${idea.categorySlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cat underline-offset-4 hover:underline"
          >
            <span className="cat-dot" aria-hidden />
            {idea.categoryName}
          </Link>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Avatar pseudo={idea.authorPseudo} size="sm" />
            <span className="font-medium text-ink-2">@{idea.authorPseudo}</span>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={idea.createdAt} title={formatDateTime(idea.createdAt)}>
            {timeAgo(idea.createdAt)}
          </time>
        </div>

        <h1 className="font-display text-3xl font-bold leading-[1.08] tracking-tight sm:text-[2.75rem]">{idea.title}</h1>

        {idea.parentIdea && (
          <p className="text-xs text-ink-3">
            Forké depuis{" "}
            <Link href={`/ideas/${idea.parentIdea.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
              {idea.parentIdea.title}
            </Link>{" "}
            de @{idea.parentIdea.authorPseudo}
          </p>
        )}
      </header>

      {/* Illustration dans son passe-partout — le cadre tient, quoi que dessine la machine */}
      {idea.coverStatus !== "skipped" && (
        <div className="mat rounded-2xl p-2">
          <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl">
            <span className="text-6xl" aria-hidden>
              {idea.categoryEmoji}
            </span>
            {idea.coverStatus === "pending" && (
              <div className="skeleton absolute inset-0 rounded-xl opacity-80" aria-live="polite">
                <div className="absolute inset-0 grid place-items-center">
                  <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2">
                    Illustration en cours de dessin…
                  </span>
                </div>
              </div>
            )}
            {idea.coverStatus === "done" && idea.coverImage && (
              <CoverImage src={idea.coverImage} title={idea.title} className="absolute inset-0 h-full w-full object-cover" />
            )}
            {idea.coverStatus === "failed" && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-surface/90 px-4 py-2.5 text-sm text-ink-2 backdrop-blur">
                <span>Illustration indisponible pour le moment.</span>
                <RetryButton action={retryCoverAction.bind(null, idea.id)} label="Regénérer" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* L'idée brute, dans ses mots, surlignée */}
      <section aria-labelledby="pitch-title">
        <h2 id="pitch-title" className="label mb-2">
          L&apos;idée, dans les mots de @{idea.authorPseudo}
        </h2>
        <p className="whitespace-pre-wrap border-l-[3px] border-sun pl-4 font-display text-lg leading-relaxed text-ink sm:text-xl">
          {idea.pitch}
        </p>
        {idea.audioUrl && (
          <div className="mt-3 flex items-center gap-2 pl-4">
            <span className="text-xs text-ink-3">Note vocale d&apos;origine :</span>
            <audio controls src={idea.audioUrl} className="h-9 max-w-xs flex-1" />
          </div>
        )}
      </section>

      {/* Les deux verdicts, côte à côte */}
      <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
        <VoteButton ideaId={idea.id} votes={idea.votes} voted={idea.voted} loggedIn={!!user} />
        <span className="inline-flex h-10 items-center rounded-xl border border-line px-3">
          <AiBadge status={idea.aiStatus} score={idea.aiScore} />
        </span>
        <span className="ml-auto flex items-center gap-2">
          <a href="#commentaires" className="btn btn-outline px-3 py-2 text-xs">
            {plural(comments.length, "réaction")}
          </a>
          <ForkButton ideaId={idea.id} forkCount={idea.forkCount} />
          <ShareButton title={idea.title} />
        </span>
      </div>

      <AiPanel idea={idea} />
      <ValidationGate idea={idea} isOwner={isOwner} />

      {/* Réactions : la communauté */}
      <section id="commentaires" aria-labelledby="comments-title" className="scroll-mt-20 space-y-4">
        <div>
          <p className="label">La communauté</p>
          <h2 id="comments-title" className="mt-1 flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            Réactions
            {comments.length > 0 && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-2">
                {comments.length}
              </span>
            )}
          </h2>
        </div>

        {comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-2 px-4 py-6 text-center text-sm text-ink-2">
            Personne n&apos;a encore réagi. Un retour honnête vaut de l&apos;or pour{" "}
            <span className="font-medium text-ink">@{idea.authorPseudo}</span>.
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="card flex gap-3 p-4">
                <Avatar pseudo={c.authorPseudo} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs text-ink-3">
                    <span className="text-sm font-semibold text-ink">@{c.authorPseudo}</span>
                    <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>
                      {timeAgo(c.createdAt)}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{c.body}</p>
                  {c.audioUrl && (
                    <audio controls src={c.audioUrl} className="mt-2 h-9 w-full max-w-xs" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {user ? (
          <CommentForm ideaId={idea.id} pseudo={user.pseudo} />
        ) : (
          <div className="card flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">
              Un avis, une question, une piste ? Choisis un pseudo et réagis — pas de mot de passe.
            </p>
            <Link href={loginHref(`/ideas/${idea.id}`)} className="btn btn-sun shrink-0">
              Réagir
            </Link>
          </div>
        )}
      </section>
    </article>
  );
}
