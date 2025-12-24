import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gangneung Dart Game",
  description: "Gangneung Dart Game",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
