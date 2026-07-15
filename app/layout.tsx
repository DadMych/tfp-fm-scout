import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Source_Serif_4 } from "next/font/google";
import { DatasetProvider } from "@/lib/store";
import { AuthProvider } from "@/components/AuthProvider";
import { LocalMigrationPrompt } from "@/components/LocalMigrationPrompt";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Scouting Post — FM26 companion",
  description: "Upload your FM26 squad and shortlist; get scout-grade recommendations.",
  openGraph: {
    title: "The Scouting Post",
    description: "Upload your FM26 squad and shortlist; get scout-grade recommendations.",
    images: [{ url: "/art/og.png", width: 1200, height: 630, alt: "The Scouting Post" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Scouting Post",
    description: "Upload your FM26 squad and shortlist; get scout-grade recommendations.",
    images: ["/art/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <AuthProvider>
          <DatasetProvider>
            <LocalMigrationPrompt />
            {children}
          </DatasetProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
