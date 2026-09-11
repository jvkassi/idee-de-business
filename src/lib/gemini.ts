// Appel direct à l'API Google Generative Language (Gemini) en backend,
// sans SDK, pour garder les choses simples et légères.

const TEXT_MODEL = process.env.IDEAS_TEXT_MODEL || "gemini-flash-latest";
// "gemini-flash-latest" est l'alias Google qui pointe toujours vers le
// dernier modèle Flash en date : pas de version à mettre à jour à la main
// quand un nouveau Flash sort. L'audio a son propre modèle (distinct de
// IDEAS_TEXT_MODEL) car c'est une tâche différente.
const AUDIO_MODEL = process.env.IDEAS_AUDIO_MODEL || "gemini-flash-latest";
const IMAGE_MODEL = process.env.IDEAS_IMAGE_MODEL || "gemini-3.1-flash-image";
const EMBEDDING_MODEL = process.env.IDEAS_EMBEDDING_MODEL || "gemini-embedding-001";
// Dimension fixe pour la colonne pgvector : gemini-embedding-001 accepte
// outputDimensionality pour raccourcir son vecteur natif (3072) à une
// taille qui reste rapide à indexer/comparer pour le volume d'idées visé.
const EMBEDDING_DIMENSIONS = 768;

const IVORY_COAST_CONTEXT = `Contexte : marché ivoirien et ouest-africain (Abidjan et
l'intérieur du pays). Ancre toute analyse dans les réalités locales, pas des
généralités : pouvoir d'achat réel (urbain/Abidjan vs. intérieur, jeunesse, classe
moyenne émergente, diaspora), revenus via Mobile Money (Orange Money, MTN Mobile
Money, Wave, Moov Money) plutôt que carte bancaire, poids de l'économie informelle,
prix en FCFA, canaux terrain (WhatsApp Business, marchés et quartiers, bouche-à-
oreille) plutôt que tactiques SaaS occidentales génériques.`;

function apiKeyOrThrow(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");
  return apiKey;
}

/** Appel générique à generateContent en attendant une réponse JSON. */
async function callGeminiJSON(model: string, parts: unknown[], temperature: number): Promise<unknown> {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
          // Sans plafond généreux, les schémas les plus fournis (starter kit)
          // peuvent être coupés en cours de génération — surtout que ces
          // modèles consomment aussi une partie du budget en "réflexion"
          // interne avant de produire la réponse visible.
          maxOutputTokens: 8192,
        },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string | undefined = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason})` : "";
    throw new Error(`Réponse Gemini vide${reason}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    const reason = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason}, ${text.length} caractères)` : "";
    throw new Error(`Réponse Gemini non-JSON${reason}`);
  }
}

/** Appel générique à generateContent en attendant une image inline. */
async function callGeminiImage(
  model: string,
  prompt: string,
  aspectRatio: string,
): Promise<{ mimeType: string; base64: string }> {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio } },
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
    if (inline?.data && inline.mimeType) return { mimeType: inline.mimeType, base64: inline.data };
  }
  throw new Error("Aucune image retournée par Gemini");
}

/**
 * Vecteur sémantique d'un texte (titre + pitch d'une idée, ou requête de
 * recherche) : deux idées qui parlent de la même chose avec des mots
 * différents finissent proches dans cet espace, contrairement à un simple
 * ILIKE sur le texte brut.
 */
export async function embedText(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]> {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini embedding API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const values: number[] | undefined = data?.embedding?.values;
  if (!values || values.length === 0) throw new Error("Aucun embedding retourné par Gemini");
  return values;
}

export type IdeaImprovement = {
  summary: string;
  targetAudience: string;
  valueProposition: string;
  revenueModel: string;
  firstSteps: string[];
  risks: string[];
  improvementTips: string[];
  score: number; // 0-100
};

const IMPROVEMENT_SCHEMA_HINT = `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "summary": "résumé amélioré de l'idée en 2-3 phrases percutantes",
  "targetAudience": "description de la clientèle cible",
  "valueProposition": "proposition de valeur claire et différenciante",
  "revenueModel": "modèle de revenus suggéré",
  "firstSteps": ["étape concrète 1", "étape concrète 2", "étape concrète 3"],
  "risks": ["risque ou défi 1", "risque ou défi 2"],
  "improvementTips": ["ce qui manque ou mérite d'être précisé pour une meilleure note, 2 à 4 conseils concrets et actionnables"],
  "score": 0
}
Le champ "score" est une note de potentiel entre 0 et 100 (entier), qui reflète le
potentiel réel sur CE marché, pas un potentiel abstrait.`;

export async function improveIdea(title: string, pitch: string): Promise<IdeaImprovement> {
  const prompt = `Tu es un consultant en stratégie startup spécialisé dans le marché ivoirien
