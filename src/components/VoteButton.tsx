"use client";

import { useTransition } from "react";
import { voteAction } from "@/app/actions";

export default function VoteButton({
  ideaId,
  votes,
  voted,
  loggedIn,
}: {
  ideaId: number;
  votes: number;
  voted: boolean;
  loggedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={() => startTransition(() => voteAction(ideaId))}
    >
      <button
        type="submit"
        disabled={pending}
        title={loggedIn ? undefined : "Connecte-toi pour voter"}
        className={`flex flex-col items-center rounded-lg px-4 py-2 border transition-colors ${
          voted
            ? "bg-neutral-900 text-white border-neutral-900"
            : "bg-white text-neutral-900 border-neutral-300 hover:border-neutral-500"
        } ${pending ? "opacity-60" : ""}`}
      >
        <span className="text-lg leading-none">▲</span>
        <span className="text-sm font-semibold">{votes}</span>
      </button>
    </form>
  );
}
