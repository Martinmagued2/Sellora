import "./globals.css";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const metadata = {
  title: "Sellora — Automate Your WhatsApp, Instagram & Facebook Sales",
  description:
    "The #1 platform for automating WhatsApp, Instagram, and Facebook business messaging. AI auto-replies, product catalogs, order management, and customer CRM — all in one dashboard.",
  keywords:
    "WhatsApp business automation, Instagram selling, Facebook Messenger, social commerce, order management, AI auto-reply, Sellora",
  openGraph: {
    title: "Sellora — Automate Your WhatsApp, Instagram & Facebook Sales",
    description:
      "Turn your WhatsApp, Instagram & Facebook DMs into a sales machine. AI-powered replies, product catalog, order tracking, and CRM.",
    type: "website",
    locale: "en_US",
    siteName: "Sellora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sellora — Automate Your WhatsApp, Instagram & Facebook Sales",
    description:
      "Turn your WhatsApp, Instagram & Facebook DMs into a sales machine.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6c5ce7" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-touch-icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Cairo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