et ouest-africain. Un utilisateur propose l'idée de business suivante, à évaluer et
structurer :
Titre : ${title}
Description : ${pitch}

${IVORY_COAST_CONTEXT}

Rédige en français.
${IMPROVEMENT_SCHEMA_HINT}`;

  const parsed = await callGeminiJSON(TEXT_MODEL, [{ text: prompt }], 0.7);
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
    improvementTips: Array.isArray(p.improvementTips) ? p.improvementTips.map(String).slice(0, 5) : [],
    score: Math.max(0, Math.min(100, Math.round(p.score))),
  };
}

/**
 * Fusionne une précision vocale supplémentaire dans le texte existant d'une
 * idée : pas un simple collage, l'IA réécrit un texte cohérent qui garde
 * tous les détails (anciens et nouveaux). Utilisé quand le score est trop
 * bas et que l'auteur réenregistre une note vocale pour préciser son idée.
 */
export async function refineIdeaPitch(existingPitch: string, additionalTranscript: string): Promise<string> {
  const prompt = `Voici la description actuelle d'une idée de business, et une précision
supplémentaire que son auteur vient d'ajouter à voix haute pour répondre aux points
faibles relevés par une première analyse.

Description actuelle :
${existingPitch}

Précision supplémentaire (transcription) :
${additionalTranscript}

Réécris UNE description cohérente et complète qui intègre tous les détails des deux
textes, sans rien perdre, en français, à la première personne comme le ferait
l'auteur. Réponds UNIQUEMENT avec un objet JSON valide : {"pitch": "..."}`;

  const parsed = await callGeminiJSON(TEXT_MODEL, [{ text: prompt }], 0.5);
  const pitch = (parsed as { pitch?: unknown })?.pitch;
  if (typeof pitch !== "string" || !pitch.trim()) throw new Error("Fusion de l'idée impossible");
  return pitch.trim().slice(0, 2000);
}

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

  const parsed = await callGeminiJSON(
    AUDIO_MODEL,
    [{ text: prompt }, { inlineData: { mimeType, data: base64Audio } }],
    0.4,
  );
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

/**
 * Transcrit une note vocale courte (commentaire ou précision) sans les
 * exigences de structuration d'une idée complète — juste le texte fidèle.
 */
export async function transcribeShortAudio(base64Audio: string, mimeType: string): Promise<string> {
  const prompt = `Transcris fidèlement cet enregistrement audio en français, en corrigeant
seulement les hésitations pour que ce soit lisible. Réponds UNIQUEMENT avec un objet
JSON valide : {"transcript": "..."}`;
  const parsed = await callGeminiJSON(
    AUDIO_MODEL,
    [{ text: prompt }, { inlineData: { mimeType, data: base64Audio } }],
    0.3,
  );
  const transcript = (parsed as { transcript?: unknown })?.transcript;
  if (typeof transcript !== "string" || !transcript.trim()) throw new Error("Transcription vide");
  return transcript.trim();
}

export type CoverImage = { mimeType: string; base64: string };

/**
 * Génère une illustration de couverture pour une idée, dans un style
 * cohérent (flat design, punchy) pensé pour une audience de jeunes
 * entrepreneurs qui parcourent vite le fil d'idées.
 */
