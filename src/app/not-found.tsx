import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-center">
      <div className="mx-auto max-w-md">
        {/* Fish icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-warm-white ring-1 ring-cream-dark/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-12 w-12 text-terracotta/60"
          >
            {/* Fish body */}
            <ellipse cx="30" cy="32" rx="18" ry="10" />
            {/* Fish tail */}
            <path d="M48 32l10-8v16z" />
            {/* Fish eye */}
            <circle cx="20" cy="30" r="2" fill="currentColor" stroke="none" />
            {/* Bubbles */}
            <circle cx="10" cy="20" r="1.5" />
            <circle cx="6" cy="14" r="1" />
          </svg>
        </div>

        <h1 className="mt-8 font-serif text-4xl font-bold text-charcoal">
          404
        </h1>

        <p className="mt-4 font-serif text-xl font-semibold text-charcoal">
          Something fishy going on...
        </p>

        <p className="mt-2 font-sans text-base text-slate">
          Looks like this recipe got lost in the pantry. The page you are looking
          for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3 font-sans text-sm font-medium text-white shadow-sm transition-colors hover:bg-terracotta-dark"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
                clipRule="evenodd"
              />
            </svg>
            Go home
          </Link>
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 rounded-full bg-warm-white px-6 py-3 font-sans text-sm font-medium text-charcoal ring-1 ring-cream-dark/40 transition-colors hover:bg-cream-dark/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M6 4.75A.75.75 0 0 1 6.75 4h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 4.75ZM6 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 10Zm0 5.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H6.75a.75.75 0 0 1-.75-.75ZM1.99 4.75a1 1 0 0 1 1-1H3a1 1 0 0 1 1 1v.01a1 1 0 0 1-1 1h-.01a1 1 0 0 1-1-1v-.01ZM1.99 10a1 1 0 0 1 1-1H3a1 1 0 0 1 1 1v.01a1 1 0 0 1-1 1h-.01a1 1 0 0 1-1-1V10ZM1.99 15.25a1 1 0 0 1 1-1H3a1 1 0 0 1 1 1v.01a1 1 0 0 1-1 1h-.01a1 1 0 0 1-1-1v-.01Z"
                clipRule="evenodd"
              />
            </svg>
            Browse recipes
          </Link>
        </div>
      </div>
    </main>
  );
}
