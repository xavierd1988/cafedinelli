import { getNickname, setNickname } from "../../../lib/nicknameStore.js";

// La requête arrive typiquement derrière un proxy (Vercel, etc.) qui pose
// l'IP cliente dans x-forwarded-for. En dev local on retombe sur 127.0.0.1.
function getIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

export async function GET(request) {
  const ip = getIp(request);
  const nickname = await getNickname(ip);
  return Response.json({ nickname: nickname || "" });
}

export async function POST(request) {
  const ip = getIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const raw = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  if (raw.length > 40) {
    return Response.json({ error: "too long" }, { status: 400 });
  }
  await setNickname(ip, raw);
  return Response.json({ nickname: raw });
}
