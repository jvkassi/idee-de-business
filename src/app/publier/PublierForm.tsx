"use client";

import { useActionState } from "react";
import { submitDirectOfferAction, type DirectOfferFormState } from "./actions";
import { DIRECT_OFFER_CONTRACTS } from "@/lib/directOffers";

export default function PublierForm() {
  const [state, formAction, pending] = useActionState<DirectOfferFormState, FormData>(
    submitDirectOfferAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.ok && (
        <p
          role="status"
          className="rounded-xl border border-ok/30 bg-ok-soft px-3.5 py-2.5 text-sm font-medium text-ok"
        >
          Reçue ! Djossi la relit avant publication (moins de 24 h).
        </p>
      )}

      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-semibold">
          Titre du poste
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={10}
          maxLength={150}
          placeholder="Ex : Serveuse pour maquis à Cocody, logée et nourrie"
          className="input font-medium"
          autoComplete="off"
        />
        <p className="mt-1.5 text-xs text-ink-3">10 caractères minimum : dis le poste et le lieu si tu peux.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="company" className="mb-1.5 block text-sm font-semibold">
            Entreprise ou ménage <span className="font-normal text-ink-3">(facultatif)</span>
          </label>
          <input
            id="company"
            name="company"
            maxLength={150}
            placeholder="Ex : Maquis Le Baobab"
            className="input"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="location" className="mb-1.5 block text-sm font-semibold">
            Lieu <span className="font-normal text-ink-3">(facultatif)</span>
          </label>
          <input
            id="location"
            name="location"
            maxLength={150}
            placeholder="Ex : Cocody, Abidjan"
            className="input"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contract" className="mb-1.5 block text-sm font-semibold">
            Type de contrat <span className="font-normal text-ink-3">(facultatif)</span>
          </label>
          <select id="contract" name="contract" defaultValue="" className="input">
            <option value="">Choisir…</option>
            {DIRECT_OFFER_CONTRACTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="salary" className="mb-1.5 block text-sm font-semibold">
            Salaire <span className="font-normal text-ink-3">(facultatif)</span>
          </label>
          <input
            id="salary"
            name="salary"
            maxLength={150}
            placeholder="Ex : 75 000 FCFA / mois"
            className="input"
            autoComplete="off"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact" className="mb-1.5 block text-sm font-semibold">
          Comment te joindre ?
        </label>
        <input
          id="contact"
          name="contact"
          required
          minLength={5}
          maxLength={150}
          placeholder="Ex : +225 07 00 00 00 00"
          className="input"
          autoComplete="off"
        />
        <p className="mt-1.5 text-xs text-ink-3">Numéro WhatsApp ou email où te joindre.</p>
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-semibold">
          Le poste, en quelques phrases
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={30}
          maxLength={5000}
          rows={6}
          placeholder="Ex : Je cherche une serveuse pour mon maquis à Cocody, du mardi au dimanche de 11 h à 23 h. Logement et repas sur place, salaire à discuter selon expérience. Début dès que possible…"
          className="input min-h-32 resize-y leading-relaxed"
        />
        <p className="mt-1.5 text-xs text-ink-3">
          30 caractères minimum : horaires, lieu, salaire, quand commencer — plus c&apos;est concret, plus tu
          reçois de bonnes réponses.
        </p>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-sun w-full py-3 text-base">
        {pending ? "Envoi…" : "Envoyer mon offre"}
      </button>
    </form>
  );
}
