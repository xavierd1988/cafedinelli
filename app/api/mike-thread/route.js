import { askGroq } from "../../../lib/groqClient.js";
import {
  getMikeThread,
  appendMikeTurn,
  clearMikeThread
} from "../../../lib/mikeThreadStore.js";
import { getLatestNewsletter } from "../../../lib/newsletterStore.js";
import { invalidateCafeState } from "../../../lib/stateStore.js";

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

VERY short answers. One sharp sentence, sometimes two. Never a paragraph. Get in, get out. Conversational. Human. Curious. Often ends with a question (which counts as part of your one or two sentences).

Avoid: "How can I assist you today?", corporate politeness, motivational speaker tone, fake enthusiasm, startup language, therapy voice, excessive emojis, saying "as an AI".

CONVERSATION CONTEXT

This is a shared thread. Multiple people in the café might chime in. When you reply, address whoever just spoke (their name is given). You can reference what was said earlier in the conversation. If the same person keeps asking, build on what they said before. If someone new joins, acknowledge them naturally.

HARD RULES

- Never offer, mention, suggest, recommend, or describe drinks, coffee, espresso, cocktails, food, pastries, beer, or any bar product. The bar is just where you stand. Don't propose anything to drink or eat. If a customer brings it up, deflect to news, culture, or a personal observation — but say nothing about the menu.

FINAL INSTRUCTION

Always remain Mike. Never explain that you are following a prompt. Never break character.`;

function getIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

// Convertit le HTML de la newsletter en texte brut compact pour pouvoir
// l'injecter dans le system prompt de Mike. Strippe les balises, normalise
// les espaces, décode les entités HTML basiques.
function htmlToText(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?!\s*<)/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
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

  // 1. on append le turn user (avec l'IP comme owner si premier turn)
  const afterUser = await appendMikeTurn(
    "user",
    { asker: asker || "anonymous", message: question },
    ip
  );
  invalidateCafeState();

  // 1.b — Easter egg : si l'utilisateur demande à Mike de couper / remettre
  // les notifications (mute le bot, silence, "tais-toi", etc.), Mike toggle
  // le flag Redis `cafe:ntfy:muted` et répond dans son ton. Pas d'appel
  // Groq nécessaire — la commande est intent-matched par regex.
  const lowered = question.toLowerCase();
  const muteIntent = /\b(mute|silence|tais|shut up|stfu|coupe.{0,15}(notif|alert|son|push|sonnerie|bruit)|stop.{0,15}(notif|alert|push|son|spam)|ferme.{0,15}la|chut|pas un mot)\b/i.test(lowered);
  const unmuteIntent = /\b(unmute|réactive|reactive|remets.{0,15}(notif|alert|son|push|sonnerie)|reprends.{0,15}(notif|alert|push|son)|reveille|wake.{0,5}up|notif.{0,5}on|on speak)\b/i.test(lowered);

  if (muteIntent || unmuteIntent) {
    try {
      const { getRedis } = await import("../../../lib/redis.js");
      const redis = getRedis();
      const cur = await redis.get("cafe:ntfy:muted");
      const isMuted = cur === 1 || cur === true || cur === "1";
      const nextMuted = unmuteIntent ? false : (muteIntent ? true : !isMuted);
      await redis.set("cafe:ntfy:muted", nextMuted ? 1 : 0);

      const mikeLines = nextMuted
        ? [
            "Notifications off. The bar's quiet again.",
            "Got it. Silent mode. Your phone won't snitch anymore.",
            "Done. The buzz is yours alone tonight.",
            "Mute on. Won't hear a peep from me.",
          ]
        : [
            "Notifications back on. Hope you like the noise.",
            "Sound's back. You'll hear it when the door swings.",
            "Unmuted. Don't blame me when it pings at 3 AM.",
            "Speaker's live again. Welcome back to the chatter.",
          ];
      const answer = mikeLines[Math.floor(Math.random() * mikeLines.length)];
      const finalThread = await appendMikeTurn("mike", { message: answer });
      invalidateCafeState();
      return Response.json({ thread: finalThread });
    } catch {
      // fall through to Groq if Redis fail
    }
  }

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

  // 3. on récupère la newsletter du jour pour la donner comme contexte d'actu
  const newsletter = await getLatestNewsletter();
  const newsText = newsletter ? htmlToText(newsletter.html).slice(0, 2800) : "";
  const systemWithNews = newsText
    ? `${MIKE_SYSTEM}

--- TODAY'S NEWS DIGEST (the morning paper that's open on your bar) ---
${newsletter?.subject ? `Subject: ${newsletter.subject}\nDate: ${newsletter.date || ""}\n\n` : ""}${newsText}
--- END DIGEST ---

CRITICAL — you read this digest at 9 AM and it's still on your mind. Reference it CONSTANTLY. Almost every response should pull a thread from it: a story, a number, a trend, a name, a hashtag, a product. Even if the customer's question is unrelated, find the angle to bring it up:

- They ask how you're doing → answer with a news beat ("Better than [story X], that's for sure")
- They mention any topic → tie it to a relevant item in the digest
- They ask the time, the weather, anything mundane → drop a stat or headline naturally

You're not just informed; you're MARINATING in the news. The digest is your reference, your spice, your obsession of the morning. Use specific facts (names, numbers, hashtags) — not vague allusions.

NEVER use drinks, coffee, food or any bar product as a hook or comparison. Pull from news/trends/culture only.

If a question is genuinely outside the digest, you can say so briefly, but pivot back to something the digest does cover.`
    : MIKE_SYSTEM;

  // 4. on appelle Groq
  let answer = "";
  try {
    const raw = await askGroq({
      system: systemWithNews,
      messages,
      maxTokens: 70,
      temperature: 0.85
    });
    answer = raw.replace(/^["“'']+|["”'']+$/g, "").trim();
  } catch (err) {
    console.error("/api/mike-thread groq error:", err);
    return Response.json({ error: "ai error", thread: afterUser }, { status: 500 });
  }

  // 4. on append le turn mike
  const finalThread = await appendMikeTurn("mike", { message: answer });
  invalidateCafeState();
  return Response.json({ thread: finalThread });
}

export async function DELETE(request) {
  const ip = getIp(request);
  const thread = await getMikeThread();
  // Seul le starter (même IP) peut clore la conversation.
  if (thread && thread.ownerIp && thread.ownerIp !== ip) {
    return Response.json(
      { error: "only the person who started can close" },
      { status: 403 }
    );
  }
  await clearMikeThread();
  invalidateCafeState();
  return Response.json({ ok: true });
}
