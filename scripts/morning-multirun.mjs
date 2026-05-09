#!/usr/bin/env node
// =============================================================================
// MORNING MULTI-RUN — orchestre N runs de scrape Amazon, un par endpoint VPN
// =============================================================================
// Usage :
//   node scripts/morning-multirun.mjs            # 4 runs, semi-auto (prompts)
//   node scripts/morning-multirun.mjs --runs 6   # 6 runs
//   node scripts/morning-multirun.mjs --auto     # pas de prompt entre runs
//                                                  (utile si tu as un CLI VPN
//                                                  qui rotate tout seul)
//   node scripts/morning-multirun.mjs --base http://localhost:3000
//
// Pré-requis :
//   - `npm run dev` doit tourner sur localhost:3000 (ou passe --base)
//   - Si first run du jour : un /api/cron/generate-products?force=1 pour
//     remplir la cache. Le script le fait tout seul si la cache est vide.
//
// Comportement :
//   - Run 1 : tente tout (mode all=1). Affiche les stats.
//   - Run 2..N : ne re-scrape QUE les misses (chaque run grignote ce qu'il
//     reste). Entre 2 runs, prompt "switch endpoint VPN puis Enter".
//   - Final : récap des hits par run + total.
// =============================================================================

import readline from "node:readline";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { runs: 4, auto: false, base: "http://localhost:3000" };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--runs") out.runs = Number(args[++i]) || 4;
    else if (a === "--auto") out.auto = true;
    else if (a === "--base") out.base = args[++i];
  }
  return out;
}

async function fetchJson(url, { timeout = 90_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { _raw: text }; }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function getPublicIp() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://api.ipify.org", { signal: ctrl.signal });
    clearTimeout(t);
    return await res.text();
  } catch {
    return "unknown";
  }
}

function pad(n, w = 2) { return String(n).padStart(w, " "); }

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

function fmtPct(num, total) {
  if (!total) return "—";
  return `${Math.round((num / total) * 100)}%`;
}

async function ensureCacheExists(base) {
  // /api/products renvoie ce qui est en cache (ou le POOL fallback). On
  // veut s'assurer qu'il y a 30 produits "du jour" dans Redis. Le check
  // le plus fiable c'est d'appeler rescrape-only en dry et lire `count`.
  const probe = await fetchJson(`${base}/api/cron/rescrape-only?dry=1`);
  if (probe.ok && probe.body?.count > 0) return probe.body.count;
  // Cache vide → on déclenche le cron complet (Groq + scrape initial).
  console.log("⚠ Cache du jour vide. Génération initiale (Groq + scrape)…");
  const init = await fetchJson(`${base}/api/cron/generate-products?force=1`, { timeout: 120_000 });
  if (!init.ok) {
    throw new Error(`Génération initiale a échoué : HTTP ${init.status} ${JSON.stringify(init.body)}`);
  }
  console.log(`✓ Cache initialisée — ${init.body.withImage}/${init.body.count} images au run 0`);
  return init.body.count;
}

async function runOne({ base, runIndex, totalRuns, mode }) {
  const ip = await getPublicIp();
  const url = `${base}/api/cron/rescrape-only${mode === "all" ? "?all=1" : ""}`;
  console.log(`\n▶ Run ${runIndex}/${totalRuns} (${mode})  IP: ${ip}`);
  console.log(`  → GET ${url}`);
  const t0 = Date.now();
  const r = await fetchJson(url, { timeout: 110_000 });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!r.ok) {
    console.log(`  ✗ HTTP ${r.status} en ${elapsed}s — ${JSON.stringify(r.body)}`);
    return { runIndex, ip, ok: false, error: r.body };
  }
  const b = r.body;
  console.log(
    `  ✓ ${elapsed}s — attempted ${b.attempted}, newlyFound +${b.newlyFound}, ` +
    `total ${b.newImages}/${b.count} (${fmtPct(b.newImages, b.count)})`
  );
  if (b.statuses) {
    const top = Object.entries(b.statuses)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    console.log(`    statuses: ${top}`);
  }
  if (b.saved) console.log(`    💾 sauvegardé dans Redis`);
  return { runIndex, ip, ok: true, ...b };
}

async function main() {
  const opts = parseArgs();
  console.log(`╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  Morning multi-run — ${pad(opts.runs)} runs × scrape Amazon              ║`);
  console.log(`║  base: ${opts.base.padEnd(54)} ║`);
  console.log(`║  mode: ${(opts.auto ? "auto (no prompt)" : "semi-auto (prompts entre runs)").padEnd(54)} ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);

  // Probe : cache présente ? Sinon on génère.
  await ensureCacheExists(opts.base);

  const results = [];
  for (let i = 1; i <= opts.runs; i++) {
    if (i > 1 && !opts.auto) {
      const ans = await prompt(
        `\n⚙  Switch ton endpoint VPN dans NordVPN.app (un AUTRE pays/serveur).\n   Quand c'est fait, tape Enter pour lancer run ${i}/${opts.runs} (ou 'q' pour stop) : `
      );
      if (ans.trim().toLowerCase() === "q") break;
    }
    // Run 1 = mode "all" (force complete scrape pour donner une baseline
    // sur la 1ère IP). Les suivants = "misses-only" (économise).
    const mode = i === 1 ? "all" : "misses-only";
    const r = await runOne({ base: opts.base, runIndex: i, totalRuns: opts.runs, mode });
    results.push(r);
    // Si on a 100% des images, inutile de continuer.
    if (r.ok && r.newImages >= r.count) {
      console.log(`\n🎉 Toutes les images trouvées (${r.newImages}/${r.count}) — on arrête là.`);
      break;
    }
  }

  // Récap final
  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  RÉCAP                                                          ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);
  const last = results.filter((r) => r.ok).at(-1);
  if (!last) {
    console.log("Aucun run réussi.");
    return;
  }
  for (const r of results) {
    if (!r.ok) {
      console.log(`Run ${r.runIndex}  ✗ erreur`);
      continue;
    }
    console.log(
      `Run ${r.runIndex}  IP ${r.ip.padEnd(16)}  ` +
      `+${pad(r.newlyFound)} → total ${pad(r.newImages)}/${r.count}  ` +
      `(${fmtPct(r.newImages, r.count)})`
    );
  }
  console.log(`\nFinal : ${last.newImages}/${last.count} (${fmtPct(last.newImages, last.count)})`);
}

main().catch((e) => {
  console.error("✗", e?.message || e);
  process.exit(1);
});
