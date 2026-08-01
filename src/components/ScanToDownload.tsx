import Image from "next/image";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";

// "Scan to download" for the desktop reader — the person most likely to be
// reading the pitch is at a laptop, and the badges above are useless to them
// without picking their phone up and typing the URL.
//
// Two codes, one per store (Dylan's call, 2026-08-01): each goes STRAIGHT to
// its listing, no intermediate page. Static SVGs in /public (segno, ECC-H) —
// a remote QR service would leak every visitor and break if it went down.
// Regenerate with:
//   segno.make(url, error="h").save(name, scale=10, border=2,
//                                   dark="#1a1a1a", light="#fff")
export default function ScanToDownload({ className = "" }: { className?: string }) {
  const codes = [
    APP_STORE_URL && {
      src: "/qr-appstore.svg",
      label: "iPhone & iPad",
      alt: "QR code linking to A Fish in the Kitchen on the App Store",
    },
    PLAY_STORE_URL && {
      src: "/qr-googleplay.svg",
      label: "Android",
      alt: "QR code linking to A Fish in the Kitchen on Google Play",
    },
  ].filter(Boolean) as { src: string; label: string; alt: string }[];

  if (codes.length === 0) return null;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex flex-wrap items-start justify-center gap-6">
        {codes.map((code) => (
          <div key={code.src} className="flex flex-col items-center">
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-charcoal/10">
              <Image
                src={code.src}
                alt={code.alt}
                width={132}
                height={132}
                className="h-[132px] w-[132px]"
                unoptimized
              />
            </div>
            <p className="mt-2 font-sans text-xs font-semibold text-charcoal">{code.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 font-sans text-xs text-slate">
        Scan with your phone camera to download
      </p>
    </div>
  );
}
