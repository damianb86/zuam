import type { Metadata, Viewport } from "next";
import { ChatWidget } from "@/components/ChatWidget";
import "./globals.css";

const themeInitScript = `
(function () {
  var storedTheme;

  try {
    storedTheme = window.localStorage && window.localStorage.getItem("zuam-theme");
  } catch (error) {}

  try {
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : prefersDark
        ? "dark"
        : "light";

    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch (error) {}
})();
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
    { media: "(prefers-color-scheme: light)", color: "#FAFAFF" },
    { media: "(prefers-color-scheme: dark)", color: "#071226" }
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
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
