import assert from "node:assert/strict";
import { startVisibleRefresh, fetchFreshJson, fetchFreshSources } from "../lib/visibleRefresh.js";

class Page extends EventTarget {
  visibilityState = "visible";
}
class View extends EventTarget {
  timers = new Map();
  nextTimer = 0;
  setInterval(callback, delay) {
    assert.equal(delay, 60000);
    const id = ++this.nextTimer;
    this.timers.set(id, callback);
    return id;
  }
  clearInterval(id) { this.timers.delete(id); }
  tick() { for (const callback of this.timers.values()) callback(); }
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const fire = (target, type) => target.dispatchEvent(new Event(type));
function environment(visible = true) {
  const page = new Page();
  page.visibilityState = visible ? "visible" : "hidden";
  const view = new View();
  return { page, view, options: { window: view, document: page } };
}

// A long-lived visible tab gets fresh data, including after focus and reconnect.
{
  const { page, view, options } = environment();
  let calls = 0;
  let release;
  const stop = startVisibleRefresh(() => {
    calls++;
    return new Promise((resolve) => { release = resolve; });
  }, options);
  await settle();
  assert.equal(calls, 1, "visible mount refreshes immediately");
  view.tick();
  fire(view, "focus");
  fire(view, "online");
  fire(page, "visibilitychange");
  await settle();
  assert.equal(calls, 1, "pending requests never overlap");
  release();
  await settle();
  for (const trigger of [() => view.tick(), () => fire(view, "focus"), () => fire(view, "online")]) {
    trigger();
    await settle();
    release();
    await settle();
  }
  assert.equal(calls, 4, "poll, focus and reconnect each refresh");
  stop();
}

// Background tabs do no work and refresh when the visitor returns.
{
  const { page, view, options } = environment(false);
  let calls = 0;
  const stop = startVisibleRefresh(async () => { calls++; }, options);
  view.tick();
  fire(view, "focus");
  fire(view, "online");
  await settle();
  assert.equal(calls, 0, "no requests in a hidden tab, including mount");
  page.visibilityState = "visible";
  fire(page, "visibilitychange");
  await settle();
  assert.equal(calls, 1, "returning to the tab refreshes");
  page.visibilityState = "hidden";
  fire(page, "visibilitychange");
  view.tick();
  await settle();
  assert.equal(calls, 1, "hiding a tab starts no request");
  stop();
  assert.equal(view.timers.size, 0, "cleanup removes polling");
  page.visibilityState = "visible";
  fire(page, "visibilitychange");
  fire(view, "focus");
  fire(view, "online");
  await settle();
  assert.equal(calls, 1, "cleanup removes event subscriptions");
}

// Cleanup aborts fetches and also prevents work queued before unmount.
{
  const { view, options } = environment();
  let signal;
  const stop = startVisibleRefresh((currentSignal) => {
    signal = currentSignal;
    return new Promise((resolve) => currentSignal.addEventListener("abort", resolve, { once: true }));
  }, options);
  await settle();
  stop();
  assert.equal(signal.aborted, true, "unmount aborts the active request");
  assert.equal(view.timers.size, 0);
  await settle();
  let calls = 0;
  const stopBeforeStart = startVisibleRefresh(async () => { calls++; }, options);
  stopBeforeStart();
  await settle();
  assert.equal(calls, 0, "unmount before the callback prevents the request");
}

// A temporary failure keeps existing data and does not disable future refreshes.
{
  const { view, options } = environment();
  let data = "previous edition";
  let fail = true;
  const stop = startVisibleRefresh(async () => {
    if (fail) throw new Error("offline");
    data = "new edition";
  }, options);
  await settle();
  assert.equal(data, "previous edition");
  fail = false;
  fire(view, "online");
  await settle();
  assert.equal(data, "new edition", "refresh recovers after an error");
  stop();
}

// A failing source does not discard the other source or unlock pending requests.
{
  const originalFetch = globalThis.fetch;
  const { view, options } = environment();
  let calls = 0;
  let release;
  let results;
  try {
    globalThis.fetch = async (url) => {
      calls++;
      if (url === "/api/newsletter") return { ok: false, status: 503 };
      await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => ({ products: [{ name: "Available product" }] }) };
    };
    const stop = startVisibleRefresh(async (signal) => {
      results = await fetchFreshSources(["/api/newsletter", "/api/products"], signal);
    }, options);
    await settle();
    fire(view, "focus");
    view.tick();
    await settle();
    assert.equal(calls, 2, "an early HTTP error does not unlock the pending sibling request");
    assert.equal(results, undefined, "wait for all source requests to finish");
    release();
    await settle();
    assert.equal(results[0].status, "rejected");
    assert.equal(results[1].status, "fulfilled");
    assert.equal(results[1].value.products[0].name, "Available product", "partial success remains usable");
    stop();
    globalThis.fetch = async (url) => url === "/api/products"
      ? { ok: false, status: 503 }
      : { ok: true, json: async () => ({ newsletter: { date: "2026-11-04" } }) };
    const reverse = await fetchFreshSources(["/api/newsletter", "/api/products"], new AbortController().signal);
    assert.equal(reverse[0].value.newsletter.date, "2026-11-04", "fresh newsletter survives products failure");
    assert.equal(reverse[1].status, "rejected");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// The shared fetcher explicitly avoids stale browser cache and rejects HTTP errors.
{
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/newsletter");
      assert.equal(options.cache, "no-store");
      assert.equal(options.signal, controller.signal);
      return { ok: true, json: async () => ({ newsletter: { date: "2026-11-04" } }) };
    };
    assert.deepEqual(await fetchFreshJson("/api/newsletter", controller.signal), { newsletter: { date: "2026-11-04" } });
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => { throw new Error("must not parse"); } });
    await assert.rejects(fetchFreshJson("/api/newsletter", controller.signal), /503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log("PASS: visible polling, focus/reconnect, hidden-tab silence, no overlapping requests, cleanup/abort, recovery, partial source failures and fresh HTTP fetches.");