export async function generateCoverImage(title: string, pitch: string, categoryName: string): Promise<CoverImage> {
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

  return callGeminiImage(IMAGE_MODEL, prompt, "16:9");
}

/**
 * Génère un flyer promotionnel carré pour une idée validée (score ≥ 70),
 * pensé pour être partagé tel quel (réseaux sociaux, impression).
 */
export async function generateFlyerImage(title: string, pitch: string, categoryName: string): Promise<CoverImage> {
  const prompt = `Flyer promotionnel carré (1:1) pour une startup, style flat design moderne,
couleurs vives, mise en page façon affiche avec de la place pour un titre en overlay
(ne dessine PAS de texte toi-même, laisse l'espace). Contexte Côte d'Ivoire / Afrique
de l'Ouest, sobre, sans stéréotype. Composition centrée, lisible même en petit format.
Catégorie : ${categoryName}. Titre de l'idée : ${title}. Description : ${pitch}`;

  return callGeminiImage(IMAGE_MODEL, prompt, "1:1");
}

export type StarterKit = {
  landingHeadline: string;
  landingSubheadline: string;
  valueProps: Array<{ title: string; text: string }>;
  ctaLabel: string;
  faq: Array<{ q: string; a: string }>;
  systemDesignOverview: string;
  systemComponents: Array<{ name: string; description: string }>;
  techStack: string[];
  mvpCoreFeatures: string[];
  mvpNiceToHave: string[];
  mvpFirstMilestone: string;
};

const KIT_SCHEMA_HINT = `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "landingHeadline": "titre d'accroche percutant pour la landing page (max 80 caractères)",
  "landingSubheadline": "une phrase qui explique la proposition de valeur",
  "valueProps": [{"title": "bénéfice court", "text": "1-2 phrases"}] (exactement 3 éléments),
  "ctaLabel": "texte du bouton d'appel à l'action (ex: 'Rejoindre la liste d'attente')",
  "faq": [{"q": "question que se poserait un visiteur", "a": "réponse courte"}] (3 à 4 éléments),
  "systemDesignOverview": "2-3 phrases décrivant l'architecture globale du produit",
  "systemComponents": [{"name": "nom du composant", "description": "son rôle en une phrase"}] (4 à 6 éléments : ex. appli mobile, backend, base de données, paiement Mobile Money, notifications...),
  "techStack": ["technologie ou service concret, ex: React Native, Node.js, Orange Money API"] (4 à 8 éléments),
  "mvpCoreFeatures": ["fonctionnalité indispensable au lancement"] (4 à 6 éléments),
  "mvpNiceToHave": ["fonctionnalité à ajouter plus tard, pas au lancement"] (2 à 4 éléments),
  "mvpFirstMilestone": "le tout premier jalon concret et atteignable pour valider l'idée sur le terrain, en une phrase"
}`;

/**
 * Génère le "starter kit" d'une idée validée (score ≥ 70) : de quoi
 * démarrer sans repartir de zéro — copy de landing page, esquisse
 * d'architecture, périmètre MVP. Tout est du contenu (texte + une image de
 * flyer séparée), pas du code : le budget est volontairement contenu, ce
 * n'est pas un vrai produit à déployer, juste un dossier de démarrage.
 */
