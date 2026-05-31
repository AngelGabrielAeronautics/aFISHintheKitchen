import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-cream-dark border-t border-gold-light/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
          {/* Branding */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="A Fish in the Kitchen"
                width={36}
                height={36}
                className="h-9 w-9 rounded-full"
              />
              <span className="font-serif text-lg font-semibold text-charcoal">
                A Fish in the Kitchen
              </span>
            </div>
            <p className="text-sm text-slate italic">
              Dedicated to my father who shaped the flavours of my family for generations
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col items-center sm:items-end gap-3">
            <div className="flex items-center gap-6">
              <Link
                href="/our-story"
                className="text-sm text-slate hover:text-terracotta transition-colors"
              >
                Our Story
              </Link>
              <Link
                href="/recipes"
                className="text-sm text-slate hover:text-terracotta transition-colors"
              >
                Browse Recipes
              </Link>
              <Link
                href="/submit"
                className="text-sm text-slate hover:text-terracotta transition-colors"
              >
                Submit a Recipe
              </Link>
            </div>

            {/* Decorative wave */}
            <svg
              viewBox="0 0 120 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-28 h-4 text-gold-light"
              aria-hidden="true"
            >
              <path
                d="M0 8c10-6 20-6 30 0s20 6 30 0 20-6 30 0 20 6 30 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 pt-6 border-t border-gold-light/40 flex flex-col items-center gap-3">
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs text-slate hover:text-terracotta transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-slate hover:text-terracotta transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="text-xs text-slate text-center">
            &copy; {year} A Fish in the Kitchen. Made for your family with love and a pinch of salt.
          </p>
        </div>
      </div>
    </footer>
  );
}
