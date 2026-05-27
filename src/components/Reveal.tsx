"use client";

import { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // seconds — stagger items by passing increasing values
}

// Reveals its children (rise + fade) the first time they scroll into view.
// Pairs with the .reveal-on-scroll CSS in globals.css.
export default function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${shown ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: shown ? `${delay}s` : "0s" }}
    >
      {children}
    </div>
  );
}
