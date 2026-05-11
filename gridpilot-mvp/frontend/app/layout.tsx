import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { MetaPixelPageView } from "@/components/MetaPixelPageView";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.joingridpilot.com");

export const metadata: Metadata = {
  title: "GridPilot",
  description: "Earn rewards automatically when your EV charging helps the grid.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "GridPilot",
    description: "Earn rewards automatically when your EV charging helps the grid.",
    url: siteUrl,
    siteName: "GridPilot",
    images: [
      {
        url: "/social-preview.png?v=2",
        width: 1024,
        height: 512,
        alt: "GridPilot",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GridPilot",
    description: "Earn rewards automatically when your EV charging helps the grid.",
    images: ["/social-preview.png?v=2"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '986647954101814');
fbq('track', 'PageView');`}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=986647954101814&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <MetaPixelPageView />
        {children}
      </body>
    </html>
  );
}