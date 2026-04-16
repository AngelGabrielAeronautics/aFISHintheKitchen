"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/Avatar";
import NotificationBell from "@/components/NotificationBell";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/submit", label: "Add Recipe" },
];

const moreLinks = [
  { href: "/meal-planner", label: "Meal Planner" },
  { href: "/shopping-list", label: "Shopping List" },
  { href: "/collections", label: "Collections" },
  { href: "/tips", label: "Tips & Tricks" },
  { href: "/members", label: "The Family" },
];

const allLinks = [...primaryLinks, ...moreLinks];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };


  return (
    <header className="sticky top-0 z-50 bg-warm-white/50 backdrop-blur-md border-b border-gold-light/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/logo.png"
              alt="A Fish in the Kitchen"
              width={44}
              height={44}
              className="h-11 w-11 rounded-full"
            />
            <div className="flex flex-col">
              <span className="font-serif text-xl sm:text-2xl font-semibold text-charcoal leading-tight tracking-tight">
                A Fish in the Kitchen
              </span>
              <span className="hidden sm:block font-sans text-xs text-slate italic leading-tight">
                Family Recipes Worth Catching
              </span>
            </div>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {primaryLinks.map((link) => (
              link.href === "/" && pathname === "/" ? null : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-terracotta bg-terracotta/8"
                      : "text-slate hover:text-charcoal hover:bg-cream-dark/60"
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}

            {/* More dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  moreOpen || moreLinks.some((l) => isActive(l.href))
                    ? "text-terracotta bg-terracotta/8"
                    : "text-slate hover:text-charcoal hover:bg-cream-dark/60"
                }`}
              >
                More
                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}>
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl bg-white py-2 shadow-lg ring-1 ring-charcoal/10">
                    {moreLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMoreOpen(false)}
                        className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                          isActive(link.href)
                            ? "text-terracotta bg-terracotta/5"
                            : "text-slate hover:text-charcoal hover:bg-cream-dark/40"
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Auth button */}
            {!loading && (
              <>
                {user ? (
                  <div className="ml-2 pl-3 border-l border-gold-light flex items-center gap-1">
                    <NotificationBell />
                    <Link href="/account" className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-cream-dark/60">
                      <Avatar name={user.displayName || user.email || "?"} size="sm" ring />
                      <span className="text-xs text-slate">
                        {user.displayName || user.email}
                      </span>
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/auth"
                    className={`ml-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive("/auth")
                        ? "text-terracotta bg-terracotta/8"
                        : "bg-terracotta text-white hover:bg-terracotta-dark"
                    }`}
                  >
                    Sign In
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 -mr-2 rounded-lg text-slate hover:text-charcoal hover:bg-cream-dark/60 transition-colors"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="w-6 h-6"
              aria-hidden="true"
            >
              {menuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="md:hidden border-t border-gold-light/60 bg-warm-white max-h-[calc(100vh-5rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "text-terracotta bg-terracotta/8"
                    : "text-slate hover:text-charcoal hover:bg-cream-dark/60"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile auth */}
            {!loading && (
              <div className="mt-2 pt-2 border-t border-gold-light/60">
                {user ? (
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:bg-cream-dark/60"
                  >
                    <Avatar name={user.displayName || user.email || "?"} size="sm" ring />
                    <p className="text-xs text-slate">
                      {user.displayName || user.email}
                    </p>
                  </Link>
                ) : (
                  <Link
                    href="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 rounded-lg text-sm font-medium text-terracotta hover:bg-terracotta/8 transition-colors"
                  >
                    Sign In / Sign Up
                  </Link>
                )}
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
