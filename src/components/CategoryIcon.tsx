"use client";

import { useState } from "react";
import Image from "next/image";

interface CategoryIconProps {
  slug: string;
  emoji: string;
  name: string;
  description: string;
}

export default function CategoryIcon({ slug, emoji, name, description }: CategoryIconProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <>
        <span className="text-3xl">{emoji}</span>
        <h3 className="font-serif text-sm font-semibold leading-tight text-charcoal md:text-base">
          {name}
        </h3>
        <p className="hidden font-sans text-xs leading-snug text-slate sm:block">
          {description}
        </p>
      </>
    );
  }

  return (
    <Image
      src={`/icons/${slug}.png`}
      alt={name}
      width={120}
      height={120}
      className="object-contain transition-transform duration-300 group-hover:scale-110"
      onError={() => setImgError(true)}
    />
  );
}
