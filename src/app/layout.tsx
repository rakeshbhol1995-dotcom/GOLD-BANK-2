import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#080B11"
};

export const metadata: Metadata = {
  title: "Virtual Gold Protocol ($GOLD) — Sovereign L1 Digital Gold Reserve & P2P Marketplace",
  description: "Virtual Gold Protocol ($GOLD) is the world's first mathematically verified, zero-rug-pull digital gold reserve on Solana L1. Features automated bonding curve floor price, P2P UPI/Bank fiat merchants, 1% USDT staking dividends, and 100% on-chain non-custodial vault transparency.",
  keywords: [
    "Virtual Gold",
    "$GOLD",
    "Digital Gold Token",
    "P2P Gold Marketplace",
    "Buy Gold via UPI",
    "Sell Gold for Cash INR",
    "Solana Gold Smart Contract",
    "Bonding Curve Floor Price",
    "Zero Rug Pull Crypto",
    "Post Quantum Gold Vault"
  ],
  authors: [{ name: "Virtual Gold Protocol Foundation", url: "https://virtualgold.org" }],
  creator: "Virtual Gold Protocol Foundation",
  publisher: "Virtual Gold Protocol Foundation",
  metadataBase: new URL("https://virtualgold.org"),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Virtual Gold Protocol ($GOLD) — Sovereign L1 Digital Gold Reserve",
    description: "Mathematically verified 1 Gram Gold reserve backed by automated bonding curve, 100% on-chain SOL/USDT vault, P2P UPI merchants, and 1% lifetime USDT dividends.",
    url: "https://virtualgold.org",
    siteName: "Virtual Gold Protocol",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Virtual Gold Protocol ($GOLD) Sovereign Reserve"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual Gold Protocol ($GOLD) — Sovereign L1 Reserve",
    description: "Mathematically verified 1 Gram Gold token on Solana L1 with 0% rug-pull risk, P2P UPI cash merchants, and 1% USDT dividends.",
    creator: "@virtualgold_org"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "name": "Virtual Gold Protocol ($GOLD)",
    "description": "Sovereign L1 Digital Gold Reserve backed by automated bonding curve & non-custodial SOL/USDT vault.",
    "url": "https://virtualgold.org",
    "category": "Digital Asset / Gold Token",
    "offers": {
      "@type": "Offer",
      "price": "10.00",
      "priceCurrency": "USD",
      "eligibleQuantity": {
        "@type": "QuantitativeValue",
        "value": 1,
        "unitCode": "GRM"
      }
    }
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#080B11] text-zinc-100 selection:bg-yellow-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
