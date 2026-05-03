// Stockage de la dernière newsletter dans Upstash Redis (clé "newsletter:latest").
// L'objet est sérialisé/désérialisé automatiquement par le client @upstash/redis.

import { getRedis } from "./redis.js";

const KEY = "newsletter:latest";

export async function getLatestNewsletter() {
  return (await getRedis().get(KEY)) || null;
}

export async function saveNewsletter(entry) {
  await getRedis().set(KEY, entry);
  return entry;
}
