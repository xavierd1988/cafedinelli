// =============================================================================
// PRESENCE DEBUG — liste les IPs actives + l'IP vue pour le requester
// =============================================================================
// À hitter depuis chaque device de test pour comparer :
//   - peers[]            : IPs présentes dans le sorted set Redis (ZRANGE)
//   - me                 : IP que extractIp() a retournée pour TON request
//   - candidates         : valeurs brutes des headers utilisés par extractIp
//
// Si 3 visiteurs disent "je vois mon IP X1, X2, X3" mais peers contient
// seulement 2 entrées → il y a une IP qui collide en amont.
// Si peers contient bien 3 entrées mais le panel UI affiche 2 → le bug
// est dans le snapshot / cache.
// =============================================================================

import { extractIp, getOnlinePeers } from "../../../../lib/presenceStore.js";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request) {
  const me = extractIp(request);
  const headers = request.headers;
  const candidates = {
    "cf-connecting-ip": headers.get("cf-connecting-ip"),
    "true-client-ip": headers.get("true-client-ip"),
    "x-real-ip": headers.get("x-real-ip"),
    "x-vercel-forwarded-for": headers.get("x-vercel-forwarded-for"),
    "x-forwarded-for": headers.get("x-forwarded-for")
  };
  const peers = await getOnlinePeers();
  const now = Date.now();
  const peersDecorated = peers
    .map((p) => ({
      ip: p.ip,
      lastSeen: p.lastSeen,
      ageMs: now - p.lastSeen,
      isMe: p.ip === me
    }))
    .sort((a, b) => a.ageMs - b.ageMs);

  return Response.json({
    me,
    candidates,
    count: peers.length,
    peers: peersDecorated
  });
}
