# Dinelli's Café — Daily Scrape Pipeline

This doc describes how the storefront, Google trends popup, YouTube popup, and X tweets popup get their content every morning. Read this whenever something looks stale on the site, or before changing anything in `/api/cron/*` or in `~/pixoo-dashboard/scrape_*.py` on **eye**.

---

## Big picture

The site has **three independent data sources** that all need to be aligned each morning:

1. **The newsletter HTML** — the source of truth. Published in Redis under `newsletter:latest`.
2. **The daily products store** — Redis `cafe:products:daily`. 30 products with `{name, search, image, price, asin, emoji}`. The vitrine matches its display rows against the **names** in this store.
3. **The trend caches** — Redis `cafe:google:news:daily`, `cafe:youtube:daily`, `cafe:x:tweets:daily`. Pre-fetched popup content (latency ≈ 0 at click time).

When everything is aligned, all four popups (Amazon highlight, Google News, YouTube, X) open instantly and the storefront shows the right images.

---

## Timing (Eastern time)

```
09:00 EDT  /api/cron/generate-products fires on Vercel (cron 13:00 UTC)
           ─ reads newsletter from Redis
           ─ EXTRACTS the 30 Amazon names directly from the newsletter HTML
             (sections AMAZON BEST SELLERS + AMAZON MOVERS & SHAKERS)
           ─ if newsletter is missing or has no AMAZON section, falls back
             to Groq hallucination — names may not match the visible newsletter
           ─ tries to scrape Amazon from Vercel IP → usually blocked,
             so withImage=0 most of the time
           ─ saves to Redis (skipped if <5 images AND no ?force=1)

09:15 EDT  scrape_morning.py on eye (LaunchAgent)
           ─ retries newsletter fetch up to 3× with 60s between (Vercel
             may still be deploying)
           ─ scrapes Amazon from residential IP — much higher success
           ─ POSTS to /api/cron/update-products → REPLACES the store

09:17 EDT  scrape_google.py on eye → fills cafe:google:news:daily
09:18 EDT  scrape_youtube.py on eye → fills cafe:youtube:daily
09:20 EDT  scrape_x.py on eye → fills cafe:x:tweets:daily (needs
           x_storage_state.json with logged-in cookies)

10:00, 10:15, 10:30, 10:45, 11:00 EDT
           scrape_retry on eye — re-scrapes products that have no image
           (Amazon sometimes 503s on first try)

11:32 EDT  Claude scheduled task — reports on the morning's state
```

---

## Why this exact order matters

- **`generate-products` (Vercel) before `scrape_morning` (eye)** : Vercel writes the initial product list. Eye then **overwrites** with images. If eye ran first, there'd be nothing to enrich.
- **`scrape_morning` is the source of truth for names** : Vercel falls back to Groq hallucination when the newsletter is missing, which produces names that won't match the visible newsletter. Eye's script always extracts the real names from the newsletter HTML, then POSTs them back, replacing the Groq output.
- **15-min margin between Vercel cron (09:00) and eye scrape (09:15)** : the Vercel cron writes to Redis and the new deployment, plus Edge/CDN warmup, can take a few minutes. The 3× retry inside the Python scripts (60s between) covers the rest.

---

## What broke on May 14, 2026 (post-mortem)

**Symptom:** storefront half-empty most of the morning, then images appeared but didn't match the newsletter products (e.g. newsletter said "Apple AirPods Pro 3" but the case showed "Smart TV").

**Cause chain:**
1. The newsletter for May 14 was never ingested into `newsletter:latest`. Redis still held the May 13 edition.
2. The Vercel cron at 09:00 EDT used the May 13 newsletter as input to Groq.
3. Groq **hallucinated** 30 products ("Smart TV", "NBA Basketball", "News Journal"…) instead of using the 30 real Amazon items listed in the newsletter's `AMAZON BEST SELLERS` / `MOVERS & SHAKERS` sections.
4. Eye's `scrape_morning` at 09:05 EDT failed because `/api/newsletter` was momentarily returning HTML (Vercel was finishing a deploy I had just pushed).
5. A later retry succeeded but only **enriched the Groq-hallucinated names** with images — those names still didn't match the newsletter HTML rendered in the browser. Cases stayed empty.

