import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/format";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Connexion" };

const POINTS = [
  "Pas de mot de passe, pas d'email. Juste un pseudo.",
  "Il signe tes idées, tes votes et tes réactions.",
  "Il existe déjà ? Tu te reconnectes dessus, c'est tout.",
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [sp, user] = await Promise.all([searchParams, getSession()]);
  const next = safeNext(sp.next);
  if (user) redirect(next);

  return (
    <div className="mx-auto grid max-w-3xl gap-8 py-4 md:grid-cols-[1fr_1fr] md:items-center md:py-10">
      <section>
        <Logo className="mb-6 h-12 w-12" />
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Un pseudo, <span className="hl">c&apos;est tout.</span>
        </h1>
        <ul className="mt-6 space-y-2.5">
          {POINTS.map((p, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-ink-2">
              <span className="mt-[11px] h-px w-4 shrink-0 bg-ink" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6 sm:p-7">
        <LoginForm next={next} />
      </section>
    </div>
  );
}
