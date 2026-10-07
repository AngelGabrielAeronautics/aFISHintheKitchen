import type { Metadata } from "next";

// page.tsx is a client component (the FAQ search box), so its metadata has to
// live here. Without it the page inherited the root layout's title AND its
// canonical — telling Google /faq was a copy of the landing page.
export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Answers about A Fish in the Kitchen — invites, cookbooks, subscriptions, Cook Mode and the shopping list.",
  alternates: { canonical: "/faq" },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
