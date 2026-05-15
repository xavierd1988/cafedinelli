"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackGoogleAdsTrafficLanding, trackPageView } from "../lib/analytics.js";

export default function AnalyticsEvents() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView();
    trackGoogleAdsTrafficLanding();
  }, [pathname]);

  return null;
}
