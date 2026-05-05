// Compteur global "regulars" : nombre total de messages postés au café
// (toutes IPs / sessions confondues) + log des N derniers entrants.
//
// =============================================================================
// ZONE ISOLÉE — Ce module est CONÇU pour ne jamais retomber à zéro.
// =============================================================================
// Stratégie de robustesse :
//
// 1. BASE_REGULARS (= 201)
//    Plancher hardcodé : on additionne toujours cette valeur au compteur
//    Redis. Même si Redis est vide / inaccessible / a été flush, l'app
//    affichera AU MINIMUM 201. Quand un nouveau visiteur poste, le total
//    affiché passe à 202, 203, etc.
//    Pour bumper le baseline plus tard (ex. après plusieurs mois), il
//    suffit d'augmenter cette constante — pas besoin de toucher à Redis.
//
// 2. Try/catch autour de tous les appels Redis
//    Si Redis throw (env vars manquantes, network, etc.), getRegulars()
//    retourne quand même `{ total: BASE_REGULARS, recent: [] }` au lieu
//    de remonter une exception à l'API. Le client voit toujours un
//    compteur cohérent.
//
// 3. recordRegular() reste résilient : si l'INCR ou le LPUSH échouent,
//    on retourne quand même un total "best effort" pour que l'UI
//    n'affiche pas un saut bizarre.
//
// Clés Redis :
//   - cafe:regulars:total  (INCR à chaque message — delta seulement)
//   - cafe:regulars:recent (liste capée aux N derniers, LPUSH + LTRIM)
// =============================================================================

import { getRedis } from "./redis.js";

const TOTAL_KEY = "cafe:regulars:total";
const RECENT_KEY = "cafe:regulars:recent";
const RECENT_LIMIT = 20;

// Plancher du compteur. Le compteur affiché = BASE + delta Redis.
// Si Redis est à 0 → on affiche 201. Si Redis est à 50 → on affiche 251.
// Bump cette constante manuellement si tu veux relever le plancher
// (par ex. après une refonte / nettoyage volontaire).
const BASE_REGULARS = 201;

export async function recordRegular({ id, nickname, message }) {
  const entry = {
    id,
    nickname: (nickname || "anonymous").slice(0, 40),
    message: (message || "").slice(0, 140),
    timestamp: Date.now()
  };

  let delta = 0;
  let recent = [];
  try {
    const r = getRedis();
    delta = await r.incr(TOTAL_KEY);
    await r.lpush(RECENT_KEY, entry);
    await r.ltrim(RECENT_KEY, 0, RECENT_LIMIT - 1);
    // On relit les recents pour les renvoyer au client immédiatement.
    const fresh = await r.lrange(RECENT_KEY, 0, RECENT_LIMIT - 1);
    recent = (fresh || []).map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );
  } catch (err) {
    // Redis indisponible : on logge mais on ne casse pas la requête.
    // L'utilisateur a posté, on lui retourne un total cohérent.
    console.warn("regularsStore: Redis indisponible, fallback BASE_REGULARS", err?.message);
    recent = [entry];
  }

  return {
    total: BASE_REGULARS + (Number(delta) || 0),
    entry
  };
}

export async function getRegulars() {
  let delta = 0;
  let recent = [];
  try {
    const r = getRedis();
    const [total, recentRaw] = await Promise.all([
      r.get(TOTAL_KEY),
      r.lrange(RECENT_KEY, 0, RECENT_LIMIT - 1)
    ]);
    delta = Number(total) || 0;
    recent = (recentRaw || []).map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );
  } catch (err) {
    // Si Redis tombe, on retourne quand même un état cohérent : le
    // plancher 201 + une liste vide. Garantit que le compteur ne tombe
    // JAMAIS à 0 affiché côté client.
    console.warn("regularsStore.getRegulars: fallback BASE_REGULARS", err?.message);
  }
  return {
    total: BASE_REGULARS + delta,
    recent
  };
}

// Exporté pour les tests / outils qui veulent connaître le plancher.
export { BASE_REGULARS };
