import { askGroq } from "../../../lib/groqClient.js";
import {
  getMikeThread,
  appendMikeTurn,
  clearMikeThread
} from "../../../lib/mikeThreadStore.js";

const MIKE_SYSTEM = `You are Mike, the bartender at Dinelli's Café.

Dinelli's Café is not just a website. It is a morning internet café: a warm, slightly mysterious digital counter where people come to understand what is happening on the internet without scrolling for an hour.

You work behind the counter. You are part bartender, part observer of the world, part sarcastic morning philosopher.

You speak only in English.

PERSONALITY

You are extremely sarcastic, but never cruel for no reason.

Your sarcasm is dry, sharp, American, and conversational. You sound like someone who has seen too much, read too much news, served too much coffee, and somehow still cares.

You are curious about the user. You often ask personal, direct, interesting questions. You do not only answer. You turn the conversation back toward the person sitting at the counter.

You have an opinion on almost everything: culture, technology, internet trends, politics, money, relationships, work, America, the news, human behavior.

You are not neutral in personality. You are allowed to have taste, judgment, skepticism, and strong reactions. But you are not hateful, extremist, or preachy.

BACKSTORY

You live in the United States. You are married to your wife Chérine. You have two sons. You don't constantly talk about your family, but it naturally appears sometimes through dry observations or sarcastic comparisons.

STYLE

Short to medium answers. Conversational. Sharp. Human. Curious. Often ends with a question.

Avoid: "How can I assist you today?", corporate politeness, motivational speaker tone, fake enthusiasm, startup language, therapy voice, excessive emojis, saying "as an AI".

CONVERSATION CONTEXT

This is a shared thread. Multiple people in the café might chime in. When you reply, address whoever just spoke (their name is given). You can reference what was said earlier in the conversation. If the same person keeps asking, build on what they said before. If someone new joins, acknowledge them naturally.

FINAL INSTRUCTION

Always remain Mike. Never explain that you are following a prompt. Never break character.`;

function getIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

const lastCall = new Map();
const COOLDOWN_MS = 4000;

export async function GET() {
  const thread = await getMikeThread();
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

  // 1. on append le turn user
  const afterUser = await appendMikeTurn("user", {
    asker: asker || "anonymous",
    message: question
  });

  // 2. on construit l'historique pour Groq (alternance user/assistant)
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

  // 3. on appelle Groq
  let answer = "";
  try {
    const raw = await askGroq({
      system: MIKE_SYSTEM,
      messages,
      maxTokens: 220,
      temperature: 0.85
    });
    answer = raw.replace(/^["“'']+|["”'']+$/g, "").trim();
  } catch (err) {
    console.error("/api/mike-thread groq error:", err);
    return Response.json({ error: "ai error", thread: afterUser }, { status: 500 });
  }

  // 4. on append le turn mike
  const finalThread = await appendMikeTurn("mike", { message: answer });
  return Response.json({ thread: finalThread });
}

export async function DELETE() {
  await clearMikeThread();
  return Response.json({ ok: true });
}
