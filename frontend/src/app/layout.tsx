import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calpen — IVR Penetration Testing",
  description:
    "Find where your phone system fails. Calpen runs automated IVR penetration tests—AI agents call every branch and map friction points so you can fix them.",
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
