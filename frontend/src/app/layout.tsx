import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giga - AI Agents for Enterprise Support",
  description:
    "Enterprises choose Giga for AI agents that manage complex workflows, deploy rapidly, and deliver human-like customer experiences at scale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