export async function generateStarterKit(title: string, pitch: string, analysis: IdeaImprovement): Promise<StarterKit> {
  const prompt = `Tu es un consultant produit qui prépare un dossier de démarrage pour un
entrepreneur solo, pour l'idée de business suivante (déjà validée par la communauté,
score ${analysis.score}/100) :
Titre : ${title}
Description : ${pitch}
Cible : ${analysis.targetAudience}
Proposition de valeur : ${analysis.valueProposition}
Modèle de revenus : ${analysis.revenueModel}

${IVORY_COAST_CONTEXT}

Reste volontairement simple et concret : c'est un point de départ pour un entrepreneur
seul avec peu de moyens, pas un cahier des charges d'entreprise. Rédige en français.
${KIT_SCHEMA_HINT}`;

  const parsed = await callGeminiJSON(TEXT_MODEL, [{ text: prompt }], 0.6);
  const k = parsed as Partial<StarterKit>;
  if (
    typeof k.landingHeadline !== "string" ||
    typeof k.landingSubheadline !== "string" ||
    !Array.isArray(k.valueProps) ||
    typeof k.ctaLabel !== "string" ||
    !Array.isArray(k.faq) ||
    typeof k.systemDesignOverview !== "string" ||
    !Array.isArray(k.systemComponents) ||
    !Array.isArray(k.techStack) ||
    !Array.isArray(k.mvpCoreFeatures) ||
    !Array.isArray(k.mvpNiceToHave) ||
    typeof k.mvpFirstMilestone !== "string"
  ) {
    throw new Error("Réponse Gemini incomplète pour le starter kit");
  }

  return {
    landingHeadline: k.landingHeadline.slice(0, 100),
    landingSubheadline: k.landingSubheadline.slice(0, 200),
    valueProps: k.valueProps
      .filter((v): v is { title: string; text: string } => typeof v?.title === "string" && typeof v?.text === "string")
      .slice(0, 3),
    ctaLabel: k.ctaLabel.slice(0, 40),
    faq: k.faq
      .filter((f): f is { q: string; a: string } => typeof f?.q === "string" && typeof f?.a === "string")
      .slice(0, 4),
    systemDesignOverview: k.systemDesignOverview.slice(0, 500),
    systemComponents: k.systemComponents
      .filter((c): c is { name: string; description: string } => typeof c?.name === "string" && typeof c?.description === "string")
      .slice(0, 6),
    techStack: k.techStack.map(String).slice(0, 8),
    mvpCoreFeatures: k.mvpCoreFeatures.map(String).slice(0, 6),
    mvpNiceToHave: k.mvpNiceToHave.map(String).slice(0, 4),
    mvpFirstMilestone: k.mvpFirstMilestone.slice(0, 300),
  };
}

export type JobOfferAnalysis = {
  isJobOffer: boolean;
  title: string;
  company: string | null;
  location: string | null;
  contractType: string | null;
  salary: string | null;
  contact: string | null;
  /** Canaux de candidature structurés : mail / numéro / lien cliquable. */
  emails: string[];
  phones: string[];
  urls: string[];
  /** Marche à suivre pour postuler en une phrase (ex: "Envoyez CV sur WhatsApp"). */
  howToApply: string | null;
  summary: string;
  skills: string[];
  score: number; // 0-100 : qualité / crédibilité de l'annonce
};

const JOB_SCHEMA_HINT = `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "isJobOffer": true,
  "title": "intitulé du poste ou de la mission",
  "company": "entreprise ou null si inconnue",
  "location": "lieu (ex: Abidjan, Cocody) ou null",
  "contractType": "CDI, CDD, stage, freelance, mission ponctuelle... ou null",
  "salary": "salaire/rémunération si mentionné, sinon null",
  "contact": "contact / comment postuler, ou null",
  "emails": ["mail tel quel, même obfusqué type 'contact arobase gmail point com' -> contact@gmail.com"],
  "phones": ["numéros au format +2250707070707 si ivoirien, sinon +indicatif..."],
  "urls": ["liens https://... ou www.... vers formulaire / candidature"],
  "howToApply": "marche à suivre en une phrase, ou null",
  "summary": "résumé de l'offre en 2 phrases max",
  "skills": ["compétence 1", "compétence 2"],
  "score": 0
}
IMPORTANT : recopie TOUS les moyens de postuler présents dans le texte
(mail, numéro WhatsApp/téléphone même écrit "zero sept...", lien). Ne les
invente jamais : tableau vide si aucun.
"isJobOffer" vaut false si le message N'EST PAS une offre d'emploi / mission /
prestation recherchée (discussion, pub non-emploi, salut, lien seul, image sans
texte...). Dans ce cas mets des champs vides et score 0.`;

export type JobAttachment = { mimeType: string; base64: string };

