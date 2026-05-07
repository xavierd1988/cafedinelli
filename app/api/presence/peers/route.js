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
      sessionId: p.sessionId,
      member: p.member,
      lastSeen: p.lastSeen,
      ageMs: now - p.lastSeen,
      isMe: p.ip === me,
      isLocalhost: p.ip === "::1" || p.ip === "127.0.0.1"
    }))
    .sort((a, b) => a.ageMs - b.ageMs);

  // Décompose pour clarté.
  // displayCount = ce que voit le visiteur dans le panel public
  //              = nombre d'IPs uniques (hors localhost).
  // realSessions = nombre d'entrées sorted-set hors localhost
  //              (i.e. nb d'onglets * NAT collapse, infos debug).
  const realPeers = peersDecorated.filter((p) => !p.isLocalhost);
  const uniqueIps = new Set(realPeers.map((p) => p.ip));
  const uniqueSessions = new Set(realPeers.map((p) => p.sessionId).filter(Boolean));

  return Response.json({
    me,
    candidates,
    summary: {
      displayCount: uniqueIps.size,          // ← ce qu'affiche le panel UI
      totalEntries: peers.length,
      realSessions: realPeers.length,        // sessions réelles (hors localhost)
      uniqueIps: uniqueIps.size,             // nb d'IPs distinctes
      uniqueSessions: uniqueSessions.size,   // nb d'onglets distincts
      localhostNoise: peers.length - realPeers.length
    },
    peers: peersDecorated
  });
}
