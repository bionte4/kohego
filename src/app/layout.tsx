import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
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
            <AppShell>{children}</AppShell>
          </StoreProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