/**
 * Analyse une annonce d'emploi pour dire si c'est une offre et l'extraire
 * en structuré. L'IA est première : elle lit le texte ET les pièces jointes
 * (flyers en image, PDF de recrutement — où vivent souvent le numéro, le
 * mail et le lieu). Contexte ivoirien comme le reste de l'app.
 */
export async function analyzeJobMessage(
  messageBody: string,
  attachments: JobAttachment[] = [],
): Promise<JobOfferAnalysis> {
  const files =
    attachments.length > 0
      ? `\n${attachments.length} pièce(s) jointe(s) accompagnent ce texte : lis-les comme partie intégrante de l'annonce. Images et PDF (flyers) contiennent souvent l'essentiel (postes, contact, lieu) même quand le texte est vide. Un message vocal transcrit une annonce parlée : traite sa transcription comme le texte de l'annonce. Un sticker, mème, photo ou vocal sans rapport avec un emploi n'est PAS une offre.`
      : "";
  const prompt = `Tu es Djossi, qui trie des annonces d'emploi ivoiriennes.
Annonce à analyser (peut regrouper plusieurs messages successifs du même auteur) :
---
${messageBody.slice(0, 4000) || "(pas de texte)"}
---${files}

${IVORY_COAST_CONTEXT}

Rédige en français.
${JOB_SCHEMA_HINT}`;

  const parts: unknown[] = [{ text: prompt }];
  for (const a of attachments.slice(0, 3)) {
    parts.push({ inline_data: { mime_type: a.mimeType, data: a.base64 } });
  }
  const parsed = await callGeminiJSON(TEXT_MODEL, parts, 0.3);
  const p = parsed as Partial<JobOfferAnalysis> & { isJobOffer?: unknown };
  if (typeof p.isJobOffer !== "boolean") throw new Error("Réponse Gemini incomplète (job)");
  if (!p.isJobOffer) {
    return {
      isJobOffer: false,
      title: "",
      company: null,
      location: null,
      contractType: null,
      salary: null,
      contact: null,
      emails: [],
      phones: [],
      urls: [],
      howToApply: null,
      summary: "",
      skills: [],
      score: 0,
    };
  }
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 5) : [];
  return {
    isJobOffer: true,
    title: typeof p.title === "string" ? p.title.slice(0, 150) : "Offre d'emploi",
    company: typeof p.company === "string" && p.company ? p.company.slice(0, 150) : null,
    location: typeof p.location === "string" && p.location ? p.location.slice(0, 150) : null,
    contractType: typeof p.contractType === "string" && p.contractType ? p.contractType.slice(0, 80) : null,
    salary: typeof p.salary === "string" && p.salary ? p.salary.slice(0, 150) : null,
    contact: typeof p.contact === "string" && p.contact ? p.contact.slice(0, 300) : null,
    emails: strList(p.emails),
    phones: strList(p.phones),
    urls: strList(p.urls),
    howToApply:
      typeof p.howToApply === "string" && p.howToApply ? p.howToApply.slice(0, 300) : null,
    summary: typeof p.summary === "string" ? p.summary.slice(0, 500) : "",
    skills: Array.isArray(p.skills) ? p.skills.map(String).slice(0, 8) : [],
    score:
      typeof p.score === "number" ? Math.max(0, Math.min(100, Math.round(p.score))) : 50,
  };
}

export type ProfileExperience = { title: string; company: string; period: string; description: string };
export type ProfileEducation = { degree: string; school: string; period: string };

