"use client";

import { useRef, useState } from "react";

interface RecipeGalleryProps {
  images: string[];
  title: string;
}

export default function RecipeGallery({ images, title }: RecipeGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const hasMultiple = images.length > 1;

  function scrollToIndex(index: number) {
    const container = scrollRef.current;
    if (!container) return;
    const clamped = Math.max(0, Math.min(index, images.length - 1));
    const child = container.children[clamped] as HTMLElement | undefined;
    if (child) container.scrollTo({ left: child.offsetLeft - container.offsetLeft, behavior: "smooth" });
    setActive(clamped);
  }

  // Track the centered image so arrows/dots stay in sync with manual scrolling.
  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const center = container.scrollLeft + container.clientWidth / 2;
    let closest = 0;
    let min = Infinity;
    Array.from(container.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(elCenter - center);
      if (distance < min) {
        min = distance;
        closest = i;
      }
    });
    setActive(closest);
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scrollbar-hide"
      >
        {images.map((url, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={url}
            alt={`${title} — photo ${index + 1}`}
            className="w-full shrink-0 snap-center object-cover rounded-2xl shadow-md aspect-[16/9]"
          />
        ))}
      </div>

      {hasMultiple && (
        <>
          {active > 0 && (
            <button
              type="button"
              onClick={() => scrollToIndex(active - 1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-charcoal/50 text-white backdrop-blur-sm transition-colors hover:bg-charcoal/70 cursor-pointer"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          {active < images.length - 1 && (
            <button
              type="button"
              onClick={() => scrollToIndex(active + 1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-charcoal/50 text-white backdrop-blur-sm transition-colors hover:bg-charcoal/70 cursor-pointer"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          <div className="mt-2 flex justify-center gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`Go to photo ${index + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  index === active ? "w-4 bg-terracotta" : "w-1.5 bg-slate/30 hover:bg-slate/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
