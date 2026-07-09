import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";

// NOTE: these are house-styled badges, not Apple/Google's official artwork.
// Before public launch, swap in the official "Download on the App Store" and
// "Get it on Google Play" badge assets to satisfy their brand guidelines.

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path fill="#00D9FF" d="M3.9 2.3 13.5 12 3.9 21.7c-.42-.2-.7-.62-.7-1.12V3.42c0-.5.28-.92.7-1.12z" />
      <path fill="#00D95F" d="M17.1 8.4 13.5 12 3.9 2.3c.42-.22.92-.2 1.32.02L17.1 8.4z" />
      <path fill="#FFCE00" d="M20.7 10.3c.78.42.78 1.6 0 2.02l-3.6 1.92L13.5 12l3.6-3.6 3.6 1.9z" />
      <path fill="#FF3B30" d="M17.1 15.62 5.22 21.68c-.4.22-.9.24-1.32.02L13.5 12l3.6 3.62z" />
    </svg>
  );
}

function Badge({
  href,
  mark,
  top,
  bottom,
}: {
  href?: string;
  mark: React.ReactNode;
  top: string;
  bottom: string;
}) {
  const inner = (
    <span className="flex items-center gap-3 rounded-xl bg-charcoal px-5 py-2.5 text-white ring-1 ring-white/10">
      {mark}
      <span className="flex flex-col text-left leading-none">
        <span className="font-sans text-[10px] uppercase tracking-wide text-white/70">{top}</span>
        <span className="font-sans text-lg font-semibold">{bottom}</span>
      </span>
    </span>
  );

  if (!href) {
    return (
      <div className="relative select-none opacity-60" aria-disabled="true">
        {inner}
        <span className="absolute -right-2 -top-2 rounded-full bg-gold px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Coming soon
        </span>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="transition-transform duration-200 hover:-translate-y-0.5"
    >
      {inner}
    </a>
  );
}

export default function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 sm:flex-row ${className}`}>
      <Badge href={APP_STORE_URL || undefined} mark={<AppleMark />} top="Download on the" bottom="App Store" />
      <Badge href={PLAY_STORE_URL || undefined} mark={<PlayMark />} top="Get it on" bottom="Google Play" />
    </div>
  );
}
