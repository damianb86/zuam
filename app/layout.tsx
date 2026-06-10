import type { Metadata, Viewport } from "next";
import { ChatWidget } from "@/components/ChatWidget";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://zuam.com"),
  title: "Zuam - Software, Shopify and applied AI",
  description:
    "Senior Shopify app development, custom software, performance, conversion, SEO, and applied artificial intelligence for digital businesses.",
  openGraph: {
    title: "Zuam - Software, Shopify and applied AI",
    description:
      "Senior Shopify app development, custom software, performance, conversion, SEO, and applied artificial intelligence for digital businesses.",
    url: "https://zuam.com",
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
    title: "Zuam - Software, Shopify and applied AI",
    description:
      "Senior Shopify app development, custom software, performance, conversion, SEO, and applied artificial intelligence for digital businesses.",
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
