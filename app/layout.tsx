import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TT - Track token frequency",
  description: "Track token frequency over 15 minutes",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/tt.png",
        type: "image/png",
      },
      {
        url: "/tt.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/tt.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <QueryProvider>
          {children}
          <Toaster />
          <Analytics />
        </QueryProvider>
      </body>
    </html>
  );
}
