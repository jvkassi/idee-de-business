import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/format";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Connexion" };

const POINTS = [
  { icon: "🔓", text: "Pas de mot de passe, pas d'email. Juste un pseudo." },
  { icon: "🪪", text: "Ton pseudo, c'est ton identité ici : il signe tes idées, tes votes et tes réactions." },
  { icon: "↩️", text: "Il existe déjà ? Tu te reconnectes dessus, tout simplement." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [sp, user] = await Promise.all([searchParams, getSession()]);
  const next = safeNext(sp.next);
  if (user) redirect(next);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 py-4 md:grid-cols-[1fr_1fr] md:items-center md:py-10">
      <section>
        <Logo className="mb-5 h-12 w-12" />
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Choisis un pseudo, <span className="text-brand">c&apos;est tout.</span>
        </h1>
        <ul className="mt-6 space-y-3">
          {POINTS.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2" aria-hidden>
                {p.icon}
              </span>
              <span className="pt-1.5">{p.text}</span>
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
