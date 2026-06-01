import type { Metadata, Viewport } from "next";
import { ChatWidget } from "@/components/ChatWidget";
import "./globals.css";

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
  themeColor: "#FAFAFF",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
