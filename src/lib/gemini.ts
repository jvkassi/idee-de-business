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

  const prompt = `Tu es un consultant en stratégie startup. Un utilisateur propose l'idée de business suivante :
Titre : ${title}
Description : ${pitch}

Améliore et structure cette idée pour la rendre plus concrète et actionnable, en français.
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
ambiance startup / jeunes entrepreneurs, cadrage large (16:9).
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
