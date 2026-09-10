import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { loginHref } from "@/lib/format";
import Avatar from "@/components/Avatar";
import { AboutForm, CvUploadForm, EnhancePhotoButton, PhotoUploadForm, RedoCvSection } from "./ProfilForms";

export const dynamic = "force-dynamic";
// Lecture de CV + retouche photo : on laisse à la fonction le temps de finir.
export const maxDuration = 60;
export const metadata = { title: "Mon profil" };

export default async function ProfilPage() {
  const user = await getSession();
  if (!user) redirect(loginHref("/profil"));
  const profile = await getProfile(user.id);

  const hasContent =
    !!profile && Boolean(profile.headline || profile.summary || profile.skills.length > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="label">Djossi · ton profil</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Salut @{user.pseudo} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Ta photo, ton CV, quelques mots — Djossi fait le reste, et ça servira bientôt à matcher les offres.
        </p>
      </div>

      {/* Photo */}
      <section className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
        {profile?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photoUrl}
            alt={`Photo de ${user.pseudo}`}
            className="h-24 w-24 rounded-2xl object-cover"
          />
        ) : (
          <Avatar pseudo={user.pseudo} />
        )}
        <div className="min-w-64 flex-1 space-y-2">
          <PhotoUploadForm />
          {profile?.photoUrl && <EnhancePhotoButton />}
        </div>
      </section>

      {/* Profil joli */}
      {hasContent && profile ? (
        <section className="card space-y-3 p-4 sm:p-5" aria-label="Ton profil">
          {profile.headline && (
            <h2 className="font-display text-xl font-bold leading-snug">{profile.headline}</h2>
          )}
          {profile.summary && <p className="text-[15px] leading-relaxed text-ink-2">{profile.summary}</p>}
          {profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          )}
          {profile.experience.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {profile.experience.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">{e.title}</span>
                  {e.company && <span className="text-ink-2"> · {e.company}</span>}
                  {e.period && <span className="text-xs text-ink-3"> ({e.period})</span>}
                </li>
              ))}
            </ul>
          )}
          {(profile.location || profile.phone || profile.email) && (
            <p className="text-sm text-ink-2">
              {[profile.location, profile.phone, profile.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </section>
      ) : (
        <section className="card p-4 text-center text-sm text-ink-2 sm:p-5">
          Pas encore de profil — envoie ton CV ou raconte-toi en deux phrases, c&apos;est tout 👇
        </section>
      )}

      {/* CV + raconte-toi + redo */}
      <section className="card space-y-5 p-4 sm:p-5">
        <CvUploadForm />
        <hr className="border-line" />
        <AboutForm hasProfile={hasContent} />
        {hasContent && (
          <>
            <hr className="border-line" />
            <RedoCvSection />
          </>
        )}
      </section>
    </div>
  );
}
