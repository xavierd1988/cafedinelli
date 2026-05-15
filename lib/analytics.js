"use client";

const CORE_EVENTS = new Set([
  "page_view",
  "paid_landing",
  "email_signup",
  "newsletter_submit",
  "counter_view",
  "counter_seat_click",
  "seat_taken",
  "counter_message_submit",
  "shelf_product_click",
  "paper_view",
  "paper_open",
  "paper_scroll_75",
  "scroll_depth",
  "paper_toggle",
  "shelf_view",
  "amazon_product_click",
  "product_hover",
  "cafe_scene_hover",
  "counter_hover",
  "outbound_affiliate_click"
]);

const TRAFFIC_CONTEXT_KEY = "dinellis_traffic_context";
const TRACKED_ONCE = new Set();
let paidLandingTracked = false;

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

function getPageContext() {
  if (typeof window === "undefined") return {};
  return {
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_title: document.title
  };
}

function getTrafficParamsFromUrl() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return cleanPayload({
    traffic_source: params.get("utm_source") || "",
    traffic_medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
    gclid: params.get("gclid") || ""
  });
}

function hasTrafficContext(context) {
  return Object.values(context || {}).some((value) => value !== "");
}

function readStoredTrafficContext() {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage?.getItem(TRAFFIC_CONTEXT_KEY);
    return stored ? cleanPayload(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

function storeTrafficContext(context) {
  if (typeof window === "undefined" || !hasTrafficContext(context)) return;
  try {
    window.sessionStorage?.setItem(TRAFFIC_CONTEXT_KEY, JSON.stringify(cleanPayload(context)));
  } catch {
    /* Traffic context is helpful, never required. */
  }
}

function getTrafficContext() {
  const current = getTrafficParamsFromUrl();
  if (hasTrafficContext(current)) {
    storeTrafficContext(current);
    return current;
  }
  return readStoredTrafficContext();
}

function buildEventPayload(payload = {}) {
  return cleanPayload({
    ...getPageContext(),
    ...getTrafficContext(),
    ...payload
  });
}

function pushDataLayerEvent(event, payload) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event,
      ...cleanPayload(payload)
    });
  } catch {
    /* Analytics should never block the cafe. */
  }
}

function trackGtagEvent(event, payload) {
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("event", event, cleanPayload(payload));
  } catch {
    /* Ignore blocked or unavailable GA4. */
  }
}

function trackOnce(key, fn) {
  if (TRACKED_ONCE.has(key)) return;
  TRACKED_ONCE.add(key);
  fn();
}

export function trackEvent(event, payload = {}, options = {}) {
  if (typeof window === "undefined" || !event) return;
  const cleanedPayload = cleanPayload(payload);
  pushDataLayerEvent(event, cleanedPayload);
  if (options.ga4 !== false) trackGtagEvent(event, cleanedPayload);
  if (options.meta !== false) trackMetaBusinessEvent(event, cleanedPayload);

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

  if (event === "seat_taken") {
    trackMetaEvent("trackCustom", "SeatTaken");
    return;
  }

  if (event === "paper_view") {
    trackMetaEvent("track", "ViewContent", {
      content_name: "Today's Paper",
      content_category: "Daily Paper"
    });
    return;
  }

  if (event === "shelf_view") {
    trackMetaEvent("track", "ViewContent", {
      content_name: "On the Shelf",
      content_category: "Shelf"
    });
  }
}

export function trackPageView() {
  if (typeof window === "undefined") return;
  trackEvent("page_view", buildEventPayload());
}

export function trackGoogleAdsTrafficLanding() {
  if (typeof window === "undefined" || paidLandingTracked) return;
  const trafficContext = getTrafficParamsFromUrl();
  if (!hasTrafficContext(trafficContext)) return;
  paidLandingTracked = true;
  storeTrafficContext(trafficContext);
  trackEvent("paid_landing", {
    ...getPageContext(),
    ...trafficContext
  });
}

export function trackSeatTaken({ seatId, source = "counter" } = {}) {
  // Google Ads conversion tags belong in GTM once Google Ads provides a real
  // Conversion ID and Conversion Label. Trigger them from this seat_taken event.
  trackEvent("seat_taken", buildEventPayload({
    event_category: "counter",
    event_label: "SeatTaken",
    value: 1,
    seat_id: seatId || "",
    source
  }));
}

export function trackPaperView({ source = "paper_panel" } = {}) {
  trackOnce("paper_view", () => {
    trackEvent("paper_view", buildEventPayload({
      event_category: "content",
      event_label: "Today's Paper",
      source
    }));
    trackEvent("paper_open", buildEventPayload({
      source,
      legacy_event: "paper_view"
    }), { ga4: false, meta: false });
  });
}

export function trackShelfView({ source = "left_building_shelf" } = {}) {
  trackOnce("shelf_view", () => {
    trackEvent("shelf_view", buildEventPayload({
      event_category: "content",
      event_label: "On the Shelf",
      source
    }));
  });
}

export function trackScrollDepth({ percent, source = "paper_panel" } = {}) {
  const scrollPercent = Number(percent);
  if (![25, 50, 75, 90].includes(scrollPercent)) return;
  trackOnce(`scroll_depth:${source}:${scrollPercent}`, () => {
    trackEvent("scroll_depth", buildEventPayload({
      scroll_percent: scrollPercent,
      event_category: "engagement",
      event_label: "Paper Scroll",
      source
    }));
  });
}

export function trackPaperToggle({ state, source = "paper_toggle" } = {}) {
  if (state !== "open" && state !== "closed") return;
  trackEvent("paper_toggle", buildEventPayload({
    event_category: "paper",
    event_label: "Paper Toggle",
    state,
    source
  }));
}

export function trackAmazonProductClick({
  productName,
  productPosition,
  productLabel,
  productUrl,
  editionDate,
  source = "left_building_shelf"
} = {}) {
  trackEvent("amazon_product_click", buildEventPayload({
    event_category: "shelf",
    product_name: productName || "",
    product_position: productPosition || "",
    product_label: productLabel || "",
    product_url: productUrl || "",
    edition_date: editionDate || "",
    source
  }));
}

export function trackProductHover({
  productName,
  productPosition,
  productLabel,
  source = "left_building_shelf"
} = {}) {
  const key = `product_hover:${source}:${productPosition || productName || "unknown"}`;
  trackOnce(key, () => {
    trackEvent("product_hover", buildEventPayload({
      event_category: "shelf",
      product_name: productName || "",
      product_position: productPosition || "",
      product_label: productLabel || "",
      source
    }));
  });
}

export function trackCafeSceneHover({ source = "scene_stage" } = {}) {
  trackOnce("cafe_scene_hover", () => {
    trackEvent("cafe_scene_hover", buildEventPayload({
      event_category: "scene",
      event_label: "Cafe Scene Hover",
      source
    }));
  });
}

export function trackCounterHover({ source = "counter" } = {}) {
  trackOnce("counter_hover", () => {
    trackEvent("counter_hover", buildEventPayload({
      event_category: "counter",
      event_label: "Counter Hover",
      source
    }));
  });
}

export function trackNewsletterSubmit({ source = "receipt" } = {}) {
  const payload = buildEventPayload({
    event_category: "newsletter",
    event_label: "Newsletter Submit",
    source
  });
  trackEvent("newsletter_submit", payload);
  trackEvent("email_signup", {
    ...payload,
    legacy_event: "newsletter_submit"
  }, { ga4: false });
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
