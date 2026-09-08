export default function IdeaLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Chargement de l'idée">
      <div className="skeleton aspect-video w-full rounded-2xl" />
      <div className="space-y-3">
        <div className="skeleton h-5 w-40 rounded-full" />
        <div className="skeleton h-9 w-4/5" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-11 w-64 rounded-xl" />
      </div>
      <div className="card p-5">
        <div className="skeleton mb-4 h-5 w-32" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      </div>
    </div>
  );
}
