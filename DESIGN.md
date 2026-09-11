# DESIGN.md - Djossi

## Context (from discovery)

- Artifact type: composite. Landing (conversion) + SaaS app feed (repeated task: publier, voter) + marketplace jobs (match supply/demand, trust) + profil (account). Mobile-first, thumb zone primary.
- Positioning: populaire, not corporate, not luxury, not technical.
- Audience: jeunes Ivoiriens (Abidjan et intérieur), français, WhatsApp natifs, petits écrans | Primary action: proposer une idée en 30 s de voix (landing), postuler en un tap (jobs).
- Adjectives: chaud, franc, populaire.
- Visual word translations:
  - chaud -> papier tiède + soleil plein, espace généreux, jamais froid.
  - franc -> bordures encre épaisses, ombre franche sans flou, prix et scores en chiffres tabulaires mono.
  - populaire -> densité assumée dans les fils, cibles 44px, un seul accent crié fort, zéro jargon visuel.
- Aesthetic essence (3 words): soleil, rue, franc.
- Single-minded proposition: on se dit les choses fort et en public.
- Archetype: Everyman avec un trait Jester (le sticker penché).
- References: admire Gumroad (boutons francs, ombre dure), Linear (rythme constant entre écrans); avoid hero + 3 cartes + témoignages génériques, dégradés indigo.
- Mode: light only (papier, l'IA illustre déjà en saturé) | Density: airy landing, balanced app, dense jobs cards.
- Constraints: Next.js 16 + Tailwind v4, Bricolage + Instrument déjà en place (on garde), aucune image stock, WCAG 2.2 AA.

## Aesthetic

- Direction: bespoke "Marché". Base Neo-brutalist Pop, adoucie par le papier chaud et Bricolage au lieu du sans géométrique.
- Defining trait: chaque surface interactive a une arête encre définie. Bordure OU ombre dure, jamais bord fin + flou diffus ensemble. Les cartes de contenu ont la bordure, les actions ont bordure + ombre dure.
- Signature move: le sticker. Pastille soleil à bordure encre, posée de travers (-3deg) sur le hero et les seuils (70/100). Un seul par écran.

## Typography

- Display: Bricolage Grotesque | source: Google Fonts | license: OFL.
- Body: Instrument Sans | source: Google Fonts | license: OFL.
- Mono (tiers): Space Mono, labels, scores, minuteurs, badges de fil | source: Google Fonts | license: OFL.
- Scale: ratio 1.25 Major Third, base 16px.
  | step | size | line-height | use |
  |------|------|-------------|-----|
  | display | 64px | 1.02 | hero desktop |
  | h1 | 40px | 1.05 | titre page |
  | h2 | 30px | 1.1 | section |
  | h3 | 22px | 1.25 | carte |
  | body | 16px | 1.6 | texte |
  | small | 14px | 1.5 | meta |
  | caption | 12px | 1.4 | labels mono uppercase |
- Weights: 400/500/700 | Measure: 65-75ch, left aligned | Tracking: display -0.02em, uppercase labels +0.08em.

## Color

- Strategy: jaune soleil owned (aucun concurrent local ne le tient), encre chaude au lieu du noir pur. Zéro indigo/violet sauf dans les illustrations IA qu'on encadre de neutres.
- Distribution: 60 papier/neutres, 30 encre (texte, rails), 10 soleil (actions, surlignes).
- Palette (role -> OKLCH | hex):
  - bg: oklch(0.99 0.01 95) | #fffcf5
  - surface: oklch(1 0 0) | #ffffff
  - surface-2: oklch(0.96 0.01 95) | #f6f2e8
  - fg: oklch(0.24 0.01 95) | #1a1813
  - muted: oklch(0.55 0.02 95) | #5f5a51
  - border: oklch(0.9 0.015 95) | #ebe5d8
  - accent: oklch(0.87 0.17 90) | #ffd233
  - accent-fg: oklch(0.24 0.01 95) | #1a1813
  - success: oklch(0.6 0.13 160) | #15884d
  - warning: oklch(0.7 0.15 70) | #d97706
  - error: oklch(0.58 0.18 20) | #cf3640
- Dark mode overrides: none, light only by design.

## Spacing, radius, shadow

- Spacing base: 4px, scale 4 8 12 16 24 32 48 64 96. Tight within groups, generous between sections, large between page sections.
- Radius: 12px cards/panels/inputs, pill for tags/buttons/chips. Max two values.
- Shadow approach: defined edge family. `--shadow-pop: 4px 4px 0 ink` for primary actions, CTA panel, hero frame, sticker. `--shadow-pop-sm: 2px 2px 0 ink` for small stamps. Cards: 1.5px ink-tinted border, no shadow. Never hairline + blur together.

## Layout and composition

- Grid: 12-col desktop, single column mobile | gutters 16px mobile, 24px desktop.
- Spacing rhythm: card padding 16-20px, section gap 56-80px, group gap 8-12px.
- Signature layout move: hero asymétrique, texte à gauche, image encadrée façon affiche avec sticker de travers qui mord sur le cadre. Stats en ligne de registre (ledger) à règles, pas en cartes.
- Density: landing airy, fil balanced, jobs dense | Scanning: F for feed, Z for hero.
- Responsive: mobile-first | breakpoints sm 40rem, lg 64rem. Grids restack, never squash.

## Components and states

- Button hierarchy: primary btn-sun (sun fill, 2px ink border, pop shadow, press = translate 2px + shadow gone), secondary outline (1.5px border, no shadow), tertiary ghost text. One primary per view.
- States: hover darken/fill shift, active scale 0.98 + shadow collapse, focus box-shadow sun ring following radius, disabled 60% opacity, loading skeleton mirroring layout.
- Inputs: visible label, 16px min (no iOS zoom), 1.5px border -> ink on focus + sun ring, inline error kept input.
- Tables: text left, numbers right tabular-nums, light row separators.
- Overlays: lightest fitting (popover < sheet < modal), Escape + backdrop close, focus trap + return.
- Empty/loading/error: empty teaches with verb + example, loading skeleton mirrors content, error says cause + retry, keeps context.
- Focus ring: 0 0 0 3px sun + 0 0 0 5px ink, follows radius via box-shadow.

## Motion

- Duration scale: instant 100ms, fast 150ms, normal 200ms, slow 300ms. No sheet/modal long anim (scope: no drawers yet).
- Easing: --ease-out cubic-bezier(0.23, 1, 0.32, 1) enter, --ease-exit cubic-bezier(0.4, 0, 1, 1).
- What animates: transform/opacity only | reduced-motion: swap for cross-fade, honor prefers-reduced-motion.
- Signature motion: none decorative. Press collapse on primary buttons only.

## Iconography

- Set: inline stroke SVG 2px, round caps, 20px grid. Emoji kept only as category markers (domain chips) and empty states, never as action icons.
- Radius match: round caps echo pill buttons.

## Imagery and illustration

- Mode: real product visuals + Gemini flat illustrations (already the pipeline).
- Rules: new art direction "affiche du marché": flat, warm, sun + ink limited palette, crowds and stalls suggested, no text in image.
- Avoid: people pointing at laptops, gradient blobs, corporate Memphis, raw Midjourney.
- Text-over-image contrast: text never over image except sticker (ink on sun, 2px border).

## Dark mode (if in scope)

- Out of scope. Light only, documented in tokens (color-scheme: light).

## Accessibility

- Contrast: AA verified, sun pairs with ink text only (never white on sun).
- Focus: visible box-shadow ring on all interactives | Keyboard: fully operable, no hover-only affordance.
- Targets: 44px coarse minimum via pointer-coarse rules | Color independence: scores pair number + label, status pairs icon + text.
- Reduced motion: honored | Notes: labels in French, lang="fr".

## Tokens (source of truth)

```css :root {
  --font-display: Bricolage Grotesque, sans; --font-body: Instrument Sans, sans; --font-mono: Space Mono, ui-monospace, monospace;
  --text-display: 4rem/1.02; --text-h1: 2.5rem/1.05; --text-h2: 1.875rem/1.1; --text-body: 1rem/1.6; --text-small: 0.875rem/1.5;
  --space-base: 4px;
  --radius-card: 12px; --radius-pill: 999px;
  --border-thick: 2px solid var(--ink); --border-card: 1.5px solid var(--line-2);
  --shadow-pop: 4px 4px 0 var(--ink); --shadow-pop-sm: 2px 2px 0 var(--ink);
  --paper: oklch(0.99 0.01 95); --ink: oklch(0.24 0.01 95); --sun: oklch(0.87 0.17 90);
  --duration-fast: 150ms; --duration-normal: 200ms; --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
} ```

- Adapter: Tailwind v4 @theme inline (globals.css).

## Cards and surfaces

- Cards/surfaces: border XOR shadow. Content cards: 1.5px border, 12px radius, 16-20px padding. Action panels: 2px ink border + pop shadow. Nesting: no cards in cards, use rules/dividers inside.

## Slop audit

- Date: 2026-09-10 | Result: fixed 9 tells.
- Notes: uniform rounded-2xl replaced by 12px + pill two-value system; diffuse shadow + hairline combo removed, hard-edge family committed; buttons ranked sun primary with press state; focus outline swapped to radius-following box-shadow; hero gained signature layout move (frame + sticker); stats converted to ledger row; emoji action icons replaced by stroke SVG where actions; tabular-nums on scores; reduced-motion honored.

## Changelog

- 2026-09-10: created from frontend-design-deslop discovery (chaud, franc, populaire). Tokens hardened, hero/jobs/feed restyled, audit pass recorded.
```

(End of file - total 130 lines)
