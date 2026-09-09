// Appel direct à l'API Google Generative Language (Gemini) en backend,
// sans SDK, pour garder les choses simples et légères.

export type IdeaImprovement = {
  summary: string;
  targetAudience: string;
  valueProposition: string;
  revenueModel: string;
  firstSteps: string[];
  risks: string[];
  score: number; // 0-100
};

const MODEL = process.env.IDEAS_TEXT_MODEL || "gemini-3.5-flash";

const SCHEMA_HINT = `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact suivant :
{
  "summary": "résumé amélioré de l'idée en 2-3 phrases percutantes",
  "targetAudience": "description de la clientèle cible",
  "valueProposition": "proposition de valeur claire et différenciante",
  "revenueModel": "modèle de revenus suggéré",
  "firstSteps": ["étape concrète 1", "étape concrète 2", "étape concrète 3"],
  "risks": ["risque ou défi 1", "risque ou défi 2"],
  "score": 0
}
Le champ "score" est une note de potentiel entre 0 et 100 (entier).`;

export async function improveIdea(title: string, pitch: string): Promise<IdeaImprovement> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");

  const prompt = `Tu es un consultant en stratégie startup spécialisé dans le marché ivoirien
et ouest-africain. Un utilisateur propose l'idée de business suivante, à évaluer et
structurer pour le contexte de la Côte d'Ivoire (Abidjan et l'intérieur du pays) :
Titre : ${title}
Description : ${pitch}

Ancre ton analyse dans les réalités locales, pas des généralités :
- Cible et pouvoir d'achat réels du marché ivoirien (urbain/Abidjan vs. villes de
  l'intérieur, jeunesse, classe moyenne émergente, diaspora).
- Modèle de revenus réaliste localement : Mobile Money (Orange Money, MTN Mobile
  Money, Wave, Moov Money) plutôt que carte bancaire, poids de l'économie informelle,
  prix en FCFA.
- Premiers pas concrets et peu coûteux, adaptés au terrain (WhatsApp Business, marchés
  et quartiers, bouche-à-oreille, réseaux de mobilité comme les gbakas/wôrô-wôrô si
  pertinent) plutôt que des tactiques SaaS occidentales génériques.
- Risques spécifiques au marché local : concurrence informelle déjà en place,
  logistique et connectivité selon les zones, cadre réglementaire ivoirien, saisonnalité.

La note reflète le potentiel réel sur CE marché, pas un potentiel abstrait.
Rédige en français.
${SCHEMA_HINT}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse Gemini vide");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Réponse Gemini non-JSON");
  }

  const p = parsed as Partial<IdeaImprovement>;
  if (
    typeof p.summary !== "string" ||
    typeof p.targetAudience !== "string" ||
    typeof p.valueProposition !== "string" ||
    typeof p.revenueModel !== "string" ||
    !Array.isArray(p.firstSteps) ||
    !Array.isArray(p.risks) ||
    typeof p.score !== "number"
  ) {
    throw new Error("Réponse Gemini incomplète");
  }

  return {
    summary: p.summary,
    targetAudience: p.targetAudience,
    valueProposition: p.valueProposition,
    revenueModel: p.revenueModel,
    firstSteps: p.firstSteps.map(String).slice(0, 6),
    risks: p.risks.map(String).slice(0, 6),
    score: Math.max(0, Math.min(100, Math.round(p.score))),
  };
}

// "gemini-flash-latest" est l'alias Google qui pointe toujours vers le
// dernier modèle Flash en date : pas de version à mettre à jour à la main
// quand un nouveau Flash sort. La transcription audio a son propre modèle
// (distinct d'IDEAS_TEXT_MODEL) car c'est une tâche différente.
const AUDIO_MODEL = process.env.IDEAS_AUDIO_MODEL || "gemini-flash-latest";

export type VoiceIdeaDraft = {
  transcript: string;
  suggestedTitle: string;
  suggestedCategorySlug: string;
};

/**
 * Transcrit un enregistrement vocal (l'utilisateur racontant son idée à voix
 * haute, en français) et en extrait un titre et une catégorie suggérés, pour
 * pré-remplir le formulaire de publication. La saisie vocale est le chemin
 * privilégié pour proposer une idée : on encourage des enregistrements longs
 * et détaillés (30 s ou plus) plutôt qu'un texte tapé rapidement.
 */
export async function transcribeIdeaAudio(
  base64Audio: string,
  mimeType: string,
  categories: Array<{ slug: string; name: string }>,
): Promise<VoiceIdeaDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");

  const categoryList = categories.map((c) => `${c.slug} (${c.name})`).join(", ");

  const prompt = `Voici un enregistrement audio en français : une personne y décrit à voix
