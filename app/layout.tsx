import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RyuLearn - Master English Vocabulary The Smart Way",
  description: "Learn English vocabulary through gamification, spaced repetition, and adaptive learning. Practice vocabulary with interactive lessons, earn XP, and track your progress.",
  keywords: "English vocabulary, learn English, vocabulary learning app, spaced repetition, language learning, English learning game",
  authors: [{ name: "RyuLearn" }],
  creator: "RyuLearn",
  metadataBase: new URL("https://ryulearn.vercel.app"),
  alternates: {
    canonical: "https://ryulearn.vercel.app",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ryulearn.vercel.app",
    siteName: "RyuLearn",
    title: "RyuLearn - Master English Vocabulary The Smart Way",
    description: "Learn English vocabulary through gamification, spaced repetition, and adaptive learning. Join thousands of learners!",
    images: [
      {
        url: "/R Icon No BG.png",
        width: 200,
        height: 200,
        alt: "RyuLearn - English Vocabulary Learning",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RyuLearn - Master English Vocabulary",
    description: "Learn English vocabulary with gamification and spaced repetition",
    images: ["/R Icon No BG.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: "/R Icon No BG.png",
    apple: "/R Icon No BG.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${poppins.variable} font-sans antialiased`}
        style={{ fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
