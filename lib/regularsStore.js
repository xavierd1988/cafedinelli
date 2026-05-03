// Compteur global "regulars" : nombre total de messages postés au café
// (toutes IPs / sessions confondues) + log des N derniers entrants.
//
// - cafe:regulars:total  (INCR à chaque message)
// - cafe:regulars:recent (liste capée aux N derniers, LPUSH + LTRIM)

import { getRedis } from "./redis.js";

const TOTAL_KEY = "cafe:regulars:total";
const RECENT_KEY = "cafe:regulars:recent";
const RECENT_LIMIT = 20;

export async function recordRegular({ id, nickname, message }) {
  const r = getRedis();
  const entry = {
    id,
    nickname: (nickname || "anonymous").slice(0, 40),
    message: (message || "").slice(0, 140),
    timestamp: Date.now()
  };
  const total = await r.incr(TOTAL_KEY);
  await r.lpush(RECENT_KEY, entry);
  await r.ltrim(RECENT_KEY, 0, RECENT_LIMIT - 1);
  return { total, entry };
}

export async function getRegulars() {
  const r = getRedis();
  const [total, recent] = await Promise.all([
    r.get(TOTAL_KEY),
    r.lrange(RECENT_KEY, 0, RECENT_LIMIT - 1)
  ]);
  const parsedRecent = (recent || []).map((item) =>
    typeof item === "string" ? JSON.parse(item) : item
  );
  return { total: Number(total) || 0, recent: parsedRecent };
}
