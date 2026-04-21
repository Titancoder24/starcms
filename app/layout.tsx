import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | StarCMS",
    default: "StarCMS — The SEO-first CMS",
  },
  description:
    "The CMS built to rank. Pre-publish guardrails, continuous auditing, and MCP-native AI integration.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
