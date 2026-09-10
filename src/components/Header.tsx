import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { logoutAction } from "@/app/actions";
import { loginHref } from "@/lib/format";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import PushBell from "@/components/PushBell";

// Pas de `display` ici : chaque lien pose le sien (le lien FAQ est masqué sur
// mobile, et `hidden` perdrait face à un `inline-flex` partagé).
const NAV_LINK =
  "items-center rounded-lg px-2 py-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:px-2.5";

export default function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3">
        <div className="flex min-w-0 items-center gap-1 sm:gap-4">
          {/* Connecté : le logo ramène au fil (l'outil). Anonyme : à l'accueil (la promesse). */}
          <Link
            href={user ? "/ideas" : "/"}
            className="-mx-1 flex shrink-0 items-center gap-2.5 rounded-lg p-1"
            aria-label="Idées de Business — accueil"
          >
            <Logo className="h-8 w-8" />
            {/* Sous 420 px, le mot ne tient pas à côté du lien "Explorer" et des
                deux boutons de droite : la marque se réduit à son sigle. */}
            <span className="hidden font-display text-lg font-bold tracking-tight min-[26.25rem]:inline">
              Idées<span className="hidden md:inline"> de Business</span>
            </span>
          </Link>

          {/* "Explorer" plutôt que "Idées" : sur mobile, le libellé collé à la
              marque "Idées" donnait "Idées Idées". */}
          <nav aria-label="Principale" className="flex items-center gap-0.5 text-sm font-medium sm:gap-1">
            <Link href="/ideas" className={`${NAV_LINK} inline-flex`}>
              Explorer
            </Link>
            <Link href="/jobs" className={`${NAV_LINK} inline-flex`}>
              Emplois
            </Link>
            <Link href="/faq" className={`${NAV_LINK} hidden sm:inline-flex`}>
              FAQ
            </Link>
          </nav>
        </div>

        <nav aria-label="Compte" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-sun px-2.5 py-2 sm:px-4">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Proposer une idée</span>
            <span className="sm:hidden">Proposer</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface py-0.5 pl-1 pr-0.5 sm:gap-1">
              <Avatar pseudo={user.pseudo} size="sm" />
              <span className="hidden max-w-28 truncate px-1 text-sm font-medium sm:inline">{user.pseudo}</span>
              <PushBell />
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Se déconnecter"
                  aria-label="Se déconnecter"
                  className="icon-btn text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M12 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2M8 10h9m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="btn btn-ghost px-2 py-2 sm:px-4">
              <span className="hidden sm:inline">Se connecter</span>
              <span className="sm:hidden">Connexion</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
