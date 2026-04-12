import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-cream-dark border-t border-gold-light/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
          {/* Branding */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <div className="flex items-center gap-2.5">
              <svg
                viewBox="0 0 40 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-5 text-terracotta"
                aria-hidden="true"
              >
                <path
                  d="M2 14c2-4 6-8 12-8s8 2 12 4 6 3 10 2c-2 4-6 7-12 7s-8-2-12-4-6-2.5-10-1Z"
                  fill="currentColor"
                />
                <circle cx="10" cy="11" r="1.2" fill="white" />
                <path
                  d="M32 10c2-1 4-3 5-6-1 3-1 5-3 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="font-serif text-lg font-semibold text-charcoal">
                The Fish Kitchen
              </span>
            </div>
            <p className="text-sm text-slate italic">
              A Coppard & Fish Family Collection
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col items-center sm:items-end gap-3">
            <div className="flex items-center gap-6">
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
        <div className="mt-8 pt-6 border-t border-gold-light/40 text-center">
          <p className="text-xs text-slate">
            &copy; {year} The Fish Kitchen. Made with love and a pinch of salt.
          </p>
        </div>
      </div>
    </footer>
  );
}
