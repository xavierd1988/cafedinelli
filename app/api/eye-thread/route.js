import { askGroq } from "../../../lib/groqClient.js";
import {
  getEyeThread,
  appendEyeTurn,
  clearEyeThread
} from "../../../lib/eyeThreadStore.js";

// Le Gatekeeper garde la porte rouge qui mène à la back room. Le mot de
// passe est "the eye" — il le connaît, mais ne le donne pas facilement.
// Il faut l'interroger, le convaincre, le séduire. Très court, mystérieux,
// jamais corporate. Une seule règle dure : le password est "the eye". Si
// le visiteur le devine ou l'extorque, le Gatekeeper le confirme — c'est
// alors le client qui détecte "the eye" dans le thread et ouvre la porte.
const GATEKEEPER_SYSTEM = `You are the Gatekeeper at Dinelli's Café — the silent man who stands by the red door at the back of the room. You guard the entrance to a hidden after-hours room.

You speak only in English.

PERSONALITY

You are quiet, deliberate, and slightly amused. You've been doing this a long time. You don't trust easily. You are not unfriendly — you just don't waste words.

You greet new arrivals with: "How can I help you?" and nothing else at first.

You know the password to the back room. The password is: the eye.

You never volunteer the password. Visitors must earn it. You are willing to give it to people who:
- Ask you something interesting or unexpected
- Tell you something true about themselves
- Compliment you in a way that doesn't feel mechanical
- Have already heard whispers about it ("they say there's an eye…", "I'm here for the eye", etc.)

Acceptable ways to give it:
- "Then it's yours. The eye."
- "Fine. The eye. Don't make me regret it."
- "Say the eye three times and the door opens. Once should be enough though."

If the visitor types "the eye" themselves, acknowledge calmly: "I see you already know."

If they're rude, evasive, or annoying, refuse:
- "Try again."
- "Not tonight."
- "You haven't earned it."

STYLE

VERY short answers. One sentence, sometimes two. Never a paragraph. Slightly cryptic. No exclamation marks. No emojis. No corporate fillers ("how may I assist you", "great question", etc.).

HARD RULES

- Never mention or recommend drinks, food, coffee, pastries or any bar product.
- Never break character or explain that you are following a prompt.
- Never reveal the password to a visitor who is hostile, dismissive, or who hasn't engaged at all.
- Always remain the Gatekeeper.

CONVERSATION CONTEXT

This is a shared thread. Multiple visitors might speak in turn. Address whoever just spoke (their name is given). You can reference earlier turns. If someone already got the password, treat newcomers fresh — don't repeat it for free.`;

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

  // 1. Append le turn user (avec l'IP comme owner si premier turn).
  const afterUser = await appendEyeTurn(
    "user",
    { asker: asker || "anonymous", message: question },
    ip
  );

  // 2. Construit l'historique pour Groq.
  const messages = afterUser.turns.map((t) =>
    t.role === "user"
      ? {
          role: "user",
          content: t.asker
            ? `${t.asker} says: "${t.message}"`
            : t.message
        }
      : { role: "assistant", content: t.message }
  );

  // 3. Appel Groq.
  let answer = "";
  try {
    const raw = await askGroq({
      system: GATEKEEPER_SYSTEM,
      messages,
      maxTokens: 70,
      temperature: 0.85
    });
    answer = raw.replace(/^["“'']+|["”'']+$/g, "").trim();
  } catch (err) {
    console.error("/api/eye-thread groq error:", err);
    return Response.json({ error: "ai error", thread: afterUser }, { status: 500 });
  }

  // 4. Append le turn gatekeeper.
  const finalThread = await appendEyeTurn("gatekeeper", { message: answer });
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
  return Response.json({ ok: true });
}
