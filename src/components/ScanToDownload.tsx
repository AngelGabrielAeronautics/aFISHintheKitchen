import Image from "next/image";
import { APP_STORE_URL } from "@/lib/app-links";

// "Scan to download" for the desktop reader — the person most likely to be
// reading the pitch is at a laptop, and the badges above are useless to them
// without picking their phone up and typing the URL.
//
// The code is a static SVG in /public (generated with segno, ECC level H), not
// a runtime dependency or a third-party QR service — a remote image here would
// leak every visitor to whoever hosts it, and break the page if they go down.
//
// ⚠ It points at the App Store specifically, so it must not appear before that
// listing is live, hence the guard. When Google Play launches this should
// become a link to /#download instead, so an Android user scanning it doesn't
// land on an App Store page they can't use — and the label should change with
// it. Regenerate the SVG at the same time.
export default function ScanToDownload({ className = "" }: { className?: string }) {
  if (!APP_STORE_URL) return null;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-charcoal/10">
        <Image
          src="/qr-app-store.svg"
          alt="QR code linking to A Fish in the Kitchen on the App Store"
          width={132}
          height={132}
          className="h-[132px] w-[132px]"
          unoptimized
        />
      </div>
      <p className="mt-3 font-sans text-xs text-slate">
        Scan with your iPhone camera to download
      </p>
    </div>
  );
}
