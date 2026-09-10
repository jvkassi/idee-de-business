import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { logoutAction } from "@/app/actions";
import { loginHref } from "@/lib/format";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";

export default function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Idées de Business — accueil">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-bold tracking-tight">
            Idées<span className="hidden sm:inline"> de Business</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/jobs" className="btn btn-ghost px-3 py-2 sm:px-4">
            <span className="hidden sm:inline">Emplois WhatsApp</span>
            <span className="sm:hidden">Emplois</span>
          </Link>
          <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-sun px-3 py-2 sm:px-4">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Proposer une idée</span>
            <span className="sm:hidden">Idée</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-1.5">
              <Avatar pseudo={user.pseudo} size="sm" />
              <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{user.pseudo}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Se déconnecter"
                  aria-label="Se déconnecter"
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M12 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2M8 10h9m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="btn btn-ghost px-3 py-2 sm:px-4">
              Se connecter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
