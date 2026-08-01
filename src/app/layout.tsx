import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Francois_One, Inter } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import ContinueCooking from "@/components/ContinueCooking";
import ScrollToTop from "@/components/ScrollToTop";
import HouseholdStateGate from "@/components/HouseholdStateGate";
import EmailVerificationGate from "@/components/EmailVerificationGate";
import "./globals.css";

const francoisOne = Francois_One({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400", // Francois One ships a single weight
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#3D5A3E",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "A Fish in the Kitchen — The food your family is built on",
    template: "%s | A Fish in the Kitchen",
  },
  // Product positioning, not the pre-pivot personal-cookbook line — this is
  // what every Google result and pasted link shows. www is the canonical host
  // (apex 307s to it), so metadataBase must be www or og:image resolves
  // through a redirect some scrapers refuse to follow.
  description:
    "Your family's private cookbook app. Keep the recipes, stories, and cooks together — plan the week, cook hands-free, and pass it all down.",
  metadataBase: new URL("https://www.afishinthekitchen.com"),
  openGraph: {
    title: "A Fish in the Kitchen — The food your family is built on",
    description:
      "Your family's private cookbook app. Keep the recipes, stories, and cooks together — plan the week, cook hands-free, and pass it all down.",
    url: "https://www.afishinthekitchen.com",
    siteName: "A Fish in the Kitchen",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "A Fish in the Kitchen" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "A Fish in the Kitchen — The food your family is built on",
    description:
      "Your family's private cookbook app. Keep the recipes, stories, and cooks together — plan the week, cook hands-free, and pass it all down.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${francoisOne.variable} ${inter.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-charcoal font-sans">
        <Providers>
          <ScrollToTop />
          <EmailVerificationGate />
          <HouseholdStateGate />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ContinueCooking />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
