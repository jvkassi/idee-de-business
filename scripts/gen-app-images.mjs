// Génère les visuels de l'app avec Gemini (même pipeline que les covers).
// Usage: node scripts/gen-app-images.mjs [--out public/hero-market.jpg]
// Lit GEMINI_API_KEY depuis l'environnement ou .env.local.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (k && !(k in process.env)) process.env[k] = v;
    }
  } catch {
    // Pas de .env.local : on compte sur l'environnement.
  }
}

loadEnvLocal();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY manquant (env ou .env.local).");
  process.exit(1);
}
const model = process.env.IDEAS_IMAGE_MODEL || "gemini-3.1-flash-image";
const outArg = process.argv.find((a, i) => process.argv[i - 1] === "--out");
const out = resolve(process.cwd(), outArg || "public/hero-market.jpg");

const prompt = `Affiche publicitaire flat design, format paysage large, pour une plateforme
communautaire d'idées de business en Côte d'Ivoire. Scène : un jeune entrepreneur
(complexion et tenue ouest-africaines, sobre, sans stéréotype) lève son téléphone
comme un micro au milieu d'un marché animé d'Abidjan (étals, tissus colorés
suggérés, foule en arrière-plan flou). Autour du téléphone, des vignettes de
fiches projet et des étoiles de vote s'envolent comme des confettis. Palette
limitée : jaune soleil vif, encre noire chaude, papier crème. Style affiche
sérigraphiée, aplats francs, contours épais. AUCUN texte, AUCUNE lettre, AUCUN
chiffre dans l'image. Lumineux, joyeux, populaire.`;

console.log(`Génération (${model}) -> ${out} ...`);
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "16:9" } },
    }),
  },
);
if (!res.ok) {
  console.error(`Gemini image API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const data = await res.json();
const parts = data?.candidates?.[0]?.content?.parts || [];
const inline = parts.map((p) => p.inlineData).find((d) => d?.data);
if (!inline) {
  console.error("Aucune image retournée par Gemini.");
  process.exit(1);
}
writeFileSync(out, Buffer.from(inline.data, "base64"));
console.log(`OK : ${out} (${inline.mimeType}, ${(inline.data.length / 1024).toFixed(0)} Ko base64)`);
