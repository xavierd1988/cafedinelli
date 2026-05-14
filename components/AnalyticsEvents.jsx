"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "../lib/analytics.js";

export default function AnalyticsEvents() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  return null;
}
