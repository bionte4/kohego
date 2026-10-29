import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AuthGate } from "@/components/access/auth-gate";
import { RoleProvider } from "@/components/access/role-provider";
import { StoreProvider } from "@/components/providers/store-provider";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "Dasbor",
    template: "%s · Kohego",
  },
  description:
    "Dasbor penjualan dan distribusi pupuk organik — kohe kambing, sapi, ayam, dan POC — untuk tim lapangan dan manajemen.",
  applicationName: "Kohego",
  appleWebApp: {
    capable: true,
    title: "Kohego",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper font-sans text-ink">
        <RoleProvider>
          <StoreProvider>
            <Suspense fallback={<p className="px-6 py-16 text-sm text-slate-500">Memeriksa sesi...</p>}>
              <AuthGate>{children}</AuthGate>
            </Suspense>
          </StoreProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
