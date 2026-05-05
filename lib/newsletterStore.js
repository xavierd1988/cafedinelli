// Stockage de la dernière newsletter dans Upstash Redis (clé "newsletter:latest").
// L'objet est sérialisé/désérialisé automatiquement par le client @upstash/redis.
//
// Module RÉSILIENT : try/catch autour de chaque appel Redis pour que
// /api/newsletter ne renvoie jamais HTTP 500 si Upstash est en timeout
// ou throttle. En cas d'échec on retombe sur null (= site affiche le
// fallback newsletter dans PaperPanel).

import { getRedis } from "./redis.js";

const KEY = "newsletter:latest";

export async function getLatestNewsletter() {
  try {
    const v = await getRedis().get(KEY);
    return v || null;
  } catch (err) {
    console.warn("newsletterStore.getLatestNewsletter: Redis indispo", err?.message);
    return null;
  }
}

export async function saveNewsletter(entry) {
  try {
    await getRedis().set(KEY, entry);
  } catch (err) {
    console.warn("newsletterStore.saveNewsletter: Redis indispo", err?.message);
    throw err;
  }
  return entry;
}
