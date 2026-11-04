// Keep long-lived tabs current without doing background network work.
// Each subscriber owns its request and cancels it when its view unmounts.
export function startVisibleRefresh(refresh, {
  window: view = window,
  document: page = document,
  intervalMs = 60000
} = {}) {
  let stopped = false;
  let active = null;

  function run() {
    if (stopped || page.visibilityState === "hidden" || active) return;
    const request = new AbortController();
    active = request;
    Promise.resolve()
      .then(() => {
        if (!request.signal.aborted) return refresh(request.signal);
      })
      .catch(() => { /* A later refresh retries; keep the last good data. */ })
      .finally(() => {
        // Also stop sibling fetches if a grouped refresh rejected early.
        request.abort();
        if (active === request) active = null;
      });
  }

  page.addEventListener("visibilitychange", run);
  view.addEventListener("focus", run);
  view.addEventListener("online", run);
  const timer = view.setInterval(run, intervalMs);
  run();

  return () => {
    stopped = true;
    active?.abort();
    view.clearInterval(timer);
    page.removeEventListener("visibilitychange", run);
    view.removeEventListener("focus", run);
    view.removeEventListener("online", run);
  };
}

export async function fetchFreshJson(url, signal) {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);
  return response.json();
}

// Keep usable sources when another endpoint fails, and wait for every request
// before allowing the next refresh to start.
export function fetchFreshSources(urls, signal) {
  return Promise.allSettled(urls.map((url) => fetchFreshJson(url, signal)));
}