**Fixes applied:**
- `/api/cron/generate-products` now **extracts names directly from the newsletter** HTML (first), and only falls back to Groq if there's no AMAZON section. Same logic as `scrape_morning.py`.
- `scrape_morning.py`, `scrape_google.py`, `scrape_youtube.py` now **retry the newsletter fetch 3×** with 60s between attempts, instead of failing on the first error.
- Eye LaunchAgents moved from 09:05/07/08/10 to **09:15/17/18/20** — 15 min margin after the Vercel cron.

---

## Manual recovery — when the morning didn't run

If you wake up and the storefront is empty / mismatched, do this:

```bash
# 1. Force regenerate the product list from the latest newsletter
ssh eye 'source ~/pixoo-dashboard/.env && curl -s -X GET \
  "https://cafedinelli.vercel.app/api/cron/generate-products?force=1" \
  -H "Authorization: Bearer $CRON_SECRET" -m 120'

# 2. Wait ~60s, then run the eye scrapes manually (in parallel)
ssh eye 'cd ~/pixoo-dashboard && \
  .venv/bin/python3 scrape_morning.py > /tmp/sm.log 2>&1 &
  .venv/bin/python3 scrape_google.py > /tmp/sg.log 2>&1 &
  .venv/bin/python3 scrape_youtube.py > /tmp/sy.log 2>&1 &
  wait
  tail -5 /tmp/sm.log /tmp/sg.log /tmp/sy.log'

# 3. Hard-refresh the site (Cmd+Shift+R)
```

scrape_morning takes ~10 min, the others ~2-3 min.

---

## Files & cron table

### On Vercel (web app)
| File | Role |
|---|---|
| `vercel.json` | Defines the daily cron at `0 13 * * *` UTC |
| `/api/cron/generate-products` | Daily product list generator (newsletter-extract first, Groq fallback) |
| `/api/cron/update-products` | Eye POSTs the enriched product list here (Bearer auth) |
| `/api/cron/update-google-news` | Eye POSTs the 25 Google trend articles |
| `/api/cron/update-youtube` | Eye POSTs the 15 YouTube videos |
| `/api/cron/update-x-tweets` | Eye POSTs the 15 X trend tweets |
| `/api/products` | Read endpoint for the storefront |
| `/api/google-news` | Read endpoint for the Google popup (cache → live RSS fallback) |
| `/api/youtube-search` | Read endpoint for the YouTube popup (cache → live scrape fallback) |
| `/api/x-tweets` | Read endpoint for the X popup (cache → "Open on X" button fallback) |
| `/api/newsletter` | Read+write for the newsletter HTML (POST requires NEWSLETTER_SECRET) |

### On eye (~/pixoo-dashboard)
| File | LaunchAgent | Schedule |
|---|---|---|
| `scrape_morning.py` | `com.dinellis.scrape-morning` | 09:15 EDT |
| `scrape_google.py` | `com.dinellis.scrape-google` | 09:17 EDT |
| `scrape_youtube.py` | `com.dinellis.scrape-youtube` | 09:18 EDT |
| `scrape_x.py` | `com.dinellis.scrape-x` | 09:20 EDT |
| `scrape_retry.py` | `com.dinellis.scrape-retry-1000` etc. | 10:00, 10:15, 10:30, 10:45, 11:00 EDT |
| `dashboard.py` | `com.dinellis.pixoo-dashboard` | KeepAlive 24/7 |

LaunchAgent plists live in `~/Library/LaunchAgents/com.dinellis.*.plist`. Reload after editing:
```bash
launchctl unload ~/Library/LaunchAgents/com.dinellis.<name>.plist
launchctl load   ~/Library/LaunchAgents/com.dinellis.<name>.plist
```

### Secrets

- `CRON_SECRET` — Bearer used by eye → Vercel POSTs. Stored in `~/pixoo-dashboard/.env` on eye and as an env var on Vercel.
- `NEWSLETTER_SECRET` — used by whatever forwards the daily email to `/api/newsletter` POST. **Check this if the newsletter date is stale.**
- `X_USER`, `X_PASS`, `X_HANDLE` — used by `scrape_x.py --login-auto` if you want to relog. Currently the script uses cookies in `x_storage_state.json` (Playwright session).
