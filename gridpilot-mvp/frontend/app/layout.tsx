import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GridPilot",
  description: "Earn rewards automatically when your EV charging helps the grid.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}