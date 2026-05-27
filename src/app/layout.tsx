import type { Metadata, Viewport } from "next";
import { Francois_One, Inter } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import ContinueCooking from "@/components/ContinueCooking";
import ScrollToTop from "@/components/ScrollToTop";
import HouseholdStateGate from "@/components/HouseholdStateGate";
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
    default: "A Fish in the Kitchen — Family Recipes Worth Catching",
    template: "%s | A Fish in the Kitchen",
  },
  description:
    "A Coppard & Fish family cookbook — our best recipes, passed down and shared with love.",
  metadataBase: new URL("https://afishinthekitchen.com"),
  openGraph: {
    title: "A Fish in the Kitchen",
    description: "A Coppard & Fish family cookbook — our best recipes, passed down and shared with love.",
    url: "https://afishinthekitchen.com",
    siteName: "A Fish in the Kitchen",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "A Fish in the Kitchen" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "A Fish in the Kitchen",
    description: "A Coppard & Fish family cookbook — our best recipes, passed down and shared with love.",
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
      className={`${francoisOne.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-charcoal font-sans">
        <Providers>
          <ScrollToTop />
          <HouseholdStateGate />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ContinueCooking />
        </Providers>
      </body>
    </html>
  );
}