export type CandidateProfile = {
  headline: string;
  summary: string;
  skills: string[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  languages: string[];
  location: string | null;
  phone: string | null;
  email: string | null;
};

export const EMPTY_PROFILE: CandidateProfile = {
  headline: "",
  summary: "",
  skills: [],
  experience: [],
  education: [],
  languages: [],
  location: null,
  phone: null,
  email: null,
};

const PROFILE_SCHEMA_HINT = `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "headline": "titre pro en une ligne (ex: Serveuse expérimentée — Abidjan)",
  "summary": "2-3 phrases qui présentent le candidat",
  "skills": ["compétence 1", "compétence 2"],
  "experience": [{"title": "poste", "company": "employeur", "period": "2022-2024", "description": "une phrase"}],
  "education": [{"degree": "diplôme", "school": "école", "period": "2020"}],
  "languages": ["Français", "Anglais"],
  "location": "ville/quartier ou null",
  "phone": "téléphone ou null",
  "email": "email ou null"
}`;

/** Nettoie et borne un profil renvoyé par Gemini avant stockage. */
export function sanitizeProfile(p: Partial<CandidateProfile>): CandidateProfile {
  const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
  const strOrNull = (v: unknown, max: number): string | null => {
    const s = str(v, max).trim();
    return s ? s : null;
  };
  return {
    headline: str(p.headline, 150),
    summary: str(p.summary, 800),
    skills: Array.isArray(p.skills) ? p.skills.map(String).slice(0, 20) : [],
    experience: Array.isArray(p.experience)
      ? p.experience
          .filter((e): e is ProfileExperience => typeof e?.title === "string")
          .slice(0, 10)
          .map((e) => ({
            title: String(e.title).slice(0, 150),
            company: String(e.company ?? "").slice(0, 150),
            period: String(e.period ?? "").slice(0, 50),
            description: String(e.description ?? "").slice(0, 400),
          }))
      : [],
    education: Array.isArray(p.education)
      ? p.education
          .filter((e): e is ProfileEducation => typeof e?.degree === "string")
          .slice(0, 6)
          .map((e) => ({
            degree: String(e.degree).slice(0, 150),
            school: String(e.school ?? "").slice(0, 150),
            period: String(e.period ?? "").slice(0, 50),
          }))
      : [],
    languages: Array.isArray(p.languages) ? p.languages.map(String).slice(0, 8) : [],
    location: strOrNull(p.location, 150),
    phone: strOrNull(p.phone, 50),
    email: strOrNull(p.email, 150),
  };
}

/**
 * Extrait un profil structuré depuis un CV (PDF ou image) : Gemini lit le
 * document directement, pas besoin de parser le PDF côté serveur.
 */
export async function parseCvDocument(base64: string, mimeType: string): Promise<CandidateProfile> {
  const prompt = `Voici le CV d'un candidat en Côte d'Ivoire (document joint).
Extrais-en un profil structuré. Ne rien inventer : si une info est absente,
mets une chaîne vide / tableau vide / null. Rédige en français.
${PROFILE_SCHEMA_HINT}`;
  const parsed = await callGeminiJSON(
    TEXT_MODEL,
    [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
    0.3,
  );
  return sanitizeProfile(parsed as Partial<CandidateProfile>);
}

export type ProfileChatTurn = {
  reply: string;
  updatedProfile: CandidateProfile;
};

/**
 * "Raconte-toi" en une fois : le candidat écrit quelques phrases libres,
 * l'IA en fait un joli profil. Simple, un seul appel, pas de conversation
 * à gérer.
 */
export async function profileFromText(
  freeText: string,
  existing?: CandidateProfile,
): Promise<ProfileChatTurn> {
  const prompt = `Tu es Djossi, l'assistant amical qui aide un candidat en Côte
d'Ivoire à se présenter. Il s'est décrit en quelques phrases :

"${freeText.slice(0, 1500)}"
${existing ? `\nProfil déjà existant à enrichir (sans écraser avec du vide) :\n${JSON.stringify(existing).slice(0, 2000)}` : ""}

1. Construis son profil (ne rien inventer).
2. Réponds-lui en 2 phrases max, avec enthousiasme, en tutoyant.

Réponds UNIQUEMENT avec un objet JSON valide :
{"reply": "...", "updatedProfile": {...}}`;
  const parsed = await callGeminiJSON(TEXT_MODEL, [{ text: prompt }], 0.6);
  const p = parsed as { reply?: unknown; updatedProfile?: unknown };
  if (typeof p.reply !== "string" || !p.reply.trim()) throw new Error("Réponse Djossi vide");
  return {
    reply: p.reply.trim().slice(0, 500),
    updatedProfile: sanitizeProfile((p.updatedProfile as Partial<CandidateProfile>) ?? EMPTY_PROFILE),
  };
}

/**
 * Refait le CV : version soignée du profil, en markdown, prête à copier ou
 * à exporter. Le "quick redo" du hub Djossi.
 */
export async function rewriteCv(profile: CandidateProfile): Promise<string> {
  const prompt = `Tu es un expert en recrutement en Côte d'Ivoire. Réécris le CV
ci-dessous en une version soignée, percutante et honnête (ne rien inventer,
mets en valeur l'existant, verbes d'action, chiffres quand il y en a).

Profil (JSON) :
${JSON.stringify(profile).slice(0, 4000)}

Réponds UNIQUEMENT avec le CV en markdown (titres #, ##, listes -, pas de
texte autour), en français, max 1500 mots.`;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text?.trim()) throw new Error("CV vide");
  return text.trim().slice(0, 12000);
}

export type EnhancedPhoto = { mimeType: string; base64: string };

/**
 * "Rendre pro" : la photo du candidat devient un portrait soigné
 * (fond neutre, lumière douce, cadrage épaules-tête), sans changer le visage.
 * Pensé pour les jeunes pros sans studio photo.
 */
export async function enhancePortrait(base64Photo: string, mimeType: string): Promise<EnhancedPhoto> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");
  const prompt = `Transforme cette photo en portrait professionnel pour un CV :
fond uni neutre et flouté, lumière douce et naturelle sur le visage,
cadrage épaules-tête, tenue sobre, netteté et couleurs équilibrées.
IMPORTANT : garde exactement le même visage, mêmes traits, même personne —
juste une version soignée, pas une autre personne. Pas de texte dans l'image.`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Photo } }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1" } },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini image API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts: Array<Record<string, unknown>> = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData as { mimeType?: string; data?: string } | undefined;
    if (inline?.data && inline.mimeType) return { mimeType: inline.mimeType, base64: inline.data };
  }
  throw new Error("Aucune image retournée par Gemini");
}

