import { query, ready } from "./db";

/**
 * Offres postées directement sur Djossi par un recruteur ou un ménage
 * (« Publier une offre »), sans passer par WhatsApp.
 * v1 : soumission → relecture Djossi sous 24 h → publication.
 * Pas d'interface d'administration pour l'instant.
 */

export const DIRECT_OFFER_STATUSES = ["pending", "published", "rejected"] as const;
export type DirectOfferStatus = (typeof DIRECT_OFFER_STATUSES)[number];

export const DIRECT_OFFER_CONTRACTS = [
  "CDI",
  "CDD",
  "Stage",
  "Freelance",
  "Mission",
  "Temps plein",
  "Autre",
] as const;

export type DirectOfferInput = {
  title: string;
  company?: string | null;
  location?: string | null;
  contractType?: string | null;
  salary?: string | null;
  contact: string;
  description: string;
};

export type DirectOfferItem = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  contractType: string | null;
  status: DirectOfferStatus;
  createdAt: string;
};

const TITLE_MIN = 10;
const TITLE_MAX = 150;
const DESCRIPTION_MIN = 30;
const DESCRIPTION_MAX = 5000;
const CONTACT_MIN = 5;
const CONTACT_MAX = 150;
const OPTIONAL_MAX = 150;

/**
 * Validation pure (sans base) : titre ≥ 10 caractères, description ≥ 30,
 * contact ≥ 5, champs facultatifs ≤ 150. Renvoie le message d'erreur en
 * français, ou null si tout est bon.
 */
export function validateDirectOffer(data: DirectOfferInput): string | null {
  const title = (data.title ?? "").trim();
  if (title.length < TITLE_MIN) {
    return "Donne un titre un peu plus précis (10 caractères minimum).";
  }
  if (title.length > TITLE_MAX) {
    return "Le titre est trop long (150 caractères maximum).";
  }

  const contact = (data.contact ?? "").trim();
  if (contact.length < CONTACT_MIN) {
    return "Indique un moyen de te joindre (5 caractères minimum).";
  }
  if (contact.length > CONTACT_MAX) {
    return "Le contact est trop long (150 caractères maximum).";
  }

  const description = (data.description ?? "").trim();
  if (description.length < DESCRIPTION_MIN) {
    return "Raconte le poste en quelques phrases (30 caractères minimum).";
  }
  if (description.length > DESCRIPTION_MAX) {
    return "La description est trop longue (5000 caractères maximum).";
  }

  const optionals: Array<[label: string, value: string | null | undefined]> = [
    ["Le nom de l'entreprise ou du ménage", data.company],
    ["Le lieu", data.location],
    ["Le salaire", data.salary],
  ];
  for (const [label, value] of optionals) {
    if (value && value.trim().length > OPTIONAL_MAX) {
      return `${label} est trop long (150 caractères maximum).`;
    }
  }

  const contractType = (data.contractType ?? "").trim();
  if (
    contractType.length > 0 &&
    !(DIRECT_OFFER_CONTRACTS as readonly string[]).includes(contractType)
  ) {
    return "Choisis un type de contrat dans la liste.";
  }
  if (contractType.length > OPTIONAL_MAX) {
    return "Le type de contrat est trop long (150 caractères maximum).";
  }

  return null;
}

export async function ensureDirectOffersSchema(): Promise<void> {
  await ready();
  await query(`
    CREATE TABLE IF NOT EXISTS direct_offers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      company TEXT NULL,
      location TEXT NULL,
      contract_type TEXT NULL,
      salary TEXT NULL,
      contact TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function emptyToNull(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : null;
}

export async function submitDirectOffer(
  userId: number,
  data: DirectOfferInput,
): Promise<{ ok: true } | { error: string }> {
  if (!Number.isInteger(userId)) {
    return { error: "Connecte-toi pour publier une offre." };
  }
  const validationError = validateDirectOffer(data);
  if (validationError) return { error: validationError };
  try {
    await ensureDirectOffersSchema();
    await query(
      `INSERT INTO direct_offers
        (user_id, title, company, location, contract_type, salary, contact, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [
        userId,
        data.title.trim(),
        emptyToNull(data.company),
        emptyToNull(data.location),
        emptyToNull(data.contractType),
        emptyToNull(data.salary),
        data.contact.trim(),
        data.description.trim(),
      ],
    );
    return { ok: true as const };
  } catch (err) {
    console.error("[direct-offers] soumission échouée", err);
    return { error: "Impossible d'enregistrer ton offre pour le moment, réessaie dans un instant." };
  }
}

export async function listMyDirectOffers(userId: number): Promise<DirectOfferItem[]> {
  await ensureDirectOffersSchema();
  const rows = await query<{
    id: number;
    title: string;
    company: string | null;
    location: string | null;
    contract_type: string | null;
    status: string;
    created_at: string;
  }>(
    `SELECT id, title, company, location, contract_type, status, created_at
     FROM direct_offers WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return rows.map((r) => {
    const s = String(r.status);
    const status: DirectOfferStatus = s === "published" ? "published" : s === "rejected" ? "rejected" : "pending";
    return {
      id: Number(r.id),
      title: String(r.title),
      company: r.company ? String(r.company) : null,
      location: r.location ? String(r.location) : null,
      contractType: r.contract_type ? String(r.contract_type) : null,
      status,
      createdAt: String(r.created_at),
    };
  });
}
