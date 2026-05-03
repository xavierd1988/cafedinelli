// Stockage des nicknames indexés par IP, persisté dans Upstash Redis
// (un hash unique "nicknames" : champ = IP, valeur = nickname).

import { getRedis } from "./redis.js";

const KEY = "nicknames";

export async function getNickname(ip) {
  const value = await getRedis().hget(KEY, ip);
  return value || "";
}

export async function setNickname(ip, nickname) {
  const r = getRedis();
  if (nickname) {
    await r.hset(KEY, { [ip]: nickname });
  } else {
    await r.hdel(KEY, ip);
  }
}
