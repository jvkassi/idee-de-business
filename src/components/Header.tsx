import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { logoutAction } from "@/app/actions";

export default function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          💡 Idées de Business
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="hover:underline">
            Explorer
          </Link>
          {user ? (
            <>
              <Link
                href="/ideas/new"
                className="rounded-md bg-neutral-900 text-white px-3 py-1.5 hover:bg-neutral-700"
              >
                + Proposer une idée
              </Link>
              <span className="text-neutral-500 hidden sm:inline">@{user.pseudo}</span>
              <form action={logoutAction}>
                <button type="submit" className="text-neutral-500 hover:underline">
                  Déconnexion
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-neutral-900 text-white px-3 py-1.5 hover:bg-neutral-700"
            >
              Se connecter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
