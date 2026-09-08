import Link from "next/link";
import type { IdeaListItem } from "@/lib/ideas";
import AiBadge from "@/components/AiBadge";

export default function IdeaCard({ idea }: { idea: IdeaListItem }) {
  return (
    <Link
      href={`/ideas/${idea.id}`}
      className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400 transition-colors"
    >
      <div className="hidden sm:block shrink-0 w-28 h-20 rounded-md overflow-hidden bg-neutral-100">
        {idea.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={idea.coverImage}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {idea.categoryEmoji}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>
                {idea.categoryEmoji} {idea.categoryName}
              </span>
              <span>·</span>
              <span>@{idea.authorPseudo}</span>
            </div>
            <h3 className="font-medium text-neutral-900 truncate">{idea.title}</h3>
            <p className="text-sm text-neutral-600 mt-1 line-clamp-2">
              {idea.aiSummary || idea.pitch}
            </p>
          </div>
          <div className="flex flex-col items-center shrink-0 rounded-md bg-neutral-100 px-3 py-2 text-center">
            <span className="text-sm font-semibold">▲ {idea.votes}</span>
            <span className="text-[11px] text-neutral-500">votes</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
          <AiBadge status={idea.aiStatus} score={idea.aiScore} />
          <span>💬 {idea.commentCount}</span>
        </div>
      </div>
    </Link>
  );
}
