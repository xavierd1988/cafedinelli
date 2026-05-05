import {
  getEyeThread,
  appendEyeTurn,
  clearEyeThread
} from "../../../lib/eyeThreadStore.js";
import { invalidateCafeState } from "../../../lib/stateStore.js";

// Gatekeeper déterministe : il garde la porte rouge. Une seule entrée valide,
// le password "the eye". Tout autre input → "Please move back." et le thread
// expire en 4s pour fermer la conversation. Pas de LLM, pas d'interrogation —
// le visiteur doit déjà connaître le code (rumeur, indice ailleurs, etc.).
const PASSWORD_RE = /\bthe\s*eye\b/i;
const PASSWORD_TTL_MS = 30_000; // succès : conversation reste 30s
const REJECT_TTL_MS   = 4_000;  // refus : se ferme rapidement

const WELCOME_LINES = [
  "The eye. Welcome.",
  "Then it's yours. Step in.",
  "I see you already know. Welcome."
];

function getIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

const lastCall = new Map();
const COOLDOWN_MS = 4000;

export async function GET() {
  const thread = await getEyeThread();
  return Response.json({ thread });
}

export async function POST(request) {
  const ip = getIp(request);
  const now = Date.now();
  if (now - (lastCall.get(ip) || 0) < COOLDOWN_MS) {
    return Response.json({ error: "slow down" }, { status: 429 });
  }
  lastCall.set(ip, now);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const asker = typeof body?.asker === "string" ? body.asker.trim().slice(0, 40) : "";
  if (!question || question.length > 500) {
    return Response.json({ error: "bad question" }, { status: 400 });
  }

  // 1. Append le turn user (avec l'IP comme owner si premier turn). On
  //    décide tout de suite du TTL final : si le password est correct on
  //    garde 30s, sinon on raccourcit à 4s pour clore vite.
  const isPasswordCorrect = PASSWORD_RE.test(question);
  const ttlMs = isPasswordCorrect ? PASSWORD_TTL_MS : REJECT_TTL_MS;

  await appendEyeTurn(
    "user",
    { asker: asker || "anonymous", message: question },
    ip,
    ttlMs
  );

  // 2. Réponse déterministe : welcome (random parmi 3 lignes) ou rejet sec.
  const answer = isPasswordCorrect
    ? WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)]
    : "Please move back.";

  // 3. Append le turn gatekeeper avec le même TTL court/long.
  const finalThread = await appendEyeTurn(
    "gatekeeper",
    { message: answer },
    null,
    ttlMs
  );
  invalidateCafeState();
  return Response.json({ thread: finalThread });
}

export async function DELETE(request) {
  const ip = getIp(request);
  const thread = await getEyeThread();
  // Seul le starter (même IP) peut clore la conversation.
  if (thread && thread.ownerIp && thread.ownerIp !== ip) {
    return Response.json(
      { error: "only the person who started can close" },
      { status: 403 }
    );
  }
  await clearEyeThread();
  invalidateCafeState();
  return Response.json({ ok: true });
}
