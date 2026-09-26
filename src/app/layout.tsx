import type { Metadata } from "next";
import { IBM_Plex_Sans_JP } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_JP({
  variable: "--font-plex",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Image Editor",
  description: "シンプルな画像編集ツール。黒一色のPNGを、選んだ色に塗り替えます。",
  // An internal tool: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={plex.variable}>
      <body>{children}</body>
    </html>
  );
}