export type JobMatchInput = {
  id: number;
  title: string;
  summary: string;
  skills: string[];
  location: string | null;
  contractType: string | null;
};

export type JobMatch = { id: number; score: number; reason: string };

/**
 * Matche un profil contre plusieurs offres EN UN SEUL appel : pour chaque
 * offre, un score 0-100 + une raison d'une phrase. Amical, honnête.
 */
export async function matchJobsToProfile(
  profile: CandidateProfile,
  offers: JobMatchInput[],
): Promise<JobMatch[]> {
  if (offers.length === 0) return [];
  const offersText = offers
    .slice(0, 15)
    .map(
      (o) =>
        `#${o.id} | ${o.title} | ${o.location ?? "?"} | ${o.contractType ?? "?"} | skills: ${o.skills.join(", ") || "?"} | ${o.summary.slice(0, 300)}`,
    )
    .join("\n");
  const prompt = `Tu es Djossi, qui aide un candidat en Côte d'Ivoire. Voici son
profil (JSON) :
${JSON.stringify(profile).slice(0, 2500)}

Et des offres d'emploi :
${offersText}

Pour CHAQUE offre, donne un score de compatibilité 0-100 (expérience,
compétences, zone, réalisme — sois honnête, pas gonflé) et une raison d'UNE
phrase, chaleureuse, en tutoyant ("tu").

Réponds UNIQUEMENT avec un objet JSON valide :
{"matches": [{"id": 12, "score": 85, "reason": "..."}]}`;
  const parsed = await callGeminiJSON(TEXT_MODEL, [{ text: prompt }], 0.4);
  const list = (parsed as { matches?: unknown })?.matches;
  if (!Array.isArray(list)) throw new Error("Matching vide");
  return list
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
    .map((m) => ({
      id: Number(m.id),
      score: typeof m.score === "number" ? Math.max(0, Math.min(100, Math.round(m.score))) : 0,
      reason: typeof m.reason === "string" ? m.reason.slice(0, 200) : "",
    }))
    .filter((m) => Number.isFinite(m.id));
}
