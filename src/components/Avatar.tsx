const AVATAR_COLORS = [
  { bg: "bg-terracotta", text: "text-white" },
  { bg: "bg-sage", text: "text-white" },
  { bg: "bg-navy", text: "text-warm-white" },
  { bg: "bg-gold", text: "text-charcoal" },
  { bg: "bg-terracotta-dark", text: "text-white" },
  { bg: "bg-sage-dark", text: "text-white" },
  { bg: "bg-slate", text: "text-warm-white" },
  { bg: "bg-charcoal", text: "text-cream" },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const cleaned = name.replace(/\(.*?\)/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

export default function Avatar({ name, size = "sm" }: AvatarProps) {
  const color = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  const initials = getInitials(name);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-sans font-bold ${color.bg} ${color.text} ${sizeClasses[size]}`}
      title={name}
    >
      {initials}
    </span>
  );
}
