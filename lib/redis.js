import { Redis } from "@upstash/redis";

let client = null;

// Singleton Upstash Redis. Lit les credentials dans process.env :
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN
// (les deux sont fournies sur le dashboard de la base à upstash.com)
export function getRedis() {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash Redis non configuré : UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN doivent être définies dans .env.local"
    );
  }
  client = new Redis({ url, token });
  return client;
}
