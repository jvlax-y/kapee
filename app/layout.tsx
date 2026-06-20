import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jogja Cafe Finder",
  description:
    "Platform pencarian cafe terlengkap untuk mahasiswa Jogja. Filter berdasarkan WiFi, colokan, suasana, harga, dan kampus terdekat.",
  keywords: [
    "cafe jogja", "coffee shop yogyakarta", "wfc jogja",
    "cafe dekat ugm", "cafe dekat upn", "ngopi jogja",
    "cafe aesthetic jogja", "cafe murah jogja",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#a3630f" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
