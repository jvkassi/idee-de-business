import { hueFor } from "@/lib/format";

const SIZES = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm" } as const;

/** Initiale du pseudo sur un fond coloré stable (aucun upload d'image à gérer). */
export default function Avatar({ pseudo, size = "md" }: { pseudo: string; size?: keyof typeof SIZES }) {
  const hue = hueFor(pseudo.toLowerCase());
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display font-bold uppercase text-white ${SIZES[size]}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 48%), hsl(${(hue + 40) % 360} 75% 42%))` }}
    >
      {pseudo.charAt(0)}
    </span>
  );
}
