export default function IdeaLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-7" aria-busy="true" aria-label="Chargement de l'idée">
      <div className="space-y-3">
        <div className="skeleton h-4 w-56 rounded-full" />
        <div className="skeleton h-11 w-4/5" />
      </div>
      <div className="skeleton aspect-video w-full rounded-2xl" />
      <div className="space-y-2">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-5 w-2/3" />
      </div>
      <div className="skeleton h-11 w-72 rounded-xl" />
      <div className="card p-6">
        <div className="skeleton mb-5 h-5 w-32" />
        <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
          <div className="skeleton h-16" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