haute une idée de business pour le marché ivoirien. Elle a été encouragée à être
verbeuse et à donner un maximum de détails (problème, solution, cible, façon de
gagner de l'argent).

1. Transcris fidèlement ce qui est dit, en français, en corrigeant seulement les
   hésitations ("euh", répétitions) pour que ce soit lisible — ne reformule pas le
   fond, ne résume pas, garde tous les détails donnés.
2. Propose un titre court et percutant (10 à 100 caractères) qui résume l'idée.
3. Choisis la catégorie la plus adaptée parmi EXACTEMENT ces slugs (renvoie le
   slug seul, pas le nom) : ${categoryList}.

Réponds UNIQUEMENT avec un objet JSON valide :
{
  "transcript": "...",
  "suggestedTitle": "...",
  "suggestedCategorySlug": "..."
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AUDIO_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Audio } }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini audio API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse Gemini vide");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Réponse Gemini non-JSON");
  }

  const p = parsed as Partial<VoiceIdeaDraft>;
  if (typeof p.transcript !== "string" || !p.transcript.trim()) {
    throw new Error("Transcription vide ou inexploitable");
  }
  const validSlugs = new Set(categories.map((c) => c.slug));
  const suggestedCategorySlug =
    typeof p.suggestedCategorySlug === "string" && validSlugs.has(p.suggestedCategorySlug)
      ? p.suggestedCategorySlug
      : (categories.find((c) => c.slug === "autre")?.slug ?? categories[0]?.slug ?? "");

  return {
    transcript: p.transcript.trim(),
    suggestedTitle: (typeof p.suggestedTitle === "string" ? p.suggestedTitle : "").trim().slice(0, 120),
    suggestedCategorySlug,
  };
}

const IMAGE_MODEL = process.env.IDEAS_IMAGE_MODEL || "gemini-3.1-flash-image";

export type CoverImage = { mimeType: string; base64: string };

/**
 * Génère une illustration de couverture pour une idée, dans un style
 * cohérent (flat design, punchy) pensé pour une audience de jeunes
 * entrepreneurs qui parcourent vite le fil d'idées.
 */
export async function generateCoverImage(
  title: string,
  pitch: string,
  categoryName: string,
): Promise<CoverImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");

  const prompt = `Illustration de couverture pour une idée de startup, style flat design
moderne, couleurs vives, minimaliste, sans texte ni lettres ni chiffres dans l'image,
cadrage large (16:9). Le contexte est celui de la Côte d'Ivoire et de l'Afrique de
l'Ouest : si l'idée décrit des personnes, des lieux ou des scènes de vie, représente-les
dans ce cadre local (Abidjan, marchés, quartiers, tissus et tenues ouest-africains le
cas échéant) plutôt qu'un décor occidental générique — reste sobre et évite tout
stéréotype, l'objectif est la représentation juste, pas le folklore.
Catégorie : ${categoryName}.
Titre de l'idée : ${title}.
Description : ${pitch}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          imageConfig: { aspectRatio: "16:9" },
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini image API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts: Array<Record<string, unknown>> = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData as { mimeType?: string; data?: string } | undefined;
    if (inline?.data && inline.mimeType) {
      return { mimeType: inline.mimeType, base64: inline.data };
    }
  }
  throw new Error("Aucune image retournée par Gemini");
}
