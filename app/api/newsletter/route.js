import { getLatestNewsletter, saveNewsletter } from "../../../lib/newsletterStore.js";

// Si le HTML envoyé contient <body>...</body>, on garde uniquement le contenu
// du body (pour éviter de doubler html/head/title qui ne servent à rien dans
// le panneau).
function extractBody(html) {
  if (typeof html !== "string") return "";
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

export async function GET() {
  const newsletter = await getLatestNewsletter();
  return Response.json({ newsletter });
}

export async function POST(request) {
  const expected = process.env.NEWSLETTER_SECRET;
  if (!expected) {
    return Response.json(
      { error: "NEWSLETTER_SECRET not configured on server" },
      { status: 500 }
    );
  }

  const provided = request.headers.get("x-newsletter-secret");
  if (provided !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const html = typeof body?.html === "string" ? body.html : "";
  if (!html.trim()) {
    return Response.json({ error: "missing html field" }, { status: 400 });
  }

  const subject = typeof body?.subject === "string"
    ? body.subject.trim().slice(0, 200)
    : "";
  const date = typeof body?.date === "string"
    ? body.date.slice(0, 32)
    : new Date().toISOString().slice(0, 10);

  const entry = {
    subject,
    date,
    html: extractBody(html),
    receivedAt: new Date().toISOString()
  };
  await saveNewsletter(entry);
  return Response.json({ ok: true, entry: { subject, date, receivedAt: entry.receivedAt } });
}
