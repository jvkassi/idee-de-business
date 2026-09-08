import Link from "next/link";
import type { IdeaListItem } from "@/lib/ideas";
import { formatDateTime, timeAgo } from "@/lib/format";
import AiBadge from "@/components/AiBadge";
import VoteButton from "@/components/VoteButton";
import CoverImage from "@/components/CoverImage";

export default function IdeaCard({ idea, loggedIn }: { idea: IdeaListItem; loggedIn: boolean }) {
  const href = `/ideas/${idea.id}`;
  return (
    <article className="card group relative flex gap-3 p-3 transition-[box-shadow,transform,border-color] duration-200 has-[a:focus-visible]:border-brand hover:-translate-y-0.5 hover:border-line-2 hover:shadow-lift sm:gap-4 sm:p-4">
      {/* Vignette : illustration IA, ou emoji de la catégorie en attendant */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:h-24 sm:w-36">
        {idea.coverImage ? (
          <CoverImage
            src={idea.coverImage}
            title={idea.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl">
            {idea.coverStatus === "pending" ? (
              <span className="skeleton absolute inset-0" aria-label="Illustration en cours" />
            ) : null}
            <span className="relative">{idea.categoryEmoji}</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
              <span className="font-medium text-ink-2">
                {idea.categoryEmoji} {idea.categoryName}
              </span>
              <span aria-hidden>·</span>
              <span>@{idea.authorPseudo}</span>
              <span aria-hidden>·</span>
              <time dateTime={idea.createdAt} title={formatDateTime(idea.createdAt)}>
                {timeAgo(idea.createdAt)}
              </time>
            </div>
            <h3 className="font-display text-base font-bold leading-snug tracking-tight sm:text-lg">
              {/* Lien "étiré" : toute la carte est cliquable, le vote reste au-dessus */}
              <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {idea.title}
              </Link>
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-ink-2">{idea.aiSummary || idea.pitch}</p>
          </div>

          <div className="relative z-10 shrink-0">
            <VoteButton ideaId={idea.id} votes={idea.votes} voted={idea.voted} loggedIn={loggedIn} size="sm" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-ink-3">
          <AiBadge status={idea.aiStatus} score={idea.aiScore} />
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5v-6Z" strokeLinejoin="round" />
            </svg>
            {idea.commentCount}
          </span>
        </div>
      </div>
    </article>
  );
}
