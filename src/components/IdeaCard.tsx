import Link from "next/link";
import type { IdeaListItem } from "@/lib/ideas";
import { formatDateTime, timeAgo } from "@/lib/format";
import { categoryStyle } from "@/lib/categoryColor";
import { AiTag, Pulse } from "@/components/AiBadge";
import ScoreMeter from "@/components/ScoreMeter";
import VoteButton from "@/components/VoteButton";
import CoverImage from "@/components/CoverImage";

function CommentCount({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5v-6Z" strokeLinejoin="round" />
      </svg>
      {n}
    </span>
  );
}

/**
 * Une idée dans le fil. La vignette dans son passe-partout teinté, la voix
 * humaine (titre) puis le résumé, et le rail des deux verdicts : les votes
 * de la communauté à côté de la note IA.
 *
 * La mise en page est une grille nommée (`idea-grid`, globals.css) : sur
 * mobile le titre occupe toute la largeur à droite d'une petite vignette et
 * le rail passe en ligne sous le texte ; à partir de sm le rail remonte en
 * colonne à droite.
 */
export default function IdeaCard({ idea, loggedIn }: { idea: IdeaListItem; loggedIn: boolean }) {
  const href = `/ideas/${idea.id}`;
  const summaryIsAi = Boolean(idea.aiSummary);
  const aiIndicator = summaryIsAi ? (
    <span className="inline-flex items-center gap-1.5">
      <AiTag />
      résumé
    </span>
  ) : idea.aiStatus === "pending" ? (
    <span className="inline-flex items-center gap-1.5 text-ink-2">
      <Pulse />
      Analyse en cours
    </span>
  ) : null;

  return (
    <article
      style={categoryStyle(idea.categorySlug)}
      className="card idea-grid group relative p-3 transition-colors duration-150 has-[a:focus-visible]:border-ink hover:border-ink sm:p-4"
    >
      {/* Vignette : passe-partout + emoji derrière, image IA devant si elle existe */}
      <div className="mat relative h-[4.25rem] w-[4.25rem] overflow-hidden rounded-xl p-1 [grid-area:thumb] sm:h-28 sm:w-40 sm:p-1.5">
        <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-lg">
          <span className="text-2xl sm:text-3xl" aria-hidden>
            {idea.categoryEmoji}
          </span>
          {idea.coverStatus === "pending" && (
            <span className="skeleton absolute inset-0 opacity-70" aria-label="Illustration en cours" />
          )}
          {idea.coverImage && (
            <CoverImage
              src={idea.coverImage}
              title={idea.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
      </div>

      <div className="min-w-0 [grid-area:head]">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5 font-semibold text-cat">
            <span className="cat-dot" aria-hidden />
            {idea.categoryName}
          </span>
          <span aria-hidden>·</span>
          <span>@{idea.authorPseudo}</span>
          <span aria-hidden>·</span>
          <time dateTime={idea.createdAt} title={formatDateTime(idea.createdAt)}>
            {timeAgo(idea.createdAt)}
          </time>
        </div>

        <h3 className="font-display text-[17px] font-bold leading-snug tracking-tight sm:text-xl">
          {/* Lien "étiré" : toute la carte est cliquable, le rail reste au-dessus */}
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {idea.title}
          </Link>
        </h3>
      </div>

      <div className="flex min-w-0 flex-col [grid-area:body]">
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2 sm:mt-1">{idea.aiSummary || idea.pitch}</p>
        {/* Méta sous le résumé : desktop seulement, sur mobile elle rejoint le rail */}
        <div className="mt-auto hidden items-center gap-3 pt-2.5 text-xs text-ink-3 sm:flex">
          {aiIndicator}
          <CommentCount n={idea.commentCount} />
        </div>
      </div>

      {/* Rail des verdicts : communauté puis machine */}
      <div className="relative z-10 mt-3 flex items-center gap-2 [grid-area:rail] sm:mt-0 sm:flex-col sm:gap-1.5">
        <VoteButton ideaId={idea.id} votes={idea.votes} voted={idea.voted} loggedIn={loggedIn} size="sm" />
        {idea.aiStatus === "done" && idea.aiScore !== null ? (
          <ScoreMeter score={idea.aiScore} size="sm" />
        ) : (
          <div
            className="grid h-[52px] w-14 place-items-center rounded-xl border border-dashed border-line-2 sm:h-auto sm:flex-1 sm:py-2"
            title={idea.aiStatus === "pending" ? "Note IA en cours" : "Note IA indisponible"}
          >
            {idea.aiStatus === "pending" ? <Pulse /> : <AiTag className="opacity-40" />}
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-ink-3 sm:hidden">
          {aiIndicator}
          <CommentCount n={idea.commentCount} />
        </div>
      </div>
    </article>
  );
}
