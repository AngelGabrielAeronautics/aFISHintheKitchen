"use client";

import { useState } from "react";
import Image from "next/image";

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

// Map display names to avatar image filenames in /public/avatars/
const AVATAR_IMAGES: Record<string, string> = {
  poppie: "poppie.png",
  "granny gill": "gill.png",
  dylan: "dylan.png",
  sam: "sam.png",
  bella: "bella.png",
  charlie: "charlie.png",
  quaid: "quaid.png",
};

function getAvatarImage(name: string): string | null {
  const key = name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  return AVATAR_IMAGES[key] ?? null;
}

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
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
}

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-24 w-24 text-2xl",
};

const imageSizes = {
  sm: 28,
  md: 40,
  lg: 56,
  xl: 96,
};

export default function Avatar({ name, size = "sm", ring = false }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const avatarFile = getAvatarImage(name);
  const color = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  const initials = getInitials(name);
  const px = imageSizes[size];
  const ringClass = ring ? "ring-2 ring-terracotta" : "";

  if (avatarFile && !imgError) {
    return (
      <Image
        src={`/avatars/${avatarFile}`}
        alt={name}
        width={px}
        height={px}
        className={`shrink-0 rounded-full object-cover ${sizeClasses[size]} ${ringClass}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-sans font-bold ${color.bg} ${color.text} ${sizeClasses[size]} ${ringClass}`}
      title={name}
    >
      {initials}
    </span>
  );
}
