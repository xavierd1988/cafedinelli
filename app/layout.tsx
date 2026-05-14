import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import AnalyticsEvents from "@/components/AnalyticsEvents";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dinelliscafe.com"),
  title: "Dinelli's Café — The internet, freshly stocked every morning.",
  description:
    "A cinematic morning internet café for reading what matters online in five minutes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0606"
};

function getGtmId() {
  const id = process.env.GTM_ID || "";
  return /^GTM-[A-Z0-9]+$/i.test(id) ? id : "";
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const gtmId = getGtmId();

  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://www.dinelliscafe.com/" />
        {gtmId && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':` +
                `new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],` +
                `j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=` +
                `'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);` +
                `})(window,document,'script','dataLayer','${gtmId}');`
            }}
          />
        )}
      </head>
      <body>
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        )}
        <AnalyticsEvents />
        {children}
      </body>
    </html>
  );
}
