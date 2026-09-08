import { notFound } from "next/navigation";
import Link from "next/link";
import { getIdea, getComments, hasVoted } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import VoteButton from "@/components/VoteButton";
import AiBadge from "@/components/AiBadge";
import CommentForm from "./CommentForm";
import RetryAiButton from "./RetryAiButton";
import RetryCoverButton from "./RetryCoverButton";

export const dynamic = "force-dynamic";

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ideaId = Number(id);
  if (!Number.isInteger(ideaId)) notFound();

  const [idea, user] = await Promise.all([getIdea(ideaId), getSession()]);
  if (!idea) notFound();

  const [comments, voted] = await Promise.all([
    getComments(ideaId),
    user ? hasVoted(ideaId, user.id) : Promise.resolve(false),
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
      <div className="flex md:flex-col items-center gap-2">
        <VoteButton ideaId={idea.id} votes={idea.votes} voted={voted} loggedIn={!!user} />
      </div>

      <div className="space-y-6 min-w-0">
        {idea.coverStatus === "done" && idea.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={idea.coverImage}
            alt=""
            className="w-full max-h-72 object-cover rounded-lg border border-neutral-200"
          />
        )}
        {idea.coverStatus === "pending" && (
          <div className="w-full h-40 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center text-sm text-neutral-400">
            🎨 Génération de l&apos;illustration en cours…
          </div>
        )}
        {idea.coverStatus === "failed" && (
          <div className="w-full rounded-lg border border-dashed border-red-200 bg-red-50 p-3 flex items-center justify-between gap-3 text-sm text-red-700">
            <span>Illustration IA indisponible{idea.coverError ? ` (${idea.coverError})` : ""}.</span>
            <RetryCoverButton ideaId={idea.id} />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href={`/?cat=${idea.categorySlug}`} className="hover:underline">
              {idea.categoryEmoji} {idea.categoryName}
            </Link>
            <span>·</span>
            <span>@{idea.authorPseudo}</span>
          </div>
          <h1 className="text-2xl font-semibold">{idea.title}</h1>
          <p className="mt-3 text-neutral-700 whitespace-pre-wrap">{idea.pitch}</p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              ✨ Amélioration par l&apos;IA
            </h2>
            <AiBadge status={idea.aiStatus} score={idea.aiScore} />
          </div>

          {idea.aiStatus === "pending" && (
            <p className="text-sm text-neutral-500">
              L&apos;IA analyse cette idée, rafraîchis la page dans quelques secondes.
            </p>
          )}

          {idea.aiStatus === "failed" && (
            <div className="text-sm text-red-600 space-y-2">
              <p>L&apos;amélioration IA a échoué{idea.aiError ? ` (${idea.aiError})` : ""}.</p>
              <RetryAiButton ideaId={idea.id} />
            </div>
          )}

          {idea.aiStatus === "done" && idea.ai && (
            <div className="space-y-3 text-sm">
              <p className="text-neutral-800">{idea.ai.summary}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                    Cible
                  </h3>
                  <p>{idea.ai.targetAudience}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                    Proposition de valeur
                  </h3>
                  <p>{idea.ai.valueProposition}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                    Modèle de revenus
                  </h3>
                  <p>{idea.ai.revenueModel}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                    Risques
                  </h3>
                  <ul className="list-disc list-inside">
                    {idea.ai.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                  Premiers pas
                </h3>
                <ol className="list-decimal list-inside space-y-0.5">
                  {idea.ai.firstSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-3">💬 Commentaires ({comments.length})</h2>
          <div className="space-y-3 mb-4">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md bg-white border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500 mb-1">
                  @{c.authorPseudo} · {new Date(c.createdAt).toLocaleString("fr-FR")}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-neutral-500">Aucun commentaire pour l&apos;instant.</p>
            )}
          </div>
          <CommentForm ideaId={idea.id} loggedIn={!!user} />
        </div>
      </div>
    </div>
  );
}
