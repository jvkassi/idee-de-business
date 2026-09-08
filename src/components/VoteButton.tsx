"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { voteAction } from "@/app/actions";
import { loginHref } from "@/lib/format";

type Props = {
  ideaId: number;
  votes: number;
  voted: boolean;
  loggedIn: boolean;
  size?: "sm" | "lg";
};

const SIZE = {
  sm: "min-w-14 flex-col gap-0 rounded-xl px-2.5 py-2 text-xs",
  lg: "gap-2 rounded-xl px-4 py-2.5 text-sm",
} as const;

/**
 * Vote optimiste : le compteur change immédiatement, le serveur confirme
 * ensuite (Server Action + revalidation). Déconnecté → lien vers la connexion
 * qui ramène ici après.
 */
export default function VoteButton({ ideaId, votes, voted, loggedIn, size = "lg" }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    { votes, voted },
    (state, next: boolean) => ({ voted: next, votes: state.votes + (next ? 1 : -1) }),
  );

  const active = optimistic.voted;
  const base = `inline-flex items-center justify-center border font-semibold tabular-nums transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${SIZE[size]}`;
  const look = active
    ? "border-brand bg-brand text-brand-ink shadow-brand"
    : "border-line-2 bg-surface text-ink hover:border-brand hover:text-brand";

  const content = (
    <>
      <svg viewBox="0 0 20 20" className={size === "sm" ? "h-4 w-4" : "h-4 w-4"} fill="currentColor" aria-hidden>
        <path d="M10 4l6 8H4l6-8Z" />
      </svg>
      <span className={size === "sm" ? "text-sm leading-tight" : "text-base leading-none"}>
        {optimistic.votes}
      </span>
      {size === "lg" && <span className="font-medium text-current/80">{active ? "Soutenue" : "Soutenir"}</span>}
    </>
  );

  if (!loggedIn) {
    return (
      <Link
        href={loginHref(`/ideas/${ideaId}`)}
        title="Connecte-toi pour voter"
        className={`${base} ${look}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Retirer mon vote" : "Voter pour cette idée"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!active);
          await voteAction(ideaId);
        })
      }
      className={`${base} ${look} ${pending ? "opacity-80" : ""}`}
    >
      {content}
    </button>
  );
}
