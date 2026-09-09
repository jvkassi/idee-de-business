import Link from "next/link";
import type { IdeaListItem } from "@/lib/ideas";
import { formatDateTime, timeAgo } from "@/lib/format";
import { categoryStyle } from "@/lib/categoryColor";
import { AiTag, Pulse } from "@/components/AiBadge";
import ScoreMeter from "@/components/ScoreMeter";
import VoteButton from "@/components/VoteButton";
import CoverImage from "@/components/CoverImage";

/**
 * Une idée dans le fil. À gauche l'illustration dans son passe-partout
 * teinté, au centre la voix humaine (titre) puis le résumé, à droite le rail
 * des deux verdicts : les votes de la communauté au-dessus de la note IA.
 */
export default function IdeaCard({ idea, loggedIn }: { idea: IdeaListItem; loggedIn: boolean }) {
  const href = `/ideas/${idea.id}`;
  const summaryIsAi = Boolean(idea.aiSummary);
  return (
    <article
      style={categoryStyle(idea.categorySlug)}
      className="card group relative flex gap-3 p-3 transition-[border-color,box-shadow] duration-200 has-[a:focus-visible]:border-ink hover:border-ink/40 hover:shadow-lift sm:gap-4 sm:p-4"
    >
      {/* Vignette : passe-partout + emoji derrière, image IA devant si elle existe */}
      <div className="mat relative h-20 w-20 shrink-0 overflow-hidden rounded-xl p-1.5 sm:h-28 sm:w-40">
        <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-lg">
          <span className="text-3xl" aria-hidden>
            {idea.categoryEmoji}
          </span>
          {idea.coverStatus === "pending" && (
            <span className="skeleton absolute inset-0 opacity-70" aria-label="Illustration en cours" />
          )}
          {idea.coverImage && (
            <CoverImage
              src={idea.coverImage}
              title={idea.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
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

        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">{idea.aiSummary || idea.pitch}</p>

        <div className="mt-auto flex items-center gap-3 pt-2.5 text-xs text-ink-3">
          {summaryIsAi ? (
            <span className="inline-flex items-center gap-1.5">
              <AiTag />
              résumé
            </span>
          ) : idea.aiStatus === "pending" ? (
            <span className="inline-flex items-center gap-1.5 text-ink-2">
              <Pulse />
              Analyse en cours
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5v-6Z" strokeLinejoin="round" />
            </svg>
            {idea.commentCount}
          </span>
        </div>
      </div>

      {/* Rail des verdicts : communauté au-dessus, machine en dessous */}
      <div className="relative z-10 flex shrink-0 flex-col items-center gap-1.5">
        <VoteButton ideaId={idea.id} votes={idea.votes} voted={idea.voted} loggedIn={loggedIn} size="sm" />
        {idea.aiStatus === "done" && idea.aiScore !== null ? (
          <ScoreMeter score={idea.aiScore} size="sm" />
        ) : (
          <div
            className="grid w-14 flex-1 place-items-center rounded-xl border border-dashed border-line-2 py-2"
            title={idea.aiStatus === "pending" ? "Note IA en cours" : "Note IA indisponible"}
          >
            {idea.aiStatus === "pending" ? <Pulse /> : <AiTag className="opacity-40" />}
          </div>
        )}
      </div>
    </article>
  );
}
