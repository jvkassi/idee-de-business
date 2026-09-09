import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getIdea, getComments } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import { formatDateTime, loginHref, plural, timeAgo } from "@/lib/format";
import { retryCoverAction } from "@/app/actions";
import VoteButton from "@/components/VoteButton";
import AiBadge from "@/components/AiBadge";
import AiPanel from "@/components/AiPanel";
import Avatar from "@/components/Avatar";
import AutoRefresh from "@/components/AutoRefresh";
import CoverImage from "@/components/CoverImage";
import RetryButton from "@/components/RetryButton";
import ShareButton from "@/components/ShareButton";
import CommentForm from "./CommentForm";

export const dynamic = "force-dynamic";
// Les Server Actions "réessayer" planifient un appel Gemini via after() :
// on laisse à la fonction le temps de le terminer.
export const maxDuration = 60;

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

  const processing = idea.aiStatus === "pending" || idea.coverStatus === "pending";
  const justPublished = sp.new === "1";

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {processing && <AutoRefresh />}

      {justPublished && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            processing ? "border-ai/30 bg-ai-soft text-ink" : "border-ok/30 bg-ok-soft text-ink"
          }`}
        >
          <span className="text-lg leading-none" aria-hidden>
            {processing ? "🎉" : "✅"}
          </span>
          <div>
            <p className="font-semibold">Ton idée est publiée !</p>
            <p className="text-ink-2">
              {processing
                ? "L'IA la structure et dessine son illustration (~30 s). Pas besoin de rafraîchir, ça s'affiche ici."
                : "Analyse et illustration terminées. Partage-la pour récolter des votes."}
            </p>
          </div>
        </div>
      )}

      {/* Couverture */}
      {idea.coverStatus === "done" && idea.coverImage && (
        <div className="overflow-hidden rounded-2xl border border-line shadow-card">
          <CoverImage src={idea.coverImage} title={idea.title} className="aspect-video w-full object-cover" />
        </div>
      )}
      {idea.coverStatus === "pending" && (
        <div className="skeleton relative aspect-video w-full rounded-2xl" aria-live="polite">
          <div className="absolute inset-0 grid place-items-center">
            <span className="rounded-full bg-surface/80 px-3 py-1.5 text-xs font-medium text-ink-2 backdrop-blur">
              🎨 Illustration en cours de génération…
            </span>
          </div>
        </div>
      )}
      {idea.coverStatus === "failed" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line-2 bg-surface-2/60 px-4 py-3 text-sm text-ink-2">
          <span>🎨 Illustration indisponible pour le moment.</span>
          <RetryButton action={retryCoverAction.bind(null, idea.id)} label="Regénérer" />
        </div>
      )}

      {/* En-tête */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
          <Link href={`/?cat=${idea.categorySlug}`} className="chip px-2.5 py-1 text-xs">
            {idea.categoryEmoji} {idea.categoryName}
          </Link>
          <span className="inline-flex items-center gap-1.5">
            <Avatar pseudo={idea.authorPseudo} size="sm" />
            <span className="font-medium text-ink-2">@{idea.authorPseudo}</span>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={idea.createdAt} title={formatDateTime(idea.createdAt)}>
            {timeAgo(idea.createdAt)}
          </time>
        </div>

        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{idea.title}</h1>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2 sm:text-base">{idea.pitch}</p>

        <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
          <VoteButton ideaId={idea.id} votes={idea.votes} voted={idea.voted} loggedIn={!!user} />
          <a href="#commentaires" className="btn btn-outline px-3 py-2 text-xs">
            💬 {plural(comments.length, "commentaire")}
          </a>
          <ShareButton title={idea.title} />
          <span className="ml-auto">
            <AiBadge status={idea.aiStatus} score={idea.aiScore} />
          </span>
        </div>
      </header>

      <AiPanel idea={idea} />

      {/* Commentaires */}
      <section id="commentaires" aria-labelledby="comments-title" className="scroll-mt-20 space-y-4">
        <h2 id="comments-title" className="flex items-center gap-2 font-display text-lg font-bold">
          Réactions
          {comments.length > 0 && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-2">
              {comments.length}
            </span>
          )}
        </h2>

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
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
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
            <Link href={loginHref(`/ideas/${idea.id}`)} className="btn btn-primary shrink-0">
              Réagir
            </Link>
          </div>
        )}
      </section>
    </article>
  );
}
