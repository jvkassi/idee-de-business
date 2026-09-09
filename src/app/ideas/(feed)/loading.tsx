export default function HomeLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Chargement des idées">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-3 w-12" />
          <div className="skeleton h-8 w-56" />
        </div>
        <div className="skeleton h-10 w-72 rounded-xl" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-32 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="skeleton h-10 w-80 rounded-xl" />
      <div className="space-y-3 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card flex gap-4 p-4">
            <div className="skeleton h-28 w-40 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2.5">
              <div className="skeleton h-3 w-40" />
              <div className="skeleton h-6 w-3/4" />
              <div className="skeleton h-3.5 w-full" />
              <div className="skeleton h-3.5 w-5/6" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="skeleton h-12 w-14 rounded-xl" />
              <div className="skeleton h-14 w-14 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
