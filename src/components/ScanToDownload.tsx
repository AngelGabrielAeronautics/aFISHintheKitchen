import Image from "next/image";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";

// "Scan to download" for the desktop reader — the person most likely to be
// reading the pitch is at a laptop, and the badges above are useless to them
// without picking their phone up and typing the URL.
//
// The code is a static SVG in /public (generated with segno, ECC level H), not
// a runtime dependency or a third-party QR service — a remote image here would
// leak every visitor to whoever hosts it, and break the page if they go down.
//
// It points at /#download rather than at either store, because a printed square
// of pixels cannot tell an iPhone from a Pixel. Sending everyone to the badge
// row lets the phone's owner pick, and means this file never has to change
// again when a listing moves. Regenerate with:
//   segno.make("https://www.afishinthekitchen.com/#download", error="h")
//        .save("qr-download.svg", scale=10, border=2, dark="#1a1a1a", light="#fff")
export default function ScanToDownload({ className = "" }: { className?: string }) {
  if (!APP_STORE_URL && !PLAY_STORE_URL) return null;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-charcoal/10">
        <Image
          src="/qr-download.svg"
          alt="QR code linking to the A Fish in the Kitchen download page"
          width={132}
          height={132}
          className="h-[132px] w-[132px]"
          unoptimized
        />
      </div>
      <p className="mt-3 font-sans text-xs text-slate">
        Scan with your phone camera to download
      </p>
    </div>
  );
}
