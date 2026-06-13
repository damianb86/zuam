import type { Metadata, Viewport } from "next";
import { ChatWidget } from "@/components/ChatWidget";
import "./globals.css";

const siteUrl = "https://zuam.com";
const metadataTitle = "Zuam — Custom Shopify Apps & AI-Powered Commerce Systems";
const metadataDescription =
  "Founder-led technical studio building custom Shopify apps, Shopify integrations, AI-powered commerce workflows and web systems for merchants, Shopify Plus stores and agencies.";
const openGraphDescription =
  "Custom Shopify apps, commerce engineering, AI workflows and integrations built with senior founder-led execution.";
const twitterDescription =
  "Founder-led Shopify and Applied AI studio building custom apps, integrations and production-ready commerce systems.";

const themeInitScript = `
(function () {
  try {
    window.localStorage && window.localStorage.removeItem("zuam-theme");
  } catch (error) {}

  try {
    var theme = "light";

    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch (error) {}
})();
`;

const googleTagManagerScript = `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-M5G2BNTX');
`;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Zuam",
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      description:
        "Founder-led technical studio building custom Shopify apps, Shopify integrations, AI-powered commerce workflows and web systems."
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Zuam",
      description:
        "Founder-led technical studio building custom Shopify apps, Shopify integrations, AI-powered commerce workflows and web systems.",
      publisher: {
        "@id": `${siteUrl}/#organization`
      }
    }
  ]
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: metadataTitle,
  description: metadataDescription,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: metadataTitle,
    description: openGraphDescription,
    url: siteUrl,
    siteName: "Zuam",
    images: [
      {
        url: "/logo.png",
        width: 1254,
        height: 1254,
        alt: "Zuam logo"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: metadataTitle,
    description: twitterDescription,
    images: ["/logo.png"]
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#172A38" }
  ],
  colorScheme: "light dark",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: googleTagManagerScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
          }}
        />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M5G2BNTX"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
