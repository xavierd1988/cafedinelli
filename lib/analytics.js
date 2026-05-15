"use client";

const CORE_EVENTS = new Set([
  "page_view",
  "email_signup",
  "newsletter_submit",
  "counter_view",
  "counter_seat_click",
  "counter_message_submit",
  "shelf_product_click",
  "paper_open",
  "paper_scroll_75",
  "outbound_affiliate_click"
]);

function cleanValue(value) {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(cleanValue).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = cleanValue(item);
      if (cleaned !== undefined) out[key] = cleaned;
    });
    return out;
  }
  return String(value);
}

function cleanPayload(payload) {
  const out = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    const cleaned = cleanValue(value);
    if (cleaned !== undefined) out[key] = cleaned;
  });
  return out;
}

export function trackEvent(event, payload = {}) {
  if (typeof window === "undefined" || !event) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...cleanPayload(payload)
  });
  trackMetaBusinessEvent(event);

  if (process.env.NODE_ENV === "development" && !CORE_EVENTS.has(event)) {
    console.info(`[analytics] custom event: ${event}`);
  }
}

export function trackMetaEvent(method, eventName, payload) {
  if (typeof window === "undefined" || typeof window.fbq !== "function" || !method || !eventName) return;

  try {
    const cleanedPayload = cleanPayload(payload);
    const args = [method, eventName];
    if (Object.keys(cleanedPayload).length > 0) args.push(cleanedPayload);
    window.fbq(...args);
  } catch {
    /* Meta Pixel should never break site interactions. */
  }
}

function trackMetaBusinessEvent(event) {
  if (event === "email_signup") {
    trackMetaEvent("track", "Lead");
    return;
  }

  if (event === "paper_open") {
    trackMetaEvent("track", "ViewContent", {
      content_name: "Today's Paper",
      content_category: "Daily Paper"
    });
  }
}

export function trackPageView() {
  if (typeof window === "undefined") return;
  trackEvent("page_view", {
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_title: document.title
  });
}

export function getDestinationDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function trackAffiliateClick({ productId, productName, destinationUrl, source }) {
  trackEvent("outbound_affiliate_click", {
    product_id: productId || "",
    product_name: productName || "",
    destination_domain: getDestinationDomain(destinationUrl) || "amazon.com",
    source: source || ""
  });
}
