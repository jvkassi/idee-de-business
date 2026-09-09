"use client";

import { useActionState, useState } from "react";
import { createIdeaAction, transcribeIdeaAudioAction, type FormState } from "@/app/actions";
import type { Category } from "@/lib/ideas";
import { categoryStyle } from "@/lib/categoryColor";
import VoiceRecorder from "@/components/VoiceRecorder";

const LIMITS = { title: { min: 5, max: 120 }, pitch: { min: 20, max: 2000 } };

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const tooShort = value > 0 && value < min;
  return (
    <span className={`text-xs tabular-nums ${tooShort ? "text-warn" : value > max * 0.9 ? "text-bad" : "text-ink-3"}`}>
      {value}/{max}
    </span>
  );
}

export default function NewIdeaForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createIdeaAction, undefined);
  const [mode, setMode] = useState<"voice" | "manual">("voice");
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [fromVoice, setFromVoice] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");

  async function handleRecorded(blob: Blob) {
    const formData = new FormData();
    formData.append("audio", blob, `idee.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
    const result = await transcribeIdeaAudioAction(formData);
    if (!result.ok) return { ok: false, error: result.error };
    setTitle(result.suggestedTitle || title);
    setPitch(result.transcript);
    setCategorySlug(result.suggestedCategorySlug || categorySlug);
    setAudioUrl(result.audioUrl);
    setFromVoice(true);
    setMode("manual");
    return { ok: true };
  }

  if (mode === "voice") {
    return (
      <div className="space-y-4">
        <VoiceRecorder onRecorded={handleRecorded} busyLabel="L'IA transcrit ton idée…" />
        <p className="text-center text-xs text-ink-3">
          Tu préfères écrire ?{" "}
          <button type="button" onClick={() => setMode("manual")} className="font-medium text-ink underline underline-offset-4">
            Tape ton idée toi-même
          </button>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {fromVoice && <input type="hidden" name="audioUrl" value={audioUrl} />}
      {fromVoice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sun-soft px-3.5 py-2.5 text-xs">
          <span>
            <strong className="font-semibold">Transcrit depuis ton enregistrement.</strong> Relis et corrige si besoin
            avant de publier.
          </span>
          <button
            type="button"
            onClick={() => {
              setFromVoice(false);
              setAudioUrl("");
              setMode("voice");
            }}
            className="shrink-0 font-medium text-ink underline underline-offset-4"
          >
            Réenregistrer
          </button>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="title" className="text-sm font-semibold">
            Titre
          </label>
          <Counter value={title.length} {...LIMITS.title} />
        </div>
        <input
          id="title"
          name="title"
          required
          minLength={LIMITS.title.min}
          maxLength={LIMITS.title.max}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex : Livraison de repas faits maison entre voisins"
          className="input font-display text-lg font-semibold"
          autoComplete="off"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Catégorie</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c, i) => (
            <label
              key={c.slug}
              style={categoryStyle(c.slug)}
              className="chip cursor-pointer select-none has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:ring-2 has-focus-visible:ring-ink"
            >
              <input
                type="radio"
                name="category"
                value={c.slug}
                required={i === 0}
                checked={categorySlug === c.slug}
                onChange={() => setCategorySlug(c.slug)}
                className="sr-only"
              />
              <span className="cat-dot" aria-hidden /> {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="pitch" className="text-sm font-semibold">
            L&apos;idée, dans tes mots
          </label>
          <Counter value={pitch.length} {...LIMITS.pitch} />
        </div>
        <textarea
          id="pitch"
          name="pitch"
          required
          minLength={LIMITS.pitch.min}
          maxLength={LIMITS.pitch.max}
          rows={8}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder="Le problème que tu as repéré, ta solution, pour qui, et comment ça rapporte."
          className="input resize-y leading-relaxed"
        />
        <p className="mt-1.5 text-xs text-ink-3">
          Minimum {LIMITS.pitch.min} caractères. Plus c&apos;est concret, plus la fiche sera utile.
        </p>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-sun w-full py-3 text-base">
        {pending ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
            </svg>
            Publication…
          </>
        ) : (
          "Publier et lancer la fiche"
        )}
      </button>
    </form>
  );
}
