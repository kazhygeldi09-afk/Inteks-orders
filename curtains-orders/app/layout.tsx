import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.appName };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5c58",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang } = await getI18n();
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
