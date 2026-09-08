export default function AiBadge({
  status,
  score,
}: {
  status: "pending" | "done" | "failed";
  score: number | null;
}) {
  if (status === "done" && score !== null) {
    const color =
      score >= 70
        ? "bg-green-100 text-green-800"
        : score >= 40
          ? "bg-amber-100 text-amber-800"
          : "bg-neutral-100 text-neutral-700";
    return (
      <span className={`rounded-full px-2 py-0.5 font-medium ${color}`}>
        ✨ Score IA {score}/100
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 font-medium">
        ⏳ IA en cours…
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 bg-red-50 text-red-700 font-medium">
      ⚠️ IA indisponible
    </span>
  );
}
