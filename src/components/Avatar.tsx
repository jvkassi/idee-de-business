import { hueFor } from "@/lib/format";

const SIZES = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm" } as const;

/** Initiale du pseudo sur un aplat coloré stable (aucun upload à gérer). */
export default function Avatar({ pseudo, size = "md" }: { pseudo: string; size?: keyof typeof SIZES }) {
  const hue = hueFor(pseudo.toLowerCase());
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display font-bold uppercase text-white ${SIZES[size]}`}
      style={{ background: `hsl(${hue} 62% 44%)` }}
    >
      {pseudo.charAt(0)}
    </span>
  );
}
